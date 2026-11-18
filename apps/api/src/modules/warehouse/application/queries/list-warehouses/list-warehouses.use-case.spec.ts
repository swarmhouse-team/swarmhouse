import { describe, expect, it } from 'vitest';

import { CacheError } from '../../../../../cache/application/errors/cache.error';
import type {
  StoredWarehouse,
  WarehouseRepository,
} from '../../ports/repositories/warehouse.repository';
import { RecordingCache } from '../../testing/recording-cache';
import { WAREHOUSE_LIST_CACHE_KEY, WAREHOUSE_LIST_TTL_MS } from '../warehouse-cache.policy';
import { ListWarehouses } from './list-warehouses.use-case';

const FIRST_ID = '11111111-1111-4111-8111-11111111111a';
const SECOND_ID = '22222222-2222-4111-8111-22222222222b';

function repository(
  rows: StoredWarehouse[],
  failure?: Error,
): {
  maps: WarehouseRepository;
  calls: number;
} {
  const state = { calls: 0 };
  return {
    get calls() {
      return state.calls;
    },
    maps: {
      async insert() {
        throw new Error('insert must not be used');
      },
      async findById() {
        throw new Error('findById must not be used');
      },
      async save() {
        throw new Error('save must not be used');
      },
      async list() {
        state.calls += 1;
        if (failure) {
          throw failure;
        }
        return rows;
      },
      async delete() {
        throw new Error('delete must not be used');
      },
    },
  };
}

describe('ListWarehouses', () => {
  it('returns a cache hit without reading the repository', async () => {
    const cache = new RecordingCache();
    const list = {
      items: [
        {
          warehouseId: FIRST_ID,
          name: 'Main',
          createdAt: '2026-02-01T00:00:00.000Z',
          updatedAt: '2026-02-01T00:00:00.000Z',
        },
      ],
      total: 1,
    };
    cache.values.set(WAREHOUSE_LIST_CACHE_KEY, { ttlMs: WAREHOUSE_LIST_TTL_MS, value: list });
    const source = repository([]);

    await expect(new ListWarehouses(source.maps, cache).execute()).resolves.toEqual(list);
    expect(source.calls).toBe(0);
  });

  it('rejects a cached list whose total does not match its items', async () => {
    const cache = new RecordingCache();
    cache.values.set(WAREHOUSE_LIST_CACHE_KEY, {
      ttlMs: 1,
      value: { items: [], total: 1 },
    });
    const row: StoredWarehouse = {
      id: FIRST_ID,
      name: 'Main',
      createdAt: null,
      updatedAt: null,
    };
    const source = repository([row]);

    const result = await new ListWarehouses(source.maps, cache).execute();

    expect(source.calls).toBe(1);
    expect(result).toEqual({
      items: [{ warehouseId: FIRST_ID, name: 'Main', createdAt: null, updatedAt: null }],
      total: 1,
    });
  });

  it('caches an empty list and a list that contains a legacy null date', async () => {
    const emptyCache = new RecordingCache();
    const empty = repository([]);
    await expect(new ListWarehouses(empty.maps, emptyCache).execute()).resolves.toEqual({
      items: [],
      total: 0,
    });
    expect(emptyCache.values.get(WAREHOUSE_LIST_CACHE_KEY)?.ttlMs).toBe(WAREHOUSE_LIST_TTL_MS);

    const legacyCache = new RecordingCache();
    const rows: StoredWarehouse[] = [
      {
        id: FIRST_ID,
        name: 'New',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-02T00:00:00.000Z'),
      },
      { id: SECOND_ID, name: 'Old', createdAt: null, updatedAt: null },
    ];
    const legacy = repository(rows);

    const result = await new ListWarehouses(legacy.maps, legacyCache).execute();

    expect(result.total).toBe(2);
    expect(result.items).toEqual([
      {
        warehouseId: FIRST_ID,
        name: 'New',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-02T00:00:00.000Z',
      },
      { warehouseId: SECOND_ID, name: 'Old', createdAt: null, updatedAt: null },
    ]);
    expect(legacyCache.values.get(WAREHOUSE_LIST_CACHE_KEY)?.value).toEqual(result);
  });

  it('returns the database list when cache get or set fails', async () => {
    const rows: StoredWarehouse[] = [
      { id: FIRST_ID, name: 'Main', createdAt: null, updatedAt: null },
    ];
    const getFailed = new RecordingCache();
    getFailed.getError = new CacheError('unavailable');
    await expect(
      new ListWarehouses(repository(rows).maps, getFailed).execute(),
    ).resolves.toMatchObject({
      total: 1,
    });

    const setFailed = new RecordingCache();
    setFailed.setError = new CacheError('command_failed');
    await expect(
      new ListWarehouses(repository(rows).maps, setFailed).execute(),
    ).resolves.toMatchObject({
      total: 1,
    });
  });

  it('does not hide a repository failure', async () => {
    const failure = new Error('database unavailable');
    await expect(
      new ListWarehouses(repository([], failure).maps, new RecordingCache()).execute(),
    ).rejects.toBe(failure);
  });
});
