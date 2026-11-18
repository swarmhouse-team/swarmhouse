import {
  DomainError as CommonDomainError,
  type ErrorDetails,
} from '../../../../common/domain/domain.error';
import type { WarehouseDomainErrorCode } from './warehouse-domain-error-code';

/** Warehouse domain error. The code set stays in this module. */
export abstract class WarehouseDomainError extends CommonDomainError {
  declare readonly code: WarehouseDomainErrorCode;

  protected constructor(code: WarehouseDomainErrorCode, message: string, details?: ErrorDetails) {
    super(code, message, details);
  }
}
