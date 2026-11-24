import {
  loginResponseSchema,
  meResponseSchema,
  type LoginRequest,
  type LoginResponse,
  type MeResponse,
} from '@robots/shared';

import { http } from '@/shared/api';

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
  return http('/auth/logout', { method: 'POST', skipAuthRefresh: true });
}

export function getCurrentUser(): Promise<MeResponse> {
  return http('/auth/me', { schema: meResponseSchema });
}
