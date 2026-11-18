import { Logger, type Provider } from '@nestjs/common';

import type { LogContext, LoggerPort } from '../application/logger.port';

/**
 * NestJS Logger adapter.
 * `context` is the Nest logger context for this instance.
 * Logging failures are swallowed so they cannot change a caller result.
 * Those failures are not logged again.
 */
export class NestjsLogger implements LoggerPort {
  private readonly logger: Logger;

  constructor(context: string) {
    this.logger = new Logger(context);
  }

  debug(event: string, context?: LogContext): void {
    this.write('debug', event, context);
  }

  info(event: string, context?: LogContext): void {
    this.write('log', event, context);
  }

  warn(event: string, context?: LogContext): void {
    this.write('warn', event, context);
  }

  error(event: string, context?: LogContext): void {
    this.write('error', event, context);
  }

  private write(
    level: 'debug' | 'log' | 'warn' | 'error',
    event: string,
    context?: LogContext,
  ): void {
    try {
      const payload = context === undefined ? { event } : { event, ...context };
      this.logger[level](payload);
    } catch {
      // Logging must not break the caller.
    }
  }
}

/** One logger provider for a Nest module `providers` array. */
export function provideLogger(context: string): Provider {
  return {
    provide: NestjsLogger,
    useFactory: () => new NestjsLogger(context),
  };
}
