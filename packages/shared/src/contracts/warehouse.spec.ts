import { describe, expect, it } from 'vitest';

import { apiErrorSchema } from '../api-error';
import {
  createWarehouseRequestSchema,
  createWarehouseResponseSchema,
  editWarehouseMapRequestSchema,
  editWarehouseMapResponseSchema,
  inviteWarehouseMemberSchema,
  renameWarehouseRequestSchema,
  renameWarehouseResponseSchema,
  mapVersionConflictErrorSchema,
  listWarehousesResponseSchema,
  warehouseDetailsSchema,
  warehouseMapBodySchema,
  warehouseMapPathParamsSchema,
  warehousePathParamsSchema,
  type EditWarehouseMapRequest,
} from './warehouse';

const UUID_V1 = 'c232ab00-9414-11ec-b3c8-9f4e5d6c7b8a';
const UUID_V4 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const UUID_V7 = '01933c2a-7b3e-7a1b-8c4d-1a2b3c4d5e6f';

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

describe('warehouse requests', () => {
  it('accepts create and rename', () => {
    expect(createWarehouseRequestSchema.parse({ name: 'dock' })).toEqual({ name: 'dock' });
    expect(renameWarehouseRequestSchema.parse({ name: 'dock' })).toEqual({ name: 'dock' });
    expect(warehousePathParamsSchema.parse({ warehouseId: UUID_V4 })).toEqual({
      warehouseId: UUID_V4,
    });
    expect(warehouseMapPathParamsSchema.parse({ mapId: UUID_V7 })).toEqual({ mapId: UUID_V7 });
  });

  it('trims a name and rejects an empty one', () => {
    expect(createWarehouseRequestSchema.parse({ name: '  dock  ' })).toEqual({ name: 'dock' });
    expect(renameWarehouseRequestSchema.parse({ name: '  dock  ' })).toEqual({ name: 'dock' });
    expect(createWarehouseRequestSchema.safeParse({ name: '' }).success).toBe(false);
    expect(renameWarehouseRequestSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(createWarehouseRequestSchema.safeParse({ name: 'd'.repeat(101) }).success).toBe(false);
    expect(createWarehouseRequestSchema.parse({ name: 'd'.repeat(100) })).toEqual({
      name: 'd'.repeat(100),
    });
  });

  it('rejects a wrong type, a missing field, an extra field, and coercion', () => {
    expect(createWarehouseRequestSchema.safeParse({}).success).toBe(false);
    expect(createWarehouseRequestSchema.safeParse({ name: 1 }).success).toBe(false);
    expect(createWarehouseRequestSchema.safeParse({ name: 'dock', extra: true }).success).toBe(
      false,
    );
    expect(renameWarehouseRequestSchema.safeParse({}).success).toBe(false);
    expect(warehousePathParamsSchema.safeParse({ warehouseId: 'wh-1' }).success).toBe(false);
    expect(editWarehouseMapRequestSchema.safeParse({ expectedVersion: '0' }).success).toBe(false);
  });

  it('validates an email for a warehouse invitation', () => {
    expect(inviteWarehouseMemberSchema.parse({ email: 'observer@example.com' })).toEqual({
      email: 'observer@example.com',
    });
    expect(inviteWarehouseMemberSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
    expect(
      inviteWarehouseMemberSchema.safeParse({
        email: 'observer@example.com',
        role: 'owner',
      }).success,
    ).toBe(false);
  });
});

describe('map operations', () => {
  const operations: EditWarehouseMapRequest[] = [
    {
      expectedVersion: 0,
      operation: { type: 'addObstacle', position: { x: -1, y: 2 } },
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
      operation: { type: 'placeRobot', name: 'loader', position: { x: 3, y: 4 } },
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

  it.each(operations)('accepts $operation.type', (request) => {
    expect(editWarehouseMapRequestSchema.parse(request)).toEqual(request);
  });

  it('rejects a missing field, an unknown operation, an invalid UUID, and stationType', () => {
    expect(
      editWarehouseMapRequestSchema.safeParse({
        expectedVersion: 0,
        operation: { type: 'placeStation', position: { x: 1, y: 1 } },
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

  it('rejects an extra field on a nested object', () => {
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

  it('rejects a fractional cell and a blank object name', () => {
    expect(
      editWarehouseMapRequestSchema.safeParse({
        expectedVersion: 0,
        operation: { type: 'addObstacle', position: { x: 1.5, y: 0 } },
      }).success,
    ).toBe(false);
    expect(
      editWarehouseMapRequestSchema.safeParse({
        expectedVersion: 0,
        operation: { type: 'placeRobot', name: '   ', position: { x: 1, y: 1 } },
      }).success,
    ).toBe(false);
  });

  it('rejects a negative and a fractional expectedVersion', () => {
    const operation = { type: 'removeObstacle', position: { x: 0, y: 0 } };

    expect(
      editWarehouseMapRequestSchema.safeParse({ expectedVersion: -1, operation }).success,
    ).toBe(false);
    expect(
      editWarehouseMapRequestSchema.safeParse({ expectedVersion: 1.5, operation }).success,
    ).toBe(false);
  });
});

describe('warehouse responses', () => {
  it('accepts a map with objects and empty collections', () => {
    const map = {
      ...emptyMap,
      obstacles: [{ x: 2, y: 3 }],
      robots: [{ id: UUID_V4, name: 'loader', x: 1, y: 1 }],
      stations: [{ id: UUID_V1, name: 'dock', x: 4, y: 5 }],
    };

    expect(warehouseMapBodySchema.parse(map)).toEqual(map);
    expect(warehouseMapBodySchema.parse(emptyMap)).toEqual(emptyMap);
  });

  it('accepts create, rename, and an edit without createdId', () => {
    const created = { warehouseId: UUID_V4, name: 'dock', mapId: UUID_V7, version: 0 };
    const renamed = { warehouseId: UUID_V4, name: 'dock' };
    const edited = { changed: false, map: emptyMap };

    expect(
      warehouseDetailsSchema.parse({
        warehouseId: UUID_V4,
        name: 'dock',
        createdAt: null,
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toEqual({
      warehouseId: UUID_V4,
      name: 'dock',
      createdAt: null,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(
      listWarehousesResponseSchema.safeParse({
        items: [
          {
            warehouseId: UUID_V4,
            name: 'new',
            createdAt: '2026-02-01T00:00:00.000Z',
            updatedAt: '2026-02-01T00:00:00.000Z',
          },
          { warehouseId: UUID_V7, name: 'old', createdAt: null, updatedAt: null },
        ],
        total: 2,
      }).success,
    ).toBe(true);
    expect(listWarehousesResponseSchema.safeParse({ items: [], total: 1 }).success).toBe(false);
    expect(listWarehousesResponseSchema.safeParse({ items: [], total: -1 }).success).toBe(false);
    expect(createWarehouseResponseSchema.parse(created)).toEqual(created);
    expect(renameWarehouseResponseSchema.parse(renamed)).toEqual(renamed);
    expect(editWarehouseMapResponseSchema.parse(edited)).toEqual(edited);
  });

  it('keeps createdId when it is present', () => {
    const edited = { changed: true, createdId: UUID_V7, map: emptyMap };

    expect(editWarehouseMapResponseSchema.parse(edited)).toEqual(edited);
  });
});

describe('mapVersionConflictErrorSchema', () => {
  const conflict = {
    code: 'MAP_VERSION_CONFLICT',
    message: 'The map version is stale. Read the map again and repeat the command.',
  };

  it('accepts a conflict without details and matches apiErrorSchema', () => {
    const parsed = mapVersionConflictErrorSchema.parse(conflict);

    expect(parsed).toEqual(conflict);
    expect(apiErrorSchema.parse(parsed)).toEqual(parsed);
  });

  it('rejects a details object that contains versions', () => {
    expect(
      mapVersionConflictErrorSchema.safeParse({
        ...conflict,
        details: { expectedVersion: 1, actualVersion: 2 },
      }).success,
    ).toBe(false);
  });
});
