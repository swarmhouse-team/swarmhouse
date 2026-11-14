import { API_ERROR_CODES } from '@robots/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { http } from './http-client';
import { HttpError } from './http-error';
import { createQueryClient } from './query-client';

function mockFetch(response: Response | (() => never)) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => (typeof response === 'function' ? response() : response)),
  );
}

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Ожидалась ошибка');
}

const schema = z.object({ status: z.literal('ok') });

describe('http', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('возвращает тело, проверенное схемой', async () => {
    mockFetch(Response.json({ status: 'ok' }));

    await expect(http('/health', { schema })).resolves.toEqual({ status: 'ok' });
  });

  it('пустое тело при 2xx — undefined', async () => {
    mockFetch(new Response(null, { status: 201 }));

    await expect(http('/example', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('HTML при 200 — HttpError UNKNOWN_ERROR, без текста парсера', async () => {
    mockFetch(new Response('<html>proxy</html>', { status: 200 }));

    const error = await catchError(http('/health', { schema }));

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 200, code: API_ERROR_CODES.UNKNOWN_ERROR });
    expect((error as HttpError).cause).toBeInstanceOf(SyntaxError);
  });

  it('JSON не по схеме при 200 — HttpError UNKNOWN_ERROR', async () => {
    mockFetch(Response.json({ status: 'broken' }));

    const error = await catchError(http('/health', { schema }));

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 200, code: API_ERROR_CODES.UNKNOWN_ERROR });
  });

  it('ошибка API (4xx) приходит с ApiError из тела', async () => {
    mockFetch(Response.json({ code: 'NOT_FOUND', message: 'Склад не найден' }, { status: 404 }));

    const error = await catchError(http('/warehouses/1'));

    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect((error as HttpError).error.message).toBe('Склад не найден');
  });

  it('сбой сети — HttpError NETWORK_ERROR со статусом 0', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch');
    });

    const error = await catchError(http('/health'));

    expect(error).toMatchObject({ status: 0, code: API_ERROR_CODES.NETWORK_ERROR });
  });
});

describe('повтор запросов', () => {
  const retry = createQueryClient({ getErrorMessage: () => '' }).getDefaultOptions().queries
    ?.retry as (failureCount: number, error: Error) => boolean;

  const httpError = (status: number) =>
    new HttpError(status, { code: API_ERROR_CODES.UNKNOWN_ERROR, message: '' });

  it.each([
    ['сеть (0)', httpError(0), true],
    ['сервер (500)', httpError(500), true],
    ['клиент (404)', httpError(404), false],
    ['некорректный ответ при 200', httpError(200), false],
    ['ошибка не из http', new Error('bug'), false],
  ])('%s → повтор: %s', (_name, error, expected) => {
    expect(retry(0, error)).toBe(expected);
  });

  it('не больше двух повторов', () => {
    expect(retry(2, httpError(500))).toBe(false);
  });
});
