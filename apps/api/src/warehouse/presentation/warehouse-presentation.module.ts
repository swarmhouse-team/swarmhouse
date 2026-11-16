import { Module } from '@nestjs/common';

import { WarehouseInfrastructureModule } from '../infrastructure/warehouse-infrastructure.module';
import { WarehouseMapsController } from './http/warehouse-maps.controller';
import { WarehousesController } from './http/warehouses.controller';

/** Warehouse HTTP. Use cases come from infrastructure; this module does not redeclare their providers. */
@Module({
  imports: [WarehouseInfrastructureModule],
  controllers: [WarehousesController, WarehouseMapsController],
})
export class WarehousePresentationModule {}
