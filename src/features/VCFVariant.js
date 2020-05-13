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

  id: ?Array<string>;

  filter: ?Array<string>;

  _genotypes: Map<string, string>;

  constructor(line: string, samples: Array<string> = [], isSynth: boolean = false) {
    this._line = line;
    this.isSynth = isSynth;

    const fields = this._line.split('\t', samples.length > 0 ? samples.length + 9 : 8);
    this.contig = fields[0]; // eslint-disable-line prefer-destructuring
    this.position = parseInt(fields[1], 10);
    const id = fields[2];
    this.id = (id === '.') ? undefined : id.split(';');
    this.ref = fields[3].toUpperCase(); // eslint-disable-line prefer-destructuring
    this.alt = fields[4].split(',').map((allele) => (/^[ACGTN]+$/i.test(allele) ? allele.toUpperCase() : allele));

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
        .sort() // Reference allele should be first
        .map((allele) => {
          if (allele === '.') {
            return '.';
          } if (allele === '0') {
            return this.ref;
          }
          return this.alt[parseInt(allele, 10) - 1];
        })
        .join('/');
      this._genotypes.set(samples[s], stringGT);
    }
  }

  toString(): string {
    return `${this.contig}:g.${this.position}${this.ref}>${this.alt.join(',')}`;
  }

  isBiAllelic(): boolean {
    return this.alt.length === 1;
  }

  isPASS(): boolean { return this.filter ? this.filter.length === 1 && this.filter[0] === 'PASS' : false; }

  isFILTER(): boolean { return this.filter ? this.filter.length >= 1 && this.filter[0] !== 'PASS' : false; }

  /**
   * If no sample is specified, return the 1st genotype
   */
  genotype(sample: string): string | void {
    return sample === undefined
      ? this._genotypes.values().next().value
      : this._genotypes.get(sample);
  }
}

module.exports = VCFVariant;
