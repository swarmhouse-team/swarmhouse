import { describe, expect, it } from 'vitest';

import { InvalidGridSizeError } from '../../modules/warehouse/domain/errors/value.errors';
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

  it('contains a cell only when both coordinates are safe integers inside the grid', () => {
    const size = GridSize.create(20, 20);

    expect(size.contains(-1, 0)).toBe(false);
    expect(size.contains(0, -1)).toBe(false);
    expect(size.contains(1.5, 0)).toBe(false);
    expect(size.contains(0, 1.5)).toBe(false);
    expect(size.contains(size.width, 0)).toBe(false);
    expect(size.contains(0, size.height)).toBe(false);
    expect(size.contains(0, 0)).toBe(true);
    expect(size.contains(size.width - 1, size.height - 1)).toBe(true);
  });
});
