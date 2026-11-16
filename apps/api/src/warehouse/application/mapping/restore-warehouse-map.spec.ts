import { describe, expect, it } from 'vitest';

import { StationType } from '../../domain/enums/station-type';
import { WarehouseMap, type WarehouseMapSnapshot } from '../../domain/entities/warehouse-map';
import type { WarehouseMapRestoreInput } from './warehouse-map-restore-input';
import {
  CellOccupiedError,
  DuplicateObjectIdError,
  DuplicateStationNameError,
} from '../../domain/errors/map.errors';
import { InvalidIdError } from '../../domain/errors/value.errors';
import { Position } from '../../domain/vo/position';
import { CorruptedMapStateError } from '../errors/application.errors';
import { restoreWarehouseMap } from './restore-warehouse-map';

const WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';
const MAP_ID = '22222222-2222-7111-8111-22222222222b';
const ROBOT_ID = '33333333-3333-4111-8111-33333333333c';
const STATION_ID = '44444444-4444-4111-8111-44444444444e';
const STATION_2_ID = '44444444-4444-4111-a111-444444444445';

function causeOf(input: WarehouseMapRestoreInput): unknown {
  try {
    restoreWarehouseMap(input);
  } catch (error) {
    return (error as CorruptedMapStateError).cause;
  }
  return undefined;
}

function emptySnapshot(): WarehouseMapSnapshot {
  return WarehouseMap.create(MAP_ID, WAREHOUSE_ID).snapshot();
}

function filledSnapshot(): WarehouseMapSnapshot {
  const map = WarehouseMap.create(MAP_ID, WAREHOUSE_ID);
  map.addObstacle(Position.create(1, 1));
  map.placeRobot(ROBOT_ID, 'Robot', Position.create(2, 2));
  map.placeStation(STATION_ID, 'Receiving', StationType.Receiving, Position.create(3, 3));
  return map.snapshot();
}

describe('restoreWarehouseMap', () => {
  it('restores an empty map and does not change the source snapshot', () => {
    const snapshot = emptySnapshot();
    const before = structuredClone(snapshot);

    const restored = restoreWarehouseMap(snapshot);
    restored.addObstacle(Position.create(4, 4));

    expect(restored.snapshot()).toMatchObject({
      id: MAP_ID,
      warehouseId: WAREHOUSE_ID,
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
    const input: WarehouseMapRestoreInput = snapshot;

    expect(restoreWarehouseMap(input).snapshot()).toEqual(snapshot);
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
        mapId: MAP_ID,
        reason: 'GRID_SIZE_MISMATCH',
      });
      expect((error as CorruptedMapStateError).cause).toBeUndefined();
    }
  });

  it('rejects an unknown station type', () => {
    const source = filledSnapshot();
    const station = source.stations[0];
    if (!station) {
      throw new Error('Station is missing');
    }
    const input: WarehouseMapRestoreInput = {
      ...source,
      stations: [{ ...station, type: 'packing' }],
    };

    expect(() => restoreWarehouseMap(input)).toThrow(CorruptedMapStateError);
    try {
      restoreWarehouseMap(input);
    } catch (error) {
      expect((error as CorruptedMapStateError).details).toEqual({
        mapId: MAP_ID,
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
        mapId: MAP_ID,
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
      id: ROBOT_ID,
      name: 'Other',
      type: StationType.Issuing,
      x: 4,
      y: 4,
    });
    expect(causeOf(duplicate)).toBeInstanceOf(DuplicateObjectIdError);

    const sameName = filledSnapshot();
    sameName.stations.push({
      id: STATION_2_ID,
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

  it('normalizes a stored uuid and finds the object in another case', () => {
    const snapshot = emptySnapshot();
    snapshot.robots = [{ id: ROBOT_ID.toUpperCase(), name: 'Robot', x: 2, y: 2 }];

    const map = restoreWarehouseMap(snapshot);
    map.moveRobot(ROBOT_ID, Position.create(4, 4));

    expect(map.snapshot().robots).toEqual([{ id: ROBOT_ID, name: 'Robot', x: 4, y: 4 }]);
    expect(map.warehouseId).toBe(WAREHOUSE_ID);
  });

  it('rejects the same stored uuid written in another case', () => {
    const snapshot = emptySnapshot();
    snapshot.robots = [
      { id: ROBOT_ID, name: 'First', x: 0, y: 0 },
      { id: ROBOT_ID.toUpperCase(), name: 'Second', x: 1, y: 0 },
    ];

    expect(causeOf(snapshot)).toBeInstanceOf(DuplicateObjectIdError);
  });
});
