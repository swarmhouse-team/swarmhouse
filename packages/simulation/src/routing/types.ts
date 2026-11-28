import type {
  Position,
  Direction,
  Grid,
  RobotState,
  RobotRoute,
  RoutingFailureReason,
  RobotAction,
} from '../contracts';

export type RoutingGoal = {
  positions: readonly Position[];
  direction?: Direction;
};
export type RoutingRequest = {
  grid: Grid;
  robot: RobotState;
  goal: RoutingGoal;
  currentTick: number;
  robots: readonly RobotState[];
  routes: readonly RobotRoute[];
  maxSearchTicks: number;
};
export type RoutingResult =
  | {
      success: true;
      route: RobotRoute;
    }
  | {
      success: false;
      reason: RoutingFailureReason;
    };
export type SearchNode = {
  position: Position;
  direction: Direction;
  tick: number;

  g: number;
  h: number;
  f: number;

  parent: SearchNode | null;
  action: RobotAction | null;
};
