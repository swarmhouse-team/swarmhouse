import type { RobotRoute, Task, RobotState } from '../contracts';
import type { SimulationState, SimulationEvent } from './types';

import { validateRouteActions, isCellOccupiedAtTick, isSwapConflict } from './utils';

export type SimulationCommand =
  | {
      type: 'SET_ROUTE';
      route: RobotRoute;
    }
  | {
      type: 'FAULT_ROBOT';
      robotId: string;
    }
  | {
      type: 'RESTORE_ROBOT';
      robotId: string;
    }
  | {
      type: 'CREATE_TASK';
      task: Task;
    }
  | {
      type: 'ASSIGN_TASK';
      taskId: string;
      robotId: string;
    };

export type CommandErrorCode =
  | 'ROBOT_NOT_FOUND'
  | 'INVALID_ROUTE'
  | 'INVALID_ROBOT_STATE'
  | 'TASK_ALREADY_EXISTS'
  | 'TASK_NOT_FOUND'
  | 'INVALID_TASK_STATE';

export type CommandError = {
  code: CommandErrorCode;
  robotId?: string;
  taskId?: string;
  message: string;
};

export type CommandResult =
  | {
      success: true;
      state: SimulationState;
      events: readonly SimulationEvent[];
    }
  | {
      success: false;
      error: CommandError;
    };

export function applyCommand(state: SimulationState, command: SimulationCommand): CommandResult {
  switch (command.type) {
    case 'CREATE_TASK': {
      const taskExists = state.tasks.some((task) => task.id === command.task.id);

      if (taskExists) {
        return {
          success: false,
          error: {
            code: 'TASK_ALREADY_EXISTS',
            taskId: command.task.id,
            message: `Task ${command.task.id} already exists`,
          },
        };
      }

      const newTask: Task = {
        id: command.task.id,
        pickupStationId: command.task.pickupStationId,
        deliveryStationId: command.task.deliveryStationId,
        status: 'queued',
      };

      return {
        success: true,
        state: {
          ...state,
          tasks: [...state.tasks, newTask],
        },
        events: [
          {
            type: 'TASK_CREATED',
            taskId: newTask.id,
          },
        ],
      };
    }
    case 'ASSIGN_TASK': {
      const task = state.tasks.find((task) => task.id === command.taskId);

      if (!task) {
        return {
          success: false,
          error: {
            code: 'TASK_NOT_FOUND',
            taskId: command.taskId,
            message: 'Task not found',
          },
        };
      }

      const robot = state.robots.find((robot) => robot.id === command.robotId);

      if (!robot) {
        return {
          success: false,
          error: {
            code: 'ROBOT_NOT_FOUND',
            robotId: command.robotId,
            message: 'Robot not found',
          },
        };
      }
      if (task.status !== 'queued') {
        return {
          success: false,
          error: {
            code: 'INVALID_TASK_STATE',
            taskId: task.id,
            message: 'Task must be queued',
          },
        };
      }

      if (robot.status !== 'idle') {
        return {
          success: false,
          error: {
            code: 'INVALID_ROBOT_STATE',
            robotId: robot.id,
            message: 'Robot must be idle',
          },
        };
      }
      const hasActiveTask = state.tasks.some(
        (task) => task.robotId === robot.id && task.status === 'in_progress',
      );

      if (hasActiveTask) {
        return {
          success: false,
          error: {
            code: 'INVALID_ROBOT_STATE',
            robotId: robot.id,
            message: 'Robot already has an active task',
          },
        };
      }
      const nextRoutes = state.routes.filter((route) => route.robotId !== robot.id);
      const nextTasks: Task[] = state.tasks.map((item) =>
        item.id === task.id
          ? {
              id: item.id,
              pickupStationId: item.pickupStationId,
              deliveryStationId: item.deliveryStationId,
              status: 'in_progress',
              phase: 'TO_PICKUP',
              robotId: robot.id,
            }
          : item,
      );

      const nextRobots: RobotState[] = state.robots.map((item) =>
        item.id === robot.id
          ? {
              ...item,
              status: 'busy',
              waitingReason: undefined,
            }
          : item,
      );
      return {
        success: true,
        state: {
          ...state,
          tasks: nextTasks,
          robots: nextRobots,
          routes: nextRoutes,
        },
        events: [
          {
            type: 'TASK_ASSIGNED',
            taskId: task.id,
            robotId: robot.id,
          },
        ],
      };
    }
    case 'SET_ROUTE': {
      const robot = state.robots.find((robot) => robot.id === command.route.robotId);

      if (!robot) {
        return {
          success: false,
          error: {
            code: 'ROBOT_NOT_FOUND',
            robotId: command.route.robotId,
            message: `Robot ${command.route.robotId} not found`,
          },
        };
      }
      if (robot.status === 'fault') {
        return {
          success: false,
          error: {
            code: 'INVALID_ROBOT_STATE',
            robotId: command.route.robotId,
            message: `Cannot set route for robot ${command.route.robotId}: robot is in fault state`,
          },
        };
      }
      if (command.route.startTick !== state.tick) {
        return {
          success: false,
          error: {
            code: 'INVALID_ROUTE',
            robotId: command.route.robotId,
            message: `Route must start at current tick ${state.tick}`,
          },
        };
      }
      if (command.route.steps.length === 0) {
        return {
          success: false,
          error: {
            code: 'INVALID_ROUTE',
            robotId: command.route.robotId,
            message: `Route for robot ${command.route.robotId} cannot be empty`,
          },
        };
      }
      if (command.route.steps[0].tick !== command.route.startTick + 1) {
        return {
          success: false,
          error: {
            code: 'INVALID_ROUTE',
            robotId: command.route.robotId,
            message: `First route step must complete at tick ${command.route.startTick + 1}`,
          },
        };
      }

      if (isCellOccupiedAtTick(state, robot.id, robot.position, state.tick)) {
        return {
          success: false,
          error: {
            code: 'INVALID_ROUTE',
            robotId: robot.id,
            message: `Robot ${robot.id} has a collision at current tick ${state.tick}`,
          },
        };
      }

      const steps = command.route.steps;

      for (let i = 1; i < steps.length; i++) {
        if (steps[i].tick !== steps[i - 1].tick + 1) {
          return {
            success: false,
            error: {
              code: 'INVALID_ROUTE',
              robotId: command.route.robotId,
              message: `Route steps must have consecutive ticks`,
            },
          };
        }
      }

      if (!validateRouteActions(robot, command.route, state.grid)) {
        return {
          success: false,
          error: {
            code: 'INVALID_ROUTE',
            robotId: command.route.robotId,
            message: `Invalid route actions for robot ${command.route.robotId}`,
          },
        };
      }

      let previousPosition = robot.position;

      for (const step of command.route.steps) {
        if (
          isCellOccupiedAtTick(state, robot.id, step.position, step.tick) ||
          isSwapConflict(state, robot.id, previousPosition, step.position, step.tick)
        ) {
          return {
            success: false,
            error: {
              code: 'INVALID_ROUTE',
              robotId: robot.id,
              message: `Route collision for robot ${robot.id} at tick ${step.tick}`,
            },
          };
        }

        previousPosition = step.position;
      }

      const lastStep = command.route.steps[command.route.steps.length - 1];

      const latestRouteTick = Math.max(
        lastStep.tick,
        ...state.routes.flatMap((route) => route.steps.map((step) => step.tick)),
      );

      for (let tick = lastStep.tick + 1; tick <= latestRouteTick; tick++) {
        if (isCellOccupiedAtTick(state, robot.id, lastStep.position, tick)) {
          return {
            success: false,
            error: {
              code: 'INVALID_ROUTE',
              robotId: robot.id,
              message: `Robot ${robot.id} has a collision after route ends at tick ${tick}`,
            },
          };
        }
      }

      return {
        success: true,
        state: {
          ...state,
          routes: [...state.routes.filter((route) => route.robotId !== robot.id), command.route],
        },
        events: [],
      };
    }
    case 'FAULT_ROBOT': {
      const robot = state.robots.find((robot) => robot.id === command.robotId);

      if (!robot) {
        return {
          success: false,
          error: {
            code: 'ROBOT_NOT_FOUND',
            robotId: command.robotId,
            message: `Robot ${command.robotId} not found`,
          },
        };
      }
      if (robot.status === 'fault') {
        return {
          success: false,
          error: {
            code: 'INVALID_ROBOT_STATE',
            robotId: command.robotId,
            message: `Robot ${command.robotId} is already in fault state`,
          },
        };
      }

      return {
        success: true,
        state: {
          ...state,
          robots: state.robots.map((robot) =>
            robot.id === command.robotId
              ? {
                  ...robot,
                  status: 'fault' as const,
                  waitingReason: undefined,
                }
              : robot,
          ),
          routes: state.routes.filter((route) => route.robotId !== command.robotId),
        },
        events: [
          {
            type: 'ROBOT_FAULT',
            robotId: command.robotId,
          },
        ],
      };
    }
    case 'RESTORE_ROBOT': {
      const robot = state.robots.find((robot) => robot.id === command.robotId);

      if (!robot) {
        return {
          success: false,
          error: {
            code: 'ROBOT_NOT_FOUND',
            robotId: command.robotId,
            message: `Robot ${command.robotId} not found`,
          },
        };
      }
      if (robot.status !== 'fault') {
        return {
          success: false,
          error: {
            code: 'INVALID_ROBOT_STATE',
            robotId: command.robotId,
            message: `Robot ${command.robotId} is not in fault state`,
          },
        };
      }

      return {
        success: true,
        state: {
          ...state,
          robots: state.robots.map((robot) =>
            robot.id === command.robotId
              ? {
                  ...robot,
                  status: 'idle' as const,
                  waitingReason: undefined,
                }
              : robot,
          ),
        },
        events: [
          {
            type: 'ROBOT_RESTORED',
            robotId: command.robotId,
          },
        ],
      };
    }
  }
}
