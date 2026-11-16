import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { CreateWarehouse } from '../application/commands/create-warehouse/create-warehouse.use-case';
import { DeleteWarehouse } from '../application/commands/delete-warehouse/delete-warehouse.use-case';
import { EditWarehouseMap } from '../application/commands/edit-warehouse-map/edit-warehouse-map.use-case';
import { UpdateWarehouse } from '../application/commands/update-warehouse/update-warehouse.use-case';
import { GetWarehouseMap } from '../application/queries/get-warehouse-map/get-warehouse-map.use-case';
import { PrismaService } from '../../prisma/prisma.service';
import { WarehouseInfrastructureModule } from './warehouse-infrastructure.module';

describe('WarehouseInfrastructureModule', () => {
  it('resolves the five use cases without opening a database connection', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [WarehouseInfrastructureModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $transaction: () => Promise.reject(new Error('The wiring test does not use the database')),
      })
      .compile();

    expect(moduleRef.get(CreateWarehouse)).toBeInstanceOf(CreateWarehouse);
    expect(moduleRef.get(GetWarehouseMap)).toBeInstanceOf(GetWarehouseMap);
    expect(moduleRef.get(EditWarehouseMap)).toBeInstanceOf(EditWarehouseMap);
    expect(moduleRef.get(UpdateWarehouse)).toBeInstanceOf(UpdateWarehouse);
    expect(moduleRef.get(DeleteWarehouse)).toBeInstanceOf(DeleteWarehouse);
    await moduleRef.close();
  });
});
