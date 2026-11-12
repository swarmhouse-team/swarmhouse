import { describe, expect, it } from 'vitest';

import { validWarehouseMap } from '../fixtures';

import {
  warehouseMapSchema,
  type Obstacle,
  type Robot,
  type Station,
  type WarehouseMap,
} from './map';

function copyMap(): WarehouseMap {
  return JSON.parse(JSON.stringify(validWarehouseMap)) as WarehouseMap;
}

function firstStation(map: WarehouseMap): Station {
  const station = map.stations[0];
  if (!station) {
    throw new Error('Fixture has no station');
  }
  return station;
}

function secondStation(map: WarehouseMap): Station {
  const station = map.stations[1];
  if (!station) {
    throw new Error('Fixture has no second station');
  }
  return station;
}

function firstObstacle(map: WarehouseMap): Obstacle {
  const obstacle = map.obstacles[0];
  if (!obstacle) {
    throw new Error('Fixture has no obstacle');
  }
  return obstacle;
}

function firstRobot(map: WarehouseMap): Robot {
  const robot = map.robots[0];
  if (!robot) {
    throw new Error('Fixture has no robot');
  }
  return robot;
}

describe('warehouseMapSchema', () => {
  it('accepts a valid map', () => {
    expect(warehouseMapSchema.parse(validWarehouseMap)).toEqual(validWarehouseMap);
  });

  it('rejects a coordinate on the grid boundary', () => {
    const map = copyMap();
    firstObstacle(map).position.x = map.width;

    expect(warehouseMapSchema.safeParse(map).success).toBe(false);
  });

  it('rejects two objects on the same cell', () => {
    const map = copyMap();
    firstObstacle(map).position = { ...firstStation(map).position };

    expect(warehouseMapSchema.safeParse(map).success).toBe(false);
  });

  it('rejects a robot inside an obstacle', () => {
    const map = copyMap();
    firstRobot(map).position = { ...firstObstacle(map).position };

    expect(warehouseMapSchema.safeParse(map).success).toBe(false);
  });

  it('rejects duplicate station ids', () => {
    const map = copyMap();
    secondStation(map).id = firstStation(map).id;

    expect(warehouseMapSchema.safeParse(map).success).toBe(false);
  });

  it('rejects duplicate robot names', () => {
    const map = copyMap();
    map.robots.push({
      id: 'rb-2',
      name: firstRobot(map).name,
      position: { x: 3, y: 3 },
    });

    expect(warehouseMapSchema.safeParse(map).success).toBe(false);
  });
});
