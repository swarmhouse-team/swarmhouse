import { Inject, Module, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import type { Env } from '../config/env';
import { CachePort } from './application/ports/cache.port';
import { MemoryCache } from './infrastructure/memory/memory-cache';
import { RedisCache } from './infrastructure/redis/redis-cache';

/**
 * Selects one cache adapter. `memory` does not open Redis.
 * `redis` does not construct a memory cache. The module is not global.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: CachePort,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): CachePort => createCache(config),
    },
  ],
  exports: [CachePort],
})
export class CacheModule implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(CachePort) private readonly cache: CachePort) {}

  async onModuleInit(): Promise<void> {
    if (this.cache instanceof RedisCache) {
      await this.cache.start();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.cache instanceof RedisCache) {
      await this.cache.stop();
      return;
    }
    if (this.cache instanceof MemoryCache) {
      this.cache.clear();
    }
  }
}

function createCache(config: ConfigService<Env, true>): CachePort {
  const driver = config.get('CACHE_DRIVER', { infer: true });
  if (driver === 'memory') {
    const maxEntries = config.get('CACHE_MEMORY_MAX_ENTRIES', { infer: true });
    if (maxEntries === undefined) {
      throw new Error('CACHE_MEMORY_MAX_ENTRIES is required');
    }
    return new MemoryCache({ maxEntries });
  }
  const url = config.get('REDIS_URL', { infer: true });
  const keyPrefix = config.get('CACHE_KEY_PREFIX', { infer: true });
  if (url === undefined || keyPrefix === undefined) {
    throw new Error('Redis cache configuration is incomplete');
  }
  return RedisCache.open(url, keyPrefix);
}
