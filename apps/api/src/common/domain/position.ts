import { InvalidPositionError } from '../../modules/warehouse/domain/errors/value.errors';

/** A grid cell. It does not know the size of a particular map. */
export class Position {
  readonly x: number;
  readonly y: number;

  private constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    Object.freeze(this);
  }

  static create(x: number, y: number): Position {
    if (!isNonNegativeSafeInteger(x) || !isNonNegativeSafeInteger(y)) {
      throw new InvalidPositionError(x, y);
    }

    return new Position(x, y);
  }

  equals(other: Position): boolean {
    return this.x === other.x && this.y === other.y;
  }
}

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
