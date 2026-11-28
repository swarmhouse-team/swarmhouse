import type { RobotState, Task } from '../contracts';
import type { SimulationState, SimulationEvent } from './types';

type ProcessTasksResult = {
  tasks: readonly Task[];
  robots: readonly RobotState[];
  events: readonly SimulationEvent[];
};

export function processTasks(state: SimulationState): ProcessTasksResult {
  let nextRobots: readonly RobotState[] = state.robots;
  const events: SimulationEvent[] = [];
  const nextTasks: Task[] = state.tasks.map((task) => {
    if (task.status !== 'in_progress') {
      return task;
    }

    const robot = state.robots.find((robot) => robot.id === task.robotId);

    if (!robot || robot.status === 'fault' || robot.status === 'waiting') {
      return task;
    }
    if (task.phase === 'TO_PICKUP') {
      const station = state.grid.stations.find((station) => station.id === task.pickupStationId);

      if (!station) {
        return task;
      }

      const hasArrived = station.serviceCells.some(
        (cell) => cell.x === robot.position.x && cell.y === robot.position.y,
      );

      if (!hasArrived) {
        return task;
      }
      const hasActiveRoute = state.routes.some((route) => route.robotId === robot.id);

      if (hasActiveRoute) {
        return task;
      }
      events.push({
        type: 'LOADING_STARTED',
        taskId: task.id,
        robotId: robot.id,
      });

      return {
        id: task.id,
        pickupStationId: task.pickupStationId,
        deliveryStationId: task.deliveryStationId,
        robotId: robot.id,
        status: 'in_progress',
        phase: 'LOADING',
        remainingHandlingTicks: state.config.cargoHandlingTicks,
      };
    }
    if (task.phase === 'LOADING') {
      const remainingHandlingTicks = task.remainingHandlingTicks - 1;

      if (remainingHandlingTicks > 0) {
        return {
          ...task,
          remainingHandlingTicks,
        };
      }
      events.push({
        type: 'LOADING_COMPLETED',
        taskId: task.id,
        robotId: robot.id,
      });
      return {
        id: task.id,
        pickupStationId: task.pickupStationId,
        deliveryStationId: task.deliveryStationId,
        robotId: robot.id,
        status: 'in_progress',
        phase: 'TO_DELIVERY',
      };
    }
    if (task.phase === 'TO_DELIVERY') {
      const station = state.grid.stations.find((station) => station.id === task.deliveryStationId);

      if (!station) {
        return task;
      }

      const hasArrived = station.serviceCells.some(
        (cell) => cell.x === robot.position.x && cell.y === robot.position.y,
      );

      if (!hasArrived) {
        return task;
      }

      const hasActiveRoute = state.routes.some((route) => route.robotId === robot.id);

      if (hasActiveRoute) {
        return task;
      }
      events.push({
        type: 'UNLOADING_STARTED',
        taskId: task.id,
        robotId: robot.id,
      });
      return {
        id: task.id,
        pickupStationId: task.pickupStationId,
        deliveryStationId: task.deliveryStationId,
        robotId: robot.id,
        status: 'in_progress',
        phase: 'UNLOADING',
        remainingHandlingTicks: state.config.cargoHandlingTicks,
      };
    }
    if (task.phase === 'UNLOADING') {
      const remainingHandlingTicks = task.remainingHandlingTicks - 1;

      if (remainingHandlingTicks > 0) {
        return {
          ...task,
          remainingHandlingTicks,
        };
      }

      nextRobots = nextRobots.map((item) =>
        item.id === robot.id
          ? {
              ...item,
              status: 'idle',
              waitingReason: undefined,
            }
          : item,
      );
      events.push({
        type: 'TASK_COMPLETED',
        taskId: task.id,
        robotId: robot.id,
      });
      return {
        id: task.id,
        pickupStationId: task.pickupStationId,
        deliveryStationId: task.deliveryStationId,
        robotId: robot.id,
        status: 'completed',
      };
    }

    return task;
  });

  return {
    tasks: nextTasks,
    robots: nextRobots,
    events,
  };
}
