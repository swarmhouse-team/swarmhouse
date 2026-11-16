import { Module } from '@nestjs/common';

import { CacheModule } from '../../cache/cache.module';
import { CachePort } from '../../cache/application/ports/cache.port';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWarehouse } from '../application/commands/create-warehouse/create-warehouse.use-case';
import { DeleteWarehouse } from '../application/commands/delete-warehouse/delete-warehouse.use-case';
import { EditWarehouseMap } from '../application/commands/edit-warehouse-map/edit-warehouse-map.use-case';
import { UpdateWarehouse } from '../application/commands/update-warehouse/update-warehouse.use-case';
import { GetWarehouseMap } from '../application/queries/get-warehouse-map/get-warehouse-map.use-case';
import { GetWarehouse } from '../application/queries/get-warehouse/get-warehouse.use-case';
import { ListWarehouses } from '../application/queries/list-warehouses/list-warehouses.use-case';
import { PrismaWarehouseMapRepository } from './prisma/repositories/prisma-warehouse-map.repository';
import { PrismaWarehouseRepository } from './prisma/repositories/prisma-warehouse.repository';
import { PrismaUnitOfWork } from './prisma/transaction/prisma-unit-of-work';
import { NestjsWarehouseLogger } from './system/nestjs-warehouse-logger';
import { SystemClock } from './system/system-clock';
import { UuidV7IdGenerator } from './system/uuid-v7-id-generator';

/** Composition root for warehouse commands and read queries. Transport stays outside. */
@Module({
  imports: [PrismaModule, CacheModule],
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
      provide: NestjsWarehouseLogger,
      inject: [],
      useFactory: () => new NestjsWarehouseLogger(),
    },
    {
      provide: SystemClock,
      inject: [],
      useFactory: () => new SystemClock(),
    },
    {
      provide: PrismaWarehouseRepository,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaWarehouseRepository(prisma),
    },
    {
      provide: PrismaWarehouseMapRepository,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaWarehouseMapRepository(prisma),
    },
    {
      provide: CreateWarehouse,
      inject: [PrismaUnitOfWork, UuidV7IdGenerator, SystemClock, CachePort, NestjsWarehouseLogger],
      useFactory: (
        unitOfWork: PrismaUnitOfWork,
        ids: UuidV7IdGenerator,
        clock: SystemClock,
        cache: CachePort,
        logger: NestjsWarehouseLogger,
      ) => new CreateWarehouse(unitOfWork, ids, clock, cache, logger),
    },
    {
      provide: GetWarehouse,
      inject: [PrismaWarehouseRepository, CachePort],
      useFactory: (warehouses: PrismaWarehouseRepository, cache: CachePort) =>
        new GetWarehouse(warehouses, cache),
    },
    {
      provide: ListWarehouses,
      inject: [PrismaWarehouseRepository, CachePort],
      useFactory: (warehouses: PrismaWarehouseRepository, cache: CachePort) =>
        new ListWarehouses(warehouses, cache),
    },
    {
      provide: GetWarehouseMap,
      inject: [PrismaWarehouseMapRepository],
      useFactory: (maps: PrismaWarehouseMapRepository) => new GetWarehouseMap(maps),
    },
    {
      provide: EditWarehouseMap,
      inject: [PrismaUnitOfWork, UuidV7IdGenerator, NestjsWarehouseLogger],
      useFactory: (
        unitOfWork: PrismaUnitOfWork,
        ids: UuidV7IdGenerator,
        logger: NestjsWarehouseLogger,
      ) => new EditWarehouseMap(unitOfWork, ids, logger),
    },
    {
      provide: UpdateWarehouse,
      inject: [PrismaUnitOfWork, SystemClock, CachePort, NestjsWarehouseLogger],
      useFactory: (
        unitOfWork: PrismaUnitOfWork,
        clock: SystemClock,
        cache: CachePort,
        logger: NestjsWarehouseLogger,
      ) => new UpdateWarehouse(unitOfWork, clock, cache, logger),
    },
    {
      provide: DeleteWarehouse,
      inject: [PrismaUnitOfWork, CachePort, NestjsWarehouseLogger],
      useFactory: (unitOfWork: PrismaUnitOfWork, cache: CachePort, logger: NestjsWarehouseLogger) =>
        new DeleteWarehouse(unitOfWork, cache, logger),
    },
  ],
  exports: [
    CreateWarehouse,
    GetWarehouse,
    ListWarehouses,
    GetWarehouseMap,
    EditWarehouseMap,
    UpdateWarehouse,
    DeleteWarehouse,
    NestjsWarehouseLogger,
  ],
})
export class WarehouseInfrastructureModule {}
