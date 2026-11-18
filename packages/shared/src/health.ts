import { z } from 'zod';

/** Ответ `GET /health`. Если хоть одна зависимость недоступна, API отвечает 503 (`ApiError`). */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  db: z.literal('up'),
  redis: z.literal('up'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
