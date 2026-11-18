import type { Clock } from '../../application/ports/system/clock';

/** Wall clock. Each call returns a new `Date`. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
