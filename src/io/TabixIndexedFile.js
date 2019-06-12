/**
 * @flow
 */
/* eslint-disable no-bitwise */
/* eslint new-cap: ["error", { "newIsCapExceptions": ["jBinary", "jDataView"] }] */

// This file contains code adapted from
// https://github.com/jsa-aerial/JS-Binary-VCF-Tabix
// The license for which is copied below:

// --------------------------------------------------------------------------//
//                                                                          //
//                        B I N A R Y - V C F                               //
//                                                                          //
//                                                                          //
// Copyright (c) 2014-2014 Trustees of Boston College                       //
//                                                                          //
// Permission is hereby granted, free of charge, to any person obtaining    //
// a copy of this software and associated documentation files (the          //
// "Software"), to deal in the Software without restriction, including      //
// without limitation the rights to use, copy, modify, merge, publish,      //
// distribute, sublicense, and/or sell copies of the Software, and to       //
// permit persons to whom the Software is furnished to do so, subject to    //
// the following conditions:                                                //
//                                                                          //
// The above copyright notice and this permission notice shall be           //
// included in all copies or substantial portions of the Software.          //
//                                                                          //
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,          //
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF       //
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND                    //
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE   //
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION   //
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION    //
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.          //
//                                                                          //
// Author: Jon Anthony                                                      //
//                                                                          //
// --------------------------------------------------------------------------//

// This file contains code adapted from
// https://github.com/hammerlab/pileup.js
// which uses the Apache 2.0 license included herein.


const jDataView = require('jdataview');
const jBinary = require('jbinary');
const pako = require('pako/lib/inflate');
const defer = require('promise-defer');
const findLastIndex = require('lodash/findLastIndex');
const { ContigNotInIndexError } = require('../util/Errors');

const AbstractFileReader = require('./AbstractFileReader');

type PakoResult = {
  err: number;
  msg: string;
  buffer: ?ArrayBuffer;
  total_in: number;
}

type InflatedBlock = {
  offset: number;
  compressedLength: number;
  buffer: ArrayBuffer;
}

function inflateOneGZipBlock(buffer, position): PakoResult {
  const inflator = new pako.Inflate();
  inflator.push(new Uint8Array(buffer, position));
  return {
    err: inflator.err,
    msg: inflator.msg,
    buffer: inflator.result ? inflator.result.buffer : null,
    total_in: inflator.strm.total_in,
  };
}

/**
 * Tabix files are compressed with BGZF, which consists of many concatenated
 * gzip'd blocks. These blocks must be decompressed separately.
 * @param lastBlockStart Stop decompression at this byte offset
 */
function inflateConcatenatedGZip(buffer: ArrayBuffer, lastBlockStart?: number): InflatedBlock[] {
  let position = 0;
  const blocks = [];
  const maxOffset = (lastBlockStart === undefined) ? buffer.byteLength : lastBlockStart;
  do {
    const result = inflateOneGZipBlock(buffer, position);
    if (result.err) {
      throw new Error(`Gzip error: ${result.msg}`);
    }
    if (result.buffer) {
      blocks.push({
        offset: position,
        compressedLength: result.total_in,
        buffer: result.buffer,
      });
    }
    position += result.total_in;
  } while (position <= maxOffset && position < buffer.byteLength);

  return blocks;
}

function concatArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  const totalBytes = buffers.map(b => b.byteLength).reduce((a, b) => a + b, 0);
  const output = new Uint8Array(totalBytes);

  let position = 0;
  buffers.forEach((buffer) => {
    output.set(new Uint8Array(buffer), position);
    position += buffer.byteLength;
  });

  return output.buffer;
}


/**
 * Inflate one or more gzip blocks in the buffer concatenating the results,
 * mirroring the behavior of gzip(1). Use lastBlockStart=0 to read a single
 * block.
 */
function inflateGZip(buffer: ArrayBuffer, lastBlockStart?: number): ArrayBuffer {
  return concatArrayBuffers(inflateConcatenatedGZip(buffer, lastBlockStart).map(x => x.buffer));
}

class VirtualOffset {
  coffset: number;

  // Compressed offset
  uoffset: number; // Uncompressed offset

  constructor(coffset: number, uoffset: number) {
    this.coffset = coffset;
    this.uoffset = uoffset;
  }

  compareTo(other: VirtualOffset): number {
    return this.coffset - other.coffset || this.uoffset - other.uoffset;
  }

  static fromBlob(u8: Uint8Array, offset?: number): VirtualOffset {
    const validOffset = offset || 0;
    const uoffset = u8[validOffset] + (u8[validOffset + 1] * 256);
    const coffset = u8[validOffset + 2]
      + (u8[validOffset + 3] * 256)
      + (u8[validOffset + 4] * 65536)
      + (u8[validOffset + 5] * 16777216)
      + (u8[validOffset + 6] * 4294967296)
      + (u8[validOffset + 7] * 1099511627776);
    return new VirtualOffset(coffset, uoffset);
  }
}

type Chunk = {
  beg: VirtualOffset;
  end: VirtualOffset;
}

// Tabix schema, as defined in http://samtools.github.io/hts-specs/tabix.pdf, adapted
// from https://github.com/jsa-aerial/JS-Binary-VCF-Tabix
const TABIX_FORMAT = {

  'jBinary.all': 'tabix',
  'jBinary.littleEndian': true,

  virtual_offset: jBinary.Template({ // eslint-disable-line new-cap
    baseType: 'uint64',
    read() {
      const u64 = this.baseRead();
      return new VirtualOffset(
        // compressed offset
        (u64.hi * 65536) + (u64.lo >>> 16),
        // uncompressed offset
        u64.lo & 0xffff,
      );
    },
  }),

  header: {
    magic: ['const', ['string', 4], 'TBI\x01', true],
    n_ref: 'int32',
    format: 'int32',
    col_seq: 'int32',
    col_beg: 'int32',
    col_end: 'int32',
    meta: 'int32',
    skip: 'int32',
    l_nm: 'int32',
    names: ['string', context => context.l_nm],
  },

  chunk: {
    beg: 'virtual_offset',
    end: 'virtual_offset',
  },


  // Break chunk parsing apart as a performance optimization (adapted from pileup.js)
  // actual schema is:
  // chunks:    ['array', 'chunk', function(context){ return context.n_chunk; }]
  // intervals: ['array', 'virtual_offset', function(context) { return context.n_intv; }]

  chunks: ['array', 'chunk'],

  bin: {
    bin: 'uint32',
    n_chunk: 'int32',
    chunks: ['blob', context => 16 * context.n_chunk],
  },

  index: {
    n_bin: 'int32',
    bins: ['array', 'bin', context => context.n_bin],
    n_intv: 'int32',
    intervals: ['blob', context => 8 * context.n_intv],
  },

  tabix: {
    head: 'header',
    indexseq: ['array', 'index', context => context.head.n_ref],
  },

};

/**
 * Advance DataView by one BGZF block (without decompressing), returning
 * the compressed and uncompressed size for that block
 */
function advanceToEndOfBGZFBlock(view: jDataView) {
  // Based on SAM specification: https://samtools.github.io/hts-specs/SAMv1.pdf
  view.skip(10); // Fixed header

  let bsize;
  const xlen = view.getUint16();

  const extraEnd = view.tell() + xlen;
  while (view.tell() < extraEnd) {
    const si1 = view.getUint8();
    const si2 = view.getUint8();
    if (si1 === 66 && si2 === 67) {
      view.getUint16(); // SLEN == 2
      bsize = view.getUint16();
      view.seek(extraEnd);
      break;
    } else {
      view.skip(view.getUint16()); // Skip extra field
    }
  }
  if (bsize === undefined) {
    throw new Error('Unable to determine block size');
  }

  view.skip((bsize - xlen - 19) + 4); // To start of ISIZE
  return { csize: bsize, usize: view.getUint32() };
}

/**
 * Advance DataView by one contig's Tabix index
 */
function advanceToEndOfIndex(view: jDataView) {
  const numBins = view.getInt32();
  for (let b = 0; b < numBins; b += 1) {
    view.getUint32(); // bin ID
    const numChunks = view.getInt32();
    view.skip(numChunks * 16); // 16 bytes per chunk
  }
  view.skip(view.getInt32() * 8); // 8 bytes per interval element
}

function readChunks(buffer: Uint8Array): Array<Chunk> {
  return new jBinary(buffer, TABIX_FORMAT).read('chunks');
}

function readInterval(buffer: Uint8Array, index: number): VirtualOffset {
  // Convert index to bytes
  return VirtualOffset.fromBlob(buffer, index * 8);
}

// Region-to-bins, as defined in http://samtools.github.io/hts-specs/tabix.pdf,
// adapted from https://github.com/hammerlab/pileup.js
function reg2bins(beg, end) {
  let k;
  const list = [];
  const incEnd = end - 1;
  list.push(0);
  for (k = 1 + (beg >> 26); k <= 1 + (incEnd >> 26); k += 1) list.push(k);
  for (k = 9 + (beg >> 23); k <= 9 + (incEnd >> 23); k += 1) list.push(k);
  for (k = 73 + (beg >> 20); k <= 73 + (incEnd >> 20); k += 1) list.push(k);
  for (k = 585 + (beg >> 17); k <= 585 + (incEnd >> 17); k += 1) list.push(k);
  for (k = 4681 + (beg >> 14); k <= 4681 + (incEnd >> 14); k += 1) list.push(k);
  return list;
}

function optimizeChunks(chunks: Array<Chunk>, minimumOffset: VirtualOffset): Array<Chunk> {
  chunks.sort((l, r) => l.beg.compareTo(r.beg) || l.end.compareTo(r.end));

  const newChunks = [];
  chunks.forEach((chunk) => {
    if (chunk.end.compareTo(minimumOffset) >= 0) {
      if (newChunks.length === 0) {
        newChunks.push(chunk);
      } else {
        // Merge overlapping or adjacent chunks
        const lastChunk = newChunks[newChunks.length - 1];
        if (chunk.beg.compareTo(lastChunk.end) > 0) {
          newChunks.push(chunk);
        } else {
          lastChunk.end = chunk.end;
        }
      }
    }
  });

  return newChunks;
}

function genericLineInRegion() {
  return true;
}

function vcfLineInRegion(line: string, ctg: string, pos: number, end: number) {
  const fields = line.split('\t', 8);
  if (fields.length < 8) {
    return false; // Malformed VCF line
  }

  if (fields[0] !== ctg) { // CHROM doesn't match
    return false;
  }

  const POS = parseInt(fields[1], 10);
  if (POS > end) { // POS beyond "end"
    return false;
  }

  // Determine END of VCF record, including END specified in INFO field
  const foundEND = /END=(\d+)/.exec(fields[7]);
  const END = foundEND ? parseInt(foundEND[1], 10) : POS + (fields[3].length - 1);
  if (END < pos) {
    return false;
  }

  return true;
}

type ContigIndex = {
  bytes: Array<number>,
  index: ?Promise<Object>,
};

class TabixIndexedFile {
  _source: AbstractFileReader;

  _indexBuffer: Promise<ArrayBuffer>;

  _overlapFunction: Promise<{(line: string, ctg: string, pos: number, end: number): boolean;}>;

  _commentCharacter: Promise<string>;

  _contigs: Promise<Map<string, ContigIndex>>;

  constructor(dataSource: AbstractFileReader, indexSource: AbstractFileReader) {
    this._source = dataSource;

    const indexBuffer = defer();
    const overlapFunction = defer();
    const commentCharacter = defer();

    this._indexBuffer = indexBuffer.promise;
    this._overlapFunction = overlapFunction.promise;
    this._commentCharacter = commentCharacter.promise;

    this._contigs = indexSource.bytes().then((buffer) => {
      const uncompressedIndex = inflateGZip(buffer);
      indexBuffer.resolve(uncompressedIndex);

      const view = new jDataView(uncompressedIndex, 0, undefined, true /* little endian */);
      const parser = new jBinary(view, TABIX_FORMAT);

      // Parse header with metadata
      const head = parser.read(TABIX_FORMAT.header);

      // Set overlap function based on index header
      const { format } = head;
      switch (format) {
        case 2:
          overlapFunction.resolve(vcfLineInRegion);
          break;
        default:
          overlapFunction.resolve(genericLineInRegion);
          break;
      }

      // Extract comment character
      commentCharacter.resolve(String.fromCharCode(head.meta));

      // Compute contig indices to faciliate lazy parsing on indices (adapted from pileup.js)
      const names = head.names.replace(/\0+$/, '').split('\0');
      const contig2Index = new Map();

      for (let r = 0; r < head.n_ref; r += 1) {
        const contigBufferStart = view.tell();

        advanceToEndOfIndex(view);

        contig2Index.set(names[r], {
          bytes: [contigBufferStart, view.tell()],
          index: undefined,
        });
      }

      return contig2Index;
    });
  }

  _chunksForInterval(ctg: string, pos: number, end: number): Promise<Array<Chunk>> {
    return this._contigs.then((contigs) => {
      const lazyIndex = contigs.get(ctg);
      if (!lazyIndex) {
        throw new ContigNotInIndexError(`Unknown contig: ${ctg}`);
      }

      if (!lazyIndex.index) {
        // Lazily parse index if needed
        lazyIndex.index = this._indexBuffer.then((buffer) => {
          const [start, stop] = lazyIndex.bytes;

          const view = new jDataView(buffer, start, stop - start, true /* little endian */);
          const parser = new jBinary(view, TABIX_FORMAT);

          return parser.read(TABIX_FORMAT.index);
        });
      }
      return lazyIndex.index;
    }).then((index) => {
      const bins = reg2bins(pos, end + 1);
      let chunks = index.bins
        .filter(b => bins.indexOf(b.bin) >= 0)
        .map(b => readChunks(b.chunks))
        .reduce((acc, cur) => acc.concat(cur), []);

      // Apply linear index and other optimizations
      const minimumOffset = readInterval(index.intervals, Math.max(0, Math.floor(pos / 16384)));
      chunks = optimizeChunks(chunks, minimumOffset);

      return chunks;
    });
  }

  _fetchHeader(offset: number): Promise<Array<string>> {
    // Read up to a single compressed block (no more than 64k)
    return Promise
      .all([this._source.bytes(offset, 65536), this._commentCharacter])
      .then(([buffer, comment]) => {
        const uBuffer = inflateGZip(buffer, 0 /* Read single block */);
        const uView = new Uint8Array(uBuffer, 0, uBuffer.byteLength);

        const decoder = new TextDecoder('utf-8'); // VCF 4.3 allows UTF characters
        const lines = decoder.decode(uView).split(/\r?\n/); // VCF 4.3 allows LF or CRLF

        const last = findLastIndex(lines, line => line.startsWith(comment));
        if (last === (lines.length - 1)) {
          throw new Error('Headers larger than single bgzip block not yet supported');
        }
        lines.splice(last + 1);

        return lines;
      });
  }

  header(): Promise<Array<string>> {
    return this._fetchHeader(0);
  }

  records(ctg: string, pos: number, end: number): Promise<Array<string>> {
    const chunksPromise = this._chunksForInterval(ctg, pos, end);
    return Promise.all([chunksPromise, this._overlapFunction]).then(([chunks, overlapFunction]) => {
      const decoder = new TextDecoder('utf-8'); // VCF 4.3 allows UTF characters

      // Read data for each chunk to produce array-of-array of decoded lines
      return Promise.all(chunks.map((chunk) => {
        // At a minimum read at least one compressed block (which must be less than 64k)
        const cOffset = chunk.beg.coffset;
        const cBytes = (chunk.end.coffset - chunk.beg.coffset)
          + (chunk.end.uoffset > 0) ? 65536 : 0;

        return this._source.bytes(cOffset, cBytes).then((buffer) => {
          const uOffset = chunk.beg.uoffset; // Start decoding at chunk's uncompressed offset
          let uBytes = chunk.end.uoffset - chunk.beg.uoffset;

          // Scan through compressed buffer to tally total uncompressed size
          const view = new jDataView(buffer, 0, undefined, true /* little endian */);
          while (view.tell() + cOffset < chunk.end.coffset) {
            uBytes += advanceToEndOfBGZFBlock(view).usize;
          }
          console.assert((view.tell() + cOffset) === chunk.end.coffset);

          const uBuffer = inflateGZip(buffer, chunk.end.coffset /* Start of last block */);
          const uView = new Uint8Array(uBuffer, uOffset, uBytes);

          return decoder.decode(uView).split(/\r?\n/) // VCF 4.3 allows LF or CRLF
            .filter(line => line.length > 0 && overlapFunction(line, ctg, pos, end));
        });
      })).then(lines => lines.reduce((acc, cur) => acc.concat(cur), []));
    });
  }
}

module.exports = TabixIndexedFile;
