import { describe, expect, it } from 'vitest';

import { InvalidPositionError } from './grid-errors';
import { Position } from './position';

describe('Position', () => {
  it('accepts non-negative safe integers, including zero', () => {
    const position = Position.create(0, 0);

    expect(position.x).toBe(0);
    expect(position.y).toBe(0);
    expect(Object.isFrozen(position)).toBe(true);
  });

  it('treats positions with the same coordinates as equal', () => {
    expect(Position.create(1, 2).equals(Position.create(1, 2))).toBe(true);
    expect(Position.create(1, 2).equals(Position.create(2, 1))).toBe(false);
  });

  it.each([
    [-1, 0],
    [1.5, 0],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    [Number.NEGATIVE_INFINITY, 0],
    [Number.MAX_SAFE_INTEGER + 1, 0],
  ])('rejects coordinate (%s, %s)', (x, y) => {
    expect(() => Position.create(x, y)).toThrow(InvalidPositionError);
  });
});
