import { describe, expect, it } from 'vitest';

import { apiErrorSchema } from './api-error';

describe('apiErrorSchema', () => {
  it('принимает ошибку без details', () => {
    const error = { code: 'NOT_FOUND', message: 'Склад не найден' };

    expect(apiErrorSchema.parse(error)).toEqual(error);
  });

  it('принимает ошибку с деталями по полям', () => {
    const error = {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: [{ path: 'name', message: 'Required' }],
    };

    expect(apiErrorSchema.parse(error)).toEqual(error);
  });

  it('отклоняет объект details с версиями конфликта', () => {
    expect(
      apiErrorSchema.safeParse({
        code: 'MAP_VERSION_CONFLICT',
        message: 'Версия карты устарела. Перечитайте карту и повторите команду.',
        details: { expectedVersion: 1, actualVersion: 2 },
      }).success,
    ).toBe(false);
  });

  it('отклоняет некорректный элемент массива details', () => {
    expect(
      apiErrorSchema.safeParse({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: [{ path: 'name' }],
      }).success,
    ).toBe(false);
  });

  it('отклоняет ответ без кода', () => {
    expect(apiErrorSchema.safeParse({ message: 'oops' }).success).toBe(false);
  });
});
