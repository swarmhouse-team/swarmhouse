/**
 * Current calendar time for application use cases.
 * `now` returns the current instant as a new `Date` on every call.
 * Application code reads time from `Clock` and passes that value into a domain
 * operation only when the operation's contract accepts it.
 * `Clock` does not own simulation time, steps, or speed.
 */
export interface Clock {
  now(): Date;
}
