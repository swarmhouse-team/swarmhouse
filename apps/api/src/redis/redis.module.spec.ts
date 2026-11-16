import { Inject, Injectable } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { REDIS_CLIENT, REDIS_FACTORY, type RedisFactory } from './redis.constants';
import { RedisModule } from './redis.module';

const REDIS_URL = 'redis://redis.test:6379';

const { FakeRedis, created } = vi.hoisted(() => {
  const created: InstanceType<typeof FakeRedis>[] = [];

  class FakeRedis {
    status = 'ready';
    readonly quit = vi.fn(async () => {
      this.status = 'end';
      return 'OK';
    });
    readonly disconnect = vi.fn(() => {
      this.status = 'end';
    });
    readonly on = vi.fn(() => this);

    constructor(
      readonly url: string,
      readonly options: { connectionName: string },
    ) {
      created.push(this);
    }
  }

  return { FakeRedis, created };
});

vi.mock('ioredis', () => ({ Redis: FakeRedis }));

/** Потребитель из другого модуля: получает токены через DI, не импортируя `RedisModule`. */
@Injectable()
class Consumer {
  constructor(
    @Inject(REDIS_CLIENT) readonly client: unknown,
    @Inject(REDIS_FACTORY) readonly factory: RedisFactory,
  ) {}
}

describe('RedisModule', () => {
  let moduleRef: TestingModule;

  beforeEach(async () => {
    created.length = 0;
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ REDIS_URL })],
        }),
        RedisModule,
      ],
      providers: [Consumer],
    }).compile();
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('REDIS_CLIENT — соединение api:main, созданное фабрикой', () => {
    const consumer = moduleRef.get(Consumer);

    expect(created).toHaveLength(1);
    expect(consumer.client).toBe(created[0]);
    expect(created[0]).toMatchObject({ url: REDIS_URL, options: { connectionName: 'api:main' } });
  });

  it('фабрика на каждый вызов создаёт новое соединение со своим connectionName', () => {
    const { factory } = moduleRef.get(Consumer);

    const queue = factory('api:bullmq');
    const subscriber = factory('api:sub');

    expect(queue).not.toBe(subscriber);
    expect(created).toHaveLength(3);
    expect(created.map((c) => c.options.connectionName)).toEqual([
      'api:main',
      'api:bullmq',
      'api:sub',
    ]);
  });

  it('пишет ошибки соединения в лог', () => {
    expect(created[0]?.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('при остановке закрывает все соединения, а не только REDIS_CLIENT', async () => {
    const { factory } = moduleRef.get(Consumer);
    factory('api:bullmq');
    const reconnecting = factory('api:sub') as unknown as InstanceType<typeof FakeRedis>;
    reconnecting.status = 'reconnecting';

    await moduleRef.close();

    expect(created[0]?.quit).toHaveBeenCalledOnce();
    expect(created[1]?.quit).toHaveBeenCalledOnce();
    // Без живого соединения QUIT не ждём — рвём сразу.
    expect(reconnecting.quit).not.toHaveBeenCalled();
    expect(reconnecting.disconnect).toHaveBeenCalledOnce();
    expect(created.every((c) => c.status === 'end')).toBe(true);
  });
});
