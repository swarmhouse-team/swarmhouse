import { WAREHOUSE_MAP_HEIGHT, WAREHOUSE_MAP_WIDTH } from '../constants';
import {
  CellOccupiedError,
  DuplicateObjectIdError,
  DuplicateRobotNameError,
  DuplicateStationNameError,
  MapObjectNotFoundError,
  PositionOutOfBoundsError,
} from '../errors/map.errors';
import { InvalidGridSizeError, InvalidNameError, InvalidPositionError } from '../errors/value.errors';
import { GridSize } from '../../../../common/domain/grid-size';
import { Position } from '../../../../common/domain/position';
import { normalizeId } from '../vo/id';
import { Robot } from './robot';
import { Station } from './station';

interface ObstacleSnapshot {
  x: number;
  y: number;
}

interface RobotSnapshot {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface StationSnapshot {
  id: string;
  name: string;
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

  readonly #robots: Robot[] = [];
  readonly #stations: Station[] = [];
  readonly #obstacles: Position[] = [];

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

  /** Rebuilds a map from stored data. A stored name is not trimmed and a bad cell is not moved. */
  static restore(input: WarehouseMapSnapshot): WarehouseMap {
    if (input.width !== WAREHOUSE_MAP_WIDTH || input.height !== WAREHOUSE_MAP_HEIGHT) {
      throw new InvalidGridSizeError(input.width, input.height);
    }

    for (const named of [...input.robots, ...input.stations]) {
      if (named.name !== named.name.trim()) {
        throw new InvalidNameError(named.name);
      }
    }

    const map = WarehouseMap.create(input.id, input.warehouseId);
    for (const obstacle of input.obstacles) {
      map.addObstacle(Position.create(obstacle.x, obstacle.y));
    }
    for (const robot of input.robots) {
      map.placeRobot(robot.id, robot.name, Position.create(robot.x, robot.y));
    }
    for (const station of input.stations) {
      map.placeStation(station.id, station.name, Position.create(station.x, station.y));
    }
    return map;
  }

  getRobots(): readonly Robot[] {
    return [...this.#robots];
  }

  getStations(): readonly Station[] {
    return [...this.#stations];
  }

  getObstacles(): readonly Position[] {
    return [...this.#obstacles];
  }

  snapshot(): WarehouseMapSnapshot {
    return {
      id: this.id,
      warehouseId: this.warehouseId,
      width: this.size.width,
      height: this.size.height,
      obstacles: this.#obstacles.map((position) => ({ x: position.x, y: position.y })),
      stations: this.#stations.map((station) => ({
        id: station.id,
        name: station.name.value,
        x: station.position.x,
        y: station.position.y,
      })),
      robots: this.#robots.map((robot) => ({
        id: robot.id,
        name: robot.name.value,
        x: robot.position.x,
        y: robot.position.y,
      })),
    };
  }

  addObstacle(position: Position): void {
    this.requirePosition(position);
    this.assertInside(position);
    this.assertFree(position);
    this.#obstacles.push(position);
  }

  placeRobot(id: string, name: string, position: Position): void {
    this.requirePosition(position);
    const robot = Robot.create(id, name, position);
    this.assertInside(position);
    this.assertFree(position);
    this.assertObjectIdAvailable(robot.id);
    this.assertNameAvailable(
      robot.name.value,
      this.#robots.map((item) => item.name.value),
      DuplicateRobotNameError,
    );
    this.#robots.push(robot);
  }

  placeStation(id: string, name: string, position: Position): void {
    this.requirePosition(position);
    const station = Station.create(id, name, position);
    this.assertInside(position);
    this.assertFree(position);
    this.assertObjectIdAvailable(station.id);
    this.assertNameAvailable(
      station.name.value,
      this.#stations.map((item) => item.name.value),
      DuplicateStationNameError,
    );
    this.#stations.push(station);
  }

  moveRobot(id: string, position: Position): void {
    this.requirePosition(position);
    const robotId = normalizeId(id);
    const index = this.#robots.findIndex((robot) => robot.id === robotId);
    const current = this.#robots[index];
    if (!current) {
      throw new MapObjectNotFoundError('robot');
    }
    if (current.position.equals(position)) {
      return;
    }

    this.assertInside(position);
    this.assertFree(position);
    this.#robots[index] = current.withPosition(position);
  }

  moveStation(id: string, position: Position): void {
    this.requirePosition(position);
    const stationId = normalizeId(id);
    const index = this.#stations.findIndex((station) => station.id === stationId);
    const current = this.#stations[index];
    if (!current) {
      throw new MapObjectNotFoundError('station');
    }
    if (current.position.equals(position)) {
      return;
    }

    this.assertInside(position);
    this.assertFree(position);
    this.#stations[index] = current.withPosition(position);
  }

  moveObstacle(from: Position, to: Position): void {
    this.requirePosition(from);
    this.requirePosition(to);
    const index = this.#obstacles.findIndex((position) => position.equals(from));
    if (index === -1) {
      throw new MapObjectNotFoundError('obstacle');
    }
    if (from.equals(to)) {
      return;
    }

    this.assertInside(to);
    this.assertFree(to);
    this.#obstacles[index] = to;
  }

  removeRobot(id: string): void {
    const robotId = normalizeId(id);
    const index = this.#robots.findIndex((robot) => robot.id === robotId);
    if (index === -1) {
      throw new MapObjectNotFoundError('robot');
    }
    this.#robots.splice(index, 1);
  }

  removeStation(id: string): void {
    const stationId = normalizeId(id);
    const index = this.#stations.findIndex((station) => station.id === stationId);
    if (index === -1) {
      throw new MapObjectNotFoundError('station');
    }
    this.#stations.splice(index, 1);
  }

  removeObstacle(position: Position): void {
    this.requirePosition(position);
    const index = this.#obstacles.findIndex((obstacle) => obstacle.equals(position));
    if (index === -1) {
      throw new MapObjectNotFoundError('obstacle');
    }
    this.#obstacles.splice(index, 1);
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
      this.#obstacles.some((obstacle) => obstacle.equals(position)) ||
      this.#robots.some((robot) => robot.position.equals(position)) ||
      this.#stations.some((station) => station.position.equals(position))
    );
  }

  private assertObjectIdAvailable(id: string): void {
    const taken =
      this.#robots.some((robot) => robot.id === id) ||
      this.#stations.some((station) => station.id === id);
    if (taken) {
      throw new DuplicateObjectIdError(id);
    }
  }

  /**
   * Compares names with `toLowerCase`.
   * Full Unicode case folding is not supported.
   */
  private assertNameAvailable(
    name: string,
    names: readonly string[],
    DuplicateName: new (name: string) => DuplicateRobotNameError | DuplicateStationNameError,
  ): void {
    const normalized = name.toLowerCase();
    const taken = names.some((current) => current.toLowerCase() === normalized);
    if (taken) {
      throw new DuplicateName(name);
    }
  }

  private requirePosition(position: Position): void {
    if (!(position instanceof Position)) {
      throw new InvalidPositionError(Number.NaN, Number.NaN);
    }
  }
}
