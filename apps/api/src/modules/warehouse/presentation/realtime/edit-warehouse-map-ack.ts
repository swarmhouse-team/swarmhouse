import type { EditWarehouseMapResponse } from '@robots/shared';

import type { EditWarehouseMapResult } from '../../application/commands/edit-warehouse-map/edit-warehouse-map.types';
import { toWarehouseMapBody } from '../http/warehouse-map.body';

/** Same body as `POST /api/maps/:mapId/operations`. */
export function toEditWarehouseMapAckData(
  result: EditWarehouseMapResult,
): EditWarehouseMapResponse {
  if (result.createdId === undefined) {
    return {
      changed: result.changed,
      map: toWarehouseMapBody(result.snapshot, result.version),
    };
  }

  return {
    changed: result.changed,
    createdId: result.createdId,
    map: toWarehouseMapBody(result.snapshot, result.version),
  };
}
