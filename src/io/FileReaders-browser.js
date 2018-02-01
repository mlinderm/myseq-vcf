/**
 * @flow
 */
/* global FileReader, fetch */
const AbstractFileReader = require('./AbstractFileReader');

class LocalFileReader extends AbstractFileReader {
  file: File;
  size: number;

  constructor(file: File) {
    super();
    this.file = file;
    this.size = file.size;
  }

  name(): string {
    return this.file.name;
  }

  bytes(start: number = 0, length?: number): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const lengthToRead = (length === undefined) ? this.size - start : length;
      const blob = this.file.slice(start, start + lengthToRead);

      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.onerror = () => {
        reject(reader.error);
      };
      reader.readAsArrayBuffer(blob);
    });
  }
}

class RemoteFileReader extends AbstractFileReader {
  url: string;

  constructor(url: string) {
    super();
    this.url = url;
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

    return fetch(this.url, options).then((response) => {
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
