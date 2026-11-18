import {
  ApplicationError as CommonApplicationError,
  type ApplicationErrorPresentation,
  type ErrorDetails,
} from '../../../../common/application/application.error';
import type { WarehouseApplicationErrorCode } from './warehouse-application-error-code';

/** Warehouse application error. The code set stays in this module. */
export abstract class WarehouseApplicationError extends CommonApplicationError {
  declare readonly code: WarehouseApplicationErrorCode;

  protected constructor(
    code: WarehouseApplicationErrorCode,
    message: string,
    details?: ErrorDetails,
    cause?: unknown,
    presentation?: ApplicationErrorPresentation,
  ) {
    super(code, message, details, cause, presentation);
  }
}
