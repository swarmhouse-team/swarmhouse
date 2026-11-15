import { describe, expect, it } from 'vitest';

import { StationType } from '../../domain/enums/station-type';
import { WarehouseMap, type WarehouseMapSnapshot } from '../../domain/entities/warehouse-map';
import {
  CellOccupiedError,
  DuplicateObjectIdError,
  DuplicateStationNameError,
} from '../../domain/errors/map.errors';
import { InvalidIdError } from '../../domain/errors/value.errors';
import { Position } from '../../domain/vo/position';
import { CorruptedMapStateError } from '../errors/application.errors';
import { restoreWarehouseMap } from './restore-warehouse-map';

function causeOf(snapshot: WarehouseMapSnapshot): unknown {
  try {
    restoreWarehouseMap(snapshot);
  } catch (error) {
    return (error as CorruptedMapStateError).cause;
  }
  return undefined;
}

function emptySnapshot(): WarehouseMapSnapshot {
  return WarehouseMap.create('map-1', 'wh-1').snapshot();
}

function filledSnapshot(): WarehouseMapSnapshot {
  const map = WarehouseMap.create('map-1', 'wh-1');
  map.addObstacle(Position.create(1, 1));
  map.placeRobot('rb-1', 'Robot', Position.create(2, 2));
  map.placeStation('st-1', 'Receiving', StationType.Receiving, Position.create(3, 3));
  return map.snapshot();
}

describe('restoreWarehouseMap', () => {
  it('restores an empty map and does not change the source snapshot', () => {
    const snapshot = emptySnapshot();
    const before = structuredClone(snapshot);

    const restored = restoreWarehouseMap(snapshot);
    restored.addObstacle(Position.create(4, 4));

    expect(restored.snapshot()).toMatchObject({
      id: 'map-1',
      warehouseId: 'wh-1',
      width: 20,
      height: 20,
      obstacles: [{ x: 4, y: 4 }],
      stations: [],
      robots: [],
    });
    expect(snapshot).toEqual(before);
  });

  it('round-trips obstacles, robots, and stations', () => {
    const snapshot = filledSnapshot();
    const before = structuredClone(snapshot);

    expect(restoreWarehouseMap(snapshot).snapshot()).toEqual(snapshot);
    expect(snapshot).toEqual(before);
  });

  it('rejects a size other than 20x20', () => {
    const snapshot = emptySnapshot();
    snapshot.width = 10;

    try {
      restoreWarehouseMap(snapshot);
      throw new Error('Expected corrupted state');
    } catch (error) {
      expect(error).toBeInstanceOf(CorruptedMapStateError);
      expect((error as CorruptedMapStateError).details).toEqual({
        mapId: 'map-1',
        reason: 'GRID_SIZE_MISMATCH',
      });
      expect((error as CorruptedMapStateError).cause).toBeUndefined();
    }
  });

  it('rejects an unknown station type', () => {
    const snapshot = filledSnapshot();
    const station = snapshot.stations[0];
    if (!station) {
      throw new Error('Station is missing');
    }
    station.type = 'packing' as StationType;

    expect(() => restoreWarehouseMap(snapshot)).toThrow(CorruptedMapStateError);
    try {
      restoreWarehouseMap(snapshot);
    } catch (error) {
      expect((error as CorruptedMapStateError).details).toEqual({
        mapId: 'map-1',
        reason: 'UNKNOWN_STATION_TYPE',
      });
    }
  });

  it('rejects a name that is not already trimmed', () => {
    const snapshot = filledSnapshot();
    const robot = snapshot.robots[0];
    if (!robot) {
      throw new Error('Robot is missing');
    }
    robot.name = ' Robot';

    try {
      restoreWarehouseMap(snapshot);
      throw new Error('Expected corrupted state');
    } catch (error) {
      expect(error).toBeInstanceOf(CorruptedMapStateError);
      expect((error as CorruptedMapStateError).details).toEqual({
        mapId: 'map-1',
        reason: 'DENORMALIZED_NAME',
      });
      expect((error as CorruptedMapStateError).cause).toBeUndefined();
    }
  });

  it('wraps a domain error from an invalid id', () => {
    const snapshot = emptySnapshot();
    snapshot.id = ' map';

    try {
      restoreWarehouseMap(snapshot);
      throw new Error('Expected corrupted state');
    } catch (error) {
      expect(error).toBeInstanceOf(CorruptedMapStateError);
      expect((error as CorruptedMapStateError).details).toMatchObject({
        reason: 'DOMAIN_INVARIANT',
      });
      expect((error as CorruptedMapStateError).cause).toBeInstanceOf(InvalidIdError);
    }
  });

  it('wraps a domain error when two objects share a cell', () => {
    const snapshot = filledSnapshot();
    const robot = snapshot.robots[0];
    const obstacle = snapshot.obstacles[0];
    if (!robot || !obstacle) {
      throw new Error('Objects are missing');
    }
    robot.x = obstacle.x;
    robot.y = obstacle.y;

    try {
      restoreWarehouseMap(snapshot);
      throw new Error('Expected corrupted state');
    } catch (error) {
      expect((error as CorruptedMapStateError).details).toMatchObject({
        reason: 'DOMAIN_INVARIANT',
      });
      expect((error as CorruptedMapStateError).cause).toBeInstanceOf(CellOccupiedError);
    }
  });

  it('wraps a domain error for a duplicate object id and a position outside the map', () => {
    const duplicate = filledSnapshot();
    duplicate.stations.push({
      id: 'rb-1',
      name: 'Other',
      type: StationType.Issuing,
      x: 4,
      y: 4,
    });
    expect(causeOf(duplicate)).toBeInstanceOf(DuplicateObjectIdError);

    const sameName = filledSnapshot();
    sameName.stations.push({
      id: 'st-2',
      name: 'receiving',
      type: StationType.Issuing,
      x: 5,
      y: 5,
    });
    expect(causeOf(sameName)).toBeInstanceOf(DuplicateStationNameError);

    const outside = emptySnapshot();
    outside.obstacles.push({ x: 20, y: 0 });
    try {
      restoreWarehouseMap(outside);
      throw new Error('Expected corrupted state');
    } catch (error) {
      expect((error as CorruptedMapStateError).cause).toBeInstanceOf(Error);
      expect((error as CorruptedMapStateError).details).toMatchObject({
        reason: 'DOMAIN_INVARIANT',
      });
    }
  });
});
