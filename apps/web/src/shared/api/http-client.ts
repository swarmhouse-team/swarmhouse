import { API_ERROR_CODES, apiErrorSchema, type ApiError } from '@robots/shared';
import type { ZodType } from 'zod';

import { HttpError } from './http-error';

/** Браузер ходит на свой origin, Next проксирует `/api/*` в бэкенд (см. next.config.ts). */
const API_BASE_URL = '/api';

type HttpAuthHandlers = {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
  onAuthenticationFailure: () => void;
};

let authHandlers: HttpAuthHandlers | null = null;
let refreshPromise: Promise<string | null> | null = null;

export type HttpOptions<T> = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Сериализуется в JSON. */
  body?: unknown;
  /** Если передана, ответ проверяется схемой из `@robots/shared`. */
  schema?: ZodType<T>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Не запускать refresh при 401. Нужен для самих auth-запросов. */
  skipAuthRefresh?: boolean;
};

/** Подключает session-стор к HTTP-клиенту без зависимости shared-слоя от entities. */
export function configureHttpAuth(handlers: HttpAuthHandlers): () => void {
  authHandlers = handlers;

  return () => {
    if (authHandlers === handlers) {
      authHandlers = null;
      refreshPromise = null;
    }
  };
}

/**
 * Единственная точка HTTP-запросов к API.
 * При любом сбое бросает `HttpError` с телом в формате `ApiError`.
 */
export async function http<T = unknown>(path: string, options: HttpOptions<T> = {}): Promise<T> {
  return sendRequest(path, options, false);
}

async function sendRequest<T>(
  path: string,
  options: HttpOptions<T>,
  retriedAfterRefresh: boolean,
): Promise<T> {
  const { method = 'GET', body, schema, signal, headers, skipAuthRefresh = false } = options;
  const accessToken = authHandlers?.getAccessToken();

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      signal,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    // Отмену запроса (AbortController) пробрасываем как есть: TanStack Query обрабатывает её сам.
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new HttpError(0, {
      code: API_ERROR_CODES.NETWORK_ERROR,
      message: 'Cannot reach the server',
    });
  }

  if (response.status === 401 && authHandlers && !skipAuthRefresh) {
    if (retriedAfterRefresh) {
      authHandlers.onAuthenticationFailure();
    } else if (await refreshAccessTokenOnce()) {
      return sendRequest(path, options, true);
    }
  }

  if (!response.ok) {
    throw new HttpError(response.status, await parseApiError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  try {
    const text = await response.text();
    const data: unknown = text ? JSON.parse(text) : undefined;
    return schema ? schema.parse(data) : (data as T);
  } catch (cause) {
    throw new HttpError(
      response.status,
      { code: API_ERROR_CODES.UNKNOWN_ERROR, message: 'The server returned an invalid response' },
      { cause },
    );
  }
}

function refreshAccessTokenOnce(): Promise<string | null> {
  if (!refreshPromise) {
    const handlers = authHandlers;
    if (!handlers) {
      return Promise.resolve(null);
    }

    refreshPromise = handlers
      .refreshAccessToken()
      .then((accessToken) => {
        if (!accessToken) {
          handlers.onAuthenticationFailure();
        }
        return accessToken;
      })
      .catch(() => {
        handlers.onAuthenticationFailure();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

async function parseApiError(response: Response): Promise<ApiError> {
  try {
    const parsed = apiErrorSchema.safeParse(await response.json());
    if (parsed.success) {
      return parsed.data;
    }
  } catch {
    // Тело не JSON (например, HTML от прокси) — ниже вернём запасной вариант.
  }

  return {
    code: API_ERROR_CODES.UNKNOWN_ERROR,
    message: response.statusText || `Request failed with status ${response.status}`,
  };
}
