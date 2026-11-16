import { describe, expect, it } from 'vitest';

import { apiErrorSchema } from '../api-error';
import {
  createWarehouseRequestSchema,
  createWarehouseResponseSchema,
  editWarehouseMapRequestSchema,
  editWarehouseMapResponseSchema,
  renameWarehouseRequestSchema,
  renameWarehouseResponseSchema,
  mapVersionConflictErrorSchema,
  uuidTextSchema,
  warehouseMapBodySchema,
  warehouseMapPathParamsSchema,
  warehousePathParamsSchema,
  type EditWarehouseMapRequest,
} from './warehouse';

const UUID_V1 = 'c232ab00-9414-11ec-b3c8-9f4e5d6c7b8a';
const UUID_V4 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const UUID_V7 = '01933c2a-7b3e-7a1b-8c4d-1a2b3c4d5e6f';
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
const MAX_UUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

const emptyMap = {
  mapId: UUID_V7,
  warehouseId: UUID_V4,
  version: 0,
  width: 20,
  height: 20,
  obstacles: [],
  robots: [],
  stations: [],
};

describe('uuidTextSchema', () => {
  it.each([UUID_V1, UUID_V4, UUID_V7, UUID_V4.toUpperCase()])(
    'принимает %s без изменений',
    (value) => {
      expect(uuidTextSchema.parse(value)).toBe(value);
    },
  );

  it.each([
    '',
    '   ',
    ` ${UUID_V4}`,
    `${UUID_V4} `,
    'f47ac10b58cc4372a5670e02b2c3d479',
    'f47ac10b-58cc-4372-a567-0e02b2c3d47',
    'f47ac10b-58cc-4372-a567-0e02b2c3d47g',
    'f47ac10b-58cc-4372-a567',
    'wh-1',
    NIL_UUID,
    NIL_UUID.toUpperCase(),
    MAX_UUID,
    MAX_UUID.toUpperCase(),
  ])('отклоняет %j', (value) => {
    expect(uuidTextSchema.safeParse(value).success).toBe(false);
  });
});

describe('запросы склада', () => {
  it('принимает создание и переименование', () => {
    expect(createWarehouseRequestSchema.parse({ name: 'dock' })).toEqual({ name: 'dock' });
    expect(renameWarehouseRequestSchema.parse({ name: 'dock' })).toEqual({ name: 'dock' });
    expect(warehousePathParamsSchema.parse({ warehouseId: UUID_V4 })).toEqual({
      warehouseId: UUID_V4,
    });
    expect(warehouseMapPathParamsSchema.parse({ mapId: UUID_V7 })).toEqual({ mapId: UUID_V7 });
  });

  it('пропускает пустое имя: длину проверяет домен', () => {
    expect(createWarehouseRequestSchema.parse({ name: '' })).toEqual({ name: '' });
    expect(renameWarehouseRequestSchema.parse({ name: '   ' })).toEqual({ name: '   ' });
  });

  it('отклоняет неверный тип, отсутствие поля, лишнее поле и coercion', () => {
    expect(createWarehouseRequestSchema.safeParse({}).success).toBe(false);
    expect(createWarehouseRequestSchema.safeParse({ name: 1 }).success).toBe(false);
    expect(createWarehouseRequestSchema.safeParse({ name: 'dock', extra: true }).success).toBe(
      false,
    );
    expect(renameWarehouseRequestSchema.safeParse({}).success).toBe(false);
    expect(warehousePathParamsSchema.safeParse({ warehouseId: 'wh-1' }).success).toBe(false);
    expect(editWarehouseMapRequestSchema.safeParse({ expectedVersion: '0' }).success).toBe(false);
  });
});

describe('операции карты', () => {
  const operations: EditWarehouseMapRequest[] = [
    {
      expectedVersion: 0,
      operation: { type: 'addObstacle', position: { x: 1.5, y: -1 } },
    },
    {
      expectedVersion: 1,
      operation: { type: 'moveObstacle', from: { x: 1, y: 1 }, to: { x: 2, y: 3 } },
    },
    {
      expectedVersion: 2,
      operation: { type: 'removeObstacle', position: { x: 1, y: 1 } },
    },
    {
      expectedVersion: 3,
      operation: { type: 'placeRobot', name: '', position: { x: 3, y: 4 } },
    },
    {
      expectedVersion: 4,
      operation: { type: 'moveRobot', robotId: UUID_V4, position: { x: 2, y: 3 } },
    },
    {
      expectedVersion: 5,
      operation: { type: 'removeRobot', robotId: UUID_V7 },
    },
    {
      expectedVersion: 6,
      operation: {
        type: 'placeStation',
        name: 'dock',
        stationType: 'receiving',
        position: { x: 0, y: 1 },
      },
    },
    {
      expectedVersion: 7,
      operation: { type: 'moveStation', stationId: UUID_V1, position: { x: 3, y: 4 } },
    },
    {
      expectedVersion: 8,
      operation: { type: 'removeStation', stationId: UUID_V4.toUpperCase() },
    },
  ];

  it.each(operations)('принимает $operation.type', (request) => {
    expect(editWarehouseMapRequestSchema.parse(request)).toEqual(request);
  });

  it('отклоняет отсутствие поля, неизвестный type, неверный UUID и stationType', () => {
    expect(
      editWarehouseMapRequestSchema.safeParse({
        expectedVersion: 0,
        operation: { type: 'placeStation', name: 'dock', position: { x: 1, y: 1 } },
      }).success,
    ).toBe(false);
    expect(
      editWarehouseMapRequestSchema.safeParse({
        expectedVersion: 0,
        operation: { type: 'replaceMap' },
      }).success,
    ).toBe(false);
    expect(
      editWarehouseMapRequestSchema.safeParse({
        expectedVersion: 0,
        operation: { type: 'removeRobot', robotId: 'wh-1' },
      }).success,
    ).toBe(false);
    expect(
      editWarehouseMapRequestSchema.safeParse({
        expectedVersion: 0,
        operation: {
          type: 'placeStation',
          name: 'dock',
          stationType: 'packing',
          position: { x: 1, y: 1 },
        },
      }).success,
    ).toBe(false);
  });

  it('отклоняет лишнее поле вложенного объекта', () => {
    expect(
      editWarehouseMapRequestSchema.safeParse({
        expectedVersion: 0,
        operation: { type: 'addObstacle', position: { x: 1, y: 2, z: 3 } },
      }).success,
    ).toBe(false);
    expect(
      editWarehouseMapRequestSchema.safeParse({
        expectedVersion: 0,
        operation: { type: 'removeRobot', robotId: UUID_V4, name: 'loader' },
      }).success,
    ).toBe(false);
  });

  it('отклоняет отрицательную и дробную expectedVersion', () => {
    const operation = { type: 'removeObstacle', position: { x: 0, y: 0 } };

    expect(
      editWarehouseMapRequestSchema.safeParse({ expectedVersion: -1, operation }).success,
    ).toBe(false);
    expect(
      editWarehouseMapRequestSchema.safeParse({ expectedVersion: 1.5, operation }).success,
    ).toBe(false);
  });
});

describe('ответы склада', () => {
  it('принимает карту с объектами и пустые коллекции', () => {
    const map = {
      ...emptyMap,
      obstacles: [{ x: 2, y: 3 }],
      robots: [{ id: UUID_V4, name: 'loader', x: 1, y: 1 }],
      stations: [{ id: UUID_V1, name: 'dock', type: 'issuing', x: 4, y: 5 }],
    };

    expect(warehouseMapBodySchema.parse(map)).toEqual(map);
    expect(warehouseMapBodySchema.parse(emptyMap)).toEqual(emptyMap);
  });

  it('принимает создание, переименование и редактирование без createdId', () => {
    const created = { warehouseId: UUID_V4, name: 'dock', mapId: UUID_V7, version: 0 };
    const renamed = { warehouseId: UUID_V4, name: 'dock' };
    const edited = { changed: false, map: emptyMap };

    expect(createWarehouseResponseSchema.parse(created)).toEqual(created);
    expect(renameWarehouseResponseSchema.parse(renamed)).toEqual(renamed);
    expect(editWarehouseMapResponseSchema.parse(edited)).toEqual(edited);
  });

  it('сохраняет createdId, когда он есть', () => {
    const edited = { changed: true, createdId: UUID_V7, map: emptyMap };

    expect(editWarehouseMapResponseSchema.parse(edited)).toEqual(edited);
  });
});

describe('mapVersionConflictErrorSchema', () => {
  const conflict = {
    code: 'MAP_VERSION_CONFLICT',
    message: 'Версия карты устарела. Перечитайте карту и повторите команду.',
  };

  it('принимает конфликт без details и совместим с apiErrorSchema', () => {
    const parsed = mapVersionConflictErrorSchema.parse(conflict);

    expect(parsed).toEqual(conflict);
    expect(apiErrorSchema.parse(parsed)).toEqual(parsed);
  });

  it('отклоняет объект details с версиями', () => {
    expect(
      mapVersionConflictErrorSchema.safeParse({
        ...conflict,
        details: { expectedVersion: 1, actualVersion: 2 },
      }).success,
    ).toBe(false);
  });
});
