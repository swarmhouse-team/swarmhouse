import type { RobotState, Task } from '../contracts';
import type { SimulationState, SimulationEvent } from './types';

type ProcessTasksResult = {
  tasks: readonly Task[];
  robots: readonly RobotState[];
  events: readonly SimulationEvent[];
};

export function processTasks(state: SimulationState): ProcessTasksResult {
  return {
    tasks: state.tasks,
    robots: state.robots,
    events: [],
  };
}
