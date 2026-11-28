import { listWarehousesResponseSchema, type ListWarehousesResponse } from '@robots/shared';

import type { CachePort } from '../../../../../cache/application/ports/cache.port';
import type { Transaction } from '../../../../../common/application/transaction';
import { readCache, writeCache } from '../../../../../common/application/read-cache';
import type { WarehouseRepository } from '../../ports/repositories/warehouse.repository';
import { parseWarehouseList, toWarehouseDetails } from '../warehouse-details';
import { WAREHOUSE_LIST_CACHE_KEY, WAREHOUSE_LIST_TTL_MS } from '../warehouse-cache.policy';

/**
 * Reads every warehouse's public metadata. This is not a per-user list.
 * A cache hit can be stale until the entry expires. The memory cache is local to this process.
 * Map content is not read. There is no pagination.
 */
export class ListWarehouses {
  constructor(
    private readonly transaction: Pick<Transaction, 'isActive'>,
    private readonly warehouses: WarehouseRepository,
    private readonly cache: CachePort,
  ) {}

  async execute(): Promise<ListWarehousesResponse> {
    if (this.transaction.isActive) return this.load();

    const cached = await readCache(
      this.cache,
      WAREHOUSE_LIST_CACHE_KEY,
      listWarehousesResponseSchema,
      (list) => list.total === list.items.length,
    );
    if (cached) {
      return cached;
    }

    const list = await this.load();
    await writeCache(this.cache, WAREHOUSE_LIST_CACHE_KEY, list, WAREHOUSE_LIST_TTL_MS);
    return list;
  }

  private async load(): Promise<ListWarehousesResponse> {
    const records = await this.warehouses.list();
    const list = {
      items: records.map((record) => toWarehouseDetails(record)),
      total: records.length,
    };
    return parseWarehouseList(list);
  }
}
