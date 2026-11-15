import { describe, expect, it } from 'vitest';

import { WarehouseMap, type WarehouseMapSnapshot } from '../../../domain/entities/warehouse-map';
import { CorruptedMapStateError, WarehouseMapNotFoundError } from '../../errors/application.errors';
import type { WarehouseMapRepository } from '../../ports/repositories/warehouse-map.repository';
import { GetWarehouseMap } from './get-warehouse-map.use-case';

function snapshot(): WarehouseMapSnapshot {
  return WarehouseMap.create('map-1', 'wh-1').snapshot();
}

function repository(
  found: { snapshot: WarehouseMapSnapshot; version: number } | null,
  failure?: Error,
): { maps: WarehouseMapRepository; calls: string[] } {
  const calls: string[] = [];
  const maps: WarehouseMapRepository = {
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
    async deleteByWarehouseId() {
      throw new Error('deleteByWarehouseId must not be used');
    },
  };
  return { maps, calls };
}

describe('GetWarehouseMap', () => {
  it('loads by map id and returns the restored snapshot with the stored version', async () => {
    const stored = snapshot();
    const { maps, calls } = repository({ snapshot: stored, version: 4 });

    const result = await new GetWarehouseMap(maps).execute({ mapId: 'map-1' });

    expect(calls).toEqual(['findById:map-1']);
    expect(result).toEqual({ snapshot: stored, version: 4 });
  });

  it('loads by warehouse id without using the map id lookup', async () => {
    const stored = snapshot();
    const { maps, calls } = repository({ snapshot: stored, version: 1 });

    const result = await new GetWarehouseMap(maps).execute({ warehouseId: 'wh-1' });

    expect(calls).toEqual(['findByWarehouseId:wh-1']);
    expect(result.version).toBe(1);
    expect(result.snapshot.warehouseId).toBe('wh-1');
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
      new GetWarehouseMap(corrupted.maps).execute({ mapId: 'map-1' }),
    ).rejects.toBeInstanceOf(CorruptedMapStateError);
    expect(corrupted.calls).toEqual(['findById:map-1']);

    const failure = new Error('database unavailable');
    const broken = repository(null, failure);
    await expect(new GetWarehouseMap(broken.maps).execute({ warehouseId: 'wh-1' })).rejects.toBe(
      failure,
    );
  });
});
