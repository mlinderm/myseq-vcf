const { LocalFileReader, RemoteFileReader } = require('./io/FileReaders');
const TabixIndexedFile = require('./io/TabixIndexedFile');
const VCFSource = require('./io/VCFSource');
const VCFVariant = require('./features/VCFVariant');
const Ref = require('./features/ReferenceGenome');

const myseq = {
  LocalFileReader,
  RemoteFileReader,
  TabixIndexedFile,
  VCFSource,
  VCFVariant,
  Ref,
};

module.exports = myseq;
