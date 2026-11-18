import type { EditWarehouseMapOperation } from '@robots/shared';

/** Published after a successful commit. The adapter must not throw. */
export interface WarehouseMapChangedNotice {
  warehouseId: string;
  mapId: string;
  version: number;
  operation: EditWarehouseMapOperation;
  createdId?: string;
}

export interface WarehouseUpdatedNotice {
  warehouseId: string;
}

export interface WarehouseDeletedNotice {
  warehouseId: string;
}

/**
 * Tells subscribers that committed warehouse state changed.
 * Application code does not know Socket.IO. A delivery failure stays inside the adapter.
 */
export interface WarehouseNotifier {
  mapChanged(notice: WarehouseMapChangedNotice): Promise<void>;
  warehouseUpdated(notice: WarehouseUpdatedNotice): Promise<void>;
  warehouseDeleted(notice: WarehouseDeletedNotice): Promise<void>;
}
