import { afterEach, describe, expect, it, vi } from 'vitest';

import { CacheError } from '../../application/errors/cache.error';
import { runCacheContract } from '../../testing/run-cache-contract';
import { MemoryCache } from './memory-cache';

describe('MemoryCache', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  runCacheContract(() => new MemoryCache({ maxEntries: 10, now: () => 0 }));

  it('does not return an expired entry', async () => {
    let now = 0;
    const cache = new MemoryCache({ maxEntries: 10, now: () => now });
    await cache.set('dock', 'one', 1_000);

    now = 1_000;

    await expect(cache.get('dock')).resolves.toBeNull();
  });

  it('keeps the previous TTL when a later set is rejected locally', async () => {
    let now = 0;
    const cache = new MemoryCache({ maxEntries: 10, now: () => now });
    await cache.set('dock', 'one', 1_000);
    now = 500;

    await expect(cache.set('dock', null as unknown as 'one', 1_000)).rejects.toBeInstanceOf(
      CacheError,
    );

    now = 999;
    await expect(cache.get('dock')).resolves.toBe('one');
    now = 1_000;
    await expect(cache.get('dock')).resolves.toBeNull();
  });

  it('evicts the least recently written key and a read does not refresh it', async () => {
    const cache = new MemoryCache({ maxEntries: 2, now: () => 0 });
    await cache.set('a', 'a', 1_000);
    await cache.set('b', 'b', 1_000);
    await cache.get('a');
    await cache.set('c', 'c', 1_000);

    await expect(cache.get('a')).resolves.toBeNull();
    await expect(cache.get('b')).resolves.toBe('b');
    await expect(cache.get('c')).resolves.toBe('c');
  });

  it('makes a replaced key the newest entry', async () => {
    const cache = new MemoryCache({ maxEntries: 2, now: () => 0 });
    await cache.set('a', 'a', 1_000);
    await cache.set('b', 'b', 1_000);
    await cache.set('a', 'a2', 1_000);
    await cache.set('c', 'c', 1_000);

    await expect(cache.get('b')).resolves.toBeNull();
    await expect(cache.get('a')).resolves.toBe('a2');
    await expect(cache.get('c')).resolves.toBe('c');
  });

  it('does not schedule timers and drops entries on clear', async () => {
    const timeout = vi.spyOn(globalThis, 'setTimeout');
    const cache = new MemoryCache({ maxEntries: 10, now: () => 0 });

    await cache.set('dock', { name: 'dock' }, 1_000);
    await cache.get('dock');
    cache.clear();

    expect(timeout).not.toHaveBeenCalled();
    await expect(cache.get('dock')).resolves.toBeNull();
  });
});
