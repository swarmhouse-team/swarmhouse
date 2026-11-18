import { describe, expect, it } from 'vitest';

import {
  SOCKET_ENGINE_PATH,
  SOCKET_MAX_HTTP_BUFFER_BYTES,
  WAREHOUSE_REALTIME_EVENTS,
  WAREHOUSE_SOCKET_MAX_SUBSCRIPTIONS,
  WAREHOUSE_SOCKET_NAMESPACE,
  warehouseAckSchema,
  warehouseMapChangedEventSchema,
  warehouseMapEditAckSchema,
  warehouseMapEditPayloadSchema,
  warehouseSubscribePayloadSchema,
} from './warehouse-realtime';

const WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';
const MAP_ID = '22222222-2222-7111-8111-22222222222b';

const emptyMap = {
  mapId: MAP_ID,
  warehouseId: WAREHOUSE_ID,
  version: 3,
  width: 20,
  height: 20,
  obstacles: [],
  robots: [],
  stations: [],
};

describe('warehouse realtime contracts', () => {
  it('publishes one connection target', () => {
    expect(WAREHOUSE_SOCKET_NAMESPACE).toBe('/warehouse');
    expect(SOCKET_ENGINE_PATH).toBe('/api/socket.io');
    expect(SOCKET_MAX_HTTP_BUFFER_BYTES).toBe(16 * 1024);
    expect(WAREHOUSE_SOCKET_MAX_SUBSCRIPTIONS).toBe(20);
  });

  it('accepts one operation and rejects a warehouse id that is not a uuid', () => {
    expect(WAREHOUSE_REALTIME_EVENTS.mapEdit).toBe('warehouse.map.edit');
    expect(
      warehouseMapEditPayloadSchema.parse({
        mapId: MAP_ID,
        expectedVersion: 2,
        operation: { type: 'addObstacle', position: { x: 1, y: 2 } },
      }),
    ).toEqual({
      mapId: MAP_ID,
      expectedVersion: 2,
      operation: { type: 'addObstacle', position: { x: 1, y: 2 } },
    });
    expect(warehouseSubscribePayloadSchema.safeParse({ warehouseId: 'wh-1' }).success).toBe(false);
    expect(warehouseMapEditPayloadSchema.safeParse({ operations: [] }).success).toBe(false);
  });

  it('describes the ack and the operation on the map signal', () => {
    expect(warehouseAckSchema.parse({ ok: true })).toEqual({ ok: true });
    const move = {
      warehouseId: WAREHOUSE_ID,
      mapId: MAP_ID,
      version: 3,
      operation: { type: 'moveObstacle' as const, from: { x: 1, y: 1 }, to: { x: 2, y: 3 } },
    };
    expect(warehouseMapChangedEventSchema.parse(move)).toEqual(move);
    expect(warehouseMapChangedEventSchema.safeParse({ ...move, content: [] }).success).toBe(false);
    expect(
      warehouseMapEditAckSchema.parse({
        ok: true,
        data: { changed: true, map: emptyMap },
      }),
    ).toEqual({ ok: true, data: { changed: true, map: emptyMap } });
  });
});
