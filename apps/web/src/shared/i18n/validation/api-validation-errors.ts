import { API_ERROR_CODES } from '@robots/shared';
import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form';

import { HttpError } from '@/shared/api';

import type { ValidationTranslator } from './zod-error-map';

type ApiValidationKey =
  `api.${'invalid_type' | 'too_small' | 'too_big' | 'invalid_format' | 'invalid_value' | 'not_multiple_of'}`;

/**
 * Раскладывает ошибки полей из ответа `VALIDATION_ERROR` по полям формы с переводом по коду
 * правила. Ошибка всего объекта (`path === ''`) попадает в `errors.root`.
 * Возвращает `true`, если ошибка была ошибкой валидации с деталями.
 */
export function applyApiValidationErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  t: ValidationTranslator,
): boolean {
  if (
    !(error instanceof HttpError) ||
    error.code !== API_ERROR_CODES.VALIDATION_ERROR ||
    !error.error.details?.length
  ) {
    return false;
  }

  for (const detail of error.error.details) {
    const key = `api.${detail.code}` as ApiValidationKey;
    const message = detail.code && t.has(key) ? t(key) : t('invalid');
    setError((detail.path || 'root') as FieldPath<T> | 'root', { type: 'server', message });
  }

  return true;
}
