import { ApplicationError } from './application.error';

export type CorruptedMapReason =
  'GRID_SIZE_MISMATCH' | 'UNKNOWN_STATION_TYPE' | 'DENORMALIZED_NAME' | 'DOMAIN_INVARIANT';

/** The requested warehouse does not exist. */
export class WarehouseNotFoundError extends ApplicationError {
  constructor(details: { warehouseId: string }) {
    super('WAREHOUSE_NOT_FOUND', 'Warehouse was not found', details);
  }
}

/** The requested map does not exist, looked up by map id or warehouse id. */
export class WarehouseMapNotFoundError extends ApplicationError {
  constructor(lookup: { mapId: string } | { warehouseId: string }) {
    super('MAP_NOT_FOUND', 'Warehouse map was not found', lookup);
  }
}

/** The map changed between the client's expected version and the stored one. */
export class MapVersionConflictError extends ApplicationError {
  constructor(details: { mapId: string; expectedVersion: number; actualVersion: number }) {
    super('MAP_VERSION_CONFLICT', 'Warehouse map version conflict', details);
  }
}

/** Stored map data cannot be restored. A domain cause is kept when there is one. */
export class CorruptedMapStateError extends ApplicationError {
  constructor(mapId: string, reason: CorruptedMapReason, cause?: Error) {
    super('CORRUPTED_MAP_STATE', 'Stored warehouse map is corrupted', { mapId, reason }, cause);
  }
}
