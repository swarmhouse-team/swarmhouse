import { afterAll, beforeEach, describe, expect, it } from 'vitest';

const RECORDED_AT = new Date('2026-01-01T00:00:00.000Z');

import { CachePort } from '../../../src/cache/application/ports/cache.port';
import { CreateWarehouse } from '../../../src/modules/warehouse/application/commands/create-warehouse/create-warehouse.use-case';
import { DeleteWarehouse } from '../../../src/modules/warehouse/application/commands/delete-warehouse/delete-warehouse.use-case';
import { EditWarehouseMap } from '../../../src/modules/warehouse/application/commands/edit-warehouse-map/edit-warehouse-map.use-case';
import type { IdGenerator } from '../../../src/modules/warehouse/application/ports/system/id-generator';
import type { LoggerPort } from '../../../src/modules/warehouse/application/ports/system/logger.port';
import type { WarehouseNotifier } from '../../../src/modules/warehouse/application/ports/system/warehouse-notifier';
import { WarehouseMap } from '../../../src/modules/warehouse/domain/entities/warehouse-map';
import { Warehouse } from '../../../src/modules/warehouse/domain/entities/warehouse';
import { Position } from '../../../src/common/domain/position';
import { PrismaUnitOfWork } from '../../../src/modules/warehouse/infrastructure/prisma/transaction/prisma-unit-of-work';
import { PrismaWarehouseMapRepository } from '../../../src/modules/warehouse/infrastructure/prisma/repositories/prisma-warehouse-map.repository';
import { SystemClock } from '../../../src/modules/warehouse/infrastructure/system/system-clock';
import { PrismaWarehouseRepository } from '../../../src/modules/warehouse/infrastructure/prisma/repositories/prisma-warehouse.repository';
import { disconnectTestPrisma, getTestPrisma } from '../support/test-database';
import { cleanWarehouseTables } from './clean-warehouse-tables';

const KEPT_WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';
const NEW_WAREHOUSE_ID = '77777777-7777-4111-8111-77777777777a';
const MAP_ID = '22222222-2222-7111-8111-22222222222b';
const ROBOT_ID = '33333333-3333-4111-8111-33333333333c';

const silentLogger: LoggerPort = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

const silentNotifier: WarehouseNotifier = {
  async mapChanged() {},
  async warehouseUpdated() {},
  async warehouseDeleted() {},
};

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

class UnusedCache extends CachePort {
  get(): Promise<null> {
    return Promise.resolve(null);
  }

  set(): Promise<void> {
    return Promise.resolve();
  }

  delete(): Promise<void> {
    return Promise.resolve();
  }
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
    await warehouses().insert(kept, RECORDED_AT);
    await maps().insert(map);
    const useCase = new CreateWarehouse(
      unitOfWork(),
      fixedIds([NEW_WAREHOUSE_ID, MAP_ID]),
      new SystemClock(),
      new UnusedCache(),
      silentLogger,
    );

    await expect(useCase.execute({ name: 'Side' })).rejects.toBeInstanceOf(Error);

    expect(await warehouses().findById(NEW_WAREHOUSE_ID)).toBeNull();
    expect(await warehouses().findById(KEPT_WAREHOUSE_ID)).toEqual({
      id: KEPT_WAREHOUSE_ID,
      name: 'Kept',
      createdAt: RECORDED_AT,
      updatedAt: RECORDED_AT,
    });
    expect(await maps().findById(MAP_ID)).toEqual({ snapshot: map.snapshot(), version: 0 });
  });

  it('restores a deleted map when the callback throws, then deletes through the use case', async () => {
    await warehouses().insert(Warehouse.create(KEPT_WAREHOUSE_ID, 'Kept'), RECORDED_AT);
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
      createdAt: RECORDED_AT,
      updatedAt: RECORDED_AT,
    });

    await new DeleteWarehouse(
      unitOfWork(),
      new UnusedCache(),
      silentLogger,
      silentNotifier,
    ).execute({
      warehouseId: KEPT_WAREHOUSE_ID,
    });

    expect(await warehouses().findById(KEPT_WAREHOUSE_ID)).toBeNull();
    expect(await maps().findByWarehouseId(KEPT_WAREHOUSE_ID)).toBeNull();
  });

  it('deletes a warehouse that has no map', async () => {
    await warehouses().insert(Warehouse.create(KEPT_WAREHOUSE_ID, 'Kept'), RECORDED_AT);

    await new DeleteWarehouse(
      unitOfWork(),
      new UnusedCache(),
      silentLogger,
      silentNotifier,
    ).execute({
      warehouseId: KEPT_WAREHOUSE_ID,
    });

    expect(await warehouses().findById(KEPT_WAREHOUSE_ID)).toBeNull();
  });

  it('does not change the stored map when a robot moves onto its current cell', async () => {
    await warehouses().insert(Warehouse.create(KEPT_WAREHOUSE_ID, 'Kept'), RECORDED_AT);
    const map = WarehouseMap.create(MAP_ID, KEPT_WAREHOUSE_ID);
    map.placeRobot(ROBOT_ID, 'Robot', Position.create(2, 2));
    await maps().insert(map);
    const useCase = new EditWarehouseMap(unitOfWork(), fixedIds([]), silentLogger, silentNotifier);

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
