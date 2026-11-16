import { describe, expect, it } from 'vitest';

import {
  WAREHOUSE_REALTIME_EVENTS,
  warehouseAckSchema,
  warehouseMapChangedEventSchema,
  warehouseMapEditAckSchema,
  warehouseMapEditPayloadSchema,
  warehouseSubscribePayloadSchema,
} from './warehouse-realtime';

const WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';
const MAP_ID = '22222222-2222-7111-8111-22222222222b';
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

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
  it('accepts one operation and rejects a nil uuid', () => {
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
    expect(warehouseSubscribePayloadSchema.safeParse({ warehouseId: NIL_UUID }).success).toBe(
      false,
    );
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
