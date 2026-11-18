import { describe, expect, it } from 'vitest';

import { CacheError } from '../../application/errors/cache.error';
import { copyCacheValue } from './cache-codec';

function hole(): unknown[] {
  const value: unknown[] = [];
  value.length = 2;
  value[1] = 'hole';
  return value;
}

describe('copyCacheValue', () => {
  it('copies plain JSON, including nested null', () => {
    const value = { name: 'dock', empty: null, items: [1, null, true] };

    expect(copyCacheValue(value)).toEqual(value);
    expect(copyCacheValue(value)).not.toBe(value);
  });

  it.each([
    null,
    undefined,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    1n,
    () => undefined,
    new Date(0),
    new Map(),
    new Set(),
    new (class Box {
      readonly name = 'dock';
    })(),
    hole(),
    { missing: undefined },
  ])('rejects %p', (value) => {
    expect(() => copyCacheValue(value)).toThrow(CacheError);
    expect(() => copyCacheValue(value)).toThrow(expect.objectContaining({ kind: 'invalid_value' }));
  });

  it('rejects a cycle', () => {
    const value: { self?: unknown } = {};
    value.self = value;

    expect(() => copyCacheValue(value)).toThrow(
      expect.objectContaining({ kind: 'invalid_value', message: 'Cache value is invalid' }),
    );
  });
});
