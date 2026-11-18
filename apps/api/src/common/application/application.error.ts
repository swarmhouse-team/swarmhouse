export type ErrorDetails = Readonly<Record<string, string | number | boolean | null>>;

/**
 * What a client may see. Without `clientStatus` the mapper returns a generic 500
 * and keeps `message` and `details` off the response.
 * `logFields` is the only part of an unexposed error that may be logged.
 */
export type ApplicationErrorPresentation = {
  readonly clientStatus?: number;
  readonly clientMessage?: string;
  readonly logFields?: ErrorDetails;
};

export abstract class ApplicationError extends Error {
  readonly code: string;
  readonly details?: ErrorDetails;
  readonly clientStatus?: number;
  readonly clientMessage?: string;
  readonly logFields?: ErrorDetails;

  protected constructor(
    code: string,
    message: string,
    details?: ErrorDetails,
    cause?: unknown,
    presentation?: ApplicationErrorPresentation,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = new.target.name;
    this.code = code;
    if (details !== undefined) {
      this.details = Object.freeze({ ...details });
    }
    if (presentation?.clientStatus !== undefined) {
      this.clientStatus = presentation.clientStatus;
    }
    if (presentation?.clientMessage !== undefined) {
      this.clientMessage = presentation.clientMessage;
    }
    if (presentation?.logFields !== undefined) {
      this.logFields = Object.freeze({ ...presentation.logFields });
    }
  }
}
