import { describe, expect, it } from 'vitest';

import { API_ERROR_CODES } from '@robots/shared';

import { WarehouseSubscriptionBook } from './warehouse-subscription.book';

const SOCKET_ID = 'socket-1';
const WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';
const OTHER_ID = '55555555-5555-4111-8111-55555555555b';

function warehouseId(index: number): string {
  return `00000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, '0')}`;
}

function socketState(
  book: WarehouseSubscriptionBook,
  socketId: string,
): { tails: Map<string, Promise<void>>; pending: Set<string> } | undefined {
  return (
    book as unknown as {
      sockets: Map<string, { tails: Map<string, Promise<void>>; pending: Set<string> }>;
    }
  ).sockets.get(socketId);
}

async function flushTails(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function denied() {
  return {
    ok: false as const,
    error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Warehouse was not found' },
  };
}

describe('WarehouseSubscriptionBook tails', () => {
  it('drops tails after many subscribes to missing warehouses', async () => {
    const book = new WarehouseSubscriptionBook();

    for (let index = 0; index < 30; index += 1) {
      const ack = await book.subscribe(
        SOCKET_ID,
        warehouseId(index),
        async () => denied(),
        async () => undefined,
        async () => undefined,
        () => true,
      );
      expect(ack.ok).toBe(false);
    }
    await flushTails();

    expect(socketState(book, SOCKET_ID)?.tails.size).toBe(0);
  });

  it('drops tails after many unsubscribes of unknown warehouses', async () => {
    const book = new WarehouseSubscriptionBook();
    const left: string[] = [];
    await book.subscribe(
      SOCKET_ID,
      WAREHOUSE_ID,
      async () => ({ ok: true }),
      async () => undefined,
      async () => undefined,
      () => true,
    );

    for (let index = 0; index < 30; index += 1) {
      const ack = await book.unsubscribe(
        SOCKET_ID,
        warehouseId(index),
        async () => {
          left.push(warehouseId(index));
        },
        () => true,
      );
      expect(ack).toEqual({ ok: true });
    }
    await flushTails();

    expect(left).toEqual([]);
    expect(book.joinedCount(SOCKET_ID)).toBe(1);
    expect(socketState(book, SOCKET_ID)?.tails.size).toBe(0);
  });

  it('drops the tail when the operation throws', async () => {
    const book = new WarehouseSubscriptionBook();
    await book.subscribe(
      SOCKET_ID,
      WAREHOUSE_ID,
      async () => ({ ok: true }),
      async () => undefined,
      async () => undefined,
      () => true,
    );
    await flushTails();

    await expect(
      book.unsubscribe(
        SOCKET_ID,
        WAREHOUSE_ID,
        async () => {
          throw new Error('leave failed');
        },
        () => true,
      ),
    ).rejects.toThrow('leave failed');
    await flushTails();

    expect(book.joinedCount(SOCKET_ID)).toBe(1);
    expect(socketState(book, SOCKET_ID)?.tails.size).toBe(0);
  });

  it('keeps the next tail when the previous operation settles', async () => {
    const book = new WarehouseSubscriptionBook();
    let releaseLoad = () => {};
    const loadGate = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    let releaseLeave = () => {};
    const leaveGate = new Promise<void>((resolve) => {
      releaseLeave = resolve;
    });
    const order: string[] = [];

    const subscribed = book.subscribe(
      SOCKET_ID,
      WAREHOUSE_ID,
      async () => {
        order.push('load');
        await loadGate;
        return { ok: true };
      },
      async () => {
        order.push('join');
      },
      async () => undefined,
      () => true,
    );
    await Promise.resolve();
    const unsubscribed = book.unsubscribe(
      SOCKET_ID,
      WAREHOUSE_ID,
      async () => {
        order.push('unsubscribe');
        await leaveGate;
      },
      () => true,
    );

    releaseLoad();
    await subscribed;
    await flushTails();

    expect(order).toEqual(['load', 'join', 'unsubscribe']);
    expect(socketState(book, SOCKET_ID)?.tails.size).toBe(1);

    releaseLeave();
    await unsubscribed;
    await flushTails();
    expect(socketState(book, SOCKET_ID)?.tails.size).toBe(0);
    expect(book.joinedCount(SOCKET_ID)).toBe(0);
  });
});

describe('WarehouseSubscriptionBook deletion during join', () => {
  it('leaves a join that finishes after the warehouse is forgotten', async () => {
    const book = new WarehouseSubscriptionBook(1);
    const rooms = new Set<string>();
    let releaseJoin = () => {};
    const joinGate = new Promise<void>((resolve) => {
      releaseJoin = resolve;
    });
    let joinStarted = () => {};
    const joinEntered = new Promise<void>((resolve) => {
      joinStarted = resolve;
    });
    const steps: string[] = [];

    const pending = book.subscribe(
      SOCKET_ID,
      WAREHOUSE_ID,
      async () => {
        steps.push('loaded');
        return { ok: true };
      },
      async () => {
        rooms.add(WAREHOUSE_ID);
        steps.push('join');
        joinStarted();
        await joinGate;
      },
      async () => {
        rooms.delete(WAREHOUSE_ID);
        steps.push('leave');
      },
      () => true,
    );

    await joinEntered;
    expect(steps).toEqual(['loaded', 'join']);
    book.forgetWarehouse(WAREHOUSE_ID);
    releaseJoin();

    const ack = await pending;
    expect(ack).toEqual({
      ok: false,
      error: { code: 'WAREHOUSE_NOT_FOUND', message: 'Warehouse was not found' },
    });
    expect(steps).toEqual(['loaded', 'join', 'leave']);
    expect(rooms.has(WAREHOUSE_ID)).toBe(false);
    expect(book.joinedCount(SOCKET_ID)).toBe(0);
    expect(socketState(book, SOCKET_ID)?.pending.size).toBe(0);

    const next = await book.subscribe(
      SOCKET_ID,
      OTHER_ID,
      async () => ({ ok: true }),
      async () => {
        rooms.add(OTHER_ID);
      },
      async () => undefined,
      () => true,
    );
    expect(next).toEqual({ ok: true });
    expect(rooms.has(OTHER_ID)).toBe(true);
  });

  it('keeps the room accounted when leave throws after the warehouse is forgotten', async () => {
    const book = new WarehouseSubscriptionBook();
    const rooms = new Set<string>();
    let releaseJoin = () => {};
    const joinGate = new Promise<void>((resolve) => {
      releaseJoin = resolve;
    });
    let joinStarted = () => {};
    const joinEntered = new Promise<void>((resolve) => {
      joinStarted = resolve;
    });
    const leaves: string[] = [];

    const pending = book.subscribe(
      SOCKET_ID,
      WAREHOUSE_ID,
      async () => ({ ok: true }),
      async () => {
        rooms.add(WAREHOUSE_ID);
        joinStarted();
        await joinGate;
      },
      async () => {
        leaves.push('cancel');
        throw new Error('leave failed');
      },
      () => true,
    );

    await joinEntered;
    book.forgetWarehouse(WAREHOUSE_ID);
    releaseJoin();

    const ack = await pending;
    expect(ack.ok).toBe(false);
    expect(rooms.has(WAREHOUSE_ID)).toBe(true);
    expect(book.joinedCount(SOCKET_ID)).toBe(1);

    await book.unsubscribe(
      SOCKET_ID,
      WAREHOUSE_ID,
      async () => {
        leaves.push('unsubscribe');
        rooms.delete(WAREHOUSE_ID);
      },
      () => true,
    );

    expect(leaves).toEqual(['cancel', 'unsubscribe']);
    expect(rooms.has(WAREHOUSE_ID)).toBe(false);
    expect(book.joinedCount(SOCKET_ID)).toBe(0);
  });

  it('leaves a join that finishes after disconnect', async () => {
    const book = new WarehouseSubscriptionBook();
    const rooms = new Set<string>();
    let releaseJoin = () => {};
    const joinGate = new Promise<void>((resolve) => {
      releaseJoin = resolve;
    });
    let joinStarted = () => {};
    const joinEntered = new Promise<void>((resolve) => {
      joinStarted = resolve;
    });

    const pending = book.subscribe(
      SOCKET_ID,
      WAREHOUSE_ID,
      async () => ({ ok: true }),
      async () => {
        rooms.add(WAREHOUSE_ID);
        joinStarted();
        await joinGate;
      },
      async () => {
        rooms.delete(WAREHOUSE_ID);
      },
      () => true,
    );

    await joinEntered;
    book.disconnect(SOCKET_ID);
    releaseJoin();

    await expect(pending).resolves.toEqual({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'Socket is closed' },
    });
    expect(rooms.has(WAREHOUSE_ID)).toBe(false);
    expect(book.joinedCount(SOCKET_ID)).toBe(0);
  });

  it('does not restore a closed socket when leave throws after disconnect', async () => {
    const book = new WarehouseSubscriptionBook();
    let releaseJoin = () => {};
    const joinGate = new Promise<void>((resolve) => {
      releaseJoin = resolve;
    });
    let joinStarted = () => {};
    const joinEntered = new Promise<void>((resolve) => {
      joinStarted = resolve;
    });

    let open = true;
    const pending = book.subscribe(
      SOCKET_ID,
      WAREHOUSE_ID,
      async () => ({ ok: true }),
      async () => {
        joinStarted();
        await joinGate;
      },
      async () => {
        throw new Error('leave failed');
      },
      () => open,
    );

    await joinEntered;
    open = false;
    book.disconnect(SOCKET_ID);
    releaseJoin();

    const ack = await pending;
    expect(ack.ok).toBe(false);
    expect(book.joinedCount(SOCKET_ID)).toBe(0);
    expect(socketState(book, SOCKET_ID)).toBeUndefined();
  });
});
