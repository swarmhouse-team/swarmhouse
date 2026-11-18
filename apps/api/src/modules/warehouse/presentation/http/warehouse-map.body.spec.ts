import { warehouseMapBodySchema } from '@robots/shared';
import { describe, expect, it } from 'vitest';

import type { WarehouseMapSnapshot } from '../../domain/entities/warehouse-map';
import { toWarehouseMapBody } from './warehouse-map.body';

const WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';
const MAP_ID = '22222222-2222-7111-8111-22222222222b';
const ROBOT_ID = '33333333-3333-4111-8111-33333333333c';
const RECEIVING_ID = '44444444-4444-4111-8111-44444444444e';
const ISSUING_ID = '55555555-5555-4111-8111-55555555555a';
const INTERMEDIATE_ID = '66666666-6666-4111-8111-66666666666d';

function snapshot(overrides: Partial<WarehouseMapSnapshot> = {}): WarehouseMapSnapshot {
  return {
    id: MAP_ID,
    warehouseId: WAREHOUSE_ID,
    width: 20,
    height: 20,
    obstacles: [],
    robots: [],
    stations: [],
    ...overrides,
  };
}

describe('toWarehouseMapBody', () => {
  it('returns empty collections and the snapshot ids', () => {
    const source = snapshot();
    const body = toWarehouseMapBody(source, 0);

    expect(body).toEqual({
      mapId: MAP_ID,
      warehouseId: WAREHOUSE_ID,
      version: 0,
      width: 20,
      height: 20,
      obstacles: [],
      robots: [],
      stations: [],
    });
    expect(warehouseMapBodySchema.parse(body)).toEqual(body);
  });

  it('puts an obstacle, a robot, and every station type into flat fields', () => {
    const source = snapshot({
      obstacles: [{ x: 2, y: 3 }],
      robots: [{ id: ROBOT_ID, name: 'loader', x: 1, y: 1 }],
      stations: [
        { id: RECEIVING_ID, name: 'receiving', type: 'receiving', x: 0, y: 1 },
        { id: ISSUING_ID, name: 'issuing', type: 'issuing', x: 4, y: 5 },
        { id: INTERMEDIATE_ID, name: 'intermediate', type: 'intermediate', x: 6, y: 7 },
      ],
    });
    const before = structuredClone(source);
    const body = toWarehouseMapBody(source, 3);

    expect(warehouseMapBodySchema.parse(body)).toEqual({
      mapId: MAP_ID,
      warehouseId: WAREHOUSE_ID,
      version: 3,
      width: 20,
      height: 20,
      obstacles: [{ x: 2, y: 3 }],
      robots: [{ id: ROBOT_ID, name: 'loader', x: 1, y: 1 }],
      stations: [
        { id: RECEIVING_ID, name: 'receiving', type: 'receiving', x: 0, y: 1 },
        { id: ISSUING_ID, name: 'issuing', type: 'issuing', x: 4, y: 5 },
        { id: INTERMEDIATE_ID, name: 'intermediate', type: 'intermediate', x: 6, y: 7 },
      ],
    });
    expect(JSON.stringify(body)).not.toContain('position');
    expect(body.obstacles[0]).not.toHaveProperty('id');
    expect(source).toEqual(before);

    body.robots[0]!.name = 'changed';
    body.obstacles.push({ x: 9, y: 9 });
    body.stations[0]!.type = 'issuing';
    expect(source).toEqual(before);
  });
});
