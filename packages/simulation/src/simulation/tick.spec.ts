import { describe, it, expect } from 'vitest';
import { tick } from './tick';
import type { SimulationState } from './types';
import type { RobotState, RobotRoute, RouteStep, Task } from '../contracts';
import { applyCommand } from './commands';

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
function createTask(
  overrides: Partial<Pick<Task, 'id' | 'pickupStationId' | 'deliveryStationId' | 'robotId'>> = {},
): Task {
  return {
    id: 'task-1',
    pickupStationId: 'pickup-1',
    deliveryStationId: 'delivery-1',
    robotId: 'robot-1',
    status: 'in_progress',
    phase: 'TO_PICKUP',
    ...overrides,
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

  // Task lifecycle integration

  it('should start loading on the same tick the robot arrives', () => {
    const robot = createRobot({
      status: 'busy',
    });

    const task = createTask();

    const state = createState({
      grid: {
        width: 20,
        height: 20,
        obstacles: [],
        stations: [
          {
            id: 'pickup-1',
            serviceCells: [{ x: 2, y: 2 }],
          },
        ],
      },
      robots: [robot],
      tasks: [task],
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
      expect(result.state.tick).toBe(1);
      expect(result.state.routes).toEqual([]);

      expect(result.state.tasks[0]).toEqual({
        ...task,
        phase: 'LOADING',
        remainingHandlingTicks: 2,
      });

      expect(result.state.robots[0].status).toBe('busy');

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
        {
          type: 'LOADING_STARTED',
          taskId: task.id,
          robotId: robot.id,
        },
      ]);
    }
  });

  it('should not start loading while passing through a service cell', () => {
    const robot = createRobot({
      status: 'busy',
    });

    const task = createTask();

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
      grid: {
        width: 20,
        height: 20,
        obstacles: [],
        stations: [
          {
            id: 'pickup-1',
            serviceCells: [{ x: 2, y: 2 }],
          },
        ],
      },
      robots: [robot],
      tasks: [task],
      routes: [route],
    });

    const result = tick(state);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.state.tasks[0]).toEqual(task);
      expect(result.state.routes).toEqual([route]);

      expect(result.events).toEqual([
        {
          type: 'ROBOT_MOVED',
          robotId: robot.id,
          position: { x: 2, y: 2 },
          direction: 'UP',
        },
      ]);
    }
  });

  it('should decrement loading ticks while keeping the robot stationary', () => {
    const robot = createRobot({
      status: 'busy',
    });

    const task: Task = {
      ...createTask(),
      status: 'in_progress',
      phase: 'LOADING',
      remainingHandlingTicks: 2,
      failureReason: undefined,
    };

    const state = createState({
      robots: [robot],
      tasks: [task],
    });

    const result = tick(state);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.state.tick).toBe(1);

      expect(result.state.tasks[0]).toEqual({
        ...task,
        remainingHandlingTicks: 1,
      });

      expect(result.state.robots[0]).toEqual(robot);
      expect(result.events).toEqual([]);
    }
  });

  it('should complete loading and switch to TO_DELIVERY', () => {
    const robot = createRobot({
      status: 'busy',
    });

    const task: Task = {
      ...createTask(),
      status: 'in_progress',
      phase: 'LOADING',
      remainingHandlingTicks: 1,
      failureReason: undefined,
    };

    const state = createState({
      robots: [robot],
      tasks: [task],
    });

    const result = tick(state);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.state.tasks[0]).toEqual({
        id: task.id,
        pickupStationId: task.pickupStationId,
        deliveryStationId: task.deliveryStationId,
        robotId: robot.id,
        status: 'in_progress',
        phase: 'TO_DELIVERY',
      });

      expect(result.state.tasks[0]).not.toHaveProperty('remainingHandlingTicks');

      expect(result.state.robots[0]).toEqual(robot);

      expect(result.events).toEqual([
        {
          type: 'LOADING_COMPLETED',
          taskId: task.id,
          robotId: robot.id,
        },
      ]);
    }
  });

  it('should start unloading on the same tick the robot arrives', () => {
    const robot = createRobot({
      status: 'busy',
      position: { x: 10, y: 11 },
    });

    const task: Task = {
      ...createTask(),
      status: 'in_progress',
      phase: 'TO_DELIVERY',
      remainingHandlingTicks: undefined,
      failureReason: undefined,
    };

    const state = createState({
      grid: {
        width: 20,
        height: 20,
        obstacles: [],
        stations: [
          {
            id: 'delivery-1',
            serviceCells: [{ x: 10, y: 10 }],
          },
        ],
      },
      robots: [robot],
      tasks: [task],
      routes: [
        createRoute(robot.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: { x: 10, y: 10 },
            direction: 'UP',
          },
        ]),
      ],
    });

    const result = tick(state);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.state.routes).toEqual([]);

      expect(result.state.tasks[0]).toEqual({
        id: task.id,
        pickupStationId: task.pickupStationId,
        deliveryStationId: task.deliveryStationId,
        robotId: robot.id,
        status: 'in_progress',
        phase: 'UNLOADING',
        remainingHandlingTicks: 2,
      });

      expect(result.state.robots[0].status).toBe('busy');

      expect(result.events).toEqual([
        {
          type: 'ROBOT_MOVED',
          robotId: robot.id,
          position: { x: 10, y: 10 },
          direction: 'UP',
        },
        {
          type: 'ROUTE_COMPLETED',
          robotId: robot.id,
        },
        {
          type: 'UNLOADING_STARTED',
          taskId: task.id,
          robotId: robot.id,
        },
      ]);
    }
  });

  it('should complete unloading and release the robot', () => {
    const robot = createRobot({
      status: 'busy',
      position: { x: 10, y: 10 },
    });

    const task: Task = {
      ...createTask(),
      status: 'in_progress',
      phase: 'UNLOADING',
      remainingHandlingTicks: 1,
      failureReason: undefined,
    };

    const state = createState({
      robots: [robot],
      tasks: [task],
    });

    const result = tick(state);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.state.tasks[0]).toEqual({
        id: task.id,
        pickupStationId: task.pickupStationId,
        deliveryStationId: task.deliveryStationId,
        robotId: robot.id,
        status: 'completed',
      });

      expect(result.state.robots[0]).toEqual({
        ...robot,
        status: 'idle',
        waitingReason: undefined,
      });

      expect(result.events).toEqual([
        {
          type: 'TASK_COMPLETED',
          taskId: task.id,
          robotId: robot.id,
        },
      ]);
    }
  });

  it('should execute the full active task lifecycle across multiple ticks', () => {
    const robot = createRobot({
      status: 'busy',
    });

    const task = createTask();

    const initialState = createState({
      grid: {
        width: 20,
        height: 20,
        obstacles: [],
        stations: [
          {
            id: 'pickup-1',
            serviceCells: [{ x: 2, y: 2 }],
          },
          {
            id: 'delivery-1',
            serviceCells: [{ x: 2, y: 0 }],
          },
        ],
      },
      robots: [robot],
      tasks: [task],
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

    let state = initialState;

    // Tick 1: arrive at pickup station

    const first = tick(state);

    if (!first.success) {
      throw new Error(first.error.message);
    }

    state = first.state;

    expect(state.tick).toBe(1);
    expect(state.tasks[0].phase).toBe('LOADING');
    expect(state.tasks[0].remainingHandlingTicks).toBe(2);
    expect(state.routes).toEqual([]);

    // Tick 2: loading

    const second = tick(state);

    if (!second.success) {
      throw new Error(second.error.message);
    }

    state = second.state;

    expect(state.tick).toBe(2);
    expect(state.tasks[0].phase).toBe('LOADING');
    expect(state.tasks[0].remainingHandlingTicks).toBe(1);
    expect(state.robots[0].position).toEqual({ x: 2, y: 2 });

    // Tick 3: loading completed

    const third = tick(state);

    if (!third.success) {
      throw new Error(third.error.message);
    }

    state = third.state;

    expect(state.tick).toBe(3);
    expect(state.tasks[0].phase).toBe('TO_DELIVERY');

    expect(third.events).toContainEqual({
      type: 'LOADING_COMPLETED',
      taskId: task.id,
      robotId: robot.id,
    });

    // Simulate assigning a delivery route

    state = {
      ...state,
      routes: [
        createRoute(
          robot.id,
          [
            {
              tick: 4,
              action: 'FORWARD',
              position: { x: 2, y: 1 },
              direction: 'UP',
            },
            {
              tick: 5,
              action: 'FORWARD',
              position: { x: 2, y: 0 },
              direction: 'UP',
            },
          ],
          state.tick,
        ),
      ],
    };

    // Tick 4: moving to delivery station

    const fourth = tick(state);

    if (!fourth.success) {
      throw new Error(fourth.error.message);
    }

    state = fourth.state;

    expect(state.tick).toBe(4);
    expect(state.tasks[0].phase).toBe('TO_DELIVERY');

    // Tick 5: arrive at delivery station

    const fifth = tick(state);

    if (!fifth.success) {
      throw new Error(fifth.error.message);
    }

    state = fifth.state;

    expect(state.tick).toBe(5);
    expect(state.tasks[0].phase).toBe('UNLOADING');
    expect(state.tasks[0].remainingHandlingTicks).toBe(2);
    expect(state.routes).toEqual([]);

    // Tick 6: unloading

    const sixth = tick(state);

    if (!sixth.success) {
      throw new Error(sixth.error.message);
    }

    state = sixth.state;

    expect(state.tick).toBe(6);
    expect(state.tasks[0].phase).toBe('UNLOADING');
    expect(state.tasks[0].remainingHandlingTicks).toBe(1);
    expect(state.robots[0].status).toBe('busy');

    // Tick 7: task completed

    const seventh = tick(state);

    if (!seventh.success) {
      throw new Error(seventh.error.message);
    }

    state = seventh.state;

    expect(state.tick).toBe(7);
    expect(state.tasks[0].status).toBe('completed');
    expect(state.tasks[0]).not.toHaveProperty('phase');

    expect(state.tasks[0]).not.toHaveProperty('remainingHandlingTicks');

    expect(state.robots[0].status).toBe('idle');
    expect(state.robots[0].position).toEqual({ x: 2, y: 0 });
    expect(state.routes).toEqual([]);

    expect(seventh.events).toEqual([
      {
        type: 'TASK_COMPLETED',
        taskId: task.id,
        robotId: robot.id,
      },
    ]);
  });

  it('should not process tasks when the tick fails safety validation', () => {
    const loadingRobot = createRobot({
      id: 'robot-1',
      status: 'busy',
    });

    const movingRobot = createRobot({
      id: 'robot-2',
      position: { x: 0, y: 0 },
      direction: 'UP',
    });

    const task: Task = {
      ...createTask({
        robotId: loadingRobot.id,
      }),
      status: 'in_progress',
      phase: 'LOADING',
      remainingHandlingTicks: 1,
      failureReason: undefined,
    };

    const state = createState({
      robots: [loadingRobot, movingRobot],
      tasks: [task],
      routes: [
        createRoute(movingRobot.id, [
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
    expect(state.tasks[0].phase).toBe('LOADING');
    expect(state.tasks[0].remainingHandlingTicks).toBe(1);
  });
  // Cargo handling safety

  it.each(['LOADING', 'UNLOADING'] as const)('should reject route execution during %s', (phase) => {
    const robot = createRobot({
      status: 'busy',
    });

    const task: Task = {
      ...createTask(),
      status: 'in_progress',
      phase,
      remainingHandlingTicks: 2,
      failureReason: undefined,
    };

    const state = createState({
      robots: [robot],
      tasks: [task],
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

    expect(result).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_ROUTE',
        robotIds: [robot.id],
        tick: 1,
        message: expect.stringContaining('handling cargo'),
      },
    });

    expect(state).toEqual(originalState);
  });

  it('should reject a WAIT route during cargo handling', () => {
    const robot = createRobot({
      status: 'busy',
    });

    const task: Task = {
      ...createTask(),
      status: 'in_progress',
      phase: 'LOADING',
      remainingHandlingTicks: 2,
      failureReason: undefined,
    };

    const state = createState({
      robots: [robot],
      tasks: [task],
      routes: [
        createRoute(robot.id, [
          {
            tick: 1,
            action: 'WAIT',
            position: robot.position,
            direction: robot.direction,
          },
        ]),
      ],
    });

    const result = tick(state);

    expect(result).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_ROUTE',
        robotIds: [robot.id],
        tick: 1,
      },
    });
  });

  it('should allow other robots to move during cargo handling', () => {
    const loadingRobot = createRobot({
      id: 'robot-1',
      status: 'busy',
    });

    const movingRobot = createRobot({
      id: 'robot-2',
      position: { x: 10, y: 10 },
    });

    const task: Task = {
      ...createTask({
        robotId: loadingRobot.id,
      }),
      status: 'in_progress',
      phase: 'LOADING',
      remainingHandlingTicks: 2,
      failureReason: undefined,
    };

    const state = createState({
      robots: [loadingRobot, movingRobot],
      tasks: [task],
      routes: [
        createRoute(movingRobot.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: { x: 10, y: 9 },
            direction: 'UP',
          },
        ]),
      ],
    });

    const result = tick(state);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.state.tick).toBe(1);

      expect(result.state.robots[0]).toEqual(loadingRobot);

      expect(result.state.robots[1].position).toEqual({
        x: 10,
        y: 9,
      });

      expect(result.state.tasks[0]).toEqual({
        ...task,
        remainingHandlingTicks: 1,
      });

      expect(result.state.routes).toEqual([]);

      expect(result.events).toEqual([
        {
          type: 'ROBOT_MOVED',
          robotId: movingRobot.id,
          position: { x: 10, y: 9 },
          direction: 'UP',
        },
        {
          type: 'ROUTE_COMPLETED',
          robotId: movingRobot.id,
        },
      ]);
    }
  });

  it('should reject the entire tick when a robot has a route during cargo handling', () => {
    const movingRobot = createRobot({
      id: 'robot-1',
    });

    const loadingRobot = createRobot({
      id: 'robot-2',
      status: 'busy',
      position: { x: 10, y: 10 },
    });

    const task: Task = {
      ...createTask({
        robotId: loadingRobot.id,
      }),
      status: 'in_progress',
      phase: 'LOADING',
      remainingHandlingTicks: 1,
      failureReason: undefined,
    };

    const state = createState({
      robots: [movingRobot, loadingRobot],
      tasks: [task],
      routes: [
        createRoute(movingRobot.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: { x: 2, y: 2 },
            direction: 'UP',
          },
        ]),
        createRoute(loadingRobot.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: { x: 10, y: 9 },
            direction: 'UP',
          },
        ]),
      ],
    });

    const originalState = structuredClone(state);

    const result = tick(state);

    expect(result).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_ROUTE',
        robotIds: [loadingRobot.id],
        tick: 1,
      },
    });

    expect(state).toEqual(originalState);
    expect(state.tick).toBe(0);
    expect(state.robots[0]).toEqual(movingRobot);
    expect(state.robots[1]).toEqual(loadingRobot);
    expect(state.tasks[0].remainingHandlingTicks).toBe(1);
  });
  // Fault and restoration integration

  it.each(['LOADING', 'UNLOADING'] as const)(
    'should resume %s after robot restoration',
    (phase) => {
      const robot = createRobot({
        status: 'busy',
      });

      const task: Task = {
        ...createTask(),
        status: 'in_progress',
        phase,
        remainingHandlingTicks: 2,
        failureReason: undefined,
      };

      let state = createState({
        robots: [robot],
        tasks: [task],
      });

      // Tick 1: process cargo

      const first = tick(state);

      if (!first.success) {
        throw new Error(first.error.message);
      }

      state = first.state;

      expect(state.tick).toBe(1);
      expect(state.tasks[0].remainingHandlingTicks).toBe(1);

      // Fault the robot

      const fault = applyCommand(state, {
        type: 'FAULT_ROBOT',
        robotId: robot.id,
      });

      if (!fault.success) {
        throw new Error(fault.error.message);
      }

      state = fault.state;

      expect(state.robots[0].status).toBe('fault');
      expect(state.tasks[0].phase).toBe(phase);
      expect(state.tasks[0].remainingHandlingTicks).toBe(1);
      expect(state.routes).toEqual([]);

      // Ticks 2 and 3: cargo handling is paused

      for (let i = 0; i < 2; i++) {
        const result = tick(state);

        if (!result.success) {
          throw new Error(result.error.message);
        }

        state = result.state;

        expect(state.robots[0].status).toBe('fault');
        expect(state.robots[0].position).toEqual(robot.position);
        expect(state.tasks[0].phase).toBe(phase);
        expect(state.tasks[0].remainingHandlingTicks).toBe(1);
        expect(result.events).toEqual([]);
      }

      expect(state.tick).toBe(3);

      // Restore the robot

      const restore = applyCommand(state, {
        type: 'RESTORE_ROBOT',
        robotId: robot.id,
      });

      if (!restore.success) {
        throw new Error(restore.error.message);
      }

      state = restore.state;

      expect(state.robots[0].status).toBe('busy');
      expect(state.robots[0].waitingReason).toBeUndefined();
      expect(state.tasks[0].phase).toBe(phase);
      expect(state.tasks[0].remainingHandlingTicks).toBe(1);
      expect(state.routes).toEqual([]);
      expect(state.tick).toBe(3);

      // Tick 4: complete cargo handling

      const final = tick(state);

      if (!final.success) {
        throw new Error(final.error.message);
      }

      state = final.state;

      expect(state.tick).toBe(4);
      expect(state.robots[0].position).toEqual(robot.position);
      expect(state.routes).toEqual([]);

      expect(state.tasks[0]).not.toHaveProperty('remainingHandlingTicks');

      if (phase === 'LOADING') {
        expect(state.tasks[0].status).toBe('in_progress');
        expect(state.tasks[0].phase).toBe('TO_DELIVERY');
        expect(state.robots[0].status).toBe('busy');

        expect(final.events).toEqual([
          {
            type: 'LOADING_COMPLETED',
            taskId: task.id,
            robotId: robot.id,
          },
        ]);
      } else {
        expect(state.tasks[0].status).toBe('completed');
        expect(state.tasks[0]).not.toHaveProperty('phase');
        expect(state.robots[0].status).toBe('idle');

        expect(final.events).toEqual([
          {
            type: 'TASK_COMPLETED',
            taskId: task.id,
            robotId: robot.id,
          },
        ]);
      }
    },
  );

  it('should resume movement after restoration and route assignment', () => {
    const robot = createRobot({
      status: 'busy',
    });

    const task = createTask();

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

    let state = createState({
      grid: {
        width: 20,
        height: 20,
        obstacles: [],
        stations: [
          {
            id: 'pickup-1',
            serviceCells: [{ x: 2, y: 1 }],
          },
        ],
      },
      robots: [robot],
      tasks: [task],
      routes: [route],
    });

    // Tick 1: move towards the pickup station

    const first = tick(state);

    if (!first.success) {
      throw new Error(first.error.message);
    }

    state = first.state;

    expect(state.tick).toBe(1);
    expect(state.robots[0].position).toEqual({ x: 2, y: 2 });
    expect(state.routes).toEqual([route]);

    // Fault the robot during movement

    const fault = applyCommand(state, {
      type: 'FAULT_ROBOT',
      robotId: robot.id,
    });

    if (!fault.success) {
      throw new Error(fault.error.message);
    }

    state = fault.state;

    expect(state.robots[0].status).toBe('fault');
    expect(state.routes).toEqual([]);
    expect(state.tasks).toEqual([task]);

    // Tick 2: the faulty robot remains stationary

    const second = tick(state);

    if (!second.success) {
      throw new Error(second.error.message);
    }

    state = second.state;

    expect(state.tick).toBe(2);
    expect(state.robots[0].status).toBe('fault');
    expect(state.robots[0].position).toEqual({ x: 2, y: 2 });
    expect(state.tasks).toEqual([task]);
    expect(second.events).toEqual([]);

    // Restore the robot

    const restore = applyCommand(state, {
      type: 'RESTORE_ROBOT',
      robotId: robot.id,
    });

    if (!restore.success) {
      throw new Error(restore.error.message);
    }

    state = restore.state;

    expect(state.robots[0].status).toBe('waiting');
    expect(state.robots[0].waitingReason).toBe('WAITING_FOR_PATH');
    expect(state.routes).toEqual([]);
    expect(state.tasks).toEqual([task]);

    // Tick 3: wait for a new route

    const third = tick(state);

    if (!third.success) {
      throw new Error(third.error.message);
    }

    state = third.state;

    expect(state.tick).toBe(3);
    expect(state.robots[0].status).toBe('waiting');
    expect(state.robots[0].waitingReason).toBe('WAITING_FOR_PATH');
    expect(state.robots[0].position).toEqual({ x: 2, y: 2 });
    expect(state.robots[0].direction).toBe('UP');
    expect(state.tasks).toEqual([task]);
    expect(state.routes).toEqual([]);
    expect(third.events).toEqual([]);
    // Assign a new route to the restored robot

    const newRoute = createRoute(
      robot.id,
      [
        {
          tick: 4,
          action: 'FORWARD',
          position: { x: 2, y: 1 },
          direction: 'UP',
        },
      ],
      state.tick,
    );

    const setRoute = applyCommand(state, {
      type: 'SET_ROUTE',
      route: newRoute,
    });

    if (!setRoute.success) {
      throw new Error(setRoute.error.message);
    }

    state = setRoute.state;

    expect(state.tick).toBe(3);
    expect(state.robots[0].status).toBe('busy');
    expect(state.robots[0].waitingReason).toBeUndefined();
    expect(state.robots[0].position).toEqual({ x: 2, y: 2 });
    expect(state.routes).toEqual([newRoute]);
    expect(state.tasks).toEqual([task]);
    expect(setRoute.events).toEqual([]);

    // Tick 4: resume movement and arrive at the pickup station

    const fourth = tick(state);

    if (!fourth.success) {
      throw new Error(fourth.error.message);
    }

    state = fourth.state;

    expect(state.tick).toBe(4);
    expect(state.robots[0].status).toBe('busy');
    expect(state.robots[0].waitingReason).toBeUndefined();
    expect(state.robots[0].position).toEqual({ x: 2, y: 1 });
    expect(state.robots[0].direction).toBe('UP');

    expect(state.routes).toEqual([]);

    expect(state.tasks[0]).toEqual({
      ...task,
      phase: 'LOADING',
      remainingHandlingTicks: state.config.cargoHandlingTicks,
    });

    expect(fourth.events).toEqual([
      {
        type: 'ROBOT_MOVED',
        robotId: robot.id,
        position: { x: 2, y: 1 },
        direction: 'UP',
      },
      {
        type: 'ROUTE_COMPLETED',
        robotId: robot.id,
      },
      {
        type: 'LOADING_STARTED',
        taskId: task.id,
        robotId: robot.id,
      },
    ]);
  });

  // Robot waiting integration

  it('should stop a moving robot and resume its task after assigning a new route', () => {
    const robot = createRobot({
      status: 'busy',
    });

    const task = createTask();

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

    let state = createState({
      grid: {
        width: 20,
        height: 20,
        obstacles: [],
        stations: [
          {
            id: 'pickup-1',
            serviceCells: [{ x: 2, y: 1 }],
          },
        ],
      },
      robots: [robot],
      tasks: [task],
      routes: [route],
    });

    // Tick 1: move towards the pickup station

    const first = tick(state);

    if (!first.success) {
      throw new Error(first.error.message);
    }

    state = first.state;

    expect(state.tick).toBe(1);
    expect(state.robots[0].position).toEqual({ x: 2, y: 2 });
    expect(state.routes).toEqual([route]);

    // Stop the robot

    const stop = applyCommand(state, {
      type: 'SET_ROBOT_WAITING',
      robotId: robot.id,
      reason: 'BLOCKED',
    });

    if (!stop.success) {
      throw new Error(stop.error.message);
    }

    state = stop.state;

    expect(state.robots[0].status).toBe('waiting');
    expect(state.robots[0].waitingReason).toBe('BLOCKED');
    expect(state.routes).toEqual([]);
    expect(state.tasks).toEqual([task]);
    expect(state.tick).toBe(1);

    // Ticks 2 and 3: wait for a new route

    for (let i = 0; i < 2; i++) {
      const result = tick(state);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      state = result.state;

      expect(state.robots[0].status).toBe('waiting');
      expect(state.robots[0].waitingReason).toBe('BLOCKED');
      expect(state.robots[0].position).toEqual({ x: 2, y: 2 });
      expect(state.robots[0].direction).toBe('UP');
      expect(state.tasks).toEqual([task]);
      expect(state.routes).toEqual([]);
      expect(result.events).toEqual([]);
    }

    expect(state.tick).toBe(3);

    // Assign a new route

    const newRoute = createRoute(
      robot.id,
      [
        {
          tick: 4,
          action: 'FORWARD',
          position: { x: 2, y: 1 },
          direction: 'UP',
        },
      ],
      state.tick,
    );

    const resume = applyCommand(state, {
      type: 'SET_ROUTE',
      route: newRoute,
    });

    if (!resume.success) {
      throw new Error(resume.error.message);
    }

    state = resume.state;

    expect(state.robots[0].status).toBe('busy');
    expect(state.robots[0].waitingReason).toBeUndefined();
    expect(state.routes).toEqual([newRoute]);
    expect(state.tasks).toEqual([task]);
    expect(state.tick).toBe(3);

    // Tick 4: arrive at the pickup station

    const fourth = tick(state);

    if (!fourth.success) {
      throw new Error(fourth.error.message);
    }

    state = fourth.state;

    expect(state.tick).toBe(4);
    expect(state.robots[0].position).toEqual({ x: 2, y: 1 });
    expect(state.robots[0].status).toBe('busy');
    expect(state.robots[0].waitingReason).toBeUndefined();
    expect(state.routes).toEqual([]);

    expect(state.tasks[0]).toEqual({
      ...task,
      phase: 'LOADING',
      remainingHandlingTicks: state.config.cargoHandlingTicks,
    });

    expect(fourth.events).toEqual([
      {
        type: 'ROBOT_MOVED',
        robotId: robot.id,
        position: { x: 2, y: 1 },
        direction: 'UP',
      },
      {
        type: 'ROUTE_COMPLETED',
        robotId: robot.id,
      },
      {
        type: 'LOADING_STARTED',
        taskId: task.id,
        robotId: robot.id,
      },
    ]);
  });

  it('should allow other robots to move while a robot is waiting', () => {
    const robotA = createRobot({
      id: 'robot-a',
    });

    const robotB = createRobot({
      id: 'robot-b',
      position: { x: 10, y: 10 },
    });

    const routeA = createRoute(robotA.id, [
      {
        tick: 1,
        action: 'FORWARD',
        position: { x: 2, y: 2 },
        direction: 'UP',
      },
    ]);

    const routeB = createRoute(robotB.id, [
      {
        tick: 1,
        action: 'FORWARD',
        position: { x: 10, y: 9 },
        direction: 'UP',
      },
    ]);

    const state = createState({
      robots: [robotA, robotB],
      routes: [routeA, routeB],
    });

    const stop = applyCommand(state, {
      type: 'SET_ROBOT_WAITING',
      robotId: robotA.id,
      reason: 'BLOCKED',
    });

    if (!stop.success) {
      throw new Error(stop.error.message);
    }

    const result = tick(stop.state);

    if (!result.success) {
      throw new Error(result.error.message);
    }

    expect(result.state.tick).toBe(1);

    expect(result.state.robots[0]).toEqual({
      ...robotA,
      status: 'waiting',
      waitingReason: 'BLOCKED',
    });

    expect(result.state.robots[1]).toEqual({
      ...robotB,
      position: { x: 10, y: 9 },
    });

    expect(result.state.routes).toEqual([]);

    expect(result.events).toEqual([
      {
        type: 'ROBOT_MOVED',
        robotId: robotB.id,
        position: { x: 10, y: 9 },
        direction: 'UP',
      },
      {
        type: 'ROUTE_COMPLETED',
        robotId: robotB.id,
      },
    ]);
  });

  it('should reject a collision caused by stopping a robot', () => {
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

    const routeA = createRoute(robotA.id, [
      {
        tick: 1,
        action: 'FORWARD',
        position: { x: 2, y: 2 },
        direction: 'RIGHT',
      },
    ]);

    const routeB = createRoute(robotB.id, [
      {
        tick: 1,
        action: 'FORWARD',
        position: { x: 3, y: 2 },
        direction: 'RIGHT',
      },
    ]);

    const state = createState({
      robots: [robotA, robotB],
      routes: [routeA, routeB],
    });

    // Stop robot B before it vacates its cell

    const stop = applyCommand(state, {
      type: 'SET_ROBOT_WAITING',
      robotId: robotB.id,
      reason: 'BLOCKED',
    });

    if (!stop.success) {
      throw new Error(stop.error.message);
    }

    const originalState = structuredClone(stop.state);

    const result = tick(stop.state);

    expect(result).toMatchObject({
      success: false,
      error: {
        code: 'ROBOT_COLLISION',
        robotIds: [robotA.id, robotB.id],
        tick: 1,
      },
    });

    expect(stop.state).toEqual(originalState);
    expect(stop.state.tick).toBe(0);
    expect(stop.state.routes).toEqual([routeA]);
    expect(stop.state.robots[0].position).toEqual(robotA.position);
    expect(stop.state.robots[1].position).toEqual(robotB.position);
    expect(stop.state.robots[1].status).toBe('waiting');
  });
  it.each(['TO_PICKUP', 'TO_DELIVERY'] as const)(
    'should resume task processing on a service cell after waiting during %s',
    (phase) => {
      const isPickup = phase === 'TO_PICKUP';

      const robot = createRobot({
        status: 'busy',
        position: isPickup ? { x: 2, y: 3 } : { x: 10, y: 10 },
      });

      const task: Task = {
        ...createTask(),
        status: 'in_progress',
        phase,
        remainingHandlingTicks: undefined,
        failureReason: undefined,
      };

      let state = createState({
        grid: {
          width: 20,
          height: 20,
          obstacles: [],
          stations: [
            {
              id: 'pickup-1',
              serviceCells: [{ x: 2, y: 3 }],
            },
            {
              id: 'delivery-1',
              serviceCells: [{ x: 10, y: 10 }],
            },
          ],
        },
        robots: [robot],
        tasks: [task],
      });

      // Pause the robot before cargo handling starts

      const stop = applyCommand(state, {
        type: 'SET_ROBOT_WAITING',
        robotId: robot.id,
        reason: 'BLOCKED',
      });

      if (!stop.success) {
        throw new Error(stop.error.message);
      }

      state = stop.state;

      expect(state.tick).toBe(0);
      expect(state.robots[0].status).toBe('waiting');
      expect(state.robots[0].waitingReason).toBe('BLOCKED');
      expect(state.tasks).toEqual([task]);
      expect(state.routes).toEqual([]);

      // Ticks 1 and 2: cargo handling must not start

      for (let i = 0; i < 2; i++) {
        const result = tick(state);

        if (!result.success) {
          throw new Error(result.error.message);
        }

        state = result.state;

        expect(state.robots[0].status).toBe('waiting');
        expect(state.robots[0].waitingReason).toBe('BLOCKED');
        expect(state.robots[0].position).toEqual(robot.position);
        expect(state.robots[0].direction).toBe(robot.direction);
        expect(state.tasks).toEqual([task]);
        expect(state.routes).toEqual([]);
        expect(result.events).toEqual([]);
      }

      expect(state.tick).toBe(2);

      // Resume the task without changing the robot's position

      const route = createRoute(
        robot.id,
        [
          {
            tick: 3,
            action: 'WAIT',
            position: robot.position,
            direction: robot.direction,
          },
        ],
        state.tick,
      );

      const resume = applyCommand(state, {
        type: 'SET_ROUTE',
        route,
      });

      if (!resume.success) {
        throw new Error(resume.error.message);
      }

      state = resume.state;

      expect(state.tick).toBe(2);
      expect(state.robots[0].status).toBe('busy');
      expect(state.robots[0].waitingReason).toBeUndefined();
      expect(state.tasks).toEqual([task]);
      expect(state.routes).toEqual([route]);

      // Tick 3: complete the route and start cargo handling

      const result = tick(state);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      state = result.state;

      expect(state.tick).toBe(3);
      expect(state.robots[0].status).toBe('busy');
      expect(state.robots[0].waitingReason).toBeUndefined();
      expect(state.robots[0].position).toEqual(robot.position);
      expect(state.robots[0].direction).toBe(robot.direction);
      expect(state.routes).toEqual([]);

      expect(state.tasks).toEqual([
        {
          ...task,
          phase: isPickup ? 'LOADING' : 'UNLOADING',
          remainingHandlingTicks: state.config.cargoHandlingTicks,
        },
      ]);

      expect(result.events).toEqual([
        {
          type: 'ROUTE_COMPLETED',
          robotId: robot.id,
        },
        {
          type: isPickup ? 'LOADING_STARTED' : 'UNLOADING_STARTED',
          taskId: task.id,
          robotId: robot.id,
        },
      ]);
    },
  );
});
