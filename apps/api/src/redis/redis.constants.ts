import type { Redis } from 'ioredis';

/** Общее соединение `api:main` для обычных команд (GET/SET, PING и т. п.). */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Фабрика отдельных соединений: для BullMQ, pub/sub, блокирующих команд — всего, что
 * нельзя делить с `REDIS_CLIENT`. Закрывать полученные соединения не нужно: это делает
 * `RedisModule` при остановке приложения.
 */
export const REDIS_FACTORY = Symbol('REDIS_FACTORY');

/** `name` попадает в `CLIENT SETNAME`, его видно в `CLIENT LIST` и в логах ошибок. */
export type RedisFactory = (name: string) => Redis;
