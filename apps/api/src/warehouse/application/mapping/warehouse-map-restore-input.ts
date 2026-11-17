import type { StationSnapshot, WarehouseMapSnapshot } from '../../domain/entities/warehouse-map';

/** A station taken from storage before its type is checked. */
export interface StationRestoreInput extends Omit<StationSnapshot, 'type'> {
  type: string;
}

/**
 * Stored map data before domain checks.
 * A valid `WarehouseMapSnapshot` is assignable here.
 * `snapshot()` of a restored map stays the strict snapshot.
 */
export interface WarehouseMapRestoreInput extends Omit<WarehouseMapSnapshot, 'stations'> {
  stations: readonly StationRestoreInput[];
}
