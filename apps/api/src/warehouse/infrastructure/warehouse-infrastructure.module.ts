import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWarehouse } from '../application/commands/create-warehouse/create-warehouse.use-case';
import { DeleteWarehouse } from '../application/commands/delete-warehouse/delete-warehouse.use-case';
import { EditWarehouseMap } from '../application/commands/edit-warehouse-map/edit-warehouse-map.use-case';
import { UpdateWarehouse } from '../application/commands/update-warehouse/update-warehouse.use-case';
import { GetWarehouseMap } from '../application/queries/get-warehouse-map/get-warehouse-map.use-case';
import { PrismaWarehouseMapRepository } from './prisma/repositories/prisma-warehouse-map.repository';
import { PrismaUnitOfWork } from './prisma/transaction/prisma-unit-of-work';
import { UuidV7IdGenerator } from './system/uuid-v7-id-generator';

/** Composition root for warehouse commands and the read query. Transport stays outside. */
@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: PrismaUnitOfWork,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaUnitOfWork(prisma),
    },
    {
      provide: UuidV7IdGenerator,
      inject: [],
      useFactory: () => new UuidV7IdGenerator(),
    },
    {
      provide: PrismaWarehouseMapRepository,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaWarehouseMapRepository(prisma),
    },
    {
      provide: CreateWarehouse,
      inject: [PrismaUnitOfWork, UuidV7IdGenerator],
      useFactory: (unitOfWork: PrismaUnitOfWork, ids: UuidV7IdGenerator) =>
        new CreateWarehouse(unitOfWork, ids),
    },
    {
      provide: GetWarehouseMap,
      inject: [PrismaWarehouseMapRepository],
      useFactory: (maps: PrismaWarehouseMapRepository) => new GetWarehouseMap(maps),
    },
    {
      provide: EditWarehouseMap,
      inject: [PrismaUnitOfWork, UuidV7IdGenerator],
      useFactory: (unitOfWork: PrismaUnitOfWork, ids: UuidV7IdGenerator) =>
        new EditWarehouseMap(unitOfWork, ids),
    },
    {
      provide: UpdateWarehouse,
      inject: [PrismaUnitOfWork],
      useFactory: (unitOfWork: PrismaUnitOfWork) => new UpdateWarehouse(unitOfWork),
    },
    {
      provide: DeleteWarehouse,
      inject: [PrismaUnitOfWork],
      useFactory: (unitOfWork: PrismaUnitOfWork) => new DeleteWarehouse(unitOfWork),
    },
  ],
  exports: [CreateWarehouse, GetWarehouseMap, EditWarehouseMap, UpdateWarehouse, DeleteWarehouse],
})
export class WarehouseInfrastructureModule {}
