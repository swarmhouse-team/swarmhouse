import type { Position } from '../contracts';
import type { RoutingRequest } from './types';

export type ReservationTable = {
  vertices: ReadonlySet<string>;
  edges: ReadonlySet<string>;
};

function getVertexKey(position: Position, tick: number): string {
  return `${position.x},${position.y},${tick}`;
}

function getEdgeKey(from: Position, to: Position, tick: number): string {
  return `${from.x},${from.y}:${to.x},${to.y}:${tick}`;
}
export function buildReservationTable(request: RoutingRequest): ReservationTable {
  const vertices = new Set<string>();
  const edges = new Set<string>();

  const endTick = request.currentTick + request.maxSearchTicks;

  for (const robot of request.robots) {
    if (robot.id === request.robot.id) {
      continue;
    }

    const route =
      robot.status === 'fault' || robot.status === 'waiting'
        ? undefined
        : request.routes.find((route) => route.robotId === robot.id);

    let position = robot.position;

    vertices.add(getVertexKey(position, request.currentTick));

    for (let tick = request.currentTick + 1; tick <= endTick; tick++) {
      const step = route?.steps.find((step) => step.tick === tick);

      const nextPosition = step?.position ?? position;

      vertices.add(getVertexKey(nextPosition, tick));

      if (position.x !== nextPosition.x || position.y !== nextPosition.y) {
        edges.add(getEdgeKey(position, nextPosition, tick));
      }

      position = nextPosition;
    }
  }

  return { vertices, edges };
}
export function isVertexReserved(
  table: ReservationTable,
  position: Position,
  tick: number,
): boolean {
  return table.vertices.has(getVertexKey(position, tick));
}

export function isEdgeConflict(
  table: ReservationTable,
  from: Position,
  to: Position,
  tick: number,
): boolean {
  return table.edges.has(getEdgeKey(to, from, tick));
}
