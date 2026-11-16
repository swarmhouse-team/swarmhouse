import { Module } from '@nestjs/common';

import { WarehouseInfrastructureModule } from '../infrastructure/warehouse-infrastructure.module';
import { WarehouseMapsController } from './http/warehouse-maps.controller';
import { WarehousesController } from './http/warehouses.controller';

/** HTTP склада. Use cases приходят из infrastructure, свои провайдеры не дублируются. */
@Module({
  imports: [WarehouseInfrastructureModule],
  controllers: [WarehousesController, WarehouseMapsController],
})
export class WarehousePresentationModule {}
