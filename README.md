[![Build Status](https://travis-ci.org/mlinderm/myseq-vcf.svg?branch=master)](https://travis-ci.org/mlinderm/myseq-vcf)

# MySeq-VCF

myseq-vcf is a browser and node-compatible library for querying [Tabix-indexed](http://www.htslib.org/doc/tabix.html) [VCF](https://samtools.github.io/hts-specs/) files by genomic coordinates. Both local and remote files are supported. Queries will only request the necessary blocks of the bgzip-compressed VCF file, enabling efficient targeted analysis of whole-genome-scale VCF files.

myseq-vcf was developed to support [MySeq](https://github.com/mlinderm/myseq), a web-based personal genome analysis tool designed for educational use. MySeq is described in:

Linderman MD, McElroy L, Chang L. [MySeq: privacy-protecting browser-based personal Genome analysis for genomics education and exploration](https://bmcmedgenomics.biomedcentral.com/articles/10.1186/s12920-019-0615-3). BMC Med Genomics. 2019 Nov 27;12(1):172.

## Usage

The primary entry point is the `VCFSource` class, which expects a `TabixIndexedFile` as an argument along with an optional `ReferenceGenome` object. If a specific reference is not provided, `VCFSource` will attempt to infer the reference from the "##reference" field in the VCF header or the "##contig" entries in the header. The `TabixIndexedFile` class expects file readers for the source and index files. Both a `LocalFileReader` and `RemoteFileReader` are provided.

For example:
```javascript
let source = new VCFSource(
  new TabixIndexedFile(
    new RemoteFileReader('http://path/to/vcf.gz'),
    new RemoteFileReader('http://path/to/vcf.gz.tbi'),
  ),
);
source.variants('chr1', 1, 200).then((variants) => {
  variants.forEach(variant => console.log(variant.toString()));
});
```

`VCFSource` provides query methods for all variants overlapping a region and for specific variant (position and alleles). That latter supports synthesizing variants with REF/REF genotypes. See the inline documentation for more detail.

## Acknowledgements

myseq-vCF incorporates code adapted from [JS-Binary-VCF-Tabix](https://github.com/jsa-aerial/JS-Binary-VCF-Tabix) and [pileup.js](https://github.com/hammerlab/pileup.js).
