/* eslint-disable no-underscore-dangle */
const { expect } = require('chai');
const Ref = require('../features/ReferenceGenome');

describe('ReferenceGenome', () => {
  it('should normalize contig names', () => {
    expect(Ref.hg19Reference.normalizeContig('chr1')).to.equal('chr1');
    expect(Ref.hg19Reference.normalizeContig('1')).to.equal('chr1');
    expect(() => { Ref.hg19Reference.normalizeContig('junk'); }).to.throw();
  });

  it('should map reference files to reference genomes', () => {
    expect(Ref.referenceFromFile('human_g1k_v37.fasta')).to.equal(Ref.b37Reference);
    expect(Ref.referenceFromFile('file:/humgen/gsa-hpprojects/GATK/bundle/5974/b37/human_g1k_v37.fasta'))
      .to.equal(Ref.b37Reference);
  });

  it('hg19 should have unique order number for each contig', () => {
    const order = Object.values(Ref.hg19Reference._seqDict).map(contig => contig.order);
    const uniqueOrder = new Set(order);
    expect(uniqueOrder.size).to.equal(order.length);
  });

  it('b37 should have unique order number for each contig', () => {
    const order = Object.values(Ref.b37Reference._seqDict).map(contig => contig.order);
    const uniqueOrder = new Set(order);
    expect(uniqueOrder.size).to.equal(order.length);
  });

  it('should sort in reference order', () => {
    expect(Ref.hg19Reference.compareContig('chr2', 'chr10')).to.be.below(0);
    expect(Ref.hg19Reference.compareContig('chr10', 'chr10')).to.equal(0);
    expect(Ref.hg19Reference.compareContig('chr11', 'chr3')).to.be.above(0);
    expect(Ref.b37Reference.compareContig('2', '10')).to.be.below(0);
    expect(Ref.b37Reference.compareContig('10', '10')).to.equal(0);
    expect(Ref.b37Reference.compareContig('11', '3')).to.be.above(0);
  });
});
