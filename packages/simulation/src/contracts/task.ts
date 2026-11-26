export type TaskStatus = 'queued' | 'in_progress' | 'completed' | 'failed';

export type TaskPhase = 'TO_PICKUP' | 'LOADING' | 'TO_DELIVERY' | 'UNLOADING';

export type TaskFailureReason = 'NO_PATH';

export type Task = {
  id: string;

  pickupStationId: string;
  deliveryStationId: string;

  robotId?: string;
} & (
  | {
      status: 'queued' | 'completed';
      phase?: never;
      remainingHandlingTicks?: never;
      failureReason?: never;
    }
  | {
      status: 'in_progress';
      phase: 'TO_PICKUP' | 'TO_DELIVERY';
      remainingHandlingTicks?: never;
      failureReason?: never;
    }
  | {
      status: 'in_progress';
      phase: 'LOADING' | 'UNLOADING';
      remainingHandlingTicks: number;
      failureReason?: never;
    }
  | {
      status: 'failed';
      phase?: never;
      remainingHandlingTicks?: never;
      failureReason: TaskFailureReason;
    }
);
