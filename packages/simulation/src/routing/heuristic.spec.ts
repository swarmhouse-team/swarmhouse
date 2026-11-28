import { describe, expect, it } from 'vitest';

import { calculateHeuristic } from './heuristic';

describe('calculateHeuristic', () => {
  it('returns zero when the robot is at the goal', () => {
    expect(calculateHeuristic({ x: 2, y: 3 }, { positions: [{ x: 2, y: 3 }] })).toBe(0);
  });

  it('calculates horizontal distance', () => {
    expect(calculateHeuristic({ x: 1, y: 2 }, { positions: [{ x: 5, y: 2 }] })).toBe(4);
  });

  it('calculates vertical distance', () => {
    expect(calculateHeuristic({ x: 2, y: 1 }, { positions: [{ x: 2, y: 6 }] })).toBe(5);
  });

  it('calculates Manhattan distance on both axes', () => {
    expect(calculateHeuristic({ x: 1, y: 2 }, { positions: [{ x: 5, y: 5 }] })).toBe(7);
  });

  it('handles decreasing coordinates', () => {
    expect(calculateHeuristic({ x: 5, y: 6 }, { positions: [{ x: 2, y: 1 }] })).toBe(8);
  });

  it('returns the minimum distance among multiple goals', () => {
    expect(
      calculateHeuristic(
        { x: 0, y: 0 },
        {
          positions: [
            { x: 5, y: 5 },
            { x: 2, y: 1 },
            { x: 4, y: 3 },
          ],
        },
      ),
    ).toBe(3);
  });

  it('returns zero when the robot occupies any goal cell', () => {
    expect(
      calculateHeuristic(
        { x: 2, y: 3 },
        {
          positions: [
            { x: 5, y: 5 },
            { x: 2, y: 3 },
            { x: 4, y: 4 },
          ],
        },
      ),
    ).toBe(0);
  });

  it('handles service cells around a station', () => {
    expect(
      calculateHeuristic(
        { x: 2, y: 5 },
        {
          positions: [
            { x: 5, y: 4 },
            { x: 6, y: 5 },
            { x: 5, y: 6 },
            { x: 4, y: 5 },
          ],
        },
      ),
    ).toBe(2);
  });

  it('does not include goal orientation in the estimate', () => {
    expect(
      calculateHeuristic(
        { x: 1, y: 1 },
        {
          positions: [{ x: 3, y: 1 }],
          direction: 'LEFT',
        },
      ),
    ).toBe(2);
  });

  it('returns Infinity when there are no goal positions', () => {
    expect(calculateHeuristic({ x: 0, y: 0 }, { positions: [] })).toBe(Infinity);
  });
});
