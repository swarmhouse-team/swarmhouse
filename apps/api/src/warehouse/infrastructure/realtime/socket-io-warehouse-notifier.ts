import { Inject, Injectable } from '@nestjs/common';
import type { Namespace, Server } from 'socket.io';

import type { LoggerPort } from '../../application/ports/system/logger.port';
import type {
  WarehouseDeletedNotice,
  WarehouseMapChangedNotice,
  WarehouseNotifier,
  WarehouseUpdatedNotice,
} from '../../application/ports/system/warehouse-notifier';
import { NestjsWarehouseLogger } from '../system/nestjs-warehouse-logger';
import { WAREHOUSE_SOCKET_NAMESPACE, warehouseRoom } from './warehouse-socket.constants';
import { WarehouseSubscriptionBook } from './warehouse-subscription.book';

/**
 * Delivers warehouse events on the `/warehouse` namespace.
 * The gateway attaches that namespace once. This class does not depend on the gateway.
 * Before attach and after detach, a publish logs and returns. Emit errors are logged once.
 */
@Injectable()
export class SocketIoWarehouseNotifier implements WarehouseNotifier {
  private namespace: Namespace | undefined;

  constructor(
    @Inject(NestjsWarehouseLogger) private readonly logger: LoggerPort,
    private readonly subscriptions: WarehouseSubscriptionBook,
  ) {}

  attach(server: Server | Namespace): void {
    this.namespace = warehouseNamespace(server);
  }

  detach(): void {
    this.namespace = undefined;
  }

  async mapChanged(notice: WarehouseMapChangedNotice): Promise<void> {
    await this.emit('warehouse.map.changed', notice, {
      event: 'warehouse.map.changed',
      warehouseId: notice.warehouseId,
      mapId: notice.mapId,
    });
  }

  async warehouseUpdated(notice: WarehouseUpdatedNotice): Promise<void> {
    await this.emit('warehouse.updated', notice, {
      event: 'warehouse.updated',
      warehouseId: notice.warehouseId,
    });
  }

  async warehouseDeleted(notice: WarehouseDeletedNotice): Promise<void> {
    await this.emit(
      'warehouse.deleted',
      notice,
      { event: 'warehouse.deleted', warehouseId: notice.warehouseId },
      true,
    );
    this.subscriptions.forgetWarehouse(notice.warehouseId);
  }

  private async emit(
    event: string,
    payload: object,
    context: { event: string; warehouseId: string; mapId?: string },
    leaveRoom = false,
  ): Promise<void> {
    const namespace = this.namespace;
    if (!namespace) {
      this.logger.error('warehouse.realtime.not_ready', context);
      return;
    }

    const room = warehouseRoom(context.warehouseId);
    try {
      namespace.to(room).emit(event, payload);
      if (leaveRoom) {
        namespace.in(room).socketsLeave(room);
      }
    } catch {
      this.logger.error('warehouse.realtime.publish_failed', context);
    }
  }
}

function warehouseNamespace(server: Server | Namespace): Namespace {
  const candidate = server as Server & { name?: string };
  if (typeof candidate.of === 'function' && candidate.name !== WAREHOUSE_SOCKET_NAMESPACE) {
    return candidate.of(WAREHOUSE_SOCKET_NAMESPACE);
  }
  return server as Namespace;
}
