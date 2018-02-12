const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const fetchMock = require('fetch-mock');
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
  it('should read specific bytes', () => {
    const url = '/test-data/single_sample.vcf.gz.tbi.uncompressed';
    const contents = Buffer.from([0x42, 0x49, 0x01, 0x01]);
    const mock = fetchMock.sandbox().get(url, {
      sendAsJson: false,
      body: contents,
    });

    const reader = new RemoteFileReader(url, mock);
    return reader.bytes(1, 4).then((buffer) => {
      expect(mock.called(url, 'GET')).to.equal(true);
      expect(mock.lastOptions(url, 'GET')).to.deep.equal({ method: 'GET', headers: { Range: 'bytes=1-4' } });
      expect(Buffer.compare(Buffer.from(buffer), contents)).to.equal(0);
    });
  });

  it('should read entire file', () => {
    const url = '/test-data/single_sample.vcf.gz.tbi.uncompressed';
    const contents = fs.readFileSync('./test-data/single_sample.vcf.gz.tbi.uncompressed');
    const mock = fetchMock.sandbox().get(url, {
      sendAsJson: false,
      body: contents,
    });

    const reader = new RemoteFileReader(url, mock);
    return reader.bytes().then((buffer) => {
      expect(mock.called(url, 'GET')).to.equal(true);
      expect(Buffer.compare(Buffer.from(buffer), contents)).to.equal(0);
    });
  });
});
