import { describe, expect, it } from 'vitest';

import { StationType } from '../enums/station-type';
import {
  CellOccupiedError,
  DuplicateObjectIdError,
  DuplicateStationNameError,
  MapObjectNotFoundError,
  PositionOutOfBoundsError,
} from '../errors/map.errors';
import { InvalidIdError } from '../errors/value.errors';
import { Position } from '../vo/position';
import { Robot } from './robot';
import { Station } from './station';
import { WarehouseMap, type WarehouseMapSnapshot } from './warehouse-map';

function at(x: number, y: number): Position {
  return Position.create(x, y);
}

function createMap(): WarehouseMap {
  return WarehouseMap.create('map-1', 'wh-1');
}

function occupy(
  map: WarehouseMap,
  kind: 'robot' | 'station' | 'obstacle',
  position: Position,
): void {
  if (kind === 'robot') {
    map.placeRobot('occupied', 'Occupied', position);
    return;
  }
  if (kind === 'station') {
    map.placeStation('occupied', 'Occupied', StationType.Receiving, position);
    return;
  }
  map.addObstacle(position);
}

function placeIncoming(
  map: WarehouseMap,
  kind: 'robot' | 'station' | 'obstacle',
  position: Position,
): void {
  if (kind === 'robot') {
    map.placeRobot('incoming', 'Incoming', position);
    return;
  }
  if (kind === 'station') {
    map.placeStation('incoming', 'Incoming', StationType.Issuing, position);
    return;
  }
  map.addObstacle(position);
}

describe('WarehouseMap', () => {
  it('creates an empty 20x20 map', () => {
    const map = createMap();

    expect(map.snapshot()).toEqual({
      id: 'map-1',
      warehouseId: 'wh-1',
      width: 20,
      height: 20,
      obstacles: [],
      stations: [],
      robots: [],
    } satisfies WarehouseMapSnapshot);
  });

  it.each(['', '   ', ' map'])('rejects map id %j', (id) => {
    expect(() => WarehouseMap.create(id, 'wh-1')).toThrow(InvalidIdError);
  });

  it.each(['', '   ', ' wh'])('rejects warehouseId %j', (warehouseId) => {
    expect(() => WarehouseMap.create('map-1', warehouseId)).toThrow(InvalidIdError);
  });

  it('places an object on the last cell 19,19', () => {
    const map = createMap();

    map.addObstacle(at(19, 19));

    expect(map.snapshot().obstacles).toEqual([{ x: 19, y: 19 }]);
  });

  it.each([
    [20, 0],
    [0, 20],
  ])('rejects placement at (%s, %s)', (x, y) => {
    const map = createMap();
    const before = map.snapshot();

    expect(() => map.addObstacle(at(x, y))).toThrow(PositionOutOfBoundsError);
    expect(() => map.placeRobot('rb-1', 'Robot', at(x, y))).toThrow(PositionOutOfBoundsError);
    expect(() => map.placeStation('st-1', 'Receiving', StationType.Receiving, at(x, y))).toThrow(
      PositionOutOfBoundsError,
    );
    expect(map.snapshot()).toEqual(before);
  });

  it.each(['robot', 'station', 'obstacle'] as const)(
    'does not place a %s on a cell occupied by any object',
    (incoming) => {
      for (const occupied of ['robot', 'station', 'obstacle'] as const) {
        const map = createMap();
        const cell = at(1, 1);
        occupy(map, occupied, cell);
        const before = map.snapshot();

        expect(() => placeIncoming(map, incoming, cell)).toThrow(CellOccupiedError);
        expect(map.snapshot()).toEqual(before);
      }
    },
  );

  it('rejects a second obstacle on the same cell', () => {
    const map = createMap();
    map.addObstacle(at(2, 2));
    const before = map.snapshot();

    expect(() => map.addObstacle(at(2, 2))).toThrow(CellOccupiedError);
    expect(map.snapshot()).toEqual(before);
  });

  it('rejects the same id on two robots and on a robot and a station', () => {
    const map = createMap();
    map.placeRobot('same', 'First', at(0, 0));
    map.placeStation('station', 'Receiving', StationType.Receiving, at(1, 0));
    const before = map.snapshot();

    expect(() => map.placeRobot('same', 'Second', at(2, 0))).toThrow(DuplicateObjectIdError);
    expect(() => map.placeStation('same', 'Issuing', StationType.Issuing, at(3, 0))).toThrow(
      DuplicateObjectIdError,
    );
    expect(map.snapshot()).toEqual(before);
  });

  it('rejects station names that match after trim regardless of case', () => {
    const map = createMap();
    map.placeStation('st-1', 'Приёмка', StationType.Receiving, at(0, 0));
    const before = map.snapshot();

    expect(() => map.placeStation('st-2', ' приёмка ', StationType.Issuing, at(1, 0))).toThrow(
      DuplicateStationNameError,
    );
    expect(map.snapshot()).toEqual(before);
  });

  it('places a robot and a station and trims their names', () => {
    const map = createMap();

    map.placeRobot('rb-1', '  Robot  ', at(0, 1));
    map.placeStation('st-1', ' Issuing ', StationType.Issuing, at(0, 2));

    expect(map.snapshot().robots).toEqual([{ id: 'rb-1', name: 'Robot', x: 0, y: 1 }]);
    expect(map.snapshot().stations).toEqual([
      { id: 'st-1', name: 'Issuing', type: StationType.Issuing, x: 0, y: 2 },
    ]);
  });

  it('moves an object and frees its previous cell', () => {
    const map = createMap();
    map.placeRobot('rb-1', 'Robot', at(0, 0));
    map.placeStation('st-1', 'Receiving', StationType.Receiving, at(1, 0));
    map.addObstacle(at(2, 0));

    map.moveRobot('rb-1', at(0, 1));
    map.moveStation('st-1', at(1, 1));
    map.moveObstacle(at(2, 0), at(2, 1));
    map.addObstacle(at(0, 0));
    map.placeRobot('rb-2', 'Second', at(1, 0));
    map.placeStation('st-2', 'Issuing', StationType.Issuing, at(2, 0));

    expect(map.snapshot()).toMatchObject({
      robots: [
        { id: 'rb-1', x: 0, y: 1 },
        { id: 'rb-2', x: 1, y: 0 },
      ],
      stations: [
        { id: 'st-1', x: 1, y: 1 },
        { id: 'st-2', x: 2, y: 0 },
      ],
      obstacles: [
        { x: 2, y: 1 },
        { x: 0, y: 0 },
      ],
    });
  });

  it('moving an object onto its own cell changes nothing', () => {
    const map = createMap();
    map.placeRobot('rb-1', 'Robot', at(4, 4));
    map.placeStation('st-1', 'Receiving', StationType.Intermediate, at(5, 5));
    map.addObstacle(at(6, 6));
    const before = map.snapshot();

    map.moveRobot('rb-1', at(4, 4));
    map.moveStation('st-1', at(5, 5));
    map.moveObstacle(at(6, 6), at(6, 6));

    expect(map.snapshot()).toEqual(before);
  });

  it('a failed move leaves the map unchanged', () => {
    const map = createMap();
    map.placeRobot('rb-1', 'Robot', at(0, 0));
    map.placeStation('st-1', 'Receiving', StationType.Receiving, at(1, 0));
    map.addObstacle(at(2, 0));
    const before = map.snapshot();

    expect(() => map.moveRobot('rb-1', at(20, 0))).toThrow(PositionOutOfBoundsError);
    expect(() => map.moveRobot('rb-1', at(1, 0))).toThrow(CellOccupiedError);
    expect(() => map.moveRobot('missing', at(3, 0))).toThrow(MapObjectNotFoundError);
    expect(() => map.moveStation('st-1', at(2, 0))).toThrow(CellOccupiedError);
    expect(() => map.moveStation('missing', at(3, 0))).toThrow(MapObjectNotFoundError);
    expect(() => map.moveObstacle(at(2, 0), at(0, 20))).toThrow(PositionOutOfBoundsError);
    expect(() => map.moveObstacle(at(3, 3), at(4, 4))).toThrow(MapObjectNotFoundError);

    expect(map.snapshot()).toEqual(before);
  });

  it('removal frees the cell, id, and name', () => {
    const map = createMap();
    map.placeRobot('rb-1', 'Robot', at(0, 0));
    map.placeStation('st-1', 'Receiving', StationType.Receiving, at(1, 0));
    map.addObstacle(at(2, 0));

    map.removeRobot('rb-1');
    map.removeStation('st-1');
    map.removeObstacle(at(2, 0));

    map.placeRobot('rb-1', 'Robot', at(0, 0));
    map.placeStation('st-1', ' receiving ', StationType.Issuing, at(1, 0));
    map.addObstacle(at(2, 0));

    expect(map.snapshot().robots).toHaveLength(1);
    expect(map.snapshot().stations[0]).toMatchObject({ id: 'st-1', name: 'receiving' });
    expect(map.snapshot().obstacles).toEqual([{ x: 2, y: 0 }]);
  });

  it('removing a missing object does not change the map', () => {
    const map = createMap();
    map.placeRobot('rb-1', 'Robot', at(0, 0));
    const before = map.snapshot();

    expect(() => map.removeRobot('missing')).toThrow(MapObjectNotFoundError);
    expect(() => map.removeStation('missing')).toThrow(MapObjectNotFoundError);
    expect(() => map.removeObstacle(at(3, 3))).toThrow(MapObjectNotFoundError);
    expect(map.snapshot()).toEqual(before);
  });

  it('mutating a snapshot or a returned collection does not change the map', () => {
    const map = createMap();
    map.placeRobot('rb-1', 'Robot', at(0, 0));
    map.placeStation('st-1', 'Receiving', StationType.Receiving, at(1, 0));
    map.addObstacle(at(2, 0));
    const before = map.snapshot();

    const snapshot = map.snapshot();
    const robotSnapshot = snapshot.robots[0];
    const stationSnapshot = snapshot.stations[0];
    if (!robotSnapshot || !stationSnapshot) {
      throw new Error('Snapshot is empty');
    }
    robotSnapshot.x = 9;
    stationSnapshot.name = 'Other';
    snapshot.robots.push({ id: 'rb-2', name: 'Extra', x: 3, y: 3 });
    snapshot.obstacles.splice(0, 1);

    (map.getRobots() as Robot[]).splice(0, 1);
    (map.getStations() as Station[]).splice(0, 1);
    (map.getObstacles() as Position[]).pop();

    expect(map.snapshot()).toEqual(before);
  });

  it('returned robot and position are frozen; only map operations can move them', () => {
    const map = createMap();
    map.placeRobot('rb-1', 'Robot', at(0, 0));
    map.addObstacle(at(1, 0));
    const before = map.snapshot();
    const robot = map.getRobots()[0];
    if (!robot) {
      throw new Error('Robot was not placed');
    }

    expect(Object.isFrozen(robot)).toBe(true);
    expect(Object.isFrozen(robot.position)).toBe(true);
    expect(() => {
      (robot as { id: string }).id = 'hacked';
    }).toThrow(TypeError);
    robot.withPosition(at(1, 0));

    expect(map.snapshot()).toEqual(before);
    expect(() => map.moveRobot('rb-1', at(1, 0))).toThrow(CellOccupiedError);
    expect(() => map.moveRobot('rb-1', at(20, 0))).toThrow(PositionOutOfBoundsError);
    expect(map.snapshot()).toEqual(before);
  });
});
