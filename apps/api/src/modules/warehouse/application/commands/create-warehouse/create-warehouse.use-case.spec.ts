import { describe, expect, it } from 'vitest';

import { CacheError } from '../../../../../cache/application/errors/cache.error';
import { fixedClock } from '../../../../../common/testing/fixed-clock';
import {
  createRecordingLogger,
  type LogEntry,
} from '../../../../../common/testing/create-recording-logger';
import { RecordingCache } from '../../../../../common/testing/recording-cache';
import { scriptedIds } from '../../../../../common/testing/scripted-ids';
import type { Warehouse } from '../../../domain/entities/warehouse';
import type { WarehouseMap } from '../../../domain/entities/warehouse-map';
import { InvalidNameError } from '../../../domain/errors/value.errors';
import { stubUnitOfWork } from '../../testing/stub-unit-of-work';
import type { UnitOfWork } from '../../ports/system/unit-of-work';
import { WAREHOUSE_LIST_CACHE_KEY } from '../../queries/warehouse-cache.policy';
import { CreateWarehouse } from './create-warehouse.use-case';

const WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';
const MAP_ID = '22222222-2222-7111-8111-22222222222b';

const RECORDED_AT = new Date('2026-11-16T12:00:00.000Z');

interface Harness {
  useCase: CreateWarehouse;
  inserted: { warehouse?: Warehouse; map?: WarehouseMap; recordedAt?: Date };
  calls: string[];
  logs: LogEntry[];
  cache: RecordingCache;
  inserts: { count: number };
  nowCalls: number;
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
  const cache = new RecordingCache();
  const { logger, logs } = createRecordingLogger();
  const recorded = fixedClock(RECORDED_AT);
  const inserts = { count: 0 };
  let executeCount = 0;
  const inner = stubUnitOfWork({
    calls,
    inserts,
    after: options?.afterCallback,
    warehouses: {
      async insert(warehouse, recordedAt) {
        calls.push('insert-warehouse');
        await options?.onInsertWarehouse?.();
        inserted.warehouse = warehouse;
        inserted.recordedAt = recordedAt;
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
    },
  });
  const unitOfWork: UnitOfWork = {
    execute(work) {
      executeCount += 1;
      return inner.execute(work);
    },
  };
  const idGenerator = scriptedIds(options?.ids ?? [WAREHOUSE_ID, MAP_ID]);

  return {
    useCase: new CreateWarehouse(unitOfWork, idGenerator, recorded.clock, cache, logger),
    inserted,
    calls,
    logs,
    cache,
    inserts,
    get nowCalls() {
      return recorded.nowCalls();
    },
    get executeCount() {
      return executeCount;
    },
  };
}

describe('CreateWarehouse', () => {
  it('keeps the created warehouse when list invalidation fails', async () => {
    const harness = createHarness();
    harness.cache.deleteErrors.push(new CacheError('unavailable'));

    await expect(harness.useCase.execute({ name: 'Main' })).resolves.toMatchObject({
      warehouseId: WAREHOUSE_ID,
    });
    expect(harness.cache.deleted).toEqual([WAREHOUSE_LIST_CACHE_KEY]);
    expect(harness.logs.map((entry) => entry.event)).toEqual([
      'warehouse.cache.invalidate_failed',
      'warehouse.created',
    ]);
  });

  it('returns the created warehouse when cache delete throws an unexpected error', async () => {
    const harness = createHarness();
    harness.cache.unexpectedDeleteError = new Error('redis://secret');

    await expect(harness.useCase.execute({ name: 'Main' })).resolves.toEqual({
      warehouseId: WAREHOUSE_ID,
      name: 'Main',
      mapId: MAP_ID,
      version: 0,
    });
    expect(harness.cache.deleted).toEqual([WAREHOUSE_LIST_CACHE_KEY]);
    expect(harness.logs[0]).toEqual({
      level: 'error',
      event: 'warehouse.cache.invalidate_failed',
      context: { errorClass: 'Error' },
    });
    expect(harness.logs.map((entry) => entry.event)).toContain('warehouse.created');
    expect(JSON.stringify(harness.logs)).not.toContain('redis://secret');
  });

  it('creates a warehouse and an empty 20x20 map inside one execute', async () => {
    const harness = createHarness();

    const result = await harness.useCase.execute({ name: '  Main  ' });

    expect(harness.executeCount).toBe(1);
    expect(harness.calls).toEqual(['execute', 'insert-warehouse', 'insert-map']);
    expect(harness.inserts.count).toBe(2);
    expect(harness.nowCalls).toBe(1);
    expect(harness.inserted.recordedAt).toBe(RECORDED_AT);
    expect(harness.cache.deleted).toEqual([WAREHOUSE_LIST_CACHE_KEY]);
    expect(harness.inserted.warehouse?.id).toBe(WAREHOUSE_ID);
    expect(harness.inserted.map?.warehouseId).toBe(harness.inserted.warehouse?.id);
    expect(harness.inserted.map?.snapshot()).toEqual({
      id: MAP_ID,
      warehouseId: WAREHOUSE_ID,
      width: 20,
      height: 20,
      obstacles: [],
      stations: [],
      robots: [],
    });
    expect(result).toEqual({
      warehouseId: WAREHOUSE_ID,
      name: 'Main',
      mapId: MAP_ID,
      version: 0,
    });
    expect(harness.logs).toEqual([
      {
        level: 'info',
        event: 'warehouse.created',
        context: { warehouseId: WAREHOUSE_ID, mapId: MAP_ID, version: 0 },
      },
    ]);
  });

  it('does not insert anything when the name is empty', async () => {
    const harness = createHarness();

    await expect(harness.useCase.execute({ name: '   ' })).rejects.toBeInstanceOf(InvalidNameError);
    expect(harness.executeCount).toBe(0);
    expect(harness.inserted.warehouse).toBeUndefined();
    expect(harness.inserted.map).toBeUndefined();
    expect(harness.logs).toEqual([]);
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
    expect(harness.logs).toEqual([]);
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
    expect(harness.logs).toEqual([]);
  });

  it('does not return success when commit fails after the callback', async () => {
    const failure = new Error('commit failed');
    const harness = createHarness({
      afterCallback: () => {
        throw failure;
      },
    });

    await expect(harness.useCase.execute({ name: 'Main' })).rejects.toBe(failure);
    expect(harness.cache.deleted).toEqual([]);
    expect(harness.logs).toEqual([]);
  });

  it('logs warehouse.created only after unit of work execute settles', async () => {
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
    expect(harness.logs).toEqual([]);
    release?.();
    await pending;
    expect(settled).toBe(true);
    expect(harness.logs).toEqual([
      {
        level: 'info',
        event: 'warehouse.created',
        context: { warehouseId: WAREHOUSE_ID, mapId: MAP_ID, version: 0 },
      },
    ]);
  });
});
