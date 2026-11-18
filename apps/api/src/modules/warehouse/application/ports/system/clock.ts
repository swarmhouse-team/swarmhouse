/**
 * Current calendar time for application use cases.
 * `now` returns the current instant as a new `Date` on every call.
 * Application code reads time from `Clock` and passes that value into a domain
 * operation only when the operation's contract accepts it.
 * No current use case does. `Clock` does not own simulation time, steps, or speed.
 * `SystemClock` and test stubs are created with the first caller, not here.
 */
export interface Clock {
  now(): Date;
}
