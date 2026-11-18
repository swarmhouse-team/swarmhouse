import { MAX_NAME_LENGTH } from '../constants';
import { InvalidNameError } from '../errors/value.errors';

export class WarehouseName {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
    Object.freeze(this);
  }

  static create(raw: string): WarehouseName {
    const value = raw.trim();
    if (value.length === 0 || value.length > MAX_NAME_LENGTH) {
      throw new InvalidNameError(raw);
    }

    return new WarehouseName(value);
  }
}
