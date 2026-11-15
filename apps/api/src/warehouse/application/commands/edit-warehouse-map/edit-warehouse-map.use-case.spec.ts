import { describe, expect, it } from 'vitest';

import { WarehouseMap, type WarehouseMapSnapshot } from '../../../domain/entities/warehouse-map';
import { StationType } from '../../../domain/enums/station-type';
import {
  CellOccupiedError,
  DuplicateObjectIdError,
  DuplicateStationNameError,
  MapObjectNotFoundError,
  PositionOutOfBoundsError,
} from '../../../domain/errors/map.errors';
import { InvalidNameError, InvalidPositionError } from '../../../domain/errors/value.errors';
import { Position } from '../../../domain/vo/position';
import {
  CorruptedMapStateError,
  MapVersionConflictError,
  WarehouseMapNotFoundError,
} from '../../errors/application.errors';
import type { SaveMapResult } from '../../ports/repositories/warehouse-map.repository';
import type { IdGenerator } from '../../ports/system/id-generator';
import type { TransactionContext, UnitOfWork } from '../../ports/system/unit-of-work';
import type { WarehouseMap as SavedMap } from '../../../domain/entities/warehouse-map';
import { EditWarehouseMap } from './edit-warehouse-map.use-case';
import type { EditWarehouseMapInput } from './edit-warehouse-map.types';

interface Harness {
  useCase: EditWarehouseMap;
  calls: string[];
  saved?: { map: SavedMap; expectedVersion: number };
}

function emptySnapshot(): WarehouseMapSnapshot {
  return WarehouseMap.create('map-1', 'wh-1').snapshot();
}

function createHarness(options?: {
  found?: { snapshot: WarehouseMapSnapshot; version: number } | null;
  saveResult?: SaveMapResult;
  findError?: Error;
  nextId?: string;
  afterCallback?: () => Promise<void>;
}): Harness {
  const calls: string[] = [];
  const state: Harness = {
    useCase: undefined as unknown as EditWarehouseMap,
    calls,
  };
  const unitOfWork: UnitOfWork = {
    async execute(work) {
      calls.push('execute');
      const tx: TransactionContext = {
        warehouses: {
          async insert() {
            throw new Error('warehouse repository must not be used');
          },
          async findById() {
            throw new Error('warehouse repository must not be used');
          },
          async save() {
            throw new Error('warehouse repository must not be used');
          },
          async delete() {
            throw new Error('warehouse repository must not be used');
          },
        },
        maps: {
          async insert() {
            calls.push('insert');
          },
          async findById(mapId) {
            calls.push(`findById:${mapId}`);
            if (options?.findError) {
              throw options.findError;
            }
            return options?.found === undefined
              ? { snapshot: emptySnapshot(), version: 0 }
              : options.found;
          },
          async findByWarehouseId() {
            throw new Error('findByWarehouseId must not be used');
          },
          async save(map, expectedVersion) {
            calls.push('save');
            state.saved = { map, expectedVersion };
            return options?.saveResult ?? { status: 'saved', version: 1 };
          },
          async deleteByWarehouseId() {
            throw new Error('deleteByWarehouseId must not be used');
          },
        },
      };
      const result = await work(tx);
      await options?.afterCallback?.();
      return result;
    },
  };
  const ids: IdGenerator = {
    next() {
      calls.push('nextId');
      return options?.nextId ?? 'robot-1';
    },
  };
  state.useCase = new EditWarehouseMap(unitOfWork, ids);
  return state;
}

function addObstacle(expectedVersion = 0): EditWarehouseMapInput & {
  operation: Extract<EditWarehouseMapInput['operation'], { type: 'addObstacle' }>;
} {
  return {
    mapId: 'map-1',
    expectedVersion,
    operation: { type: 'addObstacle', position: { x: 4, y: 5 } },
  };
}

function mapWithObstacle(x: number, y: number): WarehouseMapSnapshot {
  const map = WarehouseMap.create('map-1', 'wh-1');
  map.addObstacle(Position.create(x, y));
  return map.snapshot();
}

function mapWithRobot(id = 'robot-1', x = 1, y = 1): WarehouseMapSnapshot {
  const map = WarehouseMap.create('map-1', 'wh-1');
  map.placeRobot(id, 'loader', Position.create(x, y));
  return map.snapshot();
}

describe('EditWarehouseMap addObstacle', () => {
  it('saves the obstacle and returns the version from save', async () => {
    const stored = emptySnapshot();
    const before = structuredClone(stored);
    const harness = createHarness({
      found: { snapshot: stored, version: 2 },
      saveResult: { status: 'saved', version: 3 },
    });

    const result = await harness.useCase.execute(addObstacle(2));

    expect(harness.calls).toEqual(['execute', 'findById:map-1', 'save']);
    expect(harness.saved?.expectedVersion).toBe(2);
    expect(harness.saved?.map.snapshot().obstacles).toEqual([{ x: 4, y: 5 }]);
    expect(result).toEqual({
      mapId: 'map-1',
      version: 3,
      changed: true,
      snapshot: harness.saved?.map.snapshot(),
    });
    expect(stored).toEqual(before);
  });

  it('does not save when the map is missing', async () => {
    const harness = createHarness({ found: null });

    await expect(harness.useCase.execute(addObstacle())).rejects.toMatchObject({
      name: 'WarehouseMapNotFoundError',
      details: { mapId: 'map-1' },
    });
    expect(harness.calls).toEqual(['execute', 'findById:map-1']);
  });

  it('does not save when the loaded version is stale', async () => {
    const harness = createHarness({ found: { snapshot: emptySnapshot(), version: 4 } });

    await expect(harness.useCase.execute(addObstacle(1))).rejects.toEqual(
      expect.any(MapVersionConflictError),
    );
    await expect(harness.useCase.execute(addObstacle(1))).rejects.toMatchObject({
      details: { mapId: 'map-1', expectedVersion: 1, actualVersion: 4 },
    });
    expect(harness.calls.filter((call) => call === 'save')).toEqual([]);
  });

  it('does not save a corrupted stored snapshot', async () => {
    const stored = emptySnapshot();
    stored.width = 10;
    const harness = createHarness({ found: { snapshot: stored, version: 0 } });

    await expect(harness.useCase.execute(addObstacle())).rejects.toBeInstanceOf(
      CorruptedMapStateError,
    );
    expect(harness.calls).not.toContain('save');
  });

  it('does not save an invalid position', async () => {
    const harness = createHarness();
    const input = addObstacle();
    input.operation.position = { x: 1.5, y: 0 };

    await expect(harness.useCase.execute(input)).rejects.toBeInstanceOf(InvalidPositionError);
    expect(harness.calls).not.toContain('save');
  });

  it('does not save a position outside the map', async () => {
    const harness = createHarness();
    const input = addObstacle();
    input.operation.position = { x: 20, y: 0 };

    await expect(harness.useCase.execute(input)).rejects.toBeInstanceOf(PositionOutOfBoundsError);
    expect(harness.calls).not.toContain('save');
  });

  it('does not save a second obstacle on an occupied cell', async () => {
    const map = WarehouseMap.create('map-1', 'wh-1');
    map.addObstacle(Position.create(4, 5));
    const harness = createHarness({ found: { snapshot: map.snapshot(), version: 0 } });

    await expect(harness.useCase.execute(addObstacle())).rejects.toBeInstanceOf(CellOccupiedError);
    expect(harness.calls).not.toContain('save');
  });

  it('maps a save conflict to MapVersionConflictError', async () => {
    const harness = createHarness({ saveResult: { status: 'conflict', actualVersion: 8 } });

    await expect(harness.useCase.execute(addObstacle())).rejects.toMatchObject({
      name: 'MapVersionConflictError',
      details: { mapId: 'map-1', expectedVersion: 0, actualVersion: 8 },
    });
  });

  it('maps a missing map at save time to WarehouseMapNotFoundError', async () => {
    const harness = createHarness({ saveResult: { status: 'not_found' } });

    await expect(harness.useCase.execute(addObstacle())).rejects.toBeInstanceOf(
      WarehouseMapNotFoundError,
    );
  });

  it('propagates a repository error unchanged', async () => {
    const failure = new Error('database unavailable');
    const harness = createHarness({ findError: failure });

    await expect(harness.useCase.execute(addObstacle())).rejects.toBe(failure);
  });

  it('rejects with the commit error after a successful callback', async () => {
    const failure = new Error('commit failed');
    const harness = createHarness({
      afterCallback: () => {
        throw failure;
      },
    });

    await expect(harness.useCase.execute(addObstacle())).rejects.toBe(failure);
  });

  it('does not settle before unit of work execute settles', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const harness = createHarness({ afterCallback: () => gate });
    let settled = false;
    const pending = harness.useCase.execute(addObstacle()).finally(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);
    release?.();
    await pending;
    expect(settled).toBe(true);
  });
});

describe('EditWarehouseMap moveObstacle', () => {
  it('moves an obstacle and saves with the original expected version', async () => {
    const stored = mapWithObstacle(1, 1);
    const before = structuredClone(stored);
    const harness = createHarness({
      found: { snapshot: stored, version: 2 },
      saveResult: { status: 'saved', version: 3 },
    });

    const result = await harness.useCase.execute({
      mapId: 'map-1',
      expectedVersion: 2,
      operation: { type: 'moveObstacle', from: { x: 1, y: 1 }, to: { x: 2, y: 3 } },
    });

    expect(harness.saved?.expectedVersion).toBe(2);
    expect(harness.saved?.map.snapshot().obstacles).toEqual([{ x: 2, y: 3 }]);
    expect(result).toMatchObject({ version: 3, changed: true });
    expect(stored).toEqual(before);
  });

  it('does not save a move onto the obstacle cell', async () => {
    const stored = mapWithObstacle(1, 1);
    const harness = createHarness({ found: { snapshot: stored, version: 2 } });

    const result = await harness.useCase.execute({
      mapId: 'map-1',
      expectedVersion: 2,
      operation: { type: 'moveObstacle', from: { x: 1, y: 1 }, to: { x: 1, y: 1 } },
    });

    expect(result).toMatchObject({ changed: false, version: 2 });
    expect(harness.calls).not.toContain('save');
  });

  it('does not save a move of a missing obstacle, including the same cell', async () => {
    const harness = createHarness();

    await expect(
      harness.useCase.execute({
        mapId: 'map-1',
        expectedVersion: 0,
        operation: { type: 'moveObstacle', from: { x: 1, y: 1 }, to: { x: 1, y: 1 } },
      }),
    ).rejects.toBeInstanceOf(MapObjectNotFoundError);
    expect(harness.calls).not.toContain('save');
  });

  it('does not save a move onto an occupied cell or outside the map', async () => {
    const occupied = WarehouseMap.create('map-1', 'wh-1');
    occupied.addObstacle(Position.create(1, 1));
    occupied.addObstacle(Position.create(2, 2));
    const occupiedHarness = createHarness({
      found: { snapshot: occupied.snapshot(), version: 0 },
    });
    await expect(
      occupiedHarness.useCase.execute({
        mapId: 'map-1',
        expectedVersion: 0,
        operation: { type: 'moveObstacle', from: { x: 1, y: 1 }, to: { x: 2, y: 2 } },
      }),
    ).rejects.toBeInstanceOf(CellOccupiedError);

    const outside = createHarness({ found: { snapshot: mapWithObstacle(1, 1), version: 0 } });
    await expect(
      outside.useCase.execute({
        mapId: 'map-1',
        expectedVersion: 0,
        operation: { type: 'moveObstacle', from: { x: 1, y: 1 }, to: { x: 20, y: 0 } },
      }),
    ).rejects.toBeInstanceOf(PositionOutOfBoundsError);
    expect(outside.calls).not.toContain('save');
  });

  it.each([
    { from: { x: 1.5, y: 1 }, to: { x: 2, y: 2 } },
    { from: { x: 1.5, y: 1 }, to: { x: 1.5, y: 1 } },
  ])('does not save an invalid move from ($from.x) to ($to.x)', async ({ from, to }) => {
    const harness = createHarness({ found: { snapshot: mapWithObstacle(1, 1), version: 0 } });

    await expect(
      harness.useCase.execute({
        mapId: 'map-1',
        expectedVersion: 0,
        operation: { type: 'moveObstacle', from, to },
      }),
    ).rejects.toBeInstanceOf(InvalidPositionError);
    expect(harness.calls).not.toContain('save');
  });

  it('rejects a stale version before a no-op move', async () => {
    const harness = createHarness({ found: { snapshot: mapWithObstacle(1, 1), version: 4 } });

    await expect(
      harness.useCase.execute({
        mapId: 'map-1',
        expectedVersion: 1,
        operation: { type: 'moveObstacle', from: { x: 1, y: 1 }, to: { x: 1, y: 1 } },
      }),
    ).rejects.toMatchObject({
      name: 'MapVersionConflictError',
      details: { mapId: 'map-1', expectedVersion: 1, actualVersion: 4 },
    });
    expect(harness.calls).not.toContain('save');
  });
});

describe('EditWarehouseMap removeObstacle', () => {
  it('removes an obstacle and uses the version returned by save', async () => {
    const stored = mapWithObstacle(1, 1);
    const before = structuredClone(stored);
    const harness = createHarness({
      found: { snapshot: stored, version: 2 },
      saveResult: { status: 'saved', version: 3 },
    });

    const result = await harness.useCase.execute({
      mapId: 'map-1',
      expectedVersion: 2,
      operation: { type: 'removeObstacle', position: { x: 1, y: 1 } },
    });

    expect(harness.saved?.map.snapshot().obstacles).toEqual([]);
    expect(harness.saved?.expectedVersion).toBe(2);
    expect(result).toMatchObject({ changed: true, version: 3 });
    expect(stored).toEqual(before);
  });

  it('does not save removal of a missing obstacle or an invalid position', async () => {
    const missing = createHarness();
    await expect(
      missing.useCase.execute({
        mapId: 'map-1',
        expectedVersion: 0,
        operation: { type: 'removeObstacle', position: { x: 1, y: 1 } },
      }),
    ).rejects.toBeInstanceOf(MapObjectNotFoundError);

    const invalid = createHarness({ found: { snapshot: mapWithObstacle(1, 1), version: 0 } });
    await expect(
      invalid.useCase.execute({
        mapId: 'map-1',
        expectedVersion: 0,
        operation: { type: 'removeObstacle', position: { x: -1, y: 0 } },
      }),
    ).rejects.toBeInstanceOf(InvalidPositionError);
    expect(invalid.calls).not.toContain('save');
  });

  it.each(['moveObstacle', 'removeObstacle'] as const)(
    'maps save conflict and not_found for %s',
    async (type) => {
      const operation =
        type === 'moveObstacle'
          ? { type, from: { x: 1, y: 1 }, to: { x: 2, y: 2 } }
          : { type, position: { x: 1, y: 1 } };
      const found = { snapshot: mapWithObstacle(1, 1), version: 0 };
      const conflict = createHarness({
        found,
        saveResult: { status: 'conflict', actualVersion: 8 },
      });
      await expect(
        conflict.useCase.execute({ mapId: 'map-1', expectedVersion: 0, operation }),
      ).rejects.toMatchObject({
        details: { mapId: 'map-1', expectedVersion: 0, actualVersion: 8 },
      });

      const missing = createHarness({ found, saveResult: { status: 'not_found' } });
      await expect(
        missing.useCase.execute({ mapId: 'map-1', expectedVersion: 0, operation }),
      ).rejects.toBeInstanceOf(WarehouseMapNotFoundError);
    },
  );
});

describe('EditWarehouseMap placeRobot', () => {
  it('places a robot with the generated id and the normalized name', async () => {
    const map = WarehouseMap.create('map-1', 'wh-1');
    map.addObstacle(Position.create(0, 0));
    map.placeStation('station-1', 'Dock', StationType.Receiving, Position.create(1, 0));
    const stored = map.snapshot();
    const before = structuredClone(stored);
    const harness = createHarness({
      found: { snapshot: stored, version: 2 },
      saveResult: { status: 'saved', version: 3 },
    });

    const result = await harness.useCase.execute({
      mapId: 'map-1',
      expectedVersion: 2,
      operation: { type: 'placeRobot', name: '  loader  ', position: { x: 3, y: 4 } },
    });

    const saved = harness.saved?.map.snapshot();
    expect(saved?.robots).toEqual([{ id: 'robot-1', name: 'loader', x: 3, y: 4 }]);
    expect(saved?.obstacles).toEqual(stored.obstacles);
    expect(saved?.stations).toEqual(stored.stations);
    expect(harness.calls.filter((call) => call === 'nextId')).toEqual(['nextId']);
    expect(result).toEqual({
      mapId: 'map-1',
      version: 3,
      changed: true,
      createdId: 'robot-1',
      snapshot: saved,
    });
    expect(stored).toEqual(before);
  });

  it('does not save an empty robot name', async () => {
    const harness = createHarness();

    await expect(
      harness.useCase.execute({
        mapId: 'map-1',
        expectedVersion: 0,
        operation: { type: 'placeRobot', name: '   ', position: { x: 1, y: 1 } },
      }),
    ).rejects.toBeInstanceOf(InvalidNameError);
    expect(harness.calls).not.toContain('save');
  });

  it.each([
    { position: { x: 1.5, y: 0 }, error: InvalidPositionError },
    { position: { x: 20, y: 0 }, error: PositionOutOfBoundsError },
    { position: { x: 4, y: 5 }, error: CellOccupiedError },
  ])(
    'does not save a rejected place at ($position.x, $position.y)',
    async ({ position, error }) => {
      const map = WarehouseMap.create('map-1', 'wh-1');
      map.addObstacle(Position.create(4, 5));
      const harness = createHarness({ found: { snapshot: map.snapshot(), version: 0 } });

      await expect(
        harness.useCase.execute({
          mapId: 'map-1',
          expectedVersion: 0,
          operation: { type: 'placeRobot', name: 'loader', position },
        }),
      ).rejects.toBeInstanceOf(error);
      expect(harness.calls).not.toContain('save');
    },
  );

  it.each(['robot-1', 'station-1'])(
    'does not generate another id when %s is already taken',
    async (nextId) => {
      const map = WarehouseMap.create('map-1', 'wh-1');
      map.placeRobot('robot-1', 'loader', Position.create(0, 0));
      map.placeStation('station-1', 'Dock', StationType.Receiving, Position.create(1, 0));
      const harness = createHarness({
        found: { snapshot: map.snapshot(), version: 0 },
        nextId,
      });

      await expect(
        harness.useCase.execute({
          mapId: 'map-1',
          expectedVersion: 0,
          operation: { type: 'placeRobot', name: 'spare', position: { x: 2, y: 2 } },
        }),
      ).rejects.toBeInstanceOf(DuplicateObjectIdError);
      expect(harness.calls.filter((call) => call === 'nextId')).toEqual(['nextId']);
      expect(harness.calls).not.toContain('save');
    },
  );
});

describe('EditWarehouseMap moveRobot', () => {
  it('moves a robot and leaves the previous cell free', async () => {
    const map = WarehouseMap.create('map-1', 'wh-1');
    map.placeRobot('robot-1', 'loader', Position.create(1, 1));
    map.addObstacle(Position.create(0, 0));
    map.placeStation('station-1', 'Dock', StationType.Receiving, Position.create(1, 0));
    const stored = map.snapshot();
    const before = structuredClone(stored);
    const harness = createHarness({
      found: { snapshot: stored, version: 2 },
      saveResult: { status: 'saved', version: 3 },
    });

    const result = await harness.useCase.execute({
      mapId: 'map-1',
      expectedVersion: 2,
      operation: { type: 'moveRobot', robotId: 'robot-1', position: { x: 2, y: 3 } },
    });

    const saved = harness.saved?.map.snapshot();
    expect(saved?.robots).toEqual([{ id: 'robot-1', name: 'loader', x: 2, y: 3 }]);
    expect(saved?.obstacles).toEqual(stored.obstacles);
    expect(saved?.stations).toEqual(stored.stations);
    expect(result).toMatchObject({ version: 3, changed: true });
    expect(result).not.toHaveProperty('createdId');
    expect(harness.calls).not.toContain('nextId');
    expect(stored).toEqual(before);
  });

  it('does not save a move onto the robot cell', async () => {
    const harness = createHarness({ found: { snapshot: mapWithRobot(), version: 2 } });

    const result = await harness.useCase.execute({
      mapId: 'map-1',
      expectedVersion: 2,
      operation: { type: 'moveRobot', robotId: 'robot-1', position: { x: 1, y: 1 } },
    });

    expect(result).toMatchObject({ mapId: 'map-1', changed: false, version: 2 });
    expect(result).not.toHaveProperty('createdId');
    expect(harness.calls).not.toContain('save');
    expect(harness.calls).not.toContain('nextId');
  });

  it('does not save a move of a missing robot', async () => {
    const harness = createHarness();

    await expect(
      harness.useCase.execute({
        mapId: 'map-1',
        expectedVersion: 0,
        operation: { type: 'moveRobot', robotId: 'missing', position: { x: 1, y: 1 } },
      }),
    ).rejects.toBeInstanceOf(MapObjectNotFoundError);
    expect(harness.calls).not.toContain('save');
    expect(harness.calls).not.toContain('nextId');
  });

  it.each([
    { position: { x: 1.5, y: 1 }, error: InvalidPositionError },
    { position: { x: 20, y: 0 }, error: PositionOutOfBoundsError },
    { position: { x: 2, y: 2 }, error: CellOccupiedError },
  ])('does not save a rejected move to ($position.x, $position.y)', async ({ position, error }) => {
    const map = WarehouseMap.create('map-1', 'wh-1');
    map.placeRobot('robot-1', 'loader', Position.create(1, 1));
    map.addObstacle(Position.create(2, 2));
    const harness = createHarness({ found: { snapshot: map.snapshot(), version: 0 } });

    await expect(
      harness.useCase.execute({
        mapId: 'map-1',
        expectedVersion: 0,
        operation: { type: 'moveRobot', robotId: 'robot-1', position },
      }),
    ).rejects.toBeInstanceOf(error);
    expect(harness.calls).not.toContain('save');
  });

  it('rejects a stale version before a no-op move', async () => {
    const harness = createHarness({ found: { snapshot: mapWithRobot(), version: 4 } });

    await expect(
      harness.useCase.execute({
        mapId: 'map-1',
        expectedVersion: 1,
        operation: { type: 'moveRobot', robotId: 'robot-1', position: { x: 1, y: 1 } },
      }),
    ).rejects.toMatchObject({
      name: 'MapVersionConflictError',
      details: { mapId: 'map-1', expectedVersion: 1, actualVersion: 4 },
    });
    expect(harness.calls).not.toContain('save');
    expect(harness.calls).not.toContain('nextId');
  });
});

describe('EditWarehouseMap removeRobot', () => {
  it('removes a robot and keeps the other map objects', async () => {
    const map = WarehouseMap.create('map-1', 'wh-1');
    map.placeRobot('robot-1', 'loader', Position.create(1, 1));
    map.addObstacle(Position.create(0, 0));
    map.placeStation('station-1', 'Dock', StationType.Receiving, Position.create(1, 0));
    const stored = map.snapshot();
    const before = structuredClone(stored);
    const harness = createHarness({
      found: { snapshot: stored, version: 2 },
      saveResult: { status: 'saved', version: 3 },
    });

    const result = await harness.useCase.execute({
      mapId: 'map-1',
      expectedVersion: 2,
      operation: { type: 'removeRobot', robotId: 'robot-1' },
    });

    const saved = harness.saved?.map.snapshot();
    expect(saved?.robots).toEqual([]);
    expect(saved?.obstacles).toEqual(stored.obstacles);
    expect(saved?.stations).toEqual(stored.stations);
    expect(result).toMatchObject({ changed: true, version: 3 });
    expect(result).not.toHaveProperty('createdId');
    expect(harness.calls).not.toContain('nextId');
    expect(stored).toEqual(before);
  });

  it('does not save removal of a missing robot', async () => {
    const harness = createHarness();

    await expect(
      harness.useCase.execute({
        mapId: 'map-1',
        expectedVersion: 0,
        operation: { type: 'removeRobot', robotId: 'missing' },
      }),
    ).rejects.toBeInstanceOf(MapObjectNotFoundError);
    expect(harness.calls).not.toContain('save');
    expect(harness.calls).not.toContain('nextId');
  });
});

describe('EditWarehouseMap robot save outcomes', () => {
  it.each(['placeRobot', 'moveRobot', 'removeRobot'] as const)(
    'maps save conflict and not_found for %s',
    async (type) => {
      const operation =
        type === 'placeRobot'
          ? { type, name: 'loader', position: { x: 3, y: 4 } }
          : type === 'moveRobot'
            ? { type, robotId: 'robot-1', position: { x: 2, y: 2 } }
            : { type, robotId: 'robot-1' };
      const found = {
        snapshot: type === 'placeRobot' ? emptySnapshot() : mapWithRobot(),
        version: 0,
      };
      const conflict = createHarness({
        found,
        saveResult: { status: 'conflict', actualVersion: 8 },
      });
      await expect(
        conflict.useCase.execute({ mapId: 'map-1', expectedVersion: 0, operation }),
      ).rejects.toMatchObject({
        details: { mapId: 'map-1', expectedVersion: 0, actualVersion: 8 },
      });

      const missing = createHarness({ found, saveResult: { status: 'not_found' } });
      await expect(
        missing.useCase.execute({ mapId: 'map-1', expectedVersion: 0, operation }),
      ).rejects.toBeInstanceOf(WarehouseMapNotFoundError);
    },
  );

  it('does not return success when commit fails after placing a robot', async () => {
    const failure = new Error('commit failed');
    const harness = createHarness({
      afterCallback: () => {
        throw failure;
      },
    });

    await expect(
      harness.useCase.execute({
        mapId: 'map-1',
        expectedVersion: 0,
        operation: { type: 'placeRobot', name: 'loader', position: { x: 1, y: 1 } },
      }),
    ).rejects.toBe(failure);
  });

  it.each([
    {
      name: 'missing map',
      found: null,
      expectedVersion: 0,
    },
    {
      name: 'stale version',
      found: { snapshot: emptySnapshot(), version: 4 },
      expectedVersion: 1,
    },
  ])(
    'does not allocate an id for placeRobot when the $name',
    async ({ found, expectedVersion }) => {
      const harness = createHarness({ found });

      await expect(
        harness.useCase.execute({
          mapId: 'map-1',
          expectedVersion,
          operation: { type: 'placeRobot', name: 'loader', position: { x: 1, y: 1 } },
        }),
      ).rejects.toBeInstanceOf(Error);
      expect(harness.calls).not.toContain('nextId');
      expect(harness.calls).not.toContain('save');
    },
  );
});

function mapWithStation(id = 'station-1', x = 1, y = 0, name = 'Приёмка'): WarehouseMapSnapshot {
  const map = WarehouseMap.create('map-1', 'wh-1');
  map.placeStation(id, name, StationType.Receiving, Position.create(x, y));
  return map.snapshot();
}

function occupiedMap(kind: 'obstacle' | 'robot' | 'station'): WarehouseMap {
  const map = WarehouseMap.create('map-1', 'wh-1');
  const position = Position.create(4, 5);
  if (kind === 'obstacle') {
    map.addObstacle(position);
  }
  if (kind === 'robot') {
    map.placeRobot('robot-1', 'loader', position);
  }
  if (kind === 'station') {
    map.placeStation('station-1', 'Other', StationType.Issuing, position);
  }
  return map;
}

describe('EditWarehouseMap placeStation', () => {
  it.each(Object.values(StationType))(
    'places a %s station with the generated id and a normalized name',
    async (stationType) => {
      const map = WarehouseMap.create('map-1', 'wh-1');
      map.placeRobot('robot-1', 'loader', Position.create(0, 0));
      map.addObstacle(Position.create(1, 1));
      const stored = map.snapshot();
      const before = structuredClone(stored);
      const harness = createHarness({
        found: { snapshot: stored, version: 2 },
        saveResult: { status: 'saved', version: 3 },
        nextId: 'station-9',
      });

      const result = await harness.useCase.execute({
        mapId: 'map-1',
        expectedVersion: 2,
        operation: {
          type: 'placeStation',
          name: '  Приёмка  ',
          stationType,
          position: { x: 3, y: 4 },
        },
      });

      const saved = harness.saved?.map.snapshot();
      expect(saved?.stations).toEqual([
        { id: 'station-9', name: 'Приёмка', type: stationType, x: 3, y: 4 },
      ]);
      expect(saved?.robots).toEqual(stored.robots);
      expect(saved?.obstacles).toEqual(stored.obstacles);
      expect(result).toEqual({
        mapId: 'map-1',
        version: 3,
        changed: true,
        createdId: 'station-9',
        snapshot: saved,
      });
      expect(stored).toEqual(before);
    },
  );

  it('does not save a station whose name matches an existing one ignoring case', async () => {
    const harness = createHarness({
      found: { snapshot: mapWithStation('station-1', 1, 0, 'Приёмка'), version: 0 },
      nextId: 'station-2',
    });

    await expect(
      harness.useCase.execute({
        mapId: 'map-1',
        expectedVersion: 0,
        operation: {
          type: 'placeStation',
          name: ' приёмка ',
          stationType: StationType.Issuing,
          position: { x: 2, y: 2 },
        },
      }),
    ).rejects.toBeInstanceOf(DuplicateStationNameError);
    expect(harness.calls).not.toContain('save');
  });

  it('does not save an empty station name', async () => {
    const harness = createHarness();

    await expect(
      harness.useCase.execute({
        mapId: 'map-1',
        expectedVersion: 0,
        operation: {
          type: 'placeStation',
          name: '   ',
          stationType: StationType.Receiving,
          position: { x: 1, y: 1 },
        },
      }),
    ).rejects.toBeInstanceOf(InvalidNameError);
    expect(harness.calls).not.toContain('save');
  });

  it.each(['robot-1', 'station-1'])(
    'does not generate another id when %s is already taken',
    async (nextId) => {
      const map = WarehouseMap.create('map-1', 'wh-1');
      map.placeRobot('robot-1', 'loader', Position.create(0, 0));
      map.placeStation('station-1', 'Dock', StationType.Receiving, Position.create(1, 0));
      const harness = createHarness({ found: { snapshot: map.snapshot(), version: 0 }, nextId });

      await expect(
        harness.useCase.execute({
          mapId: 'map-1',
          expectedVersion: 0,
          operation: {
            type: 'placeStation',
            name: 'Spare',
            stationType: StationType.Issuing,
            position: { x: 2, y: 2 },
          },
        }),
      ).rejects.toBeInstanceOf(DuplicateObjectIdError);
      expect(harness.calls.filter((call) => call === 'nextId')).toEqual(['nextId']);
      expect(harness.calls).not.toContain('save');
    },
  );

  it.each([
    { position: { x: 1.5, y: 0 }, error: InvalidPositionError, occupy: 'none' as const },
    { position: { x: 20, y: 0 }, error: PositionOutOfBoundsError, occupy: 'none' as const },
    { position: { x: 4, y: 5 }, error: CellOccupiedError, occupy: 'obstacle' as const },
    { position: { x: 4, y: 5 }, error: CellOccupiedError, occupy: 'robot' as const },
    { position: { x: 4, y: 5 }, error: CellOccupiedError, occupy: 'station' as const },
  ])(
    'does not save a rejected place at ($position.x, $position.y) occupied by $occupy',
    async ({ position, error, occupy }) => {
      const stored = occupy === 'none' ? emptySnapshot() : occupiedMap(occupy).snapshot();
      const harness = createHarness({
        found: { snapshot: stored, version: 0 },
        nextId: 'station-9',
      });

      await expect(
        harness.useCase.execute({
          mapId: 'map-1',
          expectedVersion: 0,
          operation: {
            type: 'placeStation',
            name: 'Dock',
            stationType: StationType.Receiving,
            position,
          },
        }),
      ).rejects.toBeInstanceOf(error);
      expect(harness.calls).not.toContain('save');
    },
  );
});

describe('EditWarehouseMap moveStation', () => {
  it('moves a station without changing its id, name, or type', async () => {
    const map = WarehouseMap.create('map-1', 'wh-1');
    map.placeStation('station-1', 'Приёмка', StationType.Receiving, Position.create(1, 0));
    map.placeRobot('robot-1', 'loader', Position.create(0, 0));
    map.addObstacle(Position.create(2, 0));
    const stored = map.snapshot();
    const before = structuredClone(stored);
    const harness = createHarness({
      found: { snapshot: stored, version: 2 },
      saveResult: { status: 'saved', version: 3 },
    });

    const result = await harness.useCase.execute({
      mapId: 'map-1',
      expectedVersion: 2,
      operation: { type: 'moveStation', stationId: 'station-1', position: { x: 3, y: 4 } },
    });

    const saved = harness.saved?.map.snapshot();
    expect(saved?.stations).toEqual([
      { id: 'station-1', name: 'Приёмка', type: StationType.Receiving, x: 3, y: 4 },
    ]);
    expect(saved?.robots).toEqual(stored.robots);
    expect(saved?.obstacles).toEqual(stored.obstacles);
    expect(result).toMatchObject({ version: 3, changed: true });
    expect(result).not.toHaveProperty('createdId');
    expect(harness.calls).not.toContain('nextId');
    expect(stored).toEqual(before);
  });

  it('does not save a move onto the station cell', async () => {
    const harness = createHarness({ found: { snapshot: mapWithStation(), version: 2 } });

    const result = await harness.useCase.execute({
      mapId: 'map-1',
      expectedVersion: 2,
      operation: { type: 'moveStation', stationId: 'station-1', position: { x: 1, y: 0 } },
    });

    expect(result).toMatchObject({ mapId: 'map-1', changed: false, version: 2 });
    expect(result).not.toHaveProperty('createdId');
    expect(harness.calls).not.toContain('save');
    expect(harness.calls).not.toContain('nextId');
  });

  it('does not save a move of a missing station', async () => {
    const harness = createHarness();

    await expect(
      harness.useCase.execute({
        mapId: 'map-1',
        expectedVersion: 0,
        operation: { type: 'moveStation', stationId: 'missing', position: { x: 1, y: 1 } },
      }),
    ).rejects.toBeInstanceOf(MapObjectNotFoundError);
    expect(harness.calls).not.toContain('save');
    expect(harness.calls).not.toContain('nextId');
  });

  it.each([
    { position: { x: 1.5, y: 0 }, error: InvalidPositionError },
    { position: { x: 20, y: 0 }, error: PositionOutOfBoundsError },
    { position: { x: 0, y: 0 }, error: CellOccupiedError },
  ])('does not save a rejected move to ($position.x, $position.y)', async ({ position, error }) => {
    const map = WarehouseMap.create('map-1', 'wh-1');
    map.placeStation('station-1', 'Приёмка', StationType.Receiving, Position.create(1, 0));
    map.placeRobot('robot-1', 'loader', Position.create(0, 0));
    const harness = createHarness({ found: { snapshot: map.snapshot(), version: 0 } });

    await expect(
      harness.useCase.execute({
        mapId: 'map-1',
        expectedVersion: 0,
        operation: { type: 'moveStation', stationId: 'station-1', position },
      }),
    ).rejects.toBeInstanceOf(error);
    expect(harness.calls).not.toContain('save');
  });

  it('rejects a stale version before a no-op move', async () => {
    const harness = createHarness({ found: { snapshot: mapWithStation(), version: 4 } });

    await expect(
      harness.useCase.execute({
        mapId: 'map-1',
        expectedVersion: 1,
        operation: { type: 'moveStation', stationId: 'station-1', position: { x: 1, y: 0 } },
      }),
    ).rejects.toMatchObject({
      name: 'MapVersionConflictError',
      details: { mapId: 'map-1', expectedVersion: 1, actualVersion: 4 },
    });
    expect(harness.calls).not.toContain('save');
    expect(harness.calls).not.toContain('nextId');
  });
});

describe('EditWarehouseMap removeStation', () => {
  it('removes a station and keeps the other map objects', async () => {
    const map = WarehouseMap.create('map-1', 'wh-1');
    map.placeStation('station-1', 'Приёмка', StationType.Receiving, Position.create(1, 0));
    map.placeRobot('robot-1', 'loader', Position.create(0, 0));
    map.addObstacle(Position.create(2, 0));
    const stored = map.snapshot();
    const before = structuredClone(stored);
    const harness = createHarness({
      found: { snapshot: stored, version: 2 },
      saveResult: { status: 'saved', version: 3 },
    });

    const result = await harness.useCase.execute({
      mapId: 'map-1',
      expectedVersion: 2,
      operation: { type: 'removeStation', stationId: 'station-1' },
    });

    const saved = harness.saved?.map.snapshot();
    expect(saved?.stations).toEqual([]);
    expect(saved?.robots).toEqual(stored.robots);
    expect(saved?.obstacles).toEqual(stored.obstacles);
    expect(result).toMatchObject({ changed: true, version: 3 });
    expect(result).not.toHaveProperty('createdId');
    expect(harness.calls).not.toContain('nextId');
    expect(stored).toEqual(before);
  });

  it('frees the cell and the station name for a later placement', async () => {
    const removed = createHarness({
      found: { snapshot: mapWithStation('station-1', 1, 0, 'Приёмка'), version: 0 },
      saveResult: { status: 'saved', version: 1 },
    });
    await removed.useCase.execute({
      mapId: 'map-1',
      expectedVersion: 0,
      operation: { type: 'removeStation', stationId: 'station-1' },
    });

    const placed = createHarness({
      found: { snapshot: removed.saved?.map.snapshot() ?? emptySnapshot(), version: 1 },
      saveResult: { status: 'saved', version: 2 },
      nextId: 'station-2',
    });
    const result = await placed.useCase.execute({
      mapId: 'map-1',
      expectedVersion: 1,
      operation: {
        type: 'placeStation',
        name: ' приёмка ',
        stationType: StationType.Issuing,
        position: { x: 1, y: 0 },
      },
    });

    expect(placed.saved?.map.snapshot().stations).toEqual([
      { id: 'station-2', name: 'приёмка', type: StationType.Issuing, x: 1, y: 0 },
    ]);
    expect(result.createdId).toBe('station-2');
  });

  it('does not save removal of a missing station', async () => {
    const harness = createHarness();

    await expect(
      harness.useCase.execute({
        mapId: 'map-1',
        expectedVersion: 0,
        operation: { type: 'removeStation', stationId: 'missing' },
      }),
    ).rejects.toBeInstanceOf(MapObjectNotFoundError);
    expect(harness.calls).not.toContain('save');
    expect(harness.calls).not.toContain('nextId');
  });
});

describe('EditWarehouseMap station save outcomes', () => {
  it.each(['placeStation', 'moveStation', 'removeStation'] as const)(
    'maps save conflict and not_found for %s',
    async (type) => {
      const operation =
        type === 'placeStation'
          ? {
              type,
              name: 'Dock',
              stationType: StationType.Receiving,
              position: { x: 3, y: 4 },
            }
          : type === 'moveStation'
            ? { type, stationId: 'station-1', position: { x: 2, y: 2 } }
            : { type, stationId: 'station-1' };
      const found = {
        snapshot: type === 'placeStation' ? emptySnapshot() : mapWithStation(),
        version: 0,
      };
      const conflict = createHarness({
        found,
        saveResult: { status: 'conflict', actualVersion: 8 },
        nextId: 'station-9',
      });
      await expect(
        conflict.useCase.execute({ mapId: 'map-1', expectedVersion: 0, operation }),
      ).rejects.toMatchObject({
        details: { mapId: 'map-1', expectedVersion: 0, actualVersion: 8 },
      });

      const missing = createHarness({
        found,
        saveResult: { status: 'not_found' },
        nextId: 'station-9',
      });
      await expect(
        missing.useCase.execute({ mapId: 'map-1', expectedVersion: 0, operation }),
      ).rejects.toBeInstanceOf(WarehouseMapNotFoundError);
    },
  );

  it('does not settle before unit of work execute settles for placeStation', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const harness = createHarness({ afterCallback: () => gate, nextId: 'station-9' });
    let settled = false;
    const pending = harness.useCase
      .execute({
        mapId: 'map-1',
        expectedVersion: 0,
        operation: {
          type: 'placeStation',
          name: 'Dock',
          stationType: StationType.Receiving,
          position: { x: 1, y: 1 },
        },
      })
      .finally(() => {
        settled = true;
      });

    await Promise.resolve();
    expect(settled).toBe(false);
    release?.();
    await pending;
    expect(settled).toBe(true);
  });
});
