import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Prisma } from '../../../src/generated/prisma/client';
import {
  apiErrorSchema,
  createWarehouseResponseSchema,
  editWarehouseMapResponseSchema,
  mapVersionConflictErrorSchema,
  renameWarehouseResponseSchema,
  warehouseMapBodySchema,
  type CreateWarehouseResponse,
} from '@robots/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { httpProviders } from '../../../src/common/http/http.providers';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { WarehouseModule } from '../../../src/modules/warehouse/warehouse.module';
import { disconnectTestPrisma, getTestPrisma } from '../support/test-database';
import { cleanWarehouseTables } from './clean-warehouse-tables';

const ABSENT_ID = '99999999-9999-4999-8999-999999999999';

describe('warehouse HTTP on the test database', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [WarehouseModule],
      providers: [...httpProviders],
    })
      .overrideProvider(PrismaService)
      .useValue(getTestPrisma())
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    currentApp = app;
    app.setGlobalPrefix('api');
    await app.init();
  });

  beforeEach(async () => {
    await cleanWarehouseTables();
  });

  afterAll(async () => {
    await app.close();
    await disconnectTestPrisma();
  });

  it('creates a warehouse and an empty map at version 0', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/warehouses')
      .send({ name: 'dock' });

    expect(response.status).toBe(201);
    const created = createWarehouseResponseSchema.parse(response.body);
    expect(created).toMatchObject({ name: 'dock', version: 0 });
    expect(z.uuid().parse(created.warehouseId)).toBe(created.warehouseId);
    expect(z.uuid().parse(created.mapId)).toBe(created.mapId);

    const warehouse = await getTestPrisma().warehouseRecord.findUnique({
      where: { id: created.warehouseId },
      include: { map: true },
    });
    expect(warehouse).toMatchObject({ name: 'dock' });
    expect(warehouse?.map).toMatchObject({
      id: created.mapId,
      warehouseId: created.warehouseId,
      version: 0,
    });
  });

  it('reads the warehouse map', async () => {
    const created = await createWarehouse();

    const response = await request(app.getHttpServer()).get(
      `/api/warehouses/${created.warehouseId}/map`,
    );

    expect(response.status).toBe(200);
    expect(warehouseMapBodySchema.parse(response.body)).toEqual({
      mapId: created.mapId,
      warehouseId: created.warehouseId,
      version: 0,
      width: 20,
      height: 20,
      obstacles: [],
      robots: [],
      stations: [],
    });
  });

  it('renames the warehouse and leaves the map unchanged', async () => {
    const created = await createWarehouse();
    const before = await storedMap(created.mapId);

    const response = await request(app.getHttpServer())
      .patch(`/api/warehouses/${created.warehouseId}`)
      .send({ name: 'north' });

    expect(response.status).toBe(200);
    expect(renameWarehouseResponseSchema.parse(response.body)).toEqual({
      warehouseId: created.warehouseId,
      name: 'north',
    });
    const warehouse = await getTestPrisma().warehouseRecord.findUnique({
      where: { id: created.warehouseId },
    });
    expect(warehouse?.name).toBe('north');
    expect(await storedMap(created.mapId)).toEqual(before);
  });

  it('places a robot, raises the version, and matches a later read', async () => {
    const created = await createWarehouse();

    const response = await request(app.getHttpServer())
      .post(`/api/maps/${created.mapId}/operations`)
      .send({
        expectedVersion: 0,
        operation: { type: 'placeRobot', name: 'loader', position: { x: 3, y: 4 } },
      });

    expect(response.status).toBe(200);
    const edited = editWarehouseMapResponseSchema.parse(response.body);
    expect(edited.changed).toBe(true);
    expect(edited.createdId).toBeDefined();
    expect(z.uuid().parse(edited.createdId)).toBe(edited.createdId);
    expect(edited.map).toMatchObject({
      mapId: created.mapId,
      warehouseId: created.warehouseId,
      version: 1,
      robots: [{ id: edited.createdId, name: 'loader', x: 3, y: 4 }],
    });

    const stored = await storedMap(created.mapId);
    expect(stored.version).toBe(1);
    expect(stored.content).toMatchObject({
      robots: [{ id: edited.createdId, name: 'loader', x: 3, y: 4 }],
    });

    const read = await request(app.getHttpServer()).get(
      `/api/warehouses/${created.warehouseId}/map`,
    );
    expect(warehouseMapBodySchema.parse(read.body)).toEqual(edited.map);
  });

  it('deletes the warehouse and the map', async () => {
    const created = await createWarehouse();

    const response = await request(app.getHttpServer()).delete(
      `/api/warehouses/${created.warehouseId}`,
    );

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(
      await getTestPrisma().warehouseRecord.findUnique({ where: { id: created.warehouseId } }),
    ).toBeNull();
    expect(
      await getTestPrisma().warehouseMapRecord.findUnique({ where: { id: created.mapId } }),
    ).toBeNull();
  });

  it('a version conflict leaves the map unchanged and a read returns the current one', async () => {
    const created = await createWarehouse();
    const placed = await request(app.getHttpServer())
      .post(`/api/maps/${created.mapId}/operations`)
      .send({
        expectedVersion: 0,
        operation: { type: 'addObstacle', position: { x: 2, y: 3 } },
      });
    expect(placed.status).toBe(200);
    const current = editWarehouseMapResponseSchema.parse(placed.body);
    const before = await storedMap(created.mapId);

    const conflict = await request(app.getHttpServer())
      .post(`/api/maps/${created.mapId}/operations`)
      .send({
        expectedVersion: 0,
        operation: { type: 'addObstacle', position: { x: 5, y: 5 } },
      });

    expect(conflict.status).toBe(409);
    expect(mapVersionConflictErrorSchema.parse(conflict.body)).toEqual({
      code: 'MAP_VERSION_CONFLICT',
      message: 'The map version is stale. Read the map again and repeat the command.',
    });
    expect(apiErrorSchema.parse(conflict.body)).toEqual(conflict.body);
    const serialized = JSON.stringify(conflict.body);
    expect(serialized).not.toContain('expectedVersion');
    expect(serialized).not.toContain('actualVersion');
    expect(await storedMap(created.mapId)).toEqual(before);

    const read = await request(app.getHttpServer()).get(
      `/api/warehouses/${created.warehouseId}/map`,
    );
    expect(warehouseMapBodySchema.parse(read.body)).toEqual(current.map);
  });

  it('a move onto the same cell does not change the version or the content', async () => {
    const created = await createWarehouse();
    const placed = await request(app.getHttpServer())
      .post(`/api/maps/${created.mapId}/operations`)
      .send({
        expectedVersion: 0,
        operation: { type: 'placeRobot', name: 'loader', position: { x: 3, y: 4 } },
      });
    const placedBody = editWarehouseMapResponseSchema.parse(placed.body);
    const before = await storedMap(created.mapId);

    const response = await request(app.getHttpServer())
      .post(`/api/maps/${created.mapId}/operations`)
      .send({
        expectedVersion: placedBody.map.version,
        operation: {
          type: 'moveRobot',
          robotId: placedBody.createdId,
          position: { x: 3, y: 4 },
        },
      });

    expect(response.status).toBe(200);
    expect(editWarehouseMapResponseSchema.parse(response.body)).toMatchObject({
      changed: false,
      map: placedBody.map,
    });
    expect(await storedMap(created.mapId)).toEqual(before);
  });

  it('invalid input returns 400 and does not write to the database', async () => {
    const unknownOperation = await request(app.getHttpServer())
      .post(`/api/maps/${ABSENT_ID}/operations`)
      .send({ expectedVersion: 0, operation: { type: 'replaceMap' } });
    const extraField = await request(app.getHttpServer())
      .post('/api/warehouses')
      .send({ name: 'dock', extra: true });
    const badType = await request(app.getHttpServer()).post('/api/warehouses').send({ name: 1 });
    const badPath = await request(app.getHttpServer()).get('/api/warehouses/wh-1/map');

    for (const response of [unknownOperation, extraField, badType, badPath]) {
      expect(response.status).toBe(400);
      expect(apiErrorSchema.parse(response.body).code).toBe('VALIDATION_ERROR');
    }
    expect(await getTestPrisma().warehouseRecord.count()).toBe(0);
    expect(await getTestPrisma().warehouseMapRecord.count()).toBe(0);
  });

  it('a valid but missing warehouse and map return 404', async () => {
    const map = await request(app.getHttpServer()).get(`/api/warehouses/${ABSENT_ID}/map`);
    const warehouse = await request(app.getHttpServer())
      .patch(`/api/warehouses/${ABSENT_ID}`)
      .send({ name: 'north' });

    expect(map.status).toBe(404);
    expect(apiErrorSchema.parse(map.body)).toEqual({
      code: 'MAP_NOT_FOUND',
      message: 'Warehouse map was not found',
    });
    expect(warehouse.status).toBe(404);
    expect(apiErrorSchema.parse(warehouse.body)).toEqual({
      code: 'WAREHOUSE_NOT_FOUND',
      message: 'Warehouse was not found',
    });
  });

  it('an occupied cell returns 422 and does not change the map', async () => {
    const created = await createWarehouse();
    const placed = await request(app.getHttpServer())
      .post(`/api/maps/${created.mapId}/operations`)
      .send({
        expectedVersion: 0,
        operation: { type: 'placeRobot', name: 'loader', position: { x: 3, y: 4 } },
      });
    expect(placed.status).toBe(200);
    const before = await storedMap(created.mapId);

    const response = await request(app.getHttpServer())
      .post(`/api/maps/${created.mapId}/operations`)
      .send({
        expectedVersion: 1,
        operation: { type: 'placeRobot', name: 'spare', position: { x: 3, y: 4 } },
      });

    expect(response.status).toBe(422);
    expect(apiErrorSchema.parse(response.body)).toEqual({
      code: 'CELL_OCCUPIED',
      message: 'Cell is occupied',
    });
    expect(await storedMap(created.mapId)).toEqual(before);
  });

  it('corrupt content returns a safe 500', async () => {
    const created = await createWarehouse();
    await getTestPrisma().warehouseMapRecord.update({
      where: { id: created.mapId },
      data: { content: { width: 20 } },
    });

    const response = await request(app.getHttpServer()).get(
      `/api/warehouses/${created.warehouseId}/map`,
    );

    expect(response.status).toBe(500);
    expect(apiErrorSchema.parse(response.body)).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('INVALID_STORED_FORMAT');
    expect(serialized).not.toContain('stack');
    expect(serialized).not.toContain('prisma');
    expect(serialized).not.toContain(created.mapId);
  });
});

async function createWarehouse(): Promise<CreateWarehouseResponse> {
  const response = await request(appServer()).post('/api/warehouses').send({ name: 'dock' });
  expect(response.status).toBe(201);
  return createWarehouseResponseSchema.parse(response.body);
}

function appServer(): Parameters<typeof request>[0] {
  return currentApp.getHttpServer();
}

let currentApp: INestApplication;

async function storedMap(mapId: string): Promise<{ version: number; content: Prisma.JsonValue }> {
  return getTestPrisma().warehouseMapRecord.findUniqueOrThrow({
    where: { id: mapId },
    select: { version: true, content: true },
  });
}
