/* global chai, myseq */
describe('TabixIndexedFile', () => {
  const { expect } = chai;
  const { RemoteFileReader, TabixIndexedFile } = myseq;

  function getTestFile(
    source = 'http://localhost:9876/base/test-data/single_sample.vcf.gz',
    index = 'http://localhost:9876/base/test-data/single_sample.vcf.gz.tbi',
  ) {
    return new TabixIndexedFile(
      new RemoteFileReader(source),
      new RemoteFileReader(index),
    );
  }

  it('should load tabix index', () => {
    const indexedFile = getTestFile();
    expect(indexedFile).to.exist; // eslint-disable-line no-unused-expressions
    return indexedFile._contigs.then((contigs) => { // eslint-disable-line no-underscore-dangle
      expect(contigs.size).to.equal(1);
    });
  });

  it('should return requested records', () => {
    const indexedFile = getTestFile();
    return indexedFile.records('chr1', 1, 200).then((records) => {
      expect(records).to.eql(['chr1\t100\trs1\tA\tT\t100.0\tPASS\tAC=1;AN=2\tGT\t0/1']);
    });
  });

  it('should return zero length array for empty region', () => {
    const indexedFile = getTestFile();
    return indexedFile.records('chr1', 102, 102).then((records) => {
      expect(records).to.have.lengthOf(0);
    });
  });
});
