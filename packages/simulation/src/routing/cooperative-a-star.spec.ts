import { describe, expect, it } from 'vitest';

import type { RobotState, RobotRoute } from '../contracts';
import type { RoutingRequest, RoutingResult } from './types';

import { findRoute } from './cooperative-a-star';

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
  const robot = overrides.robot ?? createRobot();

  return {
    grid: {
      width: 5,
      height: 5,
      obstacles: [],
      stations: [],
    },
    robot,
    goal: {
      positions: [{ x: 3, y: 0 }],
    },
    currentTick: 0,
    robots: [robot],
    routes: [],
    maxSearchTicks: 20,
    ...overrides,
  };
}

function getRoute(result: RoutingResult): RobotRoute {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(`Expected a route, received ${result.reason}`);
  }

  return result.route;
}

describe('findRoute', () => {
  // Basic routing

  it('finds a straight route on an empty grid', () => {
    const route = getRoute(findRoute(createRequest()));

    expect(route.steps).toEqual([
      {
        tick: 1,
        action: 'FORWARD',
        position: { x: 1, y: 0 },
        direction: 'RIGHT',
      },
      {
        tick: 2,
        action: 'FORWARD',
        position: { x: 2, y: 0 },
        direction: 'RIGHT',
      },
      {
        tick: 3,
        action: 'FORWARD',
        position: { x: 3, y: 0 },
        direction: 'RIGHT',
      },
    ]);
  });

  it('assigns the route to the requested robot', () => {
    const request = createRequest();
    const route = getRoute(findRoute(request));

    expect(route.robotId).toBe(request.robot.id);
  });

  it('uses the current tick as the route start tick', () => {
    const request = createRequest({
      currentTick: 10,
    });

    const route = getRoute(findRoute(request));

    expect(route.startTick).toBe(10);
    expect(route.steps.map((step) => step.tick)).toEqual([11, 12, 13]);
  });

  it('generates consecutive route steps', () => {
    const route = getRoute(findRoute(createRequest()));

    route.steps.forEach((step, index) => {
      expect(step.tick).toBe(route.startTick + index + 1);
    });
  });

  it('turns the robot before moving in another direction', () => {
    const request = createRequest({
      goal: {
        positions: [{ x: 0, y: 2 }],
      },
    });

    const route = getRoute(findRoute(request));

    expect(route.steps.map((step) => step.action)).toEqual(['TURN_RIGHT', 'FORWARD', 'FORWARD']);

    expect(route.steps.at(-1)?.position).toEqual({
      x: 0,
      y: 2,
    });
  });

  it('finds a route requiring a 180-degree turn', () => {
    const request = createRequest({
      robot: createRobot({
        position: { x: 2, y: 0 },
        direction: 'RIGHT',
      }),
      goal: {
        positions: [{ x: 0, y: 0 }],
      },
    });

    const route = getRoute(findRoute(request));

    expect(route.steps).toHaveLength(4);

    expect(
      route.steps.filter((step) => step.action === 'TURN_LEFT' || step.action === 'TURN_RIGHT'),
    ).toHaveLength(2);

    expect(route.steps.at(-1)?.position).toEqual({
      x: 0,
      y: 0,
    });

    expect(route.steps.at(-1)?.direction).toBe('LEFT');
  });

  // Obstacles and grid boundaries

  it('finds a route around an obstacle', () => {
    const request = createRequest({
      grid: {
        width: 5,
        height: 5,
        obstacles: [{ x: 1, y: 0 }],
        stations: [],
      },
    });

    const route = getRoute(findRoute(request));

    expect(route.steps.at(-1)?.position).toEqual({
      x: 3,
      y: 0,
    });

    expect(route.steps.some((step) => step.position.x === 1 && step.position.y === 0)).toBe(false);

    expect(route.steps).toHaveLength(8);
  });

  it('keeps every route step inside the grid', () => {
    const request = createRequest({
      robot: createRobot({
        direction: 'UP',
      }),
    });

    const route = getRoute(findRoute(request));

    for (const step of route.steps) {
      expect(step.position.x).toBeGreaterThanOrEqual(0);
      expect(step.position.y).toBeGreaterThanOrEqual(0);
      expect(step.position.x).toBeLessThan(request.grid.width);
      expect(step.position.y).toBeLessThan(request.grid.height);
    }
  });

  // Goal positions and orientation

  it('selects the nearest reachable goal position', () => {
    const request = createRequest({
      goal: {
        positions: [
          { x: 4, y: 0 },
          { x: 2, y: 0 },
        ],
      },
    });

    const route = getRoute(findRoute(request));

    expect(route.steps).toHaveLength(2);

    expect(route.steps.at(-1)?.position).toEqual({
      x: 2,
      y: 0,
    });
  });

  it('selects another goal when one goal is an obstacle', () => {
    const request = createRequest({
      grid: {
        width: 5,
        height: 5,
        obstacles: [{ x: 1, y: 0 }],
        stations: [],
      },
      goal: {
        positions: [
          { x: 1, y: 0 },
          { x: 0, y: 2 },
        ],
      },
    });

    const route = getRoute(findRoute(request));

    expect(route.steps.at(-1)?.position).toEqual({
      x: 0,
      y: 2,
    });
  });

  it('does not require a specific final direction by default', () => {
    const route = getRoute(findRoute(createRequest()));

    expect(route.steps).toHaveLength(3);
    expect(route.steps.at(-1)?.direction).toBe('RIGHT');
  });

  it('reaches the required final direction', () => {
    const request = createRequest({
      goal: {
        positions: [{ x: 3, y: 0 }],
        direction: 'DOWN',
      },
    });

    const route = getRoute(findRoute(request));

    expect(route.steps).toHaveLength(4);

    expect(route.steps.at(-1)).toEqual({
      tick: 4,
      action: 'TURN_RIGHT',
      position: { x: 3, y: 0 },
      direction: 'DOWN',
    });
  });

  it('turns in place when already at the goal position', () => {
    const request = createRequest({
      goal: {
        positions: [{ x: 0, y: 0 }],
        direction: 'DOWN',
      },
    });

    const route = getRoute(findRoute(request));

    expect(route.steps).toEqual([
      {
        tick: 1,
        action: 'TURN_RIGHT',
        position: { x: 0, y: 0 },
        direction: 'DOWN',
      },
    ]);
  });

  it('returns a non-empty route when already at the goal', () => {
    const request = createRequest({
      goal: {
        positions: [{ x: 0, y: 0 }],
      },
    });

    const route = getRoute(findRoute(request));

    expect(route.steps).toHaveLength(1);

    expect(route.steps.at(-1)?.position).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('waits when already at the goal with the required direction', () => {
    const request = createRequest({
      goal: {
        positions: [{ x: 0, y: 0 }],
        direction: 'RIGHT',
      },
    });

    const route = getRoute(findRoute(request));

    expect(route.steps).toEqual([
      {
        tick: 1,
        action: 'WAIT',
        position: { x: 0, y: 0 },
        direction: 'RIGHT',
      },
    ]);
  });

  // Stationary robots

  it('finds a route around a stationary robot', () => {
    const robot = createRobot();

    const blockingRobot = createRobot({
      id: 'robot-b',
      position: { x: 1, y: 0 },
    });

    const request = createRequest({
      robot,
      robots: [robot, blockingRobot],
    });

    const route = getRoute(findRoute(request));

    expect(route.steps.at(-1)?.position).toEqual({
      x: 3,
      y: 0,
    });

    expect(route.steps.some((step) => step.position.x === 1 && step.position.y === 0)).toBe(false);
  });

  it.each(['fault', 'waiting'] as const)(
    'treats a %s robot as stationary even if it has a route',
    (status) => {
      const robot = createRobot();

      const blockingRobot = createRobot({
        id: 'robot-b',
        position: { x: 1, y: 0 },
        status,
      });

      const blockingRoute: RobotRoute = {
        robotId: blockingRobot.id,
        startTick: 0,
        steps: [
          {
            tick: 1,
            action: 'FORWARD',
            position: { x: 2, y: 0 },
            direction: 'RIGHT',
          },
        ],
      };

      const request = createRequest({
        robot,
        robots: [robot, blockingRobot],
        routes: [blockingRoute],
      });

      const route = getRoute(findRoute(request));

      expect(route.steps.some((step) => step.position.x === 1 && step.position.y === 0)).toBe(
        false,
      );

      expect(route.steps.at(-1)?.position).toEqual({
        x: 3,
        y: 0,
      });
    },
  );

  // Moving robots and reservations

  it('allows entering a cell vacated by another robot', () => {
    const robot = createRobot();

    const movingRobot = createRobot({
      id: 'robot-b',
      position: { x: 1, y: 0 },
      status: 'busy',
    });

    const movingRoute: RobotRoute = {
      robotId: movingRobot.id,
      startTick: 0,
      steps: [
        {
          tick: 1,
          action: 'FORWARD',
          position: { x: 2, y: 0 },
          direction: 'RIGHT',
        },
      ],
    };

    const request = createRequest({
      robot,
      robots: [robot, movingRobot],
      routes: [movingRoute],
      goal: {
        positions: [{ x: 1, y: 0 }],
      },
    });

    const route = getRoute(findRoute(request));

    expect(route.steps).toHaveLength(1);
    expect(route.steps[0].action).toBe('FORWARD');
    expect(route.steps[0].position).toEqual({ x: 1, y: 0 });
  });

  it('waits until another robot releases a reserved cell', () => {
    const robot = createRobot();

    const movingRobot = createRobot({
      id: 'robot-b',
      position: { x: 1, y: 0 },
      status: 'busy',
    });

    const movingRoute: RobotRoute = {
      robotId: movingRobot.id,
      startTick: 0,
      steps: [
        {
          tick: 1,
          action: 'WAIT',
          position: { x: 1, y: 0 },
          direction: 'RIGHT',
        },
        {
          tick: 2,
          action: 'FORWARD',
          position: { x: 2, y: 0 },
          direction: 'RIGHT',
        },
      ],
    };

    const request = createRequest({
      robot,
      robots: [robot, movingRobot],
      routes: [movingRoute],
      goal: {
        positions: [{ x: 1, y: 0 }],
      },
    });

    const route = getRoute(findRoute(request));

    expect(route.steps.map((step) => step.action)).toEqual(['WAIT', 'FORWARD']);
  });

  it('rejects a head-on swap between two robots', () => {
    const robot = createRobot();

    const movingRobot = createRobot({
      id: 'robot-b',
      position: { x: 1, y: 0 },
      direction: 'LEFT',
      status: 'busy',
    });

    const movingRoute: RobotRoute = {
      robotId: movingRobot.id,
      startTick: 0,
      steps: [
        {
          tick: 1,
          action: 'FORWARD',
          position: { x: 0, y: 0 },
          direction: 'LEFT',
        },
      ],
    };

    const request = createRequest({
      robot,
      robots: [robot, movingRobot],
      routes: [movingRoute],
      grid: {
        width: 2,
        height: 1,
        obstacles: [],
        stations: [],
      },
      goal: {
        positions: [{ x: 1, y: 0 }],
      },
    });

    expect(findRoute(request)).toEqual({
      success: false,
      reason: 'BLOCKED',
    });
  });

  // Goal safety

  it('does not finish at a goal reserved by another robot in the future', () => {
    const robot = createRobot();

    const movingRobot = createRobot({
      id: 'robot-b',
      position: { x: 3, y: 0 },
      direction: 'LEFT',
      status: 'busy',
    });

    const movingRoute: RobotRoute = {
      robotId: movingRobot.id,
      startTick: 0,
      steps: [
        {
          tick: 1,
          action: 'FORWARD',
          position: { x: 2, y: 0 },
          direction: 'LEFT',
        },
        {
          tick: 2,
          action: 'FORWARD',
          position: { x: 1, y: 0 },
          direction: 'LEFT',
        },
        {
          tick: 3,
          action: 'TURN_LEFT',
          position: { x: 1, y: 0 },
          direction: 'DOWN',
        },
        {
          tick: 4,
          action: 'FORWARD',
          position: { x: 1, y: 1 },
          direction: 'DOWN',
        },
      ],
    };

    const request = createRequest({
      robot,
      robots: [robot, movingRobot],
      routes: [movingRoute],
      goal: {
        positions: [{ x: 1, y: 0 }],
      },
    });

    const route = getRoute(findRoute(request));

    expect(route.steps.at(-1)?.position).toEqual({
      x: 1,
      y: 0,
    });

    expect(route.steps.at(-1)?.tick).toBeGreaterThanOrEqual(4);
  });

  it('does not finish at a permanently occupied goal', () => {
    const robot = createRobot();

    const blockingRobot = createRobot({
      id: 'robot-b',
      position: { x: 3, y: 0 },
    });

    const request = createRequest({
      robot,
      robots: [robot, blockingRobot],
      maxSearchTicks: 6,
    });

    expect(findRoute(request)).toEqual({
      success: false,
      reason: 'SEARCH_LIMIT',
    });
  });

  // Search horizon

  it('finds a route ending exactly at the search horizon', () => {
    const request = createRequest({
      maxSearchTicks: 3,
    });

    const route = getRoute(findRoute(request));

    expect(route.steps).toHaveLength(3);
    expect(route.steps.at(-1)?.tick).toBe(3);
  });

  it('returns SEARCH_LIMIT when the horizon is too short', () => {
    const request = createRequest({
      maxSearchTicks: 2,
    });

    expect(findRoute(request)).toEqual({
      success: false,
      reason: 'SEARCH_LIMIT',
    });
  });

  it('returns SEARCH_LIMIT when the search horizon is zero', () => {
    const request = createRequest({
      maxSearchTicks: 0,
    });

    expect(findRoute(request)).toEqual({
      success: false,
      reason: 'SEARCH_LIMIT',
    });
  });

  it('respects the search horizon with a non-zero current tick', () => {
    const request = createRequest({
      currentTick: 100,
      maxSearchTicks: 3,
    });

    const route = getRoute(findRoute(request));

    expect(route.startTick).toBe(100);
    expect(route.steps.at(-1)?.tick).toBe(103);
  });

  // Failure reasons

  it('returns NO_PATH when static obstacles separate the goal', () => {
    const request = createRequest({
      grid: {
        width: 5,
        height: 5,
        obstacles: [
          { x: 2, y: 0 },
          { x: 2, y: 1 },
          { x: 2, y: 2 },
          { x: 2, y: 3 },
          { x: 2, y: 4 },
        ],
        stations: [],
      },
      maxSearchTicks: 6,
    });

    expect(findRoute(request)).toEqual({
      success: false,
      reason: 'NO_PATH',
    });
  });

  it('returns NO_PATH when the goal is outside the grid', () => {
    const request = createRequest({
      goal: {
        positions: [{ x: 5, y: 5 }],
      },
      maxSearchTicks: 5,
    });

    expect(findRoute(request)).toEqual({
      success: false,
      reason: 'NO_PATH',
    });
  });

  it('returns NO_PATH when the goal is an obstacle', () => {
    const request = createRequest({
      grid: {
        width: 5,
        height: 5,
        obstacles: [{ x: 3, y: 0 }],
        stations: [],
      },
      maxSearchTicks: 5,
    });

    expect(findRoute(request)).toEqual({
      success: false,
      reason: 'NO_PATH',
    });
  });

  it('returns NO_PATH when no goal positions are provided', () => {
    const request = createRequest({
      goal: {
        positions: [],
      },
      maxSearchTicks: 5,
    });

    expect(findRoute(request)).toEqual({
      success: false,
      reason: 'NO_PATH',
    });
  });

  it('prioritizes NO_PATH over SEARCH_LIMIT', () => {
    const request = createRequest({
      goal: {
        positions: [{ x: 5, y: 5 }],
      },
      maxSearchTicks: 0,
    });

    expect(findRoute(request)).toEqual({
      success: false,
      reason: 'NO_PATH',
    });
  });

  it('returns SEARCH_LIMIT when a faulty robot blocks a corridor', () => {
    const robot = createRobot();

    const blockingRobot = createRobot({
      id: 'robot-b',
      position: { x: 1, y: 0 },
      status: 'fault',
    });

    const request = createRequest({
      robot,
      robots: [robot, blockingRobot],
      grid: {
        width: 5,
        height: 1,
        obstacles: [],
        stations: [],
      },
      maxSearchTicks: 5,
    });

    expect(findRoute(request)).toEqual({
      success: false,
      reason: 'SEARCH_LIMIT',
    });
  });

  // Immutability

  it('does not mutate the routing request on success', () => {
    const request = createRequest();
    const original = structuredClone(request);

    getRoute(findRoute(request));

    expect(request).toEqual(original);
  });

  it('does not mutate the routing request on failure', () => {
    const request = createRequest({
      maxSearchTicks: 1,
    });

    const original = structuredClone(request);

    expect(findRoute(request).success).toBe(false);
    expect(request).toEqual(original);
  });

  it('returns the same route for identical requests', () => {
    const request = createRequest();

    expect(findRoute(request)).toEqual(findRoute(request));
  });
});
