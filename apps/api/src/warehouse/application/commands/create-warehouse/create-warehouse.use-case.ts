import type { CachePort } from '../../../../cache/application/ports/cache.port';
import { Warehouse } from '../../../domain/entities/warehouse';
import { WarehouseMap } from '../../../domain/entities/warehouse-map';
import { invalidateWarehouseCache } from '../../cache/invalidate-warehouse-cache';
import type { Clock } from '../../ports/system/clock';
import type { IdGenerator } from '../../ports/system/id-generator';
import type { LoggerPort } from '../../ports/system/logger.port';
import type { UnitOfWork } from '../../ports/system/unit-of-work';
import type { CreateWarehouseInput, CreateWarehouseResult } from './create-warehouse.types';

/** Creates a warehouse and its single empty map in one transaction. */
export class CreateWarehouse {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly cache: CachePort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(input: CreateWarehouseInput): Promise<CreateWarehouseResult> {
    const warehouse = Warehouse.create(this.ids.next(), input.name);
    const map = WarehouseMap.create(this.ids.next(), warehouse.id);
    const recordedAt = this.clock.now();

    await this.unitOfWork.execute(async (tx) => {
      await tx.warehouses.insert(warehouse, recordedAt);
      await tx.maps.insert(map);
    });

    await invalidateWarehouseCache(this.cache, this.logger, []);

    const result: CreateWarehouseResult = {
      warehouseId: warehouse.id,
      name: warehouse.name.value,
      mapId: map.id,
      version: 0,
    };

    this.logger.info('warehouse.created', {
      warehouseId: result.warehouseId,
      mapId: result.mapId,
      version: result.version,
    });

    return result;
  }
}
