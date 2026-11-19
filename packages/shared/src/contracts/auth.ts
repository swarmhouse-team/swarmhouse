import { z } from 'zod';

/** Тело запроса входа. */
export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** Ответ на вход: access-токен. */
export const loginResponseSchema = z.object({
  accessToken: z.string().min(1),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

/** Профиль текущего пользователя (`GET /auth/me`). */
export const meResponseSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  name: z.string(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
