import { Inject, Injectable } from '@nestjs/common';
import { WAREHOUSE_SOCKET_NAMESPACE } from '@robots/shared';
import type { Namespace, Server } from 'socket.io';

import type { LoggerPort } from '../../common/application/logger.port';
import { NestjsLogger } from '../../common/infrastructure/nestjs-logger';
import { warehouseRoom } from './warehouse-socket.constants';
import { WarehouseSubscriptionBook } from './warehouse-subscription.book';

@Injectable()
export class WarehouseRoomPublisher {
  private namespace: Namespace | undefined;

  constructor(
    @Inject(NestjsLogger) private readonly logger: LoggerPort,
    private readonly subscriptions: WarehouseSubscriptionBook,
  ) {}

  attach(server: Server | Namespace): void {
    this.namespace = warehouseNamespace(server);
  }

  detach(): void {
    this.namespace = undefined;
  }

  publish(warehouseIdInput: string, event: string, payload: unknown): void {
    const warehouseId = warehouseIdInput.toLowerCase();
    const context = { event, warehouseId };
    if (!this.namespace) {
      this.logger.error('warehouse.realtime.not_ready', context);
      return;
    }
    try {
      this.namespace.to(warehouseRoom(warehouseId)).emit(event, payload);
    } catch {
      this.logger.error('warehouse.realtime.publish_failed', context);
    }
  }

  closeRoom(warehouseIdInput: string): void {
    const warehouseId = warehouseIdInput.toLowerCase();
    const room = warehouseRoom(warehouseId);
    try {
      this.namespace?.in(room).socketsLeave(room);
    } catch {
      this.logger.error('warehouse.realtime.leave_failed', { warehouseId });
      return;
    }
    this.subscriptions.forgetWarehouse(warehouseId);
  }
}

function warehouseNamespace(server: Server | Namespace): Namespace {
  const candidate = server as Server & { name?: string };
  if (typeof candidate.of === 'function' && candidate.name !== WAREHOUSE_SOCKET_NAMESPACE) {
    return candidate.of(WAREHOUSE_SOCKET_NAMESPACE);
  }
  return server as Namespace;
}
