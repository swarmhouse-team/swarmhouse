import { warehouseDetailsSchema, type WarehouseDetails } from '@robots/shared';

import type { CachePort } from '../../../../../cache/application/ports/cache.port';
import { readWarehouseCache, writeWarehouseCache } from '../../cache/read-warehouse-cache';
import { WarehouseNotFoundError } from '../../errors/application.errors';
import type { WarehouseRepository } from '../../ports/repositories/warehouse.repository';
import { normalizeId } from '../../../domain/vo/id';
import { toWarehouseDetails } from '../warehouse-details';
import { WAREHOUSE_DETAILS_TTL_MS, warehouseDetailsCacheKey } from '../warehouse-cache.policy';

/**
 * Reads one warehouse's public metadata.
 * A cache hit can be stale until the entry expires: a read that loses the race with
 * invalidation may store the previous payload again. The memory cache is local to this process.
 * Map content is not read.
 */
export class GetWarehouse {
  constructor(
    private readonly warehouses: WarehouseRepository,
    private readonly cache: CachePort,
  ) {}

  async execute(input: { warehouseId: string }): Promise<WarehouseDetails> {
    const warehouseId = normalizeId(input.warehouseId);
    const key = warehouseDetailsCacheKey(warehouseId);
    const cached = await readWarehouseCache(this.cache, key, warehouseDetailsSchema, (details) => {
      return details.warehouseId === warehouseId;
    });
    if (cached) {
      return cached;
    }

    const record = await this.warehouses.findById(warehouseId);
    if (!record) {
      throw new WarehouseNotFoundError({ warehouseId });
    }
    const details = toWarehouseDetails(record);
    await writeWarehouseCache(this.cache, key, details, WAREHOUSE_DETAILS_TTL_MS);
    return details;
  }
}
