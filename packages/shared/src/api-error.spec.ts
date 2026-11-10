import { describe, expect, it } from 'vitest';

import { apiErrorSchema } from './api-error';

describe('apiErrorSchema', () => {
  it('принимает ошибку с деталями по полям', () => {
    const error = {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: [{ path: 'name', message: 'Required' }],
    };

    expect(apiErrorSchema.parse(error)).toEqual(error);
  });

  it('отклоняет ответ без кода', () => {
    expect(apiErrorSchema.safeParse({ message: 'oops' }).success).toBe(false);
  });
});
