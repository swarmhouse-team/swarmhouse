import type { CachePort } from '../../../../../cache/application/ports/cache.port';
import type { LoggerPort } from '../../../../../common/application/logger.port';
import { publishAfterCommit } from '../../../../../common/application/publish-after-commit';
import { invalidateWarehouseCache } from '../../cache/invalidate-warehouse-cache';
import { WarehouseNotFoundError } from '../../errors/application.errors';
import type { WarehouseUnitOfWork } from '../../ports/system/warehouse-unit-of-work';
import type { WarehouseNotifier } from '../../ports/system/warehouse-notifier';
import type { DeleteWarehouseInput } from './delete-warehouse.types';

/** Deletes a warehouse and every map that belongs to it in one unit of work. */
export class DeleteWarehouse {
  constructor(
    private readonly unitOfWork: WarehouseUnitOfWork,
    private readonly cache: CachePort,
    private readonly logger: LoggerPort,
    private readonly notifier: WarehouseNotifier,
  ) {}

  async execute(input: DeleteWarehouseInput): Promise<void> {
    const warehouseId = await this.unitOfWork.execute(async (tx) => {
      const record = await tx.warehouses.findById(input.warehouseId);
      if (!record) {
        throw new WarehouseNotFoundError({ warehouseId: input.warehouseId });
      }

      await tx.maps.deleteByWarehouseId(input.warehouseId);
      const deleted = await tx.warehouses.delete(input.warehouseId);
      if (deleted.status === 'not_found') {
        throw new WarehouseNotFoundError({ warehouseId: input.warehouseId });
      }
      return record.id;
    });

    await publishAfterCommit(this.logger, {
      invalidate: () => invalidateWarehouseCache(this.cache, this.logger, [warehouseId]),
      invalidateFailed: 'warehouse.cache.invalidate_failed',
      publish: () => this.notifier.warehouseDeleted({ warehouseId }),
      publishFailed: 'warehouse.realtime.publish_failed',
    });
    this.logger.info('warehouse.deleted', { warehouseId });
  }
}
