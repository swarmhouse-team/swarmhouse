import type { ApiError } from '@robots/shared';

/** Ошибка HTTP-запроса. `status === 0` — запрос не дошёл до сервера. */
export class HttpError extends Error {
  readonly status: number;
  readonly error: ApiError;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = 'HttpError';
    this.status = status;
    this.error = error;
  }

  get code(): string {
    return this.error.code;
  }
}

const FALLBACK_MESSAGE = 'Что-то пошло не так. Попробуйте ещё раз.';

/** Текст ошибки для показа пользователю. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return FALLBACK_MESSAGE;
}
