import { z } from 'zod';

const KEY_PREFIX = /^[A-Za-z0-9:._-]{1,64}$/;
const POSITIVE_INTEGER = /^[1-9][0-9]*$/;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'должен начинаться с postgresql://'),
  CACHE_DRIVER: z.enum(['memory', 'redis']),
  REDIS_URL: z.string().optional(),
  CACHE_KEY_PREFIX: z.string().optional(),
  CACHE_MEMORY_MAX_ENTRIES: z.string().optional(),
});

export interface Env {
  NODE_ENV: 'development' | 'test' | 'production';
  API_PORT: number;
  DATABASE_URL: string;
  CACHE_DRIVER: 'memory' | 'redis';
  REDIS_URL?: string;
  CACHE_KEY_PREFIX?: string;
  CACHE_MEMORY_MAX_ENTRIES?: number;
}

/** Передаётся в `ConfigModule.forRoot({ validate })`: приложение не стартует с битым окружением. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    throw new Error(`Некорректные переменные окружения:\n${z.prettifyError(result.error)}`);
  }

  const parsed = result.data;
  if (parsed.CACHE_DRIVER === 'memory') {
    return {
      NODE_ENV: parsed.NODE_ENV,
      API_PORT: parsed.API_PORT,
      DATABASE_URL: parsed.DATABASE_URL,
      CACHE_DRIVER: 'memory',
      CACHE_MEMORY_MAX_ENTRIES: parseMaxEntries(parsed.CACHE_MEMORY_MAX_ENTRIES),
    };
  }

  return {
    NODE_ENV: parsed.NODE_ENV,
    API_PORT: parsed.API_PORT,
    DATABASE_URL: parsed.DATABASE_URL,
    CACHE_DRIVER: 'redis',
    REDIS_URL: parseRedisUrl(parsed.REDIS_URL),
    CACHE_KEY_PREFIX: parseKeyPrefix(parsed.CACHE_KEY_PREFIX),
  };
}

function parseMaxEntries(value: string | undefined): number {
  if (value === undefined || value.length === 0) {
    throw cacheConfigError('CACHE_MEMORY_MAX_ENTRIES is required');
  }
  if (!POSITIVE_INTEGER.test(value)) {
    throw cacheConfigError('CACHE_MEMORY_MAX_ENTRIES is invalid');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw cacheConfigError('CACHE_MEMORY_MAX_ENTRIES is invalid');
  }
  return parsed;
}

function parseRedisUrl(value: string | undefined): string {
  if (value === undefined || value.length === 0) {
    throw cacheConfigError('REDIS_URL is required');
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw cacheConfigError('REDIS_URL is invalid');
  }
  if ((url.protocol !== 'redis:' && url.protocol !== 'rediss:') || url.hostname.length === 0) {
    throw cacheConfigError('REDIS_URL is invalid');
  }
  return value;
}

function parseKeyPrefix(value: string | undefined): string {
  if (value === undefined || value.length === 0) {
    throw cacheConfigError('CACHE_KEY_PREFIX is required');
  }
  if (!KEY_PREFIX.test(value)) {
    throw cacheConfigError('CACHE_KEY_PREFIX is invalid');
  }
  return value;
}

function cacheConfigError(message: string): Error {
  return new Error(`Некорректные переменные окружения:\n${message}`);
}
