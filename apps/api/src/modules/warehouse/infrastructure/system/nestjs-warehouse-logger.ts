import { Logger } from '@nestjs/common';

import type { LogContext, LoggerPort } from '../../application/ports/system/logger.port';

/**
 * NestJS Logger adapter for warehouse application use cases.
 * Logging failures are swallowed so they cannot change a use case result,
 * including after a successful commit. Those failures are not logged again.
 */
export class NestjsWarehouseLogger implements LoggerPort {
  private readonly logger = new Logger('WarehouseApplication');

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
