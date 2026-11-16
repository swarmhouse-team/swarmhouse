import { describe, expect, it } from 'vitest';

import { validateEnv } from './env';

const BASE = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://localhost:5432/robots',
};

describe('validateEnv cache', () => {
  it('requires an explicit memory limit and ignores a redis url', () => {
    expect(
      validateEnv({ ...BASE, CACHE_DRIVER: 'memory', CACHE_MEMORY_MAX_ENTRIES: '25' }),
    ).toEqual(expect.objectContaining({ CACHE_DRIVER: 'memory', CACHE_MEMORY_MAX_ENTRIES: 25 }));

    const secret = 'redis://user:super-secret@cache:6379/0';
    const parsed = validateEnv({
      ...BASE,
      CACHE_DRIVER: 'memory',
      CACHE_MEMORY_MAX_ENTRIES: '25',
      REDIS_URL: secret,
    });
    expect(parsed.CACHE_DRIVER).toBe('memory');
    expect(parsed.REDIS_URL).toBeUndefined();
  });

  it('requires a redis url and prefix only for the redis driver', () => {
    expect(
      validateEnv({
        ...BASE,
        CACHE_DRIVER: 'redis',
        REDIS_URL: 'rediss://cache.internal:6380/1',
        CACHE_KEY_PREFIX: 'robots:',
        CACHE_MEMORY_MAX_ENTRIES: 'nope',
      }),
    ).toEqual(
      expect.objectContaining({
        CACHE_DRIVER: 'redis',
        REDIS_URL: 'rediss://cache.internal:6380/1',
        CACHE_KEY_PREFIX: 'robots:',
      }),
    );
  });

  it('rejects invalid cache settings without printing the redis url', () => {
    const secret = 'http://user:super-secret@cache:6379/0';

    expect(() => validateEnv({ ...BASE, CACHE_DRIVER: 'memory' })).toThrow(
      'CACHE_MEMORY_MAX_ENTRIES is required',
    );
    expect(() =>
      validateEnv({ ...BASE, CACHE_DRIVER: 'memory', CACHE_MEMORY_MAX_ENTRIES: '0' }),
    ).toThrow('CACHE_MEMORY_MAX_ENTRIES is invalid');
    expect(() =>
      validateEnv({ ...BASE, CACHE_DRIVER: 'redis', CACHE_KEY_PREFIX: 'robots:' }),
    ).toThrow('REDIS_URL is required');

    const invalidUrl = () =>
      validateEnv({
        ...BASE,
        CACHE_DRIVER: 'redis',
        REDIS_URL: secret,
        CACHE_KEY_PREFIX: 'robots:',
      });
    expect(invalidUrl).toThrow('REDIS_URL is invalid');
    expect(messageOf(invalidUrl)).not.toContain('super-secret');
    expect(messageOf(invalidUrl)).not.toContain(secret);

    expect(() =>
      validateEnv({
        ...BASE,
        CACHE_DRIVER: 'redis',
        REDIS_URL: 'redis://localhost:6379/0',
      }),
    ).toThrow('CACHE_KEY_PREFIX is required');
  });
});

function messageOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : '';
  }
  return '';
}
