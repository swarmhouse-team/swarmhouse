import { API_ERROR_CODES } from '@robots/shared';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/shared/api';

import { applyApiValidationErrors } from './api-validation-errors';
import { messages } from '../messages';
import type { ValidationTranslator } from './zod-error-map';

const t: ValidationTranslator = createTranslator({
  locale: 'en',
  messages: messages.en,
  namespace: 'validation',
});

const validationError = (details: { path: string; code?: string; message: string }[]) =>
  new HttpError(400, {
    code: API_ERROR_CODES.VALIDATION_ERROR,
    message: 'Validation failed',
    details,
  });

describe('applyApiValidationErrors', () => {
  it('ставит переведённую по коду ошибку на поле', () => {
    const setError = vi.fn();

    const handled = applyApiValidationErrors(
      validationError([{ path: 'name', code: 'too_small', message: 'Too small: expected >=3' }]),
      setError,
      t,
    );

    expect(handled).toBe(true);
    expect(setError).toHaveBeenCalledWith('name', {
      type: 'server',
      message: 'Value is too short or too small',
    });
  });

  it('ошибка всего объекта → root, неизвестный код → общий текст', () => {
    const setError = vi.fn();

    applyApiValidationErrors(
      validationError([{ path: '', code: 'custom', message: 'x' }]),
      setError,
      t,
    );

    expect(setError).toHaveBeenCalledWith('root', { type: 'server', message: 'Invalid value' });
  });

  it('другие ошибки не трогает', () => {
    const setError = vi.fn();
    const notFound = new HttpError(404, { code: API_ERROR_CODES.NOT_FOUND, message: '' });

    expect(applyApiValidationErrors(notFound, setError, t)).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });
});
