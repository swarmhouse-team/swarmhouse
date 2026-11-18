import type { LoggerPort } from './logger.port';

type AfterCommitSteps = {
  publish: () => Promise<void>;
  publishFailed: string;
} & (
  | { invalidate?: undefined; invalidateFailed?: undefined }
  | { invalidate: () => Promise<void>; invalidateFailed: string }
);

/**
 * Runs cache invalidation and a realtime publish as two independent steps after commit.
 * A failure of one does not skip the other and does not change the command result.
 * Only an exception that actually leaves a step is logged here.
 * An adapter that already handled and swallowed its own failure is not logged again.
 * Event names are chosen by the caller.
 */
export async function publishAfterCommit(
  logger: LoggerPort,
  steps: AfterCommitSteps,
): Promise<void> {
  if (steps.invalidate) {
    try {
      await steps.invalidate();
    } catch (error) {
      logger.error(steps.invalidateFailed, { errorClass: errorClass(error) });
    }
  }

  try {
    await steps.publish();
  } catch (error) {
    logger.error(steps.publishFailed, { errorClass: errorClass(error) });
  }
}

function errorClass(error: unknown): string {
  return error instanceof Error && error.name.length > 0 ? error.name : 'UnknownError';
}
