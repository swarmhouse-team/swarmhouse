import { listWarehousesResponseSchema, type ListWarehousesResponse } from '@robots/shared';

import type { CachePort } from '../../../../cache/application/ports/cache.port';
import { readWarehouseCache, writeWarehouseCache } from '../../cache/read-warehouse-cache';
import type { WarehouseRepository } from '../../ports/repositories/warehouse.repository';
import { toWarehouseDetails, warehouseListCacheValue } from '../warehouse-details';
import { WAREHOUSE_LIST_CACHE_KEY, WAREHOUSE_LIST_TTL_MS } from '../warehouse-cache.policy';

/**
 * Reads every warehouse's public metadata. This is not a per-user list.
 * A cache hit can be stale until the entry expires. The memory cache is local to this process.
 * Map content is not read. There is no pagination.
 */
export class ListWarehouses {
  constructor(
    private readonly warehouses: WarehouseRepository,
    private readonly cache: CachePort,
  ) {}

  async execute(): Promise<ListWarehousesResponse> {
    const cached = await readWarehouseCache(
      this.cache,
      WAREHOUSE_LIST_CACHE_KEY,
      listWarehousesResponseSchema,
      (list) => list.total === list.items.length,
    );
    if (cached) {
      return cached;
    }

    const records = await this.warehouses.list();
    const list = {
      items: records.map((record) => toWarehouseDetails(record)),
      total: records.length,
    };
    const parsed = listWarehousesResponseSchema.safeParse(list);
    if (!parsed.success) {
      throw new Error('Warehouse list mapping is invalid');
    }
    await writeWarehouseCache(
      this.cache,
      WAREHOUSE_LIST_CACHE_KEY,
      warehouseListCacheValue(parsed.data),
      WAREHOUSE_LIST_TTL_MS,
    );
    return parsed.data;
  }
}
