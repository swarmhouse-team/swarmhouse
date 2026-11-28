import type { WarehouseMapBody } from '@robots/shared';

export interface MapSummary {
  width: number;
  height: number;
  stations: number;
  robots: number;
  obstacles: number;
}

/** Сводка для футера редактора: размер карты и количество объектов. */
export const getMapSummary = (map: WarehouseMapBody): MapSummary => ({
  width: map.width,
  height: map.height,
  stations: map.stations.length,
  robots: map.robots.length,
  obstacles: map.obstacles.length,
});
