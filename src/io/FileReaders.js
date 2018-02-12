/**
 * @flow
 */
const fs = require('fs');
const fetch = require('node-fetch');
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

type FetchType = (url: string | Request, init?: RequestInit) => Promise<Response>;

class RemoteFileReader extends AbstractFileReader {
  url: string;
  myFetch: FetchType;

  // Enable fetch to be replaced to facilitate unit testing
  constructor(url: string, myFetch?: FetchType) {
    super();
    this.url = url;
    this.myFetch = myFetch || fetch;
  }

  bytes(start: number = 0, length?: number): Promise<ArrayBuffer> {
    const options = {
      method: 'GET',
    };

    if (start !== 0 || length !== undefined) {
      // Requesting only a portion of the file
      options.headers = {
        Range: (length !== undefined) ? `bytes=${start}-${start + (length - 1)}` : `bytes=${start}-`,
      };
    }

    return this.myFetch(this.url, options).then((response) => {
      if (response.ok) {
        return response.arrayBuffer();
      }
      throw new Error('Bad response from server');
    });
  }
}

module.exports = {
  LocalFileReader,
  RemoteFileReader,
};
