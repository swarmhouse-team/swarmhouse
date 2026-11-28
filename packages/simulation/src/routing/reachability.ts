import type { Position } from '../contracts';
import type { RoutingRequest } from './types';

import { isInsideGrid, isObstacle } from '../utils';

const offsets: readonly Position[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

function getPositionKey(position: Position): string {
  return `${position.x},${position.y}`;
}
export function isGoalReachable(request: RoutingRequest): boolean {
  const { grid, robot, goal } = request;

  const goalKeys = new Set(goal.positions.map(getPositionKey));

  const queue: Position[] = [robot.position];

  const visited = new Set<string>([getPositionKey(robot.position)]);

  let head = 0;

  while (head < queue.length) {
    const current = queue[head++];

    if (goalKeys.has(getPositionKey(current))) {
      return true;
    }

    for (const offset of offsets) {
      const nextPosition: Position = {
        x: current.x + offset.x,
        y: current.y + offset.y,
      };

      if (!isInsideGrid(nextPosition, grid)) {
        continue;
      }

      if (isObstacle(nextPosition, grid)) {
        continue;
      }

      const key = getPositionKey(nextPosition);

      if (visited.has(key)) {
        continue;
      }

      visited.add(key);
      queue.push(nextPosition);
    }
  }

  return false;
}
