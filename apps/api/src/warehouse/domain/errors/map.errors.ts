import { DomainError } from './domain.error';

/** Position is outside the grid of a specific map. */
export class PositionOutOfBoundsError extends DomainError {
  constructor(
    readonly x: number,
    readonly y: number,
  ) {
    super('POSITION_OUT_OF_BOUNDS', 'Position is outside the map', { x, y });
  }
}

/** Cell is already occupied by another object. */
export class CellOccupiedError extends DomainError {
  constructor(
    readonly x: number,
    readonly y: number,
  ) {
    super('CELL_OCCUPIED', 'Cell is occupied', { x, y });
  }
}

/** ID is already used by a robot or a station on this map. */
export class DuplicateObjectIdError extends DomainError {
  constructor(readonly id: string) {
    super('DUPLICATE_OBJECT_ID', 'Object id is already used', { id });
  }
}

/** Normalized station name is already used on this map. */
export class DuplicateStationNameError extends DomainError {
  constructor(readonly stationName: string) {
    super('DUPLICATE_STATION_NAME', 'Station name is already used', { stationName });
  }
}

/** Move or remove targets an object that is not on the map. */
export class MapObjectNotFoundError extends DomainError {
  constructor(readonly objectKind: 'robot' | 'station' | 'obstacle') {
    super('MAP_OBJECT_NOT_FOUND', 'Map object was not found', { objectKind });
  }
}
