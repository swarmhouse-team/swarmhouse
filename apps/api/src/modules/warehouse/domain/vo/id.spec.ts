import { describe, expect, it } from 'vitest';

import { InvalidIdError } from '../errors/value.errors';
import { assertId, normalizeId } from './id';

const UUID_V1 = 'c232ab00-9414-11ec-b3c8-9f4e5d6c7b8a';
const UUID_V4 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const UUID_V7 = '01933c2a-7b3e-7a1b-8c4d-1a2b3c4d5e6f';
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
const MAX_UUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

describe('assertId', () => {
  it.each([UUID_V1, UUID_V4, UUID_V7])('accepts UUID %s and returns it unchanged', (value) => {
    expect(assertId(value)).toBe(value);
  });

  it('accepts uppercase without rewriting the checked value', () => {
    const upper = UUID_V4.toUpperCase();

    expect(assertId(upper)).toBe(upper);
  });

  it.each([
    '',
    '   ',
    ` ${UUID_V4}`,
    `${UUID_V4} `,
    'f47ac10b58cc4372a5670e02b2c3d479',
    'f47ac10b-58cc-4372-a567-0e02b2c3d47',
    'f47ac10b-58cc-4372-a567-0e02b2c3d47g',
    'f47ac10b-58cc-4372-a567',
    'wh-1',
    NIL_UUID,
    NIL_UUID.toUpperCase(),
    MAX_UUID,
    MAX_UUID.toUpperCase(),
  ])('rejects %j', (value) => {
    expect(() => assertId(value)).toThrow(InvalidIdError);
  });
});

describe('normalizeId', () => {
  it.each([UUID_V1, UUID_V4, UUID_V7])('keeps a lowercase UUID %s', (value) => {
    expect(normalizeId(value)).toBe(value);
  });

  it('returns one lowercase form for either letter case', () => {
    expect(normalizeId(UUID_V7.toUpperCase())).toBe(UUID_V7);
    expect(normalizeId(UUID_V7)).toBe(normalizeId(UUID_V7.toUpperCase()));
  });

  it.each([NIL_UUID, MAX_UUID, 'wh-1', ''])('rejects %j', (value) => {
    expect(() => normalizeId(value)).toThrow(InvalidIdError);
  });
});
