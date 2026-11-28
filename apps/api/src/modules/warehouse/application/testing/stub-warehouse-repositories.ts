import type { WarehouseMapRepository } from '../ports/repositories/warehouse-map.repository';
import type { WarehouseRepository } from '../ports/repositories/warehouse.repository';
function unused(name: string): () => Promise<never> {
  return () => Promise.reject(new Error(`${name} must not be used`));
}

/** Warehouse repository whose methods throw until a spec replaces them. */
export function stubWarehouses(overrides: Partial<WarehouseRepository> = {}): WarehouseRepository {
  return {
    insert: unused('insert'),
    findById: unused('findById'),
    list: unused('list'),
    save: unused('save'),
    delete: unused('delete'),
    ...overrides,
  };
}

/** Map repository whose methods throw until a spec replaces them. */
export function stubMaps(overrides: Partial<WarehouseMapRepository> = {}): WarehouseMapRepository {
  return {
    insert: unused('map insert'),
    findById: unused('map findById'),
    findByWarehouseId: unused('map findByWarehouseId'),
    save: unused('map save'),
    deleteByWarehouseId: unused('deleteByWarehouseId'),
    ...overrides,
  };
}
