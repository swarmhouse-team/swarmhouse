import {
  ApplicationError as CommonApplicationError,
  type ApplicationErrorPresentation,
  type ErrorDetails,
} from '../../../../common/application/application.error';
import type { ApplicationErrorCode } from './application-error-code';

/** Warehouse application error. The code set stays in this module. */
export abstract class ApplicationError extends CommonApplicationError {
  declare readonly code: ApplicationErrorCode;

  protected constructor(
    code: ApplicationErrorCode,
    message: string,
    details?: ErrorDetails,
    cause?: unknown,
    presentation?: ApplicationErrorPresentation,
  ) {
    super(code, message, details, cause, presentation);
  }
}
