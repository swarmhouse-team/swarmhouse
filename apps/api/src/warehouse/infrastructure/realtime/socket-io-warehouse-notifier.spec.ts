import { describe, expect, it } from 'vitest';
import type { Namespace } from 'socket.io';

import { createRecordingLogger } from '../../application/testing/create-recording-logger';
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

  it('stops publishing after detach', async () => {
    const { logger, logs } = createRecordingLogger();
    const notifier = new SocketIoWarehouseNotifier(logger, new WarehouseSubscriptionBook());
    notifier.attach({ name: '/warehouse' } as Namespace);
    notifier.detach();

    await notifier.warehouseUpdated({ warehouseId: WAREHOUSE_ID });

    expect(logs[0]?.event).toBe('warehouse.realtime.not_ready');
  });
});
