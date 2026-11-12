import type { ApiError } from '@robots/shared';

/**
 * Ошибка HTTP-запроса. `status === 0` — запрос не дошёл до сервера.
 * `cause` — исходная ошибка (например, ZodError при ответе не по схеме), для отладки.
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

const FALLBACK_MESSAGE = 'Что-то пошло не так. Попробуйте ещё раз.';

/**
 * Текст ошибки для показа пользователю. Текст берём только из `HttpError`:
 * у остальных ошибок он технический (`Unexpected token <`, текст ZodError и т. п.).
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof HttpError && error.message) {
    return error.message;
  }

  return FALLBACK_MESSAGE;
}
