import { Warehouse } from '../../../domain/entities/warehouse';
import { WarehouseNotFoundError } from '../../errors/application.errors';
import type { UnitOfWork } from '../../ports/system/unit-of-work';
import type { UpdateWarehouseInput, UpdateWarehouseResult } from './update-warehouse.types';

/** Renames a warehouse inside one unit of work. The map is not touched. */
export class UpdateWarehouse {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  async execute(input: UpdateWarehouseInput): Promise<UpdateWarehouseResult> {
    return this.unitOfWork.execute(async (tx) => {
      const record = await tx.warehouses.findById(input.warehouseId);
      if (!record) {
        throw new WarehouseNotFoundError({ warehouseId: input.warehouseId });
      }

      const current = Warehouse.create(record.id, record.name);
      const renamed = current.rename(input.name);
      if (renamed.name.value === current.name.value) {
        return { warehouseId: current.id, name: current.name.value };
      }

      const saved = await tx.warehouses.save(renamed);
      if (saved.status === 'not_found') {
        throw new WarehouseNotFoundError({ warehouseId: input.warehouseId });
      }

      return { warehouseId: renamed.id, name: renamed.name.value };
    });
  }
}
