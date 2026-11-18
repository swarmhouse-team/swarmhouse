import { Module } from '@nestjs/common';

import { CacheModule } from '../../cache/cache.module';
import { CachePort } from '../../cache/application/ports/cache.port';
import { NestjsLogger, provideLogger } from '../../common/infrastructure/nestjs-logger';
import { SystemClock } from '../../common/infrastructure/system-clock';
import { UuidV7IdGenerator } from '../../common/infrastructure/uuid-v7-id-generator';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWarehouse } from './application/commands/create-warehouse/create-warehouse.use-case';
import { DeleteWarehouse } from './application/commands/delete-warehouse/delete-warehouse.use-case';
import { EditWarehouseMap } from './application/commands/edit-warehouse-map/edit-warehouse-map.use-case';
import { UpdateWarehouse } from './application/commands/update-warehouse/update-warehouse.use-case';
import { GetWarehouseMap } from './application/queries/get-warehouse-map/get-warehouse-map.use-case';
import { GetWarehouse } from './application/queries/get-warehouse/get-warehouse.use-case';
import { ListWarehouses } from './application/queries/list-warehouses/list-warehouses.use-case';
import { PrismaWarehouseMapRepository } from './infrastructure/prisma/repositories/prisma-warehouse-map.repository';
import { PrismaWarehouseRepository } from './infrastructure/prisma/repositories/prisma-warehouse.repository';
import { WarehouseUnitOfWork } from './infrastructure/prisma/transaction/warehouse-unit-of-work';
import { SocketIoWarehouseNotifier } from './infrastructure/realtime/socket-io-warehouse-notifier';
import { WAREHOUSE_EXISTENCE } from './infrastructure/realtime/warehouse-existence';
import { WarehouseSubscriptionBook } from './infrastructure/realtime/warehouse-subscription.book';
import { WarehouseMapsController } from './presentation/http/warehouse-maps.controller';
import { WarehousesController } from './presentation/http/warehouses.controller';
import { WarehouseGateway } from './presentation/realtime/warehouse.gateway';

/** Warehouse HTTP, the `/warehouse` socket, and the use cases behind them. */
@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [WarehousesController, WarehouseMapsController],
  providers: [
    {
      provide: WarehouseUnitOfWork,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new WarehouseUnitOfWork(prisma),
    },
    {
      provide: UuidV7IdGenerator,
      inject: [],
      useFactory: () => new UuidV7IdGenerator(),
    },
    provideLogger('WarehouseApplication'),
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
      inject: [WarehouseUnitOfWork, UuidV7IdGenerator, SystemClock, CachePort, NestjsLogger],
      useFactory: (
        unitOfWork: WarehouseUnitOfWork,
        ids: UuidV7IdGenerator,
        clock: SystemClock,
        cache: CachePort,
        logger: NestjsLogger,
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
      inject: [
        WarehouseUnitOfWork,
        UuidV7IdGenerator,
        NestjsLogger,
        SocketIoWarehouseNotifier,
      ],
      useFactory: (
        unitOfWork: WarehouseUnitOfWork,
        ids: UuidV7IdGenerator,
        logger: NestjsLogger,
        notifier: SocketIoWarehouseNotifier,
      ) => new EditWarehouseMap(unitOfWork, ids, logger, notifier),
    },
    {
      provide: UpdateWarehouse,
      inject: [
        WarehouseUnitOfWork,
        SystemClock,
        CachePort,
        NestjsLogger,
        SocketIoWarehouseNotifier,
      ],
      useFactory: (
        unitOfWork: WarehouseUnitOfWork,
        clock: SystemClock,
        cache: CachePort,
        logger: NestjsLogger,
        notifier: SocketIoWarehouseNotifier,
      ) => new UpdateWarehouse(unitOfWork, clock, cache, logger, notifier),
    },
    {
      provide: DeleteWarehouse,
      inject: [WarehouseUnitOfWork, CachePort, NestjsLogger, SocketIoWarehouseNotifier],
      useFactory: (
        unitOfWork: WarehouseUnitOfWork,
        cache: CachePort,
        logger: NestjsLogger,
        notifier: SocketIoWarehouseNotifier,
      ) => new DeleteWarehouse(unitOfWork, cache, logger, notifier),
    },
    {
      provide: WarehouseSubscriptionBook,
      useFactory: () => new WarehouseSubscriptionBook(),
    },
    SocketIoWarehouseNotifier,
    {
      provide: WAREHOUSE_EXISTENCE,
      useExisting: PrismaWarehouseRepository,
    },
    WarehouseGateway,
  ],
})
export class WarehouseModule {}
