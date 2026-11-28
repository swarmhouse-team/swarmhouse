import { describe, it, expect } from 'vitest';

import { applyCommand } from './commands';

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
  overrides: Partial<Extract<Task, { status: 'queued' | 'completed' }>> = {},
): Task {
  return {
    id: 'task-1',
    pickupStationId: 'station-1',
    deliveryStationId: 'station-2',
    status: 'queued',
    ...overrides,
  };
}

describe('applyCommand', () => {
  describe('CREATE_TASK', () => {
    it('should create a new task', () => {
      const state = createState();
      const task = createTask();

      const result = applyCommand(state, {
        type: 'CREATE_TASK',
        task,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.state.tasks).toEqual([task]);

        expect(result.events).toEqual([
          {
            type: 'TASK_CREATED',
            taskId: task.id,
          },
        ]);
      }

      expect(state.tasks).toEqual([]);
    });

    it('should preserve existing tasks', () => {
      const existingTask = createTask();

      const newTask = createTask({
        id: 'task-2',
      });

      const state = createState({
        tasks: [existingTask],
      });

      const result = applyCommand(state, {
        type: 'CREATE_TASK',
        task: newTask,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.state.tasks).toEqual([existingTask, newTask]);
      }
    });

    it('should reject a duplicate task ID', () => {
      const task = createTask();

      const state = createState({
        tasks: [task],
      });

      const result = applyCommand(state, {
        type: 'CREATE_TASK',
        task,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe('TASK_ALREADY_EXISTS');

        expect(result.error.taskId).toBe(task.id);
      }
    });

    it('should initialize a new task as queued', () => {
      const task: Task = {
        id: 'task-1',
        pickupStationId: 'station-1',
        deliveryStationId: 'station-2',
        status: 'in_progress',
        phase: 'TO_PICKUP',
        robotId: 'robot-1',
      };

      const state = createState();

      const result = applyCommand(state, {
        type: 'CREATE_TASK',
        task,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.state.tasks[0]).toEqual({
          id: task.id,
          pickupStationId: task.pickupStationId,
          deliveryStationId: task.deliveryStationId,
          status: 'queued',
        });
      }
    });
  });

  describe('SET_ROUTE', () => {
    it('should assign a valid route to a robot', () => {
      const robot = createRobot();

      const route = createRoute(robot.id, [
        {
          tick: 1,
          action: 'FORWARD',
          position: { x: 2, y: 2 },
          direction: 'UP',
        },
      ]);

      const state = createState({
        robots: [robot],
      });

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.state.routes).toEqual([route]);
        expect(result.state.robots).toEqual([robot]);
        expect(result.state.tick).toBe(0);
        expect(result.events).toEqual([]);
      }

      expect(state.routes).toEqual([]);
    });

    it('should accept a route starting at the current tick', () => {
      const robot = createRobot();

      const route = createRoute(
        robot.id,
        [
          {
            tick: 6,
            action: 'FORWARD',
            position: { x: 2, y: 2 },
            direction: 'UP',
          },
        ],
        5,
      );

      const state = createState({
        tick: 5,
        robots: [robot],
      });

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.state.routes).toEqual([route]);
        expect(result.state.tick).toBe(5);
      }
    });

    it('should replace an existing route', () => {
      const robot = createRobot();

      const oldRoute = createRoute(robot.id, [
        {
          tick: 1,
          action: 'FORWARD',
          position: { x: 2, y: 2 },
          direction: 'UP',
        },
      ]);

      const newRoute = createRoute(robot.id, [
        {
          tick: 1,
          action: 'TURN_RIGHT',
          position: robot.position,
          direction: 'RIGHT',
        },
      ]);

      const state = createState({
        robots: [robot],
        routes: [oldRoute],
      });

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route: newRoute,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.state.routes).toEqual([newRoute]);
      }

      expect(state.routes).toEqual([oldRoute]);
    });

    it('should preserve routes of other robots', () => {
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
        routes: [routeB],
      });

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route: routeA,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.state.routes).toHaveLength(2);
        expect(result.state.routes).toContainEqual(routeA);
        expect(result.state.routes).toContainEqual(routeB);
      }
    });

    it('should reject a route for an unknown robot', () => {
      const state = createState();

      const route = createRoute('unknown-robot', [
        {
          tick: 1,
          action: 'WAIT',
          position: { x: 2, y: 3 },
          direction: 'UP',
        },
      ]);

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe('ROBOT_NOT_FOUND');
        expect(result.error.robotId).toBe('unknown-robot');
      }
    });

    it('should reject a route for a faulty robot', () => {
      const robot = createRobot({
        status: 'fault',
      });

      const state = createState({
        robots: [robot],
      });

      const route = createRoute(robot.id, [
        {
          tick: 1,
          action: 'WAIT',
          position: robot.position,
          direction: robot.direction,
        },
      ]);

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe('INVALID_ROBOT_STATE');
        expect(result.error.robotId).toBe(robot.id);
      }
    });
    it.each(['LOADING', 'UNLOADING'] as const)(
      'should reject a route for a robot in %s phase',
      (phase) => {
        const robot = createRobot({
          status: 'busy',
        });

        const task: Task = {
          id: 'task-1',
          pickupStationId: 'station-1',
          deliveryStationId: 'station-2',
          robotId: robot.id,
          status: 'in_progress',
          phase,
          remainingHandlingTicks: 2,
        };

        const state = createState({
          robots: [robot],
          tasks: [task],
        });

        const route = createRoute(robot.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: { x: 2, y: 2 },
            direction: 'UP',
          },
        ]);

        const originalState = structuredClone(state);

        const result = applyCommand(state, {
          type: 'SET_ROUTE',
          route,
        });

        expect(result).toMatchObject({
          success: false,
          error: {
            code: 'INVALID_ROBOT_STATE',
            robotId: robot.id,
          },
        });

        expect(state).toEqual(originalState);
      },
    );

    it.each(['TO_PICKUP', 'TO_DELIVERY'] as const)(
      'should allow route replacement for a robot in %s phase',
      (phase) => {
        const robot = createRobot({
          status: 'busy',
        });

        const task: Task = {
          id: 'task-1',
          pickupStationId: 'station-1',
          deliveryStationId: 'station-2',
          robotId: robot.id,
          status: 'in_progress',
          phase,
        };

        const oldRoute = createRoute(robot.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: { x: 2, y: 2 },
            direction: 'UP',
          },
        ]);

        const newRoute = createRoute(robot.id, [
          {
            tick: 1,
            action: 'TURN_RIGHT',
            position: robot.position,
            direction: 'RIGHT',
          },
        ]);

        const state = createState({
          robots: [robot],
          tasks: [task],
          routes: [oldRoute],
        });

        const result = applyCommand(state, {
          type: 'SET_ROUTE',
          route: newRoute,
        });

        expect(result.success).toBe(true);

        if (result.success) {
          expect(result.state.routes).toEqual([newRoute]);
          expect(result.state.tasks).toEqual([task]);
          expect(result.state.robots).toEqual([robot]);
          expect(result.events).toEqual([]);
        }

        expect(state.routes).toEqual([oldRoute]);
      },
    );

    it('should allow setting a route while another robot is handling cargo', () => {
      const movingRobot = createRobot({
        id: 'robot-1',
      });

      const loadingRobot = createRobot({
        id: 'robot-2',
        status: 'busy',
        position: { x: 10, y: 10 },
      });

      const task: Task = {
        id: 'task-1',
        pickupStationId: 'station-1',
        deliveryStationId: 'station-2',
        robotId: loadingRobot.id,
        status: 'in_progress',
        phase: 'LOADING',
        remainingHandlingTicks: 2,
      };

      const state = createState({
        robots: [movingRobot, loadingRobot],
        tasks: [task],
      });

      const route = createRoute(movingRobot.id, [
        {
          tick: 1,
          action: 'FORWARD',
          position: { x: 2, y: 2 },
          direction: 'UP',
        },
      ]);

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.state.routes).toEqual([route]);
        expect(result.state.tasks).toEqual([task]);
        expect(result.state.robots).toEqual([movingRobot, loadingRobot]);
        expect(result.events).toEqual([]);
      }
    });
    // Robot status transitions

    it.each(['TO_PICKUP', 'TO_DELIVERY'] as const)(
      'should switch a waiting robot to busy in %s phase',
      (phase) => {
        const robot = createRobot({
          status: 'waiting',
          waitingReason: 'WAITING_FOR_PATH',
        });

        const otherRobot = createRobot({
          id: 'robot-2',
          position: { x: 10, y: 10 },
          status: 'waiting',
          waitingReason: 'BLOCKED',
        });

        const task: Task = {
          id: 'task-1',
          pickupStationId: 'station-1',
          deliveryStationId: 'station-2',
          robotId: robot.id,
          status: 'in_progress',
          phase,
        };

        const route = createRoute(robot.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: { x: 2, y: 2 },
            direction: 'UP',
          },
        ]);

        const state = createState({
          robots: [robot, otherRobot],
          tasks: [task],
        });

        const originalState = structuredClone(state);

        const result = applyCommand(state, {
          type: 'SET_ROUTE',
          route,
        });

        if (!result.success) {
          throw new Error(result.error.message);
        }

        expect(result.state.robots[0]).toEqual({
          ...robot,
          status: 'busy',
          waitingReason: undefined,
        });

        expect(result.state.robots[1]).toEqual(otherRobot);
        expect(result.state.tasks).toEqual([task]);
        expect(result.state.routes).toEqual([route]);
        expect(result.state.tick).toBe(state.tick);
        expect(result.events).toEqual([]);

        expect(state).toEqual(originalState);
      },
    );

    it('should switch a waiting robot without an active task to idle', () => {
      const robot = createRobot({
        status: 'waiting',
        waitingReason: 'BLOCKED',
      });

      const route = createRoute(robot.id, [
        {
          tick: 1,
          action: 'FORWARD',
          position: { x: 2, y: 2 },
          direction: 'UP',
        },
      ]);

      const state = createState({
        robots: [robot],
      });

      const originalState = structuredClone(state);

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route,
      });

      if (!result.success) {
        throw new Error(result.error.message);
      }

      expect(result.state.robots[0]).toEqual({
        ...robot,
        status: 'idle',
        waitingReason: undefined,
      });

      expect(result.state.tasks).toEqual([]);
      expect(result.state.routes).toEqual([route]);
      expect(result.events).toEqual([]);

      expect(state).toEqual(originalState);
    });

    it('should keep a robot with a completed task idle', () => {
      const robot = createRobot();

      const task = createTask({
        status: 'completed',
        robotId: robot.id,
      });

      const route = createRoute(robot.id, [
        {
          tick: 1,
          action: 'FORWARD',
          position: { x: 2, y: 2 },
          direction: 'UP',
        },
      ]);

      const state = createState({
        robots: [robot],
        tasks: [task],
      });

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route,
      });

      if (!result.success) {
        throw new Error(result.error.message);
      }

      expect(result.state.robots[0]).toEqual({
        ...robot,
        status: 'idle',
        waitingReason: undefined,
      });

      expect(result.state.tasks).toEqual([task]);
      expect(result.state.routes).toEqual([route]);
      expect(result.events).toEqual([]);
    });

    it('should preserve waiting status when route assignment fails', () => {
      const robot = createRobot({
        status: 'waiting',
        waitingReason: 'WAITING_FOR_PATH',
      });

      const task: Task = {
        id: 'task-1',
        pickupStationId: 'station-1',
        deliveryStationId: 'station-2',
        robotId: robot.id,
        status: 'in_progress',
        phase: 'TO_PICKUP',
      };

      const state = createState({
        robots: [robot],
        tasks: [task],
      });

      const originalState = structuredClone(state);

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route: createRoute(robot.id, []),
      });

      expect(result).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_ROUTE',
          robotId: robot.id,
        },
      });

      expect(state.robots[0].status).toBe('waiting');
      expect(state.robots[0].waitingReason).toBe('WAITING_FOR_PATH');
      expect(state.tasks).toEqual([task]);
      expect(state.routes).toEqual([]);

      expect(state).toEqual(originalState);
    });
    it('should reject a route starting in the past', () => {
      const robot = createRobot();

      const state = createState({
        tick: 5,
        robots: [robot],
      });

      const route = createRoute(
        robot.id,
        [
          {
            tick: 4,
            action: 'WAIT',
            position: robot.position,
            direction: robot.direction,
          },
        ],
        3,
      );

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe('INVALID_ROUTE');
      }
    });

    it('should reject a route starting in the future', () => {
      const robot = createRobot();

      const state = createState({
        robots: [robot],
      });

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
        2,
      );

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe('INVALID_ROUTE');
      }
    });

    it('should reject an empty route', () => {
      const robot = createRobot();

      const state = createState({
        robots: [robot],
      });

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route: createRoute(robot.id, []),
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe('INVALID_ROUTE');
      }
    });

    it('should reject an invalid first step tick', () => {
      const robot = createRobot();

      const state = createState({
        robots: [robot],
      });

      const route = createRoute(robot.id, [
        {
          tick: 2,
          action: 'WAIT',
          position: robot.position,
          direction: robot.direction,
        },
      ]);

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe('INVALID_ROUTE');
      }
    });

    it('should reject non-consecutive route ticks', () => {
      const robot = createRobot();

      const state = createState({
        robots: [robot],
      });

      const route = createRoute(robot.id, [
        {
          tick: 1,
          action: 'FORWARD',
          position: { x: 2, y: 2 },
          direction: 'UP',
        },
        {
          tick: 3,
          action: 'FORWARD',
          position: { x: 2, y: 1 },
          direction: 'UP',
        },
      ]);

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe('INVALID_ROUTE');
      }
    });

    it('should reject invalid route actions', () => {
      const robot = createRobot();

      const state = createState({
        robots: [robot],
      });

      const route = createRoute(robot.id, [
        {
          tick: 1,
          action: 'FORWARD',
          position: { x: 2, y: 0 },
          direction: 'UP',
        },
      ]);

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe('INVALID_ROUTE');
      }
    });

    it('should reject a route outside the grid', () => {
      const robot = createRobot({
        position: { x: 0, y: 0 },
      });

      const state = createState({
        robots: [robot],
      });

      const route = createRoute(robot.id, [
        {
          tick: 1,
          action: 'FORWARD',
          position: { x: 0, y: -1 },
          direction: 'UP',
        },
      ]);

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe('INVALID_ROUTE');
      }
    });

    it('should reject a route through an obstacle', () => {
      const robot = createRobot();

      const state = createState({
        grid: {
          width: 20,
          height: 20,
          obstacles: [{ x: 2, y: 2 }],
          stations: [],
        },
        robots: [robot],
      });

      const route = createRoute(robot.id, [
        {
          tick: 1,
          action: 'FORWARD',
          position: { x: 2, y: 2 },
          direction: 'UP',
        },
      ]);

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe('INVALID_ROUTE');
      }
    });

    it('should reject a collision at the current tick', () => {
      const robotA = createRobot({
        id: 'robot-a',
      });

      const robotB = createRobot({
        id: 'robot-b',
        position: robotA.position,
      });

      const state = createState({
        robots: [robotA, robotB],
      });

      const route = createRoute(robotA.id, [
        {
          tick: 1,
          action: 'FORWARD',
          position: { x: 2, y: 2 },
          direction: 'UP',
        },
      ]);

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe('INVALID_ROUTE');
        expect(result.error.message).toContain('collision at current tick');
      }
    });

    it('should reject a route into a stationary robot', () => {
      const robotA = createRobot({
        id: 'robot-a',
      });

      const robotB = createRobot({
        id: 'robot-b',
        position: { x: 2, y: 2 },
      });

      const state = createState({
        robots: [robotA, robotB],
      });

      const route = createRoute(robotA.id, [
        {
          tick: 1,
          action: 'FORWARD',
          position: robotB.position,
          direction: 'UP',
        },
      ]);

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe('INVALID_ROUTE');
      }
    });

    it('should reject a route into a faulty robot', () => {
      const robotA = createRobot({
        id: 'robot-a',
      });

      const robotB = createRobot({
        id: 'robot-b',
        position: { x: 2, y: 2 },
        status: 'fault',
      });

      const state = createState({
        robots: [robotA, robotB],
      });

      const route = createRoute(robotA.id, [
        {
          tick: 1,
          action: 'FORWARD',
          position: robotB.position,
          direction: 'UP',
        },
      ]);

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe('INVALID_ROUTE');
      }
    });

    it('should reject a future cell collision', () => {
      const robotA = createRobot({
        id: 'robot-a',
        position: { x: 0, y: 2 },
        direction: 'RIGHT',
      });

      const robotB = createRobot({
        id: 'robot-b',
        position: { x: 4, y: 2 },
        direction: 'LEFT',
      });

      const routeA = createRoute(robotA.id, [
        {
          tick: 1,
          action: 'FORWARD',
          position: { x: 1, y: 2 },
          direction: 'RIGHT',
        },
        {
          tick: 2,
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
          direction: 'LEFT',
        },
        {
          tick: 2,
          action: 'FORWARD',
          position: { x: 2, y: 2 },
          direction: 'LEFT',
        },
      ]);

      const state = createState({
        robots: [robotA, robotB],
        routes: [routeB],
      });

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route: routeA,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe('INVALID_ROUTE');
        expect(result.error.message).toContain('tick 2');
      }
    });

    it('should reject an edge swap conflict', () => {
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

      const routeA = createRoute(robotA.id, [
        {
          tick: 1,
          action: 'FORWARD',
          position: robotB.position,
          direction: 'RIGHT',
        },
      ]);

      const routeB = createRoute(robotB.id, [
        {
          tick: 1,
          action: 'FORWARD',
          position: robotA.position,
          direction: 'LEFT',
        },
      ]);

      const state = createState({
        robots: [robotA, robotB],
        routes: [routeB],
      });

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route: routeA,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe('INVALID_ROUTE');
      }
    });

    it('should allow movement into a vacated cell', () => {
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
        routes: [routeB],
      });

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route: routeA,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.state.routes).toHaveLength(2);
      }
    });

    it('should reject a collision after the new route ends', () => {
      const robotA = createRobot({
        id: 'robot-a',
        position: { x: 1, y: 2 },
        direction: 'RIGHT',
      });

      const robotB = createRobot({
        id: 'robot-b',
        position: { x: 4, y: 2 },
        direction: 'LEFT',
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
          direction: 'LEFT',
        },
        {
          tick: 2,
          action: 'FORWARD',
          position: { x: 2, y: 2 },
          direction: 'LEFT',
        },
      ]);

      const state = createState({
        robots: [robotA, robotB],
        routes: [routeB],
      });

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route: routeA,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe('INVALID_ROUTE');

        expect(result.error.message).toContain('collision after route ends');
      }
    });

    it('should reject a collision after another route ends', () => {
      const robotA = createRobot({
        id: 'robot-a',
        position: { x: 0, y: 2 },
        direction: 'RIGHT',
      });

      const robotB = createRobot({
        id: 'robot-b',
        position: { x: 3, y: 2 },
        direction: 'LEFT',
      });

      const routeA = createRoute(robotA.id, [
        {
          tick: 1,
          action: 'FORWARD',
          position: { x: 1, y: 2 },
          direction: 'RIGHT',
        },
        {
          tick: 2,
          action: 'FORWARD',
          position: { x: 2, y: 2 },
          direction: 'RIGHT',
        },
      ]);

      const routeB = createRoute(robotB.id, [
        {
          tick: 1,
          action: 'FORWARD',
          position: { x: 2, y: 2 },
          direction: 'LEFT',
        },
      ]);

      const state = createState({
        robots: [robotA, robotB],
        routes: [routeB],
      });

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route: routeA,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe('INVALID_ROUTE');
      }
    });
  });
  describe('SET_ROBOT_WAITING', () => {
    it.each(['TO_PICKUP', 'TO_DELIVERY'] as const)(
      'should stop a robot in %s phase without cancelling its task',
      (phase) => {
        const robot = createRobot({
          status: 'busy',
        });

        const task: Task = {
          id: 'task-1',
          pickupStationId: 'station-1',
          deliveryStationId: 'station-2',
          robotId: robot.id,
          status: 'in_progress',
          phase,
        };

        const route = createRoute(
          robot.id,
          [
            {
              tick: 6,
              action: 'FORWARD',
              position: { x: 2, y: 2 },
              direction: 'UP',
            },
          ],
          5,
        );

        const state = createState({
          tick: 5,
          robots: [robot],
          tasks: [task],
          routes: [route],
        });

        const originalState = structuredClone(state);

        const result = applyCommand(state, {
          type: 'SET_ROBOT_WAITING',
          robotId: robot.id,
          reason: 'BLOCKED',
        });

        if (!result.success) {
          throw new Error(result.error.message);
        }

        expect(result.state.robots[0]).toEqual({
          ...robot,
          status: 'waiting',
          waitingReason: 'BLOCKED',
        });

        expect(result.state.routes).toEqual([]);
        expect(result.state.tasks).toEqual([task]);
        expect(result.state.tick).toBe(5);

        expect(result.events).toEqual([
          {
            type: 'ROBOT_WAITING',
            robotId: robot.id,
            reason: 'BLOCKED',
          },
        ]);

        expect(state).toEqual(originalState);
      },
    );

    it('should stop an idle robot returning home', () => {
      const robot = createRobot();

      const route = createRoute(robot.id, [
        {
          tick: 1,
          action: 'FORWARD',
          position: { x: 2, y: 2 },
          direction: 'UP',
        },
      ]);

      const state = createState({
        robots: [robot],
        routes: [route],
      });

      const result = applyCommand(state, {
        type: 'SET_ROBOT_WAITING',
        robotId: robot.id,
        reason: 'BLOCKED',
      });

      if (!result.success) {
        throw new Error(result.error.message);
      }

      expect(result.state.robots[0]).toEqual({
        ...robot,
        status: 'waiting',
        waitingReason: 'BLOCKED',
      });

      expect(result.state.routes).toEqual([]);
      expect(result.state.tasks).toEqual([]);

      expect(result.events).toEqual([
        {
          type: 'ROBOT_WAITING',
          robotId: robot.id,
          reason: 'BLOCKED',
        },
      ]);
    });

    it('should allow waiting when no route has been assigned', () => {
      const robot = createRobot({
        status: 'busy',
      });

      const task: Task = {
        id: 'task-1',
        pickupStationId: 'station-1',
        deliveryStationId: 'station-2',
        robotId: robot.id,
        status: 'in_progress',
        phase: 'TO_PICKUP',
      };

      const state = createState({
        robots: [robot],
        tasks: [task],
      });

      const result = applyCommand(state, {
        type: 'SET_ROBOT_WAITING',
        robotId: robot.id,
        reason: 'WAITING_FOR_PATH',
      });

      if (!result.success) {
        throw new Error(result.error.message);
      }

      expect(result.state.robots[0]).toEqual({
        ...robot,
        status: 'waiting',
        waitingReason: 'WAITING_FOR_PATH',
      });

      expect(result.state.routes).toEqual([]);
      expect(result.state.tasks).toEqual([task]);

      expect(result.events).toEqual([
        {
          type: 'ROBOT_WAITING',
          robotId: robot.id,
          reason: 'WAITING_FOR_PATH',
        },
      ]);
    });

    it('should update the waiting reason of a waiting robot', () => {
      const robot = createRobot({
        status: 'waiting',
        waitingReason: 'BLOCKED',
      });

      const state = createState({
        robots: [robot],
      });

      const originalState = structuredClone(state);

      const result = applyCommand(state, {
        type: 'SET_ROBOT_WAITING',
        robotId: robot.id,
        reason: 'WAITING_FOR_PATH',
      });

      if (!result.success) {
        throw new Error(result.error.message);
      }

      expect(result.state.robots[0]).toEqual({
        ...robot,
        status: 'waiting',
        waitingReason: 'WAITING_FOR_PATH',
      });

      expect(result.events).toEqual([
        {
          type: 'ROBOT_WAITING',
          robotId: robot.id,
          reason: 'WAITING_FOR_PATH',
        },
      ]);

      expect(state).toEqual(originalState);
    });

    it('should reject an unknown robot', () => {
      const state = createState();

      const originalState = structuredClone(state);

      const result = applyCommand(state, {
        type: 'SET_ROBOT_WAITING',
        robotId: 'unknown-robot',
        reason: 'BLOCKED',
      });

      expect(result).toMatchObject({
        success: false,
        error: {
          code: 'ROBOT_NOT_FOUND',
          robotId: 'unknown-robot',
        },
      });

      expect(state).toEqual(originalState);
    });

    it('should reject a faulty robot', () => {
      const robot = createRobot({
        status: 'fault',
      });

      const state = createState({
        robots: [robot],
      });

      const originalState = structuredClone(state);

      const result = applyCommand(state, {
        type: 'SET_ROBOT_WAITING',
        robotId: robot.id,
        reason: 'BLOCKED',
      });

      expect(result).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_ROBOT_STATE',
          robotId: robot.id,
        },
      });

      expect(state).toEqual(originalState);
    });

    it.each(['LOADING', 'UNLOADING'] as const)('should reject a robot in %s phase', (phase) => {
      const robot = createRobot({
        status: 'busy',
      });

      const task: Task = {
        id: 'task-1',
        pickupStationId: 'station-1',
        deliveryStationId: 'station-2',
        robotId: robot.id,
        status: 'in_progress',
        phase,
        remainingHandlingTicks: 2,
      };

      const state = createState({
        robots: [robot],
        tasks: [task],
      });

      const originalState = structuredClone(state);

      const result = applyCommand(state, {
        type: 'SET_ROBOT_WAITING',
        robotId: robot.id,
        reason: 'BLOCKED',
      });

      expect(result).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_ROBOT_STATE',
          robotId: robot.id,
        },
      });

      expect(state).toEqual(originalState);
    });

    it('should preserve other robots, routes and tasks', () => {
      const robotA = createRobot({
        id: 'robot-a',
        status: 'busy',
      });

      const robotB = createRobot({
        id: 'robot-b',
        position: { x: 10, y: 10 },
        status: 'busy',
      });

      const taskA: Task = {
        id: 'task-a',
        pickupStationId: 'station-1',
        deliveryStationId: 'station-2',
        robotId: robotA.id,
        status: 'in_progress',
        phase: 'TO_PICKUP',
      };

      const taskB: Task = {
        id: 'task-b',
        pickupStationId: 'station-1',
        deliveryStationId: 'station-2',
        robotId: robotB.id,
        status: 'in_progress',
        phase: 'TO_DELIVERY',
      };

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
        tasks: [taskA, taskB],
      });

      const originalState = structuredClone(state);

      const result = applyCommand(state, {
        type: 'SET_ROBOT_WAITING',
        robotId: robotA.id,
        reason: 'BLOCKED',
      });

      if (!result.success) {
        throw new Error(result.error.message);
      }

      expect(result.state.robots).toEqual([
        {
          ...robotA,
          status: 'waiting',
          waitingReason: 'BLOCKED',
        },
        robotB,
      ]);

      expect(result.state.routes).toEqual([routeB]);
      expect(result.state.tasks).toEqual([taskA, taskB]);
      expect(result.state.tick).toBe(state.tick);

      expect(result.events).toEqual([
        {
          type: 'ROBOT_WAITING',
          robotId: robotA.id,
          reason: 'BLOCKED',
        },
      ]);

      expect(state).toEqual(originalState);
    });
  });
  describe('FAULT_ROBOT', () => {
    it('should set robot status to fault', () => {
      const robot = createRobot({
        status: 'busy',
      });

      const state = createState({
        robots: [robot],
      });

      const result = applyCommand(state, {
        type: 'FAULT_ROBOT',
        robotId: robot.id,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.state.robots[0].status).toBe('fault');

        expect(result.state.robots[0].position).toEqual(robot.position);

        expect(result.state.robots[0].direction).toBe(robot.direction);

        expect(result.events).toEqual([
          {
            type: 'ROBOT_FAULT',
            robotId: robot.id,
          },
        ]);
      }
    });

    it('should clear the waiting reason', () => {
      const robot = createRobot({
        status: 'waiting',
        waitingReason: 'BLOCKED',
      });

      const state = createState({
        robots: [robot],
      });

      const result = applyCommand(state, {
        type: 'FAULT_ROBOT',
        robotId: robot.id,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.state.robots[0].waitingReason).toBeUndefined();
      }
    });

    it('should remove the route of a faulty robot', () => {
      const robot = createRobot();

      const route = createRoute(robot.id, [
        {
          tick: 1,
          action: 'FORWARD',
          position: { x: 2, y: 2 },
          direction: 'UP',
        },
      ]);

      const state = createState({
        robots: [robot],
        routes: [route],
      });

      const result = applyCommand(state, {
        type: 'FAULT_ROBOT',
        robotId: robot.id,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.state.routes).toEqual([]);
      }
    });

    it('should preserve other robots and their routes', () => {
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
          action: 'WAIT',
          position: robotA.position,
          direction: robotA.direction,
        },
      ]);

      const routeB = createRoute(robotB.id, [
        {
          tick: 1,
          action: 'WAIT',
          position: robotB.position,
          direction: robotB.direction,
        },
      ]);

      const state = createState({
        robots: [robotA, robotB],
        routes: [routeA, routeB],
      });

      const result = applyCommand(state, {
        type: 'FAULT_ROBOT',
        robotId: robotA.id,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.state.robots[1]).toEqual(robotB);
        expect(result.state.routes).toEqual([routeB]);
      }
    });

    it('should reject an unknown robot', () => {
      const state = createState();

      const result = applyCommand(state, {
        type: 'FAULT_ROBOT',
        robotId: 'unknown-robot',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe('ROBOT_NOT_FOUND');
        expect(result.error.robotId).toBe('unknown-robot');
      }
    });

    it('should reject a robot already in fault state', () => {
      const robot = createRobot({
        status: 'fault',
      });

      const state = createState({
        robots: [robot],
      });

      const result = applyCommand(state, {
        type: 'FAULT_ROBOT',
        robotId: robot.id,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe('INVALID_ROBOT_STATE');
      }
    });
  });

  describe('RESTORE_ROBOT', () => {
    it('should restore a faulty robot to idle', () => {
      const robot = createRobot({
        status: 'fault',
      });

      const state = createState({
        robots: [robot],
      });

      const result = applyCommand(state, {
        type: 'RESTORE_ROBOT',
        robotId: robot.id,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.state.robots[0].status).toBe('idle');

        expect(result.state.robots[0].position).toEqual(robot.position);

        expect(result.state.robots[0].direction).toBe(robot.direction);

        expect(result.state.robots[0].waitingReason).toBeUndefined();

        expect(result.events).toEqual([
          {
            type: 'ROBOT_RESTORED',
            robotId: robot.id,
          },
        ]);
      }
    });

    it('should not create a route for a restored robot', () => {
      const robot = createRobot({
        status: 'fault',
      });

      const state = createState({
        robots: [robot],
      });

      const result = applyCommand(state, {
        type: 'RESTORE_ROBOT',
        robotId: robot.id,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.state.routes).toEqual([]);
      }
    });

    it('should reject an unknown robot', () => {
      const state = createState();

      const result = applyCommand(state, {
        type: 'RESTORE_ROBOT',
        robotId: 'unknown-robot',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe('ROBOT_NOT_FOUND');
        expect(result.error.robotId).toBe('unknown-robot');
      }
    });

    it.each(['idle', 'busy', 'waiting'] as const)(
      'should reject restoration of a robot in %s state',
      (status) => {
        const robot = createRobot({
          status,
        });

        const state = createState({
          robots: [robot],
        });

        const result = applyCommand(state, {
          type: 'RESTORE_ROBOT',
          robotId: robot.id,
        });

        expect(result.success).toBe(false);

        if (!result.success) {
          expect(result.error.code).toBe('INVALID_ROBOT_STATE');
        }
      },
    );
    it.each(['TO_PICKUP', 'TO_DELIVERY'] as const)(
      'should restore a robot in %s phase to waiting',
      (phase) => {
        const robot = createRobot({
          status: 'fault',
        });

        const task: Task = {
          id: 'task-1',
          pickupStationId: 'station-1',
          deliveryStationId: 'station-2',
          robotId: robot.id,
          status: 'in_progress',
          phase,
        };

        const state = createState({
          robots: [robot],
          tasks: [task],
        });

        const originalState = structuredClone(state);

        const result = applyCommand(state, {
          type: 'RESTORE_ROBOT',
          robotId: robot.id,
        });

        expect(result.success).toBe(true);

        if (result.success) {
          expect(result.state.robots[0]).toEqual({
            ...robot,
            status: 'waiting',
            waitingReason: 'WAITING_FOR_PATH',
          });

          expect(result.state.tasks).toEqual([task]);
          expect(result.state.routes).toEqual([]);
          expect(result.state.tick).toBe(state.tick);

          expect(result.events).toEqual([
            {
              type: 'ROBOT_RESTORED',
              robotId: robot.id,
            },
          ]);
        }

        expect(state).toEqual(originalState);
      },
    );

    it.each(['LOADING', 'UNLOADING'] as const)(
      'should restore a robot in %s phase to busy',
      (phase) => {
        const robot = createRobot({
          status: 'fault',
        });

        const task: Task = {
          id: 'task-1',
          pickupStationId: 'station-1',
          deliveryStationId: 'station-2',
          robotId: robot.id,
          status: 'in_progress',
          phase,
          remainingHandlingTicks: 1,
        };

        const state = createState({
          robots: [robot],
          tasks: [task],
        });

        const originalState = structuredClone(state);

        const result = applyCommand(state, {
          type: 'RESTORE_ROBOT',
          robotId: robot.id,
        });

        expect(result.success).toBe(true);

        if (result.success) {
          expect(result.state.robots[0]).toEqual({
            ...robot,
            status: 'busy',
            waitingReason: undefined,
          });

          expect(result.state.tasks).toEqual([task]);
          expect(result.state.tasks[0].remainingHandlingTicks).toBe(1);
          expect(result.state.routes).toEqual([]);
          expect(result.state.tick).toBe(state.tick);

          expect(result.events).toEqual([
            {
              type: 'ROBOT_RESTORED',
              robotId: robot.id,
            },
          ]);
        }

        expect(state).toEqual(originalState);
      },
    );

    it('should restore a robot with a completed task to idle', () => {
      const robot = createRobot({
        status: 'fault',
      });

      const task: Task = {
        id: 'task-1',
        pickupStationId: 'station-1',
        deliveryStationId: 'station-2',
        robotId: robot.id,
        status: 'completed',
      };

      const state = createState({
        robots: [robot],
        tasks: [task],
      });

      const result = applyCommand(state, {
        type: 'RESTORE_ROBOT',
        robotId: robot.id,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.state.robots[0]).toEqual({
          ...robot,
          status: 'idle',
          waitingReason: undefined,
        });

        expect(result.state.tasks).toEqual([task]);
        expect(result.state.routes).toEqual([]);
      }
    });
  });

  describe('Immutability', () => {
    it('should not mutate state when creating a task', () => {
      const state = createState();
      const originalState = structuredClone(state);

      const result = applyCommand(state, {
        type: 'CREATE_TASK',
        task: createTask(),
      });

      expect(result.success).toBe(true);
      expect(state).toEqual(originalState);
    });

    it('should not mutate state when setting a route', () => {
      const robot = createRobot();

      const state = createState({
        robots: [robot],
      });

      const originalState = structuredClone(state);

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route: createRoute(robot.id, [
          {
            tick: 1,
            action: 'FORWARD',
            position: { x: 2, y: 2 },
            direction: 'UP',
          },
        ]),
      });

      expect(result.success).toBe(true);
      expect(state).toEqual(originalState);
    });

    it('should not mutate state when faulting a robot', () => {
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
          ]),
        ],
      });

      const originalState = structuredClone(state);

      const result = applyCommand(state, {
        type: 'FAULT_ROBOT',
        robotId: robot.id,
      });

      expect(result.success).toBe(true);
      expect(state).toEqual(originalState);
    });

    it('should not mutate state when restoring a robot', () => {
      const robot = createRobot({
        status: 'fault',
      });

      const state = createState({
        robots: [robot],
      });

      const originalState = structuredClone(state);

      const result = applyCommand(state, {
        type: 'RESTORE_ROBOT',
        robotId: robot.id,
      });

      expect(result.success).toBe(true);
      expect(state).toEqual(originalState);
    });

    it('should not mutate state when a command fails', () => {
      const robot = createRobot();

      const existingRoute = createRoute(robot.id, [
        {
          tick: 1,
          action: 'WAIT',
          position: robot.position,
          direction: robot.direction,
        },
      ]);

      const state = createState({
        robots: [robot],
        routes: [existingRoute],
      });

      const originalState = structuredClone(state);

      const result = applyCommand(state, {
        type: 'SET_ROUTE',
        route: createRoute(robot.id, []),
      });

      expect(result.success).toBe(false);
      expect(state).toEqual(originalState);
    });
  });
});
describe('ASSIGN_TASK', () => {
  it('should assign a queued task to an idle robot', () => {
    const task = createTask();
    const robot = createRobot();

    const state = createState({
      tasks: [task],
      robots: [robot],
    });

    const result = applyCommand(state, {
      type: 'ASSIGN_TASK',
      taskId: task.id,
      robotId: robot.id,
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error('Expected successful assignment');
    }

    expect(result.state.tasks[0]).toEqual({
      ...task,
      status: 'in_progress',
      phase: 'TO_PICKUP',
      robotId: robot.id,
    });

    expect(result.state.robots[0]).toEqual({
      ...robot,
      status: 'busy',
      waitingReason: undefined,
    });

    expect(result.state.tick).toBe(state.tick);

    expect(result.events).toEqual([
      {
        type: 'TASK_ASSIGNED',
        taskId: task.id,
        robotId: robot.id,
      },
    ]);
  });

  it('should remove the previous route of the assigned robot', () => {
    const task = createTask();
    const robot = createRobot();

    const route = createRoute(robot.id, [
      {
        tick: 1,
        action: 'FORWARD',
        position: { x: 2, y: 2 },
        direction: 'UP',
      },
    ]);

    const state = createState({
      tasks: [task],
      robots: [robot],
      routes: [route],
    });

    const result = applyCommand(state, {
      type: 'ASSIGN_TASK',
      taskId: task.id,
      robotId: robot.id,
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error('Expected successful assignment');
    }

    expect(result.state.routes).toEqual([]);
  });

  it('should preserve routes of other robots', () => {
    const task = createTask();
    const robot = createRobot();

    const otherRobot = createRobot({
      id: 'robot-2',
      position: { x: 5, y: 5 },
    });

    const route = createRoute(robot.id, [
      {
        tick: 1,
        action: 'FORWARD',
        position: { x: 2, y: 2 },
        direction: 'UP',
      },
    ]);

    const otherRoute = createRoute(otherRobot.id, [
      {
        tick: 1,
        action: 'FORWARD',
        position: { x: 5, y: 4 },
        direction: 'UP',
      },
    ]);

    const state = createState({
      tasks: [task],
      robots: [robot, otherRobot],
      routes: [route, otherRoute],
    });

    const result = applyCommand(state, {
      type: 'ASSIGN_TASK',
      taskId: task.id,
      robotId: robot.id,
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error('Expected successful assignment');
    }

    expect(result.state.routes).toEqual([otherRoute]);
    expect(result.state.robots[1]).toEqual(otherRobot);
  });

  it('should reject a nonexistent task', () => {
    const robot = createRobot();

    const state = createState({
      robots: [robot],
    });

    const result = applyCommand(state, {
      type: 'ASSIGN_TASK',
      taskId: 'unknown-task',
      robotId: robot.id,
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: 'TASK_NOT_FOUND',
        taskId: 'unknown-task',
      },
    });
  });

  it('should reject a nonexistent robot', () => {
    const task = createTask();

    const state = createState({
      tasks: [task],
    });

    const result = applyCommand(state, {
      type: 'ASSIGN_TASK',
      taskId: task.id,
      robotId: 'unknown-robot',
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: 'ROBOT_NOT_FOUND',
        robotId: 'unknown-robot',
      },
    });
  });

  it.each([
    {
      status: 'in_progress',
      phase: 'TO_PICKUP',
    },
    {
      status: 'completed',
    },
    {
      status: 'failed',
      failureReason: 'NO_PATH',
    },
  ] as const)('should reject a task with status $status', (taskState) => {
    const task: Task = {
      id: 'task-1',
      pickupStationId: 'station-1',
      deliveryStationId: 'station-2',
      ...taskState,
    };

    const robot = createRobot();

    const state = createState({
      tasks: [task],
      robots: [robot],
    });

    const result = applyCommand(state, {
      type: 'ASSIGN_TASK',
      taskId: task.id,
      robotId: robot.id,
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_TASK_STATE',
        taskId: task.id,
      },
    });
  });

  it.each(['busy', 'waiting', 'fault'] as const)(
    'should reject a robot with status %s',
    (status) => {
      const task = createTask();
      const robot = createRobot({ status });

      const state = createState({
        tasks: [task],
        robots: [robot],
      });

      const result = applyCommand(state, {
        type: 'ASSIGN_TASK',
        taskId: task.id,
        robotId: robot.id,
      });

      expect(result).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_ROBOT_STATE',
          robotId: robot.id,
        },
      });
    },
  );

  it('should reject a robot that already has an active task', () => {
    const task = createTask();
    const robot = createRobot();

    const activeTask: Task = {
      id: 'task-2',
      pickupStationId: 'station-1',
      deliveryStationId: 'station-2',
      robotId: robot.id,
      status: 'in_progress',
      phase: 'TO_PICKUP',
    };

    const state = createState({
      tasks: [task, activeTask],
      robots: [robot],
    });

    const result = applyCommand(state, {
      type: 'ASSIGN_TASK',
      taskId: task.id,
      robotId: robot.id,
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_ROBOT_STATE',
        robotId: robot.id,
      },
    });
  });

  it('should preserve other tasks', () => {
    const task = createTask();
    const otherTask = createTask({ id: 'task-2' });
    const robot = createRobot();

    const state = createState({
      tasks: [task, otherTask],
      robots: [robot],
    });

    const result = applyCommand(state, {
      type: 'ASSIGN_TASK',
      taskId: task.id,
      robotId: robot.id,
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error('Expected successful assignment');
    }

    expect(result.state.tasks[1]).toEqual(otherTask);
  });

  it('should not mutate the original state on success', () => {
    const task = createTask();
    const robot = createRobot();

    const state = createState({
      tasks: [task],
      robots: [robot],
    });

    const originalState = structuredClone(state);

    applyCommand(state, {
      type: 'ASSIGN_TASK',
      taskId: task.id,
      robotId: robot.id,
    });

    expect(state).toEqual(originalState);
  });

  it('should not mutate the original state on failure', () => {
    const task = createTask();
    const robot = createRobot({ status: 'busy' });

    const state = createState({
      tasks: [task],
      robots: [robot],
    });

    const originalState = structuredClone(state);

    applyCommand(state, {
      type: 'ASSIGN_TASK',
      taskId: task.id,
      robotId: robot.id,
    });

    expect(state).toEqual(originalState);
  });
});
