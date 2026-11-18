import type { LogContext, LoggerPort } from '../../../../common/application/logger.port';

export type LogEntry = {
  level: 'debug' | 'info' | 'warn' | 'error';
  event: string;
  context?: LogContext;
};

/** Test-only double: each call returns a fresh logger and its own logs array. */
export function createRecordingLogger(): { logger: LoggerPort; logs: LogEntry[] } {
  const logs: LogEntry[] = [];
  const logger: LoggerPort = {
    debug: (event, context) => {
      logs.push({ level: 'debug', event, context });
    },
    info: (event, context) => {
      logs.push({ level: 'info', event, context });
    },
    warn: (event, context) => {
      logs.push({ level: 'warn', event, context });
    },
    error: (event, context) => {
      logs.push({ level: 'error', event, context });
    },
  };
  return { logger, logs };
}
