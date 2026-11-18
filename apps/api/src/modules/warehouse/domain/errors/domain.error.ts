import {
  DomainError as CommonDomainError,
  type ErrorDetails,
} from '../../../../common/domain/domain.error';
import type { DomainErrorCode } from './domain-error-code';

/** Warehouse domain error. The code set stays in this module. */
export abstract class DomainError extends CommonDomainError {
  declare readonly code: DomainErrorCode;

  protected constructor(code: DomainErrorCode, message: string, details?: ErrorDetails) {
    super(code, message, details);
  }
}
