import type { CacheValue } from '../../application/cache-value';
import { assertCacheKey, assertCacheTtl, CachePort } from '../../application/ports/cache.port';
import { copyCacheValue } from '../codec/cache-codec';

interface MemoryCacheEntry {
  value: CacheValue;
  expiresAt: number;
}

export interface MemoryCacheOptions {
  maxEntries: number;
  now?: () => number;
}

/**
 * Process-local cache. Expired entries are removed on read.
 * Order is the order of successful writes: a new or replaced key becomes the newest.
 * A read does not change that order. There are no timers.
 */
export class MemoryCache extends CachePort {
  private readonly entries = new Map<string, MemoryCacheEntry>();
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: MemoryCacheOptions) {
    super();
    if (!Number.isSafeInteger(options.maxEntries) || options.maxEntries <= 0) {
      throw new Error('Memory cache maxEntries is invalid');
    }
    this.maxEntries = options.maxEntries;
    this.now = options.now ?? Date.now;
  }

  async get(key: string): Promise<CacheValue | null> {
    assertCacheKey(key);
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return null;
    }
    return copyCacheValue(entry.value);
  }

  async set(key: string, value: CacheValue, ttlMs: number): Promise<void> {
    assertCacheKey(key);
    assertCacheTtl(ttlMs);
    const stored = copyCacheValue(value);
    const expiresAt = this.now() + ttlMs;
    this.entries.delete(key);
    this.entries.set(key, { value: stored, expiresAt });
    this.evict();
  }

  async delete(key: string): Promise<void> {
    assertCacheKey(key);
    this.entries.delete(key);
  }

  /** Drops every entry. Safe to call when the process no longer needs the cache. */
  clear(): void {
    this.entries.clear();
  }

  private evict(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) {
        return;
      }
      this.entries.delete(oldest);
    }
  }
}
