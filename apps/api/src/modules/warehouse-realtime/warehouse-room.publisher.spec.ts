import { describe, expect, it, vi } from 'vitest';
import type { Namespace } from 'socket.io';

import { createRecordingLogger } from '../../common/testing/create-recording-logger';
import { WarehouseRoomPublisher } from './warehouse-room.publisher';
import { warehouseRoom } from './warehouse-socket.constants';
import { WarehouseSubscriptionBook } from './warehouse-subscription.book';

const WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';
const MAP_ID = '22222222-2222-7111-8111-22222222222b';

describe('WarehouseRoomPublisher', () => {
  it('logs and returns when the namespace is not attached', () => {
    const { logger, logs } = createRecordingLogger();
    const publisher = new WarehouseRoomPublisher(logger, new WarehouseSubscriptionBook());

    publisher.publish(WAREHOUSE_ID, 'warehouse.map.changed', {
      warehouseId: WAREHOUSE_ID,
      mapId: MAP_ID,
      version: 2,
      operation: { type: 'addObstacle', position: { x: 1, y: 1 } },
    });
    expect(logs).toEqual([
      {
        level: 'error',
        event: 'warehouse.realtime.not_ready',
        context: { event: 'warehouse.map.changed', warehouseId: WAREHOUSE_ID },
      },
    ]);
  });

  it('passes the original payload to Socket.IO without reading its fields', () => {
    const { logger, logs } = createRecordingLogger();
    const publisher = new WarehouseRoomPublisher(logger, new WarehouseSubscriptionBook());
    const payload = {
      get mapId(): string {
        throw new Error('unexpected payload access');
      },
    };
    const emit = vi.fn<(event: string, payload: unknown) => void>();
    publisher.attach({ to: () => ({ emit }) } as unknown as Namespace);

    publisher.publish(WAREHOUSE_ID, 'warehouse.map.changed', payload);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0]?.[1]).toBe(payload);
    expect(logs).toEqual([]);
  });

  it.each([WAREHOUSE_ID, WAREHOUSE_ID.toUpperCase()])(
    'closes the subscribed room after a failed deletion emit for %s',
    async (warehouseId) => {
      const book = new WarehouseSubscriptionBook();
      const { logger, logs } = createRecordingLogger();
      const publisher = new WarehouseRoomPublisher(logger, book);
      const room = warehouseRoom(WAREHOUSE_ID);
      const rooms = new Set<string>();
      await book.subscribe(
        'socket-1',
        WAREHOUSE_ID,
        async () => ({ ok: true }),
        async () => {
          rooms.add(room);
        },
        async () => {
          rooms.delete(room);
        },
        () => true,
      );
      expect(book.joinedCount('socket-1')).toBe(1);
      const emit = vi.fn(() => {
        throw new Error('socket down');
      });
      const to = vi.fn(() => ({ emit }));
      const socketsLeave = vi.fn((target: string) => rooms.delete(target));
      const inRoom = vi.fn(() => ({ socketsLeave }));
      publisher.attach({ to, in: inRoom } as unknown as Namespace);

      const event = 'warehouse.deleted';
      const payload = { warehouseId };
      publisher.publish(warehouseId, event, payload);
      publisher.closeRoom(warehouseId);

      expect(to.mock.calls).toEqual([[room]]);
      expect(emit.mock.calls).toEqual([[event, payload]]);
      expect(logs).toEqual([
        {
          level: 'error',
          event: 'warehouse.realtime.publish_failed',
          context: { event, warehouseId: WAREHOUSE_ID },
        },
      ]);
      expect(inRoom.mock.calls).toEqual([[room]]);
      expect(socketsLeave.mock.calls).toEqual([[room]]);
      expect(emit).toHaveBeenCalledBefore(socketsLeave);
      expect(rooms.has(room)).toBe(false);
      expect(book.joinedCount('socket-1')).toBe(0);
    },
  );

  it('drops room membership when the room closes', async () => {
    const book = new WarehouseSubscriptionBook();
    const { logger } = createRecordingLogger();
    const publisher = new WarehouseRoomPublisher(logger, book);
    await book.subscribe(
      'socket-1',
      WAREHOUSE_ID,
      async () => ({ ok: true }),
      async () => undefined,
      async () => undefined,
      () => true,
    );
    const left: string[] = [];
    publisher.attach({
      name: '/warehouse',
      to() {
        return { emit() {} };
      },
      in(room: string) {
        return {
          socketsLeave(target: string) {
            left.push(`${room}:${target}`);
          },
        };
      },
    } as unknown as Namespace);

    publisher.closeRoom(WAREHOUSE_ID);

    expect(left).toEqual([`${warehouseRoom(WAREHOUSE_ID)}:${warehouseRoom(WAREHOUSE_ID)}`]);
    expect(book.joinedCount('socket-1')).toBe(0);
  });

  it('keeps a later unsubscribe able to leave when socketsLeave throws', async () => {
    const book = new WarehouseSubscriptionBook();
    const { logger, logs } = createRecordingLogger();
    const publisher = new WarehouseRoomPublisher(logger, book);
    const left: string[] = [];
    publisher.attach({
      name: '/warehouse',
      to() {
        return { emit() {} };
      },
      in() {
        return {
          socketsLeave() {
            throw new Error('redis://secret');
          },
        };
      },
    } as unknown as Namespace);
    await book.subscribe(
      'socket-1',
      WAREHOUSE_ID,
      async () => ({ ok: true }),
      async () => undefined,
      async () => {
        left.push('subscribe-leave');
      },
      () => true,
    );

    publisher.closeRoom(WAREHOUSE_ID);
    expect(book.joinedCount('socket-1')).toBe(1);
    expect(logs.map((entry) => entry.event)).toContain('warehouse.realtime.leave_failed');
    expect(JSON.stringify(logs)).not.toContain('redis://secret');

    await book.unsubscribe(
      'socket-1',
      WAREHOUSE_ID,
      async () => {
        left.push('unsubscribe');
      },
      () => true,
    );

    expect(left).toEqual(['unsubscribe']);
    expect(book.joinedCount('socket-1')).toBe(0);
  });

  it('stops publishing after detach', () => {
    const { logger, logs } = createRecordingLogger();
    const publisher = new WarehouseRoomPublisher(logger, new WarehouseSubscriptionBook());
    publisher.attach({ name: '/warehouse' } as Namespace);
    publisher.detach();

    publisher.publish(WAREHOUSE_ID, 'warehouse.updated', { warehouseId: WAREHOUSE_ID });

    expect(logs[0]?.event).toBe('warehouse.realtime.not_ready');
  });
});
