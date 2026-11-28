import type { Direction, Position } from '../contracts';

const leftTurns: Record<Direction, Direction> = {
  UP: 'LEFT',
  LEFT: 'DOWN',
  DOWN: 'RIGHT',
  RIGHT: 'UP',
};

const rightTurns: Record<Direction, Direction> = {
  UP: 'RIGHT',
  RIGHT: 'DOWN',
  DOWN: 'LEFT',
  LEFT: 'UP',
};

const offsets: Record<Direction, Position> = {
  UP: { x: 0, y: -1 },
  RIGHT: { x: 1, y: 0 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
};

export function turnLeft(direction: Direction): Direction {
  return leftTurns[direction];
}

export function turnRight(direction: Direction): Direction {
  return rightTurns[direction];
}

export function getForwardPosition(position: Position, direction: Direction): Position {
  const offset = offsets[direction];

  return {
    x: position.x + offset.x,
    y: position.y + offset.y,
  };
}
