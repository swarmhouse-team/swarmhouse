import type { CacheValue } from '../cache-value';
import { CacheError } from '../errors/cache.error';

/**
 * Process-local or shared cache.
 * A null `get` result is a miss or an expired entry, not a stored null.
 * Callers validate the shape of a returned value for their own use case.
 * This type does not depend on NestJS, Redis, or an infrastructure adapter.
 */
export abstract class CachePort {
  abstract get(key: string): Promise<CacheValue | null>;

  abstract set(key: string, value: CacheValue, ttlMs: number): Promise<void>;

  abstract delete(key: string): Promise<void>;
}

/** Rejects a key before a storage command is sent. */
export function assertCacheKey(key: string): void {
  if (typeof key !== 'string' || key.length === 0) {
    throw new CacheError('invalid_key');
  }
}

/** Rejects a TTL before a storage command is sent. The unit is milliseconds. */
export function assertCacheTtl(ttlMs: number): void {
  if (typeof ttlMs !== 'number' || !Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
    throw new CacheError('invalid_ttl');
  }
}
