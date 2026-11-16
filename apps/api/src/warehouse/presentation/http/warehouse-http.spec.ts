import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  apiErrorSchema,
  createWarehouseResponseSchema,
  editWarehouseMapResponseSchema,
  mapVersionConflictErrorSchema,
  renameWarehouseResponseSchema,
  warehouseMapBodySchema,
} from '@robots/shared';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { httpProviders } from '../../../common/http/http.providers';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CreateWarehouseInput,
  CreateWarehouseResult,
} from '../../application/commands/create-warehouse/create-warehouse.types';
import { CreateWarehouse } from '../../application/commands/create-warehouse/create-warehouse.use-case';
import type { DeleteWarehouseInput } from '../../application/commands/delete-warehouse/delete-warehouse.types';
import { DeleteWarehouse } from '../../application/commands/delete-warehouse/delete-warehouse.use-case';
import type {
  EditWarehouseMapInput,
  EditWarehouseMapResult,
} from '../../application/commands/edit-warehouse-map/edit-warehouse-map.types';
import { EditWarehouseMap } from '../../application/commands/edit-warehouse-map/edit-warehouse-map.use-case';
import type {
  UpdateWarehouseInput,
  UpdateWarehouseResult,
} from '../../application/commands/update-warehouse/update-warehouse.types';
import { UpdateWarehouse } from '../../application/commands/update-warehouse/update-warehouse.use-case';
import {
  CorruptedMapStateError,
  MapVersionConflictError,
  WarehouseMapNotFoundError,
  WarehouseNotFoundError,
} from '../../application/errors/application.errors';
import type {
  GetWarehouseMapInput,
  GetWarehouseMapResult,
} from '../../application/queries/get-warehouse-map/get-warehouse-map.types';
import { GetWarehouseMap } from '../../application/queries/get-warehouse-map/get-warehouse-map.use-case';
import type { WarehouseMapSnapshot } from '../../domain/entities/warehouse-map';
import { InvalidNameError } from '../../domain/errors/value.errors';
import { WarehousePresentationModule } from '../warehouse-presentation.module';

const WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';
const MAP_ID = '22222222-2222-7111-8111-22222222222b';
const ROBOT_ID = '33333333-3333-4111-8111-33333333333c';

const databaseDenied = vi.fn(() =>
  Promise.reject(new Error('HTTP test must not use the database')),
);

const prismaDouble = {
  $connect: databaseDenied,
  $disconnect: databaseDenied,
  $transaction: databaseDenied,
};

const createExecute = vi.fn(
  async (_input: CreateWarehouseInput): Promise<CreateWarehouseResult> => ({
    warehouseId: WAREHOUSE_ID,
    name: 'dock',
    mapId: MAP_ID,
    version: 0,
  }),
);

const updateExecute = vi.fn(
  async (input: UpdateWarehouseInput): Promise<UpdateWarehouseResult> => ({
    warehouseId: input.warehouseId,
    name: input.name,
  }),
);

const deleteExecute = vi.fn(async (_input: DeleteWarehouseInput): Promise<void> => undefined);

const getExecute = vi.fn(async (input: GetWarehouseMapInput): Promise<GetWarehouseMapResult> => ({
  snapshot: mapSnapshot('warehouseId' in input ? input.warehouseId : WAREHOUSE_ID),
  version: 2,
}));

const editExecute = vi.fn(
  async (input: EditWarehouseMapInput): Promise<EditWarehouseMapResult> => ({
    mapId: input.mapId,
    version: input.expectedVersion + 1,
    changed: true,
    snapshot: mapSnapshot(WAREHOUSE_ID),
    createdId: input.operation.type === 'placeRobot' ? ROBOT_ID : undefined,
  }),
);

function mapSnapshot(warehouseId: string): WarehouseMapSnapshot {
  return {
    id: MAP_ID,
    warehouseId,
    width: 20,
    height: 20,
    obstacles: [{ x: 2, y: 3 }],
    robots: [],
    stations: [],
  };
}

function mapBody(version: number) {
  return {
    mapId: MAP_ID,
    warehouseId: WAREHOUSE_ID,
    version,
    width: 20,
    height: 20,
    obstacles: [{ x: 2, y: 3 }],
    robots: [],
    stations: [],
  };
}

describe('HTTP склада', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [WarehousePresentationModule],
      providers: [...httpProviders],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaDouble)
      .overrideProvider(CreateWarehouse)
      .useValue({ execute: createExecute })
      .overrideProvider(UpdateWarehouse)
      .useValue({ execute: updateExecute })
      .overrideProvider(DeleteWarehouse)
      .useValue({ execute: deleteExecute })
      .overrideProvider(GetWarehouseMap)
      .useValue({ execute: getExecute })
      .overrideProvider(EditWarehouseMap)
      .useValue({ execute: editExecute })
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    expect(databaseDenied).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    await app.close();
  });

  it('создаёт склад и передаёт только name', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/warehouses')
      .send({ name: 'dock' });

    expect(response.status).toBe(201);
    expect(createWarehouseResponseSchema.parse(response.body)).toEqual({
      warehouseId: WAREHOUSE_ID,
      name: 'dock',
      mapId: MAP_ID,
      version: 0,
    });
    expect(createExecute).toHaveBeenCalledWith({ name: 'dock' });
    expect(databaseDenied).not.toHaveBeenCalled();
  });

  it('переименовывает склад по path и телу', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/warehouses/${WAREHOUSE_ID}`)
      .send({ name: 'north' });

    expect(response.status).toBe(200);
    expect(renameWarehouseResponseSchema.parse(response.body)).toEqual({
      warehouseId: WAREHOUSE_ID,
      name: 'north',
    });
    expect(updateExecute).toHaveBeenCalledWith({ warehouseId: WAREHOUSE_ID, name: 'north' });
  });

  it('удаляет склад без тела ответа', async () => {
    const response = await request(app.getHttpServer()).delete(`/api/warehouses/${WAREHOUSE_ID}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(deleteExecute).toHaveBeenCalledWith({ warehouseId: WAREHOUSE_ID });
  });

  it('читает карту склада как MapBody', async () => {
    const response = await request(app.getHttpServer()).get(`/api/warehouses/${WAREHOUSE_ID}/map`);

    expect(response.status).toBe(200);
    expect(warehouseMapBodySchema.parse(response.body)).toEqual(mapBody(2));
    expect(getExecute).toHaveBeenCalledWith({ warehouseId: WAREHOUSE_ID });
    expect(response.body).not.toHaveProperty('id');
    expect(response.body.obstacles[0]).not.toHaveProperty('id');
  });

  it('передаёт операцию редактирования и не подставляет createdId', async () => {
    const operation = { type: 'addObstacle', position: { x: 4, y: 5 } };
    const response = await request(app.getHttpServer())
      .post(`/api/maps/${MAP_ID}/operations`)
      .send({ expectedVersion: 1, operation });

    expect(response.status).toBe(200);
    expect(editWarehouseMapResponseSchema.parse(response.body)).toEqual({
      changed: true,
      map: mapBody(2),
    });
    expect(response.body).not.toHaveProperty('createdId');
    expect(editExecute).toHaveBeenCalledWith({ mapId: MAP_ID, expectedVersion: 1, operation });
  });

  it('включает createdId, когда use case его вернул', async () => {
    const operation = { type: 'placeRobot', name: 'loader', position: { x: 1, y: 1 } };
    const response = await request(app.getHttpServer())
      .post(`/api/maps/${MAP_ID}/operations`)
      .send({ expectedVersion: 3, operation });

    expect(editWarehouseMapResponseSchema.parse(response.body)).toEqual({
      changed: true,
      createdId: ROBOT_ID,
      map: mapBody(4),
    });
  });

  it('no-op сохраняет changed false и прежнюю version', async () => {
    editExecute.mockResolvedValueOnce({
      mapId: MAP_ID,
      version: 3,
      changed: false,
      snapshot: mapSnapshot(WAREHOUSE_ID),
    });

    const response = await request(app.getHttpServer())
      .post(`/api/maps/${MAP_ID}/operations`)
      .send({
        expectedVersion: 3,
        operation: { type: 'moveRobot', robotId: ROBOT_ID, position: { x: 1, y: 1 } },
      });

    expect(response.status).toBe(200);
    expect(editWarehouseMapResponseSchema.parse(response.body)).toEqual({
      changed: false,
      map: mapBody(3),
    });
  });

  it.each([
    {
      title: 'неверный UUID path',
      call: () => request(app.getHttpServer()).get('/api/warehouses/wh-1/map'),
      called: () => getExecute,
    },
    {
      title: 'неправильный тип тела',
      call: () => request(app.getHttpServer()).post('/api/warehouses').send({ name: 1 }),
      called: () => createExecute,
    },
    {
      title: 'неизвестная операция',
      call: () =>
        request(app.getHttpServer())
          .post(`/api/maps/${MAP_ID}/operations`)
          .send({ expectedVersion: 0, operation: { type: 'replaceMap' } }),
      called: () => editExecute,
    },
    {
      title: 'лишнее поле',
      call: () =>
        request(app.getHttpServer()).post('/api/warehouses').send({ name: 'dock', extra: true }),
      called: () => createExecute,
    },
  ])('$title → 400, use case не вызывается', async ({ call, called }) => {
    const response = await call();

    expect(response.status).toBe(400);
    expect(apiErrorSchema.parse(response.body).code).toBe('VALIDATION_ERROR');
    expect(called()).not.toHaveBeenCalled();
  });

  it('WarehouseNotFoundError → 404', async () => {
    updateExecute.mockRejectedValueOnce(new WarehouseNotFoundError({ warehouseId: WAREHOUSE_ID }));

    const response = await request(app.getHttpServer())
      .patch(`/api/warehouses/${WAREHOUSE_ID}`)
      .send({ name: 'north' });

    expect(response.status).toBe(404);
    expect(apiErrorSchema.parse(response.body)).toEqual({
      code: 'WAREHOUSE_NOT_FOUND',
      message: 'Warehouse was not found',
    });
    expect(JSON.stringify(response.body)).not.toContain(WAREHOUSE_ID);
  });

  it('WarehouseMapNotFoundError → 404', async () => {
    getExecute.mockRejectedValueOnce(new WarehouseMapNotFoundError({ warehouseId: WAREHOUSE_ID }));

    const response = await request(app.getHttpServer()).get(`/api/warehouses/${WAREHOUSE_ID}/map`);

    expect(response.status).toBe(404);
    expect(apiErrorSchema.parse(response.body)).toEqual({
      code: 'MAP_NOT_FOUND',
      message: 'Warehouse map was not found',
    });
  });

  it('MapVersionConflictError → 409 без версий', async () => {
    editExecute.mockRejectedValueOnce(
      new MapVersionConflictError({ mapId: MAP_ID, expectedVersion: 1, actualVersion: 4 }),
    );

    const response = await request(app.getHttpServer())
      .post(`/api/maps/${MAP_ID}/operations`)
      .send({
        expectedVersion: 1,
        operation: { type: 'removeObstacle', position: { x: 2, y: 3 } },
      });

    expect(response.status).toBe(409);
    expect(mapVersionConflictErrorSchema.parse(response.body)).toEqual({
      code: 'MAP_VERSION_CONFLICT',
      message: 'Версия карты устарела. Перечитайте карту и повторите команду.',
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('expectedVersion');
    expect(serialized).not.toContain('actualVersion');
    expect(serialized).not.toContain(MAP_ID);
  });

  it('DomainError → 422 без внутренних details', async () => {
    createExecute.mockRejectedValueOnce(new InvalidNameError('   '));

    const response = await request(app.getHttpServer())
      .post('/api/warehouses')
      .send({ name: '   ' });

    expect(response.status).toBe(422);
    expect(apiErrorSchema.parse(response.body)).toEqual({
      code: 'INVALID_NAME',
      message: 'Invalid name',
    });
    expect(JSON.stringify(response.body)).not.toContain('"value"');
  });

  it('CorruptedMapStateError → безопасный 500', async () => {
    getExecute.mockRejectedValueOnce(
      new CorruptedMapStateError(
        MAP_ID,
        'INVALID_STORED_FORMAT',
        new Error('select * from secret'),
      ),
    );

    const response = await request(app.getHttpServer()).get(`/api/warehouses/${WAREHOUSE_ID}/map`);

    expect(response.status).toBe(500);
    expect(apiErrorSchema.parse(response.body)).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain(MAP_ID);
    expect(serialized).not.toContain('INVALID_STORED_FORMAT');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('stack');
  });

  it('обычный Error обрабатывает глобальный фильтр без внутренних деталей', async () => {
    deleteExecute.mockRejectedValueOnce(
      new Error('postgres://user:secret@db', { cause: new Error('SQLSTATE 42P01') }),
    );

    const response = await request(app.getHttpServer()).delete(`/api/warehouses/${WAREHOUSE_ID}`);

    expect(response.status).toBe(500);
    expect(apiErrorSchema.parse(response.body)).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('SQLSTATE');
    expect(serialized).not.toContain('stack');
  });
});
