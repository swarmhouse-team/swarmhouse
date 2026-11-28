import type { RobotRoute, RobotState, Position, Grid, Direction, RouteStep } from '../contracts';

import type { SimulationState } from './types';

import { isInsideGrid, isObstacle, turnLeft, turnRight, getForwardPosition } from '../utils';

export function validateRouteStep(
  currentPosition: Position,
  currentDirection: Direction,
  step: RouteStep,
): boolean {
  if (step.action === 'WAIT') {
    return (
      step.position.x === currentPosition.x &&
      step.position.y === currentPosition.y &&
      step.direction === currentDirection
    );
  }

  if (step.action === 'TURN_LEFT') {
    return (
      step.position.x === currentPosition.x &&
      step.position.y === currentPosition.y &&
      step.direction === turnLeft(currentDirection)
    );
  }

  if (step.action === 'TURN_RIGHT') {
    return (
      step.position.x === currentPosition.x &&
      step.position.y === currentPosition.y &&
      step.direction === turnRight(currentDirection)
    );
  }

  if (step.action === 'FORWARD') {
    const expectedPosition = getForwardPosition(currentPosition, currentDirection);

    return (
      step.position.x === expectedPosition.x &&
      step.position.y === expectedPosition.y &&
      step.direction === currentDirection
    );
  }

  return false;
}
export function validateRouteActions(robot: RobotState, route: RobotRoute, grid: Grid): boolean {
  let currentPosition = robot.position;
  let currentDirection = robot.direction;

  for (const step of route.steps) {
    if (!isInsideGrid(step.position, grid)) {
      return false;
    }

    if (isObstacle(step.position, grid)) {
      return false;
    }

    if (!validateRouteStep(currentPosition, currentDirection, step)) {
      return false;
    }

    currentPosition = step.position;
    currentDirection = step.direction;
  }

  return true;
}

function getRobotPositionAtTick(
  robot: RobotState,
  route: RobotRoute | undefined,
  tick: number,
): Position {
  if (!route || tick <= route.startTick) {
    return robot.position;
  }

  const step = route.steps.find((step) => step.tick === tick);

  if (step) {
    return step.position;
  }

  const lastStep = route.steps[route.steps.length - 1];

  if (tick > lastStep.tick) {
    return lastStep.position;
  }

  return robot.position;
}
export function isCellOccupiedAtTick(
  state: SimulationState,
  robotId: string,
  position: Position,
  tick: number,
): boolean {
  return state.robots.some((otherRobot) => {
    if (otherRobot.id === robotId) {
      return false;
    }

    const route = state.routes.find((route) => route.robotId === otherRobot.id);

    const otherPosition = getRobotPositionAtTick(otherRobot, route, tick);

    return otherPosition.x === position.x && otherPosition.y === position.y;
  });
}
export function isSwapConflict(
  state: SimulationState,
  robotId: string,
  from: Position,
  to: Position,
  tick: number,
): boolean {
  return state.robots.some((otherRobot) => {
    if (from.x === to.x && from.y === to.y) {
      return false;
    }
    if (otherRobot.id === robotId) {
      return false;
    }

    const route = state.routes.find((route) => route.robotId === otherRobot.id);

    const otherFrom = getRobotPositionAtTick(otherRobot, route, tick - 1);

    const otherTo = getRobotPositionAtTick(otherRobot, route, tick);

    return (
      otherFrom.x === to.x && otherFrom.y === to.y && otherTo.x === from.x && otherTo.y === from.y
    );
  });
}
export function isHandlingCargo(state: SimulationState, robotId: string): boolean {
  return state.tasks.some(
    (task) =>
      task.robotId === robotId &&
      task.status === 'in_progress' &&
      (task.phase === 'LOADING' || task.phase === 'UNLOADING'),
  );
}
