import type { WarehouseMapSnapshot } from '../../../domain/entities/warehouse-map';

export type GetWarehouseMapInput = { mapId: string } | { warehouseId: string };

export interface GetWarehouseMapResult {
  snapshot: WarehouseMapSnapshot;
  version: number;
}
