import type {
  Grid,
  RobotConfig,
  RobotState,
  RobotRoute,
  Position,
  Direction,
  Task,
  SimulationConfig,
} from '../contracts';

export type SimulationState = {
  tick: number;
  config: SimulationConfig;
  grid: Grid;
  robotConfigs: readonly RobotConfig[];
  robots: readonly RobotState[];
  routes: readonly RobotRoute[];
  tasks: readonly Task[];
};

export type SimulationEvent =
  | {
      type: 'ROBOT_MOVED';
      robotId: string;
      position: Position;
      direction: Direction;
    }
  | {
      type: 'ROBOT_TURNED';
      robotId: string;
      direction: Direction;
    }
  | {
      type: 'ROUTE_COMPLETED';
      robotId: string;
    }
  | {
      type: 'TASK_CREATED';
      taskId: string;
    }
  | {
      type: 'TASK_ASSIGNED';
      taskId: string;
      robotId: string;
    }
  | {
      type: 'ROBOT_FAULT';
      robotId: string;
    }
  | {
      type: 'ROBOT_RESTORED';
      robotId: string;
    }
  | {
      type: 'TASK_PICKED_UP';
      taskId: string;
      robotId: string;
    }
  | {
      type: 'TASK_DELIVERED';
      taskId: string;
      robotId: string;
    };

export type TickResult =
  | {
      success: true;
      state: SimulationState;
      events: readonly SimulationEvent[];
    }
  | {
      success: false;
      error: SimulationError;
    };

export type SimulationErrorCode =
  'OUT_OF_BOUNDS' | 'OBSTACLE_COLLISION' | 'ROBOT_COLLISION' | 'EDGE_COLLISION' | 'INVALID_ROUTE';

export type SimulationError = {
  code: SimulationErrorCode;
  robotIds: readonly string[];
  tick: number;
  message: string;
};
