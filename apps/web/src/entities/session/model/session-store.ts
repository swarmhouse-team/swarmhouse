'use client';

import { createModelStore } from '@/shared/lib/store';

export type SessionStatus = 'idle' | 'initializing' | 'authenticated' | 'anonymous';

type SessionState = {
  accessToken: string | null;
  status: SessionStatus;
  startInitialization: () => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
};

/** Access-токен хранится только в памяти и исчезает после перезагрузки страницы. */
export const useSessionStore = createModelStore<SessionState>('session', (set) => ({
  accessToken: null,
  status: 'idle',
  startInitialization: () => set({ status: 'initializing' }, false, 'startInitialization'),
  setAccessToken: (accessToken) =>
    set({ accessToken, status: 'authenticated' }, false, 'setAccessToken'),
  clearSession: () => set({ accessToken: null, status: 'anonymous' }, false, 'clearSession'),
}));
