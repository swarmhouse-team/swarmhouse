import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  SOCKET_ENGINE_PATH,
  WAREHOUSE_REALTIME_EVENTS,
  type WarehouseMapChangedEvent,
} from '@robots/shared';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EditWarehouseMap } from '../../application/commands/edit-warehouse-map/edit-warehouse-map.use-case';
import type {
  EditWarehouseMapInput,
  EditWarehouseMapResult,
} from '../../application/commands/edit-warehouse-map/edit-warehouse-map.types';
import { MapVersionConflictError } from '../../application/errors/application.errors';
import { createRecordingLogger } from '../../application/testing/create-recording-logger';
import { WarehouseMap } from '../../domain/entities/warehouse-map';
import { SocketIoWarehouseNotifier } from '../../infrastructure/realtime/socket-io-warehouse-notifier';
import { WAREHOUSE_EXISTENCE } from '../../infrastructure/realtime/warehouse-existence';
import { AppSocketIoAdapter } from '../../../../common/socket/app-socket-io.adapter';
import { WarehouseSubscriptionBook } from '../../infrastructure/realtime/warehouse-subscription.book';
import { NestjsWarehouseLogger } from '../../infrastructure/system/nestjs-warehouse-logger';
import { WarehouseGateway } from './warehouse.gateway';

const ALLOWED = 'http://allowed.example';
const WAREHOUSE_A = '11111111-1111-4111-8111-11111111111a';
const WAREHOUSE_B = '55555555-5555-4111-8111-55555555555b';
const MAP_ID = '22222222-2222-7111-8111-22222222222b';

describe('warehouse socket transport', () => {
  let app: INestApplication;
  let port: number;
  let executions: EditWarehouseMapInput[];
  let finds: string[];
  let notifier: SocketIoWarehouseNotifier;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    executions = [];
    finds = [];
    const book = new WarehouseSubscriptionBook();
    const { logger } = createRecordingLogger();
    notifier = new SocketIoWarehouseNotifier(logger, book);
    const known = new Set([WAREHOUSE_A, WAREHOUSE_B]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: WarehouseSubscriptionBook, useValue: book },
        { provide: SocketIoWarehouseNotifier, useValue: notifier },
        { provide: NestjsWarehouseLogger, useValue: logger },
        {
          provide: WAREHOUSE_EXISTENCE,
          useValue: {
            async findById(id: string) {
              finds.push(id);
              return known.has(id) ? { id } : null;
            },
          },
        },
        {
          provide: EditWarehouseMap,
          useValue: {
            async execute(input: EditWarehouseMapInput): Promise<EditWarehouseMapResult> {
              executions.push(input);
              if (input.expectedVersion === 409) {
                throw new MapVersionConflictError({
                  mapId: input.mapId,
                  expectedVersion: 409,
                  actualVersion: 7,
                });
              }
              const map = WarehouseMap.create(input.mapId, WAREHOUSE_A);
              const version = input.expectedVersion + 1;
              await notifier.mapChanged({
                warehouseId: WAREHOUSE_A,
                mapId: input.mapId,
                version,
                operation: input.operation,
              });
              return { mapId: input.mapId, version, changed: true, snapshot: map.snapshot() };
            },
          },
        },
        WarehouseGateway,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new AppSocketIoAdapter(app, [ALLOWED]));
    await app.listen(0);
    const address = app.getHttpServer().address();
    if (address === null || typeof address === 'string') {
      throw new Error('The test server did not bind a port');
    }
    port = address.port;
  });

  afterAll(async () => {
    for (const socket of sockets) {
      socket.close();
    }
    await app.close();
  });

  function connect(
    origin: string | undefined,
    transport: 'polling' | 'websocket',
  ): Promise<Socket> {
    const socket = io(`http://127.0.0.1:${port}/warehouse`, {
      path: SOCKET_ENGINE_PATH,
      transports: [transport],
      upgrade: false,
      reconnection: false,
      timeout: 2000,
      extraHeaders: origin === undefined ? undefined : { Origin: origin },
    });
    sockets.push(socket);
    return new Promise((resolve, reject) => {
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', (error: Error) => {
        socket.close();
        reject(error);
      });
    });
  }

  it('allows the configured origin on polling and websocket', async () => {
    const polling = await connect(ALLOWED, 'polling');
    const websocket = await connect(ALLOWED, 'websocket');
    expect(polling.connected).toBe(true);
    expect(websocket.connected).toBe(true);
  });

  it('rejects another origin and a missing origin on polling and websocket', async () => {
    await expect(connect('http://denied.example', 'polling')).rejects.toBeInstanceOf(Error);
    await expect(connect(undefined, 'polling')).rejects.toBeInstanceOf(Error);
    await expect(connect('http://denied.example', 'websocket')).rejects.toBeInstanceOf(Error);
    await expect(connect(undefined, 'websocket')).rejects.toBeInstanceOf(Error);
  });

  it('delivers one map change to the room and keeps other rooms quiet', async () => {
    const first = await connect(ALLOWED, 'websocket');
    const second = await connect(ALLOWED, 'websocket');
    const other = await connect(ALLOWED, 'websocket');
    expect(
      await first.emitWithAck(WAREHOUSE_REALTIME_EVENTS.subscribe, { warehouseId: WAREHOUSE_A }),
    ).toEqual({ ok: true });
    expect(
      await second.emitWithAck(WAREHOUSE_REALTIME_EVENTS.subscribe, { warehouseId: WAREHOUSE_A }),
    ).toEqual({ ok: true });
    expect(
      await other.emitWithAck(WAREHOUSE_REALTIME_EVENTS.subscribe, { warehouseId: WAREHOUSE_B }),
    ).toEqual({ ok: true });
    const findsBeforeRepeat = finds.length;
    expect(
      await first.emitWithAck(WAREHOUSE_REALTIME_EVENTS.subscribe, { warehouseId: WAREHOUSE_A }),
    ).toEqual({ ok: true });
    expect(finds.length).toBe(findsBeforeRepeat);

    const seenByFirst = waitFor<WarehouseMapChangedEvent>(
      first,
      WAREHOUSE_REALTIME_EVENTS.mapChanged,
    );
    const seenBySecond = waitFor<WarehouseMapChangedEvent>(
      second,
      WAREHOUSE_REALTIME_EVENTS.mapChanged,
    );
    const seenByOther = waitFor<WarehouseMapChangedEvent>(
      other,
      WAREHOUSE_REALTIME_EVENTS.mapChanged,
    );
    const executionsBefore = executions.length;
    const operation = { type: 'moveObstacle' as const, from: { x: 1, y: 1 }, to: { x: 2, y: 3 } };
    const ack = await first.emitWithAck(WAREHOUSE_REALTIME_EVENTS.mapEdit, {
      mapId: MAP_ID,
      expectedVersion: 1,
      operation,
    });

    expect(executions.length).toBe(executionsBefore + 1);
    expect(ack).toMatchObject({
      ok: true,
      data: { changed: true, map: { mapId: MAP_ID, version: 2, warehouseId: WAREHOUSE_A } },
    });
    await expect(seenByFirst).resolves.toEqual({
      warehouseId: WAREHOUSE_A,
      mapId: MAP_ID,
      version: 2,
      operation,
    });
    await expect(seenBySecond).resolves.toEqual({
      warehouseId: WAREHOUSE_A,
      mapId: MAP_ID,
      version: 2,
      operation,
    });
    await expect(seenByOther).rejects.toThrow('timed out');
  });

  it('acks a conflict without versions and ignores an invalid edit', async () => {
    const client = await connect(ALLOWED, 'polling');
    const before = executions.length;
    const invalid = await client.emitWithAck(WAREHOUSE_REALTIME_EVENTS.mapEdit, {
      mapId: 'not-a-uuid',
      expectedVersion: 0,
      operation: { type: 'addObstacle', position: { x: 0, y: 0 } },
    });
    const conflict = await client.emitWithAck(WAREHOUSE_REALTIME_EVENTS.mapEdit, {
      mapId: MAP_ID,
      expectedVersion: 409,
      operation: { type: 'addObstacle', position: { x: 0, y: 0 } },
    });

    expect(invalid).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    expect(executions.length).toBe(before + 1);
    expect(conflict).toEqual({
      ok: false,
      error: {
        code: 'MAP_VERSION_CONFLICT',
        message: 'The map version is stale. Read the map again and repeat the command.',
      },
    });
    expect(JSON.stringify(conflict)).not.toContain('409');
    expect(JSON.stringify(conflict)).not.toContain('actualVersion');
  });

  it('removes subscribers from the room after warehouse.deleted', async () => {
    const client = await connect(ALLOWED, 'websocket');
    expect(
      await client.emitWithAck(WAREHOUSE_REALTIME_EVENTS.subscribe, { warehouseId: WAREHOUSE_A }),
    ).toEqual({ ok: true });
    const deleted = waitFor(client, WAREHOUSE_REALTIME_EVENTS.deleted);
    await notifier.warehouseDeleted({ warehouseId: WAREHOUSE_A });
    await expect(deleted).resolves.toEqual({ warehouseId: WAREHOUSE_A });

    const late = waitFor(client, WAREHOUSE_REALTIME_EVENTS.mapChanged);
    await notifier.mapChanged({
      warehouseId: WAREHOUSE_A,
      mapId: MAP_ID,
      version: 9,
      operation: { type: 'addObstacle', position: { x: 0, y: 0 } },
    });
    await expect(late).rejects.toThrow('timed out');
  });
});

function waitFor<T>(socket: Socket, event: string, timeoutMs = 300): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error('timed out'));
    }, timeoutMs);
    const onEvent = (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    };
    socket.once(event, onEvent);
  });
}
