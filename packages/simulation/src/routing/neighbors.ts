import type { RobotAction } from '../contracts';
import type { SearchNode, RoutingRequest } from './types';
import type { ReservationTable } from './reservations';

import { isVertexReserved, isEdgeConflict } from './reservations';
import { calculateHeuristic } from './heuristic';

import { turnLeft, turnRight, getForwardPosition, isInsideGrid, isObstacle } from '../utils';

const actions: readonly RobotAction[] = ['FORWARD', 'TURN_LEFT', 'TURN_RIGHT', 'WAIT'];

export function generateNeighbors(
  node: SearchNode,
  request: RoutingRequest,
  reservations: ReservationTable,
): SearchNode[] {
  const neighbors: SearchNode[] = [];
  const nextTick = node.tick + 1;

  if (nextTick > request.currentTick + request.maxSearchTicks) {
    return neighbors;
  }
  for (const action of actions) {
    let position = node.position;
    let direction = node.direction;

    if (action === 'FORWARD') {
      position = getForwardPosition(node.position, node.direction);
    }

    if (action === 'TURN_LEFT') {
      direction = turnLeft(node.direction);
    }

    if (action === 'TURN_RIGHT') {
      direction = turnRight(node.direction);
    }
    if (action === 'FORWARD') {
      if (!isInsideGrid(position, request.grid)) {
        continue;
      }

      if (isObstacle(position, request.grid)) {
        continue;
      }
    }

    if (isVertexReserved(reservations, position, nextTick)) {
      continue;
    }

    if (action === 'FORWARD' && isEdgeConflict(reservations, node.position, position, nextTick)) {
      continue;
    }
    const g = node.g + 1;
    const h = calculateHeuristic(position, request.goal);

    neighbors.push({
      position,
      direction,
      tick: nextTick,
      g,
      h,
      f: g + h,
      parent: node,
      action,
    });
  }
  return neighbors;
}
