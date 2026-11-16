import { describe, expect, it } from 'vitest';

import { assertId } from '../../domain/vo/id';
import { UuidV7IdGenerator } from './uuid-v7-id-generator';

describe('UuidV7IdGenerator', () => {
  const generator = new UuidV7IdGenerator();

  it('returns a lowercase UUID whose version nibble is 7', () => {
    const id = generator.next();

    expect(assertId(id)).toBe(id);
    expect(id).toBe(id.toLowerCase());
    expect(id.charAt(14)).toBe('7');
  });

  it('returns different values across a small sample', () => {
    const ids = Array.from({ length: 8 }, () => generator.next());

    expect(new Set(ids).size).toBe(ids.length);
  });
});