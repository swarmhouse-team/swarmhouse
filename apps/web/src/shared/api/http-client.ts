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
let authRefreshPauseCount = 0;

/** Дожидается текущего refresh и блокирует новый, пока сервер завершает сессию. */
export async function withoutAuthRefresh<T>(action: () => Promise<T>): Promise<T> {
  authRefreshPauseCount += 1;
  try {
    await refreshPromise;
    return await action();
  } finally {
    authRefreshPauseCount -= 1;
  }
}

export type HttpOptions<T> = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Сериализуется в JSON. */
  body?: unknown;
  /** Если передана, ответ проверяется схемой из `@robots/shared`. */
  schema?: ZodType<T>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Публичный запрос: без access-токена и без refresh при 401. */
  public?: boolean;
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
  const { method = 'GET', body, schema, signal, headers, public: isPublic = false } = options;
  const handlers = authHandlers;
  const accessToken = isPublic ? null : handlers?.getAccessToken();

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

  if (
    response.status === 401 &&
    handlers &&
    handlers === authHandlers &&
    accessToken &&
    authRefreshPauseCount === 0
  ) {
    const currentToken = handlers.getAccessToken();
    if (currentToken) {
      if (retriedAfterRefresh) {
        if (currentToken === accessToken) {
          handlers.onAuthenticationFailure();
        }
      } else if (
        currentToken !== accessToken ||
        (await refreshAccessTokenOnce(handlers, currentToken))
      ) {
        return sendRequest(path, options, true);
      }
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

function refreshAccessTokenOnce(
  handlers: HttpAuthHandlers,
  tokenBeforeRefresh: string,
): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  const pending = Promise.resolve()
    .then(() => handlers.refreshAccessToken())
    .catch(() => null)
    .then((token) => {
      if (!token && handlers === authHandlers && handlers.getAccessToken() === tokenBeforeRefresh) {
        handlers.onAuthenticationFailure();
      }
      return handlers === authHandlers ? token : null;
    })
    .finally(() => {
      if (refreshPromise === pending) {
        refreshPromise = null;
      }
    });

  refreshPromise = pending;
  return pending;
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
