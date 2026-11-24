'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { refreshAccessToken, useSessionStore } from '@/entities/session';
import { configureHttpAuth } from '@/shared/api';

configureHttpAuth({
  getAccessToken: () => useSessionStore.getState().accessToken,
  refreshAccessToken: async () => {
    const { accessToken } = await refreshAccessToken();
    useSessionStore.getState().setAccessToken(accessToken);
    return accessToken;
  },
  onAuthenticationFailure: () => useSessionStore.getState().clearSession(),
});

/** Один раз восстанавливает access-токен из серверной refresh-сессии. */
export function SessionProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const session = useSessionStore.getState();
    if (session.status !== 'idle') {
      return;
    }

    session.startInitialization();
    void refreshAccessToken()
      .then(({ accessToken }) => useSessionStore.getState().setAccessToken(accessToken))
      .catch(() => useSessionStore.getState().clearSession());
  }, []);

  return children;
}
