/**
 * Structured fields for an application log event.
 * Omit absent keys; do not pass undefined or null values.
 */
export type LogContext = Readonly<Record<string, string | number | boolean>>;

/**
 * Application logging port. `event` is a stable event name.
 *
 * Adapter requirement: a failure while writing a log must not throw to the
 * caller and must not change use case outcomes. Application code does not
 * wrap logger calls in try/catch.
 */
export interface LoggerPort {
  debug(event: string, context?: LogContext): void;
  info(event: string, context?: LogContext): void;
  warn(event: string, context?: LogContext): void;
  error(event: string, context?: LogContext): void;
}
