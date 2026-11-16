import { CacheError } from '../../../cache/application/errors/cache.error';
import type { CachePort } from '../../../cache/application/ports/cache.port';
import type { LoggerPort } from '../ports/system/logger.port';
import {
  WAREHOUSE_LIST_CACHE_KEY,
  warehouseDetailsCacheKey,
} from '../queries/warehouse-cache.policy';

/**
 * Deletes cache keys after a committed warehouse change.
 * Each delete is isolated: a failure is logged and the next key is still attempted.
 * Neither a `CacheError` nor any other delete error changes the command result.
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
      if (error instanceof CacheError) {
        logger.warn('warehouse.cache.invalidate_failed', {
          errorClass: error.name,
          kind: error.kind,
        });
        continue;
      }
      logger.error('warehouse.cache.invalidate_failed', {
        errorClass: errorClass(error),
      });
    }
  }
}

function errorClass(error: unknown): string {
  return error instanceof Error && error.name.length > 0 ? error.name : 'UnknownError';
}
