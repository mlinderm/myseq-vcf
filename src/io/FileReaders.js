/**
 * @flow
 */
const fs = require('fs');
const http = require('http');
const URL = require('url');
const AbstractFileReader = require('./AbstractFileReader');

function bufferToArrayBufferSlice(buffer: Buffer, bytes?: number) {
  const bytesToRead = (bytes === undefined) ? buffer.byteLength : bytes;
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + bytesToRead);
}

class LocalFileReader extends AbstractFileReader {
  handle: number;

  size: number;

  constructor(path: string) {
    super();
    this.handle = fs.openSync(path, 'r');
    this.size = fs.statSync(path).size;
  }

  bytes(start: number = 0, length?: number): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const lengthToRead = (length === undefined) ? this.size - start : length;
      const buffer = Buffer.alloc(lengthToRead);
      fs.read(this.handle, buffer, 0, lengthToRead, start, (err, read, buf) => {
        if (err) {
          reject(new Error(err));
        } else {
          resolve(bufferToArrayBufferSlice(buf, read));
        }
      });
    });
  }
}

class RemoteFileReader extends AbstractFileReader {
  url: Object;

  constructor(url: string) {
    super();
    this.url = URL.parse(url);
  }

  bytes(start: number = 0, length?: number): Promise<ArrayBuffer> {
    const options = { ...this.url, method: 'GET' };

    if (start !== 0 || length !== undefined) {
      // Requesting only a portion of the file
      options.headers = {
        Range: (length !== undefined) ? `bytes=${start}-${start + (length - 1)}` : `bytes=${start}-`,
      };
    }

    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        const data = [];
        res.on('data', (chunk) => {
          data.push(chunk);
        }).on('end', () => {
          const buffer = Buffer.concat(data);
          resolve(bufferToArrayBufferSlice(buffer));
        });
      });
      req.on('error', (e) => {
        reject(new Error(`RemoteFileRequest failed: ${e.message}`));
      });
      req.end();
    });
  }
}

module.exports = {
  LocalFileReader,
  RemoteFileReader,
};
