import { CacheError } from '../../../cache/application/errors/cache.error';
import type { CachePort } from '../../../cache/application/ports/cache.port';
import type { LoggerPort } from '../ports/system/logger.port';
import {
  WAREHOUSE_LIST_CACHE_KEY,
  warehouseDetailsCacheKey,
} from '../queries/warehouse-cache.policy';

/**
 * Deletes cache keys after a committed warehouse change.
 * One failed delete does not stop the next. `CacheError` does not change the command result.
 * A successful delete does not mean the next read already sees the new row.
 */
export async function invalidateWarehouseCache(
  cache: CachePort,
  logger: LoggerPort,
  warehouseIds: readonly string[],
): Promise<void> {
  const keys = [
    ...warehouseIds.map((warehouseId) => warehouseDetailsCacheKey(warehouseId)),
    WAREHOUSE_LIST_CACHE_KEY,
  ];
  for (const key of keys) {
    try {
      await cache.delete(key);
    } catch (error) {
      if (!(error instanceof CacheError)) {
        throw error;
      }
      logger.warn('warehouse.cache.invalidate_failed', {
        errorClass: error.name,
        kind: error.kind,
      });
    }
  }
}
