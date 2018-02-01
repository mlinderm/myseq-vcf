const Ref = require('../features/ReferenceGenome');

describe('ReferenceGenome', () => {
  it('should normalize contig names', () => {
    expect(Ref.hg19Reference.normalizeContig('chr1')).toBe('chr1');
    expect(Ref.hg19Reference.normalizeContig('1')).toBe('chr1');
    expect(() => { Ref.hg19Reference.normalizeContig('junk'); }).toThrow();
  });

  it('should map reference files to reference genomes', () => {
    expect(Ref.referenceFromFile('human_g1k_v37.fasta')).toBe(Ref.b37Reference);
    expect(Ref.referenceFromFile('file:/humgen/gsa-hpprojects/GATK/bundle/5974/b37/human_g1k_v37.fasta'))
      .toBe(Ref.b37Reference);
  });
});
