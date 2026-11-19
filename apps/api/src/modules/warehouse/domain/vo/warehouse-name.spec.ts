import { describe, expect, it } from 'vitest';

import { InvalidNameError } from '../errors/value.errors';
import { MAX_NAME_LENGTH } from '../constants';
import { WarehouseName } from './warehouse-name';

describe('WarehouseName', () => {
  it('trims surrounding spaces', () => {
    expect(WarehouseName.create('  Warehouse  ').value).toBe('Warehouse');
  });

  it('accepts a name of exactly the maximum length', () => {
    const value = 'a'.repeat(MAX_NAME_LENGTH);

    expect(WarehouseName.create(value).value).toBe(value);
  });

  it.each(['', '   ', 'a'.repeat(MAX_NAME_LENGTH + 1)])('rejects %j', (value) => {
    expect(() => WarehouseName.create(value)).toThrow(InvalidNameError);
  });
});
