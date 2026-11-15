/**
 * Supplies ids for new warehouses, maps, robots, and stations.
 * `next()` returns a valid UUID in lowercase.
 * The application contract does not fix the UUID version.
 * Uniqueness is additionally protected by storage constraints.
 * A test stub, when a scenario needs one, returns different valid ids.
 */
export interface IdGenerator {
  next(): string;
}
