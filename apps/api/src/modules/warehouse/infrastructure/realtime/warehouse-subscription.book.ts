import {
  API_ERROR_CODES,
  WAREHOUSE_HTTP_ERROR_CODES,
  WAREHOUSE_SOCKET_MAX_SUBSCRIPTIONS,
  type ApiError,
  type WarehouseAck,
} from '@robots/shared';

interface SocketState {
  closed: boolean;
  joined: Set<string>;
  pending: Set<string>;
  tails: Map<string, Promise<void>>;
  inflight: Map<string, Flight>;
}

interface Flight {
  cancelled: boolean;
  promise: Promise<WarehouseAck>;
}

interface SubscriptionLoad {
  ok: true;
}

interface SubscriptionDenied {
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
      const flight = state.inflight.get(warehouseId);
      if (flight) {
        flight.cancelled = true;
      }
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
      return existing.promise;
    }

    if (!state.joined.has(warehouseId)) {
      if (state.joined.size + state.pending.size >= this.limit) {
        return Promise.resolve(limitAck());
      }
      state.pending.add(warehouseId);
    }

    const flight: Flight = {
      cancelled: false,
      promise: Promise.resolve(okAck()),
    };
    flight.promise = this.serial(state, warehouseId, () =>
      this.finish(state, warehouseId, flight, load, join, leave, isOpen),
    );
    state.inflight.set(warehouseId, flight);
    void flight.promise.finally(() => {
      if (state.inflight.get(warehouseId) === flight) {
        state.inflight.delete(warehouseId);
      }
    });
    return flight.promise;
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
    const tail = current.then(
      () => undefined,
      () => undefined,
    );
    state.tails.set(warehouseId, tail);
    void tail.finally(() => {
      if (state.tails.get(warehouseId) === tail) {
        state.tails.delete(warehouseId);
      }
    });
    return current;
  }

  private async finish(
    state: SocketState,
    warehouseId: string,
    flight: Flight,
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
      if (flight.cancelled) {
        return missingAck();
      }
      if (!loaded.ok) {
        return { ok: false, error: loaded.error };
      }

      await join();
      try {
        if (state.closed || !isOpen()) {
          await leave();
          return closedAck();
        }
        if (flight.cancelled) {
          await leave();
          return missingAck();
        }
      } catch {
        if (!state.closed) {
          state.joined.add(warehouseId);
        }
        return {
          ok: false,
          error: { code: API_ERROR_CODES.INTERNAL_ERROR, message: 'Internal server error' },
        };
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

function missingAck(): WarehouseAck {
  return {
    ok: false,
    error: {
      code: WAREHOUSE_HTTP_ERROR_CODES.WAREHOUSE_NOT_FOUND,
      message: 'Warehouse was not found',
    },
  };
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
