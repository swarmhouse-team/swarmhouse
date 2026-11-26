import type { Position } from './position';

export type Direction = 'UP' | 'RIGHT' | 'DOWN' | 'LEFT';

export type RobotConfig = {
  id: string;
  name: string;

  initialPosition: Position;
  initialDirection: Direction;

  homePosition: Position;
  homeDirection: Direction;
};

export type RobotStatus = 'idle' | 'busy' | 'waiting' | 'fault';

export type RobotWaitingReason = 'WAITING_FOR_PATH' | 'BLOCKED';

export type RobotState = {
  id: string;
  position: Position;
  direction: Direction;
  status: RobotStatus;
  waitingReason?: RobotWaitingReason;
};
