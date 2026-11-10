import { API_ERROR_CODES, apiErrorSchema, type ApiError } from '@robots/shared';
import type { ZodType } from 'zod';

import { HttpError } from './http-error';

/** Браузер ходит на свой origin, Next проксирует `/api/*` в бэкенд (см. next.config.ts). */
const API_BASE_URL = '/api';

export type HttpOptions<T> = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Сериализуется в JSON. */
  body?: unknown;
  /** Если передана, ответ проверяется схемой из `@robots/shared`. */
  schema?: ZodType<T>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

/**
 * Единственная точка HTTP-запросов к API.
 * При любом сбое бросает `HttpError` с телом в формате `ApiError`.
 */
export async function http<T = unknown>(path: string, options: HttpOptions<T> = {}): Promise<T> {
  const { method = 'GET', body, schema, signal, headers } = options;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      signal,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
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
      message: 'Нет соединения с сервером',
    });
  }

  if (!response.ok) {
    throw new HttpError(response.status, await parseApiError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data: unknown = await response.json();

  return schema ? schema.parse(data) : (data as T);
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
    message: response.statusText || `Ошибка запроса (${response.status})`,
  };
}
