import { DomainError } from './domain.error';

/** A coordinate is not a non-negative safe integer. */
export class InvalidPositionError extends DomainError {
  constructor(
    readonly x: number,
    readonly y: number,
  ) {
    super('INVALID_POSITION', 'Invalid position', { x, y });
  }
}

/** Width or height is not a positive safe integer. */
export class InvalidGridSizeError extends DomainError {
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    super('INVALID_GRID_SIZE', 'Invalid grid size', { width, height });
  }
}
