import type { WarehouseMap } from '../../../domain/entities/warehouse-map';
import type { WarehouseMapRestoreInput } from '../../mapping/warehouse-map-restore-input';

/**
 * A stored map record. `snapshot` is structural data that still has to pass
 * `WarehouseMap.restore`. `version` belongs to the same committed write.
 * A valid aggregate snapshot is a valid value of this field.
 */
export interface StoredWarehouseMap {
  snapshot: WarehouseMapRestoreInput;
  version: number;
}

/**
 * Result of a conditional update. `save` never creates a missing map.
 * `saved` — the write for `expectedVersion` succeeded in the current transaction,
 * and the stored version is `expectedVersion + 1`. Inside a unit of work this
 * does not mean the transaction has committed.
 * `conflict` — the write for the expected version did not happen. `actualVersion`
 * is the version the adapter observed while checking the conflict. It may already
 * be stale when the caller receives the result.
 * `not_found` — the adapter found no row for this id while performing the operation.
 * `conflict` and `not_found` mean this `save` wrote nothing. They do not describe
 * other writes in the same transaction or in the database.
 * `EditWarehouseMap` throws `MapVersionConflictError` for `conflict` and
 * `WarehouseMapNotFoundError` for `not_found`.
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
 * write are one atomic step. A read that does not call `save` does not get
 * this check. See `SaveMapResult`.
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
