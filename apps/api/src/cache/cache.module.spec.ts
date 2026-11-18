import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { RedisOptions } from 'ioredis';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { validateEnv } from '../config/env';
import { CacheError } from './application/errors/cache.error';
import { CachePort } from './application/ports/cache.port';
import { CacheModule } from './cache.module';
import { MemoryCache } from './infrastructure/memory/memory-cache';
import { RedisCache } from './infrastructure/redis/redis-cache';

interface CreatedRedis {
  url: string;
  options: RedisOptions;
  connect: ReturnType<typeof vi.fn<() => Promise<void>>>;
  quit: ReturnType<typeof vi.fn<() => Promise<string>>>;
  disconnect: ReturnType<typeof vi.fn<() => void>>;
}

const created = vi.hoisted(() => ({
  clients: [] as CreatedRedis[],
}));

vi.mock('ioredis', () => {
  class Redis {
    readonly connect = vi.fn(() => Promise.resolve());
    readonly quit = vi.fn(() => Promise.resolve('OK'));
    readonly disconnect = vi.fn();

    constructor(
      readonly url: string,
      readonly options: RedisOptions,
    ) {
      created.clients.push(this);
    }

    on(): this {
      return this;
    }

    off(): this {
      return this;
    }

    get(): Promise<null> {
      return Promise.resolve(null);
    }

    set(): Promise<string> {
      return Promise.resolve('OK');
    }

    del(): Promise<number> {
      return Promise.resolve(0);
    }
  }

  return { default: Redis };
});

describe('CacheModule', () => {
  afterEach(() => {
    created.clients.length = 0;
  });

  it('creates only MemoryCache when CACHE_DRIVER is memory', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        testingConfig({
          CACHE_DRIVER: 'memory',
          CACHE_MEMORY_MAX_ENTRIES: '2',
          REDIS_URL: 'redis://user:secret@cache:6379/0',
        }),
        CacheModule,
      ],
    }).compile();

    expect(moduleRef.get(CachePort)).toBeInstanceOf(MemoryCache);
    expect(created.clients).toEqual([]);

    const cache = moduleRef.get(CachePort);
    await cache.set('dock', 'one', 1_000);
    await moduleRef.close();
    await expect(cache.get('dock')).resolves.toBeNull();
  });

  it('creates only RedisCache when CACHE_DRIVER is redis', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        testingConfig({
          CACHE_DRIVER: 'redis',
          REDIS_URL: 'redis://localhost:6379/0',
          CACHE_KEY_PREFIX: 'robots:',
        }),
        CacheModule,
      ],
    }).compile();
    await moduleRef.init();

    expect(moduleRef.get(CachePort)).toBeInstanceOf(RedisCache);
    expect(moduleRef.get(CachePort)).not.toBeInstanceOf(MemoryCache);
    expect(created.clients).toHaveLength(1);
    const client = created.clients[0];
    expect(client?.url).toBe('redis://localhost:6379/0');
    expect(client?.options).toMatchObject({
      lazyConnect: true,
      connectTimeout: 2_000,
      commandTimeout: 1_000,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      autoResendUnfulfilledCommands: false,
      reconnectOnError: null,
    });
    expect(client?.options.retryStrategy?.(1)).toBe(200);
    expect(client?.options.retryStrategy?.(3)).toBe(200);
    expect(client?.options.retryStrategy?.(4)).toBeNull();
    expect(client?.connect).toHaveBeenCalledOnce();

    await moduleRef.close();
    expect(client?.quit).toHaveBeenCalledOnce();
    expect(client?.disconnect).not.toHaveBeenCalled();
  });

  it('fails redis startup without replacing the driver with memory', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        testingConfig({
          CACHE_DRIVER: 'redis',
          REDIS_URL: 'redis://user:secret@cache:6379/0',
          CACHE_KEY_PREFIX: 'robots:',
        }),
        CacheModule,
      ],
    }).compile();
    created.clients[0]?.connect.mockRejectedValueOnce(
      new Error('getaddrinfo ENOTFOUND cache secret'),
    );

    const error = await moduleRef.init().then(
      () => undefined,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(CacheError);
    if (error instanceof CacheError) {
      expect(error.kind).toBe('unavailable');
      expect(error.message).toBe('Cache is unavailable');
      expect(error.message).not.toContain('secret');
    }

    expect(moduleRef.get(CachePort)).toBeInstanceOf(RedisCache);
    expect(created.clients[0]?.disconnect).toHaveBeenCalledOnce();
    await moduleRef.close().catch((caught: unknown) => {
      expect(caught).toBe(error);
    });
  });
});

function testingConfig(values: Record<string, string>) {
  return ConfigModule.forRoot({
    ignoreEnvFile: true,
    validate: () =>
      validateEnv({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://localhost:5432/robots',
        ...values,
      }),
  });
}
