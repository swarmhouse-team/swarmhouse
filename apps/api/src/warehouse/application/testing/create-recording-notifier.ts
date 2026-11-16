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
  failWith: (error: Error) => void;
} {
  const notices: WarehouseNotice[] = [];
  let failure: Error | undefined;
  const throwIfArmed = (): void => {
    if (failure) {
      throw failure;
    }
  };
  const notifier: WarehouseNotifier = {
    async mapChanged(notice) {
      notices.push({ type: 'mapChanged', notice });
      throwIfArmed();
    },
    async warehouseUpdated(notice) {
      notices.push({ type: 'warehouseUpdated', notice });
      throwIfArmed();
    },
    async warehouseDeleted(notice) {
      notices.push({ type: 'warehouseDeleted', notice });
      throwIfArmed();
    },
  };
  return {
    notifier,
    notices,
    failWith(error) {
      failure = error;
    },
  };
}
