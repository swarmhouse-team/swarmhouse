import { z } from 'zod';

import { apiErrorSchema } from '../api-error';
import {
  editWarehouseMapOperationSchema,
  editWarehouseMapResponseSchema,
  uuidTextSchema,
} from './warehouse';

/**
 * Socket.IO events for one warehouse process.
 * `warehouse.map.edit` repeats the HTTP body: one `operation`, not a list.
 */
export const WAREHOUSE_REALTIME_EVENTS = {
  subscribe: 'warehouse.subscribe',
  unsubscribe: 'warehouse.unsubscribe',
  mapEdit: 'warehouse.map.edit',
  mapChanged: 'warehouse.map.changed',
  updated: 'warehouse.updated',
  deleted: 'warehouse.deleted',
} as const;

export const warehouseSubscribePayloadSchema = z.strictObject({
  warehouseId: uuidTextSchema,
});

export type WarehouseSubscribePayload = z.infer<typeof warehouseSubscribePayloadSchema>;

export const warehouseMapEditPayloadSchema = z.strictObject({
  mapId: uuidTextSchema,
  expectedVersion: z.number().int().nonnegative(),
  operation: editWarehouseMapOperationSchema,
});

export type WarehouseMapEditPayload = z.infer<typeof warehouseMapEditPayloadSchema>;

/** Saved map edit. Subscribers apply `operation` when their version is exactly one behind. */
export const warehouseMapChangedEventSchema = z.strictObject({
  warehouseId: uuidTextSchema,
  mapId: uuidTextSchema,
  version: z.number().int().nonnegative(),
  operation: editWarehouseMapOperationSchema,
  createdId: uuidTextSchema.optional(),
});

export type WarehouseMapChangedEvent = z.infer<typeof warehouseMapChangedEventSchema>;

export const warehouseUpdatedEventSchema = z.strictObject({
  warehouseId: uuidTextSchema,
});

export type WarehouseUpdatedEvent = z.infer<typeof warehouseUpdatedEventSchema>;

export const warehouseDeletedEventSchema = z.strictObject({
  warehouseId: uuidTextSchema,
});

export type WarehouseDeletedEvent = z.infer<typeof warehouseDeletedEventSchema>;

export const warehouseAckSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true) }),
  z.strictObject({ ok: z.literal(false), error: apiErrorSchema }),
]);

export type WarehouseAck = z.infer<typeof warehouseAckSchema>;

export const warehouseMapEditAckSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), data: editWarehouseMapResponseSchema }),
  z.strictObject({ ok: z.literal(false), error: apiErrorSchema }),
]);

export type WarehouseMapEditAck = z.infer<typeof warehouseMapEditAckSchema>;
