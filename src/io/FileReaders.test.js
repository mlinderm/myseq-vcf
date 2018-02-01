const fs = require('fs');
const fetch = require('node-fetch');
const { LocalFileReader, RemoteFileReader } = require('./FileReaders');

describe('LocalFileReader', () => {
  it('should read specific bytes', () => {
    const reader = new LocalFileReader('./test-data/single_sample.vcf.gz.tbi.uncompressed');
    return reader.bytes(1, 4).then((buffer) => {
      const magic = Buffer.from([0x42, 0x49, 0x01, 0x01]);
      expect(Buffer.compare(Buffer.from(buffer), magic)).toBe(0);
    });
  });

  it('should read entire file', () => {
    const testFile = './test-data/single_sample.vcf.gz.tbi.uncompressed';
    const reader = new LocalFileReader(testFile);
    return reader.bytes().then((buffer) => {
      const contents = fs.readFileSync(testFile); // returns Buffer
      expect(Buffer.compare(Buffer.from(buffer), contents)).toBe(0);
    });
  });
});


describe('RemoteFileReader', () => {
  beforeEach(() => {
    fetch.resetMocks();
  });

  it('should read specific bytes', () => {
    const magic = Buffer.from([0x42, 0x49, 0x01, 0x01]);
    const mock = fetch.mockResponse(magic);

    const reader = new RemoteFileReader('/test-data/single_sample.vcf.gz.tbi.uncompressed');
    return reader.bytes(1, 4).then((buffer) => {
      expect(mock).toHaveBeenCalledWith(
        '/test-data/single_sample.vcf.gz.tbi.uncompressed',
        { method: 'GET', headers: { Range: 'bytes=1-4' } },
      );
      expect(Buffer.compare(Buffer.from(buffer), magic)).toBe(0);
    });
  });

  it('should read entire file', () => {
    const contents = fs.readFileSync('./test-data/single_sample.vcf.gz.tbi.uncompressed');
    const mock = fetch.mockResponse(contents);

    const reader = new RemoteFileReader('/test-data/single_sample.vcf.gz.tbi.uncompressed');
    return reader.bytes().then((buffer) => {
      // Local file read returns Buffer
      expect(mock).toHaveBeenCalledWith(
        '/test-data/single_sample.vcf.gz.tbi.uncompressed',
        { method: 'GET' },
      );
      expect(Buffer.compare(Buffer.from(buffer), contents)).toBe(0);
    });
  });
});
