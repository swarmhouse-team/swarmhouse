import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { CreateWarehouse } from '../../../src/warehouse/application/commands/create-warehouse/create-warehouse.use-case';
import { DeleteWarehouse } from '../../../src/warehouse/application/commands/delete-warehouse/delete-warehouse.use-case';
import { EditWarehouseMap } from '../../../src/warehouse/application/commands/edit-warehouse-map/edit-warehouse-map.use-case';
import type { IdGenerator } from '../../../src/warehouse/application/ports/system/id-generator';
import { WarehouseMap } from '../../../src/warehouse/domain/entities/warehouse-map';
import { Warehouse } from '../../../src/warehouse/domain/entities/warehouse';
import { Position } from '../../../src/warehouse/domain/vo/position';
import { PrismaUnitOfWork } from '../../../src/warehouse/infrastructure/prisma/transaction/prisma-unit-of-work';
import { PrismaWarehouseMapRepository } from '../../../src/warehouse/infrastructure/prisma/repositories/prisma-warehouse-map.repository';
import { PrismaWarehouseRepository } from '../../../src/warehouse/infrastructure/prisma/repositories/prisma-warehouse.repository';
import { disconnectTestPrisma, getTestPrisma } from '../support/test-database';
import { cleanWarehouseTables } from './clean-warehouse-tables';

const KEPT_WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';
const NEW_WAREHOUSE_ID = '77777777-7777-4111-8111-77777777777a';
const MAP_ID = '22222222-2222-7111-8111-22222222222b';
const ROBOT_ID = '33333333-3333-4111-8111-33333333333c';

function fixedIds(ids: readonly string[]): IdGenerator {
  let index = 0;
  return {
    next() {
      const id = ids[index];
      index += 1;
      if (id === undefined) {
        throw new Error('The id stub has no further ids');
      }
      return id;
    },
  };
}

describe('warehouse use cases in PrismaUnitOfWork', () => {
  const prisma = () => getTestPrisma();
  const unitOfWork = () => new PrismaUnitOfWork(prisma());
  const warehouses = () => new PrismaWarehouseRepository(prisma());
  const maps = () => new PrismaWarehouseMapRepository(prisma());

  beforeEach(async () => {
    await cleanWarehouseTables();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it('rolls back a new warehouse when the map id is already stored', async () => {
    const kept = Warehouse.create(KEPT_WAREHOUSE_ID, 'Kept');
    const map = WarehouseMap.create(MAP_ID, KEPT_WAREHOUSE_ID);
    await warehouses().insert(kept);
    await maps().insert(map);
    const useCase = new CreateWarehouse(unitOfWork(), fixedIds([NEW_WAREHOUSE_ID, MAP_ID]));

    await expect(useCase.execute({ name: 'Side' })).rejects.toBeInstanceOf(Error);

    expect(await warehouses().findById(NEW_WAREHOUSE_ID)).toBeNull();
    expect(await warehouses().findById(KEPT_WAREHOUSE_ID)).toEqual({
      id: KEPT_WAREHOUSE_ID,
      name: 'Kept',
    });
    expect(await maps().findById(MAP_ID)).toEqual({ snapshot: map.snapshot(), version: 0 });
  });

  it('restores a deleted map when the callback throws, then deletes through the use case', async () => {
    await warehouses().insert(Warehouse.create(KEPT_WAREHOUSE_ID, 'Kept'));
    const map = WarehouseMap.create(MAP_ID, KEPT_WAREHOUSE_ID);
    await maps().insert(map);
    const failure = new Error('stop delete');

    await expect(
      unitOfWork().execute(async (tx) => {
        await tx.maps.deleteByWarehouseId(KEPT_WAREHOUSE_ID);
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(await maps().findById(MAP_ID)).toEqual({ snapshot: map.snapshot(), version: 0 });
    expect(await warehouses().findById(KEPT_WAREHOUSE_ID)).toEqual({
      id: KEPT_WAREHOUSE_ID,
      name: 'Kept',
    });

    await new DeleteWarehouse(unitOfWork()).execute({ warehouseId: KEPT_WAREHOUSE_ID });

    expect(await warehouses().findById(KEPT_WAREHOUSE_ID)).toBeNull();
    expect(await maps().findByWarehouseId(KEPT_WAREHOUSE_ID)).toBeNull();
  });

  it('deletes a warehouse that has no map', async () => {
    await warehouses().insert(Warehouse.create(KEPT_WAREHOUSE_ID, 'Kept'));

    await new DeleteWarehouse(unitOfWork()).execute({ warehouseId: KEPT_WAREHOUSE_ID });

    expect(await warehouses().findById(KEPT_WAREHOUSE_ID)).toBeNull();
  });

  it('does not change the stored map when a robot moves onto its current cell', async () => {
    await warehouses().insert(Warehouse.create(KEPT_WAREHOUSE_ID, 'Kept'));
    const map = WarehouseMap.create(MAP_ID, KEPT_WAREHOUSE_ID);
    map.placeRobot(ROBOT_ID, 'Robot', Position.create(2, 2));
    await maps().insert(map);
    const useCase = new EditWarehouseMap(unitOfWork(), fixedIds([]));

    const result = await useCase.execute({
      mapId: MAP_ID,
      expectedVersion: 0,
      operation: { type: 'moveRobot', robotId: ROBOT_ID, position: { x: 2, y: 2 } },
    });

    expect(result.changed).toBe(false);
    expect(result.version).toBe(0);
    expect(await maps().findById(MAP_ID)).toEqual({ snapshot: map.snapshot(), version: 0 });
  });
});
