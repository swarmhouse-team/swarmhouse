import { describe, expect, it } from 'vitest';

import { ApplicationError } from '../../../../common/application/application.error';
import {
  CorruptedMapStateError,
  MapVersionConflictError,
  WarehouseMapNotFoundError,
  WarehouseNotFoundError,
} from './application.errors';

describe('warehouse application errors', () => {
  it.each([
    {
      create: () => new WarehouseMapNotFoundError({ mapId: 'map-1' }),
      name: 'WarehouseMapNotFoundError',
      code: 'MAP_NOT_FOUND' as const,
      details: { mapId: 'map-1' },
    },
    {
      create: () => new WarehouseMapNotFoundError({ warehouseId: 'wh-1' }),
      name: 'WarehouseMapNotFoundError',
      code: 'MAP_NOT_FOUND' as const,
      details: { warehouseId: 'wh-1' },
    },
    {
      create: () =>
        new MapVersionConflictError({
          mapId: 'map-1',
          expectedVersion: 1,
          actualVersion: 2,
        }),
      name: 'MapVersionConflictError',
      code: 'MAP_VERSION_CONFLICT' as const,
      details: { mapId: 'map-1', expectedVersion: 1, actualVersion: 2 },
    },
    {
      create: () => new WarehouseNotFoundError({ warehouseId: 'wh-1' }),
      name: 'WarehouseNotFoundError',
      code: 'WAREHOUSE_NOT_FOUND' as const,
      details: { warehouseId: 'wh-1' },
    },
    {
      create: () => new CorruptedMapStateError('map-1', 'GRID_SIZE_MISMATCH'),
      name: 'CorruptedMapStateError',
      code: 'CORRUPTED_MAP_STATE' as const,
      details: { mapId: 'map-1', reason: 'GRID_SIZE_MISMATCH' },
    },
    {
      create: () => new CorruptedMapStateError('map-1', 'INVALID_STORED_FORMAT'),
      name: 'CorruptedMapStateError',
      code: 'CORRUPTED_MAP_STATE' as const,
      details: { mapId: 'map-1', reason: 'INVALID_STORED_FORMAT' },
    },
  ])('$name exposes $code and its details', ({ create, name, code, details }) => {
    const error = create();

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.name).toBe(name);
    expect(error.message.length).toBeGreaterThan(0);
    expect(error.code).toBe(code);
    expect(error.details).toEqual(details);
    expect(Object.isFrozen(error.details)).toBe(true);
    expect(error.cause).toBeUndefined();
  });

  it('keeps the original domain error as the cause of a corrupted map', () => {
    const cause = new Error('Cell is occupied');
    const error = new CorruptedMapStateError('map-1', 'DOMAIN_INVARIANT', cause);

    expect(error.cause).toBe(cause);
    expect(error.details).toEqual({ mapId: 'map-1', reason: 'DOMAIN_INVARIANT' });
  });

  it('keeps the original parse error as the cause of an invalid stored format', () => {
    const cause = new Error('content is not an object');
    const error = new CorruptedMapStateError('map-1', 'INVALID_STORED_FORMAT', cause);

    expect(error.cause).toBe(cause);
    expect(error.details).toEqual({ mapId: 'map-1', reason: 'INVALID_STORED_FORMAT' });
  });
});
