import type { CacheValue } from '../../application/cache-value';
import { CacheError } from '../../application/errors/cache.error';

/**
 * Checks a cache value before it is stored and returns an independent copy.
 * `JSON.stringify` is only the copy step after this walk. It is not the validation.
 */
export function copyCacheValue(value: unknown): CacheValue {
  walk(value, true, new WeakSet<object>());
  return JSON.parse(JSON.stringify(value)) as CacheValue;
}

function walk(value: unknown, atRoot: boolean, seen: WeakSet<object>): void {
  if (value === null) {
    if (atRoot) {
      throw new CacheError('invalid_value');
    }
    return;
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new CacheError('invalid_value');
    }
    return;
  }
  if (typeof value !== 'object') {
    throw new CacheError('invalid_value');
  }
  if (seen.has(value)) {
    throw new CacheError('invalid_value');
  }
  seen.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) {
        throw new CacheError('invalid_value');
      }
      walk(value[index], false, seen);
    }
    return;
  }
  if (!isPlainObject(value) || !hasOnlyEnumerableStringKeys(value)) {
    throw new CacheError('invalid_value');
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    walk(record[key], false, seen);
  }
}

function isPlainObject(value: object): boolean {
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyEnumerableStringKeys(value: object): boolean {
  return (
    Object.getOwnPropertySymbols(value).length === 0 &&
    Object.getOwnPropertyNames(value).length === Object.keys(value).length
  );
}
