import { describe, expect, it } from 'vitest';

import {
  CellOccupiedError,
  DuplicateObjectIdError,
  DuplicateRobotNameError,
  DuplicateStationNameError,
  MapObjectNotFoundError,
  PositionOutOfBoundsError,
} from '../errors/map.errors';
import { InvalidIdError, InvalidPositionError } from '../errors/value.errors';
import { Position } from '../../../../common/domain/position';
import { Robot } from './robot';
import { Station } from './station';
import { WarehouseMap, type WarehouseMapSnapshot } from './warehouse-map';

const MAP_ID = '22222222-2222-7111-8111-22222222222b';
const WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';
const ROBOT_ID = '33333333-3333-4111-8111-33333333333c';
const ROBOT_2_ID = '33333333-3333-4111-a111-333333333334';
const STATION_ID = '44444444-4444-4111-8111-44444444444e';
const STATION_2_ID = '44444444-4444-4111-a111-444444444445';
const OCCUPIED_ID = '55555555-5555-4111-8111-55555555555a';
const INCOMING_ID = '66666666-6666-4111-8111-66666666666b';
const SAME_ID = '77777777-7777-4111-8111-77777777777c';
const ABSENT_ID = '88888888-8888-4111-8111-88888888888d';

function at(x: number, y: number): Position {
  return Position.create(x, y);
}

function createMap(): WarehouseMap {
  return WarehouseMap.create(MAP_ID, WAREHOUSE_ID);
}

function occupy(
  map: WarehouseMap,
  kind: 'robot' | 'station' | 'obstacle',
  position: Position,
): void {
  if (kind === 'robot') {
    map.placeRobot(OCCUPIED_ID, 'Occupied', position);
    return;
  }
  if (kind === 'station') {
    map.placeStation(OCCUPIED_ID, 'Occupied', position);
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
    map.placeRobot(INCOMING_ID, 'Incoming', position);
    return;
  }
  if (kind === 'station') {
    map.placeStation(INCOMING_ID, 'Incoming', position);
    return;
  }
  map.addObstacle(position);
}

describe('WarehouseMap', () => {
  it('creates an empty 20x20 map', () => {
    const map = createMap();

    expect(map.snapshot()).toEqual({
      id: MAP_ID,
      warehouseId: WAREHOUSE_ID,
      width: 20,
      height: 20,
      obstacles: [],
      stations: [],
      robots: [],
    } satisfies WarehouseMapSnapshot);
  });

  it.each(['', '   ', ' map'])('rejects map id %j', (id) => {
    expect(() => WarehouseMap.create(id, WAREHOUSE_ID)).toThrow(InvalidIdError);
  });

  it.each(['', '   ', ' wh'])('rejects warehouseId %j', (warehouseId) => {
    expect(() => WarehouseMap.create(MAP_ID, warehouseId)).toThrow(InvalidIdError);
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
    expect(() => map.placeRobot(ROBOT_ID, 'Robot', at(x, y))).toThrow(PositionOutOfBoundsError);
    expect(() => map.placeStation(STATION_ID, 'Receiving', at(x, y))).toThrow(
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
    map.placeRobot(SAME_ID, 'First', at(0, 0));
    map.placeStation(STATION_ID, 'Receiving', at(1, 0));
    const before = map.snapshot();

    expect(() => map.placeRobot(SAME_ID, 'Second', at(2, 0))).toThrow(DuplicateObjectIdError);
    expect(() => map.placeStation(SAME_ID, 'Issuing', at(3, 0))).toThrow(DuplicateObjectIdError);
    expect(map.snapshot()).toEqual(before);
  });

  it('rejects robot and station names ID and id regardless of the process locale', () => {
    const map = createMap();
    map.placeRobot(ROBOT_ID, 'ID', at(0, 0));
    map.placeStation(STATION_ID, 'ID', at(1, 0));
    const before = map.snapshot();

    expect(() => map.placeRobot(ROBOT_2_ID, 'id', at(2, 0))).toThrow(DuplicateRobotNameError);
    expect(() => map.placeStation(STATION_2_ID, 'id', at(3, 0))).toThrow(DuplicateStationNameError);
    expect(map.snapshot()).toEqual(before);
  });

  it('rejects robot names that match after trim regardless of case', () => {
    const map = createMap();
    map.placeRobot(ROBOT_ID, 'Приёмка', at(0, 0));
    const before = map.snapshot();

    expect(() => map.placeRobot(ROBOT_2_ID, ' приёмка ', at(1, 0))).toThrow(
      DuplicateRobotNameError,
    );
    expect(map.snapshot()).toEqual(before);
  });

  it('allows a robot and a station to share a name', () => {
    const map = createMap();

    map.placeRobot(ROBOT_ID, 'Dock', at(0, 0));
    map.placeStation(STATION_ID, 'dock', at(1, 0));

    expect(map.snapshot().robots[0]?.name).toBe('Dock');
    expect(map.snapshot().stations[0]?.name).toBe('dock');
  });

  it('rejects station names that match after trim regardless of case', () => {
    const map = createMap();
    map.placeStation(STATION_ID, 'Приёмка', at(0, 0));
    const before = map.snapshot();

    expect(() => map.placeStation(STATION_2_ID, ' приёмка ', at(1, 0))).toThrow(
      DuplicateStationNameError,
    );
    expect(map.snapshot()).toEqual(before);
  });

  it('places a robot and a station and trims their names', () => {
    const map = createMap();

    map.placeRobot(ROBOT_ID, '  Robot  ', at(0, 1));
    map.placeStation(STATION_ID, ' Issuing ', at(0, 2));

    expect(map.snapshot().robots).toEqual([{ id: ROBOT_ID, name: 'Robot', x: 0, y: 1 }]);
    expect(map.snapshot().stations).toEqual([{ id: STATION_ID, name: 'Issuing', x: 0, y: 2 }]);
  });

  it('moves an object and frees its previous cell', () => {
    const map = createMap();
    map.placeRobot(ROBOT_ID, 'Robot', at(0, 0));
    map.placeStation(STATION_ID, 'Receiving', at(1, 0));
    map.addObstacle(at(2, 0));

    map.moveRobot(ROBOT_ID, at(0, 1));
    map.moveStation(STATION_ID, at(1, 1));
    map.moveObstacle(at(2, 0), at(2, 1));
    map.addObstacle(at(0, 0));
    map.placeRobot(ROBOT_2_ID, 'Second', at(1, 0));
    map.placeStation(STATION_2_ID, 'Issuing', at(2, 0));

    expect(map.snapshot()).toMatchObject({
      robots: [
        { id: ROBOT_ID, x: 0, y: 1 },
        { id: ROBOT_2_ID, x: 1, y: 0 },
      ],
      stations: [
        { id: STATION_ID, x: 1, y: 1 },
        { id: STATION_2_ID, x: 2, y: 0 },
      ],
      obstacles: [
        { x: 2, y: 1 },
        { x: 0, y: 0 },
      ],
    });
  });

  it('moving an object onto its own cell changes nothing', () => {
    const map = createMap();
    map.placeRobot(ROBOT_ID, 'Robot', at(4, 4));
    map.placeStation(STATION_ID, 'Receiving', at(5, 5));
    map.addObstacle(at(6, 6));
    const before = map.snapshot();

    map.moveRobot(ROBOT_ID, at(4, 4));
    map.moveStation(STATION_ID, at(5, 5));
    map.moveObstacle(at(6, 6), at(6, 6));

    expect(map.snapshot()).toEqual(before);
  });

  it('a failed move leaves the map unchanged', () => {
    const map = createMap();
    map.placeRobot(ROBOT_ID, 'Robot', at(0, 0));
    map.placeStation(STATION_ID, 'Receiving', at(1, 0));
    map.addObstacle(at(2, 0));
    const before = map.snapshot();

    expect(() => map.moveRobot(ROBOT_ID, at(20, 0))).toThrow(PositionOutOfBoundsError);
    expect(() => map.moveRobot(ROBOT_ID, at(1, 0))).toThrow(CellOccupiedError);
    expect(() => map.moveRobot(ABSENT_ID, at(3, 0))).toThrow(MapObjectNotFoundError);
    expect(() => map.moveStation(STATION_ID, at(2, 0))).toThrow(CellOccupiedError);
    expect(() => map.moveStation(ABSENT_ID, at(3, 0))).toThrow(MapObjectNotFoundError);
    expect(() => map.moveObstacle(at(2, 0), at(0, 20))).toThrow(PositionOutOfBoundsError);
    expect(() => map.moveObstacle(at(3, 3), at(4, 4))).toThrow(MapObjectNotFoundError);

    expect(map.snapshot()).toEqual(before);
  });

  it('removal frees the cell, id, and name', () => {
    const map = createMap();
    map.placeRobot(ROBOT_ID, 'Robot', at(0, 0));
    map.placeStation(STATION_ID, 'Receiving', at(1, 0));
    map.addObstacle(at(2, 0));

    map.removeRobot(ROBOT_ID);
    map.removeStation(STATION_ID);
    map.removeObstacle(at(2, 0));

    map.placeRobot(ROBOT_ID, 'Robot', at(0, 0));
    map.placeStation(STATION_ID, ' receiving ', at(1, 0));
    map.addObstacle(at(2, 0));

    expect(map.snapshot().robots).toHaveLength(1);
    expect(map.snapshot().stations[0]).toMatchObject({ id: STATION_ID, name: 'receiving' });
    expect(map.snapshot().obstacles).toEqual([{ x: 2, y: 0 }]);
  });

  it('removing a missing object does not change the map', () => {
    const map = createMap();
    map.placeRobot(ROBOT_ID, 'Robot', at(0, 0));
    const before = map.snapshot();

    expect(() => map.removeRobot(ABSENT_ID)).toThrow(MapObjectNotFoundError);
    expect(() => map.removeStation(ABSENT_ID)).toThrow(MapObjectNotFoundError);
    expect(() => map.removeObstacle(at(3, 3))).toThrow(MapObjectNotFoundError);
    expect(map.snapshot()).toEqual(before);
  });

  it('mutating a snapshot or a returned collection does not change the map', () => {
    const map = createMap();
    map.placeRobot(ROBOT_ID, 'Robot', at(0, 0));
    map.placeStation(STATION_ID, 'Receiving', at(1, 0));
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
    snapshot.robots.push({ id: ROBOT_2_ID, name: 'Extra', x: 3, y: 3 });
    snapshot.obstacles.splice(0, 1);

    (map.getRobots() as Robot[]).splice(0, 1);
    (map.getStations() as Station[]).splice(0, 1);
    (map.getObstacles() as Position[]).pop();

    expect(map.snapshot()).toEqual(before);
  });

  it('returned robot and position are frozen; only map operations can move them', () => {
    const map = createMap();
    map.placeRobot(ROBOT_ID, 'Robot', at(0, 0));
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
    expect(() => map.moveRobot(ROBOT_ID, at(1, 0))).toThrow(CellOccupiedError);
    expect(() => map.moveRobot(ROBOT_ID, at(20, 0))).toThrow(PositionOutOfBoundsError);
    expect(map.snapshot()).toEqual(before);
  });

  it('stores an uppercase map id and warehouseId in one lowercase form', () => {
    const map = WarehouseMap.create(MAP_ID.toUpperCase(), WAREHOUSE_ID.toUpperCase());

    expect(map.id).toBe(MAP_ID);
    expect(map.warehouseId).toBe(WAREHOUSE_ID);
  });

  it('rejects a duplicate object id that differs only by letter case', () => {
    const map = createMap();
    map.placeRobot(SAME_ID, 'First', at(0, 0));
    const before = map.snapshot();

    expect(() => map.placeRobot(SAME_ID.toUpperCase(), 'Second', at(1, 0))).toThrow(
      DuplicateObjectIdError,
    );
    expect(() => map.placeStation(SAME_ID.toUpperCase(), 'Issuing', at(2, 0))).toThrow(
      DuplicateObjectIdError,
    );
    expect(map.snapshot()).toEqual(before);
  });

  it('finds a robot and a station by uuid regardless of case', () => {
    const map = createMap();
    map.placeRobot(ROBOT_ID, 'Robot', at(0, 0));
    map.placeStation(STATION_ID, 'Receiving', at(1, 0));

    map.moveRobot(ROBOT_ID.toUpperCase(), at(0, 1));
    map.moveStation(STATION_ID.toUpperCase(), at(1, 1));

    expect(map.snapshot().robots).toEqual([{ id: ROBOT_ID, name: 'Robot', x: 0, y: 1 }]);
    expect(map.snapshot().stations).toEqual([{ id: STATION_ID, name: 'Receiving', x: 1, y: 1 }]);
  });

  it('rejects a lookup id that is not a uuid', () => {
    const map = createMap();
    map.placeRobot(ROBOT_ID, 'Robot', at(0, 0));

    expect(() => map.moveRobot('missing', at(3, 0))).toThrow(InvalidIdError);
    expect(() => map.removeStation('missing')).toThrow(InvalidIdError);
  });

  it('removes a robot and a station when the uuid differs only by letter case', () => {
    const map = createMap();
    map.placeRobot(ROBOT_ID, 'Robot', at(0, 0));
    map.placeStation(STATION_ID, 'Receiving', at(1, 0));

    map.removeRobot(ROBOT_ID.toUpperCase());
    map.removeStation(STATION_ID.toUpperCase());

    expect(map.snapshot().robots).toEqual([]);
    expect(map.snapshot().stations).toEqual([]);
    expect(map.getRobots()).toEqual([]);
    expect(map.getStations()).toEqual([]);
  });

  it('rejects a cell object that was not created by Position and leaves the map unchanged', () => {
    const map = createMap();
    map.placeRobot(ROBOT_ID, 'Robot', at(0, 0));
    map.placeStation(STATION_ID, 'Receiving', at(1, 0));
    map.addObstacle(at(2, 0));
    const before = map.snapshot();
    const foreign = {
      x: 3,
      y: 3,
      equals: () => false,
    } as unknown as Position;

    expect(() => map.addObstacle(foreign)).toThrow(InvalidPositionError);
    expect(() => map.placeRobot(ROBOT_2_ID, 'Second', foreign)).toThrow(InvalidPositionError);
    expect(() => map.placeStation(STATION_2_ID, 'Issuing', foreign)).toThrow(InvalidPositionError);
    expect(() => map.moveRobot(ROBOT_ID, foreign)).toThrow(InvalidPositionError);
    expect(() => map.moveStation(STATION_ID, foreign)).toThrow(InvalidPositionError);
    expect(() => map.moveObstacle(at(2, 0), foreign)).toThrow(InvalidPositionError);
    expect(() => map.removeObstacle(foreign)).toThrow(InvalidPositionError);
    expect(map.snapshot()).toEqual(before);
  });

  it('keeps the map frozen and hides its collections', () => {
    const map = createMap();

    expect(Object.isFrozen(map)).toBe(true);
    expect(Object.hasOwn(map, 'robots')).toBe(false);
    expect(Object.hasOwn(map, 'stations')).toBe(false);
    expect(Object.hasOwn(map, 'obstacles')).toBe(false);
  });
});
