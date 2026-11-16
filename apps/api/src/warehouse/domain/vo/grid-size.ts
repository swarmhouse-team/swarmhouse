import { InvalidGridSizeError } from '../errors/value.errors';

/** Grid size. Whether a cell belongs to a particular map is checked by that map. */
export class GridSize {
  readonly width: number;
  readonly height: number;

  private constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    Object.freeze(this);
  }

  static create(width: number, height: number): GridSize {
    if (!isPositiveSafeInteger(width) || !isPositiveSafeInteger(height)) {
      throw new InvalidGridSizeError(width, height);
    }

    return new GridSize(width, height);
  }

  contains(x: number, y: number): boolean {
    return (
      Number.isSafeInteger(x) &&
      Number.isSafeInteger(y) &&
      x >= 0 &&
      y >= 0 &&
      x < this.width &&
      y < this.height
    );
  }
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}
