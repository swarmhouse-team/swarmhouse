import { WAREHOUSE_SOCKET_MAX_SUBSCRIPTIONS } from '@robots/shared';
import { describe, expect, it } from 'vitest';
import type { Socket } from 'socket.io';

import { EditWarehouseMap } from '../../application/commands/edit-warehouse-map/edit-warehouse-map.use-case';
import type { EditWarehouseMapInput } from '../../application/commands/edit-warehouse-map/edit-warehouse-map.types';
import { MapVersionConflictError } from '../../application/errors/application.errors';
import { createRecordingLogger } from '../../../../common/testing/create-recording-logger';
import { WarehouseMap } from '../../domain/entities/warehouse-map';
import { SocketIoWarehouseNotifier } from '../../infrastructure/realtime/socket-io-warehouse-notifier';
import type { WarehouseExistenceReader } from '../../infrastructure/realtime/warehouse-existence';
import { warehouseRoom } from '../../infrastructure/realtime/warehouse-socket.constants';
import { WarehouseSubscriptionBook } from '../../infrastructure/realtime/warehouse-subscription.book';
import { WarehouseGateway } from './warehouse.gateway';

const WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';
const MAP_ID = '22222222-2222-7111-8111-22222222222b';

function socket(id = 'socket-1'): Socket & { rooms: Set<string> } {
  const rooms = new Set<string>();
  return {
    id,
    connected: true,
    rooms,
    async join(room: string) {
      rooms.add(room);
    },
    async leave(room: string) {
      rooms.delete(room);
    },
  } as unknown as Socket & { rooms: Set<string> };
}

function setup(options?: { limit?: number }) {
  const book = new WarehouseSubscriptionBook(options?.limit);
  const { logger, logs } = createRecordingLogger();
  const finds: string[] = [];
  let findImpl: WarehouseExistenceReader['findById'] = async (id) => ({ id });
  const reader: WarehouseExistenceReader = {
    findById: (id) => {
      finds.push(id);
      return findImpl(id);
    },
  };
  const executions: EditWarehouseMapInput[] = [];
  const edit = {
    async execute(input: EditWarehouseMapInput) {
      executions.push(input);
      const map = WarehouseMap.create(input.mapId, WAREHOUSE_ID);
      return {
        mapId: input.mapId,
        version: input.expectedVersion + 1,
        changed: true,
        snapshot: map.snapshot(),
      };
    },
  };
  const notifier = new SocketIoWarehouseNotifier(logger, book);
  const gateway = new WarehouseGateway(
    reader,
    edit as unknown as EditWarehouseMap,
    notifier,
    book,
    logger,
  );
  return {
    gateway,
    book,
    logs,
    finds,
    executions,
    notifier,
    setFind(next: WarehouseExistenceReader['findById']) {
      findImpl = next;
    },
  };
}

describe('WarehouseGateway subscriptions', () => {
  it('does not join when the payload or the warehouse is invalid', async () => {
    const { gateway, finds } = setup();
    const client = socket();

    const invalid = await gateway.subscribe(client, { warehouseId: 'nope' });
    const joined = await gateway.subscribe(client, { warehouseId: WAREHOUSE_ID });
    const isolated = setup();
    isolated.setFind(async () => null);
    const notFound = await isolated.gateway.subscribe(socket('socket-2'), {
      warehouseId: WAREHOUSE_ID,
    });

    expect(invalid).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    expect(joined.ok).toBe(true);
    expect(client.rooms.has(warehouseRoom(WAREHOUSE_ID))).toBe(true);
    expect(finds).toEqual([WAREHOUSE_ID]);
    expect(notFound).toEqual({
      ok: false,
      error: { code: 'WAREHOUSE_NOT_FOUND', message: 'Warehouse was not found' },
    });
    expect(client.rooms.size).toBe(1);
  });

  it('joins once for a repeated subscribe and leaves on unsubscribe', async () => {
    const { gateway, finds } = setup();
    const client = socket();

    expect(await gateway.subscribe(client, { warehouseId: WAREHOUSE_ID.toUpperCase() })).toEqual({
      ok: true,
    });
    expect(await gateway.subscribe(client, { warehouseId: WAREHOUSE_ID })).toEqual({ ok: true });
    expect(finds).toEqual([WAREHOUSE_ID]);
    expect(client.rooms).toEqual(new Set([warehouseRoom(WAREHOUSE_ID)]));

    expect(await gateway.unsubscribe(client, { warehouseId: WAREHOUSE_ID })).toEqual({ ok: true });
    expect(await gateway.unsubscribe(client, { warehouseId: WAREHOUSE_ID })).toEqual({ ok: true });
    expect(client.rooms.size).toBe(0);
  });

  it('counts pending subscriptions toward the limit and shares one check', async () => {
    const client = socket();
    let release: ((value: { id: string } | null) => void) | undefined;
    const gate = new Promise<{ id: string } | null>((resolve) => {
      release = resolve;
    });
    const harness = setup({ limit: 1 });
    harness.setFind(() => gate);

    const first = harness.gateway.subscribe(client, { warehouseId: WAREHOUSE_ID });
    const repeat = harness.gateway.subscribe(client, { warehouseId: WAREHOUSE_ID });
    const second = await harness.gateway.subscribe(client, {
      warehouseId: '33333333-3333-4111-8111-33333333333c',
    });

    expect(second).toMatchObject({ ok: false, error: { code: 'TOO_MANY_REQUESTS' } });
    expect(harness.finds).toEqual([WAREHOUSE_ID]);
    release?.({ id: WAREHOUSE_ID });
    expect(await first).toEqual({ ok: true });
    expect(await repeat).toEqual({ ok: true });
    expect(harness.finds).toEqual([WAREHOUSE_ID]);
  });

  it('does not join after disconnect while the warehouse check is in flight', async () => {
    const harness = setup();
    const client = socket();
    let release: ((value: { id: string } | null) => void) | undefined;
    let started: (() => void) | undefined;
    const lookupStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    harness.setFind(
      () =>
        new Promise((resolve) => {
          started?.();
          release = resolve;
        }),
    );

    const pending = harness.gateway.subscribe(client, { warehouseId: WAREHOUSE_ID });
    await lookupStarted;
    client.connected = false;
    harness.gateway.handleDisconnect(client);
    release?.({ id: WAREHOUSE_ID });

    const firstAck = await pending;
    expect(firstAck).toMatchObject({ ok: false, error: { code: 'BAD_REQUEST' } });
    expect(client.rooms.size).toBe(0);
    expect(harness.book.joinedCount(client.id)).toBe(0);

    client.connected = true;
    harness.setFind(async (id) => ({ id }));
    const secondAck = await harness.gateway.subscribe(client, { warehouseId: WAREHOUSE_ID });
    expect(secondAck).toEqual({ ok: true });
    expect(harness.finds).toEqual([WAREHOUSE_ID, WAREHOUSE_ID]);
    expect(client.rooms.size).toBe(1);
  });

  it('fills the default limit with pending checks', async () => {
    const harness = setup();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    harness.setFind(async (id) => {
      await gate;
      return { id };
    });
    const client = socket();
    const pending = Array.from({ length: WAREHOUSE_SOCKET_MAX_SUBSCRIPTIONS }, (_, index) => {
      const warehouseId = `00000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, '0')}`;
      return harness.gateway.subscribe(client, { warehouseId });
    });
    const extra = await harness.gateway.subscribe(client, { warehouseId: WAREHOUSE_ID });

    expect(extra).toMatchObject({ ok: false, error: { code: 'TOO_MANY_REQUESTS' } });
    expect(harness.finds).toHaveLength(WAREHOUSE_SOCKET_MAX_SUBSCRIPTIONS);
    release?.();
    await Promise.all(pending);
  });

  it('rejects an oversized payload before a lookup', async () => {
    const harness = setup();
    const ack = await harness.gateway.subscribe(socket(), {
      warehouseId: WAREHOUSE_ID,
      padding: 'x'.repeat(20_000),
    });

    expect(ack).toEqual({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'Payload is too large' },
    });
    expect(harness.finds).toEqual([]);
  });
});

describe('WarehouseGateway map edit', () => {
  it('calls EditWarehouseMap once and does not emit a second event', async () => {
    const harness = setup();
    const ack = await harness.gateway.edit({
      mapId: MAP_ID.toUpperCase(),
      expectedVersion: 4,
      operation: { type: 'addObstacle', position: { x: 1, y: 1 } },
    });

    expect(harness.executions).toEqual([
      {
        mapId: MAP_ID,
        expectedVersion: 4,
        operation: { type: 'addObstacle', position: { x: 1, y: 1 } },
      },
    ]);
    expect(ack).toMatchObject({
      ok: true,
      data: { changed: true, map: { version: 5, mapId: MAP_ID } },
    });
    expect(harness.logs.some((entry) => entry.event === 'warehouse.realtime.publish_failed')).toBe(
      false,
    );
    expect(harness.logs).toEqual([]);
  });

  it('does not call the use case for an invalid operation', async () => {
    const harness = setup();
    const ack = await harness.gateway.edit({ mapId: MAP_ID, expectedVersion: 0, operation: {} });

    expect(ack).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    expect(harness.executions).toEqual([]);
  });

  it('returns a version conflict without the stored versions', async () => {
    const harness = setup();
    const edit = harness.executions;
    const gateway = new WarehouseGateway(
      { findById: async () => null },
      {
        async execute() {
          edit.push({} as EditWarehouseMapInput);
          throw new MapVersionConflictError({
            mapId: MAP_ID,
            expectedVersion: 1,
            actualVersion: 8,
          });
        },
      } as unknown as EditWarehouseMap,
      harness.notifier,
      new WarehouseSubscriptionBook(),
      createRecordingLogger().logger,
    );

    const ack = await gateway.edit({
      mapId: MAP_ID,
      expectedVersion: 1,
      operation: { type: 'addObstacle', position: { x: 1, y: 1 } },
    });

    expect(ack).toEqual({
      ok: false,
      error: {
        code: 'MAP_VERSION_CONFLICT',
        message: 'The map version is stale. Read the map again and repeat the command.',
      },
    });
    expect(JSON.stringify(ack)).not.toContain('actualVersion');
    expect(JSON.stringify(ack)).not.toContain('expectedVersion');
  });
});
