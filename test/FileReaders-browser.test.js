/* global Blob, chai, myseq */
describe('FileReaders', () => {
  const { expect } = chai;
  const { LocalFileReader, RemoteFileReader } = myseq;

  function getTestArray() {
    /* eslint-disable max-len */
    // Contents of: './test-data/single_sample.vcf.gz.tbi.uncompressed'
    return new Uint8Array([
      0x54, 0x42, 0x49, 0x01, 0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00,
      0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x23, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x05, 0x00, 0x00, 0x00, 0x63, 0x68, 0x72, 0x31, 0x00, 0x01, 0x00, 0x00, 0x00, 0x49, 0x12, 0x00,
      0x00, 0x01, 0x00, 0x00, 0x00, 0xd8, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x4b,
      0x01, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0xd8, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00,
    ]);
    /* eslint-enable max-len */
  }

  function getTestBlob() {
    return new Blob([getTestArray()], { type: 'application/octet-binary' });
  }

  describe('LocalFileReader', () => {
    it('should read specific bytes', () => {
      // Use Blob, the parent type of File for testing
      const reader = new LocalFileReader(getTestBlob());
      return reader.bytes(1, 4).then((buffer) => {
        const magic = new Uint8Array([0x42, 0x49, 0x01, 0x01]);
        expect(buffer).to.eql(magic.buffer);
      });
    });

    it('should read entire file', () => {
      // Use Blob, the parent type of File for testing
      const blob = getTestBlob();
      const reader = new LocalFileReader(blob);
      return reader.bytes().then((buffer) => {
        expect(buffer).to.eql(getTestArray().buffer);
      });
    });
  });

  describe('RemoteFileReader', () => {
    function getRemoteFileReader(url = 'http://localhost:9876/base/test-data/single_sample.vcf.gz.tbi.uncompressed') {
      return new RemoteFileReader(url);
    }

    it('should read specific bytes', () => {
      const reader = getRemoteFileReader();
      return reader.bytes(1, 4).then((buffer) => {
        const magic = new Uint8Array([0x42, 0x49, 0x01, 0x01]);
        expect(buffer).to.eql(magic.buffer);
      });
    });

    it('should read entire file', () => {
      const reader = getRemoteFileReader();
      return reader.bytes().then((buffer) => {
        expect(buffer).to.eql(getTestArray().buffer);
      });
    });
  });
});
