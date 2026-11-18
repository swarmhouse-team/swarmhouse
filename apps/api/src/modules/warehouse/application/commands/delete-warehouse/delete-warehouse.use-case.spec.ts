import { describe, expect, it } from 'vitest';

import { CacheError } from '../../../../../cache/application/errors/cache.error';
import { WarehouseNotFoundError } from '../../errors/application.errors';
import type {
  DeleteWarehouseResult,
  StoredWarehouse,
} from '../../ports/repositories/warehouse.repository';
import { createRecordingLogger, type LogEntry } from '../../../../../common/testing/create-recording-logger';
import {
  createRecordingNotifier,
  type WarehouseNotice,
} from '../../testing/create-recording-notifier';
import { RecordingCache } from '../../../../../common/testing/recording-cache';
import { stubUnitOfWork } from '../../testing/stub-unit-of-work';
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
  inserts: { count: number };
  failNotifier: (error: Error) => void;
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
  const { notifier, notices, failWith } = createRecordingNotifier();
  const inserts = { count: 0 };
  const unitOfWork = stubUnitOfWork({
    calls,
    inserts,
    after: options?.afterCallback,
    warehouses: {
      async findById(warehouseId) {
        calls.push(`findById:${warehouseId}`);
        return options?.found === undefined
          ? { id: 'wh-1', name: 'Main', createdAt: null, updatedAt: null }
          : options.found;
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
      async deleteByWarehouseId(warehouseId) {
        calls.push(`delete-maps:${warehouseId}`);
        if (options?.deleteMapsError) {
          throw options.deleteMapsError;
        }
      },
    },
  });
  return {
    useCase: new DeleteWarehouse(unitOfWork, cache, logger, notifier),
    calls,
    logs,
    notices,
    cache,
    inserts,
    failNotifier: failWith,
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
    expect(harness.inserts.count).toBe(0);
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

  it('deletes the list key and publishes when the details delete throws', async () => {
    const harness = createHarness();
    harness.cache.unexpectedDeleteError = new Error('redis://secret');

    await expect(harness.useCase.execute({ warehouseId: 'wh-1' })).resolves.toBeUndefined();
    expect(harness.cache.deleted).toEqual([
      warehouseDetailsCacheKey('wh-1'),
      WAREHOUSE_LIST_CACHE_KEY,
    ]);
    expect(harness.notices).toEqual([
      { type: 'warehouseDeleted', notice: { warehouseId: 'wh-1' } },
    ]);
    expect(harness.logs.filter((entry) => entry.level === 'error')).toHaveLength(2);
    expect(JSON.stringify(harness.logs)).not.toContain('redis://secret');
  });

  it('returns after the notifier throws', async () => {
    const harness = createHarness();
    harness.failNotifier(new Error('socket down'));

    await expect(harness.useCase.execute({ warehouseId: 'wh-1' })).resolves.toBeUndefined();
    expect(harness.notices).toEqual([
      { type: 'warehouseDeleted', notice: { warehouseId: 'wh-1' } },
    ]);
    expect(harness.logs).toContainEqual({
      level: 'error',
      event: 'warehouse.realtime.publish_failed',
      context: { errorClass: 'Error' },
    });
    expect(JSON.stringify(harness.logs)).not.toContain('socket down');
  });

  it('returns when cache and notifier both throw', async () => {
    const harness = createHarness();
    harness.cache.unexpectedDeleteError = new Error('redis://secret');
    harness.failNotifier(new Error('socket down'));

    await expect(harness.useCase.execute({ warehouseId: 'wh-1' })).resolves.toBeUndefined();
    expect(harness.cache.deleted).toEqual([
      warehouseDetailsCacheKey('wh-1'),
      WAREHOUSE_LIST_CACHE_KEY,
    ]);
    expect(harness.notices).toEqual([
      { type: 'warehouseDeleted', notice: { warehouseId: 'wh-1' } },
    ]);
    expect(JSON.stringify(harness.logs)).not.toContain('redis://secret');
    expect(JSON.stringify(harness.logs)).not.toContain('socket down');
  });
});
