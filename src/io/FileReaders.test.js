const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const nock = require('nock');
const fs = require('fs');
const { LocalFileReader, RemoteFileReader } = require('./FileReaders');

chai.use(chaiAsPromised);
const { expect } = chai;

describe('LocalFileReader', () => {
  it('should read specific bytes', () => {
    const reader = new LocalFileReader('./test-data/single_sample.vcf.gz.tbi.uncompressed');
    return reader.bytes(1, 4).then((buffer) => {
      const magic = Buffer.from([0x42, 0x49, 0x01, 0x01]);
      expect(Buffer.compare(Buffer.from(buffer), magic)).to.equal(0);
    });
  });

  it('should read entire file', () => {
    const testFile = './test-data/single_sample.vcf.gz.tbi.uncompressed';
    const reader = new LocalFileReader(testFile);
    return reader.bytes().then((buffer) => {
      const contents = fs.readFileSync(testFile); // returns Buffer
      expect(Buffer.compare(Buffer.from(buffer), contents)).to.equal(0);
    });
  });
});


describe('RemoteFileReader', () => {
  beforeEach(() => {
    nock.cleanAll();
  });

  it('should read specific bytes', () => {
    const url = 'http://example.com/single_sample.vcf.gz.tbi.uncompressed';
    const contents = Buffer.from([0x42, 0x49, 0x01, 0x01]);
    const index = nock('http://example.com', {
      reqheaders: { range: 'bytes=1-4' },
    })
      .get('/single_sample.vcf.gz.tbi.uncompressed')
      .reply(200, contents);

    const reader = new RemoteFileReader(url);
    return reader.bytes(1, 4).then((buffer) => {
      expect(Buffer.compare(Buffer.from(buffer), contents)).to.equal(0);
      index.done();
    });
  });

  it('should read specific bytes from start to end of file', () => {
    const url = 'http://example.com/single_sample.vcf.gz.tbi.uncompressed';
    const contents = fs.readFileSync('./test-data/single_sample.vcf.gz.tbi.uncompressed').slice(1);
    const index = nock('http://example.com', {
      reqheaders: { range: 'bytes=1-' },
    })
      .get('/single_sample.vcf.gz.tbi.uncompressed')
      .reply(200, contents);

    const reader = new RemoteFileReader(url);
    return reader.bytes(1).then((buffer) => {
      expect(Buffer.compare(Buffer.from(buffer), contents)).to.equal(0);
      index.done();
    });
  });

  it('should read entire file', () => {
    const url = 'http://example.com/single_sample.vcf.gz.tbi.uncompressed';
    const file = './test-data/single_sample.vcf.gz.tbi.uncompressed';
    const contents = fs.readFileSync(file);
    const index = nock('http://example.com')
      .get('/single_sample.vcf.gz.tbi.uncompressed')
      .replyWithFile(200, file);

    const reader = new RemoteFileReader(url);
    return reader.bytes().then((buffer) => {
      expect(Buffer.compare(Buffer.from(buffer), contents)).to.equal(0);
      index.done();
    });
  });
});
