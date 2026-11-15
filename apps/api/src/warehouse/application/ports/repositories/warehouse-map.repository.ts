import type { WarehouseMap, WarehouseMapSnapshot } from '../../../domain/entities/warehouse-map';

/** A stored map record. `snapshot` and `version` belong to the same committed write. */
export interface StoredWarehouseMap {
  snapshot: WarehouseMapSnapshot;
  version: number;
}

/**
 * Result of a conditional update. `save` never creates a missing map.
 * `saved` — the map existed, the version matched, and the stored version is
 * `expectedVersion + 1`. Inside a future unit of work this still does not mean
 * the transaction has committed: that is decided only when `execute` finishes.
 * If the map changes or disappears before commit, `execute` rejects and applies
 * none of the transaction's writes.
 * `conflict` — the map exists, but `expectedVersion` does not match. Storage
 * stays unchanged.
 * `not_found` — no map has this id. Storage stays unchanged.
 * A future `EditWarehouseMap` maps `conflict` to `MapVersionConflictError` and
 * `not_found` to `WarehouseMapNotFoundError`.
 */
export type SaveMapResult =
  | { status: 'saved'; version: number }
  | { status: 'conflict'; actualVersion: number }
  | { status: 'not_found' };

/**
 * Persistence port for the map aggregate.
 *
 * `insert` stores a new map at version 0 and must not replace a map that
 * already has the same id. The port does not define the error for a duplicate
 * id.
 *
 * `findById` and `findByWarehouseId` return `null` when no record exists.
 * A returned value is a consistent snapshot/version pair. Mutating it must
 * not change the stored record.
 *
 * `save` updates an existing map only. The expected-version check and the
 * write are one atomic step. See `SaveMapResult`.
 */
export interface WarehouseMapRepository {
  insert(map: WarehouseMap): Promise<void>;

  findById(mapId: string): Promise<StoredWarehouseMap | null>;

  findByWarehouseId(warehouseId: string): Promise<StoredWarehouseMap | null>;

  save(map: WarehouseMap, expectedVersion: number): Promise<SaveMapResult>;

  /**
   * Deletes every map that belongs to the warehouse, including its contents.
   * Zero maps is success. This does not delete the warehouse and does not
   * use the map version check: the rows are removed, not conditionally updated.
   * Atomicity with the warehouse delete belongs to the unit of work.
   */
  deleteByWarehouseId(warehouseId: string): Promise<void>;
}
