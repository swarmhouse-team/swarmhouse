import { describe, expect, it } from 'vitest';

import type { RobotState } from '../contracts';
import type { RoutingRequest, SearchNode } from './types';
import type { ReservationTable } from './reservations';

import { generateNeighbors } from './neighbors';

function createRobot(overrides: Partial<RobotState> = {}): RobotState {
  return {
    id: 'robot-a',
    position: { x: 5, y: 5 },
    direction: 'UP',
    status: 'idle',
    ...overrides,
  };
}

function createRequest(overrides: Partial<RoutingRequest> = {}): RoutingRequest {
  const robot = overrides.robot ?? createRobot();

  return {
    grid: {
      width: 10,
      height: 10,
      obstacles: [],
      stations: [],
    },
    robot,
    goal: {
      positions: [{ x: 9, y: 9 }],
    },
    currentTick: 0,
    robots: [robot],
    routes: [],
    maxSearchTicks: 5,
    ...overrides,
  };
}

function createNode(overrides: Partial<SearchNode> = {}): SearchNode {
  return {
    position: { x: 5, y: 5 },
    direction: 'UP',
    tick: 0,
    g: 0,
    h: 8,
    f: 8,
    parent: null,
    action: null,
    ...overrides,
  };
}

function createReservations(overrides: Partial<ReservationTable> = {}): ReservationTable {
  return {
    vertices: new Set<string>(),
    edges: new Set<string>(),
    ...overrides,
  };
}

describe('generateNeighbors', () => {
  // Action generation

  it('generates all four actions on an empty grid', () => {
    const neighbors = generateNeighbors(createNode(), createRequest(), createReservations());

    expect(neighbors).toHaveLength(4);

    expect(neighbors.map((node) => node.action)).toEqual([
      'FORWARD',
      'TURN_LEFT',
      'TURN_RIGHT',
      'WAIT',
    ]);
  });

  it.each([
    ['UP', { x: 5, y: 4 }],
    ['RIGHT', { x: 6, y: 5 }],
    ['DOWN', { x: 5, y: 6 }],
    ['LEFT', { x: 4, y: 5 }],
  ] as const)('generates a forward movement in direction %s', (direction, expectedPosition) => {
    const node = createNode({ direction });

    const neighbors = generateNeighbors(node, createRequest(), createReservations());

    const forward = neighbors.find((neighbor) => neighbor.action === 'FORWARD');

    expect(forward).toBeDefined();
    expect(forward?.position).toEqual(expectedPosition);
    expect(forward?.direction).toBe(direction);
  });

  it('generates a left turn without changing position', () => {
    const node = createNode();

    const neighbors = generateNeighbors(node, createRequest(), createReservations());

    const turn = neighbors.find((neighbor) => neighbor.action === 'TURN_LEFT');

    expect(turn).toBeDefined();
    expect(turn?.position).toEqual(node.position);
    expect(turn?.direction).toBe('LEFT');
  });

  it('generates a right turn without changing position', () => {
    const node = createNode();

    const neighbors = generateNeighbors(node, createRequest(), createReservations());

    const turn = neighbors.find((neighbor) => neighbor.action === 'TURN_RIGHT');

    expect(turn).toBeDefined();
    expect(turn?.position).toEqual(node.position);
    expect(turn?.direction).toBe('RIGHT');
  });

  it('generates a wait without changing position or direction', () => {
    const node = createNode();

    const neighbors = generateNeighbors(node, createRequest(), createReservations());

    const wait = neighbors.find((neighbor) => neighbor.action === 'WAIT');

    expect(wait).toBeDefined();
    expect(wait?.position).toEqual(node.position);
    expect(wait?.direction).toBe(node.direction);
  });

  // Grid boundaries and obstacles

  it.each([
    [{ x: 5, y: 0 }, 'UP'],
    [{ x: 9, y: 5 }, 'RIGHT'],
    [{ x: 5, y: 9 }, 'DOWN'],
    [{ x: 0, y: 5 }, 'LEFT'],
  ] as const)(
    'excludes forward movement outside the grid from %j facing %s',
    (position, direction) => {
      const node = createNode({ position, direction });

      const neighbors = generateNeighbors(node, createRequest(), createReservations());

      expect(neighbors).toHaveLength(3);

      expect(neighbors.map((neighbor) => neighbor.action)).toEqual([
        'TURN_LEFT',
        'TURN_RIGHT',
        'WAIT',
      ]);
    },
  );

  it('excludes forward movement into an obstacle', () => {
    const request = createRequest({
      grid: {
        width: 10,
        height: 10,
        obstacles: [{ x: 5, y: 4 }],
        stations: [],
      },
    });

    const neighbors = generateNeighbors(createNode(), request, createReservations());

    expect(neighbors).toHaveLength(3);

    expect(neighbors.map((neighbor) => neighbor.action)).toEqual([
      'TURN_LEFT',
      'TURN_RIGHT',
      'WAIT',
    ]);
  });

  // Vertex reservations and edge conflicts

  it('excludes forward movement into a reserved cell', () => {
    const reservations = createReservations({
      vertices: new Set(['5,4,1']),
    });

    const neighbors = generateNeighbors(createNode(), createRequest(), reservations);

    expect(neighbors.map((neighbor) => neighbor.action)).toEqual([
      'TURN_LEFT',
      'TURN_RIGHT',
      'WAIT',
    ]);
  });

  it('excludes turns and wait when the current cell is reserved', () => {
    const reservations = createReservations({
      vertices: new Set(['5,5,1']),
    });

    const neighbors = generateNeighbors(createNode(), createRequest(), reservations);

    expect(neighbors.map((neighbor) => neighbor.action)).toEqual(['FORWARD']);
  });

  it('excludes forward movement when an edge conflict exists', () => {
    const reservations = createReservations({
      edges: new Set(['5,4:5,5:1']),
    });

    const neighbors = generateNeighbors(createNode(), createRequest(), reservations);

    expect(neighbors.map((neighbor) => neighbor.action)).toEqual([
      'TURN_LEFT',
      'TURN_RIGHT',
      'WAIT',
    ]);
  });

  it('allows entering a cell vacated by another robot', () => {
    const reservations = createReservations({
      vertices: new Set(['5,4,0', '5,3,1']),
      edges: new Set(['5,4:5,3:1']),
    });

    const neighbors = generateNeighbors(createNode(), createRequest(), reservations);

    expect(neighbors).toHaveLength(4);

    expect(neighbors.find((neighbor) => neighbor.action === 'FORWARD')).toBeDefined();
  });

  it('ignores reservations at a different tick', () => {
    const reservations = createReservations({
      vertices: new Set(['5,4,2', '5,5,2']),
      edges: new Set(['5,4:5,5:2']),
    });

    const neighbors = generateNeighbors(createNode(), createRequest(), reservations);

    expect(neighbors).toHaveLength(4);
  });

  it('returns no neighbors when all actions are blocked', () => {
    const reservations = createReservations({
      vertices: new Set(['5,4,1', '5,5,1']),
    });

    const neighbors = generateNeighbors(createNode(), createRequest(), reservations);

    expect(neighbors).toEqual([]);
  });

  // Search horizon

  it('generates neighbors at the search horizon boundary', () => {
    const node = createNode({
      tick: 4,
      g: 4,
      f: 12,
    });

    const request = createRequest({
      maxSearchTicks: 5,
    });

    const neighbors = generateNeighbors(node, request, createReservations());

    expect(neighbors).toHaveLength(4);

    for (const neighbor of neighbors) {
      expect(neighbor.tick).toBe(5);
    }
  });

  it('returns no neighbors beyond the search horizon', () => {
    const node = createNode({
      tick: 5,
      g: 5,
      f: 13,
    });

    const request = createRequest({
      maxSearchTicks: 5,
    });

    const neighbors = generateNeighbors(node, request, createReservations());

    expect(neighbors).toEqual([]);
  });

  it('supports a non-zero current tick', () => {
    const node = createNode({
      tick: 12,
      g: 2,
      f: 10,
    });

    const request = createRequest({
      currentTick: 10,
      maxSearchTicks: 3,
    });

    const neighbors = generateNeighbors(node, request, createReservations());

    expect(neighbors).toHaveLength(4);

    for (const neighbor of neighbors) {
      expect(neighbor.tick).toBe(13);
    }
  });

  it('returns no neighbors beyond a non-zero search horizon', () => {
    const node = createNode({
      tick: 13,
      g: 3,
      f: 11,
    });

    const request = createRequest({
      currentTick: 10,
      maxSearchTicks: 3,
    });

    const neighbors = generateNeighbors(node, request, createReservations());

    expect(neighbors).toEqual([]);
  });

  it('returns no neighbors when the search horizon is zero', () => {
    const request = createRequest({
      maxSearchTicks: 0,
    });

    const neighbors = generateNeighbors(createNode(), request, createReservations());

    expect(neighbors).toEqual([]);
  });

  // Search node properties and costs

  it('increments tick by one for every action', () => {
    const node = createNode({
      tick: 2,
      g: 2,
      f: 10,
    });

    const neighbors = generateNeighbors(node, createRequest(), createReservations());

    expect(neighbors).toHaveLength(4);

    for (const neighbor of neighbors) {
      expect(neighbor.tick).toBe(node.tick + 1);
    }
  });

  it('increments g by one for every action', () => {
    const node = createNode({
      tick: 2,
      g: 2,
      f: 10,
    });

    const neighbors = generateNeighbors(node, createRequest(), createReservations());

    expect(neighbors).toHaveLength(4);

    for (const neighbor of neighbors) {
      expect(neighbor.g).toBe(node.g + 1);
    }
  });

  it('calculates the heuristic for the new position', () => {
    const node = createNode({
      direction: 'RIGHT',
    });

    const neighbors = generateNeighbors(node, createRequest(), createReservations());

    const forward = neighbors.find((neighbor) => neighbor.action === 'FORWARD');

    expect(forward).toBeDefined();
    expect(forward?.position).toEqual({ x: 6, y: 5 });
    expect(forward?.h).toBe(7);
  });

  it('preserves the heuristic during turns and wait', () => {
    const node = createNode();

    const neighbors = generateNeighbors(node, createRequest(), createReservations());

    const stationaryNeighbors = neighbors.filter((neighbor) => neighbor.action !== 'FORWARD');

    expect(stationaryNeighbors).toHaveLength(3);

    for (const neighbor of stationaryNeighbors) {
      expect(neighbor.h).toBe(node.h);
    }
  });

  it('calculates f as the sum of g and h', () => {
    const neighbors = generateNeighbors(createNode(), createRequest(), createReservations());

    expect(neighbors).toHaveLength(4);

    for (const neighbor of neighbors) {
      expect(neighbor.f).toBe(neighbor.g + neighbor.h);
    }
  });

  it('calculates the heuristic using the nearest goal position', () => {
    const node = createNode({
      direction: 'RIGHT',
    });

    const request = createRequest({
      goal: {
        positions: [
          { x: 9, y: 9 },
          { x: 7, y: 5 },
        ],
      },
    });

    const neighbors = generateNeighbors(node, request, createReservations());

    const forward = neighbors.find((neighbor) => neighbor.action === 'FORWARD');

    expect(forward).toBeDefined();
    expect(forward?.h).toBe(1);
  });

  it('assigns the original node as the parent of every neighbor', () => {
    const node = createNode();

    const neighbors = generateNeighbors(node, createRequest(), createReservations());

    expect(neighbors).toHaveLength(4);

    for (const neighbor of neighbors) {
      expect(neighbor.parent).toBe(node);
    }
  });

  // Immutability

  it('does not mutate the original search node', () => {
    const node = createNode();
    const original = structuredClone(node);

    generateNeighbors(node, createRequest(), createReservations());

    expect(node).toEqual(original);
  });

  it('does not mutate the routing request', () => {
    const request = createRequest();
    const original = structuredClone(request);

    generateNeighbors(createNode(), request, createReservations());

    expect(request).toEqual(original);
  });

  it('does not mutate the reservation table', () => {
    const reservations = createReservations({
      vertices: new Set(['5,4,1']),
      edges: new Set(['5,4:5,5:1']),
    });

    const original = structuredClone(reservations);

    generateNeighbors(createNode(), createRequest(), reservations);

    expect(reservations).toEqual(original);
  });
});
