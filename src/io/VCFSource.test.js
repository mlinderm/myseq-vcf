/**
 * @flow
 */
/* eslint-disable no-underscore-dangle */
const { LocalFileReader } = require('./FileReaders');
const TabixIndexedFile = require('./TabixIndexedFile');
const VCFSource = require('./VCFSource');

const Ref = require('../features/ReferenceGenome');

describe('VCFSource', () => {
  function getTestSourceFull(vcfPath: string, reference: Ref.ReferenceGenome) {
    const idxPath = `${vcfPath}.tbi`;
    return new VCFSource(
      new TabixIndexedFile(new LocalFileReader(vcfPath), new LocalFileReader(idxPath)),
      reference,
    );
  }

  function getTestSource(vcfPath: string = './test-data/single_sample.vcf.gz') {
    return getTestSourceFull(vcfPath, Ref.hg19Reference);
  }

  it('should load tabix VCF', () => {
    const source = getTestSource();
    expect(source).not.toBeNull();
  });

  // TODO: Test sites-only VCF

  it('should extract the samples from the header', () => {
    const source = getTestSource();
    return source._samples.then((samples) => {
      expect(samples).toEqual(['NA12878']);
    });
  });

  it('should return requested variants', () => {
    const source = getTestSource();
    return source.variants('chr1', 1, 200).then((variants) => {
      expect(variants).toHaveLength(1);

      const variant = variants[0];
      expect(variant._line).toBe('chr1\t100\trs1\tA\tT\t100.0\tPASS\tAC=1;AN=2\tGT\t0/1');
      expect(variant.isSynth).toBe(false);

      expect(variant.toString()).toBe('chr1:100A>T');

      expect(variant.contig).toBe('chr1');
      expect(variant.position).toBe(100);
      expect(variant.ref).toBe('A');
      expect(variant.alt).toEqual(['T']);
      expect(variant.genotype('NA12878')).toBe('A/T');

      // We can also get the first genotype
      expect(variant.genotype()).toBe('A/T');
    });
  });

  it('should return requested variants with alternative contig name', () => {
    const source = getTestSource();
    return source.variants('1', 1, 200).then((variants) => {
      expect(variants).toHaveLength(1);
    });
  });


  it('should return zero length array for empty region', () => {
    const source = getTestSource();
    return source.variants('chr1', 102, 102).then((variants) => {
      expect(variants).toHaveLength(0);
    });
  });

  it('should return empty query if contig in reference but not index', () => {
    const source = getTestSource();
    return source.variants('7', 141672604, 141672604).then((variants) => {
      expect(variants).toHaveLength(0);
    });
  });

  it('should reject if contig not in reference and index', () => {
    const source = getTestSource();
    return expect(source.variants('junk', 141672604, 141672604)).rejects.toThrow(RangeError);
  });

  it('should return variant with matching alleles', () => {
    const source = getTestSource();
    return source.variant('chr1', 100, 'A', 'T').then((variant) => {
      expect(variant).not.toBeUndefined();
    });
  });

  it('should filter variants with mismatching alleles', () => {
    const source = getTestSource();
    return source.variant('chr1', 100, 'A', 'G').then((variant) => {
      expect(variant).toBeUndefined();
    });
  });

  it('should infer reference genome from reference key in VCF header', () => {
    const source = getTestSourceFull('./test-data/single_sample_with_reference.vcf.gz', undefined);
    return source._reference.then((ref) => {
      expect(ref).toBe(Ref.b37Reference);
    });
  });

  it('should infer reference genome from contigs in VCF header', () => {
    const source = getTestSourceFull('./test-data/single_sample_with_contigs.vcf.gz', undefined);
    return source._reference.then((ref) => {
      expect(ref).toBe(Ref.b37Reference);
    });
  });

  it('should generate REF/REF genotype if requested and variant not found', () => {
    const source = getTestSource();
    return source.variant('chr1', 100, 'A', 'G', true).then((variant) => {
      expect(variant).not.toBeUndefined();
      expect(variant.isSynth).toBe(true);
      expect(variant.toString()).toBe('chr1:100A>G');
      expect(variant.genotype('NA12878')).toBe('A/A');
    });
  });


  it('should return undefined if variant not found even if contig not in index', () => {
    const source = getTestSource();
    return source.variant('7', 141672604, 'T', 'C').then((variant) => {
      expect(variant).toBeUndefined();
    });
  });

  it('should return synthetic variant if contig not in index and ref/ref requested', () => {
    const source = getTestSource();
    return source.variant('7', 141672604, 'T', 'C', true).then((variant) => {
      expect(variant).not.toBeUndefined();
      expect(variant.isSynth).toBe(true);
      expect(variant.toString()).toBe('chr7:141672604T>C');
    });
  });
});
