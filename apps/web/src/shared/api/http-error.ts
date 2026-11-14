import type { ApiError } from '@robots/shared';

/**
 * Ошибка HTTP-запроса. `status === 0` — запрос не дошёл до сервера.
 * `message` — технический текст для логов, пользователю показывается перевод по `code`
 * (см. `translateError`). `cause` — исходная ошибка (например, ZodError), для отладки.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly error: ApiError;

  constructor(status: number, error: ApiError, options?: { cause?: unknown }) {
    super(error.message, options);
    this.name = 'HttpError';
    this.status = status;
    this.error = error;
  }

  get code(): string {
    return this.error.code;
  }
}
