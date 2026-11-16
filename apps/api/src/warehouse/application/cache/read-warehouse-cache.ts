import type { ZodType } from 'zod';

import { CacheError } from '../../../cache/application/errors/cache.error';
import type { CacheValue } from '../../../cache/application/cache-value';
import type { CachePort } from '../../../cache/application/ports/cache.port';

/**
 * Reads one cache entry. A `CacheError`, a missing key, or a payload that fails
 * `schema` is a miss. Any other error is rethrown.
 * A rejected payload is deleted. A `CacheError` from that delete is ignored.
 * Any other delete error is rethrown.
 */
export async function readWarehouseCache<T>(
  cache: CachePort,
  key: string,
  schema: ZodType<T>,
  accept: (value: T) => boolean,
): Promise<T | null> {
  let raw: CacheValue | null;
  try {
    raw = await cache.get(key);
  } catch (error) {
    if (error instanceof CacheError) {
      return null;
    }
    throw error;
  }
  if (raw === null) {
    return null;
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success || !accept(parsed.data)) {
    await forgetWarehouseCacheKey(cache, key);
    return null;
  }
  return parsed.data;
}

/** Writes a public payload. A `CacheError` is ignored. Any other error is rethrown. */
export async function writeWarehouseCache(
  cache: CachePort,
  key: string,
  value: CacheValue,
  ttlMs: number,
): Promise<void> {
  try {
    await cache.set(key, value, ttlMs);
  } catch (error) {
    if (error instanceof CacheError) {
      return;
    }
    throw error;
  }
}

async function forgetWarehouseCacheKey(cache: CachePort, key: string): Promise<void> {
  try {
    await cache.delete(key);
  } catch (error) {
    if (error instanceof CacheError) {
      return;
    }
    throw error;
  }
}
