/**
 * @flow
 */
/* eslint-disable no-underscore-dangle */
const { LocalFileReader } = require('./FileReaders');
const TabixIndexedFile = require('./TabixIndexedFile');

describe('TabixIndexedFile', () => {
  function getTestFile(
    vcfPath: string = './test-data/single_sample.vcf.gz',
    idxPath: string = `${vcfPath}.tbi`,
  ) {
    return new TabixIndexedFile(new LocalFileReader(vcfPath), new LocalFileReader(idxPath));
  }

  it('should load tabix index', () => {
    const indexedFile = getTestFile();
    expect(indexedFile).not.toBeNull();
    return indexedFile._contigs.then((contigs) => {
      expect(contigs.size).toBe(1);
    });
  });


  it('should reject on invalid index file', () => {
    const indexedFile = getTestFile(
      './test-data/single_sample.vcf.gz',
      './test-data/single_sample.vcf.gz',
    );
    return expect(indexedFile._contigs).rejects.toThrow();
  });

  it('should return requested records', () => {
    const indexedFile = getTestFile();
    return indexedFile.records('chr1', 1, 200).then((records) => {
      expect(records).toEqual(['chr1\t100\trs1\tA\tT\t100.0\tPASS\tAC=1;AN=2\tGT\t0/1']);
    });
  });

  it('should return zero length array for empty region', () => {
    const indexedFile = getTestFile();
    return indexedFile.records('chr1', 102, 102).then((records) => {
      expect(records).toHaveLength(0);
    });
  });

  // TODO: Test filtering on structural variants

  it('should return header lines', () => {
    const indexedFile = getTestFile();
    return indexedFile.header().then((header) => {
      expect(header).toHaveLength(7);
    });
  });
});
