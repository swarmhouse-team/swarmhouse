import { Controller, Get, Inject, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { healthResponseSchema, type HealthResponse } from '@robots/shared';
import { createZodDto } from 'nestjs-zod';

import { CachePort } from '../cache/application/ports/cache.port';
import { RedisCache } from '../cache/infrastructure/redis/redis-cache';
import { Public } from '../common/auth/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

class HealthResponseDto extends createZodDto(healthResponseSchema) {}

/** PING не должен держать health дольше секунды. */
const REDIS_PING_TIMEOUT_MS = 1000;

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CachePort) private readonly cache: CachePort,
  ) {}

  @Public()
  @Public()
  @Get()
  @ApiOkResponse({ type: HealthResponseDto })
  @ApiServiceUnavailableResponse({ description: 'База данных или Redis недоступны' })
  async check(): Promise<HealthResponse> {
    const redisCache = this.cache instanceof RedisCache ? this.cache : undefined;
    const probes = [this.probe('БД', () => this.prisma.$queryRaw`SELECT 1`)];
    if (redisCache) {
      probes.push(this.probe('Redis', () => withTimeout(redisCache.ping(), REDIS_PING_TIMEOUT_MS)));
    }

    const [db, redis] = await Promise.all(probes);
    const unavailable = [!db && 'database', redis === false && 'redis'].filter(Boolean);
    if (unavailable.length > 0) {
      throw new ServiceUnavailableException(`Unavailable: ${unavailable.join(', ')}`);
    }

    if (redisCache) {
      return { status: 'ok', db: 'up', redis: 'up' };
    }
    return { status: 'ok', db: 'up' };
  }

  private async probe(name: string, check: () => Promise<unknown>): Promise<boolean> {
    try {
      await check();
      return true;
    } catch {
      this.logger.error(`Проверка ${name} не прошла`);
      return false;
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Таймаут ${ms} мс`)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
