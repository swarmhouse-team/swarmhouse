import { API_ERROR_CODES } from '@robots/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { configureHttpAuth, http, withoutAuthRefresh } from './http-client';
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
  let resetHttpAuth: (() => void) | undefined;

  afterEach(() => {
    resetHttpAuth?.();
    resetHttpAuth = undefined;
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

  it('adds the access token to the Authorization header', async () => {
    const fetchMock = vi.fn(async () => Response.json({ status: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);
    resetHttpAuth = configureHttpAuth({
      getAccessToken: () => 'access-token',
      refreshAccessToken: vi.fn(),
      onAuthenticationFailure: vi.fn(),
    });

    await http('/health', { schema });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    );
  });

  it('keeps cookies but skips the Bearer token and refresh for public requests', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ code: 'UNAUTHORIZED', message: 'Invalid login' }, { status: 401 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const refresh = vi.fn();
    const onAuthenticationFailure = vi.fn();
    resetHttpAuth = configureHttpAuth({
      getAccessToken: () => 'access-token',
      refreshAccessToken: refresh,
      onAuthenticationFailure,
    });

    await expect(http('/auth/login', { method: 'POST', public: true })).rejects.toMatchObject({
      status: 401,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        credentials: 'include',
        headers: { Accept: 'application/json' },
      }),
    );
    expect(refresh).not.toHaveBeenCalled();
    expect(onAuthenticationFailure).not.toHaveBeenCalled();
  });

  it('refreshes once after 401 and repeats the request with the new token', async () => {
    let accessToken = 'expired-token';
    const refresh = vi.fn(async () => {
      accessToken = 'new-token';
      return accessToken;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ code: 'UNAUTHORIZED', message: 'Expired' }, { status: 401 }),
      )
      .mockResolvedValueOnce(Response.json({ status: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);
    resetHttpAuth = configureHttpAuth({
      getAccessToken: () => accessToken,
      refreshAccessToken: refresh,
      onAuthenticationFailure: vi.fn(),
    });

    await expect(http('/health', { schema })).resolves.toEqual({ status: 'ok' });

    expect(refresh).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/health',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer new-token' }),
      }),
    );
  });

  it('uses one refresh request for simultaneous 401 responses', async () => {
    let accessToken = 'expired-token';
    const refresh = vi.fn(async () => {
      accessToken = 'new-token';
      return accessToken;
    });
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
      const headers = options.headers as Record<string, string>;
      return headers.Authorization === 'Bearer new-token'
        ? Response.json({ status: 'ok' })
        : Response.json({ code: 'UNAUTHORIZED', message: 'Expired' }, { status: 401 });
    });
    vi.stubGlobal('fetch', fetchMock);
    resetHttpAuth = configureHttpAuth({
      getAccessToken: () => accessToken,
      refreshAccessToken: refresh,
      onAuthenticationFailure: vi.fn(),
    });

    await expect(
      Promise.all([http('/first', { schema }), http('/second', { schema })]),
    ).resolves.toEqual([{ status: 'ok' }, { status: 'ok' }]);

    expect(refresh).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('retries a late 401 with the token already refreshed by another request', async () => {
    let accessToken = 'expired-token';
    let releaseSlowResponse!: () => void;
    const slowResponse = new Promise<void>((resolve) => {
      releaseSlowResponse = resolve;
    });
    const refresh = vi.fn(async () => {
      accessToken = 'new-token';
      return accessToken;
    });
    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
      const headers = options.headers as Record<string, string>;
      if (headers.Authorization === 'Bearer new-token') {
        return Response.json({ status: 'ok' });
      }
      if (url === '/api/slow') {
        await slowResponse;
      }
      return Response.json({ code: 'UNAUTHORIZED', message: 'Expired' }, { status: 401 });
    });
    vi.stubGlobal('fetch', fetchMock);
    resetHttpAuth = configureHttpAuth({
      getAccessToken: () => accessToken,
      refreshAccessToken: refresh,
      onAuthenticationFailure: vi.fn(),
    });

    const slow = http('/slow', { schema });
    await expect(http('/fast', { schema })).resolves.toEqual({ status: 'ok' });
    releaseSlowResponse();
    await expect(slow).resolves.toEqual({ status: 'ok' });

    expect(refresh).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('waits for an active refresh before signing out and blocks new refreshes', async () => {
    let accessToken = 'expired-token';
    let finishRefresh!: () => void;
    const pendingRefresh = new Promise<void>((resolve) => {
      finishRefresh = resolve;
    });
    const refresh = vi.fn(async () => {
      await pendingRefresh;
      accessToken = 'new-token';
      return accessToken;
    });
    const unauthorized = () =>
      Response.json({ code: 'UNAUTHORIZED', message: 'Expired' }, { status: 401 });
    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
      if (url === '/api/auth/logout') {
        return new Response(null, { status: 204 });
      }
      const headers = options.headers as Record<string, string>;
      return url === '/api/first' && headers.Authorization === 'Bearer new-token'
        ? Response.json({ status: 'ok' })
        : unauthorized();
    });
    vi.stubGlobal('fetch', fetchMock);
    resetHttpAuth = configureHttpAuth({
      getAccessToken: () => accessToken,
      refreshAccessToken: refresh,
      onAuthenticationFailure: vi.fn(),
    });

    const first = http('/first', { schema });
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());

    const signOut = vi.fn(() => http('/auth/logout', { method: 'POST' }));
    const logoutRequest = withoutAuthRefresh(signOut);
    await expect(http('/second')).rejects.toMatchObject({ status: 401 });
    expect(signOut).not.toHaveBeenCalled();

    finishRefresh();
    await Promise.all([first, logoutRequest]);
    expect(signOut).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
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
