import { API_ERROR_CODES, type ApiError, type WarehouseAck } from '@robots/shared';

import { WAREHOUSE_SOCKET_MAX_SUBSCRIPTIONS } from './warehouse-socket.constants';

interface SocketState {
  closed: boolean;
  joined: Set<string>;
  pending: Set<string>;
  tails: Map<string, Promise<void>>;
  inflight: Map<string, Promise<WarehouseAck>>;
}

export interface SubscriptionLoad {
  ok: true;
}

export interface SubscriptionDenied {
  ok: false;
  error: ApiError;
}

/**
 * Per-socket room accounting. Pending checks count toward the limit.
 * Subscribe and unsubscribe of one warehouse on one socket run one after another.
 */
export class WarehouseSubscriptionBook {
  private readonly sockets = new Map<string, SocketState>();

  constructor(private readonly limit = WAREHOUSE_SOCKET_MAX_SUBSCRIPTIONS) {}

  joinedCount(socketId: string): number {
    return this.sockets.get(socketId)?.joined.size ?? 0;
  }

  disconnect(socketId: string): void {
    const state = this.sockets.get(socketId);
    if (!state) {
      return;
    }
    state.closed = true;
    state.joined.clear();
    state.pending.clear();
    this.sockets.delete(socketId);
  }

  forgetWarehouse(warehouseId: string): void {
    for (const state of this.sockets.values()) {
      state.joined.delete(warehouseId);
      state.pending.delete(warehouseId);
    }
  }

  subscribe(
    socketId: string,
    warehouseId: string,
    load: () => Promise<SubscriptionLoad | SubscriptionDenied>,
    join: () => Promise<void>,
    leave: () => Promise<void>,
    isOpen: () => boolean,
  ): Promise<WarehouseAck> {
    const state = this.ensure(socketId);
    if (state.closed || !isOpen()) {
      return Promise.resolve(closedAck());
    }

    const existing = state.inflight.get(warehouseId);
    if (existing) {
      return existing;
    }

    if (!state.joined.has(warehouseId)) {
      if (state.joined.size + state.pending.size >= this.limit) {
        return Promise.resolve(limitAck());
      }
      state.pending.add(warehouseId);
    }

    const promise = this.serial(state, warehouseId, () =>
      this.finish(state, warehouseId, load, join, leave, isOpen),
    );
    state.inflight.set(warehouseId, promise);
    void promise.finally(() => {
      if (state.inflight.get(warehouseId) === promise) {
        state.inflight.delete(warehouseId);
      }
    });
    return promise;
  }

  unsubscribe(
    socketId: string,
    warehouseId: string,
    leave: () => Promise<void>,
    isOpen: () => boolean,
  ): Promise<WarehouseAck> {
    const state = this.sockets.get(socketId);
    if (!state || state.closed || !isOpen()) {
      return Promise.resolve(okAck());
    }

    return this.serial(state, warehouseId, async () => {
      if (state.closed || !isOpen() || !state.joined.has(warehouseId)) {
        return okAck();
      }
      await leave();
      state.joined.delete(warehouseId);
      return okAck();
    });
  }

  private ensure(socketId: string): SocketState {
    const current = this.sockets.get(socketId);
    if (current) {
      return current;
    }
    const created: SocketState = {
      closed: false,
      joined: new Set(),
      pending: new Set(),
      tails: new Map(),
      inflight: new Map(),
    };
    this.sockets.set(socketId, created);
    return created;
  }

  private serial(
    state: SocketState,
    warehouseId: string,
    task: () => Promise<WarehouseAck>,
  ): Promise<WarehouseAck> {
    const previous = state.tails.get(warehouseId) ?? Promise.resolve();
    const current = previous.then(task, task);
    state.tails.set(
      warehouseId,
      current.then(
        () => undefined,
        () => undefined,
      ),
    );
    return current;
  }

  private async finish(
    state: SocketState,
    warehouseId: string,
    load: () => Promise<SubscriptionLoad | SubscriptionDenied>,
    join: () => Promise<void>,
    leave: () => Promise<void>,
    isOpen: () => boolean,
  ): Promise<WarehouseAck> {
    try {
      if (state.closed || !isOpen()) {
        return closedAck();
      }
      if (state.joined.has(warehouseId)) {
        return okAck();
      }

      const loaded = await load();
      if (state.closed || !isOpen()) {
        return closedAck();
      }
      if (!loaded.ok) {
        return { ok: false, error: loaded.error };
      }

      await join();
      if (state.closed || !isOpen()) {
        await leave();
        return closedAck();
      }
      state.joined.add(warehouseId);
      return okAck();
    } catch {
      return {
        ok: false,
        error: { code: API_ERROR_CODES.INTERNAL_ERROR, message: 'Internal server error' },
      };
    } finally {
      state.pending.delete(warehouseId);
    }
  }
}

function okAck(): WarehouseAck {
  return { ok: true };
}

function closedAck(): WarehouseAck {
  return { ok: false, error: { code: API_ERROR_CODES.BAD_REQUEST, message: 'Socket is closed' } };
}

function limitAck(): WarehouseAck {
  return {
    ok: false,
    error: {
      code: API_ERROR_CODES.TOO_MANY_REQUESTS,
      message: 'Too many warehouse subscriptions',
    },
  };
}
