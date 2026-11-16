import type {
  WarehouseDeletedNotice,
  WarehouseMapChangedNotice,
  WarehouseNotifier,
  WarehouseUpdatedNotice,
} from '../ports/system/warehouse-notifier';

export type WarehouseNotice =
  | { type: 'mapChanged'; notice: WarehouseMapChangedNotice }
  | { type: 'warehouseUpdated'; notice: WarehouseUpdatedNotice }
  | { type: 'warehouseDeleted'; notice: WarehouseDeletedNotice };

/** Test-only double: each call returns a fresh notifier and its own notices. */
export function createRecordingNotifier(): {
  notifier: WarehouseNotifier;
  notices: WarehouseNotice[];
} {
  const notices: WarehouseNotice[] = [];
  const notifier: WarehouseNotifier = {
    async mapChanged(notice) {
      notices.push({ type: 'mapChanged', notice });
    },
    async warehouseUpdated(notice) {
      notices.push({ type: 'warehouseUpdated', notice });
    },
    async warehouseDeleted(notice) {
      notices.push({ type: 'warehouseDeleted', notice });
    },
  };
  return { notifier, notices };
}
