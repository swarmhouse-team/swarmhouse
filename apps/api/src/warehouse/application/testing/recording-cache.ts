import { CacheError } from '../../../cache/application/errors/cache.error';
import type { CacheValue } from '../../../cache/application/cache-value';
import { CachePort } from '../../../cache/application/ports/cache.port';

/** In-memory cache double. It records keys and can fail one operation with `CacheError`. */
export class RecordingCache extends CachePort {
  readonly values = new Map<string, { value: CacheValue; ttlMs: number }>();
  readonly deleted: string[] = [];
  getError?: CacheError;
  setError?: CacheError;
  deleteErrors: CacheError[] = [];
  unexpectedDeleteError?: Error;

  async get(key: string): Promise<CacheValue | null> {
    if (this.getError) {
      throw this.getError;
    }
    return this.values.get(key)?.value ?? null;
  }

  async set(key: string, value: CacheValue, ttlMs: number): Promise<void> {
    if (this.setError) {
      throw this.setError;
    }
    this.values.set(key, { value, ttlMs });
  }

  async delete(key: string): Promise<void> {
    if (this.unexpectedDeleteError) {
      throw this.unexpectedDeleteError;
    }
    this.deleted.push(key);
    const error = this.deleteErrors.shift();
    if (error) {
      throw error;
    }
    this.values.delete(key);
  }
}
