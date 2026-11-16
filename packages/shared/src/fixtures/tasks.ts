import type { Task } from '../contracts';

const warehouseId = 'wh-1';
const createdAt = '2026-11-12T10:00:00.000Z';
const updatedAt = '2026-11-12T10:05:00.000Z';

/** Задания во всех статусах. `warehouseId` совпадает с прежней fixture карты. */
export const validTasks = [
  {
    id: 'task-queued',
    warehouseId,
    fromStationId: 'st-reception',
    toStationId: 'st-shipping',
    status: 'queued',
    createdBy: 'user-1',
    createdAt,
    updatedAt,
  },
  {
    id: 'task-in-progress',
    warehouseId,
    fromStationId: 'st-reception',
    toStationId: 'st-shipping',
    status: 'in_progress',
    robotId: 'rb-1',
    createdBy: 'user-1',
    createdAt,
    updatedAt,
  },
  {
    id: 'task-completed',
    warehouseId,
    fromStationId: 'st-shipping',
    toStationId: 'st-reception',
    status: 'completed',
    robotId: 'rb-1',
    createdBy: 'user-1',
    createdAt,
    updatedAt,
  },
  {
    id: 'task-failed',
    warehouseId,
    fromStationId: 'st-reception',
    toStationId: 'st-shipping',
    status: 'failed',
    robotId: 'rb-1',
    failureReason: 'Маршрут не найден',
    createdBy: 'user-1',
    createdAt,
    updatedAt,
  },
] satisfies Task[];
