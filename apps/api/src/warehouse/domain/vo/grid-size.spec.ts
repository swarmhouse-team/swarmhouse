import { describe, expect, it } from 'vitest';

import { InvalidGridSizeError } from '../errors/value.errors';
import { GridSize } from './grid-size';

describe('GridSize', () => {
  it('accepts positive safe integers', () => {
    const size = GridSize.create(20, 20);

    expect(size.width).toBe(20);
    expect(size.height).toBe(20);
  });

  it.each([
    [0, 1],
    [-1, 1],
    [1.5, 1],
    [Number.NaN, 1],
    [Number.POSITIVE_INFINITY, 1],
  ])('rejects size (%s, %s)', (width, height) => {
    expect(() => GridSize.create(width, height)).toThrow(InvalidGridSizeError);
  });
});
