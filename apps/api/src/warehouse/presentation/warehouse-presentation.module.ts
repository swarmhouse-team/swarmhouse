import { Module } from '@nestjs/common';

import { WarehouseInfrastructureModule } from '../infrastructure/warehouse-infrastructure.module';
import { WarehouseMapsController } from './http/warehouse-maps.controller';
import { WarehousesController } from './http/warehouses.controller';
import { WarehouseGateway } from './realtime/warehouse.gateway';

/** Warehouse HTTP and the `/warehouse` socket. Use cases come from infrastructure. */
@Module({
  imports: [WarehouseInfrastructureModule],
  controllers: [WarehousesController, WarehouseMapsController],
  providers: [WarehouseGateway],
})
export class WarehousePresentationModule {}
