import { describe, expect, it } from 'vitest';

import type { CacheValue } from '../application/cache-value';
import { CacheError } from '../application/errors/cache.error';
import type { CachePort } from '../application/ports/cache.port';

/** Shared contract checks. TTL expiry is not asserted here. */
export function runCacheContract(create: () => CachePort): void {
  describe('cache contract', () => {
    it('returns null for a missing key', async () => {
      const cache = create();

      await expect(cache.get('missing')).resolves.toBeNull();
    });

    it('returns an independent copy, including nested null', async () => {
      const cache = create();
      const value = { name: 'dock', empty: null, items: [1, null] };
      await cache.set('dock', value, 1_000);

      const first = await cache.get('dock');
      expect(first).toEqual(value);
      expect(first).not.toBe(value);
      if (isRecord(first) && isRecord(value)) {
        first.name = 'changed';
        value.name = 'changed-source';
      }

      await expect(cache.get('dock')).resolves.toEqual({
        name: 'dock',
        empty: null,
        items: [1, null],
      });
    });

    it('replaces the previous value', async () => {
      const cache = create();
      await cache.set('dock', 'one', 1_000);
      await cache.set('dock', 'two', 1_000);

      await expect(cache.get('dock')).resolves.toBe('two');
    });

    it('keeps the previous value when the next set is rejected locally', async () => {
      const cache = create();
      await cache.set('dock', { name: 'dock' }, 1_000);
      const cycle: { self?: unknown } = {};
      cycle.self = cycle;

      await expect(cache.set('dock', cycle as CacheValue, 1_000)).rejects.toMatchObject({
        kind: 'invalid_value',
      });
      await expect(cache.set('dock', null as unknown as CacheValue, 1_000)).rejects.toBeInstanceOf(
        CacheError,
      );
      await expect(cache.set('dock', { name: 'dock' }, 0)).rejects.toMatchObject({
        kind: 'invalid_ttl',
      });
      await expect(cache.set('', 'next', 1_000)).rejects.toMatchObject({ kind: 'invalid_key' });

      await expect(cache.get('dock')).resolves.toEqual({ name: 'dock' });
    });

    it('deletes a stored key and ignores a missing key', async () => {
      const cache = create();
      await cache.set('dock', 'one', 1_000);

      await cache.delete('dock');
      await cache.delete('missing');

      await expect(cache.get('dock')).resolves.toBeNull();
    });

    it('rejects an empty key before changing another entry', async () => {
      const cache = create();
      await cache.set('dock', 'one', 1_000);

      await expect(cache.get('')).rejects.toMatchObject({ kind: 'invalid_key' });
      await expect(cache.delete('')).rejects.toMatchObject({ kind: 'invalid_key' });
      await expect(cache.get('dock')).resolves.toBe('one');
    });
  });
}

function isRecord(value: unknown): value is { name: string } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
