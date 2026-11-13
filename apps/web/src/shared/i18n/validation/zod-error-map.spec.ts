import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { Locale } from '../config';
import { messages } from '../messages';
import { createZodErrorMap, type ValidationTranslator } from './zod-error-map';

function errorMap(locale: Locale) {
  const t: ValidationTranslator = createTranslator({
    locale,
    messages: messages[locale],
    namespace: 'validation',
  });
  return createZodErrorMap(t);
}

function firstMessage(schema: z.ZodType, value: unknown, locale: Locale): string | undefined {
  const result = schema.safeParse(value, { error: errorMap(locale) });
  return result.error?.issues[0]?.message;
}

describe('createZodErrorMap', () => {
  it('строка короче минимума → сообщение с числом на языке переводчика', () => {
    const schema = z.string().min(3);

    expect(firstMessage(schema, 'ab', 'ru')).toBe('Минимум 3 символа');
    expect(firstMessage(schema, 'ab', 'en')).toBe('At least 3 characters');
  });

  it('плюрализация по-русски', () => {
    expect(firstMessage(z.string().min(5), 'ab', 'ru')).toBe('Минимум 5 символов');
    expect(firstMessage(z.string().max(1), 'ab', 'ru')).toBe('Максимум 1 символ');
  });

  it('нет значения → «обязательное поле»', () => {
    const schema = z.object({ name: z.string() });

    expect(firstMessage(schema, {}, 'en')).toBe('Required field');
  });

  it('positive() → строгое сравнение', () => {
    expect(firstMessage(z.number().positive(), 0, 'en')).toBe('Must be greater than 0');
  });

  it('формат email', () => {
    expect(firstMessage(z.email(), 'nope', 'ru')).toBe('Введите корректный email');
  });

  it('код без своего ключа → общий текст', () => {
    const schema = z.strictObject({});

    expect(firstMessage(schema, { extra: 1 }, 'en')).toBe('Invalid value');
  });
});
