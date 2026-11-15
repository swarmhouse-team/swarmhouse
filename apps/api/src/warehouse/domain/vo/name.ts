import { InvalidNameError } from '../errors/value.errors';

/** Stage assumption: length is counted after trim and must not exceed 100 characters. */
export const MAX_NAME_LENGTH = 100;

export class Name {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
    Object.freeze(this);
  }

  static create(raw: string): Name {
    const value = raw.trim();
    if (value.length === 0 || value.length > MAX_NAME_LENGTH) {
      throw new InvalidNameError(raw);
    }

    return new Name(value);
  }
}
