import { z } from 'zod';

import type { Prisma } from '../../../../../generated/prisma/client';
import { CorruptedMapStateError } from '../../../application/errors/application.errors';
import type { WarehouseMapRestoreInput } from '../../../application/mapping/warehouse-map-restore-input';
import type { WarehouseMapSnapshot } from '../../../domain/entities/warehouse-map';

const coordinates = z.object({
  x: z.number().int(),
  y: z.number().int(),
});

const namedObject = coordinates.extend({
  id: z.uuid(),
  name: z.string().min(1).max(100),
});

const mapContentSchema = z.object({
  width: z.number().int(),
  height: z.number().int(),
  obstacles: z.array(coordinates),
  robots: z.array(namedObject),
  stations: z.array(namedObject),
});

/** Writes a map snapshot into the stored JSON content. Columns keep id and warehouseId. */
export function toMapContent(snapshot: WarehouseMapSnapshot): Prisma.InputJsonObject {
  return {
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
      x: station.x,
      y: station.y,
    })),
  };
}

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
      x: station.x,
      y: station.y,
    })),
  };
}
