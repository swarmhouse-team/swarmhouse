import { describe, expect, it } from 'vitest';

import { WarehouseMap, type WarehouseMapSnapshot } from '../../../domain/entities/warehouse-map';
import { CorruptedMapStateError, WarehouseMapNotFoundError } from '../../errors/application.errors';
import type { WarehouseMapRepository } from '../../ports/repositories/warehouse-map.repository';
import { stubMaps } from '../../testing/stub-warehouse-unit-of-work';
import { GetWarehouseMap } from './get-warehouse-map.use-case';

const WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';
const MAP_ID = '22222222-2222-7111-8111-22222222222b';

function snapshot(): WarehouseMapSnapshot {
  return WarehouseMap.create(MAP_ID, WAREHOUSE_ID).snapshot();
}

function repository(
  found: { snapshot: WarehouseMapSnapshot; version: number } | null,
  failure?: Error,
): { maps: WarehouseMapRepository; calls: string[] } {
  const calls: string[] = [];
  const maps: WarehouseMapRepository = stubMaps({
    async insert() {
      calls.push('insert');
    },
    async findById(mapId) {
      calls.push(`findById:${mapId}`);
      if (failure) {
        throw failure;
      }
      return found;
    },
    async findByWarehouseId(warehouseId) {
      calls.push(`findByWarehouseId:${warehouseId}`);
      if (failure) {
        throw failure;
      }
      return found;
    },
    async save() {
      calls.push('save');
      return { status: 'not_found' };
    },
  });
  return { maps, calls };
}

describe('GetWarehouseMap', () => {
  it('loads by map id and returns the restored snapshot with the stored version', async () => {
    const stored = snapshot();
    const { maps, calls } = repository({ snapshot: stored, version: 4 });

    const result = await new GetWarehouseMap(maps).execute({ mapId: MAP_ID });

    expect(calls).toEqual([`findById:${MAP_ID}`]);
    expect(result).toEqual({ snapshot: stored, version: 4 });
  });

  it('loads by warehouse id without using the map id lookup', async () => {
    const stored = snapshot();
    const { maps, calls } = repository({ snapshot: stored, version: 1 });

    const result = await new GetWarehouseMap(maps).execute({ warehouseId: WAREHOUSE_ID });

    expect(calls).toEqual([`findByWarehouseId:${WAREHOUSE_ID}`]);
    expect(result.version).toBe(1);
    expect(result.snapshot.warehouseId).toBe(WAREHOUSE_ID);
  });

  it('reports a missing map by the lookup key that was used', async () => {
    const byMap = repository(null);
    await expect(new GetWarehouseMap(byMap.maps).execute({ mapId: 'missing' })).rejects.toEqual(
      expect.objectContaining({
        name: 'WarehouseMapNotFoundError',
        details: { mapId: 'missing' },
      }),
    );
    expect(byMap.calls).toEqual(['findById:missing']);

    const byWarehouse = repository(null);
    await expect(
      new GetWarehouseMap(byWarehouse.maps).execute({ warehouseId: 'missing' }),
    ).rejects.toBeInstanceOf(WarehouseMapNotFoundError);
    await expect(
      new GetWarehouseMap(byWarehouse.maps).execute({ warehouseId: 'missing' }),
    ).rejects.toMatchObject({ details: { warehouseId: 'missing' } });
  });

  it('propagates a corrupted snapshot and a repository failure unchanged', async () => {
    const stored = snapshot();
    stored.width = 10;
    const corrupted = repository({ snapshot: stored, version: 2 });

    await expect(
      new GetWarehouseMap(corrupted.maps).execute({ mapId: MAP_ID }),
    ).rejects.toBeInstanceOf(CorruptedMapStateError);
    expect(corrupted.calls).toEqual([`findById:${MAP_ID}`]);

    const failure = new Error('database unavailable');
    const broken = repository(null, failure);
    await expect(
      new GetWarehouseMap(broken.maps).execute({ warehouseId: WAREHOUSE_ID }),
    ).rejects.toBe(failure);
  });
});
