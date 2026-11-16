import { afterEach, describe, expect, it, vi } from 'vitest';

import { CacheError } from '../../application/errors/cache.error';
import { runCacheContract } from '../../testing/run-cache-contract';
import { RedisCache, type RedisCacheClient } from './redis-cache';

class FakeRedis implements RedisCacheClient {
  readonly store = new Map<string, string>();
  readonly gets: string[] = [];
  readonly sets: { key: string; value: string; mode: 'PX'; ttlMs: number }[] = [];
  readonly deletes: string[] = [];
  getError: unknown;
  setError: unknown;
  deleteError: unknown;
  connectError: unknown;
  readonly quit = vi.fn(() => Promise.resolve());
  readonly disconnect = vi.fn();
  readonly listeners: ((error: Error) => void)[] = [];

  get(key: string): Promise<string | null> {
    this.gets.push(key);
    if (this.getError !== undefined) {
      return Promise.reject(toError(this.getError));
    }
    return Promise.resolve(this.store.get(key) ?? null);
  }

  set(key: string, value: string, mode: 'PX', ttlMs: number): Promise<unknown> {
    this.sets.push({ key, value, mode, ttlMs });
    if (this.setError !== undefined) {
      return Promise.reject(toError(this.setError));
    }
    this.store.set(key, value);
    return Promise.resolve('OK');
  }

  del(key: string): Promise<number> {
    this.deletes.push(key);
    if (this.deleteError !== undefined) {
      return Promise.reject(toError(this.deleteError));
    }
    const removed = this.store.delete(key);
    return Promise.resolve(removed ? 1 : 0);
  }

  connect(): Promise<void> {
    if (this.connectError !== undefined) {
      return Promise.reject(toError(this.connectError));
    }
    return Promise.resolve();
  }

  on(_event: 'error', listener: (error: Error) => void): void {
    this.listeners.push(listener);
  }

  off(_event: 'error', listener: (error: Error) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error('cache client failed');
}

describe('RedisCache', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  runCacheContract(() => new RedisCache('robots:', new FakeRedis()));

  it('stores a namespaced value with one SET PX command', async () => {
    const client = new FakeRedis();
    const cache = new RedisCache('robots:', client);

    await cache.set('dock', { name: 'dock', empty: null }, 1_500);

    expect(client.sets).toEqual([
      { key: 'robots:dock', value: '{"name":"dock","empty":null}', mode: 'PX', ttlMs: 1_500 },
    ]);
    await expect(cache.get('dock')).resolves.toEqual({ name: 'dock', empty: null });
    expect(client.gets).toEqual(['robots:dock']);
  });

  it('returns null for a missing key and rejects a corrupt payload', async () => {
    const client = new FakeRedis();
    const cache = new RedisCache('robots:', client);

    await expect(cache.get('missing')).resolves.toBeNull();

    client.store.set('robots:secret', 'secret-token-not-json');
    await expect(cache.get('secret')).rejects.toMatchObject({
      kind: 'corrupt',
      message: 'Cache value is corrupt',
    });

    client.store.set('robots:root', 'null');
    await expect(cache.get('root')).rejects.toMatchObject({ kind: 'corrupt' });
  });

  it('validates the key, ttl, and value before calling the client', async () => {
    const client = new FakeRedis();
    const cache = new RedisCache('robots:', client);
    await cache.set('dock', 'one', 1_000);

    await expect(cache.set('', 'next', 1_000)).rejects.toMatchObject({ kind: 'invalid_key' });
    await expect(cache.set('dock', 'next', 0)).rejects.toMatchObject({ kind: 'invalid_ttl' });
    await expect(cache.set('dock', Number.NaN, 1_000)).rejects.toMatchObject({
      kind: 'invalid_value',
    });

    expect(client.sets).toHaveLength(1);
    await expect(cache.get('dock')).resolves.toBe('one');
  });

  it('does not treat a failed delete as successful invalidation', async () => {
    const client = new FakeRedis();
    const cache = new RedisCache('robots:', client);
    await cache.set('dock', 'one', 1_000);
    client.deleteError = replyError('WRONGTYPE secret-payload');

    await expect(cache.delete('dock')).rejects.toMatchObject({
      kind: 'command_failed',
      message: 'Cache command failed',
    });
    await expect(cache.get('dock')).resolves.toBe('one');
    expect(client.deletes).toEqual(['robots:dock']);
  });

  it('maps a timeout to unavailable and does not delete or restore the key', async () => {
    const client = new FakeRedis();
    const cache = new RedisCache('robots:', client);
    await cache.set('dock', 'one', 1_000);
    client.setError = new Error('Command timed out');

    const error = await cache.set('dock', 'two', 1_000).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ kind: 'unavailable', message: 'Cache is unavailable' });
    expect(client.deletes).toEqual([]);
    expect(client.store.get('robots:dock')).toBe('"one"');
  });

  it('maps a closed connection to unavailable and a network code without copying the address', async () => {
    const client = new FakeRedis();
    const cache = new RedisCache('robots:', client);
    client.getError = new Error('Connection is closed.');

    await expect(cache.get('dock')).rejects.toMatchObject({
      kind: 'unavailable',
      message: 'Cache is unavailable',
    });

    const refused = new Error('connect ECONNREFUSED 10.0.0.8:6379');
    Object.assign(refused, { code: 'ECONNREFUSED' });
    client.getError = refused;
    const error = await cache.get('dock').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CacheError);
    if (error instanceof CacheError) {
      expect(error.kind).toBe('unavailable');
      expect(error.message).not.toContain('10.0.0.8');
    }
  });

  it('closes the client when startup fails and does not log the client error', async () => {
    const client = new FakeRedis();
    const cache = new RedisCache('robots:', client);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    client.connectError = new Error('redis://user:secret@cache:6379');
    const listener = client.listeners[0];
    expect(listener).toBeTypeOf('function');
    listener?.(new Error('redis://user:secret@cache:6379'));

    await expect(cache.start()).rejects.toMatchObject({
      kind: 'unavailable',
      message: 'Cache is unavailable',
    });

    expect(client.disconnect).toHaveBeenCalledOnce();
    expect(client.listeners).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('disconnects when quit does not finish within one second', async () => {
    vi.useFakeTimers();
    const client = new FakeRedis();
    client.quit.mockImplementation(() => new Promise<void>(() => undefined));
    const cache = new RedisCache('robots:', client);

    const stopped = cache.stop();
    await vi.advanceTimersByTimeAsync(1_000);
    await stopped;

    expect(client.disconnect).toHaveBeenCalledOnce();
    expect(client.listeners).toEqual([]);
  });

  it('does not disconnect after quit finishes', async () => {
    const client = new FakeRedis();
    const cache = new RedisCache('robots:', client);

    await cache.stop();

    expect(client.quit).toHaveBeenCalledOnce();
    expect(client.disconnect).not.toHaveBeenCalled();
  });
});

class ReplyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplyError';
  }
}

function replyError(message: string): ReplyError {
  return new ReplyError(message);
}
