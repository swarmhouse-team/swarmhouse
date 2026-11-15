import { StationType } from '../../domain/enums/station-type';
import { WarehouseMap, type WarehouseMapSnapshot } from '../../domain/entities/warehouse-map';
import { DomainError } from '../../domain/errors/domain.error';
import { Position } from '../../domain/vo/position';
import { CorruptedMapStateError } from '../errors/application.errors';

const MAP_SIZE = 20;

/** Rebuilds a map from a stored snapshot. Invalid stored data is not repaired. */
export function restoreWarehouseMap(snapshot: WarehouseMapSnapshot): WarehouseMap {
  if (snapshot.width !== MAP_SIZE || snapshot.height !== MAP_SIZE) {
    throw new CorruptedMapStateError(snapshot.id, 'GRID_SIZE_MISMATCH');
  }
  for (const station of snapshot.stations) {
    if (!isStationType(station.type)) {
      throw new CorruptedMapStateError(snapshot.id, 'UNKNOWN_STATION_TYPE');
    }
  }
  for (const named of [...snapshot.robots, ...snapshot.stations]) {
    if (named.name !== named.name.trim()) {
      throw new CorruptedMapStateError(snapshot.id, 'DENORMALIZED_NAME');
    }
  }

  try {
    const map = WarehouseMap.create(snapshot.id, snapshot.warehouseId);
    for (const obstacle of snapshot.obstacles) {
      map.addObstacle(Position.create(obstacle.x, obstacle.y));
    }
    for (const robot of snapshot.robots) {
      map.placeRobot(robot.id, robot.name, Position.create(robot.x, robot.y));
    }
    for (const station of snapshot.stations) {
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
      throw new CorruptedMapStateError(snapshot.id, 'DOMAIN_INVARIANT', error);
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
