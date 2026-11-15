import { describe, expect, it } from 'vitest';

import { InvalidIdError } from '../errors/value.errors';
import { InvalidNameError } from '../errors/value.errors';
import { Position } from '../vo/position';
import { Robot } from './robot';

const ROBOT_ID = '33333333-3333-4111-8111-33333333333c';

describe('Robot', () => {
  const position = Position.create(1, 1);

  it('keeps id, name, and position and freezes the instance', () => {
    const robot = Robot.create(ROBOT_ID.toUpperCase(), '  Robot 1  ', position);

    expect(robot.id).toBe(ROBOT_ID);
    expect(robot.name.value).toBe('Robot 1');
    expect(robot.position).toBe(position);
    expect(Object.isFrozen(robot)).toBe(true);
  });

  it.each(['', '   ', ' rb'])('rejects id %j', (id) => {
    expect(() => Robot.create(id, 'Robot', position)).toThrow(InvalidIdError);
  });

  it('rejects an empty name', () => {
    expect(() => Robot.create(ROBOT_ID, '   ', position)).toThrow(InvalidNameError);
  });

  it('withPosition returns a new robot and leaves the original unchanged', () => {
    const robot = Robot.create(ROBOT_ID, 'Robot', position);
    const moved = robot.withPosition(Position.create(2, 2));

    expect(moved).not.toBe(robot);
    expect(moved.id).toBe(robot.id);
    expect(robot.position.equals(position)).toBe(true);
    expect(moved.position.equals(Position.create(2, 2))).toBe(true);
  });
});
