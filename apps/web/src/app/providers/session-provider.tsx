'use client';

import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { refreshAccessToken, useSessionStore } from '@/entities/session';
import { configureHttpAuth } from '@/shared/api';

/** Один раз восстанавливает access-токен из серверной refresh-сессии. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    const disconnect = configureHttpAuth({
      getAccessToken: () => useSessionStore.getState().accessToken,
      refreshAccessToken: async () => {
        const previousToken = useSessionStore.getState().accessToken;
        const { accessToken } = await refreshAccessToken();
        const session = useSessionStore.getState();
        if (!active || session.accessToken !== previousToken) {
          return null;
        }
        session.setAccessToken(accessToken);
        return accessToken;
      },
      onAuthenticationFailure: () => {
        useSessionStore.getState().clearSession();
        queryClient.removeQueries();
      },
    });

    return () => {
      active = false;
      disconnect();
    };
  }, [queryClient]);

  useEffect(() => {
    const session = useSessionStore.getState();
    if (session.status !== 'idle') {
      return;
    }

    session.startInitialization();
    void refreshAccessToken()
      .then(({ accessToken }) => {
        const currentSession = useSessionStore.getState();
        if (currentSession.status === 'initializing') {
          currentSession.setAccessToken(accessToken);
        }
      })
      .catch(() => {
        const currentSession = useSessionStore.getState();
        if (currentSession.status === 'initializing') {
          currentSession.clearSession();
          queryClient.removeQueries();
        }
      });
  }, [queryClient]);

  return children;
}
