import type { EditWarehouseMapOperation } from '@robots/shared';

import type { WarehouseMapSnapshot } from '../../../domain/entities/warehouse-map';

export interface EditWarehouseMapInput {
  mapId: string;
  expectedVersion: number;
  operation: EditWarehouseMapOperation;
}

export interface EditWarehouseMapResult {
  mapId: string;
  version: number;
  changed: boolean;
  snapshot: WarehouseMapSnapshot;
  createdId?: string;
}
