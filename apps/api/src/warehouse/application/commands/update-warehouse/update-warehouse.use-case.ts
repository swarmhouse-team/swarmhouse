import type { CachePort } from '../../../../cache/application/ports/cache.port';
import { Warehouse } from '../../../domain/entities/warehouse';
import { invalidateWarehouseCache } from '../../cache/invalidate-warehouse-cache';
import { WarehouseNotFoundError } from '../../errors/application.errors';
import type { Clock } from '../../ports/system/clock';
import type { LoggerPort } from '../../ports/system/logger.port';
import type { UnitOfWork } from '../../ports/system/unit-of-work';
import type { UpdateWarehouseInput, UpdateWarehouseResult } from './update-warehouse.types';

/**
 * Renames a warehouse inside one unit of work. The map is not touched.
 * A no-op returns the name observed on read. A later concurrent rename is allowed.
 */
export class UpdateWarehouse {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
    private readonly cache: CachePort,
    private readonly logger: LoggerPort,
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
      await invalidateWarehouseCache(this.cache, this.logger, [outcome.result.warehouseId]);
      this.logger.info('warehouse.renamed', { warehouseId: outcome.result.warehouseId });
    }

    return outcome.result;
  }
}
