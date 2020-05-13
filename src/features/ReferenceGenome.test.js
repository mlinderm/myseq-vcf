/* eslint-disable no-underscore-dangle, no-unused-expressions */
const { expect } = require('chai');
const Ref = require('./ReferenceGenome');

describe('ReferenceGenome', () => {
  it('should normalize contig names', () => {
    expect(Ref.hg19Reference.normalizeContig('chr1')).to.equal('chr1');
    expect(Ref.hg19Reference.normalizeContig('1')).to.equal('chr1');
    expect(() => { Ref.hg19Reference.normalizeContig('junk'); }).to.throw();
    expect(Ref.hg38Reference.normalizeContig('7')).to.equal('chr7');
    expect(Ref.hg38Reference.normalizeContig('chr7')).to.equal('chr7');
  });

  it('should map reference files to reference genomes', () => {
    expect(Ref.referenceFromFile('human_g1k_v37.fasta')).to.equal(Ref.b37Reference);
    expect(Ref.referenceFromFile('GRCh37.fa')).to.equal(Ref.b37Reference);
    expect(Ref.referenceFromFile('file:/humgen/gsa-hpprojects/GATK/bundle/5974/b37/human_g1k_v37.fasta'))
      .to.equal(Ref.b37Reference);
    expect(Ref.referenceFromFile('hg19.fa')).to.equal(Ref.hg19Reference);
    expect(Ref.referenceFromFile('ucsc.hg19.fasta')).to.equal(Ref.hg19Reference);
    expect(Ref.referenceFromFile('ftp://ftp.1000genomes.ebi.ac.uk//vol1/ftp/technical/reference/phase2_reference_assembly_sequence/hs37d5.fa.gz')).to.equal(Ref.b37Reference);
  });

  it('should not return a reference genome if contigs are ambiguous', () => {
    expect(Ref.referenceFromContigs(['chr1'])).to.be.undefined;
  });

  it('hg19 should have unique order number for each contig', () => {
    const order = Object.values(Ref.hg19Reference._seqDict).map((contig) => contig.order);
    const uniqueOrder = new Set(order);
    expect(uniqueOrder.size).to.equal(order.length);
  });

  it('b37 should have unique order number for each contig', () => {
    const order = Object.values(Ref.b37Reference._seqDict).map((contig) => contig.order);
    const uniqueOrder = new Set(order);
    expect(uniqueOrder.size).to.equal(order.length);
  });

  it('hg38 should have unique order number for each contig', () => {
    const order = Object.values(Ref.hg38Reference._seqDict).map((contig) => contig.order);
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
