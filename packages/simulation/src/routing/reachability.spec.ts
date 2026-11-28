import { describe, expect, it } from 'vitest';

import type { RobotState } from '../contracts';
import type { RoutingRequest } from './types';

import { isGoalReachable } from './reachability';

function createRobot(overrides: Partial<RobotState> = {}): RobotState {
  return {
    id: 'robot-a',
    position: { x: 0, y: 0 },
    direction: 'UP',
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
      positions: [{ x: 4, y: 4 }],
    },
    currentTick: 0,
    robots: [robot],
    routes: [],
    maxSearchTicks: 10,
    ...overrides,
  };
}

describe('isGoalReachable', () => {
  it('returns true when the goal is reachable on an empty grid', () => {
    expect(isGoalReachable(createRequest())).toBe(true);
  });

  it('returns true when the robot is already at the goal', () => {
    const request = createRequest({
      goal: {
        positions: [{ x: 0, y: 0 }],
      },
    });

    expect(isGoalReachable(request)).toBe(true);
  });

  it('returns true when a path exists around an obstacle', () => {
    const request = createRequest({
      grid: {
        width: 5,
        height: 5,
        obstacles: [{ x: 1, y: 0 }],
        stations: [],
      },
    });

    expect(isGoalReachable(request)).toBe(true);
  });

  it('returns false when a wall separates the robot from the goal', () => {
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
    });

    expect(isGoalReachable(request)).toBe(false);
  });

  it('returns true when a wall contains an opening', () => {
    const request = createRequest({
      grid: {
        width: 5,
        height: 5,
        obstacles: [
          { x: 2, y: 0 },
          { x: 2, y: 1 },
          { x: 2, y: 3 },
          { x: 2, y: 4 },
        ],
        stations: [],
      },
    });

    expect(isGoalReachable(request)).toBe(true);
  });

  it('returns false when the robot is surrounded by obstacles', () => {
    const request = createRequest({
      robot: createRobot({
        position: { x: 2, y: 2 },
      }),
      grid: {
        width: 5,
        height: 5,
        obstacles: [
          { x: 2, y: 1 },
          { x: 3, y: 2 },
          { x: 2, y: 3 },
          { x: 1, y: 2 },
        ],
        stations: [],
      },
    });

    expect(isGoalReachable(request)).toBe(false);
  });

  it('returns false when the goal is an obstacle', () => {
    const request = createRequest({
      grid: {
        width: 5,
        height: 5,
        obstacles: [{ x: 4, y: 4 }],
        stations: [],
      },
    });

    expect(isGoalReachable(request)).toBe(false);
  });

  it('returns false when the goal is outside the grid', () => {
    const request = createRequest({
      goal: {
        positions: [{ x: 5, y: 5 }],
      },
    });

    expect(isGoalReachable(request)).toBe(false);
  });

  it('returns false when no goal positions are provided', () => {
    const request = createRequest({
      goal: {
        positions: [],
      },
    });

    expect(isGoalReachable(request)).toBe(false);
  });

  it('returns true when at least one goal position is reachable', () => {
    const request = createRequest({
      grid: {
        width: 5,
        height: 5,
        obstacles: [{ x: 4, y: 4 }],
        stations: [],
      },
      goal: {
        positions: [
          { x: 4, y: 4 },
          { x: 3, y: 3 },
        ],
      },
    });

    expect(isGoalReachable(request)).toBe(true);
  });

  it('returns false when all goal positions are unreachable', () => {
    const request = createRequest({
      grid: {
        width: 5,
        height: 5,
        obstacles: [
          { x: 4, y: 4 },
          { x: 3, y: 3 },
        ],
        stations: [],
      },
      goal: {
        positions: [
          { x: 4, y: 4 },
          { x: 3, y: 3 },
        ],
      },
    });

    expect(isGoalReachable(request)).toBe(false);
  });

  it('ignores the required goal direction', () => {
    const request = createRequest({
      goal: {
        positions: [{ x: 0, y: 0 }],
        direction: 'DOWN',
      },
    });

    expect(isGoalReachable(request)).toBe(true);
  });

  it('ignores the search horizon', () => {
    const request = createRequest({
      maxSearchTicks: 0,
    });

    expect(isGoalReachable(request)).toBe(true);
  });

  it('ignores other robots blocking the path', () => {
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
      goal: {
        positions: [{ x: 4, y: 0 }],
      },
    });

    expect(isGoalReachable(request)).toBe(true);
  });

  it('does not mutate the routing request', () => {
    const request = createRequest();
    const original = structuredClone(request);

    isGoalReachable(request);

    expect(request).toEqual(original);
  });
});
