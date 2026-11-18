import { describe, expect, it } from 'vitest';

import { CacheError } from '../../../../../cache/application/errors/cache.error';
import type { CacheValue } from '../../../../../cache/application/cache-value';
import { WarehouseNotFoundError } from '../../errors/application.errors';
import type {
  StoredWarehouse,
  WarehouseRepository,
} from '../../ports/repositories/warehouse.repository';
import { RecordingCache } from '../../testing/recording-cache';
import { WAREHOUSE_DETAILS_TTL_MS, warehouseDetailsCacheKey } from '../warehouse-cache.policy';
import { GetWarehouse } from './get-warehouse.use-case';

const WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';
const OTHER_ID = '22222222-2222-4111-8111-22222222222b';
const CREATED_AT = '2026-01-01T00:00:00.000Z';
const UPDATED_AT = '2026-02-01T00:00:00.000Z';

function stored(dates: { createdAt: Date | null; updatedAt: Date | null }): StoredWarehouse {
  return { id: WAREHOUSE_ID, name: 'Main', ...dates };
}

function repository(
  found: StoredWarehouse | null,
  failure?: Error,
): {
  maps: WarehouseRepository;
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    maps: {
      async insert() {
        throw new Error('insert must not be used');
      },
      async findById(warehouseId) {
        calls.push(warehouseId);
        if (failure) {
          throw failure;
        }
        return found;
      },
      async save() {
        throw new Error('save must not be used');
      },
      async list() {
        throw new Error('list must not be used');
      },
      async delete() {
        throw new Error('delete must not be used');
      },
    },
  };
}

describe('GetWarehouse', () => {
  it('returns a cache hit without reading the repository', async () => {
    const cache = new RecordingCache();
    const key = warehouseDetailsCacheKey(WAREHOUSE_ID);
    cache.values.set(key, {
      ttlMs: WAREHOUSE_DETAILS_TTL_MS,
      value: {
        warehouseId: WAREHOUSE_ID,
        name: 'Main',
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    });
    const { maps, calls } = repository(null);

    const result = await new GetWarehouse(maps, cache).execute({
      warehouseId: WAREHOUSE_ID.toUpperCase(),
    });

    expect(calls).toEqual([]);
    expect(result).toEqual({
      warehouseId: WAREHOUSE_ID,
      name: 'Main',
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    });
  });

  it('reads PostgreSQL on a miss and stores the same ISO dates', async () => {
    const cache = new RecordingCache();
    const { maps, calls } = repository(
      stored({
        createdAt: new Date(CREATED_AT),
        updatedAt: new Date(UPDATED_AT),
      }),
    );

    const result = await new GetWarehouse(maps, cache).execute({
      warehouseId: WAREHOUSE_ID.toUpperCase(),
    });

    expect(calls).toEqual([WAREHOUSE_ID]);
    expect(result.createdAt).toBe(CREATED_AT);
    expect(result.updatedAt).toBe(UPDATED_AT);
    expect(cache.values.get(warehouseDetailsCacheKey(WAREHOUSE_ID))).toEqual({
      ttlMs: WAREHOUSE_DETAILS_TTL_MS,
      value: result,
    });
  });

  it('does not cache a missing warehouse', async () => {
    const cache = new RecordingCache();
    const { maps } = repository(null);

    await expect(
      new GetWarehouse(maps, cache).execute({ warehouseId: WAREHOUSE_ID }),
    ).rejects.toBeInstanceOf(WarehouseNotFoundError);
    expect(cache.values.size).toBe(0);
  });

  it('treats a broken payload and a foreign warehouse id as a miss', async () => {
    const cache = new RecordingCache();
    const key = warehouseDetailsCacheKey(WAREHOUSE_ID);
    cache.values.set(key, { ttlMs: 1, value: { warehouseId: WAREHOUSE_ID } });
    const { maps, calls } = repository(stored({ createdAt: null, updatedAt: null }));

    const broken = await new GetWarehouse(maps, cache).execute({ warehouseId: WAREHOUSE_ID });

    expect(calls).toEqual([WAREHOUSE_ID]);
    expect(broken).toEqual({
      warehouseId: WAREHOUSE_ID,
      name: 'Main',
      createdAt: null,
      updatedAt: null,
    });

    cache.values.set(key, {
      ttlMs: 1,
      value: {
        warehouseId: OTHER_ID,
        name: 'Other',
        createdAt: null,
        updatedAt: null,
      },
    });
    const foreign = await new GetWarehouse(maps, cache).execute({ warehouseId: WAREHOUSE_ID });
    expect(foreign.warehouseId).toBe(WAREHOUSE_ID);
    expect(calls).toEqual([WAREHOUSE_ID, WAREHOUSE_ID]);
  });

  it('returns the database row when cache get or set fails', async () => {
    const { maps } = repository(stored({ createdAt: null, updatedAt: null }));
    const getFailed = new RecordingCache();
    getFailed.getError = new CacheError('unavailable');

    await expect(
      new GetWarehouse(maps, getFailed).execute({ warehouseId: WAREHOUSE_ID }),
    ).resolves.toMatchObject({ warehouseId: WAREHOUSE_ID, createdAt: null });

    const setFailed = new RecordingCache();
    setFailed.setError = new CacheError('command_failed');
    await expect(
      new GetWarehouse(maps, setFailed).execute({ warehouseId: WAREHOUSE_ID }),
    ).resolves.toMatchObject({ name: 'Main' });
  });

  it('does not hide a repository failure', async () => {
    const failure = new Error('database unavailable');
    const { maps } = repository(null, failure);

    await expect(
      new GetWarehouse(maps, new RecordingCache()).execute({ warehouseId: WAREHOUSE_ID }),
    ).rejects.toBe(failure);
  });

  it('keeps reading when deleting a broken payload fails', async () => {
    const cache = new RecordingCache();
    const key = warehouseDetailsCacheKey(WAREHOUSE_ID);
    const broken: CacheValue = { unexpected: true };
    cache.values.set(key, { ttlMs: 1, value: broken });
    cache.deleteErrors.push(new CacheError('unavailable'));
    const { maps } = repository(stored({ createdAt: null, updatedAt: null }));

    await expect(
      new GetWarehouse(maps, cache).execute({ warehouseId: WAREHOUSE_ID }),
    ).resolves.toMatchObject({ warehouseId: WAREHOUSE_ID });
  });
});
