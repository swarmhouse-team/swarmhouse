import { z } from 'zod';

/**
 * Пример контракта: одна схема валидирует запрос в api и форму в web.
 * Удалить вместе с `ExampleModule`, когда появится первая настоящая фича.
 */
export const exampleRequestSchema = z.object({
  name: z.string().trim().min(1).max(50),
  size: z.number().int().min(1).max(100),
});

export type ExampleRequest = z.infer<typeof exampleRequestSchema>;
