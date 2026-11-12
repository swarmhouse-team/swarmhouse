import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'должен начинаться с postgresql://'),
});

export type Env = z.infer<typeof envSchema>;

/** Передаётся в `ConfigModule.forRoot({ validate })`: приложение не стартует с битым окружением. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    throw new Error(`Некорректные переменные окружения:\n${z.prettifyError(result.error)}`);
  }

  return result.data;
}
