import { z } from 'zod';

const idSchema = z.string().min(1);
const nameSchema = z.string().min(1);

/** Клетка сетки. Координаты целые и не меньше нуля; попадание внутрь карты проверяет схема карты. */
export const positionSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
});

export type Position = z.infer<typeof positionSchema>;

export const obstacleSchema = z.object({
  id: idSchema,
  position: positionSchema,
});

export type Obstacle = z.infer<typeof obstacleSchema>;

export const stationSchema = z.object({
  id: idSchema,
  name: nameSchema,
  position: positionSchema,
});

export type Station = z.infer<typeof stationSchema>;


export const robotSchema = z.object({
  id: idSchema,
  name: nameSchema,
  position: positionSchema,
});

export type Robot = z.infer<typeof robotSchema>;

type MapObjectKind = 'obstacles' | 'stations' | 'robots';

function cellKey(position: Position): string {
  return `${position.x},${position.y}`;
}

/**
 * Карта склада целиком. `version` — ожидаемая версия при сохранении:
 * сервер отклоняет запрос, если она устарела.
 */
export const warehouseMapSchema = z
  .object({
    warehouseId: idSchema,
    width: z.number().int().min(1),
    height: z.number().int().min(1),
    version: z.number().int().min(0),
    obstacles: z.array(obstacleSchema),
    stations: z.array(stationSchema),
    robots: z.array(robotSchema),
  })
  .superRefine((map, ctx) => {
    const occupied = new Set<string>();

    const place = (kind: MapObjectKind, index: number, position: Position): void => {
      if (position.x >= map.width || position.y >= map.height) {
        ctx.addIssue({
          code: 'custom',
          message: 'Coordinate is outside the grid',
          path: [kind, index, 'position'],
        });
      }

      const key = cellKey(position);
      if (occupied.has(key)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Cell is already occupied',
          path: [kind, index, 'position'],
        });
        return;
      }

      occupied.add(key);
    };

    map.obstacles.forEach((obstacle, index) => {
      place('obstacles', index, obstacle.position);
    });
    map.stations.forEach((station, index) => {
      place('stations', index, station.position);
    });
    map.robots.forEach((robot, index) => {
      place('robots', index, robot.position);
    });

    const requireUnique = (
      kind: 'stations' | 'robots',
      field: 'id' | 'name',
      values: string[],
    ): void => {
      const seen = new Set<string>();
      values.forEach((value, index) => {
        if (seen.has(value)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Value must be unique',
            path: [kind, index, field],
          });
          return;
        }
        seen.add(value);
      });
    };

    requireUnique(
      'stations',
      'id',
      map.stations.map((station) => station.id),
    );
    requireUnique(
      'stations',
      'name',
      map.stations.map((station) => station.name),
    );
    requireUnique(
      'robots',
      'id',
      map.robots.map((robot) => robot.id),
    );
    requireUnique(
      'robots',
      'name',
      map.robots.map((robot) => robot.name),
    );
  });

export type WarehouseMap = z.infer<typeof warehouseMapSchema>;

export const getMapResponseSchema = warehouseMapSchema;
export type GetMapResponse = z.infer<typeof getMapResponseSchema>;

export const saveMapRequestSchema = warehouseMapSchema;
export type SaveMapRequest = z.infer<typeof saveMapRequestSchema>;

export const saveMapResponseSchema = warehouseMapSchema;
export type SaveMapResponse = z.infer<typeof saveMapResponseSchema>;
