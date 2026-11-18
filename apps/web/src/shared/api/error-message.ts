import type { ApiErrorCode } from '@robots/shared';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { HttpError } from './http-error';

/** Переводчик неймспейса `errors` — из `useTranslations('errors')` или `getTranslations('errors')`. */
export type ErrorsTranslator = ReturnType<typeof useTranslations<'errors'>>;

/**
 * Текст ошибки для пользователя на текущем языке. Выбирается по `code` ошибки API;
 * `message` сервера не показываем. Неизвестный код и ошибки не из `http` — общий текст.
 */
export function translateError(error: unknown, t: ErrorsTranslator): string {
  if (error instanceof HttpError) {
    // Набор кодов открытый: фича может прислать код, для которого ключа ещё нет.
    const key = `api.${error.code}` as `api.${ApiErrorCode}`;
    if (t.has(key)) {
      return t(key);
    }
  }

  return t('generic');
}

/** `translateError` с переводчиком текущего языка — для компонентов. */
export function useErrorMessage(): (error: unknown) => string {
  const t = useTranslations('errors');
  return useCallback((error: unknown) => translateError(error, t), [t]);
}
