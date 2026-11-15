/**
 * Supplies ids for new warehouses, maps, robots, and stations.
 * `next` is synchronous. Each result must pass the domain `assertId` check
 * and be usable as a distinct identity. The port does not fix the algorithm.
 * Storage still refuses to replace an existing record on `insert`.
 * A test stub, when a scenario needs one, returns different valid ids.
 */
export interface IdGenerator {
  next(): string;
}
