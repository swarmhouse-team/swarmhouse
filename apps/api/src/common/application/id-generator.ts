/**
 * Supplies ids for new records.
 * `next()` returns a lowercase UUID. The contract does not fix the UUID version.
 * A test stub returns different valid ids when a scenario needs one.
 */
export interface IdGenerator {
  next(): string;
}
