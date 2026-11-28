import type { CachePort } from '../../../../../cache/application/ports/cache.port';
import type { LoggerPort } from '../../../../../common/application/logger.port';
import { invalidateWarehouseCache } from '../../cache/invalidate-warehouse-cache';
import { WarehouseNotFoundError } from '../../errors/application.errors';
import type { Transaction } from '../../../../../common/application/transaction';
import type { WarehouseRepository } from '../../ports/repositories/warehouse.repository';
import type { WarehouseMapRepository } from '../../ports/repositories/warehouse-map.repository';
import type { WarehouseNotifier } from '../../ports/system/warehouse-notifier';
import type { DeleteWarehouseInput } from './delete-warehouse.types';

/** Deletes a warehouse and every map that belongs to it in one transaction. */
export class DeleteWarehouse {
  constructor(
    private readonly transaction: Transaction,
    private readonly warehouses: WarehouseRepository,
    private readonly maps: WarehouseMapRepository,
    private readonly cache: CachePort,
    private readonly logger: LoggerPort,
    private readonly notifier: WarehouseNotifier,
  ) {}

  async execute(input: DeleteWarehouseInput): Promise<void> {
    return this.transaction.run(async () => {
      const record = await this.warehouses.findById(input.warehouseId);
      if (!record) {
        throw new WarehouseNotFoundError({ warehouseId: input.warehouseId });
      }

      await this.maps.deleteByWarehouseId(input.warehouseId);
      const deleted = await this.warehouses.delete(input.warehouseId);
      if (deleted.status === 'not_found') {
        throw new WarehouseNotFoundError({ warehouseId: input.warehouseId });
      }
      const warehouseId = record.id;
      this.transaction.afterCommit(() =>
        invalidateWarehouseCache(this.cache, this.logger, [warehouseId]),
      );
      this.transaction.afterCommit(() => this.notifier.warehouseDeleted({ warehouseId }));
      this.transaction.afterCommit(() => this.logger.info('warehouse.deleted', { warehouseId }));
    });
  }
}
