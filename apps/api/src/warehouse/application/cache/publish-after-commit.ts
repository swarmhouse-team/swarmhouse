/**
 * Runs cache invalidation and a realtime publish as two independent steps after commit.
 * A failure of one does not skip the other. The invalidation error is rethrown afterwards
 * so a non-cache failure still fails the command. The notifier adapter must not throw.
 */
export async function publishAfterCommit(steps: {
  invalidate?: () => Promise<void>;
  publish: () => Promise<void>;
}): Promise<void> {
  let invalidateError: unknown;
  if (steps.invalidate) {
    try {
      await steps.invalidate();
    } catch (error) {
      invalidateError = error;
    }
  }

  await steps.publish();

  if (invalidateError) {
    throw invalidateError;
  }
}
