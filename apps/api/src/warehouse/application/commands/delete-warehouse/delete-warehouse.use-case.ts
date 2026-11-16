import { WarehouseNotFoundError } from '../../errors/application.errors';
import type { LoggerPort } from '../../ports/system/logger.port';
import type { UnitOfWork } from '../../ports/system/unit-of-work';
import type { DeleteWarehouseInput } from './delete-warehouse.types';

/** Deletes a warehouse and every map that belongs to it in one unit of work. */
export class DeleteWarehouse {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly logger: LoggerPort,
  ) {}

  async execute(input: DeleteWarehouseInput): Promise<void> {
    await this.unitOfWork.execute(async (tx) => {
      const record = await tx.warehouses.findById(input.warehouseId);
      if (!record) {
        throw new WarehouseNotFoundError({ warehouseId: input.warehouseId });
      }

      await tx.maps.deleteByWarehouseId(input.warehouseId);
      const deleted = await tx.warehouses.delete(input.warehouseId);
      if (deleted.status === 'not_found') {
        throw new WarehouseNotFoundError({ warehouseId: input.warehouseId });
      }
    });

    this.logger.info('warehouse.deleted', { warehouseId: input.warehouseId });
  }
}
