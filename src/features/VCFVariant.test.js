/**
 * @flow
 */
/* eslint-disable no-underscore-dangle, no-unused-expressions */
const chai = require('chai');
const VCFVariant = require('./VCFVariant');

const { expect } = chai;

describe('VCFVariant', () => {
  describe('Parsing', () => {
    it('should upper case actuall alleles (not symbolic alleles)', () => {
      let variant = new VCFVariant('chr1\t100\t.\ta\tT\t.\t.\t.');
      expect(variant.ref).to.equal('A');

      variant = new VCFVariant('chr1\t100\t.\tA\tT\t.\t.\t.');
      expect(variant.ref).to.equal('A');

      variant = new VCFVariant('chr1\t100\t.\tA\tt\t.\t.\t.');
      expect(variant.alt).to.deep.equal(['T']);

      variant = new VCFVariant('chr1\t100\t.\tA\t<del>\t.\t.\t.');
      expect(variant.alt).to.deep.equal(['<del>']);
    });
  });

  describe('ID field', () => {
    it('should report undefined', () => {
      const variant = new VCFVariant('chr1\t100\t.\tA\tT\t.\t.\t.');
      expect(variant.id).to.be.undefined;
    });

    it('should be an array', () => {
      const variant = new VCFVariant('chr1\t100\trs1\tA\tT\t.\t.\t.');
      expect(variant.id).to.deep.equal(['rs1']);
    });
  });

  describe('FILTER field', () => {
    it('should report PASSing', () => {
      const variant = new VCFVariant('chr1\t100\trs1\tA\tT\t.\tPASS\t.');
      expect(variant.isPASS()).to.be.true;
      expect(variant.isFILTER()).to.be.false;
    });

    it('should report undefined', () => {
      const variant = new VCFVariant('chr1\t100\trs1\tA\tT\t.\t.\t.');
      expect(variant.filter).to.be.undefined;
      expect(variant.isPASS()).to.be.false;
      expect(variant.isFILTER()).to.be.false;
    });

    it('should report filtered', () => {
      const variant = new VCFVariant('chr1\t100\trs1\tA\tT\t.\tgc\t.');
      expect(variant.isFILTER()).to.be.true;
      expect(variant.isPASS()).to.be.false;
    });
  });

  describe('Genotypes', () => {
    it('should sort alleles with reference first', () => {
      let variant = new VCFVariant('chr1\t100\trs1\tA\tT,C\t.\tPASS\t.\tGT\t1/0', ['NA12878']);
      expect(variant.genotype('NA12878')).to.equal('A/T');

      variant = new VCFVariant('chr1\t100\trs1\tA\tT,C\t.\tPASS\t.\tGT\t0/1', ['NA12878']);
      expect(variant.genotype('NA12878')).to.equal('A/T');
    });
  });
});
