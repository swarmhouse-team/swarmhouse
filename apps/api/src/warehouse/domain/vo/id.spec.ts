import { describe, expect, it } from 'vitest';

import { InvalidIdError } from '../errors/value.errors';
import { assertId } from './id';

describe('assertId', () => {
  it('accepts a non-empty string without surrounding spaces', () => {
    expect(assertId('wh-1')).toBe('wh-1');
    expect(assertId('a b')).toBe('a b');
  });

  it.each(['', '   ', ' a', 'a '])('rejects %j', (value) => {
    expect(() => assertId(value)).toThrow(InvalidIdError);
  });
});
