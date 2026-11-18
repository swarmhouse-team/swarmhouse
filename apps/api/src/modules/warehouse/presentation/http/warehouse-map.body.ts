import type { WarehouseMapBody } from '@robots/shared';

import type { WarehouseMapSnapshot } from '../../domain/entities/warehouse-map';

/** Flat HTTP body of a map. The source snapshot is not changed. */
export function toWarehouseMapBody(
  snapshot: WarehouseMapSnapshot,
  version: number,
): WarehouseMapBody {
  return {
    mapId: snapshot.id,
    warehouseId: snapshot.warehouseId,
    version,
    width: snapshot.width,
    height: snapshot.height,
    obstacles: snapshot.obstacles.map((obstacle) => ({ x: obstacle.x, y: obstacle.y })),
    robots: snapshot.robots.map((robot) => ({
      id: robot.id,
      name: robot.name,
      x: robot.x,
      y: robot.y,
    })),
    stations: snapshot.stations.map((station) => ({
      id: station.id,
      name: station.name,
      type: station.type,
      x: station.x,
      y: station.y,
    })),
  };
}
