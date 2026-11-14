import { API_ERROR_CODES } from '@robots/shared';
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { messages } from '@/shared/i18n/messages';

import { translateError, type ErrorsTranslator } from './error-message';
import { HttpError } from './http-error';

function translator(locale: 'ru' | 'en'): ErrorsTranslator {
  return createTranslator({ locale, messages: messages[locale], namespace: 'errors' });
}

const httpError = (code: string, message = 'Server text') => new HttpError(503, { code, message });

describe('translateError', () => {
  it('известный код → перевод на текущем языке, а не message сервера', () => {
    const error = httpError(API_ERROR_CODES.SERVICE_UNAVAILABLE, 'Database is unavailable');

    expect(translateError(error, translator('ru'))).toBe('Сервис временно недоступен');
    expect(translateError(error, translator('en'))).toBe('The service is temporarily unavailable');
  });

  it('сбой сети → NETWORK_ERROR', () => {
    const error = new HttpError(0, { code: API_ERROR_CODES.NETWORK_ERROR, message: '' });

    expect(translateError(error, translator('en'))).toBe('No connection to the server');
  });

  it('неизвестный код → общий текст', () => {
    expect(translateError(httpError('WAREHOUSE_LOCKED'), translator('ru'))).toBe(
      'Что-то пошло не так. Попробуйте ещё раз.',
    );
  });

  it('ошибка не из http → общий текст без технических подробностей', () => {
    expect(translateError(new SyntaxError('Unexpected token <'), translator('en'))).toBe(
      'Something went wrong. Please try again.',
    );
  });

  it('для каждого кода из API_ERROR_CODES есть перевод', () => {
    const t = translator('ru');
    const generic = t('generic');

    for (const code of Object.values(API_ERROR_CODES)) {
      expect(translateError(httpError(code), t), code).not.toBe(generic);
    }
  });
});
