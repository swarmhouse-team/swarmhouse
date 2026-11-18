import { describe, expect, it } from 'vitest';
import type { Namespace } from 'socket.io';

import { createRecordingLogger } from '../../../../common/testing/create-recording-logger';
import { SocketIoWarehouseNotifier } from './socket-io-warehouse-notifier';
import { warehouseRoom } from './warehouse-socket.constants';
import { WarehouseSubscriptionBook } from './warehouse-subscription.book';

const WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';
const MAP_ID = '22222222-2222-7111-8111-22222222222b';

describe('SocketIoWarehouseNotifier', () => {
  it('logs and returns when the namespace is not attached', async () => {
    const { logger, logs } = createRecordingLogger();
    const notifier = new SocketIoWarehouseNotifier(logger, new WarehouseSubscriptionBook());

    await expect(
      notifier.mapChanged({
        warehouseId: WAREHOUSE_ID,
        mapId: MAP_ID,
        version: 2,
        operation: { type: 'addObstacle', position: { x: 1, y: 1 } },
      }),
    ).resolves.toBeUndefined();
    expect(logs).toEqual([
      {
        level: 'error',
        event: 'warehouse.realtime.not_ready',
        context: { event: 'warehouse.map.changed', warehouseId: WAREHOUSE_ID, mapId: MAP_ID },
      },
    ]);
  });

  it('emits to the room and keeps the command result when emit throws', async () => {
    const { logger, logs } = createRecordingLogger();
    const notifier = new SocketIoWarehouseNotifier(logger, new WarehouseSubscriptionBook());
    const emits: { room: string; event: string; payload: unknown }[] = [];
    notifier.attach({
      name: '/warehouse',
      to(room: string) {
        return {
          emit(event: string, payload: unknown) {
            emits.push({ room, event, payload });
            throw new Error('socket down');
          },
        };
      },
      in() {
        return { socketsLeave() {} };
      },
    } as unknown as Namespace);

    await expect(notifier.warehouseUpdated({ warehouseId: WAREHOUSE_ID })).resolves.toBeUndefined();
    expect(emits).toEqual([
      {
        room: warehouseRoom(WAREHOUSE_ID),
        event: 'warehouse.updated',
        payload: { warehouseId: WAREHOUSE_ID },
      },
    ]);
    expect(logs).toEqual([
      {
        level: 'error',
        event: 'warehouse.realtime.publish_failed',
        context: { event: 'warehouse.updated', warehouseId: WAREHOUSE_ID },
      },
    ]);
    expect(JSON.stringify(logs)).not.toContain('socket down');
  });

  it('drops room membership after warehouse.deleted', async () => {
    const book = new WarehouseSubscriptionBook();
    const { logger } = createRecordingLogger();
    const notifier = new SocketIoWarehouseNotifier(logger, book);
    await book.subscribe(
      'socket-1',
      WAREHOUSE_ID,
      async () => ({ ok: true }),
      async () => undefined,
      async () => undefined,
      () => true,
    );
    const left: string[] = [];
    notifier.attach({
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

    await notifier.warehouseDeleted({ warehouseId: WAREHOUSE_ID });

    expect(left).toEqual([`${warehouseRoom(WAREHOUSE_ID)}:${warehouseRoom(WAREHOUSE_ID)}`]);
    expect(book.joinedCount('socket-1')).toBe(0);
  });

  it('still leaves the room when emit throws and then drops later events', async () => {
    const book = new WarehouseSubscriptionBook();
    const { logger, logs } = createRecordingLogger();
    const notifier = new SocketIoWarehouseNotifier(logger, book);
    const room = warehouseRoom(WAREHOUSE_ID);
    const members = new Set<string>([room]);
    const delivered: string[] = [];
    const left: string[] = [];
    notifier.attach({
      name: '/warehouse',
      to(target: string) {
        return {
          emit(event: string) {
            if (members.has(target)) {
              delivered.push(event);
            }
            if (event === 'warehouse.deleted') {
              throw new Error('redis://secret');
            }
          },
        };
      },
      in(target: string) {
        return {
          socketsLeave(next: string) {
            left.push(`${target}:${next}`);
            members.delete(next);
          },
        };
      },
    } as unknown as Namespace);
    await book.subscribe(
      'socket-1',
      WAREHOUSE_ID,
      async () => ({ ok: true }),
      async () => undefined,
      async () => undefined,
      () => true,
    );

    await expect(notifier.warehouseDeleted({ warehouseId: WAREHOUSE_ID })).resolves.toBeUndefined();
    await notifier.mapChanged({
      warehouseId: WAREHOUSE_ID,
      mapId: MAP_ID,
      version: 2,
      operation: { type: 'addObstacle', position: { x: 1, y: 1 } },
    });

    expect(left).toEqual([`${room}:${room}`]);
    expect(delivered).toEqual(['warehouse.deleted']);
    expect(book.joinedCount('socket-1')).toBe(0);
    expect(JSON.stringify(logs)).not.toContain('redis://secret');
    expect(logs.some((entry) => entry.event === 'warehouse.realtime.publish_failed')).toBe(true);
  });

  it('keeps a later unsubscribe able to leave when socketsLeave throws', async () => {
    const book = new WarehouseSubscriptionBook();
    const { logger, logs } = createRecordingLogger();
    const notifier = new SocketIoWarehouseNotifier(logger, book);
    const left: string[] = [];
    notifier.attach({
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

    await expect(notifier.warehouseDeleted({ warehouseId: WAREHOUSE_ID })).resolves.toBeUndefined();
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

  it('stops publishing after detach', async () => {
    const { logger, logs } = createRecordingLogger();
    const notifier = new SocketIoWarehouseNotifier(logger, new WarehouseSubscriptionBook());
    notifier.attach({ name: '/warehouse' } as Namespace);
    notifier.detach();

    await notifier.warehouseUpdated({ warehouseId: WAREHOUSE_ID });

    expect(logs[0]?.event).toBe('warehouse.realtime.not_ready');
  });
});
