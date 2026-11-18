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
  throw new Error('Expected an error');
}

const schema = z.object({ status: z.literal('ok') });

describe('http', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the body checked by the schema', async () => {
    mockFetch(Response.json({ status: 'ok' }));

    await expect(http('/health', { schema })).resolves.toEqual({ status: 'ok' });
  });

  it('returns undefined for an empty 2xx body', async () => {
    mockFetch(new Response(null, { status: 201 }));

    await expect(http('/example', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('HTML at 200 → HttpError UNKNOWN_ERROR, without the parser text', async () => {
    mockFetch(new Response('<html>proxy</html>', { status: 200 }));

    const error = await catchError(http('/health', { schema }));

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 200, code: API_ERROR_CODES.UNKNOWN_ERROR });
    expect((error as HttpError).cause).toBeInstanceOf(SyntaxError);
  });

  it('JSON that fails the schema at 200 → HttpError UNKNOWN_ERROR', async () => {
    mockFetch(Response.json({ status: 'broken' }));

    const error = await catchError(http('/health', { schema }));

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 200, code: API_ERROR_CODES.UNKNOWN_ERROR });
  });

  it('an API error (4xx) arrives as the ApiError from the body', async () => {
    mockFetch(
      Response.json({ code: 'NOT_FOUND', message: 'Warehouse was not found' }, { status: 404 }),
    );

    const error = await catchError(http('/warehouses/1'));

    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect((error as HttpError).error.message).toBe('Warehouse was not found');
    expect((error as HttpError).error.details).toBeUndefined();
  });

  it('keeps the code and message of a version conflict', async () => {
    const message = 'The map version is stale. Read the map again and repeat the command.';
    mockFetch(
      Response.json({ code: API_ERROR_CODES.MAP_VERSION_CONFLICT, message }, { status: 409 }),
    );

    const error = await catchError(http('/maps/1/operations', { method: 'POST' }));

    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(409);
    expect((error as HttpError).error).toEqual({
      code: API_ERROR_CODES.MAP_VERSION_CONFLICT,
      message,
    });
  });

  it('keeps the details array of a validation error', async () => {
    const details = [{ path: 'name', message: 'Required' }];
    mockFetch(
      Response.json(
        { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'Validation failed', details },
        { status: 400 },
      ),
    );

    const error = await catchError(http('/warehouses', { method: 'POST' }));

    expect((error as HttpError).error.details).toEqual(details);
  });

  it('an invalid error body stays UNKNOWN_ERROR', async () => {
    mockFetch(new Response('<html>', { status: 502, statusText: 'Bad Gateway' }));

    const error = await catchError(http('/health'));

    expect(error).toMatchObject({ status: 502, code: API_ERROR_CODES.UNKNOWN_ERROR });
  });

  it('a network failure is HttpError NETWORK_ERROR with status 0', async () => {
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
    ['network (0)', httpError(0), true],
    ['server (500)', httpError(500), true],
    ['client (404)', httpError(404), false],
    ['invalid response at 200', httpError(200), false],
    ['error outside http', new Error('bug'), false],
  ])('%s → retry: %s', (_name, error, expected) => {
    expect(retry(0, error)).toBe(expected);
  });

  it('retries at most twice', () => {
    expect(retry(2, httpError(500))).toBe(false);
  });
});
