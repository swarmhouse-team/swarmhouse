import type { Position } from './position';
import type { Direction } from './robot';

export type RobotAction = 'FORWARD' | 'TURN_LEFT' | 'TURN_RIGHT' | 'WAIT';

export type RouteStep = {
  tick: number;
  action: RobotAction;
  position: Position;
  direction: Direction;
};

export type RobotRoute = {
  robotId: string;
  startTick: number;
  steps: readonly RouteStep[];
};
