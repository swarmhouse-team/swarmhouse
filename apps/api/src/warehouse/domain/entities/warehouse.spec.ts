import { describe, expect, it } from 'vitest';

import { InvalidIdError, InvalidNameError } from '../errors/value.errors';
import { Warehouse } from './warehouse';

describe('Warehouse', () => {
  it('creates a warehouse with a checked id and a trimmed name', () => {
    const warehouse = Warehouse.create('wh-1', '  Main  ');

    expect(warehouse.id).toBe('wh-1');
    expect(warehouse.name.value).toBe('Main');
  });

  it.each(['', '   ', ' wh'])('rejects id %j', (id) => {
    expect(() => Warehouse.create(id, 'Warehouse')).toThrow(InvalidIdError);
  });

  it('rejects an empty name', () => {
    expect(() => Warehouse.create('wh-1', '   ')).toThrow(InvalidNameError);
  });
});
