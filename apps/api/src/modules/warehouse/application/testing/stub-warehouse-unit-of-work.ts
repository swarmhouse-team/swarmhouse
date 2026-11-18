import type { WarehouseMapRepository } from '../ports/repositories/warehouse-map.repository';
import type { WarehouseRepository } from '../ports/repositories/warehouse.repository';
import type {
  WarehouseTransactionContext,
  WarehouseUnitOfWork,
} from '../ports/system/warehouse-unit-of-work';

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

/**
 * Unit of work for command specs.
 * `inserts` counts warehouse and map `insert` calls, including overrides.
 * `calls` receives `execute` before the callback. `after` runs after the callback returns.
 */
export function stubUnitOfWork(options: {
  calls: string[];
  inserts: { count: number };
  warehouses?: Partial<WarehouseRepository>;
  maps?: Partial<WarehouseMapRepository>;
  after?: () => Promise<void>;
}): WarehouseUnitOfWork {
  const warehouses = stubWarehouses(options.warehouses);
  const maps = stubMaps(options.maps);
  const insertWarehouse = warehouses.insert.bind(warehouses);
  const insertMap = maps.insert.bind(maps);
  warehouses.insert = async (warehouse, recordedAt) => {
    options.inserts.count += 1;
    await insertWarehouse(warehouse, recordedAt);
  };
  maps.insert = async (map) => {
    options.inserts.count += 1;
    await insertMap(map);
  };
  const tx: WarehouseTransactionContext = { warehouses, maps };
  return {
    async execute(work) {
      options.calls.push('execute');
      const result = await work(tx);
      await options.after?.();
      return result;
    },
  };
}
