import type { DomainErrorCode } from './domain-error-code';

export type { DomainErrorCode } from './domain-error-code';

export type ErrorDetails = Readonly<Record<string, string | number | boolean | null>>;

export abstract class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details?: ErrorDetails;

  protected constructor(code: DomainErrorCode, message: string, details?: ErrorDetails) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    if (details !== undefined) {
      this.details = Object.freeze({ ...details });
    }
  }
}
