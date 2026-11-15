import type { Warehouse } from '../../../domain/entities/warehouse';

/** A stored warehouse. `name` is the value last saved by the domain. */
export interface StoredWarehouse {
  id: string;
  name: string;
}

/**
 * Result of updating an existing warehouse. `save` never inserts.
 * `saved` — the warehouse still existed and the new name is stored.
 * Inside a unit of work this does not mean the transaction has committed.
 * `not_found` — the warehouse disappeared after it was loaded. Storage of
 * this write stays unchanged. The caller must not treat that as success.
 * This result is not a lost-update lock: the warehouse has no version.
 */
export type SaveWarehouseResult = { status: 'saved' } | { status: 'not_found' };

/**
 * Result of deleting an existing warehouse. The method deletes only the
 * warehouse row. Maps are removed by `WarehouseMapRepository.deleteByWarehouseId`.
 * `deleted` — the warehouse existed at delete time.
 * `not_found` — it was already gone. The caller must not treat that as success.
 */
export type DeleteWarehouseResult = { status: 'deleted' } | { status: 'not_found' };

/**
 * Persistence port for the warehouse aggregate.
 * Implementations must not replace an existing warehouse with the same id.
 * This port does not define the error for that case.
 * `save` updates an existing warehouse and must not insert one.
 */
export interface WarehouseRepository {
  insert(warehouse: Warehouse): Promise<void>;

  findById(warehouseId: string): Promise<StoredWarehouse | null>;

  save(warehouse: Warehouse): Promise<SaveWarehouseResult>;

  delete(warehouseId: string): Promise<DeleteWarehouseResult>;
}
