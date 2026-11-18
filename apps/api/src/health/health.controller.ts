import { Controller, Get, Inject, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { healthResponseSchema, type HealthResponse } from '@robots/shared';
import type { Redis } from 'ioredis';
import { createZodDto } from 'nestjs-zod';

import { Public } from '../common/auth/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.constants';

class HealthResponseDto extends createZodDto(healthResponseSchema) {}

/**
 * Пока Redis недоступен, ioredis держит команды в офлайн-очереди и долго переподключается:
 * без таймаута health-check висел бы вместо быстрого 503.
 */
const REDIS_PING_TIMEOUT_MS = 1000;

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  @ApiOkResponse({ type: HealthResponseDto })
  @ApiServiceUnavailableResponse({ description: 'База данных или Redis недоступны' })
  async check(): Promise<HealthResponse> {
    const [db, redis] = await Promise.all([
      this.probe('БД', () => this.prisma.$queryRaw`SELECT 1`),
      this.probe('Redis', () => withTimeout(this.redis.ping(), REDIS_PING_TIMEOUT_MS)),
    ]);

    const unavailable = [!db && 'database', !redis && 'redis'].filter(Boolean);
    if (unavailable.length > 0) {
      throw new ServiceUnavailableException(`Unavailable: ${unavailable.join(', ')}`);
    }

    return { status: 'ok', db: 'up', redis: 'up' };
  }

  private async probe(name: string, check: () => Promise<unknown>): Promise<boolean> {
    try {
      await check();
      return true;
    } catch (error) {
      this.logger.error(`Проверка ${name} не прошла`, error instanceof Error ? error.stack : error);
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
