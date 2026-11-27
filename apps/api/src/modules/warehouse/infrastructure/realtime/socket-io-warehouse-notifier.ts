import { Injectable } from '@nestjs/common';
import { WAREHOUSE_REALTIME_EVENTS } from '@robots/shared';

import { WarehouseRoomPublisher } from '../../../warehouse-realtime/warehouse-room.publisher';
import type {
  WarehouseDeletedNotice,
  WarehouseMapChangedNotice,
  WarehouseNotifier,
  WarehouseUpdatedNotice,
} from '../../application/ports/system/warehouse-notifier';

@Injectable()
export class SocketIoWarehouseNotifier implements WarehouseNotifier {
  constructor(private readonly publisher: WarehouseRoomPublisher) {}

  async mapChanged(notice: WarehouseMapChangedNotice): Promise<void> {
    this.publisher.publish(notice.warehouseId, WAREHOUSE_REALTIME_EVENTS.mapChanged, notice);
  }

  async warehouseUpdated(notice: WarehouseUpdatedNotice): Promise<void> {
    this.publisher.publish(notice.warehouseId, WAREHOUSE_REALTIME_EVENTS.updated, notice);
  }

  async warehouseDeleted(notice: WarehouseDeletedNotice): Promise<void> {
    this.publisher.publish(notice.warehouseId, WAREHOUSE_REALTIME_EVENTS.deleted, notice);
    this.publisher.closeRoom(notice.warehouseId);
  }
}
