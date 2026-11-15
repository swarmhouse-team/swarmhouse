import { describe, expect, it } from 'vitest';

import type { Warehouse } from '../../../domain/entities/warehouse';
import { InvalidNameError } from '../../../domain/errors/value.errors';
import { MAX_NAME_LENGTH } from '../../../domain/vo/name';
import { WarehouseNotFoundError } from '../../errors/application.errors';
import type {
  SaveWarehouseResult,
  StoredWarehouse,
} from '../../ports/repositories/warehouse.repository';
import type { TransactionContext, UnitOfWork } from '../../ports/system/unit-of-work';
import { UpdateWarehouse } from './update-warehouse.use-case';

const WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';

interface Harness {
  useCase: UpdateWarehouse;
  calls: string[];
  saved?: Warehouse;
}

function createHarness(options?: {
  found?: StoredWarehouse | null;
  saveResult?: SaveWarehouseResult;
  findError?: Error;
  saveError?: Error;
  afterCallback?: () => Promise<void>;
}): Harness {
  const calls: string[] = [];
  const state: Harness = {
    useCase: undefined as unknown as UpdateWarehouse,
    calls,
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
              ? { id: WAREHOUSE_ID, name: 'Main' }
              : options.found;
          },
          async save(warehouse) {
            calls.push('save');
            if (options?.saveError) {
              throw options.saveError;
            }
            state.saved = warehouse;
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
  state.useCase = new UpdateWarehouse(unitOfWork);
  return state;
}

describe('UpdateWarehouse', () => {
  it('saves a renamed warehouse and returns the normalized name', async () => {
    const harness = createHarness();

    const result = await harness.useCase.execute({ warehouseId: WAREHOUSE_ID, name: '  North  ' });

    expect(harness.calls).toEqual(['execute', `findById:${WAREHOUSE_ID}`, 'save']);
    expect(harness.saved?.id).toBe(WAREHOUSE_ID);
    expect(harness.saved?.name.value).toBe('North');
    expect(result).toEqual({ warehouseId: WAREHOUSE_ID, name: 'North' });
    expect(harness.calls).not.toContain('map');
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
  });

  it('returns the current name without saving when it is already normalized', async () => {
    const harness = createHarness({ found: { id: WAREHOUSE_ID, name: 'Main' } });

    const result = await harness.useCase.execute({ warehouseId: WAREHOUSE_ID, name: '  Main  ' });

    expect(result).toEqual({ warehouseId: WAREHOUSE_ID, name: 'Main' });
    expect(harness.calls).not.toContain('save');
    expect(harness.calls).not.toContain('map');
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
  });

  it('does not settle before unit of work execute settles', async () => {
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
    release?.();
    await pending;
    expect(settled).toBe(true);
  });
});
