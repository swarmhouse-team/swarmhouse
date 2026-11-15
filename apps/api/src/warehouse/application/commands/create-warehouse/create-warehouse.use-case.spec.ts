import { describe, expect, it } from 'vitest';

import type { Warehouse } from '../../../domain/entities/warehouse';
import type { WarehouseMap } from '../../../domain/entities/warehouse-map';
import { InvalidNameError } from '../../../domain/errors/value.errors';
import type { IdGenerator } from '../../ports/system/id-generator';
import type { TransactionContext, UnitOfWork } from '../../ports/system/unit-of-work';
import { CreateWarehouse } from './create-warehouse.use-case';

interface Harness {
  useCase: CreateWarehouse;
  inserted: { warehouse?: Warehouse; map?: WarehouseMap };
  calls: string[];
  executeCount: number;
}

function createHarness(options?: {
  ids?: string[];
  onInsertWarehouse?: () => Promise<void> | void;
  onInsertMap?: () => Promise<void> | void;
  afterCallback?: () => Promise<void>;
}): Harness {
  const inserted: Harness['inserted'] = {};
  const calls: string[] = [];
  const ids = [...(options?.ids ?? ['wh-1', 'map-1'])];
  let executeCount = 0;
  const unitOfWork: UnitOfWork = {
    async execute(work) {
      executeCount += 1;
      calls.push('execute');
      const tx: TransactionContext = {
        warehouses: {
          async insert(warehouse) {
            calls.push('insert-warehouse');
            await options?.onInsertWarehouse?.();
            inserted.warehouse = warehouse;
          },
          async findById() {
            throw new Error('findById must not be used');
          },
          async save() {
            throw new Error('save must not be used');
          },
          async delete() {
            throw new Error('delete must not be used');
          },
        },
        maps: {
          async insert(map) {
            calls.push('insert-map');
            await options?.onInsertMap?.();
            inserted.map = map;
          },
          async findById() {
            return null;
          },
          async findByWarehouseId() {
            return null;
          },
          async save() {
            return { status: 'not_found' };
          },
          async deleteByWarehouseId() {
            throw new Error('deleteByWarehouseId must not be used');
          },
        },
      };
      const result = await work(tx);
      await options?.afterCallback?.();
      return result;
    },
  };
  const idGenerator: IdGenerator = {
    next: () => {
      const id = ids.shift();
      if (!id) {
        throw new Error('No more ids');
      }
      return id;
    },
  };

  return {
    useCase: new CreateWarehouse(unitOfWork, idGenerator),
    inserted,
    calls,
    get executeCount() {
      return executeCount;
    },
  };
}

describe('CreateWarehouse', () => {
  it('creates a warehouse and an empty 20x20 map inside one execute', async () => {
    const harness = createHarness();

    const result = await harness.useCase.execute({ name: '  Main  ' });

    expect(harness.executeCount).toBe(1);
    expect(harness.calls).toEqual(['execute', 'insert-warehouse', 'insert-map']);
    expect(harness.inserted.warehouse?.id).toBe('wh-1');
    expect(harness.inserted.map?.warehouseId).toBe(harness.inserted.warehouse?.id);
    expect(harness.inserted.map?.snapshot()).toEqual({
      id: 'map-1',
      warehouseId: 'wh-1',
      width: 20,
      height: 20,
      obstacles: [],
      stations: [],
      robots: [],
    });
    expect(result).toEqual({
      warehouseId: 'wh-1',
      name: 'Main',
      mapId: 'map-1',
      version: 0,
    });
  });

  it('does not insert anything when the name is empty', async () => {
    const harness = createHarness();

    await expect(harness.useCase.execute({ name: '   ' })).rejects.toBeInstanceOf(InvalidNameError);
    expect(harness.executeCount).toBe(0);
    expect(harness.inserted.warehouse).toBeUndefined();
    expect(harness.inserted.map).toBeUndefined();
  });

  it('does not insert the map when the warehouse insert fails', async () => {
    const failure = new Error('warehouse insert failed');
    const harness = createHarness({
      onInsertWarehouse: () => {
        throw failure;
      },
    });

    await expect(harness.useCase.execute({ name: 'Main' })).rejects.toBe(failure);
    expect(harness.calls).toEqual(['execute', 'insert-warehouse']);
    expect(harness.inserted.map).toBeUndefined();
  });

  it('propagates the map insert error as the same object', async () => {
    const failure = new Error('map insert failed');
    const harness = createHarness({
      onInsertMap: () => {
        throw failure;
      },
    });

    await expect(harness.useCase.execute({ name: 'Main' })).rejects.toBe(failure);
    expect(harness.calls).toEqual(['execute', 'insert-warehouse', 'insert-map']);
  });

  it('does not return success when commit fails after the callback', async () => {
    const failure = new Error('commit failed');
    const harness = createHarness({
      afterCallback: () => {
        throw failure;
      },
    });

    await expect(harness.useCase.execute({ name: 'Main' })).rejects.toBe(failure);
  });

  it('stays pending until unit of work execute settles', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const harness = createHarness({
      afterCallback: () => gate,
    });

    let settled = false;
    const pending = harness.useCase.execute({ name: 'Main' }).finally(() => {
      settled = true;
    });
    await Promise.resolve();

    expect(settled).toBe(false);
    release?.();
    await pending;
    expect(settled).toBe(true);
  });
});
