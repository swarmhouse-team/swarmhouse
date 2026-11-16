import { describe, expect, it } from 'vitest';

import { WarehouseNotFoundError } from '../../errors/application.errors';
import { CacheError } from '../../../../cache/application/errors/cache.error';
import type {
  DeleteWarehouseResult,
  StoredWarehouse,
} from '../../ports/repositories/warehouse.repository';
import type { TransactionContext, UnitOfWork } from '../../ports/system/unit-of-work';
import { createRecordingLogger, type LogEntry } from '../../testing/create-recording-logger';
import {
  createRecordingNotifier,
  type WarehouseNotice,
} from '../../testing/create-recording-notifier';
import { RecordingCache } from '../../testing/recording-cache';
import {
  WAREHOUSE_LIST_CACHE_KEY,
  warehouseDetailsCacheKey,
} from '../../queries/warehouse-cache.policy';
import { DeleteWarehouse } from './delete-warehouse.use-case';

interface Harness {
  useCase: DeleteWarehouse;
  calls: string[];
  logs: LogEntry[];
  notices: WarehouseNotice[];
  cache: RecordingCache;
}

function createHarness(options?: {
  found?: StoredWarehouse | null;
  deleteResult?: DeleteWarehouseResult;
  deleteMapsError?: Error;
  deleteWarehouseError?: Error;
  afterCallback?: () => Promise<void>;
}): Harness {
  const calls: string[] = [];
  const cache = new RecordingCache();
  const { logger, logs } = createRecordingLogger();
  const { notifier, notices } = createRecordingNotifier();
  const unitOfWork: UnitOfWork = {
    async execute(work) {
      calls.push('execute');
      const tx: TransactionContext = {
        warehouses: {
          async insert() {
            throw new Error('insert must not be used');
          },
          async findById(warehouseId) {
            calls.push(`findById:${warehouseId}`);
            return options?.found === undefined
              ? { id: 'wh-1', name: 'Main', createdAt: null, updatedAt: null }
              : options.found;
          },
          async list() {
            throw new Error('list must not be used');
          },
          async save() {
            throw new Error('save must not be used');
          },
          async delete(warehouseId) {
            calls.push(`delete-warehouse:${warehouseId}`);
            if (options?.deleteWarehouseError) {
              throw options.deleteWarehouseError;
            }
            return options?.deleteResult ?? { status: 'deleted' };
          },
        },
        maps: {
          async insert() {
            throw new Error('map insert must not be used');
          },
          async findById() {
            throw new Error('map find must not be used');
          },
          async findByWarehouseId() {
            throw new Error('map find must not be used');
          },
          async save() {
            throw new Error('map save must not be used');
          },
          async deleteByWarehouseId(warehouseId) {
            calls.push(`delete-maps:${warehouseId}`);
            if (options?.deleteMapsError) {
              throw options.deleteMapsError;
            }
          },
        },
      };
      const result = await work(tx);
      await options?.afterCallback?.();
      return result;
    },
  };
  return {
    useCase: new DeleteWarehouse(unitOfWork, cache, logger, notifier),
    calls,
    logs,
    notices,
    cache,
  };
}

describe('DeleteWarehouse', () => {
  it('deletes maps before the warehouse', async () => {
    const harness = createHarness();

    await harness.useCase.execute({ warehouseId: 'wh-1' });

    expect(harness.calls).toEqual([
      'execute',
      'findById:wh-1',
      'delete-maps:wh-1',
      'delete-warehouse:wh-1',
    ]);
    expect(harness.cache.deleted).toEqual([
      warehouseDetailsCacheKey('wh-1'),
      WAREHOUSE_LIST_CACHE_KEY,
    ]);
    expect(harness.logs).toEqual([
      {
        level: 'info',
        event: 'warehouse.deleted',
        context: { warehouseId: 'wh-1' },
      },
    ]);
  });

  it('still deletes the second key when the first cache delete fails', async () => {
    const harness = createHarness();
    harness.cache.deleteErrors.push(new CacheError('unavailable'));

    await harness.useCase.execute({ warehouseId: 'wh-1' });

    expect(harness.cache.deleted).toEqual([
      warehouseDetailsCacheKey('wh-1'),
      WAREHOUSE_LIST_CACHE_KEY,
    ]);
    expect(harness.logs[0]).toMatchObject({
      event: 'warehouse.cache.invalidate_failed',
      context: { kind: 'unavailable' },
    });
  });

  it('does not delete when the warehouse is missing', async () => {
    const harness = createHarness({ found: null });

    await expect(harness.useCase.execute({ warehouseId: 'wh-1' })).rejects.toMatchObject({
      name: 'WarehouseNotFoundError',
      details: { warehouseId: 'wh-1' },
    });
    expect(harness.calls).toEqual(['execute', 'findById:wh-1']);
    expect(harness.logs).toEqual([]);
  });

  it('deletes a warehouse that has no maps', async () => {
    const harness = createHarness();

    await expect(harness.useCase.execute({ warehouseId: 'wh-1' })).resolves.toBeUndefined();
    expect(harness.calls).toContain('delete-maps:wh-1');
    expect(harness.calls).toContain('delete-warehouse:wh-1');
  });

  it('does not delete the warehouse when map deletion fails', async () => {
    const failure = new Error('maps unavailable');
    const harness = createHarness({ deleteMapsError: failure });

    await expect(harness.useCase.execute({ warehouseId: 'wh-1' })).rejects.toBe(failure);
    expect(harness.calls).not.toContain('delete-warehouse:wh-1');
  });

  it('propagates a warehouse delete error unchanged', async () => {
    const failure = new Error('warehouse unavailable');
    const harness = createHarness({ deleteWarehouseError: failure });

    await expect(harness.useCase.execute({ warehouseId: 'wh-1' })).rejects.toBe(failure);
  });

  it('rejects when the warehouse disappears before delete', async () => {
    const harness = createHarness({ deleteResult: { status: 'not_found' } });

    await expect(harness.useCase.execute({ warehouseId: 'wh-1' })).rejects.toBeInstanceOf(
      WarehouseNotFoundError,
    );
    expect(harness.calls).toContain('delete-maps:wh-1');
    expect(harness.calls).toContain('delete-warehouse:wh-1');
  });

  it('rejects with the commit error after a successful callback', async () => {
    const failure = new Error('commit failed');
    const harness = createHarness({
      afterCallback: () => {
        throw failure;
      },
    });

    await expect(harness.useCase.execute({ warehouseId: 'wh-1' })).rejects.toBe(failure);
    expect(harness.cache.deleted).toEqual([]);
    expect(harness.logs).toEqual([]);
  });

  it('logs warehouse.deleted only after unit of work execute settles', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const harness = createHarness({ afterCallback: () => gate });
    let settled = false;
    const pending = harness.useCase.execute({ warehouseId: 'wh-1' }).finally(() => {
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
        event: 'warehouse.deleted',
        context: { warehouseId: 'wh-1' },
      },
    ]);
    expect(harness.notices).toEqual([
      { type: 'warehouseDeleted', notice: { warehouseId: 'wh-1' } },
    ]);
  });

  it('does not publish when the warehouse is missing', async () => {
    const harness = createHarness({ found: null });

    await expect(harness.useCase.execute({ warehouseId: 'wh-1' })).rejects.toMatchObject({
      name: 'WarehouseNotFoundError',
    });
    expect(harness.notices).toEqual([]);
  });

  it('publishes when cache invalidation throws a non-cache error', async () => {
    const harness = createHarness();
    harness.cache.unexpectedDeleteError = new Error('cache down');

    await expect(harness.useCase.execute({ warehouseId: 'wh-1' })).rejects.toThrow('cache down');
    expect(harness.notices).toEqual([
      { type: 'warehouseDeleted', notice: { warehouseId: 'wh-1' } },
    ]);
  });
});
