import { describe, it, expect } from 'vitest';

import { tick } from './tick';

import type { SimulationState } from './types';
import type { RobotState, RobotRoute, RouteStep } from '../contracts';

function createState(overrides: Partial<SimulationState> = {}): SimulationState {
  return {
    tick: 0,
    config: {
      cargoHandlingTicks: 2,
    },
    grid: {
      width: 20,
      height: 20,
      obstacles: [],
      stations: [],
    },
    robotConfigs: [],
    robots: [],
    routes: [],
    tasks: [],
    ...overrides,
  };
}

function createRobot(overrides: Partial<RobotState> = {}): RobotState {
  return {
    id: 'robot-1',
    position: { x: 2, y: 3 },
    direction: 'UP',
    status: 'idle',
    ...overrides,
  };
}

function createRoute(robotId: string, steps: readonly RouteStep[], startTick = 0): RobotRoute {
  return {
    robotId,
    startTick,
    steps,
  };
}

describe('tick', () => {
  // Basic simulation behavior

  it('should increment tick on an empty grid', () => {
    const state = createState();

    const result = tick(state);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.state.tick).toBe(1);
      expect(result.events).toEqual([]);
    }

    expect(state.tick).toBe(0);
  });

  it('should keep a robot without a route stationary', () => {
    const robot = createRobot();

    const state = createState({
      robots: [robot],
    });

    const result = tick(state);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.state.tick).toBe(1);
      expect(result.state.robots).toEqual([robot]);
      expect(result.state.routes).toEqual([]);
      expect(result.events).toEqual([]);
    }
  });

  // Robot actions

  it('should move a robot forward', () => {
    const robot = createRobot();

    const route = createRoute(robot.id, [
      {
        tick: 1,
        action: 'FORWARD',
        position: { x: 2, y: 2 },
        direction: 'UP',
      },
      {
        tick: 2,
        action: 'FORWARD',
        position: { x: 2, y: 1 },
        direction: 'UP',
      },
    ]);

    const state = createState({
      robots: [robot],
      routes: [route],
    });

    const result = tick(state);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.state.robots[0].position).toEqual({
        x: 2,
        y: 2,
      });

      expect(result.state.robots[0].direction).toBe('UP');

      expect(result.events).toEqual([
        {
          type: 'ROBOT_MOVED',
          robotId: robot.id,
          position: { x: 2, y: 2 },
          direction: 'UP',
        },
      ]);

      expect(result.state.routes).toEqual([route]);
    }
  });

  it('should turn a robot left', () => {
    const robot = createRobot();

    const state = createState({
      robots: [robot],
      routes: [
        createRoute(robot.id, [
          {
            tick: 1,
            action: 'TURN_LEFT',
            position: robot.position,
            direction: 'LEFT',
          },
        ]),
      ],
    });

    const result = tick(state);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.state.robots[0].position).toEqual(robot.position);

      expect(result.state.robots[0].direction).toBe('LEFT');

      expect(result.events).toContainEqual({
        type: 'ROBOT_TURNED',
        robotId: robot.id,
        direction: 'LEFT',
      });
    }
  });

  it('should turn a robot right', () => {
    const robot = createRobot();

    const state = createState({
      robots: [robot],
      routes: [
        createRoute(robot.id, [
          {
            tick: 1,
            action: 'TURN_RIGHT',
            position: robot.position,
            direction: 'RIGHT',
          },
        ]),
      ],
    });

    const result = tick(state);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.state.robots[0].position).toEqual(robot.position);

      expect(result.state.robots[0].direction).toBe('RIGHT');

      expect(result.events).toContainEqual({
        type: 'ROBOT_TURNED',
        robotId: robot.id,
        direction: 'RIGHT',
      });
    }
  });

  it('should keep position and direction during WAIT', () => {
    const robot = createRobot();

    const state = createState({
      robots: [robot],
      routes: [
        createRoute(robot.id, [
          {
            tick: 1,
            action: 'WAIT',
            position: robot.position,
            direction: robot.direction,
          },
          {
            tick: 2,
            action: 'WAIT',
            position: robot.position,
            direction: robot.direction,
          },
        ]),
      ],
    });

    const result = tick(state);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.state.robots[0]).toEqual(robot);
      expect(result.events).toEqual([]);
    }
  });

  // Fault handling

  it('should keep a faulty robot stationary', () => {
    const robot = createRobot({
      status: 'fault',
    });

    const state = createState({
      robots: [robot],
    });

    const result = tick(state);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.state.robots[0]).toEqual(robot);
      expect(result.state.tick).toBe(1);
      expect(result.events).toEqual([]);
    }
  });

  it('should allow other robots to move when a robot is faulty', () => {
    const faultyRobot = createRobot({
      id: 'robot-1',
      status: 'fault',
      position: { x: 0, y: 0 },
    });

    const movingRobot = createRobot({
      id: 'robot-2',
      position: { x: 5, y: 5 },
      direction: 'RIGHT',
    });

    const state = createState({
      robots: [faultyRobot, movingRobot],
      routes: [
        createRoute(movingRobot.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: { x: 6, y: 5 },
            direction: 'RIGHT',
          },
        ]),
      ],
    });

    const result = tick(state);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.state.robots[0]).toEqual(faultyRobot);

      expect(result.state.robots[1].position).toEqual({
        x: 6,
        y: 5,
      });
    }
  });

  // Grid validation

  it('should reject movement outside the grid', () => {
    const robot = createRobot({
      position: { x: 0, y: 0 },
      direction: 'UP',
    });

    const state = createState({
      robots: [robot],
      routes: [
        createRoute(robot.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: { x: 0, y: -1 },
            direction: 'UP',
          },
        ]),
      ],
    });

    const result = tick(state);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.code).toBe('OUT_OF_BOUNDS');
      expect(result.error.robotIds).toEqual([robot.id]);
      expect(result.error.tick).toBe(1);
    }
  });

  it('should reject movement into an obstacle', () => {
    const robot = createRobot();

    const state = createState({
      grid: {
        width: 20,
        height: 20,
        obstacles: [{ x: 2, y: 2 }],
        stations: [],
      },
      robots: [robot],
      routes: [
        createRoute(robot.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: { x: 2, y: 2 },
            direction: 'UP',
          },
        ]),
      ],
    });

    const result = tick(state);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.code).toBe('OBSTACLE_COLLISION');
      expect(result.error.robotIds).toEqual([robot.id]);
      expect(result.error.tick).toBe(1);
    }
  });

  // Robot collisions

  it('should reject two robots moving into the same cell', () => {
    const robotA = createRobot({
      id: 'robot-a',
      position: { x: 1, y: 2 },
      direction: 'RIGHT',
    });

    const robotB = createRobot({
      id: 'robot-b',
      position: { x: 3, y: 2 },
      direction: 'LEFT',
    });

    const state = createState({
      robots: [robotA, robotB],
      routes: [
        createRoute(robotA.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: { x: 2, y: 2 },
            direction: 'RIGHT',
          },
        ]),
        createRoute(robotB.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: { x: 2, y: 2 },
            direction: 'LEFT',
          },
        ]),
      ],
    });

    const result = tick(state);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.code).toBe('ROBOT_COLLISION');
      expect(result.error.robotIds).toEqual([robotA.id, robotB.id]);
      expect(result.error.tick).toBe(1);
    }
  });

  it('should reject movement into a stationary robot', () => {
    const robotA = createRobot({
      id: 'robot-a',
      position: { x: 1, y: 2 },
      direction: 'RIGHT',
    });

    const robotB = createRobot({
      id: 'robot-b',
      position: { x: 2, y: 2 },
    });

    const state = createState({
      robots: [robotA, robotB],
      routes: [
        createRoute(robotA.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: robotB.position,
            direction: 'RIGHT',
          },
        ]),
      ],
    });

    const result = tick(state);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.code).toBe('ROBOT_COLLISION');
    }
  });

  it('should reject movement into a faulty robot', () => {
    const robotA = createRobot({
      id: 'robot-a',
      position: { x: 1, y: 2 },
      direction: 'RIGHT',
    });

    const robotB = createRobot({
      id: 'robot-b',
      position: { x: 2, y: 2 },
      status: 'fault',
    });

    const state = createState({
      robots: [robotA, robotB],
      routes: [
        createRoute(robotA.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: robotB.position,
            direction: 'RIGHT',
          },
        ]),
      ],
    });

    const result = tick(state);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.code).toBe('ROBOT_COLLISION');
    }
  });

  it('should reject robots swapping cells', () => {
    const robotA = createRobot({
      id: 'robot-a',
      position: { x: 1, y: 2 },
      direction: 'RIGHT',
    });

    const robotB = createRobot({
      id: 'robot-b',
      position: { x: 2, y: 2 },
      direction: 'LEFT',
    });

    const state = createState({
      robots: [robotA, robotB],
      routes: [
        createRoute(robotA.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: robotB.position,
            direction: 'RIGHT',
          },
        ]),
        createRoute(robotB.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: robotA.position,
            direction: 'LEFT',
          },
        ]),
      ],
    });

    const result = tick(state);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.code).toBe('EDGE_COLLISION');
      expect(result.error.robotIds).toEqual([robotA.id, robotB.id]);
      expect(result.error.tick).toBe(1);
    }
  });

  it('should allow movement into a cell vacated by another robot', () => {
    const robotA = createRobot({
      id: 'robot-a',
      position: { x: 1, y: 2 },
      direction: 'RIGHT',
    });

    const robotB = createRobot({
      id: 'robot-b',
      position: { x: 2, y: 2 },
      direction: 'RIGHT',
    });

    const state = createState({
      robots: [robotA, robotB],
      routes: [
        createRoute(robotA.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: { x: 2, y: 2 },
            direction: 'RIGHT',
          },
        ]),
        createRoute(robotB.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: { x: 3, y: 2 },
            direction: 'RIGHT',
          },
        ]),
      ],
    });

    const result = tick(state);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.state.robots[0].position).toEqual({
        x: 2,
        y: 2,
      });

      expect(result.state.robots[1].position).toEqual({
        x: 3,
        y: 2,
      });
    }
  });

  // Route validation

  it('should reject movement over multiple cells', () => {
    const robot = createRobot();

    const state = createState({
      robots: [robot],
      routes: [
        createRoute(robot.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: { x: 2, y: 0 },
            direction: 'UP',
          },
        ]),
      ],
    });

    const result = tick(state);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.code).toBe('INVALID_ROUTE');
    }
  });

  it('should reject an invalid turn', () => {
    const robot = createRobot();

    const state = createState({
      robots: [robot],
      routes: [
        createRoute(robot.id, [
          {
            tick: 1,
            action: 'TURN_LEFT',
            position: robot.position,
            direction: 'RIGHT',
          },
        ]),
      ],
    });

    const result = tick(state);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.code).toBe('INVALID_ROUTE');
    }
  });

  it('should reject movement during WAIT', () => {
    const robot = createRobot();

    const state = createState({
      robots: [robot],
      routes: [
        createRoute(robot.id, [
          {
            tick: 1,
            action: 'WAIT',
            position: { x: 2, y: 2 },
            direction: 'UP',
          },
        ]),
      ],
    });

    const result = tick(state);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.code).toBe('INVALID_ROUTE');
    }
  });

  it('should reject a route with a missing step', () => {
    const robot = createRobot();

    const state = createState({
      robots: [robot],
      routes: [
        createRoute(robot.id, [
          {
            tick: 2,
            action: 'FORWARD',
            position: { x: 2, y: 2 },
            direction: 'UP',
          },
        ]),
      ],
    });

    const result = tick(state);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.code).toBe('INVALID_ROUTE');
      expect(result.error.tick).toBe(1);
    }
  });

  // Route lifecycle

  it('should remove a completed route and emit ROUTE_COMPLETED', () => {
    const robot = createRobot();

    const state = createState({
      robots: [robot],
      routes: [
        createRoute(robot.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: { x: 2, y: 2 },
            direction: 'UP',
          },
        ]),
      ],
    });

    const result = tick(state);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.state.routes).toEqual([]);

      expect(result.events).toEqual([
        {
          type: 'ROBOT_MOVED',
          robotId: robot.id,
          position: { x: 2, y: 2 },
          direction: 'UP',
        },
        {
          type: 'ROUTE_COMPLETED',
          robotId: robot.id,
        },
      ]);
    }
  });

  it('should execute a route across multiple ticks', () => {
    const robot = createRobot();

    const state = createState({
      robots: [robot],
      routes: [
        createRoute(robot.id, [
          {
            tick: 1,
            action: 'FORWARD',
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
            action: 'FORWARD',
            position: { x: 3, y: 2 },
            direction: 'RIGHT',
          },
        ]),
      ],
    });

    const first = tick(state);

    expect(first.success).toBe(true);

    if (!first.success) {
      throw new Error(first.error.message);
    }

    expect(first.state.tick).toBe(1);
    expect(first.state.routes).toHaveLength(1);

    const second = tick(first.state);

    expect(second.success).toBe(true);

    if (!second.success) {
      throw new Error(second.error.message);
    }

    expect(second.state.tick).toBe(2);
    expect(second.state.routes).toHaveLength(1);

    const third = tick(second.state);

    expect(third.success).toBe(true);

    if (!third.success) {
      throw new Error(third.error.message);
    }

    expect(third.state.tick).toBe(3);

    expect(third.state.robots[0].position).toEqual({
      x: 3,
      y: 2,
    });

    expect(third.state.robots[0].direction).toBe('RIGHT');
    expect(third.state.routes).toEqual([]);

    expect(third.events).toContainEqual({
      type: 'ROUTE_COMPLETED',
      robotId: robot.id,
    });
  });

  // Atomicity and immutability

  it('should not mutate the original state on success', () => {
    const robot = createRobot();

    const state = createState({
      robots: [robot],
      routes: [
        createRoute(robot.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: { x: 2, y: 2 },
            direction: 'UP',
          },
        ]),
      ],
    });

    const originalState = structuredClone(state);

    const result = tick(state);

    expect(result.success).toBe(true);
    expect(state).toEqual(originalState);
  });

  it('should reject the entire tick without mutating state', () => {
    const robotA = createRobot({
      id: 'robot-a',
      position: { x: 5, y: 5 },
      direction: 'RIGHT',
    });

    const robotB = createRobot({
      id: 'robot-b',
      position: { x: 0, y: 0 },
      direction: 'UP',
    });

    const state = createState({
      robots: [robotA, robotB],
      routes: [
        createRoute(robotA.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: { x: 6, y: 5 },
            direction: 'RIGHT',
          },
        ]),
        createRoute(robotB.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: { x: 0, y: -1 },
            direction: 'UP',
          },
        ]),
      ],
    });

    const originalState = structuredClone(state);

    const result = tick(state);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.code).toBe('OUT_OF_BOUNDS');
    }

    expect(state).toEqual(originalState);
    expect(state.tick).toBe(0);
    expect(state.robots[0].position).toEqual({
      x: 5,
      y: 5,
    });
  });
});
