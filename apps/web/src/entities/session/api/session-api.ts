import {
  loginResponseSchema,
  meResponseSchema,
  type LoginRequest,
  type LoginResponse,
  type MeResponse,
} from '@robots/shared';

import { http, withoutAuthRefresh } from '@/shared/api';

import { useSessionStore } from '../model/session-store';

export const currentUserQueryKey = ['session', 'current-user'] as const;

export function login(credentials: LoginRequest): Promise<LoginResponse> {
  return http('/auth/login', {
    method: 'POST',
    body: credentials,
    schema: loginResponseSchema,
    skipAuthRefresh: true,
  });
}

export function refreshAccessToken(): Promise<LoginResponse> {
  return http('/auth/refresh', {
    method: 'POST',
    schema: loginResponseSchema,
    skipAuthRefresh: true,
  });
}

export function logout(): Promise<void> {
  return withoutAuthRefresh(async () => {
    await http('/auth/logout', { method: 'POST', skipAuthRefresh: true });
    useSessionStore.getState().clearSession();
  });
}

export function getCurrentUser(signal?: AbortSignal): Promise<MeResponse> {
  return http('/auth/me', { schema: meResponseSchema, signal });
}
