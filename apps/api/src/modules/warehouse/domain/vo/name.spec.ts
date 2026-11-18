import { describe, expect, it } from 'vitest';

import { InvalidNameError } from '../errors/value.errors';
import { MAX_NAME_LENGTH } from '../constants';
import { Name } from './name';

describe('Name', () => {
  it('trims surrounding spaces', () => {
    expect(Name.create('  Warehouse  ').value).toBe('Warehouse');
  });

  it('accepts a name of exactly the maximum length', () => {
    const value = 'a'.repeat(MAX_NAME_LENGTH);

    expect(Name.create(value).value).toBe(value);
  });

  it.each(['', '   ', 'a'.repeat(MAX_NAME_LENGTH + 1)])('rejects %j', (value) => {
    expect(() => Name.create(value)).toThrow(InvalidNameError);
  });
});
