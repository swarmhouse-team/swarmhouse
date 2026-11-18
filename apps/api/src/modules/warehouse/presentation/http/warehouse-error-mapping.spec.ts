import { apiErrorSchema, mapVersionConflictErrorSchema } from '@robots/shared';
import { describe, expect, it } from 'vitest';

import { ApplicationError } from '../../../../common/application/application.error';
import { DomainError } from '../../../../common/domain/domain.error';
import { mapThrownError } from '../../../../common/http/map-thrown-error';
import {
  CorruptedMapStateError,
  MapVersionConflictError,
  WarehouseMapNotFoundError,
  WarehouseNotFoundError,
} from '../../application/errors/application.errors';
import {
  CellOccupiedError,
  DuplicateObjectIdError,
  DuplicateRobotNameError,
  DuplicateStationNameError,
  MapObjectNotFoundError,
  PositionOutOfBoundsError,
} from '../../domain/errors/map.errors';
import {
  InvalidGridSizeError,
  InvalidIdError,
  InvalidNameError,
  InvalidPositionError,
} from '../../domain/errors/value.errors';

const WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';
const MAP_ID = '22222222-2222-7111-8111-22222222222b';

class UnexpectedWarehouseError extends ApplicationError {
  constructor() {
    super('WAREHOUSE_NOT_FOUND', 'postgres://user:secret@db', { warehouseId: WAREHOUSE_ID });
  }
}

function mapped(exception: ApplicationError | DomainError) {
  const result = mapThrownError(exception);
  if (result === undefined) {
    throw new Error('expected a mapping');
  }
  return result;
}

describe('warehouse errors through the shared mapper', () => {
  it('missing warehouse → 404 WAREHOUSE_NOT_FOUND', () => {
    const { status, body, log } = mapped(
      new WarehouseNotFoundError({ warehouseId: WAREHOUSE_ID }),
    );

    expect(status).toBe(404);
    expect(body).toEqual({
      code: 'WAREHOUSE_NOT_FOUND',
      message: 'Warehouse was not found',
    });
    expect(apiErrorSchema.parse(body)).toEqual(body);
    expect(JSON.stringify(body)).not.toContain(WAREHOUSE_ID);
    expect(log).toBeUndefined();
  });

  it('missing map → 404 MAP_NOT_FOUND', () => {
    const { status, body, log } = mapped(new WarehouseMapNotFoundError({ mapId: MAP_ID }));

    expect(status).toBe(404);
    expect(body).toEqual({
      code: 'MAP_NOT_FOUND',
      message: 'Warehouse map was not found',
    });
    expect(apiErrorSchema.parse(body)).toEqual(body);
    expect(JSON.stringify(body)).not.toContain(MAP_ID);
    expect(log).toBeUndefined();
  });

  it('version conflict → 409 without versions or internal details', () => {
    const { status, body, log } = mapped(
      new MapVersionConflictError({ mapId: MAP_ID, expectedVersion: 1, actualVersion: 4 }),
    );

    expect(status).toBe(409);
    expect(body).toEqual({
      code: 'MAP_VERSION_CONFLICT',
      message: 'The map version is stale. Read the map again and repeat the command.',
    });
    expect(mapVersionConflictErrorSchema.parse(body)).toEqual(body);
    expect(apiErrorSchema.parse(body)).toEqual(body);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('expectedVersion');
    expect(serialized).not.toContain('actualVersion');
    expect(serialized).not.toContain(MAP_ID);
    expect(log).toBeUndefined();
  });

  it.each([
    {
      error: new InvalidIdError('wh-1'),
      code: 'INVALID_ID',
      message: 'Invalid id',
      hidden: 'wh-1',
    },
    {
      error: new InvalidPositionError(1.5, -1),
      code: 'INVALID_POSITION',
      message: 'Invalid position',
      hidden: '1.5',
    },
    {
      error: new InvalidGridSizeError(0, 20),
      code: 'INVALID_GRID_SIZE',
      message: 'Invalid grid size',
      hidden: '"width"',
    },
    {
      error: new InvalidNameError('   '),
      code: 'INVALID_NAME',
      message: 'Invalid name',
      hidden: '"value"',
    },
    {
      error: new PositionOutOfBoundsError(20, 0),
      code: 'POSITION_OUT_OF_BOUNDS',
      message: 'Position is outside the map',
      hidden: '"x"',
    },
    {
      error: new CellOccupiedError(2, 3),
      code: 'CELL_OCCUPIED',
      message: 'Cell is occupied',
      hidden: '"y"',
    },
    {
      error: new DuplicateObjectIdError(MAP_ID),
      code: 'DUPLICATE_OBJECT_ID',
      message: 'Object id is already used',
      hidden: MAP_ID,
    },
    {
      error: new DuplicateRobotNameError('loader'),
      code: 'DUPLICATE_ROBOT_NAME',
      message: 'Robot name is already used',
      hidden: 'loader',
    },
    {
      error: new DuplicateStationNameError('dock'),
      code: 'DUPLICATE_STATION_NAME',
      message: 'Station name is already used',
      hidden: 'dock',
    },
    {
      error: new MapObjectNotFoundError('robot'),
      code: 'MAP_OBJECT_NOT_FOUND',
      message: 'Map object was not found',
      hidden: 'robot',
    },
  ])('$code → 422 without internal details', ({ error, code, message, hidden }) => {
    const { status, body, log } = mapped(error);

    expect(status).toBe(422);
    expect(body).toEqual({ code, message });
    expect(apiErrorSchema.parse(body)).toEqual(body);
    expect(JSON.stringify(body)).not.toContain(hidden);
    expect(log).toBeUndefined();
  });

  it('corrupted map → 500 without mapId, reason, cause, or stack', () => {
    const cause = new Error('postgres://user:secret@db');
    const { status, body, log } = mapped(
      new CorruptedMapStateError(MAP_ID, 'INVALID_STORED_FORMAT', cause),
    );

    expect(status).toBe(500);
    expect(body).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
    expect(apiErrorSchema.parse(body)).toEqual(body);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(MAP_ID);
    expect(serialized).not.toContain('INVALID_STORED_FORMAT');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('stack');
    expect(log).toEqual({
      errorClass: 'CorruptedMapStateError',
      mapId: MAP_ID,
      reason: 'INVALID_STORED_FORMAT',
    });
    expect(JSON.stringify(log)).not.toContain('secret');
    expect(JSON.stringify(log)).not.toContain('postgres');
  });

  it('unknown ApplicationError → 500 without the original message', () => {
    const { status, body, log } = mapped(new UnexpectedWarehouseError());

    expect(status).toBe(500);
    expect(body).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
    expect(apiErrorSchema.parse(body)).toEqual(body);
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(JSON.stringify(body)).not.toContain(WAREHOUSE_ID);
    expect(log).toEqual({ errorClass: 'UnexpectedWarehouseError' });
    expect(JSON.stringify(log)).not.toContain('secret');
    expect(JSON.stringify(log)).not.toContain(WAREHOUSE_ID);
    expect(JSON.stringify(log)).not.toContain('postgres');
  });
});
