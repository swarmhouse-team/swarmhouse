import { Module } from '@nestjs/common';

import { CacheModule } from '../../cache/cache.module';
import { CachePort } from '../../cache/application/ports/cache.port';
import { NestjsLogger, provideLogger } from '../../common/infrastructure/nestjs-logger';
import { SystemClock } from '../../common/infrastructure/system-clock';
import { UuidV7IdGenerator } from '../../common/infrastructure/uuid-v7-id-generator';
import { TransactionModule } from '../../common/transaction.module';
import { Transaction } from '../../common/application/transaction';
import { PrismaTransaction } from '../../common/infrastructure/prisma-transaction';
import { CreateWarehouse } from './application/commands/create-warehouse/create-warehouse.use-case';
import { DeleteWarehouse } from './application/commands/delete-warehouse/delete-warehouse.use-case';
import { EditWarehouseMap } from './application/commands/edit-warehouse-map/edit-warehouse-map.use-case';
import { UpdateWarehouse } from './application/commands/update-warehouse/update-warehouse.use-case';
import { GetWarehouseMap } from './application/queries/get-warehouse-map/get-warehouse-map.use-case';
import { GetWarehouse } from './application/queries/get-warehouse/get-warehouse.use-case';
import { ListWarehouses } from './application/queries/list-warehouses/list-warehouses.use-case';
import { PrismaWarehouseMapRepository } from './infrastructure/prisma/repositories/prisma-warehouse-map.repository';
import { PrismaWarehouseRepository } from './infrastructure/prisma/repositories/prisma-warehouse.repository';
import { SocketIoWarehouseNotifier } from './infrastructure/realtime/socket-io-warehouse-notifier';
import { WarehouseRealtimeModule } from '../warehouse-realtime/warehouse-realtime.module';
import { WarehouseMapsController } from './presentation/http/warehouse-maps.controller';
import { WarehousesController } from './presentation/http/warehouses.controller';
import { WarehouseGateway } from './presentation/realtime/warehouse.gateway';

/** Warehouse HTTP, the `/warehouse` socket, and the use cases behind them. */
@Module({
  imports: [TransactionModule, CacheModule, WarehouseRealtimeModule],
  controllers: [WarehousesController, WarehouseMapsController],
  providers: [
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
      inject: [PrismaTransaction],
      useFactory: (transaction: PrismaTransaction) => new PrismaWarehouseRepository(transaction),
    },
    {
      provide: PrismaWarehouseMapRepository,
      inject: [PrismaTransaction],
      useFactory: (transaction: PrismaTransaction) => new PrismaWarehouseMapRepository(transaction),
    },
    {
      provide: CreateWarehouse,
      inject: [
        Transaction,
        PrismaWarehouseRepository,
        PrismaWarehouseMapRepository,
        UuidV7IdGenerator,
        SystemClock,
        CachePort,
        NestjsLogger,
      ],
      useFactory: (
        transaction: Transaction,
        warehouses: PrismaWarehouseRepository,
        maps: PrismaWarehouseMapRepository,
        ids: UuidV7IdGenerator,
        clock: SystemClock,
        cache: CachePort,
        logger: NestjsLogger,
      ) => new CreateWarehouse(transaction, warehouses, maps, ids, clock, cache, logger),
    },
    {
      provide: GetWarehouse,
      inject: [Transaction, PrismaWarehouseRepository, CachePort],
      useFactory: (
        transaction: Transaction,
        warehouses: PrismaWarehouseRepository,
        cache: CachePort,
      ) => new GetWarehouse(transaction, warehouses, cache),
    },
    {
      provide: ListWarehouses,
      inject: [Transaction, PrismaWarehouseRepository, CachePort],
      useFactory: (
        transaction: Transaction,
        warehouses: PrismaWarehouseRepository,
        cache: CachePort,
      ) => new ListWarehouses(transaction, warehouses, cache),
    },
    {
      provide: GetWarehouseMap,
      inject: [PrismaWarehouseMapRepository],
      useFactory: (maps: PrismaWarehouseMapRepository) => new GetWarehouseMap(maps),
    },
    {
      provide: EditWarehouseMap,
      inject: [
        Transaction,
        PrismaWarehouseMapRepository,
        UuidV7IdGenerator,
        NestjsLogger,
        SocketIoWarehouseNotifier,
      ],
      useFactory: (
        transaction: Transaction,
        maps: PrismaWarehouseMapRepository,
        ids: UuidV7IdGenerator,
        logger: NestjsLogger,
        notifier: SocketIoWarehouseNotifier,
      ) => new EditWarehouseMap(transaction, maps, ids, logger, notifier),
    },
    {
      provide: UpdateWarehouse,
      inject: [
        Transaction,
        PrismaWarehouseRepository,
        SystemClock,
        CachePort,
        NestjsLogger,
        SocketIoWarehouseNotifier,
      ],
      useFactory: (
        transaction: Transaction,
        warehouses: PrismaWarehouseRepository,
        clock: SystemClock,
        cache: CachePort,
        logger: NestjsLogger,
        notifier: SocketIoWarehouseNotifier,
      ) => new UpdateWarehouse(transaction, warehouses, clock, cache, logger, notifier),
    },
    {
      provide: DeleteWarehouse,
      inject: [
        Transaction,
        PrismaWarehouseRepository,
        PrismaWarehouseMapRepository,
        CachePort,
        NestjsLogger,
        SocketIoWarehouseNotifier,
      ],
      useFactory: (
        transaction: Transaction,
        warehouses: PrismaWarehouseRepository,
        maps: PrismaWarehouseMapRepository,
        cache: CachePort,
        logger: NestjsLogger,
        notifier: SocketIoWarehouseNotifier,
      ) => new DeleteWarehouse(transaction, warehouses, maps, cache, logger, notifier),
    },
    SocketIoWarehouseNotifier,
    WarehouseGateway,
  ],
})
export class WarehouseModule {}
