import type { Task } from './task';
import type { WarehouseMap } from './map';

/** Карта, которая проходит `warehouseMapSchema`: две станции, препятствие и робот на разных клетках. */
export const validWarehouseMap = {
  warehouseId: 'wh-1',
  width: 5,
  height: 5,
  version: 1,
  obstacles: [{ id: 'ob-1', position: { x: 2, y: 2 } }],
  stations: [
    { id: 'st-reception', name: 'Приемка', position: { x: 0, y: 0 } },
    { id: 'st-shipping', name: 'Выдача', position: { x: 4, y: 0 } },
  ],
  robots: [{ id: 'rb-1', name: 'Робот 1', position: { x: 1, y: 1 } }],
} satisfies WarehouseMap;

const createdAt = '2026-11-12T10:00:00.000Z';
const updatedAt = '2026-11-12T10:05:00.000Z';

/** Задания на станции `validWarehouseMap` во всех статусах. */
export const validTasks = [
  {
    id: 'task-queued',
    warehouseId: validWarehouseMap.warehouseId,
    fromStationId: 'st-reception',
    toStationId: 'st-shipping',
    status: 'queued',
    createdBy: 'user-1',
    createdAt,
    updatedAt,
  },
  {
    id: 'task-in-progress',
    warehouseId: validWarehouseMap.warehouseId,
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
    warehouseId: validWarehouseMap.warehouseId,
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
    warehouseId: validWarehouseMap.warehouseId,
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
