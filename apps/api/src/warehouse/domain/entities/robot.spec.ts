import { describe, expect, it } from 'vitest';

import { InvalidIdError } from '../errors/value.errors';
import { InvalidNameError } from '../errors/value.errors';
import { Position } from '../vo/position';
import { Robot } from './robot';

describe('Robot', () => {
  const position = Position.create(1, 1);

  it('keeps id, name, and position and freezes the instance', () => {
    const robot = Robot.create('rb-1', '  Robot 1  ', position);

    expect(robot.id).toBe('rb-1');
    expect(robot.name.value).toBe('Robot 1');
    expect(robot.position).toBe(position);
    expect(Object.isFrozen(robot)).toBe(true);
  });

  it.each(['', '   ', ' rb'])('rejects id %j', (id) => {
    expect(() => Robot.create(id, 'Robot', position)).toThrow(InvalidIdError);
  });

  it('rejects an empty name', () => {
    expect(() => Robot.create('rb-1', '   ', position)).toThrow(InvalidNameError);
  });

  it('withPosition returns a new robot and leaves the original unchanged', () => {
    const robot = Robot.create('rb-1', 'Robot', position);
    const moved = robot.withPosition(Position.create(2, 2));

    expect(moved).not.toBe(robot);
    expect(moved.id).toBe(robot.id);
    expect(robot.position.equals(position)).toBe(true);
    expect(moved.position.equals(Position.create(2, 2))).toBe(true);
  });
});
