import { z } from 'zod';

import { API_ERROR_CODES, apiErrorSchema } from '../api-error';

const UUID_TEXT = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
const MAX_UUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

/**
 * Та же текстовая форма, что у доменного `assertId`: любая версия UUID,
 * nil и max отклоняются. Регистр не меняется.
 */
export const uuidTextSchema = z.string().refine((value) => {
  if (!UUID_TEXT.test(value)) {
    return false;
  }

  const canonical = value.toLowerCase();
  return canonical !== NIL_UUID && canonical !== MAX_UUID;
});

export type UuidText = z.infer<typeof uuidTextSchema>;

const nonnegativeIntegerSchema = z.number().int().nonnegative();
const positiveIntegerSchema = z.number().int().positive();

/** Координаты команды. Целочисленность и границы проверяет домен. */
const warehouseCommandCellSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
});

export const warehouseStationTypeSchema = z.enum(['receiving', 'issuing', 'intermediate']);

export type WarehouseStationType = z.infer<typeof warehouseStationTypeSchema>;

const addObstacleOperationSchema = z.strictObject({
  type: z.literal('addObstacle'),
  position: warehouseCommandCellSchema,
});

const moveObstacleOperationSchema = z.strictObject({
  type: z.literal('moveObstacle'),
  from: warehouseCommandCellSchema,
  to: warehouseCommandCellSchema,
});

const removeObstacleOperationSchema = z.strictObject({
  type: z.literal('removeObstacle'),
  position: warehouseCommandCellSchema,
});

const placeRobotOperationSchema = z.strictObject({
  type: z.literal('placeRobot'),
  name: z.string(),
  position: warehouseCommandCellSchema,
});

const moveRobotOperationSchema = z.strictObject({
  type: z.literal('moveRobot'),
  robotId: uuidTextSchema,
  position: warehouseCommandCellSchema,
});

const removeRobotOperationSchema = z.strictObject({
  type: z.literal('removeRobot'),
  robotId: uuidTextSchema,
});

const placeStationOperationSchema = z.strictObject({
  type: z.literal('placeStation'),
  name: z.string(),
  stationType: warehouseStationTypeSchema,
  position: warehouseCommandCellSchema,
});

const moveStationOperationSchema = z.strictObject({
  type: z.literal('moveStation'),
  stationId: uuidTextSchema,
  position: warehouseCommandCellSchema,
});

const removeStationOperationSchema = z.strictObject({
  type: z.literal('removeStation'),
  stationId: uuidTextSchema,
});

export const editWarehouseMapOperationSchema = z.discriminatedUnion('type', [
  addObstacleOperationSchema,
  moveObstacleOperationSchema,
  removeObstacleOperationSchema,
  placeRobotOperationSchema,
  moveRobotOperationSchema,
  removeRobotOperationSchema,
  placeStationOperationSchema,
  moveStationOperationSchema,
  removeStationOperationSchema,
]);

export type EditWarehouseMapOperation = z.infer<typeof editWarehouseMapOperationSchema>;

export const createWarehouseRequestSchema = z.strictObject({
  name: z.string(),
});

export type CreateWarehouseRequest = z.infer<typeof createWarehouseRequestSchema>;

export const renameWarehouseRequestSchema = z.strictObject({
  name: z.string(),
});

export type RenameWarehouseRequest = z.infer<typeof renameWarehouseRequestSchema>;

export const warehousePathParamsSchema = z.strictObject({
  warehouseId: uuidTextSchema,
});

export type WarehousePathParams = z.infer<typeof warehousePathParamsSchema>;

export const warehouseMapPathParamsSchema = z.strictObject({
  mapId: uuidTextSchema,
});

export type WarehouseMapPathParams = z.infer<typeof warehouseMapPathParamsSchema>;

export const editWarehouseMapRequestSchema = z.strictObject({
  expectedVersion: nonnegativeIntegerSchema,
  operation: editWarehouseMapOperationSchema,
});

export type EditWarehouseMapRequest = z.infer<typeof editWarehouseMapRequestSchema>;

const warehouseMapCellSchema = z.strictObject({
  x: nonnegativeIntegerSchema,
  y: nonnegativeIntegerSchema,
});

export const warehouseMapBodySchema = z.strictObject({
  mapId: uuidTextSchema,
  warehouseId: uuidTextSchema,
  version: nonnegativeIntegerSchema,
  width: positiveIntegerSchema,
  height: positiveIntegerSchema,
  obstacles: z.array(warehouseMapCellSchema),
  robots: z.array(
    z.strictObject({
      id: uuidTextSchema,
      name: z.string(),
      x: nonnegativeIntegerSchema,
      y: nonnegativeIntegerSchema,
    }),
  ),
  stations: z.array(
    z.strictObject({
      id: uuidTextSchema,
      name: z.string(),
      type: warehouseStationTypeSchema,
      x: nonnegativeIntegerSchema,
      y: nonnegativeIntegerSchema,
    }),
  ),
});

export type WarehouseMapBody = z.infer<typeof warehouseMapBodySchema>;

export const getWarehouseMapResponseSchema = warehouseMapBodySchema;

export type GetWarehouseMapResponse = z.infer<typeof getWarehouseMapResponseSchema>;

export const createWarehouseResponseSchema = z.strictObject({
  warehouseId: uuidTextSchema,
  name: z.string(),
  mapId: uuidTextSchema,
  version: nonnegativeIntegerSchema,
});

export type CreateWarehouseResponse = z.infer<typeof createWarehouseResponseSchema>;

/**
 * A rename no-op returns the name observed on read.
 * A later concurrent rename is allowed.
 */
export const renameWarehouseResponseSchema = z.strictObject({
  warehouseId: uuidTextSchema,
  name: z.string(),
});

export type RenameWarehouseResponse = z.infer<typeof renameWarehouseResponseSchema>;

/**
 * When `changed` is false, the map is the consistent snapshot and version of the state that was read.
 * `expectedVersion` is checked against that read.
 * A later concurrent change is allowed.
 * A changing save performs its own atomic version check.
 */
export const editWarehouseMapResponseSchema = z.strictObject({
  changed: z.boolean(),
  createdId: uuidTextSchema.optional(),
  map: warehouseMapBodySchema,
});

export type EditWarehouseMapResponse = z.infer<typeof editWarehouseMapResponseSchema>;

/**
 * Публичное тело 409. Версии остаются во внутренней ошибке приложения.
 * Клиент узнаёт конфликт по коду и перечитывает карту.
 */
export const mapVersionConflictErrorSchema = apiErrorSchema.extend({
  code: z.literal(API_ERROR_CODES.MAP_VERSION_CONFLICT),
});

export type MapVersionConflictError = z.infer<typeof mapVersionConflictErrorSchema>;

/**
 * Коды, которые HTTP склада отдаёт клиенту.
 * Повреждённое состояние карты наружу не выходит: клиент получает `INTERNAL_ERROR`.
 */
export const WAREHOUSE_HTTP_ERROR_CODES = {
  VALIDATION_ERROR: API_ERROR_CODES.VALIDATION_ERROR,
  BAD_REQUEST: API_ERROR_CODES.BAD_REQUEST,
  WAREHOUSE_NOT_FOUND: 'WAREHOUSE_NOT_FOUND',
  MAP_NOT_FOUND: 'MAP_NOT_FOUND',
  MAP_VERSION_CONFLICT: API_ERROR_CODES.MAP_VERSION_CONFLICT,
  INVALID_ID: 'INVALID_ID',
  INVALID_POSITION: 'INVALID_POSITION',
  INVALID_GRID_SIZE: 'INVALID_GRID_SIZE',
  INVALID_NAME: 'INVALID_NAME',
  POSITION_OUT_OF_BOUNDS: 'POSITION_OUT_OF_BOUNDS',
  CELL_OCCUPIED: 'CELL_OCCUPIED',
  DUPLICATE_OBJECT_ID: 'DUPLICATE_OBJECT_ID',
  DUPLICATE_STATION_NAME: 'DUPLICATE_STATION_NAME',
  MAP_OBJECT_NOT_FOUND: 'MAP_OBJECT_NOT_FOUND',
  INTERNAL_ERROR: API_ERROR_CODES.INTERNAL_ERROR,
} as const;

export type WarehouseHttpErrorCode =
  (typeof WAREHOUSE_HTTP_ERROR_CODES)[keyof typeof WAREHOUSE_HTTP_ERROR_CODES];
