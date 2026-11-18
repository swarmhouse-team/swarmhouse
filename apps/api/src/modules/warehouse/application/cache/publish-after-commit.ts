import type { LoggerPort } from '../ports/system/logger.port';

/**
 * Runs cache invalidation and a realtime publish as two independent steps after commit.
 * A failure of one does not skip the other and does not change the command result.
 * Only an exception that actually leaves a step is logged here.
 * An adapter that already handled and swallowed its own failure is not logged again.
 */
export async function publishAfterCommit(
  logger: LoggerPort,
  steps: {
    invalidate?: () => Promise<void>;
    publish: () => Promise<void>;
  },
): Promise<void> {
  if (steps.invalidate) {
    try {
      await steps.invalidate();
    } catch (error) {
      logger.error('warehouse.cache.invalidate_failed', { errorClass: errorClass(error) });
    }
  }

  try {
    await steps.publish();
  } catch (error) {
    logger.error('warehouse.realtime.publish_failed', { errorClass: errorClass(error) });
  }
}

function errorClass(error: unknown): string {
  return error instanceof Error && error.name.length > 0 ? error.name : 'UnknownError';
}
