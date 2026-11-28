import type { SimulationState, TickResult, SimulationEvent } from './types';
import type { RobotState } from '../contracts/robot';

import { isInsideGrid, isObstacle } from '../utils';
import { validateRouteStep, isHandlingCargo } from './utils';
import { processTasks } from './tasks';

export function tick(state: SimulationState): TickResult {
  const nextTick = state.tick + 1;
  const nextRobots: RobotState[] = [];

  for (const robot of state.robots) {
    const route = state.routes.find((route) => route.robotId === robot.id);

    if (!route || robot.status === 'fault') {
      nextRobots.push(robot);
      continue;
    }
    if (isHandlingCargo(state, robot.id)) {
      return {
        success: false,
        error: {
          code: 'INVALID_ROUTE',
          robotIds: [robot.id],
          tick: nextTick,
          message: `Robot ${robot.id} cannot execute a route while handling cargo`,
        },
      };
    }

    const nextStep = route.steps.find((step) => step.tick === nextTick);

    if (!nextStep) {
      return {
        success: false,
        error: {
          code: 'INVALID_ROUTE',
          robotIds: [robot.id],
          tick: nextTick,
          message: `Route for robot ${robot.id} has no step at tick ${nextTick}`,
        },
      };
    }
    if (!validateRouteStep(robot.position, robot.direction, nextStep)) {
      return {
        success: false,
        error: {
          code: 'INVALID_ROUTE',
          robotIds: [robot.id],
          tick: nextTick,
          message: `Invalid route step for robot ${robot.id} at tick ${nextTick}`,
        },
      };
    }
    nextRobots.push({
      ...robot,
      position: nextStep.position,
      direction: nextStep.direction,
    });
  }

  for (const robot of nextRobots) {
    if (!isInsideGrid(robot.position, state.grid)) {
      return {
        success: false,
        error: {
          code: 'OUT_OF_BOUNDS',
          robotIds: [robot.id],
          tick: nextTick,
          message: `Robot ${robot.id} is out of bounds at tick ${nextTick}`,
        },
      };
    }

    if (isObstacle(robot.position, state.grid)) {
      return {
        success: false,
        error: {
          code: 'OBSTACLE_COLLISION',
          robotIds: [robot.id],
          tick: nextTick,
          message: `Robot ${robot.id} collides with an obstacle at tick ${nextTick}`,
        },
      };
    }
  }

  const occupiedCells = new Map<string, string>();

  for (const robot of nextRobots) {
    const cellKey = `${robot.position.x},${robot.position.y}`;

    const occupyingRobotId = occupiedCells.get(cellKey);

    if (occupyingRobotId !== undefined) {
      return {
        success: false,
        error: {
          code: 'ROBOT_COLLISION',
          robotIds: [occupyingRobotId, robot.id],
          tick: nextTick,
          message: `Robots ${occupyingRobotId} and ${robot.id} collide at tick ${nextTick}`,
        },
      };
    }

    occupiedCells.set(cellKey, robot.id);
  }
  for (let i = 0; i < state.robots.length; i++) {
    for (let j = i + 1; j < state.robots.length; j++) {
      const robotA = state.robots[i];
      const robotB = state.robots[j];

      const nextRobotA = nextRobots[i];
      const nextRobotB = nextRobots[j];

      if (
        robotA.position.x === nextRobotB.position.x &&
        robotA.position.y === nextRobotB.position.y &&
        robotB.position.x === nextRobotA.position.x &&
        robotB.position.y === nextRobotA.position.y
      ) {
        return {
          success: false,
          error: {
            code: 'EDGE_COLLISION',
            robotIds: [robotA.id, robotB.id],
            tick: nextTick,
            message: `Robots ${robotA.id} and ${robotB.id} swap cells at tick ${nextTick}`,
          },
        };
      }
    }
  }

  const events: SimulationEvent[] = [];

  for (let i = 0; i < state.robots.length; i++) {
    const robot = state.robots[i];
    const nextRobot = nextRobots[i];

    if (robot.position.x !== nextRobot.position.x || robot.position.y !== nextRobot.position.y) {
      events.push({
        type: 'ROBOT_MOVED',
        robotId: robot.id,
        position: nextRobot.position,
        direction: nextRobot.direction,
      });
    }

    if (robot.direction !== nextRobot.direction) {
      events.push({
        type: 'ROBOT_TURNED',
        robotId: robot.id,
        direction: nextRobot.direction,
      });
    }
  }

  const completedRobotIds = new Set<string>();

  for (const route of state.routes) {
    const lastStep = route.steps[route.steps.length - 1];

    if (lastStep && lastStep.tick === nextTick) {
      const robot = nextRobots.find((robot) => robot.id === route.robotId);

      if (!robot || robot.status === 'fault') {
        continue;
      }

      completedRobotIds.add(route.robotId);

      events.push({
        type: 'ROUTE_COMPLETED',
        robotId: route.robotId,
      });
    }
  }
  const nextRoutes = state.routes.filter((route) => !completedRobotIds.has(route.robotId));

  const intermediateState: SimulationState = {
    ...state,
    tick: nextTick,
    robots: nextRobots,
    routes: nextRoutes,
  };

  const taskResult = processTasks(intermediateState);

  return {
    success: true,
    state: {
      ...intermediateState,
      robots: taskResult.robots,
      tasks: taskResult.tasks,
    },
    events: [...events, ...taskResult.events],
  };
}
