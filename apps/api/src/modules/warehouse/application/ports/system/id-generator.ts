/**
 * Supplies ids for new warehouses, maps, robots, and stations.
 * An id names one aggregate instance. A deleted id is not reused:
 * the next warehouse, map, robot, or station gets a new id.
 * Neither `next()` nor a primary key is promised to reject a later insert
 * of an id that was already deleted.
 * `next()` returns a valid UUID in lowercase.
 * The application contract does not fix the UUID version.
 * Uniqueness of ids that exist at the same time is additionally protected
 * by storage constraints.
 * A test stub, when a scenario needs one, returns different valid ids.
 */
export interface IdGenerator {
  next(): string;
}
