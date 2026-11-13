import { z } from 'zod';

/**
 * Коды ошибок, которые отдаёт API. Набор открытый: фичи добавляют свои коды,
 * поэтому в `ApiError.code` лежит строка, а не enum.
 */
export const API_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** Только на клиенте: запрос не дошёл до сервера. */
  NETWORK_ERROR: 'NETWORK_ERROR',
  /** Только на клиенте: ответ не в формате ApiError. */
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/**
 * Ошибка одного поля: `path` — путь через точку (`items.0.name`), пустая строка — весь объект.
 * `code` — код нарушенного правила (код zod issue: `too_small`, `invalid_type`, ...), по нему
 * клиент переводит сообщение. `message` — технический текст на английском.
 */
export const apiErrorDetailSchema = z.object({
  path: z.string(),
  code: z.string().optional(),
  message: z.string(),
});

export type ApiErrorDetail = z.infer<typeof apiErrorDetailSchema>;

/** Единый формат ошибки API. `details` заполняется для ошибок валидации. */
export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.array(apiErrorDetailSchema).optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
