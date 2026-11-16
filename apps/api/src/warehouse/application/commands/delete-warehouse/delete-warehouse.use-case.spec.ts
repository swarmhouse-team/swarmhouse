import { describe, expect, it } from 'vitest';

import { WarehouseNotFoundError } from '../../errors/application.errors';
import type { DeleteWarehouseResult } from '../../ports/repositories/warehouse.repository';
import type { TransactionContext, UnitOfWork } from '../../ports/system/unit-of-work';
import { createRecordingLogger, type LogEntry } from '../../testing/create-recording-logger';
import { DeleteWarehouse } from './delete-warehouse.use-case';

interface Harness {
  useCase: DeleteWarehouse;
  calls: string[];
  logs: LogEntry[];
}

function createHarness(options?: {
  found?: { id: string; name: string } | null;
  deleteResult?: DeleteWarehouseResult;
  deleteMapsError?: Error;
  deleteWarehouseError?: Error;
  afterCallback?: () => Promise<void>;
}): Harness {
  const calls: string[] = [];
  const { logger, logs } = createRecordingLogger();
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
            return options?.found === undefined ? { id: 'wh-1', name: 'Main' } : options.found;
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
  return { useCase: new DeleteWarehouse(unitOfWork, logger), calls, logs };
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
    expect(harness.logs).toEqual([
      {
        level: 'info',
        event: 'warehouse.deleted',
        context: { warehouseId: 'wh-1' },
      },
    ]);
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
  });
});
