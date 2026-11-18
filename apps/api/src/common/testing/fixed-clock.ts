import type { Clock } from '../application/clock';

/** Clock that always returns the same instant and counts `now` calls. */
export function fixedClock(instant: Date): { clock: Clock; nowCalls: () => number } {
  let calls = 0;
  return {
    clock: {
      now() {
        calls += 1;
        return instant;
      },
    },
    nowCalls: () => calls,
  };
}
