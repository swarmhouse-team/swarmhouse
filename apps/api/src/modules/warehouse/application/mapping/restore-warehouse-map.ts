import { DomainError } from '../../../../common/domain/domain.error';
import { Position } from '../../../../common/domain/position';
import { WarehouseMap } from '../../domain/entities/warehouse-map';
import { WAREHOUSE_MAP_HEIGHT, WAREHOUSE_MAP_WIDTH } from '../../domain/constants';
import { CorruptedMapStateError } from '../errors/application.errors';
import type { WarehouseMapRestoreInput } from './warehouse-map-restore-input';

/** Rebuilds a map from stored data. Invalid stored data is not repaired. */
export function restoreWarehouseMap(input: WarehouseMapRestoreInput): WarehouseMap {
  if (input.width !== WAREHOUSE_MAP_WIDTH || input.height !== WAREHOUSE_MAP_HEIGHT) {
    throw new CorruptedMapStateError(input.id, 'GRID_SIZE_MISMATCH');
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
    for (const station of input.stations) {
      map.placeStation(station.id, station.name, Position.create(station.x, station.y));
    }
    return map;
  } catch (error) {
    if (error instanceof DomainError) {
      throw new CorruptedMapStateError(input.id, 'DOMAIN_INVARIANT', error);
    }
    throw error;
  }
}
