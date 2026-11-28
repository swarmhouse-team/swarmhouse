import type { CachePort } from '../../../../../cache/application/ports/cache.port';
import type { Clock } from '../../../../../common/application/clock';
import type { LoggerPort } from '../../../../../common/application/logger.port';
import { Warehouse } from '../../../domain/entities/warehouse';
import { invalidateWarehouseCache } from '../../cache/invalidate-warehouse-cache';
import { WarehouseNotFoundError } from '../../errors/application.errors';
import type { Transaction } from '../../../../../common/application/transaction';
import type { WarehouseRepository } from '../../ports/repositories/warehouse.repository';
import type { WarehouseNotifier } from '../../ports/system/warehouse-notifier';
import type { UpdateWarehouseInput, UpdateWarehouseResult } from './update-warehouse.types';

/**
 * Renames a warehouse inside one transaction. The map is not touched.
 * A no-op returns the name observed on read. A later concurrent rename is allowed.
 */
export class UpdateWarehouse {
  constructor(
    private readonly transaction: Transaction,
    private readonly warehouses: WarehouseRepository,
    private readonly clock: Clock,
    private readonly cache: CachePort,
    private readonly logger: LoggerPort,
    private readonly notifier: WarehouseNotifier,
  ) {}

  async execute(input: UpdateWarehouseInput): Promise<UpdateWarehouseResult> {
    return this.transaction.run(async () => {
      const record = await this.warehouses.findById(input.warehouseId);
      if (!record) {
        throw new WarehouseNotFoundError({ warehouseId: input.warehouseId });
      }

      const current = Warehouse.create(record.id, record.name);
      const renamed = current.rename(input.name);
      if (renamed.name.value === current.name.value) {
        return { warehouseId: current.id, name: current.name.value };
      }

      const saved = await this.warehouses.save(renamed, this.clock.now());
      if (saved.status === 'not_found') {
        throw new WarehouseNotFoundError({ warehouseId: input.warehouseId });
      }

      const warehouseId = renamed.id;
      this.transaction.afterCommit(() =>
        invalidateWarehouseCache(this.cache, this.logger, [warehouseId]),
      );
      this.transaction.afterCommit(() => this.notifier.warehouseUpdated({ warehouseId }));
      this.transaction.afterCommit(() => this.logger.info('warehouse.renamed', { warehouseId }));
      return { warehouseId, name: renamed.name.value };
    });
  }
}
