/**
 * @flow
 */

/* eslint-disable class-methods-use-this, no-unused-vars */
class AbstractFileReader {
  bytes(start: number = 0, length?: number): Promise<ArrayBuffer> {
    throw new TypeError('Method bytes is not implemented');
  }
}

module.exports = AbstractFileReader;
