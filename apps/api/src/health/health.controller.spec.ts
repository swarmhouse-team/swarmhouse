import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { RedisOptions } from 'ioredis';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CachePort } from '../cache/application/ports/cache.port';
import { CacheModule } from '../cache/cache.module';
import { MemoryCache } from '../cache/infrastructure/memory/memory-cache';
import { RedisCache, type RedisCacheClient } from '../cache/infrastructure/redis/redis-cache';
import { validateEnv } from '../config/env';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';
import { HealthModule } from './health.module';

interface CreatedRedis {
  ping: ReturnType<typeof vi.fn<() => Promise<string>>>;
  connect: ReturnType<typeof vi.fn<() => Promise<void>>>;
  quit: ReturnType<typeof vi.fn<() => Promise<string>>>;
  disconnect: ReturnType<typeof vi.fn<() => void>>;
  options: RedisOptions;
}

const created = vi.hoisted(() => ({
  clients: [] as CreatedRedis[],
}));

vi.mock('ioredis', () => {
  class Redis {
    readonly ping = vi.fn(() => Promise.resolve('PONG'));
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

class ProbeClient implements RedisCacheClient {
  readonly ping = vi.fn(() => Promise.resolve('PONG' as unknown));
  readonly connect = vi.fn(() => Promise.resolve());
  readonly quit = vi.fn(() => Promise.resolve());
  readonly disconnect = vi.fn();
  readonly get = vi.fn(() => Promise.resolve(null));
  readonly set = vi.fn(() => Promise.resolve('OK'));
  readonly del = vi.fn(() => Promise.resolve(0));

  on(): void {
    return undefined;
  }

  off(): void {
    return undefined;
  }
}

describe('HealthController', () => {
  afterEach(() => {
    vi.useRealTimers();
    created.clients.length = 0;
  });

  it('memory cache does not ping and omits redis', async () => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: CachePort, useValue: new MemoryCache({ maxEntries: 1 }) },
      ],
    }).compile();
    moduleRef.useLogger(false);

    await expect(moduleRef.get(HealthController).check()).resolves.toEqual({
      status: 'ok',
      db: 'up',
    });
    expect(created.clients).toEqual([]);
    await moduleRef.close();
  });

  it('pings the injected RedisCache and does not open or close it', async () => {
    const client = new ProbeClient();
    const cache = new RedisCache('robots:', client);
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: { $queryRaw: vi.fn().mockResolvedValue([1]) } },
        { provide: CachePort, useValue: cache },
      ],
    }).compile();
    moduleRef.useLogger(false);

    await expect(moduleRef.get(HealthController).check()).resolves.toEqual({
      status: 'ok',
      db: 'up',
      redis: 'up',
    });
    expect(client.ping).toHaveBeenCalledOnce();
    expect(client.connect).not.toHaveBeenCalled();
    expect(client.quit).not.toHaveBeenCalled();
    expect(client.disconnect).not.toHaveBeenCalled();
    expect(moduleRef.get(CachePort)).toBe(cache);
    await moduleRef.close();
  });

  it('returns 503 when the database probe fails', async () => {
    const moduleRef = await controllerWith(new RedisCache('robots:', new ProbeClient()), {
      $queryRaw: vi.fn().mockRejectedValue(new Error('redis://secret')),
    });

    await expect(moduleRef.get(HealthController).check()).rejects.toThrow(
      new ServiceUnavailableException('Unavailable: database'),
    );
    await moduleRef.close();
  });

  it('returns 503 when ping fails and does not include the address', async () => {
    const client = new ProbeClient();
    client.ping.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.8:6379'));
    const moduleRef = await controllerWith(new RedisCache('robots:', client));
    const errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const error = await moduleRef
      .get(HealthController)
      .check()
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error).toMatchObject({ message: 'Unavailable: redis' });
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('10.0.0.8');
    expect(client.disconnect).not.toHaveBeenCalled();
    errorLog.mockRestore();
    await moduleRef.close();
  });

  it('returns 503 when ping does not finish', async () => {
    vi.useFakeTimers();
    const client = new ProbeClient();
    client.ping.mockReturnValue(new Promise(() => undefined));
    const moduleRef = await controllerWith(new RedisCache('robots:', client));

    const result = moduleRef.get(HealthController).check();
    const assertion = expect(result).rejects.toThrow(
      new ServiceUnavailableException('Unavailable: redis'),
    );
    await vi.advanceTimersByTimeAsync(1000);

    await assertion;
    expect(client.disconnect).not.toHaveBeenCalled();
    await moduleRef.close();
  });

  it('uses the single cache client when the driver is redis', async () => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([1]) };
    const moduleRef = await Test.createTestingModule({
      imports: [
        testingConfig({
          CACHE_DRIVER: 'redis',
          REDIS_URL: 'redis://localhost:6379/0',
          CACHE_KEY_PREFIX: 'robots:',
        }),
        PrismaModule,
        HealthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    moduleRef.useLogger(false);
    await moduleRef.init();

    const cache = moduleRef.select(CacheModule).get(CachePort);
    const connects = created.clients[0]?.connect.mock.calls.length ?? 0;

    await expect(moduleRef.get(HealthController).check()).resolves.toEqual({
      status: 'ok',
      db: 'up',
      redis: 'up',
    });

    expect(cache).toBeInstanceOf(RedisCache);
    expect(created.clients).toHaveLength(1);
    expect(created.clients[0]?.ping).toHaveBeenCalledOnce();
    expect(created.clients[0]?.connect).toHaveBeenCalledTimes(connects);
    expect(created.clients[0]?.quit).not.toHaveBeenCalled();
    expect(created.clients[0]?.disconnect).not.toHaveBeenCalled();
    await moduleRef.close();
  });

  it('does not create a redis client when the driver is memory', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        testingConfig({
          CACHE_DRIVER: 'memory',
          CACHE_MEMORY_MAX_ENTRIES: '4',
        }),
        PrismaModule,
        HealthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: vi.fn().mockResolvedValue([1]) })
      .compile();
    moduleRef.useLogger(false);
    await moduleRef.init();

    await expect(moduleRef.get(HealthController).check()).resolves.toEqual({
      status: 'ok',
      db: 'up',
    });
    expect(moduleRef.select(CacheModule).get(CachePort)).toBeInstanceOf(MemoryCache);
    expect(created.clients).toEqual([]);
    await moduleRef.close();
  });
});

function controllerWith(
  cache: CachePort,
  prisma: { $queryRaw: ReturnType<typeof vi.fn> } = {
    $queryRaw: vi.fn().mockResolvedValue([1]),
  },
) {
  return Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      { provide: PrismaService, useValue: prisma },
      { provide: CachePort, useValue: cache },
    ],
  })
    .compile()
    .then((moduleRef) => {
      moduleRef.useLogger(false);
      return moduleRef;
    });
}

function testingConfig(values: Record<string, string>) {
  return ConfigModule.forRoot({
    isGlobal: true,
    ignoreEnvFile: true,
    validate: () =>
      validateEnv({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://localhost:5432/robots',
        ...values,
      }),
  });
}
