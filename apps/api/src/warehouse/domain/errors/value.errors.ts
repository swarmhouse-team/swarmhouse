import { DomainError } from './domain.error';

/** ID is not a UUID in 8-4-4-4-12 form, or it is the nil or max UUID. */
export class InvalidIdError extends DomainError {
  constructor(readonly value: string) {
    super('INVALID_ID', 'Invalid id', { value });
  }
}

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

/** Name is empty after trim or longer than allowed. */
export class InvalidNameError extends DomainError {
  constructor(readonly value: string) {
    super('INVALID_NAME', 'Invalid name', { value });
  }
}
