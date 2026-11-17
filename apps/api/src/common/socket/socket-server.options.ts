import { SOCKET_ENGINE_PATH, SOCKET_MAX_HTTP_BUFFER_BYTES } from '@robots/shared';
import type { ServerOptions } from 'socket.io';

export function readSocketAllowedOrigins(
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

function originHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/** Exact match against the configured list. `*` is not a wildcard. A missing origin is rejected. */
export function isSocketOriginAllowed(
  origin: string | undefined,
  allowedOrigins: readonly string[],
): boolean {
  if (origin === undefined || origin.length === 0) {
    return false;
  }
  return allowedOrigins.includes(origin);
}

export function appSocketServerOptions(allowedOrigins: readonly string[]): Partial<ServerOptions> {
  return {
    path: SOCKET_ENGINE_PATH,
    maxHttpBufferSize: SOCKET_MAX_HTTP_BUFFER_BYTES,
    cors: {
      origin: (origin, callback) => {
        if (!isSocketOriginAllowed(origin, allowedOrigins)) {
          callback(new Error('Origin is not allowed'), false);
          return;
        }
        callback(null, true);
      },
    },
    allowRequest: (request, callback) => {
      const origin = originHeader(request.headers.origin);
      if (!isSocketOriginAllowed(origin, allowedOrigins)) {
        callback('Origin is not allowed', false);
        return;
      }
      callback(null, true);
    },
  };
}
