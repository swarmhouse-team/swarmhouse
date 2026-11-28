import { describe, expect, it } from 'vitest';

import type { RobotState, RobotRoute } from '../contracts';

import type { RoutingRequest } from './types';

import { buildReservationTable, isVertexReserved, isEdgeConflict } from './reservations';

function createRobot(overrides: Partial<RobotState> = {}): RobotState {
  return {
    id: 'robot-a',
    position: { x: 0, y: 0 },
    direction: 'RIGHT',
    status: 'idle',
    ...overrides,
  };
}

function createRequest(overrides: Partial<RoutingRequest> = {}): RoutingRequest {
  const robot = createRobot();

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

function createMovingRobot(): RobotState {
  return createRobot({
    id: 'robot-b',
    position: { x: 2, y: 2 },
    status: 'busy',
  });
}

function createRoute(): RobotRoute {
  return {
    robotId: 'robot-b',
    startTick: 0,
    steps: [
      {
        tick: 1,
        action: 'FORWARD',
        position: { x: 3, y: 2 },
        direction: 'RIGHT',
      },
      {
        tick: 2,
        action: 'FORWARD',
        position: { x: 4, y: 2 },
        direction: 'RIGHT',
      },
    ],
  };
}

describe('buildReservationTable', () => {
  it('returns an empty table when there are no other robots', () => {
    const table = buildReservationTable(createRequest());

    expect(table.vertices.size).toBe(0);
    expect(table.edges.size).toBe(0);
  });

  it('excludes the robot being planned', () => {
    const robot = createRobot();

    const table = buildReservationTable(
      createRequest({
        robot,
        robots: [robot],
      }),
    );

    for (let tick = 0; tick <= 5; tick++) {
      expect(isVertexReserved(table, robot.position, tick)).toBe(false);
    }
  });

  it('excludes the existing route of the robot being planned', () => {
    const robot = createMovingRobot();

    const table = buildReservationTable(
      createRequest({
        robot,
        robots: [robot],
        routes: [createRoute()],
      }),
    );

    expect(table.vertices.size).toBe(0);
    expect(table.edges.size).toBe(0);
  });

  it('reserves a stationary robot for the entire horizon', () => {
    const otherRobot = createRobot({
      id: 'robot-b',
      position: { x: 2, y: 2 },
    });

    const table = buildReservationTable(
      createRequest({
        robots: [createRobot(), otherRobot],
      }),
    );

    for (let tick = 0; tick <= 5; tick++) {
      expect(isVertexReserved(table, otherRobot.position, tick)).toBe(true);
    }

    expect(table.vertices.size).toBe(6);
    expect(table.edges.size).toBe(0);
  });

  it('reserves positions according to the route', () => {
    const table = buildReservationTable(
      createRequest({
        robots: [createRobot(), createMovingRobot()],
        routes: [createRoute()],
      }),
    );

    expect(isVertexReserved(table, { x: 2, y: 2 }, 0)).toBe(true);

    expect(isVertexReserved(table, { x: 3, y: 2 }, 1)).toBe(true);

    expect(isVertexReserved(table, { x: 4, y: 2 }, 2)).toBe(true);
  });

  it('reserves movement edges according to the route', () => {
    const table = buildReservationTable(
      createRequest({
        robots: [createRobot(), createMovingRobot()],
        routes: [createRoute()],
      }),
    );

    expect(table.edges.has('2,2:3,2:1')).toBe(true);
    expect(table.edges.has('3,2:4,2:2')).toBe(true);
    expect(table.edges.size).toBe(2);
  });

  it('reserves the final position after route completion', () => {
    const table = buildReservationTable(
      createRequest({
        robots: [createRobot(), createMovingRobot()],
        routes: [createRoute()],
      }),
    );

    for (let tick = 2; tick <= 5; tick++) {
      expect(isVertexReserved(table, { x: 4, y: 2 }, tick)).toBe(true);
    }
  });

  it('treats a faulty robot as stationary', () => {
    const robot = createRobot({
      id: 'robot-b',
      position: { x: 2, y: 2 },
      status: 'fault',
    });

    const table = buildReservationTable(
      createRequest({
        robots: [createRobot(), robot],
        routes: [createRoute()],
      }),
    );

    for (let tick = 0; tick <= 5; tick++) {
      expect(isVertexReserved(table, robot.position, tick)).toBe(true);
    }

    expect(table.edges.size).toBe(0);
  });

  it('treats a waiting robot as stationary', () => {
    const robot = createRobot({
      id: 'robot-b',
      position: { x: 2, y: 2 },
      status: 'waiting',
      waitingReason: 'BLOCKED',
    });

    const table = buildReservationTable(
      createRequest({
        robots: [createRobot(), robot],
        routes: [createRoute()],
      }),
    );

    for (let tick = 0; tick <= 5; tick++) {
      expect(isVertexReserved(table, robot.position, tick)).toBe(true);
    }

    expect(table.edges.size).toBe(0);
  });

  it('reserves cells but not edges during turns and waits', () => {
    const robot = createMovingRobot();

    const route: RobotRoute = {
      robotId: robot.id,
      startTick: 0,
      steps: [
        {
          tick: 1,
          action: 'TURN_LEFT',
          position: { x: 2, y: 2 },
          direction: 'UP',
        },
        {
          tick: 2,
          action: 'TURN_RIGHT',
          position: { x: 2, y: 2 },
          direction: 'RIGHT',
        },
        {
          tick: 3,
          action: 'WAIT',
          position: { x: 2, y: 2 },
          direction: 'RIGHT',
        },
      ],
    };

    const table = buildReservationTable(
      createRequest({
        robots: [createRobot(), robot],
        routes: [route],
      }),
    );

    for (let tick = 0; tick <= 5; tick++) {
      expect(isVertexReserved(table, robot.position, tick)).toBe(true);
    }

    expect(table.edges.size).toBe(0);
  });

  it('reserves positions of multiple robots', () => {
    const robotB = createMovingRobot();

    const robotC = createRobot({
      id: 'robot-c',
      position: { x: 7, y: 7 },
    });

    const table = buildReservationTable(
      createRequest({
        robots: [createRobot(), robotB, robotC],
        routes: [createRoute()],
      }),
    );

    expect(isVertexReserved(table, { x: 3, y: 2 }, 1)).toBe(true);

    expect(isVertexReserved(table, { x: 7, y: 7 }, 1)).toBe(true);
  });

  it('does not reserve positions beyond the search horizon', () => {
    const table = buildReservationTable(
      createRequest({
        robots: [createRobot(), createMovingRobot()],
        routes: [createRoute()],
        maxSearchTicks: 1,
      }),
    );

    expect(table.vertices.size).toBe(2);
    expect(table.edges.size).toBe(1);

    expect(isVertexReserved(table, { x: 4, y: 2 }, 2)).toBe(false);
  });

  it('handles a route that is already in progress', () => {
    const robot = createRobot({
      id: 'robot-b',
      position: { x: 3, y: 2 },
      status: 'busy',
    });

    const table = buildReservationTable(
      createRequest({
        currentTick: 1,
        robots: [createRobot(), robot],
        routes: [createRoute()],
      }),
    );

    expect(isVertexReserved(table, { x: 2, y: 2 }, 0)).toBe(false);

    expect(isVertexReserved(table, { x: 3, y: 2 }, 1)).toBe(true);

    expect(isVertexReserved(table, { x: 4, y: 2 }, 2)).toBe(true);

    expect(table.edges.size).toBe(1);
    expect(table.edges.has('3,2:4,2:2')).toBe(true);
  });

  it('supports a non-zero current tick', () => {
    const robot = createMovingRobot();

    const table = buildReservationTable(
      createRequest({
        currentTick: 10,
        maxSearchTicks: 3,
        robots: [createRobot(), robot],
      }),
    );

    expect(table.vertices.size).toBe(4);

    expect(isVertexReserved(table, robot.position, 9)).toBe(false);

    for (let tick = 10; tick <= 13; tick++) {
      expect(isVertexReserved(table, robot.position, tick)).toBe(true);
    }

    expect(isVertexReserved(table, robot.position, 14)).toBe(false);
  });

  it('does not mutate the routing request', () => {
    const request = createRequest({
      robots: [createRobot(), createMovingRobot()],
      routes: [createRoute()],
    });

    const original = structuredClone(request);

    buildReservationTable(request);

    expect(request).toEqual(original);
  });
});

describe('isVertexReserved', () => {
  it('returns true for a reserved cell', () => {
    const table = {
      vertices: new Set(['2,2,1']),
      edges: new Set<string>(),
    };

    expect(isVertexReserved(table, { x: 2, y: 2 }, 1)).toBe(true);
  });

  it('returns false for an unreserved cell', () => {
    const table = {
      vertices: new Set(['2,2,1']),
      edges: new Set<string>(),
    };

    expect(isVertexReserved(table, { x: 3, y: 2 }, 1)).toBe(false);
  });

  it('distinguishes reservations at different ticks', () => {
    const table = {
      vertices: new Set(['2,2,1']),
      edges: new Set<string>(),
    };

    expect(isVertexReserved(table, { x: 2, y: 2 }, 2)).toBe(false);
  });

  it('allows entering a cell vacated by another robot', () => {
    const table = buildReservationTable(
      createRequest({
        robots: [createRobot(), createMovingRobot()],
        routes: [createRoute()],
      }),
    );

    expect(isVertexReserved(table, { x: 2, y: 2 }, 1)).toBe(false);

    expect(isEdgeConflict(table, { x: 1, y: 2 }, { x: 2, y: 2 }, 1)).toBe(false);
  });
});

describe('isEdgeConflict', () => {
  it('detects movement in the opposite direction', () => {
    const table = {
      vertices: new Set<string>(),
      edges: new Set(['2,2:3,2:1']),
    };

    expect(isEdgeConflict(table, { x: 3, y: 2 }, { x: 2, y: 2 }, 1)).toBe(true);
  });

  it('does not report an edge conflict in the same direction', () => {
    const table = {
      vertices: new Set<string>(),
      edges: new Set(['2,2:3,2:1']),
    };

    expect(isEdgeConflict(table, { x: 2, y: 2 }, { x: 3, y: 2 }, 1)).toBe(false);
  });

  it('does not report a conflict at a different tick', () => {
    const table = {
      vertices: new Set<string>(),
      edges: new Set(['2,2:3,2:1']),
    };

    expect(isEdgeConflict(table, { x: 3, y: 2 }, { x: 2, y: 2 }, 2)).toBe(false);
  });

  it('does not report a conflict for an unrelated edge', () => {
    const table = {
      vertices: new Set<string>(),
      edges: new Set(['2,2:3,2:1']),
    };

    expect(isEdgeConflict(table, { x: 5, y: 5 }, { x: 6, y: 5 }, 1)).toBe(false);
  });
});
