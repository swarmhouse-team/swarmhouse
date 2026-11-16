import { afterAll, beforeEach, describe, expect, it } from 'vitest';

const RECORDED_AT = new Date('2026-01-01T00:00:00.000Z');

import { MapVersionConflictError } from '../../../src/warehouse/application/errors/application.errors';
import type { SaveMapResult } from '../../../src/warehouse/application/ports/repositories/warehouse-map.repository';
import type { WarehouseRepository } from '../../../src/warehouse/application/ports/repositories/warehouse.repository';
import { WarehouseMap } from '../../../src/warehouse/domain/entities/warehouse-map';
import { Warehouse } from '../../../src/warehouse/domain/entities/warehouse';
import { Position } from '../../../src/warehouse/domain/vo/position';
import { PrismaUnitOfWork } from '../../../src/warehouse/infrastructure/prisma/transaction/prisma-unit-of-work';
import { PrismaWarehouseMapRepository } from '../../../src/warehouse/infrastructure/prisma/repositories/prisma-warehouse-map.repository';
import { PrismaWarehouseRepository } from '../../../src/warehouse/infrastructure/prisma/repositories/prisma-warehouse.repository';
import { disconnectTestPrisma, getTestPrisma } from '../support/test-database';
import { cleanWarehouseTables } from './clean-warehouse-tables';

const WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';
const MAP_ID = '22222222-2222-7111-8111-22222222222b';
const ROBOT_ID = '33333333-3333-4111-8111-33333333333c';

function mapWithRobot(x = 2, y = 2): WarehouseMap {
  const map = WarehouseMap.create(MAP_ID, WAREHOUSE_ID);
  map.placeRobot(ROBOT_ID, 'Robot', Position.create(x, y));
  return map;
}

function gateFor(parties: number) {
  let arrived = 0;
  let release = () => {};
  let rejectWait = (_reason: unknown) => {};
  const gate = new Promise<void>((resolve, reject) => {
    release = resolve;
    rejectWait = reject;
  });
  gate.catch(() => undefined);

  return {
    async arrive(): Promise<void> {
      arrived += 1;
      if (arrived >= parties) {
        release();
      }
      await gate;
    },
    release,
    fail(reason: unknown) {
      rejectWait(reason);
    },
  };
}

describe('PrismaUnitOfWork', () => {
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

  it('commits the callback result and lets the callback read its own write', async () => {
    const result = await unitOfWork().execute(async (tx) => {
      await tx.warehouses.insert(Warehouse.create(WAREHOUSE_ID, 'Main'), RECORDED_AT);
      return tx.warehouses.findById(WAREHOUSE_ID);
    });

    expect(result).toEqual({
      id: WAREHOUSE_ID,
      name: 'Main',
      createdAt: RECORDED_AT,
      updatedAt: RECORDED_AT,
    });
    expect(await warehouses().findById(WAREHOUSE_ID)).toEqual(result);
  });

  it('keeps a returned conflict and does not roll the transaction back', async () => {
    await warehouses().insert(Warehouse.create(WAREHOUSE_ID, 'Main'), RECORDED_AT);
    const map = mapWithRobot();
    await maps().insert(map);

    const result = await unitOfWork().execute(async (tx) => tx.maps.save(map, 4));

    expect(result).toEqual({ status: 'conflict', actualVersion: 0 });
    expect(await maps().findById(MAP_ID)).toEqual({ snapshot: map.snapshot(), version: 0 });
  });

  it('rolls back a saved map when the callback throws the same error', async () => {
    await warehouses().insert(Warehouse.create(WAREHOUSE_ID, 'Main'), RECORDED_AT);
    const map = mapWithRobot();
    await maps().insert(map);
    const stored = map.snapshot();
    map.moveRobot(ROBOT_ID, Position.create(6, 6));
    const failure = new MapVersionConflictError({
      mapId: MAP_ID,
      expectedVersion: 0,
      actualVersion: 1,
    });

    await expect(
      unitOfWork().execute(async (tx) => {
        const saved = await tx.maps.save(map, 0);
        expect(saved).toEqual({ status: 'saved', version: 1 });
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(await maps().findById(MAP_ID)).toEqual({ snapshot: stored, version: 0 });
  });

  it('rejects a repository kept after the transaction has finished', async () => {
    let captured: WarehouseRepository | undefined;

    await unitOfWork().execute(async (tx) => {
      captured = tx.warehouses;
      await tx.warehouses.insert(Warehouse.create(WAREHOUSE_ID, 'Main'), RECORDED_AT);
    });

    await expect(captured?.findById(WAREHOUSE_ID)).rejects.toBeInstanceOf(Error);
    expect(await warehouses().findById(WAREHOUSE_ID)).toEqual({
      id: WAREHOUSE_ID,
      name: 'Main',
      createdAt: RECORDED_AT,
      updatedAt: RECORDED_AT,
    });
  });

  it('lets one concurrent save win and reports a conflict for the other', async () => {
    await warehouses().insert(Warehouse.create(WAREHOUSE_ID, 'Main'), RECORDED_AT);
    await maps().insert(mapWithRobot());
    const first = mapWithRobot();
    const second = mapWithRobot();
    first.moveRobot(ROBOT_ID, Position.create(6, 6));
    second.moveRobot(ROBOT_ID, Position.create(7, 7));
    const gate = gateFor(2);

    const compete = async (map: WarehouseMap): Promise<SaveMapResult> => {
      try {
        return await unitOfWork().execute(async (tx) => {
          const current = await tx.maps.findById(MAP_ID);
          if (!current) {
            throw new Error('Map disappeared before the barrier');
          }
          await gate.arrive();
          return tx.maps.save(map, current.version);
        });
      } catch (error) {
        gate.fail(error);
        throw error;
      }
    };

    let results: SaveMapResult[];
    try {
      results = await Promise.all([compete(first), compete(second)]);
    } finally {
      gate.release();
    }

    const saved = results.find((result) => result.status === 'saved');
    const conflict = results.find((result) => result.status === 'conflict');
    expect(saved).toEqual({ status: 'saved', version: 1 });
    expect(conflict?.status).toBe('conflict');
    const winner = results[0] === saved ? first.snapshot() : second.snapshot();
    expect(await maps().findById(MAP_ID)).toEqual({ snapshot: winner, version: 1 });
  });

  it('reports a conflict for the save that waits until the first transaction commits', async () => {
    await warehouses().insert(Warehouse.create(WAREHOUSE_ID, 'Main'), RECORDED_AT);
    await maps().insert(mapWithRobot());
    const first = mapWithRobot();
    const second = mapWithRobot();
    first.moveRobot(ROBOT_ID, Position.create(6, 6));
    second.moveRobot(ROBOT_ID, Position.create(7, 7));

    let releaseFirst = () => {};
    const holdFirst = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let markSaved = () => {};
    const firstSaved = new Promise<void>((resolve) => {
      markSaved = resolve;
    });

    const pendingFirst = unitOfWork()
      .execute(async (tx) => {
        const saved = await tx.maps.save(first, 0);
        markSaved();
        await holdFirst;
        return saved;
      })
      .catch((error: unknown) => {
        markSaved();
        releaseFirst();
        throw error;
      });

    let pendingSecond: Promise<SaveMapResult> | undefined;
    try {
      await firstSaved;
      pendingSecond = unitOfWork().execute(async (tx) => tx.maps.save(second, 0));
      releaseFirst();
      const [firstResult, secondResult] = await Promise.all([pendingFirst, pendingSecond]);

      expect(firstResult).toEqual({ status: 'saved', version: 1 });
      expect(secondResult.status).toBe('conflict');
      expect(await maps().findById(MAP_ID)).toEqual({ snapshot: first.snapshot(), version: 1 });
    } finally {
      releaseFirst();
      markSaved();
      await Promise.allSettled([pendingFirst, pendingSecond].filter((item) => item !== undefined));
    }
  });
});
