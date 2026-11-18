import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
  type Provider,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import type { Env } from '../config/env';
import { REDIS_CLIENT, REDIS_FACTORY, type RedisFactory } from './redis.constants';

const MAIN_CONNECTION_NAME = 'api:main';

/** Внутренний токен: все соединения, созданные фабрикой. Наружу не экспортируется. */
const REDIS_CONNECTIONS = Symbol('REDIS_CONNECTIONS');

const logger = new Logger('Redis');

const providers: Provider[] = [
  { provide: REDIS_CONNECTIONS, useValue: new Set<Redis>() },
  {
    provide: REDIS_FACTORY,
    inject: [ConfigService, REDIS_CONNECTIONS],
    useFactory: (config: ConfigService<Env, true>, connections: Set<Redis>): RedisFactory => {
      const url = config.get('REDIS_URL', { infer: true });

      return (name) => {
        const connection = new Redis(url, { connectionName: name });
        connection.on('error', (error: Error) => {
          logger.error(`Соединение ${name}: ${error.message}`);
        });
        connections.add(connection);
        return connection;
      };
    },
  },
  {
    provide: REDIS_CLIENT,
    inject: [REDIS_FACTORY],
    useFactory: (createConnection: RedisFactory): Redis => createConnection(MAIN_CONNECTION_NAME),
  },
];

/**
 * Глобальный модуль: `REDIS_CLIENT` и `REDIS_FACTORY` доступны через DI без импорта модуля.
 * Соединения закрываются в `onApplicationShutdown` — после `onModuleDestroy` всех модулей,
 * чтобы очереди и адаптеры успели остановиться, пока Redis ещё доступен.
 */
@Global()
@Module({
  providers,
  exports: [REDIS_CLIENT, REDIS_FACTORY],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CONNECTIONS) private readonly connections: Set<Redis>) {}

  async onApplicationShutdown(): Promise<void> {
    const connections = [...this.connections];
    this.connections.clear();

    await Promise.all(connections.map((connection) => closeConnection(connection)));
  }
}

/**
 * Живое соединение закрываем через `QUIT`: Redis выполнит уже отправленные команды.
 * Если соединения нет (Redis недоступен, идёт переподключение) — `QUIT` встал бы в офлайн-очередь
 * и задержал остановку, поэтому просто рвём соединение и прекращаем переподключения.
 */
async function closeConnection(connection: Redis): Promise<void> {
  if (connection.status === 'end') {
    return;
  }

  if (connection.status !== 'ready') {
    connection.disconnect();
    return;
  }

  try {
    await connection.quit();
  } catch {
    connection.disconnect();
  }
}
