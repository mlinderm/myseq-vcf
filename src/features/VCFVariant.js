/**
 * @flow
 */
class VCFVariant {
  _line: string;

  isSynth: boolean;

  contig: string;
  position: number;
  ref: string;
  alt: Array<string>;

  ids: Array<string>;

  _genotypes: Map<string, string>;

  constructor(line: string, samples: Array<string> = [], isSynth: boolean = false) {
    this._line = line;
    this.isSynth = isSynth;

    const fields = this._line.split('\t', samples.length > 0 ? samples.length + 9 : 8);
    this.contig = fields[0]; // eslint-disable-line prefer-destructuring
    this.position = parseInt(fields[1], 10);
    const id = fields[2];
    this.ids = (id === '.') ? undefined : id.split(';');
    this.ref = fields[3]; // eslint-disable-line prefer-destructuring
    this.alt = fields[4].split(',');

    const filter = fields[6];
    this.filter = (filter === '.' || filter === '') ? undefined : filter.split(';');

    // Parse genotypes
    this._genotypes = new Map();
    for (let s = 0; s < samples.length; s += 1) {
      // GT must be the first field for each sample
      const endOfGT = fields[s + 9].indexOf(':');
      const GT = endOfGT === -1 ? fields[s + 9] : fields[s + 9].substring(0, endOfGT);

      // Translate alleles, while ignoring the distinction bewteen '/' and '|'
      const stringGT = GT
        .split(/[/|]/)
        .map((allele) => {
          if (allele === '.') {
            return '.';
          } else if (allele === '0') {
            return this.ref;
          }
          return this.alt[parseInt(allele, 10) - 1];
        })
        .join('/');
      this._genotypes.set(samples[s], stringGT);
    }
  }

  toString(): string {
    return `${this.contig}:${this.position}${this.ref}>${this.alt.join(',')}`;
  }

  toHgvs(): string {
    if (this.alt.length > 1) {
      throw new Error('HGVS only supported for bi-allelic variants');
    }
    // TODO: Handle other variant types
    return `${this.contig}:g.${this.position}${this.ref}>${this.alt[0]}`;
  }

  isPASS() { return this.filter ? this.filter.length === 1 && this.filter[0] === 'PASS' : false; }
  isFILTER() { return this.filter ? this.filter.length >= 1 && this.filter[0] !== 'PASS' : false; }

  /**
   * If no sample is specified, return the 1st genotype
   */
  genotype(sample: string): string | void {
    return sample === undefined ?
      this._genotypes.values().next().value :
      this._genotypes.get(sample);
  }
}

module.exports = VCFVariant;
