import { describe, expect, it } from 'vitest';

import { UuidV7IdGenerator } from './uuid-v7-id-generator';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('UuidV7IdGenerator', () => {
  const generator = new UuidV7IdGenerator();

  it('returns a lowercase UUID whose version nibble is 7', () => {
    const id = generator.next();

    expect(id).toMatch(UUID_V7);
    expect(id).toBe(id.toLowerCase());
    expect(id.charAt(14)).toBe('7');
  });

  it('returns different values across a small sample', () => {
    const ids = Array.from({ length: 8 }, () => generator.next());

    expect(new Set(ids).size).toBe(ids.length);
  });
});
