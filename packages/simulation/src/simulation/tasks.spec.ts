import { describe, it, expect } from 'vitest';

import { processTasks } from './tasks';

import type { SimulationState } from './types';
import type { RobotState, RobotRoute, RouteStep, Task } from '../contracts';

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
      stations: [
        {
          id: 'pickup-1',
          serviceCells: [
            { x: 2, y: 3 },
            { x: 2, y: 4 },
          ],
        },
        {
          id: 'delivery-1',
          serviceCells: [
            { x: 10, y: 10 },
            { x: 10, y: 11 },
          ],
        },
      ],
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
    status: 'busy',
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

describe('processTasks', () => {
  // Basic behavior

  it('should handle an empty task list', () => {
    const state = createState();

    const result = processTasks(state);

    expect(result.tasks).toEqual([]);
    expect(result.robots).toEqual([]);
    expect(result.events).toEqual([]);
  });

  it('should ignore queued tasks', () => {
    const task: Task = {
      id: 'task-1',
      pickupStationId: 'pickup-1',
      deliveryStationId: 'delivery-1',
      status: 'queued',
    };

    const state = createState({
      tasks: [task],
    });

    const result = processTasks(state);

    expect(result.tasks).toEqual([task]);
    expect(result.events).toEqual([]);
  });

  it('should ignore completed tasks', () => {
    const task: Task = {
      id: 'task-1',
      pickupStationId: 'pickup-1',
      deliveryStationId: 'delivery-1',
      robotId: 'robot-1',
      status: 'completed',
    };

    const state = createState({
      tasks: [task],
      robots: [createRobot({ status: 'idle' })],
    });

    const result = processTasks(state);

    expect(result.tasks).toEqual([task]);
    expect(result.robots).toEqual(state.robots);
    expect(result.events).toEqual([]);
  });

  it('should ignore failed tasks', () => {
    const task: Task = {
      id: 'task-1',
      pickupStationId: 'pickup-1',
      deliveryStationId: 'delivery-1',
      status: 'failed',
      failureReason: 'NO_PATH',
    };

    const state = createState({
      tasks: [task],
    });

    const result = processTasks(state);

    expect(result.tasks).toEqual([task]);
    expect(result.events).toEqual([]);
  });

  it('should ignore a task when its assigned robot does not exist', () => {
    const task = createTask();

    const state = createState({
      tasks: [task],
    });

    const result = processTasks(state);

    expect(result.tasks).toEqual([task]);
    expect(result.events).toEqual([]);
  });

  // TO_PICKUP

  it('should keep TO_PICKUP when the robot has not arrived', () => {
    const robot = createRobot({
      position: { x: 0, y: 0 },
    });

    const task = createTask();

    const state = createState({
      robots: [robot],
      tasks: [task],
    });

    const result = processTasks(state);

    expect(result.tasks).toEqual([task]);
    expect(result.events).toEqual([]);
  });

  it('should not start loading while the robot has an active route', () => {
    const robot = createRobot();
    const task = createTask();

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

    const result = processTasks(state);

    expect(result.tasks).toEqual([task]);
    expect(result.events).toEqual([]);
  });

  it('should start loading on a pickup service cell', () => {
    const robot = createRobot({
      position: { x: 2, y: 4 },
    });

    const task = createTask();

    const state = createState({
      robots: [robot],
      tasks: [task],
    });

    const result = processTasks(state);

    expect(result.tasks).toEqual([
      {
        ...task,
        phase: 'LOADING',
        remainingHandlingTicks: 2,
      },
    ]);

    expect(result.robots).toEqual([robot]);

    expect(result.events).toEqual([
      {
        type: 'LOADING_STARTED',
        taskId: task.id,
        robotId: robot.id,
      },
    ]);
  });

  it('should keep TO_PICKUP when the pickup station does not exist', () => {
    const robot = createRobot();

    const task = createTask({
      pickupStationId: 'missing-station',
    });

    const state = createState({
      robots: [robot],
      tasks: [task],
    });

    const result = processTasks(state);

    expect(result.tasks).toEqual([task]);
    expect(result.events).toEqual([]);
  });

  // LOADING

  it('should decrement remaining loading ticks', () => {
    const robot = createRobot();

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

    const result = processTasks(state);

    expect(result.tasks).toEqual([
      {
        ...task,
        remainingHandlingTicks: 1,
      },
    ]);

    expect(result.robots).toEqual([robot]);
    expect(result.events).toEqual([]);
  });

  it('should complete loading and switch to TO_DELIVERY', () => {
    const robot = createRobot();

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

    const result = processTasks(state);

    expect(result.tasks).toEqual([
      {
        id: task.id,
        pickupStationId: task.pickupStationId,
        deliveryStationId: task.deliveryStationId,
        robotId: robot.id,
        status: 'in_progress',
        phase: 'TO_DELIVERY',
      },
    ]);

    expect(result.tasks[0]).not.toHaveProperty('remainingHandlingTicks');
    expect(result.robots).toEqual([robot]);

    expect(result.events).toEqual([
      {
        type: 'LOADING_COMPLETED',
        taskId: task.id,
        robotId: robot.id,
      },
    ]);
  });

  // TO_DELIVERY

  it('should keep TO_DELIVERY when the robot has not arrived', () => {
    const robot = createRobot();

    const task: Task = {
      ...createTask(),
      status: 'in_progress',
      phase: 'TO_DELIVERY',
      remainingHandlingTicks: undefined,
      failureReason: undefined,
    };

    const state = createState({
      robots: [robot],
      tasks: [task],
    });

    const result = processTasks(state);

    expect(result.tasks).toEqual([task]);
    expect(result.events).toEqual([]);
  });

  it('should not start unloading while the robot has an active route', () => {
    const robot = createRobot({
      position: { x: 10, y: 10 },
    });

    const task: Task = {
      ...createTask(),
      status: 'in_progress',
      phase: 'TO_DELIVERY',
      remainingHandlingTicks: undefined,
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
            position: { x: 10, y: 9 },
            direction: 'UP',
          },
        ]),
      ],
    });

    const result = processTasks(state);

    expect(result.tasks).toEqual([task]);
    expect(result.events).toEqual([]);
  });

  it('should start unloading on a delivery service cell', () => {
    const robot = createRobot({
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
      robots: [robot],
      tasks: [task],
    });

    const result = processTasks(state);

    expect(result.tasks).toEqual([
      {
        id: task.id,
        pickupStationId: task.pickupStationId,
        deliveryStationId: task.deliveryStationId,
        robotId: robot.id,
        status: 'in_progress',
        phase: 'UNLOADING',
        remainingHandlingTicks: 2,
      },
    ]);

    expect(result.robots).toEqual([robot]);

    expect(result.events).toEqual([
      {
        type: 'UNLOADING_STARTED',
        taskId: task.id,
        robotId: robot.id,
      },
    ]);
  });

  it('should keep TO_DELIVERY when the delivery station does not exist', () => {
    const robot = createRobot({
      position: { x: 10, y: 10 },
    });

    const task: Task = {
      ...createTask({
        deliveryStationId: 'missing-station',
      }),
      status: 'in_progress',
      phase: 'TO_DELIVERY',
      remainingHandlingTicks: undefined,
      failureReason: undefined,
    };

    const state = createState({
      robots: [robot],
      tasks: [task],
    });

    const result = processTasks(state);

    expect(result.tasks).toEqual([task]);
    expect(result.events).toEqual([]);
  });

  // UNLOADING

  it('should decrement remaining unloading ticks', () => {
    const robot = createRobot({
      position: { x: 10, y: 10 },
    });

    const task: Task = {
      ...createTask(),
      status: 'in_progress',
      phase: 'UNLOADING',
      remainingHandlingTicks: 2,
      failureReason: undefined,
    };

    const state = createState({
      robots: [robot],
      tasks: [task],
    });

    const result = processTasks(state);

    expect(result.tasks).toEqual([
      {
        ...task,
        remainingHandlingTicks: 1,
      },
    ]);

    expect(result.robots).toEqual([robot]);
    expect(result.events).toEqual([]);
  });

  it('should complete unloading and release the robot', () => {
    const robot = createRobot({
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

    const result = processTasks(state);

    expect(result.tasks).toEqual([
      {
        id: task.id,
        pickupStationId: task.pickupStationId,
        deliveryStationId: task.deliveryStationId,
        robotId: robot.id,
        status: 'completed',
      },
    ]);

    expect(result.tasks[0]).not.toHaveProperty('phase');
    expect(result.tasks[0]).not.toHaveProperty('remainingHandlingTicks');

    expect(result.robots).toEqual([
      {
        ...robot,
        status: 'idle',
        waitingReason: undefined,
      },
    ]);

    expect(result.events).toEqual([
      {
        type: 'TASK_COMPLETED',
        taskId: task.id,
        robotId: robot.id,
      },
    ]);
  });

  // Fault handling

  it('should pause loading when the robot is faulty', () => {
    const robot = createRobot({
      status: 'fault',
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

    const result = processTasks(state);

    expect(result.tasks).toEqual([task]);
    expect(result.robots).toEqual([robot]);
    expect(result.events).toEqual([]);
  });

  it('should pause unloading when the robot is faulty', () => {
    const robot = createRobot({
      status: 'fault',
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

    const result = processTasks(state);

    expect(result.tasks).toEqual([task]);
    expect(result.robots).toEqual([robot]);
    expect(result.events).toEqual([]);
  });
  // Waiting handling

  it('should not start loading when the robot is waiting on a pickup service cell', () => {
    const robot = createRobot({
      status: 'waiting',
      waitingReason: 'BLOCKED',
      position: { x: 2, y: 3 },
    });

    const task = createTask();

    const state = createState({
      robots: [robot],
      tasks: [task],
    });

    const originalState = structuredClone(state);

    const result = processTasks(state);

    expect(result.tasks).toEqual([task]);
    expect(result.tasks[0].status).toBe('in_progress');
    expect(result.tasks[0].phase).toBe('TO_PICKUP');
    expect(result.tasks[0].robotId).toBe(robot.id);
    expect(result.robots).toEqual([robot]);
    expect(result.events).toEqual([]);

    expect(state).toEqual(originalState);
  });

  it('should not start unloading when the robot is waiting on a delivery service cell', () => {
    const robot = createRobot({
      status: 'waiting',
      waitingReason: 'BLOCKED',
      position: { x: 10, y: 10 },
    });

    const task: Task = {
      ...createTask(),
      status: 'in_progress',
      phase: 'TO_DELIVERY',
      remainingHandlingTicks: undefined,
      failureReason: undefined,
    };

    const state = createState({
      robots: [robot],
      tasks: [task],
    });

    const originalState = structuredClone(state);

    const result = processTasks(state);

    expect(result.tasks).toEqual([task]);
    expect(result.tasks[0].status).toBe('in_progress');
    expect(result.tasks[0].phase).toBe('TO_DELIVERY');
    expect(result.tasks[0].robotId).toBe(robot.id);
    expect(result.robots).toEqual([robot]);
    expect(result.events).toEqual([]);

    expect(state).toEqual(originalState);
  });

  it('should process other tasks while a robot is waiting', () => {
    const waitingRobot = createRobot({
      id: 'robot-a',
      status: 'waiting',
      waitingReason: 'WAITING_FOR_PATH',
      position: { x: 2, y: 3 },
    });

    const unloadingRobot = createRobot({
      id: 'robot-b',
      status: 'busy',
      position: { x: 10, y: 10 },
    });

    const waitingTask = createTask({
      id: 'task-a',
      robotId: waitingRobot.id,
    });

    const unloadingTask: Task = {
      ...createTask({
        id: 'task-b',
        robotId: unloadingRobot.id,
      }),
      status: 'in_progress',
      phase: 'UNLOADING',
      remainingHandlingTicks: 1,
      failureReason: undefined,
    };

    const state = createState({
      robots: [waitingRobot, unloadingRobot],
      tasks: [waitingTask, unloadingTask],
    });

    const originalState = structuredClone(state);

    const result = processTasks(state);

    expect(result.tasks).toEqual([
      waitingTask,
      {
        id: unloadingTask.id,
        pickupStationId: unloadingTask.pickupStationId,
        deliveryStationId: unloadingTask.deliveryStationId,
        robotId: unloadingRobot.id,
        status: 'completed',
      },
    ]);

    expect(result.robots).toEqual([
      waitingRobot,
      {
        ...unloadingRobot,
        status: 'idle',
        waitingReason: undefined,
      },
    ]);

    expect(result.events).toEqual([
      {
        type: 'TASK_COMPLETED',
        taskId: unloadingTask.id,
        robotId: unloadingRobot.id,
      },
    ]);

    expect(state).toEqual(originalState);
  });
  // Multiple tasks

  it('should complete multiple tasks and release their robots', () => {
    const robotA = createRobot({
      id: 'robot-a',
      position: { x: 10, y: 10 },
    });

    const robotB = createRobot({
      id: 'robot-b',
      position: { x: 10, y: 11 },
    });

    const taskA: Task = {
      ...createTask({
        id: 'task-a',
        robotId: robotA.id,
      }),
      status: 'in_progress',
      phase: 'UNLOADING',
      remainingHandlingTicks: 1,
      failureReason: undefined,
    };

    const taskB: Task = {
      ...createTask({
        id: 'task-b',
        robotId: robotB.id,
      }),
      status: 'in_progress',
      phase: 'UNLOADING',
      remainingHandlingTicks: 1,
      failureReason: undefined,
    };

    const state = createState({
      robots: [robotA, robotB],
      tasks: [taskA, taskB],
    });

    const result = processTasks(state);

    expect(result.tasks.map((task) => task.status)).toEqual(['completed', 'completed']);

    expect(result.robots).toEqual([
      {
        ...robotA,
        status: 'idle',
        waitingReason: undefined,
      },
      {
        ...robotB,
        status: 'idle',
        waitingReason: undefined,
      },
    ]);

    expect(result.events).toEqual([
      {
        type: 'TASK_COMPLETED',
        taskId: taskA.id,
        robotId: robotA.id,
      },
      {
        type: 'TASK_COMPLETED',
        taskId: taskB.id,
        robotId: robotB.id,
      },
    ]);
  });

  // Immutability

  it('should not mutate the original state when starting loading', () => {
    const state = createState({
      robots: [createRobot()],
      tasks: [createTask()],
    });

    const originalState = structuredClone(state);

    processTasks(state);

    expect(state).toEqual(originalState);
  });

  it('should not mutate the original state when completing a task', () => {
    const robot = createRobot({
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

    const originalState = structuredClone(state);

    processTasks(state);

    expect(state).toEqual(originalState);
  });
});
