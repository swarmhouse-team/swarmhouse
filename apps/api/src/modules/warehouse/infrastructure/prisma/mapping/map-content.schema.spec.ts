import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { CorruptedMapStateError } from '../../../application/errors/application.errors';
import { restoreStoredWarehouseMap } from '../../../application/mapping/restore-stored-warehouse-map';
import { parseMapContent, toMapContent } from './map-content.schema';

const WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';
const MAP_ID = '22222222-2222-7111-8111-22222222222b';
const OTHER_ID = '55555555-5555-4111-8111-55555555555f';
const ROBOT_ID = '33333333-3333-4111-8111-33333333333c';
const RECEIVING_ID = '44444444-4444-4111-8111-44444444444e';
const ISSUING_ID = '44444444-4444-4111-a111-444444444445';
const INTERMEDIATE_ID = '66666666-6666-4111-8111-66666666666d';

function emptyContent() {
  return {
    width: 20,
    height: 20,
    obstacles: [],
    robots: [],
    stations: [],
  };
}

function formatError(content: unknown): CorruptedMapStateError {
  try {
    parseMapContent(MAP_ID, WAREHOUSE_ID, content);
  } catch (error) {
    expect(error).toBeInstanceOf(CorruptedMapStateError);
    return error as CorruptedMapStateError;
  }
  throw new Error('Expected invalid stored format');
}

describe('toMapContent', () => {
  it('writes content without id and warehouseId', () => {
    expect(
      toMapContent({
        id: MAP_ID,
        warehouseId: WAREHOUSE_ID,
        ...emptyContent(),
        obstacles: [{ x: 1, y: 1 }],
        robots: [{ id: ROBOT_ID, name: 'Robot', x: 2, y: 2 }],
        stations: [{ id: RECEIVING_ID, name: 'Receiving', x: 3, y: 3 }],
      }),
    ).toEqual({
      width: 20,
      height: 20,
      obstacles: [{ x: 1, y: 1 }],
      robots: [{ id: ROBOT_ID, name: 'Robot', x: 2, y: 2 }],
      stations: [{ id: RECEIVING_ID, name: 'Receiving', x: 3, y: 3 }],
    });
  });
});

describe('parseMapContent', () => {
  it('reads an empty map and takes ids from the columns', () => {
    expect(parseMapContent(MAP_ID, WAREHOUSE_ID, emptyContent())).toEqual({
      id: MAP_ID,
      warehouseId: WAREHOUSE_ID,
      ...emptyContent(),
    });
  });

  it('reads an obstacle, a robot, and stations', () => {
    const content = {
      width: 20,
      height: 20,
      obstacles: [{ x: 1, y: 1 }],
      robots: [{ id: ROBOT_ID, name: 'Robot', x: 2, y: 2 }],
      stations: [
        { id: RECEIVING_ID, name: 'Receiving', x: 3, y: 3 },
        { id: ISSUING_ID, name: 'Issuing', x: 4, y: 4 },
        { id: INTERMEDIATE_ID, name: 'Buffer', x: 5, y: 5 },
      ],
    };

    expect(parseMapContent(MAP_ID, WAREHOUSE_ID, content)).toEqual({
      id: MAP_ID,
      warehouseId: WAREHOUSE_ID,
      ...content,
    });
  });

  it('keeps column ids when content repeats them and drops an unknown field', () => {
    const parsed = parseMapContent(MAP_ID, WAREHOUSE_ID, {
      ...emptyContent(),
      id: OTHER_ID,
      warehouseId: OTHER_ID,
      note: 'ignored',
    });

    expect(parsed.id).toBe(MAP_ID);
    expect(parsed.warehouseId).toBe(WAREHOUSE_ID);
    expect(parsed).not.toHaveProperty('note');
  });

  it.each([
    null,
    [],
    'map',
    1,
    { height: 20, obstacles: [], robots: [], stations: [] },
    { ...emptyContent(), width: '20' },
    { ...emptyContent(), height: null },
    { ...emptyContent(), obstacles: {} },
    { ...emptyContent(), robots: [{ id: ROBOT_ID, x: 0, y: 0 }] },
    { ...emptyContent(), obstacles: [{ x: 1 }] },
    { ...emptyContent(), obstacles: [{ x: '1', y: 1 }] },
    { ...emptyContent(), obstacles: [{ x: 1.5, y: 0 }] },
    { ...emptyContent(), robots: [{ id: 'not-a-uuid', name: 'Robot', x: 0, y: 0 }] },
    { ...emptyContent(), robots: [{ id: ROBOT_ID, name: '', x: 0, y: 0 }] },
  ])('rejects malformed content %j', (content) => {
    const error = formatError(content);

    expect(error.details).toEqual({ mapId: MAP_ID, reason: 'INVALID_STORED_FORMAT' });
    expect(error.cause).toBeInstanceOf(ZodError);
  });

  it('passes a structurally valid map that restore rejects', () => {
    const outside = parseMapContent(MAP_ID, WAREHOUSE_ID, {
      ...emptyContent(),
      obstacles: [{ x: 20, y: 0 }],
    });
    const occupied = parseMapContent(MAP_ID, WAREHOUSE_ID, {
      ...emptyContent(),
      obstacles: [{ x: 1, y: 1 }],
      robots: [{ id: ROBOT_ID, name: 'Robot', x: 1, y: 1 }],
    });

    expect(restoreReason(outside)).toBe('DOMAIN_INVARIANT');
    expect(restoreReason(occupied)).toBe('DOMAIN_INVARIANT');
  });
});

function restoreReason(input: ReturnType<typeof parseMapContent>): string | undefined {
  try {
    restoreStoredWarehouseMap(input);
  } catch (error) {
    const reason = error instanceof CorruptedMapStateError ? error.details?.reason : undefined;
    return typeof reason === 'string' ? reason : undefined;
  }
  return undefined;
}
