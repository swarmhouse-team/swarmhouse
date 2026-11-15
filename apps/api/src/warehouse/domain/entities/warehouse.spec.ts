import { describe, expect, it } from 'vitest';

import { InvalidIdError, InvalidNameError } from '../errors/value.errors';
import { MAX_NAME_LENGTH } from '../vo/name';
import { Warehouse } from './warehouse';

const WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';

describe('Warehouse', () => {
  it('creates a warehouse with a checked id and a trimmed name', () => {
    const warehouse = Warehouse.create(WAREHOUSE_ID.toUpperCase(), '  Main  ');

    expect(warehouse.id).toBe(WAREHOUSE_ID);
    expect(warehouse.name.value).toBe('Main');
  });

  it.each(['', '   ', ' wh'])('rejects id %j', (id) => {
    expect(() => Warehouse.create(id, 'Warehouse')).toThrow(InvalidIdError);
  });

  it('rejects an empty name', () => {
    expect(() => Warehouse.create(WAREHOUSE_ID, '   ')).toThrow(InvalidNameError);
  });

  it('renames a warehouse and keeps the previous instance', () => {
    const warehouse = Warehouse.create(WAREHOUSE_ID, 'Main');

    const renamed = warehouse.rename('  North  ');

    expect(renamed).not.toBe(warehouse);
    expect(renamed.id).toBe(WAREHOUSE_ID);
    expect(renamed.name.value).toBe('North');
    expect(warehouse.name.value).toBe('Main');
  });

  it.each(['   ', 'x'.repeat(MAX_NAME_LENGTH + 1)])('rejects rename %j', (name) => {
    const warehouse = Warehouse.create(WAREHOUSE_ID, 'Main');

    expect(() => warehouse.rename(name)).toThrow(InvalidNameError);
    expect(warehouse.name.value).toBe('Main');
  });
});
