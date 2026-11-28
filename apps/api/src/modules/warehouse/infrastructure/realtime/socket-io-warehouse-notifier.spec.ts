import { describe, expect, it, vi } from 'vitest';

import { createRecordingLogger } from '../../../../common/testing/create-recording-logger';
import { SocketIoWarehouseNotifier } from './socket-io-warehouse-notifier';
import { WarehouseRoomPublisher } from '../../../warehouse-realtime/warehouse-room.publisher';
import { WarehouseSubscriptionBook } from '../../../warehouse-realtime/warehouse-subscription.book';

const WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';
const MAP_ID = '22222222-2222-7111-8111-22222222222b';

describe('SocketIoWarehouseNotifier', () => {
  it('routes each notice and closes the room only after publishing the deletion', async () => {
    const publisher = new WarehouseRoomPublisher(
      createRecordingLogger().logger,
      new WarehouseSubscriptionBook(),
    );
    const publish = vi.spyOn(publisher, 'publish').mockImplementation(() => {});
    const closeRoom = vi.spyOn(publisher, 'closeRoom').mockImplementation(() => {});
    const notifier = new SocketIoWarehouseNotifier(publisher);
    const warehouse = { warehouseId: WAREHOUSE_ID };
    const change = {
      ...warehouse,
      mapId: MAP_ID,
      version: 2,
      operation: { type: 'addObstacle', position: { x: 1, y: 1 } } as const,
    };

    await notifier.mapChanged(change);
    await notifier.warehouseUpdated(warehouse);
    expect(closeRoom).not.toHaveBeenCalled();
    await notifier.warehouseDeleted(warehouse);

    expect(publish.mock.calls).toEqual([
      [WAREHOUSE_ID, 'warehouse.map.changed', change],
      [WAREHOUSE_ID, 'warehouse.updated', warehouse],
      [WAREHOUSE_ID, 'warehouse.deleted', warehouse],
    ]);
    expect(closeRoom.mock.calls).toEqual([[WAREHOUSE_ID]]);
    expect(publish.mock.invocationCallOrder[2]).toBeLessThan(
      closeRoom.mock.invocationCallOrder[0]!,
    );
  });
});
