/* global Blob, chai, myseq, window, sinon */
/* eslint-disable no-underscore-dangle, no-unused-expressions, arrow-body-style */
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

    describe('retry on error', () => {
      let _fetch;
      let fetchStub;
      beforeEach(() => {
        _fetch = window.fetch;
        fetchStub = sinon.stub(window, 'fetch');
      });

      afterEach(() => {
        window.fetch.restore();
      });

      it('should retry once on fetch exception', () => {
        fetchStub.onCall(0).rejects('TypeError');
        fetchStub.onCall(1).returns(_fetch('http://localhost:9876/base/test-data/single_sample.vcf.gz.tbi.uncompressed'));

        const reader = getRemoteFileReader('http://localhost');
        return reader.bytes().then((buffer) => {
          expect(fetchStub.calledTwice).to.be.true;
          expect(fetchStub.secondCall.lastArg).to.have.property('cache', 'reload');
          expect(buffer).to.eql(getTestArray().buffer);
        });
      });

      it('should not retry on HTTP error', () => {
        fetchStub.onCall(0).resolves(new window.Response('', { status: 404 }));
        fetchStub.onCall(1).resolves(new window.Response('', { status: 404 }));

        const reader = getRemoteFileReader('http://localhost');
        return reader.bytes().catch((error) => {
          expect(fetchStub.calledOnce).to.be.true;
          expect(error).to.be.an('error');
        });
      });

      it('should retry only once on error', () => {
        fetchStub.onCall(0).rejects('TypeError');
        fetchStub.onCall(1).rejects('TypeError');
        fetchStub.onCall(2).returns(_fetch('http://localhost:9876/base/test-data/single_sample.vcf.gz.tbi.uncompressed'));

        const reader = getRemoteFileReader('http://localhost');
        return reader.bytes().catch((error) => {
          expect(fetchStub.calledTwice).to.be.true;
          expect(error).to.be.an('error');
        });
      });
    });

    // TypeError: Failed to fetch
  });
});
