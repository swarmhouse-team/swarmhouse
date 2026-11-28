import type { Position } from '../contracts';
import type { RoutingGoal } from './types';

export function calculateHeuristic(position: Position, goal: RoutingGoal): number {
  let minDistance = Infinity;

  for (const goalPosition of goal.positions) {
    const distance = Math.abs(goalPosition.x - position.x) + Math.abs(goalPosition.y - position.y);

    minDistance = Math.min(minDistance, distance);
  }

  return minDistance;
}
