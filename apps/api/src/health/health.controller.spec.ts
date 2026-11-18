import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const prisma = { $queryRaw: vi.fn() };
  const redis = { ping: vi.fn() };
  let controller: HealthController;

  beforeEach(async () => {
    vi.useRealTimers();
    prisma.$queryRaw.mockReset().mockResolvedValue([{ '?column?': 1 }]);
    redis.ping.mockReset().mockResolvedValue('PONG');

    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();
    moduleRef.useLogger(false);

    controller = moduleRef.get(HealthController);
  });

  it('все зависимости доступны — { status, db, redis }', async () => {
    await expect(controller.check()).resolves.toEqual({ status: 'ok', db: 'up', redis: 'up' });
    expect(redis.ping).toHaveBeenCalledOnce();
  });

  it('БД недоступна — 503', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(controller.check()).rejects.toThrow(
      new ServiceUnavailableException('Unavailable: database'),
    );
  });

  it('Redis недоступен — 503', async () => {
    redis.ping.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(controller.check()).rejects.toThrow(
      new ServiceUnavailableException('Unavailable: redis'),
    );
  });

  it('ping Redis повис — 503 по таймауту, а не бесконечное ожидание', async () => {
    vi.useFakeTimers();
    redis.ping.mockReturnValue(new Promise(() => {}));

    const result = controller.check();
    const assertion = expect(result).rejects.toThrow(ServiceUnavailableException);
    await vi.advanceTimersByTimeAsync(1000);

    await assertion;
  });
});
