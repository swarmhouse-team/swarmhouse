import type { ServerOptions } from 'socket.io';

import {
  WAREHOUSE_SOCKET_MAX_PAYLOAD_BYTES,
  WAREHOUSE_SOCKET_PATH,
} from './warehouse-socket.constants';

export function readWarehouseSocketOrigins(
  nodeEnv: string,
  raw: string | undefined,
): readonly string[] {
  if (raw !== undefined) {
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  if (nodeEnv === 'production') {
    return [];
  }
  return ['http://localhost:3000', 'http://localhost:3001'];
}

export function originHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/** Exact match against the configured list. `*` is not a wildcard. A missing origin is rejected. */
export function isWarehouseOriginAllowed(
  origin: string | undefined,
  allowedOrigins: readonly string[],
): boolean {
  if (origin === undefined || origin.length === 0) {
    return false;
  }
  return allowedOrigins.includes(origin);
}

export function warehouseServerOptions(allowedOrigins: readonly string[]): Partial<ServerOptions> {
  return {
    path: WAREHOUSE_SOCKET_PATH,
    maxHttpBufferSize: WAREHOUSE_SOCKET_MAX_PAYLOAD_BYTES,
    cors: {
      origin: (origin, callback) => {
        if (!isWarehouseOriginAllowed(origin, allowedOrigins)) {
          callback(new Error('Origin is not allowed'), false);
          return;
        }
        callback(null, true);
      },
    },
    allowRequest: (request, callback) => {
      const origin = originHeader(request.headers.origin);
      if (!isWarehouseOriginAllowed(origin, allowedOrigins)) {
        callback('Origin is not allowed', false);
        return;
      }
      callback(null, true);
    },
  };
}
