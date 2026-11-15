import { describe, expect, it } from 'vitest';

import { ApplicationError, type ErrorDetails } from './application.error';
import {
  CorruptedMapStateError,
  MapVersionConflictError,
  WarehouseMapNotFoundError,
  WarehouseNotFoundError,
} from './application.errors';

class SampleApplicationError extends ApplicationError {
  constructor(details?: ErrorDetails, cause?: Error) {
    super('MAP_NOT_FOUND', 'Sample failed', details, cause);
  }
}

describe('ApplicationError', () => {
  it('copies and freezes details and leaves them undefined when omitted', () => {
    const source = { mapId: 'map-1', found: false, note: 'missing', empty: null };
    const error = new SampleApplicationError(source);

    source.mapId = 'changed';

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error).toBeInstanceOf(SampleApplicationError);
    expect(error.name).toBe('SampleApplicationError');
    expect(error.message).toBe('Sample failed');
    expect(error.code).toBe('MAP_NOT_FOUND');
    expect(error.details).toEqual({ mapId: 'map-1', found: false, note: 'missing', empty: null });
    expect(error.details).not.toBe(source);
    expect(Object.isFrozen(error.details)).toBe(true);

    expect(new SampleApplicationError().details).toBeUndefined();
  });

  it('keeps the original cause and stays without one when it is omitted', () => {
    const cause = new Error('domain failed');
    const error = new SampleApplicationError({ mapId: 'map-1' }, cause);

    expect(error.cause).toBe(cause);
    expect(new SampleApplicationError({ mapId: 'map-1' }).cause).toBeUndefined();
  });

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
});
