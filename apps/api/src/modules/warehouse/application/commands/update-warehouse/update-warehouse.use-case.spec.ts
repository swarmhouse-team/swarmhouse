import { describe, expect, it } from 'vitest';

import { CacheError } from '../../../../../cache/application/errors/cache.error';

import type { Warehouse } from '../../../domain/entities/warehouse';
import { InvalidNameError } from '../../../domain/errors/value.errors';
import { MAX_NAME_LENGTH } from '../../../domain/constants';
import { WarehouseNotFoundError } from '../../errors/application.errors';
import type {
  SaveWarehouseResult,
  StoredWarehouse,
} from '../../ports/repositories/warehouse.repository';
import type { Clock } from '../../ports/system/clock';
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
import { UpdateWarehouse } from './update-warehouse.use-case';

const WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';
const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');
const UPDATED_AT = new Date('2026-11-16T12:00:00.000Z');

interface Harness {
  useCase: UpdateWarehouse;
  calls: string[];
  logs: LogEntry[];
  notices: WarehouseNotice[];
  cache: RecordingCache;
  nowCalls: number;
  saved?: Warehouse;
  savedAt?: Date;
  failNotifier: (error: Error) => void;
}

function createHarness(options?: {
  found?: StoredWarehouse | null;
  saveResult?: SaveWarehouseResult;
  findError?: Error;
  saveError?: Error;
  afterCallback?: () => Promise<void>;
}): Harness {
  const calls: string[] = [];
  const cache = new RecordingCache();
  const { logger, logs } = createRecordingLogger();
  const { notifier, notices, failWith } = createRecordingNotifier();
  let nowCalls = 0;
  const clock: Clock = {
    now() {
      nowCalls += 1;
      return UPDATED_AT;
    },
  };
  const state: Harness = {
    useCase: undefined as unknown as UpdateWarehouse,
    calls,
    logs,
    notices,
    cache,
    get nowCalls() {
      return nowCalls;
    },
    failNotifier: failWith,
  };
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
            if (options?.findError) {
              throw options.findError;
            }
            return options?.found === undefined
              ? { id: WAREHOUSE_ID, name: 'Main', createdAt: CREATED_AT, updatedAt: CREATED_AT }
              : options.found;
          },
          async list() {
            throw new Error('list must not be used');
          },
          async save(warehouse, updatedAt) {
            calls.push('save');
            if (options?.saveError) {
              throw options.saveError;
            }
            state.saved = warehouse;
            state.savedAt = updatedAt;
            return options?.saveResult ?? { status: 'saved' };
          },
          async delete() {
            throw new Error('delete must not be used');
          },
        },
        maps: {
          async insert() {
            calls.push('map');
            throw new Error('map repository must not be used');
          },
          async findById() {
            calls.push('map');
            throw new Error('map repository must not be used');
          },
          async findByWarehouseId() {
            calls.push('map');
            throw new Error('map repository must not be used');
          },
          async save() {
            calls.push('map');
            throw new Error('map repository must not be used');
          },
          async deleteByWarehouseId() {
            calls.push('map');
            throw new Error('map repository must not be used');
          },
        },
      };
      const result = await work(tx);
      await options?.afterCallback?.();
      return result;
    },
  };
  state.useCase = new UpdateWarehouse(unitOfWork, clock, cache, logger, notifier);
  return state;
}

describe('UpdateWarehouse', () => {
  it('deletes the list key when the details key delete fails', async () => {
    const harness = createHarness();
    harness.cache.deleteErrors.push(new CacheError('command_failed'));

    await expect(
      harness.useCase.execute({ warehouseId: WAREHOUSE_ID, name: 'North' }),
    ).resolves.toEqual({ warehouseId: WAREHOUSE_ID, name: 'North' });
    expect(harness.cache.deleted).toEqual([
      warehouseDetailsCacheKey(WAREHOUSE_ID),
      WAREHOUSE_LIST_CACHE_KEY,
    ]);
    expect(harness.logs[0]).toMatchObject({
      level: 'warn',
      event: 'warehouse.cache.invalidate_failed',
      context: { errorClass: 'CacheError', kind: 'command_failed' },
    });
  });

  it('saves a renamed warehouse and returns the normalized name', async () => {
    const harness = createHarness();

    const result = await harness.useCase.execute({ warehouseId: WAREHOUSE_ID, name: '  North  ' });

    expect(harness.calls).toEqual(['execute', `findById:${WAREHOUSE_ID}`, 'save']);
    expect(harness.saved?.id).toBe(WAREHOUSE_ID);
    expect(harness.saved?.name.value).toBe('North');
    expect(harness.nowCalls).toBe(1);
    expect(harness.savedAt).toBe(UPDATED_AT);
    expect(harness.cache.deleted).toEqual([
      warehouseDetailsCacheKey(WAREHOUSE_ID),
      WAREHOUSE_LIST_CACHE_KEY,
    ]);
    expect(result).toEqual({ warehouseId: WAREHOUSE_ID, name: 'North' });
    expect(harness.calls).not.toContain('map');
    expect(harness.logs).toEqual([
      {
        level: 'info',
        event: 'warehouse.renamed',
        context: { warehouseId: WAREHOUSE_ID },
      },
    ]);
  });

  it.each(['   ', 'x'.repeat(MAX_NAME_LENGTH + 1)])(
    'does not save an invalid name %j',
    async (name) => {
      const harness = createHarness();

      await expect(
        harness.useCase.execute({ warehouseId: WAREHOUSE_ID, name }),
      ).rejects.toBeInstanceOf(InvalidNameError);
      expect(harness.calls).not.toContain('save');
    },
  );

  it('does not save when the warehouse is missing', async () => {
    const harness = createHarness({ found: null });

    await expect(
      harness.useCase.execute({ warehouseId: WAREHOUSE_ID, name: 'North' }),
    ).rejects.toMatchObject({
      name: 'WarehouseNotFoundError',
      details: { warehouseId: WAREHOUSE_ID },
    });
    expect(harness.calls).toEqual(['execute', `findById:${WAREHOUSE_ID}`]);
    expect(harness.logs).toEqual([]);
  });

  it('returns the current name without saving when it is already normalized', async () => {
    const harness = createHarness({
      found: { id: WAREHOUSE_ID, name: 'Main', createdAt: CREATED_AT, updatedAt: CREATED_AT },
    });

    const result = await harness.useCase.execute({ warehouseId: WAREHOUSE_ID, name: '  Main  ' });

    expect(result).toEqual({ warehouseId: WAREHOUSE_ID, name: 'Main' });
    expect(harness.calls).not.toContain('save');
    expect(harness.calls).not.toContain('map');
    expect(harness.nowCalls).toBe(0);
    expect(harness.cache.deleted).toEqual([]);
    expect(harness.logs).toEqual([]);
  });

  it('keeps a legacy null createdAt and changes only updatedAt', async () => {
    const harness = createHarness({
      found: { id: WAREHOUSE_ID, name: 'Main', createdAt: null, updatedAt: null },
    });

    await harness.useCase.execute({ warehouseId: WAREHOUSE_ID, name: 'North' });

    expect(harness.savedAt).toBe(UPDATED_AT);
    expect(harness.calls).toContain('save');
  });

  it('does not invalidate when the commit fails', async () => {
    const failure = new Error('commit failed');
    const harness = createHarness({
      afterCallback: () => {
        throw failure;
      },
    });

    await expect(
      harness.useCase.execute({ warehouseId: WAREHOUSE_ID, name: 'North' }),
    ).rejects.toBe(failure);
    expect(harness.cache.deleted).toEqual([]);
  });

  it('rejects when the warehouse disappears before save', async () => {
    const harness = createHarness({ saveResult: { status: 'not_found' } });

    await expect(
      harness.useCase.execute({ warehouseId: WAREHOUSE_ID, name: 'North' }),
    ).rejects.toBeInstanceOf(WarehouseNotFoundError);
    expect(harness.calls).toContain('save');
  });

  it('propagates a repository error unchanged', async () => {
    const failure = new Error('database unavailable');
    const harness = createHarness({ findError: failure });

    await expect(
      harness.useCase.execute({ warehouseId: WAREHOUSE_ID, name: 'North' }),
    ).rejects.toBe(failure);
  });

  it('rejects with the commit error after a successful callback', async () => {
    const failure = new Error('commit failed');
    const harness = createHarness({
      afterCallback: () => {
        throw failure;
      },
    });

    await expect(
      harness.useCase.execute({ warehouseId: WAREHOUSE_ID, name: 'North' }),
    ).rejects.toBe(failure);
    expect(harness.logs).toEqual([]);
  });

  it('logs warehouse.renamed only after unit of work execute settles', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const harness = createHarness({ afterCallback: () => gate });
    let settled = false;
    const pending = harness.useCase
      .execute({ warehouseId: WAREHOUSE_ID, name: 'North' })
      .finally(() => {
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
        event: 'warehouse.renamed',
        context: { warehouseId: WAREHOUSE_ID },
      },
    ]);
    expect(harness.notices).toEqual([
      { type: 'warehouseUpdated', notice: { warehouseId: WAREHOUSE_ID } },
    ]);
  });

  it('does not publish a no-op rename', async () => {
    const harness = createHarness();

    await harness.useCase.execute({ warehouseId: WAREHOUSE_ID, name: 'Main' });

    expect(harness.notices).toEqual([]);
  });

  it('deletes the list key and publishes when the details delete throws', async () => {
    const harness = createHarness();
    harness.cache.unexpectedDeleteError = new Error('redis://secret');

    await expect(
      harness.useCase.execute({ warehouseId: WAREHOUSE_ID, name: 'North' }),
    ).resolves.toEqual({ warehouseId: WAREHOUSE_ID, name: 'North' });
    expect(harness.cache.deleted).toEqual([
      warehouseDetailsCacheKey(WAREHOUSE_ID),
      WAREHOUSE_LIST_CACHE_KEY,
    ]);
    expect(harness.notices).toEqual([
      { type: 'warehouseUpdated', notice: { warehouseId: WAREHOUSE_ID } },
    ]);
    expect(harness.logs.filter((entry) => entry.level === 'error')).toEqual([
      {
        level: 'error',
        event: 'warehouse.cache.invalidate_failed',
        context: { errorClass: 'Error' },
      },
      {
        level: 'error',
        event: 'warehouse.cache.invalidate_failed',
        context: { errorClass: 'Error' },
      },
    ]);
    expect(JSON.stringify(harness.logs)).not.toContain('redis://secret');
  });

  it('returns the rename when the notifier throws', async () => {
    const harness = createHarness();
    harness.failNotifier(new Error('socket down'));

    await expect(
      harness.useCase.execute({ warehouseId: WAREHOUSE_ID, name: 'North' }),
    ).resolves.toEqual({ warehouseId: WAREHOUSE_ID, name: 'North' });
    expect(harness.notices).toEqual([
      { type: 'warehouseUpdated', notice: { warehouseId: WAREHOUSE_ID } },
    ]);
    expect(harness.logs).toContainEqual({
      level: 'error',
      event: 'warehouse.realtime.publish_failed',
      context: { errorClass: 'Error' },
    });
    expect(JSON.stringify(harness.logs)).not.toContain('socket down');
  });

  it('returns the rename when cache and notifier both throw', async () => {
    const harness = createHarness();
    harness.cache.unexpectedDeleteError = new Error('redis://secret');
    harness.failNotifier(new Error('socket down'));

    await expect(
      harness.useCase.execute({ warehouseId: WAREHOUSE_ID, name: 'North' }),
    ).resolves.toEqual({ warehouseId: WAREHOUSE_ID, name: 'North' });
    expect(harness.cache.deleted).toEqual([
      warehouseDetailsCacheKey(WAREHOUSE_ID),
      WAREHOUSE_LIST_CACHE_KEY,
    ]);
    expect(harness.notices).toEqual([
      { type: 'warehouseUpdated', notice: { warehouseId: WAREHOUSE_ID } },
    ]);
    expect(JSON.stringify(harness.logs)).not.toContain('redis://secret');
    expect(JSON.stringify(harness.logs)).not.toContain('socket down');
  });
});
