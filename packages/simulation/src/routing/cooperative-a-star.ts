import type { RobotRoute, RouteStep } from '../contracts';
import type { SearchNode, RoutingGoal, RoutingRequest, RoutingResult } from './types';
import type { ReservationTable } from './reservations';

import { calculateHeuristic } from './heuristic';
import { buildReservationTable, isVertexReserved } from './reservations';
import { generateNeighbors } from './neighbors';
import { isGoalReachable } from './reachability';

function isGoalReached(node: SearchNode, goal: RoutingGoal): boolean {
  const positionReached = goal.positions.some(
    (position) => position.x === node.position.x && position.y === node.position.y,
  );

  if (!positionReached) {
    return false;
  }

  if (goal.direction !== undefined) {
    return node.direction === goal.direction;
  }

  return true;
}
function isGoalSafe(
  node: SearchNode,
  request: RoutingRequest,
  reservations: ReservationTable,
): boolean {
  const endTick = request.currentTick + request.maxSearchTicks;

  for (let tick = node.tick; tick <= endTick; tick++) {
    if (isVertexReserved(reservations, node.position, tick)) {
      return false;
    }
  }

  return true;
}
function getNodeKey(node: SearchNode): string {
  return `${node.position.x},${node.position.y},${node.direction},${node.tick}`;
}
function createStartNode(request: RoutingRequest): SearchNode {
  const h = calculateHeuristic(request.robot.position, request.goal);

  return {
    position: request.robot.position,
    direction: request.robot.direction,
    tick: request.currentTick,
    g: 0,
    h,
    f: h,
    parent: null,
    action: null,
  };
}
function popBestNode(openSet: SearchNode[]): SearchNode | undefined {
  if (openSet.length === 0) {
    return undefined;
  }

  let bestIndex = 0;

  for (let i = 1; i < openSet.length; i++) {
    const current = openSet[i];
    const best = openSet[bestIndex];

    if (current.f < best.f || (current.f === best.f && current.h < best.h)) {
      bestIndex = i;
    }
  }

  return openSet.splice(bestIndex, 1)[0];
}
function reconstructRoute(goalNode: SearchNode, request: RoutingRequest): RobotRoute {
  const steps: RouteStep[] = [];

  let current: SearchNode | null = goalNode;

  while (current !== null && current.action !== null) {
    steps.push({
      tick: current.tick,
      action: current.action,
      position: current.position,
      direction: current.direction,
    });

    current = current.parent;
  }

  steps.reverse();

  return {
    robotId: request.robot.id,
    startTick: request.currentTick,
    steps,
  };
}
export function findRoute(request: RoutingRequest): RoutingResult {
  const reservations = buildReservationTable(request);
  const startNode = createStartNode(request);

  const openSet: SearchNode[] = [startNode];
  const closedSet = new Set<string>();

  const endTick = request.currentTick + request.maxSearchTicks;

  let reachedSearchLimit = false;

  while (openSet.length > 0) {
    const current = popBestNode(openSet);

    if (!current) {
      break;
    }

    const currentKey = getNodeKey(current);

    if (closedSet.has(currentKey)) {
      continue;
    }

    closedSet.add(currentKey);

    if (
      current.parent !== null &&
      isGoalReached(current, request.goal) &&
      isGoalSafe(current, request, reservations)
    ) {
      return {
        success: true,
        route: reconstructRoute(current, request),
      };
    }

    if (current.tick >= endTick) {
      reachedSearchLimit = true;
      continue;
    }

    const neighbors = generateNeighbors(current, request, reservations);

    for (const neighbor of neighbors) {
      const neighborKey = getNodeKey(neighbor);

      if (closedSet.has(neighborKey)) {
        continue;
      }

      openSet.push(neighbor);
    }
  }

  if (!isGoalReachable(request)) {
    return {
      success: false,
      reason: 'NO_PATH',
    };
  }

  return {
    success: false,
    reason: reachedSearchLimit ? 'SEARCH_LIMIT' : 'BLOCKED',
  };
}
