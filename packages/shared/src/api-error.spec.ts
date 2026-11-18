import { describe, expect, it } from 'vitest';

import { apiErrorSchema } from './api-error';

describe('apiErrorSchema', () => {
  it('accepts an error without details', () => {
    const error = { code: 'NOT_FOUND', message: 'Warehouse was not found' };

    expect(apiErrorSchema.parse(error)).toEqual(error);
  });

  it('accepts an error with field details', () => {
    const error = {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: [{ path: 'name', message: 'Required' }],
    };

    expect(apiErrorSchema.parse(error)).toEqual(error);
  });

  it('rejects a details object that contains conflict versions', () => {
    expect(
      apiErrorSchema.safeParse({
        code: 'MAP_VERSION_CONFLICT',
        message: 'The map version is stale. Read the map again and repeat the command.',
        details: { expectedVersion: 1, actualVersion: 2 },
      }).success,
    ).toBe(false);
  });

  it('rejects an invalid details array item', () => {
    expect(
      apiErrorSchema.safeParse({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: [{ path: 'name' }],
      }).success,
    ).toBe(false);
  });

  it('rejects a response without a code', () => {
    expect(apiErrorSchema.safeParse({ message: 'oops' }).success).toBe(false);
  });
});
