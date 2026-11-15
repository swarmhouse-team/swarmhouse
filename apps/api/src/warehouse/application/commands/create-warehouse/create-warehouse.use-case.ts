import { Warehouse } from '../../../domain/entities/warehouse';
import { WarehouseMap } from '../../../domain/entities/warehouse-map';
import type { IdGenerator } from '../../ports/system/id-generator';
import type { UnitOfWork } from '../../ports/system/unit-of-work';
import type { CreateWarehouseInput, CreateWarehouseResult } from './create-warehouse.types';

/** Creates a warehouse and its single empty map in one transaction. */
export class CreateWarehouse {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateWarehouseInput): Promise<CreateWarehouseResult> {
    const warehouse = Warehouse.create(this.ids.next(), input.name);
    const map = WarehouseMap.create(this.ids.next(), warehouse.id);

    await this.unitOfWork.execute(async (tx) => {
      await tx.warehouses.insert(warehouse);
      await tx.maps.insert(map);
    });

    return {
      warehouseId: warehouse.id,
      name: warehouse.name.value,
      mapId: map.id,
      version: 0,
    };
  }
}
