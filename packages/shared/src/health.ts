import { z } from 'zod';

/**
 * Ответ `GET /health`. Если проверенная зависимость недоступна, API отвечает 503 (`ApiError`).
 * `redis` есть только после успешного PING кэша. Без проверки поле отсутствует.
 */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  db: z.literal('up'),
  redis: z.literal('up').optional(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
