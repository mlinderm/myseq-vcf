/**
 * @flow
 */
const findIndex = require('lodash/findIndex');
const last = require('lodash/last');
const defer = require('promise-defer');

const { ContigNotInIndexError } = require('../util/Errors');
const TabixIndexedFile = require('./TabixIndexedFile');
const Ref = require('../features/ReferenceGenome');
const VCFVariant = require('../features/VCFVariant');

class VCFSource {
  _source: TabixIndexedFile;
  _reference: Promise<Ref.ReferenceGenome>;
  _samples: Promise<Array<string>>;

  constructor(source: TabixIndexedFile, reference: ?Ref.ReferenceGenome) {
    this._source = source;

    const referenceResolver = defer();
    if (reference !== undefined) {
      this._reference = Promise.resolve(reference);
    } else {
      // Will only be used if reference is not specified
      this._reference = referenceResolver.promise;
    }

    this._samples = this._source.header().then((headerLines) => {
      if (!headerLines[0].startsWith('##fileformat=VCF')) {
        throw new Error('Source is not a valid VCF file');
      }

      // 1. Look for a reference line
      const refIdx = findIndex(headerLines, line => line.startsWith('##reference='));
      if (refIdx !== -1) {
        // Do we know this reference file?
        const referenceFrom = Ref.referenceFromFile(headerLines[refIdx].substring(12));
        if (referenceFrom !== undefined) {
          referenceResolver.resolve(referenceFrom);
        }
      }

      // 2. Parse contig lines to infer reference
      const contigs = headerLines
        .filter(line => line.startsWith('##contig='))
        .map(line => line.match(/ID=([^,>]+)/))
        .filter(match => match !== null)
        .map(match => match[1]);
      if (contigs.length > 0) {
        const referenceFrom = Ref.referenceFromContigs(contigs);
        if (referenceFrom !== undefined) {
          referenceResolver.resolve(referenceFrom);
        }
      }

      // -OR- set hg19 as a default (will be a no-op if referenceResolver is already resolved)
      referenceResolver.resolve(Ref.hg19Reference);

      // Last line should be column labels
      const columns = last(headerLines).split('\t');
      if (columns[0] !== '#CHROM' || columns.length < 8) {
        throw new Error('Invalid column header line (#CHROM...)');
      }

      return columns.slice(9);
    });
  }

  reference(): Promise<Ref.ReferenceGenome> {
    return this._reference;
  }

  samples(): Promise<Array<string>> {
    return this._samples;
  }

  /**
   * Normalize contig naming based on actual reference for source
   * @param  {string} ctg Contig
   * @return {Promise<string>}     Normalized contig name
   */
  normalizeContig(ctg: string): Promise<string> {
    return this._reference.then(ref => ref.normalizeContig(ctg));
  }

  /**
   * Query for variants overlapping genomic region
   * @param  {string} ctg Contig
   * @param  {number} pos Inclusive start of genomic region
   * @param  {number} end Inclusive end of genomic region
   * @return {Promise<Array<VCFVariant>>}     Array of VCFVariants overlapping region
   */
  variants(ctg: string, pos: number, end: number): Promise<Array<VCFVariant>> {
    const queryResults = this._reference
      .then(ref => ref.normalizeContig(ctg))
      .then(normalizedCtg => this._source.records(normalizedCtg, pos, end));

    return Promise.all([queryResults, this._samples])
      .then(
        ([records, samples]) => records.map(record => new VCFVariant(record, samples)),
        (err) => {
          if (err instanceof ContigNotInIndexError) { return []; }
          throw err;
        },
      );
  }

  _synthVariant(ctg: string, pos: number, ref: string, alt: string): Promise<VCFVariant> {
    return Promise.all([this._reference, this._samples]).then(([reference, samples]) => {
      let synthRecord = `${reference.normalizeContig(ctg)}\t${pos}\t.\t${ref}\t${alt}\t.\t.\t.`;
      if (samples.length > 0) { synthRecord += `\tGT${'\t0/0'.repeat(samples.length)}`; }
      return new VCFVariant(synthRecord, samples, true /* isSynth */);
    });
  }

  /**
   * Query for single variant
   * @param  {string} ctg          Contig
   * @param  {number} pos          VCF position
   * @param  {string} ref          Reference allele
   * @param  {string} alt          Alternate allele
   * @param  {boolean} assumeRefRef If variant not found, synthesize variant with REF/REF genotype
   * @return {Promise<VCFVariant>}  Found (or synthetic) variant or undefined if
   * assumeRefRef is false and variant is not found
   */
  variant(
    ctg: string,
    pos: number,
    ref: string,
    alt: string,
    assumeRefRef: boolean = false,
  ): Promise<VCFVariant> {
    return this.variants(ctg, pos, pos).then((variants) => {
      // Filter for exact position and allele match, if none found and assumeRefRef
      // is true, synthesize a variant with a Ref/Ref genotype
      const foundVariant = variants
        .filter(variant => variant.ref === ref && variant.alt.indexOf(alt) !== -1)
        .shift();
      if (!foundVariant && assumeRefRef) {
        return this._synthVariant(ctg, pos, ref, alt);
      }
      return foundVariant;
    });
  }
}

module.exports = VCFSource;
