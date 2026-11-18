import { ApplicationError } from './application.error';

export type CorruptedMapReason =
  'GRID_SIZE_MISMATCH' | 'DENORMALIZED_NAME' | 'DOMAIN_INVARIANT' | 'INVALID_STORED_FORMAT';

const MAP_VERSION_CONFLICT_CLIENT_MESSAGE =
  'The map version is stale. Read the map again and repeat the command.';

/** The requested warehouse does not exist. */
export class WarehouseNotFoundError extends ApplicationError {
  constructor(details: { warehouseId: string }) {
    super('WAREHOUSE_NOT_FOUND', 'Warehouse was not found', details, undefined, {
      clientStatus: 404,
    });
  }
}

/** The requested map does not exist, looked up by map id or warehouse id. */
export class WarehouseMapNotFoundError extends ApplicationError {
  constructor(lookup: { mapId: string } | { warehouseId: string }) {
    super('MAP_NOT_FOUND', 'Warehouse map was not found', lookup, undefined, {
      clientStatus: 404,
    });
  }
}

/** The map changed between the client's expected version and the stored one. */
export class MapVersionConflictError extends ApplicationError {
  constructor(details: { mapId: string; expectedVersion: number; actualVersion: number }) {
    super('MAP_VERSION_CONFLICT', 'Warehouse map version conflict', details, undefined, {
      clientStatus: 409,
      clientMessage: MAP_VERSION_CONFLICT_CLIENT_MESSAGE,
    });
  }
}

/**
 * Stored map data cannot be restored.
 * `INVALID_STORED_FORMAT` means the stored representation cannot be parsed into a snapshot.
 * A cause is kept when one is given, whether it is a domain error or a parse error.
 */
export class CorruptedMapStateError extends ApplicationError {
  readonly mapId: string;
  readonly reason: CorruptedMapReason;

  constructor(mapId: string, reason: CorruptedMapReason, cause?: Error) {
    super('CORRUPTED_MAP_STATE', 'Stored warehouse map is corrupted', { mapId, reason }, cause, {
      logFields: { mapId, reason },
    });
    this.mapId = mapId;
    this.reason = reason;
  }
}
