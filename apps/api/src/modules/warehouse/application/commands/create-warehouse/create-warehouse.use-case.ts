import type { CachePort } from '../../../../../cache/application/ports/cache.port';
import type { Clock } from '../../../../../common/application/clock';
import type { IdGenerator } from '../../../../../common/application/id-generator';
import type { LoggerPort } from '../../../../../common/application/logger.port';
import { Warehouse } from '../../../domain/entities/warehouse';
import { WarehouseMap } from '../../../domain/entities/warehouse-map';
import { invalidateWarehouseCache } from '../../cache/invalidate-warehouse-cache';
import type { Transaction } from '../../../../../common/application/transaction';
import type { WarehouseRepository } from '../../ports/repositories/warehouse.repository';
import type { WarehouseMapRepository } from '../../ports/repositories/warehouse-map.repository';
import type { CreateWarehouseInput, CreateWarehouseResult } from './create-warehouse.types';

/** Creates a warehouse and its single empty map in one transaction. */
export class CreateWarehouse {
  constructor(
    private readonly transaction: Transaction,
    private readonly warehouses: WarehouseRepository,
    private readonly maps: WarehouseMapRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly cache: CachePort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(input: CreateWarehouseInput): Promise<CreateWarehouseResult> {
    const warehouse = Warehouse.create(this.ids.next(), input.name);
    const map = WarehouseMap.create(this.ids.next(), warehouse.id);
    const recordedAt = this.clock.now();

    return this.transaction.run(async () => {
      await this.warehouses.insert(warehouse, recordedAt);
      await this.maps.insert(map);
      this.transaction.afterCommit(() => invalidateWarehouseCache(this.cache, this.logger, []));

      const result: CreateWarehouseResult = {
        warehouseId: warehouse.id,
        name: warehouse.name.value,
        mapId: map.id,
        version: 0,
      };

      this.transaction.afterCommit(() =>
        this.logger.info('warehouse.created', {
          warehouseId: result.warehouseId,
          mapId: result.mapId,
          version: result.version,
        }),
      );

      return result;
    });
  }
}
