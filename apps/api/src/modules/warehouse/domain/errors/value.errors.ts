import { InvalidGridSizeError, InvalidPositionError } from '../../../../common/domain/grid-errors';
import { DomainError } from './domain.error';

/** ID is not a UUID in 8-4-4-4-12 form, or it is the nil or max UUID. */
export class InvalidIdError extends DomainError {
  constructor(readonly value: string) {
    super('INVALID_ID', 'Invalid id', { value });
  }
}

export { InvalidGridSizeError, InvalidPositionError };

/** Name is empty after trim or longer than allowed. */
export class InvalidNameError extends DomainError {
  constructor(readonly value: string) {
    super('INVALID_NAME', 'Invalid name', { value });
  }
}
