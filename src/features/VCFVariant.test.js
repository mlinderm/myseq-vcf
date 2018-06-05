/**
 * @flow
 */
/* eslint-disable no-underscore-dangle, no-unused-expressions */
const chai = require('chai');
const VCFVariant = require('./VCFVariant');

const { expect } = chai;

describe('VCFVariant', () => {
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

  describe('HGVS', () => {
    it('should throw an error for multi-allelic variants', () => {
      const variant = new VCFVariant('chr1\t100\trs1\tA\tT,C\t.\tPASS\t.');
      return expect(variant.toHgvs).to.throw();
    });

    it('should render SNVs to HGVS', () => {
      const variant = new VCFVariant('chr1\t100\trs1\tA\tT\t.\tPASS\t.');
      return expect(variant.toHgvs()).to.equal('chr1:g.100A>T');
    });
  });
});
