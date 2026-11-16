import { afterAll, beforeEach, describe, expect, it } from 'vitest';

const RECORDED_AT = new Date('2026-01-01T00:00:00.000Z');
const UPDATED_AT = new Date('2026-02-01T00:00:00.000Z');

import { GetWarehouseMap } from '../../../src/warehouse/application/queries/get-warehouse-map/get-warehouse-map.use-case';
import { CorruptedMapStateError } from '../../../src/warehouse/application/errors/application.errors';
import { WarehouseMap } from '../../../src/warehouse/domain/entities/warehouse-map';
import { Warehouse } from '../../../src/warehouse/domain/entities/warehouse';
import { StationType } from '../../../src/warehouse/domain/enums/station-type';
import { Position } from '../../../src/warehouse/domain/vo/position';
import { PrismaWarehouseMapRepository } from '../../../src/warehouse/infrastructure/prisma/repositories/prisma-warehouse-map.repository';
import { PrismaWarehouseRepository } from '../../../src/warehouse/infrastructure/prisma/repositories/prisma-warehouse.repository';
import { disconnectTestPrisma, getTestPrisma } from '../support/test-database';
import { cleanWarehouseTables } from './clean-warehouse-tables';

const WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';
const OTHER_WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111b';
const MAP_ID = '22222222-2222-7111-8111-22222222222b';
const OTHER_MAP_ID = '22222222-2222-7111-8111-22222222222c';
const ROBOT_ID = '33333333-3333-4111-8111-33333333333c';
const RECEIVING_ID = '44444444-4444-4111-8111-44444444444e';
const ISSUING_ID = '44444444-4444-4111-a111-444444444445';
const INTERMEDIATE_ID = '66666666-6666-4111-8111-66666666666d';

function filledMap(mapId = MAP_ID, warehouseId = WAREHOUSE_ID): WarehouseMap {
  const map = WarehouseMap.create(mapId, warehouseId);
  map.addObstacle(Position.create(1, 1));
  map.placeRobot(ROBOT_ID, 'Robot', Position.create(2, 2));
  map.placeStation(RECEIVING_ID, 'Receiving', StationType.Receiving, Position.create(3, 3));
  map.placeStation(ISSUING_ID, 'Issuing', StationType.Issuing, Position.create(4, 4));
  map.placeStation(INTERMEDIATE_ID, 'Buffer', StationType.Intermediate, Position.create(5, 5));
  return map;
}

describe('Prisma warehouse repositories', () => {
  const prisma = () => getTestPrisma();
  const warehouses = () => new PrismaWarehouseRepository(prisma());
  const maps = () => new PrismaWarehouseMapRepository(prisma());

  beforeEach(async () => {
    await cleanWarehouseTables();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it('round-trips a warehouse and a map at version 0', async () => {
    const warehouse = Warehouse.create(WAREHOUSE_ID, 'Main');
    const map = filledMap();
    await warehouses().insert(warehouse, RECORDED_AT);
    await maps().insert(map);

    const storedWarehouse = await warehouses().findById(WAREHOUSE_ID);
    const byId = await maps().findById(MAP_ID);
    const byWarehouse = await maps().findByWarehouseId(WAREHOUSE_ID);
    const row = await prisma().warehouseMapRecord.findUniqueOrThrow({ where: { id: MAP_ID } });

    expect(storedWarehouse).toEqual({
      id: WAREHOUSE_ID,
      name: 'Main',
      createdAt: RECORDED_AT,
      updatedAt: RECORDED_AT,
    });
    expect(byId).toEqual({ snapshot: map.snapshot(), version: 0 });
    expect(byWarehouse).toEqual(byId);
    expect(contentKeys(row.content)).toEqual([
      'height',
      'obstacles',
      'robots',
      'stations',
      'width',
    ]);
  });

  it('saves a new map body and bumps the version once', async () => {
    await warehouses().insert(Warehouse.create(WAREHOUSE_ID, 'Main'), RECORDED_AT);
    const map = filledMap();
    await maps().insert(map);
    map.moveRobot(ROBOT_ID, Position.create(6, 6));
    const before = map.snapshot();

    const saved = await maps().save(map, 0);

    expect(saved).toEqual({ status: 'saved', version: 1 });
    expect(map.snapshot()).toEqual(before);
    expect(await maps().findById(MAP_ID)).toEqual({ snapshot: before, version: 1 });
    expect((await maps().findById(MAP_ID))?.snapshot.warehouseId).toBe(WAREHOUSE_ID);
  });

  it('reports a conflict for a stale version and leaves the row unchanged', async () => {
    await warehouses().insert(Warehouse.create(WAREHOUSE_ID, 'Main'), RECORDED_AT);
    const map = filledMap();
    await maps().insert(map);
    const stored = map.snapshot();
    map.moveRobot(ROBOT_ID, Position.create(6, 6));

    const result = await maps().save(map, 4);

    expect(result).toEqual({ status: 'conflict', actualVersion: 0 });
    expect(await maps().findById(MAP_ID)).toEqual({ snapshot: stored, version: 0 });
  });

  it('does not create a map when saving one that is missing', async () => {
    const result = await maps().save(filledMap(), 0);

    expect(result).toEqual({ status: 'not_found' });
    expect(await prisma().warehouseMapRecord.count()).toBe(0);
  });

  it('rejects a duplicate warehouse id and a duplicate map id without changing the first row', async () => {
    const warehouse = Warehouse.create(WAREHOUSE_ID, 'Main');
    const map = filledMap();
    await warehouses().insert(warehouse, RECORDED_AT);
    await maps().insert(map);

    await expect(
      warehouses().insert(Warehouse.create(WAREHOUSE_ID, 'Other'), RECORDED_AT),
    ).rejects.toBeInstanceOf(Error);
    await expect(maps().insert(filledMap())).rejects.toBeInstanceOf(Error);

    expect(await warehouses().findById(WAREHOUSE_ID)).toEqual({
      id: WAREHOUSE_ID,
      name: 'Main',
      createdAt: RECORDED_AT,
      updatedAt: RECORDED_AT,
    });
    expect(await maps().findById(MAP_ID)).toEqual({ snapshot: map.snapshot(), version: 0 });
  });

  it('leaves another warehouse map unchanged', async () => {
    await warehouses().insert(Warehouse.create(WAREHOUSE_ID, 'Main'), RECORDED_AT);
    await warehouses().insert(Warehouse.create(OTHER_WAREHOUSE_ID, 'Side'), RECORDED_AT);
    const first = filledMap();
    const second = WarehouseMap.create(OTHER_MAP_ID, OTHER_WAREHOUSE_ID);
    second.placeRobot(ROBOT_ID, 'Other', Position.create(0, 0));
    await maps().insert(first);
    await maps().insert(second);
    first.moveRobot(ROBOT_ID, Position.create(6, 6));

    await maps().save(first, 0);

    expect(await maps().findById(OTHER_MAP_ID)).toEqual({
      snapshot: second.snapshot(),
      version: 0,
    });
  });

  it('reports an invalid stored shape from the repository and a domain conflict through GetWarehouseMap', async () => {
    await warehouses().insert(Warehouse.create(WAREHOUSE_ID, 'Main'), RECORDED_AT);
    await maps().insert(filledMap());
    await prisma().warehouseMapRecord.update({
      where: { id: MAP_ID },
      data: { content: { width: 20 } },
    });

    await expect(maps().findById(MAP_ID)).rejects.toMatchObject({
      name: 'CorruptedMapStateError',
      details: { mapId: MAP_ID, reason: 'INVALID_STORED_FORMAT' },
    });

    await prisma().warehouseMapRecord.update({
      where: { id: MAP_ID },
      data: {
        content: {
          width: 20,
          height: 20,
          obstacles: [{ x: 1, y: 1 }],
          robots: [{ id: ROBOT_ID, name: 'Robot', x: 1, y: 1 }],
          stations: [],
        },
      },
    });

    await expect(maps().findById(MAP_ID)).resolves.toMatchObject({ version: 0 });
    await expect(new GetWarehouseMap(maps()).execute({ mapId: MAP_ID })).rejects.toBeInstanceOf(
      CorruptedMapStateError,
    );
    await expect(new GetWarehouseMap(maps()).execute({ mapId: MAP_ID })).rejects.toMatchObject({
      details: { mapId: MAP_ID, reason: 'DOMAIN_INVARIANT' },
    });
  });

  it('updates only the warehouse name and does not insert a missing warehouse', async () => {
    await warehouses().insert(Warehouse.create(WAREHOUSE_ID, 'Main'), RECORDED_AT);

    expect(await warehouses().save(Warehouse.create(WAREHOUSE_ID, 'Renamed'), UPDATED_AT)).toEqual({
      status: 'saved',
    });
    expect(await warehouses().findById(WAREHOUSE_ID)).toEqual({
      id: WAREHOUSE_ID,
      name: 'Renamed',
      createdAt: RECORDED_AT,
      updatedAt: UPDATED_AT,
    });
    expect(
      await warehouses().save(Warehouse.create(OTHER_WAREHOUSE_ID, 'Missing'), UPDATED_AT),
    ).toEqual({
      status: 'not_found',
    });
    expect(await warehouses().findById(OTHER_WAREHOUSE_ID)).toBeNull();
  });

  it('deletes only the warehouse row and leaves a foreign-key error unchanged', async () => {
    await warehouses().insert(Warehouse.create(WAREHOUSE_ID, 'Main'), RECORDED_AT);
    await maps().insert(filledMap());

    await expect(warehouses().delete(WAREHOUSE_ID)).rejects.toBeInstanceOf(Error);
    expect(await warehouses().findById(WAREHOUSE_ID)).toEqual({
      id: WAREHOUSE_ID,
      name: 'Main',
      createdAt: RECORDED_AT,
      updatedAt: RECORDED_AT,
    });
    expect(await maps().findById(MAP_ID)).not.toBeNull();

    await maps().deleteByWarehouseId(WAREHOUSE_ID);
    expect(await maps().findByWarehouseId(WAREHOUSE_ID)).toBeNull();
    expect(await warehouses().delete(WAREHOUSE_ID)).toEqual({ status: 'deleted' });
    expect(await warehouses().delete(WAREHOUSE_ID)).toEqual({ status: 'not_found' });
    await expect(maps().deleteByWarehouseId(OTHER_WAREHOUSE_ID)).resolves.toBeUndefined();
  });

  it('uses a transaction client without committing that transaction itself', async () => {
    const rollback = new Error('rollback');

    await expect(
      prisma().$transaction(async (tx) => {
        const txWarehouses = new PrismaWarehouseRepository(tx);
        await txWarehouses.insert(Warehouse.create(WAREHOUSE_ID, 'Inside'), RECORDED_AT);
        expect(await txWarehouses.findById(WAREHOUSE_ID)).toEqual({
          id: WAREHOUSE_ID,
          name: 'Inside',
          createdAt: RECORDED_AT,
          updatedAt: RECORDED_AT,
        });
        throw rollback;
      }),
    ).rejects.toBe(rollback);

    expect(await warehouses().findById(WAREHOUSE_ID)).toBeNull();
  });

  it('returns null when a warehouse or a map is missing', async () => {
    expect(await warehouses().findById(WAREHOUSE_ID)).toBeNull();
    expect(await maps().findById(MAP_ID)).toBeNull();
    expect(await maps().findByWarehouseId(WAREHOUSE_ID)).toBeNull();
  });
});

function contentKeys(content: unknown): string[] {
  if (typeof content !== 'object' || content === null || Array.isArray(content)) {
    throw new Error('Stored content is not an object');
  }
  return Object.keys(content).sort();
}
