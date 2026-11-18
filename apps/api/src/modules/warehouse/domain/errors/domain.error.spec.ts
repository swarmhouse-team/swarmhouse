import { describe, expect, it } from 'vitest';

import { DomainError } from '../../../../common/domain/domain.error';
import {
  CellOccupiedError,
  DuplicateObjectIdError,
  DuplicateRobotNameError,
  DuplicateStationNameError,
  MapObjectNotFoundError,
  PositionOutOfBoundsError,
} from './map.errors';
import {
  InvalidGridSizeError,
  InvalidIdError,
  InvalidNameError,
  InvalidPositionError,
} from './value.errors';

describe('warehouse domain errors', () => {
  it.each([
    {
      create: () => new InvalidIdError(' '),
      name: 'InvalidIdError',
      message: 'Invalid id',
      code: 'INVALID_ID' as const,
      details: { value: ' ' },
      fields: { value: ' ' },
    },
    {
      create: () => new InvalidPositionError(1.5, -1),
      name: 'InvalidPositionError',
      message: 'Invalid position',
      code: 'INVALID_POSITION' as const,
      details: { x: 1.5, y: -1 },
      fields: { x: 1.5, y: -1 },
    },
    {
      create: () => new InvalidGridSizeError(0, 1),
      name: 'InvalidGridSizeError',
      message: 'Invalid grid size',
      code: 'INVALID_GRID_SIZE' as const,
      details: { width: 0, height: 1 },
      fields: { width: 0, height: 1 },
    },
    {
      create: () => new InvalidNameError(''),
      name: 'InvalidNameError',
      message: 'Invalid name',
      code: 'INVALID_NAME' as const,
      details: { value: '' },
      fields: { value: '' },
    },
    {
      create: () => new PositionOutOfBoundsError(20, 0),
      name: 'PositionOutOfBoundsError',
      message: 'Position is outside the map',
      code: 'POSITION_OUT_OF_BOUNDS' as const,
      details: { x: 20, y: 0 },
      fields: { x: 20, y: 0 },
    },
    {
      create: () => new CellOccupiedError(2, 3),
      name: 'CellOccupiedError',
      message: 'Cell is occupied',
      code: 'CELL_OCCUPIED' as const,
      details: { x: 2, y: 3 },
      fields: { x: 2, y: 3 },
    },
    {
      create: () => new DuplicateObjectIdError('rb-1'),
      name: 'DuplicateObjectIdError',
      message: 'Object id is already used',
      code: 'DUPLICATE_OBJECT_ID' as const,
      details: { id: 'rb-1' },
      fields: { id: 'rb-1' },
    },
    {
      create: () => new DuplicateRobotNameError('loader'),
      name: 'DuplicateRobotNameError',
      message: 'Robot name is already used',
      code: 'DUPLICATE_ROBOT_NAME' as const,
      details: { robotName: 'loader' },
      fields: { robotName: 'loader' },
    },
    {
      create: () => new DuplicateStationNameError('receiving'),
      name: 'DuplicateStationNameError',
      message: 'Station name is already used',
      code: 'DUPLICATE_STATION_NAME' as const,
      details: { stationName: 'receiving' },
      fields: { stationName: 'receiving' },
    },
    {
      create: () => new MapObjectNotFoundError('robot'),
      name: 'MapObjectNotFoundError',
      message: 'Map object was not found',
      code: 'MAP_OBJECT_NOT_FOUND' as const,
      details: { objectKind: 'robot' },
      fields: { objectKind: 'robot' },
    },
  ])(
    '$name exposes its code, details, and public fields',
    ({ create, name, message, code, details, fields }) => {
      const error = create();

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DomainError);
      expect(error.name).toBe(name);
      expect(error.message).toBe(message);
      expect(error.code).toBe(code);
      expect(error.details).toEqual(details);
      expect(Object.isFrozen(error.details)).toBe(true);
      expect(error).toMatchObject(fields);
      expect(typeof error.stack).toBe('string');
    },
  );
});
