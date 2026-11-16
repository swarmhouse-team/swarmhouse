import { StationType } from '../../domain/enums/station-type';
import { WarehouseMap, type StationSnapshot } from '../../domain/entities/warehouse-map';
import { DomainError } from '../../domain/errors/domain.error';
import { Position } from '../../domain/vo/position';
import { EXPECTED_WAREHOUSE_MAP_SIZE } from '../constants';
import { CorruptedMapStateError } from '../errors/application.errors';
import type { WarehouseMapRestoreInput } from './warehouse-map-restore-input';

/** Rebuilds a map from stored data. Invalid stored data is not repaired. */
export function restoreWarehouseMap(input: WarehouseMapRestoreInput): WarehouseMap {
  if (
    input.width !== EXPECTED_WAREHOUSE_MAP_SIZE ||
    input.height !== EXPECTED_WAREHOUSE_MAP_SIZE
  ) {
    throw new CorruptedMapStateError(input.id, 'GRID_SIZE_MISMATCH');
  }

  const stations: StationSnapshot[] = [];
  for (const station of input.stations) {
    if (!isStationType(station.type)) {
      throw new CorruptedMapStateError(input.id, 'UNKNOWN_STATION_TYPE');
    }
    stations.push({
      id: station.id,
      name: station.name,
      type: station.type,
      x: station.x,
      y: station.y,
    });
  }

  for (const named of [...input.robots, ...input.stations]) {
    if (named.name !== named.name.trim()) {
      throw new CorruptedMapStateError(input.id, 'DENORMALIZED_NAME');
    }
  }

  try {
    const map = WarehouseMap.create(input.id, input.warehouseId);
    for (const obstacle of input.obstacles) {
      map.addObstacle(Position.create(obstacle.x, obstacle.y));
    }
    for (const robot of input.robots) {
      map.placeRobot(robot.id, robot.name, Position.create(robot.x, robot.y));
    }
    for (const station of stations) {
      map.placeStation(
        station.id,
        station.name,
        station.type,
        Position.create(station.x, station.y),
      );
    }
    return map;
  } catch (error) {
    if (error instanceof DomainError) {
      throw new CorruptedMapStateError(input.id, 'DOMAIN_INVARIANT', error);
    }
    throw error;
  }
}

function isStationType(value: string): value is StationType {
  return (
    value === StationType.Receiving ||
    value === StationType.Issuing ||
    value === StationType.Intermediate
  );
}
