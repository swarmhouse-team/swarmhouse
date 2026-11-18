import { Inject, Injectable } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import {
  API_ERROR_CODES,
  SOCKET_MAX_HTTP_BUFFER_BYTES,
  WAREHOUSE_HTTP_ERROR_CODES,
  WAREHOUSE_REALTIME_EVENTS,
  WAREHOUSE_SOCKET_NAMESPACE,
  warehouseMapEditPayloadSchema,
  warehouseSubscribePayloadSchema,
  type ApiError,
  type WarehouseAck,
  type WarehouseMapEditAck,
} from '@robots/shared';
import type { Namespace, Server, Socket } from 'socket.io';
import { ZodError } from 'zod';

import type { LoggerPort } from '../../../../common/application/logger.port';
import { mapThrownError } from '../../../../common/http/map-thrown-error';
import { NestjsLogger } from '../../../../common/infrastructure/nestjs-logger';
import { EditWarehouseMap } from '../../application/commands/edit-warehouse-map/edit-warehouse-map.use-case';
import { WarehouseNotFoundError } from '../../application/errors/application.errors';
import { normalizeId } from '../../domain/vo/id';
import { SocketIoWarehouseNotifier } from '../../infrastructure/realtime/socket-io-warehouse-notifier';
import {
  WAREHOUSE_EXISTENCE,
  type WarehouseExistenceReader,
} from '../../infrastructure/realtime/warehouse-existence';
import {
  warehousePayloadBytes,
  warehouseRoom,
} from '../../infrastructure/realtime/warehouse-socket.constants';
import { WarehouseSubscriptionBook } from '../../infrastructure/realtime/warehouse-subscription.book';
import { toEditWarehouseMapAckData } from './edit-warehouse-map-ack';

/**
 * Socket.IO namespace `/warehouse`.
 * Membership is not permission to edit. Publishing stays in the use cases.
 */
@Injectable()
@WebSocketGateway({ namespace: WAREHOUSE_SOCKET_NAMESPACE })
export class WarehouseGateway implements OnGatewayInit, OnGatewayDisconnect {
  constructor(
    @Inject(WAREHOUSE_EXISTENCE) private readonly warehouses: WarehouseExistenceReader,
    private readonly editWarehouseMap: EditWarehouseMap,
    private readonly notifier: SocketIoWarehouseNotifier,
    private readonly subscriptions: WarehouseSubscriptionBook,
    @Inject(NestjsLogger) private readonly logger: LoggerPort,
  ) {}

  afterInit(server: Server | Namespace): void {
    this.notifier.attach(server);
  }

  handleDisconnect(client: Socket): void {
    this.subscriptions.disconnect(client.id);
  }

  onApplicationShutdown(): void {
    this.notifier.detach();
  }

  @SubscribeMessage(WAREHOUSE_REALTIME_EVENTS.subscribe)
  subscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): Promise<WarehouseAck> {
    return this.changeSubscription(client, payload, 'subscribe');
  }

  @SubscribeMessage(WAREHOUSE_REALTIME_EVENTS.unsubscribe)
  unsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): Promise<WarehouseAck> {
    return this.changeSubscription(client, payload, 'unsubscribe');
  }

  @SubscribeMessage(WAREHOUSE_REALTIME_EVENTS.mapEdit)
  async edit(@MessageBody() payload: unknown): Promise<WarehouseMapEditAck> {
    const parsed = this.parse(payload, warehouseMapEditPayloadSchema);
    if (!parsed.ok) {
      return parsed.ack;
    }

    try {
      const mapId = normalizeId(parsed.value.mapId);
      const result = await this.editWarehouseMap.execute({
        mapId,
        expectedVersion: parsed.value.expectedVersion,
        operation: parsed.value.operation,
      });
      return { ok: true, data: toEditWarehouseMapAckData(result) };
    } catch (error) {
      return { ok: false, error: this.commandError(error) };
    }
  }

  private async changeSubscription(
    client: Socket,
    payload: unknown,
    action: 'subscribe' | 'unsubscribe',
  ): Promise<WarehouseAck> {
    const parsed = this.parse(payload, warehouseSubscribePayloadSchema);
    if (!parsed.ok) {
      return parsed.ack;
    }

    let warehouseId: string;
    try {
      warehouseId = normalizeId(parsed.value.warehouseId);
    } catch (error) {
      return { ok: false, error: apiErrorFrom(error) };
    }

    const room = warehouseRoom(warehouseId);
    if (action === 'unsubscribe') {
      return this.subscriptions.unsubscribe(
        client.id,
        warehouseId,
        async () => {
          await client.leave(room);
        },
        () => client.connected,
      );
    }

    return this.subscriptions.subscribe(
      client.id,
      warehouseId,
      async () => {
        try {
          const found = await this.warehouses.findById(warehouseId);
          if (!found) {
            return {
              ok: false,
              error: {
                code: WAREHOUSE_HTTP_ERROR_CODES.WAREHOUSE_NOT_FOUND,
                message: new WarehouseNotFoundError({ warehouseId }).message,
              },
            };
          }
          return { ok: true };
        } catch (error) {
          this.logger.error('warehouse.realtime.subscribe_failed', {
            errorClass: error instanceof Error ? error.name : 'UnknownError',
            warehouseId,
          });
          return {
            ok: false,
            error: { code: API_ERROR_CODES.INTERNAL_ERROR, message: 'Internal server error' },
          };
        }
      },
      async () => {
        await client.join(room);
      },
      async () => {
        await client.leave(room);
      },
      () => client.connected,
    );
  }

  private parse<T>(
    payload: unknown,
    schema: { parse: (value: unknown) => T },
  ): { ok: true; value: T } | { ok: false; ack: { ok: false; error: ApiError } } {
    try {
      if (warehousePayloadBytes(payload) > SOCKET_MAX_HTTP_BUFFER_BYTES) {
        return {
          ok: false,
          ack: {
            ok: false,
            error: { code: API_ERROR_CODES.BAD_REQUEST, message: 'Payload is too large' },
          },
        };
      }
    } catch {
      return {
        ok: false,
        ack: {
          ok: false,
          error: { code: API_ERROR_CODES.BAD_REQUEST, message: 'Payload is too large' },
        },
      };
    }

    try {
      return { ok: true, value: schema.parse(payload) };
    } catch (error) {
      if (error instanceof ZodError) {
        return { ok: false, ack: { ok: false, error: apiErrorFrom(error) } };
      }
      return {
        ok: false,
        ack: {
          ok: false,
          error: { code: API_ERROR_CODES.BAD_REQUEST, message: 'Payload is invalid' },
        },
      };
    }
  }

  private commandError(error: unknown): ApiError {
    const apiError = apiErrorFrom(error);
    if (apiError.code === API_ERROR_CODES.INTERNAL_ERROR) {
      this.logger.error('warehouse.realtime.command_failed', {
        errorClass: error instanceof Error ? error.name : 'UnknownError',
      });
    }
    return apiError;
  }
}

function apiErrorFrom(error: unknown): ApiError {
  return (
    mapThrownError(error)?.body ?? {
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: 'Internal server error',
    }
  );
}
