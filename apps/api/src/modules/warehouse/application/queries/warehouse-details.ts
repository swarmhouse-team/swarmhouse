import {
  listWarehousesResponseSchema,
  warehouseDetailsSchema,
  type ListWarehousesResponse,
  type WarehouseDetails,
} from '@robots/shared';

import type { StoredWarehouse } from '../ports/repositories/warehouse.repository';

/** Maps a stored row to the public DTO. An invalid row is not treated as a cache miss. */
export function toWarehouseDetails(record: StoredWarehouse): WarehouseDetails {
  return parseWarehouseDetails({
    warehouseId: record.id,
    name: record.name,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
  });
}

/** Checks a value built from PostgreSQL before it is cached or returned. */
export function parseWarehouseDetails(value: WarehouseDetails): WarehouseDetails {
  const parsed = warehouseDetailsSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('Warehouse details mapping is invalid');
  }
  return parsed.data;
}

/** Checks a list built from PostgreSQL. `total` must match `items.length`. */
export function parseWarehouseList(value: ListWarehousesResponse): ListWarehousesResponse {
  const parsed = listWarehousesResponseSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('Warehouse list mapping is invalid');
  }
  return parsed.data;
}

function toIso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}
