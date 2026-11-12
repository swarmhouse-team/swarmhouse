import { describe, expect, it } from 'vitest';

import { validWarehouseMap } from './fixtures';
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
    throw new Error('В фикстуре нет станции');
  }
  return station;
}

function secondStation(map: WarehouseMap): Station {
  const station = map.stations[1];
  if (!station) {
    throw new Error('В фикстуре нет второй станции');
  }
  return station;
}

function firstObstacle(map: WarehouseMap): Obstacle {
  const obstacle = map.obstacles[0];
  if (!obstacle) {
    throw new Error('В фикстуре нет препятствия');
  }
  return obstacle;
}

function firstRobot(map: WarehouseMap): Robot {
  const robot = map.robots[0];
  if (!robot) {
    throw new Error('В фикстуре нет робота');
  }
  return robot;
}

describe('warehouseMapSchema', () => {
  it('принимает валидную карту', () => {
    expect(warehouseMapSchema.parse(validWarehouseMap)).toEqual(validWarehouseMap);
  });

  it('отклоняет координату на границе сетки', () => {
    const map = copyMap();
    firstObstacle(map).position.x = map.width;

    expect(warehouseMapSchema.safeParse(map).success).toBe(false);
  });

  it('отклоняет два объекта на одной клетке', () => {
    const map = copyMap();
    firstObstacle(map).position = { ...firstStation(map).position };

    expect(warehouseMapSchema.safeParse(map).success).toBe(false);
  });

  it('отклоняет робота внутри препятствия', () => {
    const map = copyMap();
    firstRobot(map).position = { ...firstObstacle(map).position };

    expect(warehouseMapSchema.safeParse(map).success).toBe(false);
  });

  it('отклоняет повторяющиеся id станций', () => {
    const map = copyMap();
    secondStation(map).id = firstStation(map).id;

    expect(warehouseMapSchema.safeParse(map).success).toBe(false);
  });

  it('отклоняет повторяющиеся имена роботов', () => {
    const map = copyMap();
    map.robots.push({
      id: 'rb-2',
      name: firstRobot(map).name,
      position: { x: 3, y: 3 },
    });

    expect(warehouseMapSchema.safeParse(map).success).toBe(false);
  });
});
