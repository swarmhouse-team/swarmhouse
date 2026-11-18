export type ErrorDetails = Readonly<Record<string, string | number | boolean | null>>;

export abstract class ApplicationError extends Error {
  readonly code: string;
  readonly details?: ErrorDetails;

  protected constructor(code: string, message: string, details?: ErrorDetails, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = new.target.name;
    this.code = code;
    if (details !== undefined) {
      this.details = Object.freeze({ ...details });
    }
  }
}
