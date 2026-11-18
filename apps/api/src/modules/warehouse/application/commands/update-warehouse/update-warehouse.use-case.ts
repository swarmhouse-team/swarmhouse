import type { CachePort } from '../../../../../cache/application/ports/cache.port';
import type { Clock } from '../../../../../common/application/clock';
import type { LoggerPort } from '../../../../../common/application/logger.port';
import { publishAfterCommit } from '../../../../../common/application/publish-after-commit';
import { Warehouse } from '../../../domain/entities/warehouse';
import { invalidateWarehouseCache } from '../../cache/invalidate-warehouse-cache';
import { WarehouseNotFoundError } from '../../errors/application.errors';
import type { WarehouseUnitOfWork } from '../../ports/system/warehouse-unit-of-work';
import type { WarehouseNotifier } from '../../ports/system/warehouse-notifier';
import type { UpdateWarehouseInput, UpdateWarehouseResult } from './update-warehouse.types';

/**
 * Renames a warehouse inside one unit of work. The map is not touched.
 * A no-op returns the name observed on read. A later concurrent rename is allowed.
 */
export class UpdateWarehouse {
  constructor(
    private readonly unitOfWork: WarehouseUnitOfWork,
    private readonly clock: Clock,
    private readonly cache: CachePort,
    private readonly logger: LoggerPort,
    private readonly notifier: WarehouseNotifier,
  ) {}

  async execute(input: UpdateWarehouseInput): Promise<UpdateWarehouseResult> {
    const outcome = await this.unitOfWork.execute(async (tx) => {
      const record = await tx.warehouses.findById(input.warehouseId);
      if (!record) {
        throw new WarehouseNotFoundError({ warehouseId: input.warehouseId });
      }

      const current = Warehouse.create(record.id, record.name);
      const renamed = current.rename(input.name);
      if (renamed.name.value === current.name.value) {
        return {
          changed: false,
          result: { warehouseId: current.id, name: current.name.value },
        };
      }

      const saved = await tx.warehouses.save(renamed, this.clock.now());
      if (saved.status === 'not_found') {
        throw new WarehouseNotFoundError({ warehouseId: input.warehouseId });
      }

      return {
        changed: true,
        result: { warehouseId: renamed.id, name: renamed.name.value },
      };
    });

    if (outcome.changed) {
      const warehouseId = outcome.result.warehouseId;
      await publishAfterCommit(this.logger, {
        invalidate: () => invalidateWarehouseCache(this.cache, this.logger, [warehouseId]),
        invalidateFailed: 'warehouse.cache.invalidate_failed',
        publish: () => this.notifier.warehouseUpdated({ warehouseId }),
        publishFailed: 'warehouse.realtime.publish_failed',
      });
      this.logger.info('warehouse.renamed', { warehouseId });
    }

    return outcome.result;
  }
}
