import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { http } from '@/shared/api';

const mocks = vi.hoisted(() => {
  const session = {
    accessToken: null as string | null,
    status: 'idle',
    startInitialization: vi.fn(),
    setAccessToken: vi.fn(),
    clearSession: vi.fn(),
  };

  return {
    refreshAccessToken: vi.fn(),
    session,
    useSessionStore: { getState: () => session },
  };
});

vi.mock('@/entities/session', () => ({
  refreshAccessToken: mocks.refreshAccessToken,
  useSessionStore: mocks.useSessionStore,
}));

import { SessionProvider } from './session-provider';

describe('SessionProvider', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    mocks.session.accessToken = null;
    mocks.session.status = 'idle';
    mocks.session.startInitialization.mockImplementation(() => {
      mocks.session.status = 'initializing';
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    vi.unstubAllGlobals();
  });

  it('restores the access token once when the application starts', async () => {
    mocks.refreshAccessToken.mockResolvedValue({ accessToken: 'restored-token' });

    render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>content</SessionProvider>
        </QueryClientProvider>
      </StrictMode>,
    );

    await waitFor(() =>
      expect(mocks.session.setAccessToken).toHaveBeenCalledWith('restored-token'),
    );
    expect(mocks.session.startInitialization).toHaveBeenCalledOnce();
    expect(mocks.refreshAccessToken).toHaveBeenCalledOnce();
  });

  it('marks the session as anonymous when refresh fails', async () => {
    mocks.refreshAccessToken.mockRejectedValue(new Error('No refresh session'));

    render(
      <QueryClientProvider client={queryClient}>
        <SessionProvider>content</SessionProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mocks.session.clearSession).toHaveBeenCalledOnce());
  });

  it.each([true, false])(
    'ignores a late startup refresh after login (success: %s)',
    async (success) => {
      let finishRefresh!: () => void;
      const refresh = new Promise<{ accessToken: string }>((resolve, reject) => {
        finishRefresh = () => {
          if (success) {
            resolve({ accessToken: 'old-session-token' });
          } else {
            reject(new Error('No refresh session'));
          }
        };
      });
      mocks.refreshAccessToken.mockReturnValue(refresh);
      render(
        <QueryClientProvider client={queryClient}>
          <SessionProvider>content</SessionProvider>
        </QueryClientProvider>,
      );

      expect(mocks.session.status).toBe('initializing');
      mocks.session.status = 'authenticated';
      mocks.session.accessToken = 'login-token';
      queryClient.setQueryData(['session'], 'new account data');

      await act(async () => finishRefresh());

      expect(mocks.session.setAccessToken).not.toHaveBeenCalled();
      expect(mocks.session.clearSession).not.toHaveBeenCalled();
      expect(queryClient.getQueryData(['session'])).toBe('new account data');
    },
  );

  it('clears cached data when a protected request can no longer refresh its session', async () => {
    mocks.session.status = 'authenticated';
    mocks.session.accessToken = 'expired-token';
    mocks.refreshAccessToken.mockRejectedValue(new Error('Session expired'));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ code: 'UNAUTHORIZED', message: 'Expired' }, { status: 401 }),
      ),
    );
    queryClient.setQueryData(['session'], 'private data');
    render(
      <QueryClientProvider client={queryClient}>
        <SessionProvider>content</SessionProvider>
      </QueryClientProvider>,
    );

    await expect(http('/warehouses')).rejects.toMatchObject({ status: 401 });

    expect(mocks.session.clearSession).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(['session'])).toBeUndefined();
  });
});
