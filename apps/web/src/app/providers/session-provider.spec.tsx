import { render, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  beforeEach(() => {
    mocks.session.status = 'idle';
    mocks.session.startInitialization.mockImplementation(() => {
      mocks.session.status = 'initializing';
    });
    vi.clearAllMocks();
  });

  it('restores the access token once when the application starts', async () => {
    mocks.refreshAccessToken.mockResolvedValue({ accessToken: 'restored-token' });

    render(
      <StrictMode>
        <SessionProvider>content</SessionProvider>
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

    render(<SessionProvider>content</SessionProvider>);

    await waitFor(() => expect(mocks.session.clearSession).toHaveBeenCalledOnce());
  });
});
