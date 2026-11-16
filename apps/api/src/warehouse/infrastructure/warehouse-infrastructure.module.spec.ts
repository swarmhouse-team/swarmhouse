import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { CacheModule } from '../../cache/cache.module';
import { CachePort } from '../../cache/application/ports/cache.port';
import { validateEnv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWarehouse } from '../application/commands/create-warehouse/create-warehouse.use-case';
import { DeleteWarehouse } from '../application/commands/delete-warehouse/delete-warehouse.use-case';
import { EditWarehouseMap } from '../application/commands/edit-warehouse-map/edit-warehouse-map.use-case';
import { UpdateWarehouse } from '../application/commands/update-warehouse/update-warehouse.use-case';
import { GetWarehouseMap } from '../application/queries/get-warehouse-map/get-warehouse-map.use-case';
import { GetWarehouse } from '../application/queries/get-warehouse/get-warehouse.use-case';
import { ListWarehouses } from '../application/queries/list-warehouses/list-warehouses.use-case';
import { WarehouseInfrastructureModule } from './warehouse-infrastructure.module';

describe('WarehouseInfrastructureModule', () => {
  it('gives every warehouse consumer the single CachePort from CacheModule', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: () =>
            validateEnv({
              NODE_ENV: 'test',
              DATABASE_URL: 'postgresql://localhost:5432/robots',
              CACHE_DRIVER: 'memory',
              CACHE_MEMORY_MAX_ENTRIES: '8',
            }),
        }),
        WarehouseInfrastructureModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $transaction: () => Promise.reject(new Error('The wiring test does not use the database')),
      })
      .compile();

    const fromCacheModule = moduleRef.select(CacheModule).get(CachePort);
    const fromWarehouseModule = moduleRef.select(WarehouseInfrastructureModule).get(CachePort);
    const consumers = [
      moduleRef.get(CreateWarehouse),
      moduleRef.get(UpdateWarehouse),
      moduleRef.get(DeleteWarehouse),
      moduleRef.get(GetWarehouse),
      moduleRef.get(ListWarehouses),
    ];

    expect(fromWarehouseModule).toBe(fromCacheModule);
    expect(consumers.map((consumer) => injectedCache(consumer))).toEqual([
      fromCacheModule,
      fromCacheModule,
      fromCacheModule,
      fromCacheModule,
      fromCacheModule,
    ]);
    expect(moduleRef.get(GetWarehouseMap)).toBeInstanceOf(GetWarehouseMap);
    expect(moduleRef.get(EditWarehouseMap)).toBeInstanceOf(EditWarehouseMap);
    expect(injectedCache(moduleRef.get(GetWarehouseMap))).toBeUndefined();
    await moduleRef.close();
  });
});

function injectedCache(instance: object): CachePort | undefined {
  if (!('cache' in instance)) {
    return undefined;
  }
  const cache: unknown = instance.cache;
  if (!(cache instanceof CachePort)) {
    throw new Error('consumer cache is not CachePort');
  }
  return cache;
}
