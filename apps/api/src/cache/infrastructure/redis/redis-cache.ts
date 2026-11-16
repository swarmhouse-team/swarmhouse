import Redis, { type RedisOptions } from 'ioredis';

import type { CacheValue } from '../../application/cache-value';
import { CacheError } from '../../application/errors/cache.error';
import { assertCacheKey, assertCacheTtl, CachePort } from '../../application/ports/cache.port';
import { copyCacheValue } from '../codec/cache-codec';

const CONNECT_TIMEOUT_MS = 2_000;
const COMMAND_TIMEOUT_MS = 1_000;
const QUIT_TIMEOUT_MS = 1_000;
const RECONNECT_DELAY_MS = 200;
const MAX_RECONNECTS = 3;

const COMMAND_TIMED_OUT = 'Command timed out';
const CONNECTION_CLOSED = 'Connection is closed.';
const OFFLINE_QUEUE_DISABLED = "Stream isn't writeable and enableOfflineQueue options is false";
const UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
]);

/**
 * Narrow client used by the adapter. Production wraps one ioredis instance.
 * This is not a cache port: callers still use `CachePort`.
 */
export interface RedisCacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expiryMode: 'PX', ttlMs: number): Promise<unknown>;
  del(key: string): Promise<number>;
  connect(): Promise<void>;
  quit(): Promise<void>;
  disconnect(): void;
  on(event: 'error', listener: (error: Error) => void): void;
  off(event: 'error', listener: (error: Error) => void): void;
}

/**
 * ioredis 6 options for one cache client.
 * `autoResendUnfulfilledCommands` defaults to true and would send again a
 * command that was written but not answered. It is false here, so set/delete
 * are not repeated after a timeout or a dropped connection.
 * `enableOfflineQueue: false` rejects a command that has not been written
 * instead of storing it for a later connection.
 * `maxRetriesPerRequest: 1` does not resend either: on every second reconnect
 * attempt ioredis rejects the waiting commands with MaxRetriesPerRequestError.
 * `retryStrategy` allows at most three reconnect delays, then stops.
 */
export function redisClientOptions(): RedisOptions {
  return {
    lazyConnect: true,
    connectTimeout: CONNECT_TIMEOUT_MS,
    commandTimeout: COMMAND_TIMEOUT_MS,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    autoResendUnfulfilledCommands: false,
    reconnectOnError: null,
    maxLoadingRetryTime: CONNECT_TIMEOUT_MS,
    retryStrategy(times: number): number | null {
      if (times > MAX_RECONNECTS) {
        return null;
      }
      return RECONNECT_DELAY_MS;
    },
  };
}

/** One ioredis client. Values are stored with `SET key value PX ttlMs`. */
export class RedisCache extends CachePort {
  private readonly onClientError = (_error: Error): void => {
    // ioredis emits `error` on every failed reconnect. The listener keeps Node
    // from throwing. The message is not logged: it can contain the host.
  };

  constructor(
    private readonly keyPrefix: string,
    private readonly client: RedisCacheClient,
  ) {
    super();
    this.client.on('error', this.onClientError);
  }

  static open(url: string, keyPrefix: string): RedisCache {
    return new RedisCache(keyPrefix, wrap(new Redis(url, redisClientOptions())));
  }

  async start(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      this.release();
      throw new CacheError('unavailable', error);
    }
  }

  /**
   * Waits up to one second for `quit`. If quit does not finish, the socket is
   * closed with `disconnect`, which also clears the client reconnect timer.
   * A failed quit is not treated as a rolled-back write.
   */
  async stop(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const outcome = await Promise.race([
      this.client.quit().then(
        () => 'quit' as const,
        () => 'failed' as const,
      ),
      new Promise<'timeout'>((resolve) => {
        timer = setTimeout(() => resolve('timeout'), QUIT_TIMEOUT_MS);
      }),
    ]);
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    if (outcome !== 'quit') {
      this.client.disconnect();
    }
    this.client.off('error', this.onClientError);
  }

  async get(key: string): Promise<CacheValue | null> {
    assertCacheKey(key);
    const raw = await this.run(() => this.client.get(this.namespaced(key)));
    if (raw === null) {
      return null;
    }
    return decode(raw);
  }

  async set(key: string, value: CacheValue, ttlMs: number): Promise<void> {
    assertCacheKey(key);
    assertCacheTtl(ttlMs);
    const payload = JSON.stringify(copyCacheValue(value));
    await this.run(() => this.client.set(this.namespaced(key), payload, 'PX', ttlMs));
  }

  async delete(key: string): Promise<void> {
    assertCacheKey(key);
    await this.run(() => this.client.del(this.namespaced(key)));
  }

  private namespaced(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private async run<T>(command: () => Promise<T>): Promise<T> {
    try {
      return await command();
    } catch (error) {
      throw toCommandError(error);
    }
  }

  private release(): void {
    this.client.off('error', this.onClientError);
    this.client.disconnect();
  }
}

function wrap(client: Redis): RedisCacheClient {
  return {
    get: (key) => client.get(key),
    set: (key, value, expiryMode, ttlMs) => client.set(key, value, expiryMode, ttlMs),
    del: (key) => client.del(key),
    connect: () => client.connect(),
    quit: async () => {
      await client.quit();
    },
    disconnect: () => {
      client.disconnect();
    },
    on: (event, listener) => {
      client.on(event, listener);
    },
    off: (event, listener) => {
      client.off(event, listener);
    },
  };
}

function decode(raw: string): CacheValue {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CacheError('corrupt');
  }
  try {
    return copyCacheValue(parsed);
  } catch (error) {
    if (error instanceof CacheError && error.kind === 'invalid_value') {
      throw new CacheError('corrupt');
    }
    throw error;
  }
}

function toCommandError(error: unknown): CacheError {
  if (error instanceof CacheError) {
    return error;
  }
  if (isUnavailable(error)) {
    return new CacheError('unavailable', error);
  }
  return new CacheError('command_failed', error);
}

function isUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (error.name === 'MaxRetriesPerRequestError') {
    return true;
  }
  if (isRedisReply(error)) {
    return false;
  }
  if (hasCode(error) && UNAVAILABLE_CODES.has(error.code)) {
    return true;
  }
  return (
    error.message === COMMAND_TIMED_OUT ||
    error.message === CONNECTION_CLOSED ||
    error.message === OFFLINE_QUEUE_DISABLED
  );
}

function isRedisReply(error: Error): boolean {
  return error.name === 'ReplyError' || error.name === 'SimpleError' || error.name === 'BlobError';
}

function hasCode(error: Error): error is Error & { code: string } {
  if (!('code' in error)) {
    return false;
  }
  return typeof error.code === 'string';
}
