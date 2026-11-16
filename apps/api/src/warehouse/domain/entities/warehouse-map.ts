import { WAREHOUSE_MAP_HEIGHT, WAREHOUSE_MAP_WIDTH } from '../constants';
import {
  CellOccupiedError,
  DuplicateObjectIdError,
  DuplicateRobotNameError,
  DuplicateStationNameError,
  MapObjectNotFoundError,
  PositionOutOfBoundsError,
} from '../errors/map.errors';
import type { StationType } from '../enums/station-type';
import { GridSize } from '../vo/grid-size';
import { normalizeId } from '../vo/id';
import { Position } from '../vo/position';
import { Robot } from './robot';
import { Station } from './station';

export interface ObstacleSnapshot {
  x: number;
  y: number;
}

export interface RobotSnapshot {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface StationSnapshot {
  id: string;
  name: string;
  type: StationType;
  x: number;
  y: number;
}

/** A snapshot of new plain objects. Mutating it does not affect the map. */
export interface WarehouseMapSnapshot {
  id: string;
  warehouseId: string;
  width: number;
  height: number;
  obstacles: ObstacleSnapshot[];
  stations: StationSnapshot[];
  robots: RobotSnapshot[];
}

/**
 * Map aggregate root. Bounds, occupancy, and uniqueness are checked here
 * before the collections change.
 */
export class WarehouseMap {
  readonly id: string;
  readonly warehouseId: string;
  readonly size: GridSize;

  private readonly robots: Robot[] = [];
  private readonly stations: Station[] = [];
  private readonly obstacles: Position[] = [];

  private constructor(id: string, warehouseId: string, size: GridSize) {
    this.id = id;
    this.warehouseId = warehouseId;
    this.size = size;
    Object.freeze(this);
  }

  static create(id: string, warehouseId: string): WarehouseMap {
    return new WarehouseMap(
      normalizeId(id),
      normalizeId(warehouseId),
      GridSize.create(WAREHOUSE_MAP_WIDTH, WAREHOUSE_MAP_HEIGHT),
    );
  }

  getRobots(): readonly Robot[] {
    return [...this.robots];
  }

  getStations(): readonly Station[] {
    return [...this.stations];
  }

  getObstacles(): readonly Position[] {
    return [...this.obstacles];
  }

  snapshot(): WarehouseMapSnapshot {
    return {
      id: this.id,
      warehouseId: this.warehouseId,
      width: this.size.width,
      height: this.size.height,
      obstacles: this.obstacles.map((position) => ({ x: position.x, y: position.y })),
      stations: this.stations.map((station) => ({
        id: station.id,
        name: station.name.value,
        type: station.type,
        x: station.position.x,
        y: station.position.y,
      })),
      robots: this.robots.map((robot) => ({
        id: robot.id,
        name: robot.name.value,
        x: robot.position.x,
        y: robot.position.y,
      })),
    };
  }

  addObstacle(position: Position): void {
    this.assertInside(position);
    this.assertFree(position);
    this.obstacles.push(position);
  }

  placeRobot(id: string, name: string, position: Position): void {
    const robot = Robot.create(id, name, position);
    this.assertInside(position);
    this.assertFree(position);
    this.assertObjectIdAvailable(robot.id);
    this.assertRobotNameAvailable(robot.name.value);
    this.robots.push(robot);
  }

  placeStation(id: string, name: string, type: StationType, position: Position): void {
    const station = Station.create(id, name, type, position);
    this.assertInside(position);
    this.assertFree(position);
    this.assertObjectIdAvailable(station.id);
    this.assertStationNameAvailable(station.name.value);
    this.stations.push(station);
  }

  moveRobot(id: string, position: Position): void {
    const robotId = normalizeId(id);
    const index = this.robots.findIndex((robot) => robot.id === robotId);
    const current = this.robots[index];
    if (index === -1 || !current) {
      throw new MapObjectNotFoundError('robot');
    }
    if (current.position.equals(position)) {
      return;
    }

    this.assertInside(position);
    this.assertFree(position);
    this.robots[index] = current.withPosition(position);
  }

  moveStation(id: string, position: Position): void {
    const stationId = normalizeId(id);
    const index = this.stations.findIndex((station) => station.id === stationId);
    const current = this.stations[index];
    if (index === -1 || !current) {
      throw new MapObjectNotFoundError('station');
    }
    if (current.position.equals(position)) {
      return;
    }

    this.assertInside(position);
    this.assertFree(position);
    this.stations[index] = current.withPosition(position);
  }

  moveObstacle(from: Position, to: Position): void {
    const index = this.obstacles.findIndex((position) => position.equals(from));
    if (index === -1) {
      throw new MapObjectNotFoundError('obstacle');
    }
    if (from.equals(to)) {
      return;
    }

    this.assertInside(to);
    this.assertFree(to);
    this.obstacles[index] = to;
  }

  removeRobot(id: string): void {
    const robotId = normalizeId(id);
    const index = this.robots.findIndex((robot) => robot.id === robotId);
    if (index === -1) {
      throw new MapObjectNotFoundError('robot');
    }
    this.robots.splice(index, 1);
  }

  removeStation(id: string): void {
    const stationId = normalizeId(id);
    const index = this.stations.findIndex((station) => station.id === stationId);
    if (index === -1) {
      throw new MapObjectNotFoundError('station');
    }
    this.stations.splice(index, 1);
  }

  removeObstacle(position: Position): void {
    const index = this.obstacles.findIndex((obstacle) => obstacle.equals(position));
    if (index === -1) {
      throw new MapObjectNotFoundError('obstacle');
    }
    this.obstacles.splice(index, 1);
  }

  private assertInside(position: Position): void {
    if (!this.size.contains(position.x, position.y)) {
      throw new PositionOutOfBoundsError(position.x, position.y);
    }
  }

  private assertFree(position: Position): void {
    if (this.isOccupied(position)) {
      throw new CellOccupiedError(position.x, position.y);
    }
  }

  private isOccupied(position: Position): boolean {
    return (
      this.obstacles.some((obstacle) => obstacle.equals(position)) ||
      this.robots.some((robot) => robot.position.equals(position)) ||
      this.stations.some((station) => station.position.equals(position))
    );
  }

  private assertObjectIdAvailable(id: string): void {
    const taken =
      this.robots.some((robot) => robot.id === id) ||
      this.stations.some((station) => station.id === id);
    if (taken) {
      throw new DuplicateObjectIdError(id);
    }
  }

  private assertRobotNameAvailable(name: string): void {
    const normalized = name.toLocaleLowerCase();
    const taken = this.robots.some((robot) => robot.name.value.toLocaleLowerCase() === normalized);
    if (taken) {
      throw new DuplicateRobotNameError(name);
    }
  }

  private assertStationNameAvailable(name: string): void {
    const normalized = name.toLocaleLowerCase();
    const taken = this.stations.some(
      (station) => station.name.value.toLocaleLowerCase() === normalized,
    );
    if (taken) {
      throw new DuplicateStationNameError(name);
    }
  }
}
