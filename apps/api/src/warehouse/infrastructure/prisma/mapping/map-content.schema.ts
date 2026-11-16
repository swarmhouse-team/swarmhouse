import { z } from 'zod';

import { CorruptedMapStateError } from '../../../application/errors/application.errors';
import type { WarehouseMapRestoreInput } from '../../../application/mapping/warehouse-map-restore-input';

const coordinates = z.object({
  x: z.number(),
  y: z.number(),
});

const namedObject = coordinates.extend({
  id: z.string(),
  name: z.string(),
});

const mapContentSchema = z.object({
  width: z.number(),
  height: z.number(),
  obstacles: z.array(coordinates),
  robots: z.array(namedObject),
  stations: z.array(namedObject.extend({ type: z.string() })),
});

/** Reads stored map JSON into the restore input. Domain rules stay in `restoreWarehouseMap`. */
export function parseMapContent(
  id: string,
  warehouseId: string,
  content: unknown,
): WarehouseMapRestoreInput {
  const parsed = mapContentSchema.safeParse(content);
  if (!parsed.success) {
    throw new CorruptedMapStateError(id, 'INVALID_STORED_FORMAT', parsed.error);
  }

  return {
    id,
    warehouseId,
    width: parsed.data.width,
    height: parsed.data.height,
    obstacles: parsed.data.obstacles.map((obstacle) => ({ x: obstacle.x, y: obstacle.y })),
    robots: parsed.data.robots.map((robot) => ({
      id: robot.id,
      name: robot.name,
      x: robot.x,
      y: robot.y,
    })),
    stations: parsed.data.stations.map((station) => ({
      id: station.id,
      name: station.name,
      type: station.type,
      x: station.x,
      y: station.y,
    })),
  };
}
