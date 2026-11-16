import type { ApplicationErrorCode } from './application-error-code';

export type ErrorDetails = Readonly<Record<string, string | number | boolean | null>>;

export abstract class ApplicationError extends Error {
  readonly code: ApplicationErrorCode;
  readonly details?: ErrorDetails;

  protected constructor(
    code: ApplicationErrorCode,
    message: string,
    details?: ErrorDetails,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = new.target.name;
    this.code = code;
    if (details !== undefined) {
      this.details = Object.freeze({ ...details });
    }
  }
}
