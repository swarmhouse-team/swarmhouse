import { describe, expect, it } from 'vitest';

import { WarehouseMap, type WarehouseMapSnapshot } from '../../../domain/entities/warehouse-map';
import {
  CellOccupiedError,
  DuplicateObjectIdError,
  DuplicateRobotNameError,
  DuplicateStationNameError,
  MapObjectNotFoundError,
  PositionOutOfBoundsError,
} from '../../../domain/errors/map.errors';
import { InvalidNameError, InvalidPositionError } from '../../../domain/errors/value.errors';
import { Position } from '../../../../../common/domain/position';
import {
  CorruptedMapStateError,
  MapVersionConflictError,
  WarehouseMapNotFoundError,
} from '../../errors/application.errors';
import type { SaveMapResult } from '../../ports/repositories/warehouse-map.repository';
import type { IdGenerator } from '../../ports/system/id-generator';
import type { TransactionContext, UnitOfWork } from '../../ports/system/unit-of-work';
import { createRecordingLogger, type LogEntry } from '../../testing/create-recording-logger';
import {
  createRecordingNotifier,
  type WarehouseNotice,
} from '../../testing/create-recording-notifier';
import type { WarehouseMap as SavedMap } from '../../../domain/entities/warehouse-map';
import { EditWarehouseMap } from './edit-warehouse-map.use-case';
import type { EditWarehouseMapInput } from './edit-warehouse-map.types';

const WAREHOUSE_ID = '11111111-1111-4111-8111-11111111111a';
const MAP_ID = '22222222-2222-7111-8111-22222222222b';
const ROBOT_ID = '33333333-3333-4111-8111-33333333333c';
const STATION_ID = '44444444-4444-4111-8111-44444444444e';
const STATION_2_ID = '44444444-4444-4111-a111-444444444445';
const STATION_9_ID = '44444444-4444-7111-8111-44444444444a';
const ABSENT_ID = '88888888-8888-4111-8111-88888888888d';

interface Harness {
  useCase: EditWarehouseMap;
  calls: string[];
  logs: LogEntry[];
  notices: WarehouseNotice[];
  saved?: { map: SavedMap; expectedVersion: number };
  failNotifier: (error: Error) => void;
}

function emptySnapshot(): WarehouseMapSnapshot {
  return WarehouseMap.create(MAP_ID, WAREHOUSE_ID).snapshot();
}

function createHarness(options?: {
  found?: { snapshot: WarehouseMapSnapshot; version: number } | null;
  saveResult?: SaveMapResult;
  findError?: Error;
  nextId?: string;
  afterCallback?: () => Promise<void>;
}): Harness {
  const calls: string[] = [];
  const { logger, logs } = createRecordingLogger();
  const { notifier, notices, failWith } = createRecordingNotifier();
  const state: Harness = {
    useCase: undefined as unknown as EditWarehouseMap,
    calls,
    logs,
    notices,
    failNotifier: failWith,
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
          async list() {
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
      return options?.nextId ?? ROBOT_ID;
    },
  };
  state.useCase = new EditWarehouseMap(unitOfWork, ids, logger, notifier);
  return state;
}

function addObstacle(expectedVersion = 0): EditWarehouseMapInput & {
  operation: Extract<EditWarehouseMapInput['operation'], { type: 'addObstacle' }>;
} {
  return {
    mapId: MAP_ID,
    expectedVersion,
    operation: { type: 'addObstacle', position: { x: 4, y: 5 } },
  };
}

function mapWithObstacle(x: number, y: number): WarehouseMapSnapshot {
  const map = WarehouseMap.create(MAP_ID, WAREHOUSE_ID);
  map.addObstacle(Position.create(x, y));
  return map.snapshot();
}

function mapWithRobot(id = ROBOT_ID, x = 1, y = 1): WarehouseMapSnapshot {
  const map = WarehouseMap.create(MAP_ID, WAREHOUSE_ID);
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

    expect(harness.calls).toEqual(['execute', `findById:${MAP_ID}`, 'save']);
    expect(harness.saved?.expectedVersion).toBe(2);
    expect(harness.saved?.map.snapshot().obstacles).toEqual([{ x: 4, y: 5 }]);
    expect(result).toEqual({
      mapId: MAP_ID,
      version: 3,
      changed: true,
      snapshot: harness.saved?.map.snapshot(),
    });
    expect(stored).toEqual(before);
    expect(harness.logs).toEqual([
      {
        level: 'info',
        event: 'warehouse.map.updated',
        context: { mapId: MAP_ID, operationType: 'addObstacle', version: 3 },
      },
    ]);
    expect(harness.notices).toEqual([
      {
        type: 'mapChanged',
        notice: {
          warehouseId: WAREHOUSE_ID,
          mapId: MAP_ID,
          version: 3,
          operation: { type: 'addObstacle', position: { x: 4, y: 5 } },
        },
      },
    ]);
  });

  it('does not save when the map is missing', async () => {
    const harness = createHarness({ found: null });

    await expect(harness.useCase.execute(addObstacle())).rejects.toMatchObject({
      name: 'WarehouseMapNotFoundError',
      details: { mapId: MAP_ID },
    });
    expect(harness.calls).toEqual(['execute', `findById:${MAP_ID}`]);
    expect(harness.logs).toEqual([]);
  });

  it('does not save when the loaded version is stale', async () => {
    const harness = createHarness({ found: { snapshot: emptySnapshot(), version: 4 } });

    await expect(harness.useCase.execute(addObstacle(1))).rejects.toEqual(
      expect.any(MapVersionConflictError),
    );
    await expect(harness.useCase.execute(addObstacle(1))).rejects.toMatchObject({
      details: { mapId: MAP_ID, expectedVersion: 1, actualVersion: 4 },
    });
    expect(harness.calls.filter((call) => call === 'save')).toEqual([]);
    expect(harness.logs).toEqual([]);
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
    const map = WarehouseMap.create(MAP_ID, WAREHOUSE_ID);
    map.addObstacle(Position.create(4, 5));
    const harness = createHarness({ found: { snapshot: map.snapshot(), version: 0 } });

    await expect(harness.useCase.execute(addObstacle())).rejects.toBeInstanceOf(CellOccupiedError);
    expect(harness.calls).not.toContain('save');
  });

  it('maps a save conflict to MapVersionConflictError', async () => {
    const harness = createHarness({ saveResult: { status: 'conflict', actualVersion: 8 } });

    await expect(harness.useCase.execute(addObstacle())).rejects.toMatchObject({
      name: 'MapVersionConflictError',
      details: { mapId: MAP_ID, expectedVersion: 0, actualVersion: 8 },
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
    expect(harness.logs).toEqual([]);
    expect(harness.notices).toEqual([]);
  });

  it('logs warehouse.map.updated only after unit of work execute settles', async () => {
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
    expect(harness.logs).toEqual([]);
    expect(harness.notices).toEqual([]);
    release?.();
    await pending;
    expect(settled).toBe(true);
    expect(harness.logs).toEqual([
      {
        level: 'info',
        event: 'warehouse.map.updated',
        context: { mapId: MAP_ID, operationType: 'addObstacle', version: 1 },
      },
    ]);
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
      mapId: MAP_ID,
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
      mapId: MAP_ID,
      expectedVersion: 2,
      operation: { type: 'moveObstacle', from: { x: 1, y: 1 }, to: { x: 1, y: 1 } },
    });

    expect(result).toMatchObject({ changed: false, version: 2 });
    expect(harness.calls).not.toContain('save');
    expect(harness.logs).toEqual([
      {
        level: 'debug',
        event: 'warehouse.map.noop',
        context: { mapId: MAP_ID, operationType: 'moveObstacle', version: 2 },
      },
    ]);
  });

  it('does not save a move of a missing obstacle, including the same cell', async () => {
    const harness = createHarness();

    await expect(
      harness.useCase.execute({
        mapId: MAP_ID,
        expectedVersion: 0,
        operation: { type: 'moveObstacle', from: { x: 1, y: 1 }, to: { x: 1, y: 1 } },
      }),
    ).rejects.toBeInstanceOf(MapObjectNotFoundError);
    expect(harness.calls).not.toContain('save');
  });

  it('does not save a move onto an occupied cell or outside the map', async () => {
    const occupied = WarehouseMap.create(MAP_ID, WAREHOUSE_ID);
    occupied.addObstacle(Position.create(1, 1));
    occupied.addObstacle(Position.create(2, 2));
    const occupiedHarness = createHarness({
      found: { snapshot: occupied.snapshot(), version: 0 },
    });
    await expect(
      occupiedHarness.useCase.execute({
        mapId: MAP_ID,
        expectedVersion: 0,
        operation: { type: 'moveObstacle', from: { x: 1, y: 1 }, to: { x: 2, y: 2 } },
      }),
    ).rejects.toBeInstanceOf(CellOccupiedError);

    const outside = createHarness({ found: { snapshot: mapWithObstacle(1, 1), version: 0 } });
    await expect(
      outside.useCase.execute({
        mapId: MAP_ID,
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
        mapId: MAP_ID,
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
        mapId: MAP_ID,
        expectedVersion: 1,
        operation: { type: 'moveObstacle', from: { x: 1, y: 1 }, to: { x: 1, y: 1 } },
      }),
    ).rejects.toMatchObject({
      name: 'MapVersionConflictError',
      details: { mapId: MAP_ID, expectedVersion: 1, actualVersion: 4 },
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
      mapId: MAP_ID,
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
        mapId: MAP_ID,
        expectedVersion: 0,
        operation: { type: 'removeObstacle', position: { x: 1, y: 1 } },
      }),
    ).rejects.toBeInstanceOf(MapObjectNotFoundError);

    const invalid = createHarness({ found: { snapshot: mapWithObstacle(1, 1), version: 0 } });
    await expect(
      invalid.useCase.execute({
        mapId: MAP_ID,
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
        conflict.useCase.execute({ mapId: MAP_ID, expectedVersion: 0, operation }),
      ).rejects.toMatchObject({
        details: { mapId: MAP_ID, expectedVersion: 0, actualVersion: 8 },
      });

      const missing = createHarness({ found, saveResult: { status: 'not_found' } });
      await expect(
        missing.useCase.execute({ mapId: MAP_ID, expectedVersion: 0, operation }),
      ).rejects.toBeInstanceOf(WarehouseMapNotFoundError);
    },
  );
});

describe('EditWarehouseMap placeRobot', () => {
  it('places a robot with the generated id and the normalized name', async () => {
    const map = WarehouseMap.create(MAP_ID, WAREHOUSE_ID);
    map.addObstacle(Position.create(0, 0));
    map.placeStation(STATION_ID, 'Dock', Position.create(1, 0));
    const stored = map.snapshot();
    const before = structuredClone(stored);
    const harness = createHarness({
      found: { snapshot: stored, version: 2 },
      saveResult: { status: 'saved', version: 3 },
    });

    const result = await harness.useCase.execute({
      mapId: MAP_ID,
      expectedVersion: 2,
      operation: { type: 'placeRobot', name: '  loader  ', position: { x: 3, y: 4 } },
    });

    const saved = harness.saved?.map.snapshot();
    expect(saved?.robots).toEqual([{ id: ROBOT_ID, name: 'loader', x: 3, y: 4 }]);
    expect(saved?.obstacles).toEqual(stored.obstacles);
    expect(saved?.stations).toEqual(stored.stations);
    expect(harness.calls.filter((call) => call === 'nextId')).toEqual(['nextId']);
    expect(result).toEqual({
      mapId: MAP_ID,
      version: 3,
      changed: true,
      createdId: ROBOT_ID,
      snapshot: saved,
    });
    expect(stored).toEqual(before);
    expect(harness.logs).toEqual([
      {
        level: 'info',
        event: 'warehouse.map.updated',
        context: {
          mapId: MAP_ID,
          operationType: 'placeRobot',
          version: 3,
          createdId: ROBOT_ID,
        },
      },
    ]);
    expect(harness.notices).toEqual([
      {
        type: 'mapChanged',
        notice: {
          warehouseId: WAREHOUSE_ID,
          mapId: MAP_ID,
          version: 3,
          operation: { type: 'placeRobot', name: '  loader  ', position: { x: 3, y: 4 } },
          createdId: ROBOT_ID,
        },
      },
    ]);
  });

  it('does not save a robot whose name matches an existing one ignoring case', async () => {
    const harness = createHarness({
      found: { snapshot: mapWithRobot(), version: 0 },
      nextId: '33333333-3333-4111-a111-333333333334',
    });

    await expect(
      harness.useCase.execute({
        mapId: MAP_ID,
        expectedVersion: 0,
        operation: { type: 'placeRobot', name: ' LOADER ', position: { x: 2, y: 2 } },
      }),
    ).rejects.toBeInstanceOf(DuplicateRobotNameError);
    expect(harness.calls).not.toContain('save');
  });

  it('does not save an empty robot name', async () => {
    const harness = createHarness();

    await expect(
      harness.useCase.execute({
        mapId: MAP_ID,
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
      const map = WarehouseMap.create(MAP_ID, WAREHOUSE_ID);
      map.addObstacle(Position.create(4, 5));
      const harness = createHarness({ found: { snapshot: map.snapshot(), version: 0 } });

      await expect(
        harness.useCase.execute({
          mapId: MAP_ID,
          expectedVersion: 0,
          operation: { type: 'placeRobot', name: 'loader', position },
        }),
      ).rejects.toBeInstanceOf(error);
      expect(harness.calls).not.toContain('save');
    },
  );

  it.each([ROBOT_ID, STATION_ID])(
    'does not generate another id when %s is already taken',
    async (nextId) => {
      const map = WarehouseMap.create(MAP_ID, WAREHOUSE_ID);
      map.placeRobot(ROBOT_ID, 'loader', Position.create(0, 0));
      map.placeStation(STATION_ID, 'Dock', Position.create(1, 0));
      const harness = createHarness({
        found: { snapshot: map.snapshot(), version: 0 },
        nextId,
      });

      await expect(
        harness.useCase.execute({
          mapId: MAP_ID,
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
    const map = WarehouseMap.create(MAP_ID, WAREHOUSE_ID);
    map.placeRobot(ROBOT_ID, 'loader', Position.create(1, 1));
    map.addObstacle(Position.create(0, 0));
    map.placeStation(STATION_ID, 'Dock', Position.create(1, 0));
    const stored = map.snapshot();
    const before = structuredClone(stored);
    const harness = createHarness({
      found: { snapshot: stored, version: 2 },
      saveResult: { status: 'saved', version: 3 },
    });

    const result = await harness.useCase.execute({
      mapId: MAP_ID,
      expectedVersion: 2,
      operation: { type: 'moveRobot', robotId: ROBOT_ID, position: { x: 2, y: 3 } },
    });

    const saved = harness.saved?.map.snapshot();
    expect(saved?.robots).toEqual([{ id: ROBOT_ID, name: 'loader', x: 2, y: 3 }]);
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
      mapId: MAP_ID,
      expectedVersion: 2,
      operation: { type: 'moveRobot', robotId: ROBOT_ID, position: { x: 1, y: 1 } },
    });

    expect(result).toMatchObject({ mapId: MAP_ID, changed: false, version: 2 });
    expect(result).not.toHaveProperty('createdId');
    expect(harness.calls).not.toContain('save');
    expect(harness.calls).not.toContain('nextId');
  });

  it('finds a restored robot when the uuid case differs', async () => {
    const harness = createHarness({ found: { snapshot: mapWithRobot(), version: 2 } });

    const result = await harness.useCase.execute({
      mapId: MAP_ID,
      expectedVersion: 2,
      operation: {
        type: 'moveRobot',
        robotId: ROBOT_ID.toUpperCase(),
        position: { x: 1, y: 1 },
      },
    });

    expect(result).toMatchObject({ mapId: MAP_ID, changed: false, version: 2 });
    expect(result.snapshot.robots).toEqual([{ id: ROBOT_ID, name: 'loader', x: 1, y: 1 }]);
    expect(harness.calls).not.toContain('save');
  });

  it('does not save a move of a missing robot', async () => {
    const harness = createHarness();

    await expect(
      harness.useCase.execute({
        mapId: MAP_ID,
        expectedVersion: 0,
        operation: { type: 'moveRobot', robotId: ABSENT_ID, position: { x: 1, y: 1 } },
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
    const map = WarehouseMap.create(MAP_ID, WAREHOUSE_ID);
    map.placeRobot(ROBOT_ID, 'loader', Position.create(1, 1));
    map.addObstacle(Position.create(2, 2));
    const harness = createHarness({ found: { snapshot: map.snapshot(), version: 0 } });

    await expect(
      harness.useCase.execute({
        mapId: MAP_ID,
        expectedVersion: 0,
        operation: { type: 'moveRobot', robotId: ROBOT_ID, position },
      }),
    ).rejects.toBeInstanceOf(error);
    expect(harness.calls).not.toContain('save');
  });

  it('rejects a stale version before a no-op move', async () => {
    const harness = createHarness({ found: { snapshot: mapWithRobot(), version: 4 } });

    await expect(
      harness.useCase.execute({
        mapId: MAP_ID,
        expectedVersion: 1,
        operation: { type: 'moveRobot', robotId: ROBOT_ID, position: { x: 1, y: 1 } },
      }),
    ).rejects.toMatchObject({
      name: 'MapVersionConflictError',
      details: { mapId: MAP_ID, expectedVersion: 1, actualVersion: 4 },
    });
    expect(harness.calls).not.toContain('save');
    expect(harness.calls).not.toContain('nextId');
  });
});

describe('EditWarehouseMap removeRobot', () => {
  it('removes a robot and keeps the other map objects', async () => {
    const map = WarehouseMap.create(MAP_ID, WAREHOUSE_ID);
    map.placeRobot(ROBOT_ID, 'loader', Position.create(1, 1));
    map.addObstacle(Position.create(0, 0));
    map.placeStation(STATION_ID, 'Dock', Position.create(1, 0));
    const stored = map.snapshot();
    const before = structuredClone(stored);
    const harness = createHarness({
      found: { snapshot: stored, version: 2 },
      saveResult: { status: 'saved', version: 3 },
    });

    const result = await harness.useCase.execute({
      mapId: MAP_ID,
      expectedVersion: 2,
      operation: { type: 'removeRobot', robotId: ROBOT_ID },
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
        mapId: MAP_ID,
        expectedVersion: 0,
        operation: { type: 'removeRobot', robotId: ABSENT_ID },
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
            ? { type, robotId: ROBOT_ID, position: { x: 2, y: 2 } }
            : { type, robotId: ROBOT_ID };
      const found = {
        snapshot: type === 'placeRobot' ? emptySnapshot() : mapWithRobot(),
        version: 0,
      };
      const conflict = createHarness({
        found,
        saveResult: { status: 'conflict', actualVersion: 8 },
      });
      await expect(
        conflict.useCase.execute({ mapId: MAP_ID, expectedVersion: 0, operation }),
      ).rejects.toMatchObject({
        details: { mapId: MAP_ID, expectedVersion: 0, actualVersion: 8 },
      });

      const missing = createHarness({ found, saveResult: { status: 'not_found' } });
      await expect(
        missing.useCase.execute({ mapId: MAP_ID, expectedVersion: 0, operation }),
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
        mapId: MAP_ID,
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
          mapId: MAP_ID,
          expectedVersion,
          operation: { type: 'placeRobot', name: 'loader', position: { x: 1, y: 1 } },
        }),
      ).rejects.toBeInstanceOf(Error);
      expect(harness.calls).not.toContain('nextId');
      expect(harness.calls).not.toContain('save');
    },
  );
});

function mapWithStation(id = STATION_ID, x = 1, y = 0, name = 'Приёмка'): WarehouseMapSnapshot {
  const map = WarehouseMap.create(MAP_ID, WAREHOUSE_ID);
  map.placeStation(id, name, Position.create(x, y));
  return map.snapshot();
}

function occupiedMap(kind: 'obstacle' | 'robot' | 'station'): WarehouseMap {
  const map = WarehouseMap.create(MAP_ID, WAREHOUSE_ID);
  const position = Position.create(4, 5);
  if (kind === 'obstacle') {
    map.addObstacle(position);
  }
  if (kind === 'robot') {
    map.placeRobot(ROBOT_ID, 'loader', position);
  }
  if (kind === 'station') {
    map.placeStation(STATION_ID, 'Other', position);
  }
  return map;
}

describe('EditWarehouseMap placeStation', () => {
  it('places a station with the generated id and a normalized name', async () => {
    const map = WarehouseMap.create(MAP_ID, WAREHOUSE_ID);
    map.placeRobot(ROBOT_ID, 'loader', Position.create(0, 0));
    map.addObstacle(Position.create(1, 1));
    const stored = map.snapshot();
    const before = structuredClone(stored);
    const harness = createHarness({
      found: { snapshot: stored, version: 2 },
      saveResult: { status: 'saved', version: 3 },
      nextId: STATION_9_ID,
    });

    const result = await harness.useCase.execute({
      mapId: MAP_ID,
      expectedVersion: 2,
      operation: {
        type: 'placeStation',
        name: '  Приёмка  ',
        position: { x: 3, y: 4 },
      },
    });

    const saved = harness.saved?.map.snapshot();
    expect(saved?.stations).toEqual([{ id: STATION_9_ID, name: 'Приёмка', x: 3, y: 4 }]);
    expect(saved?.robots).toEqual(stored.robots);
    expect(saved?.obstacles).toEqual(stored.obstacles);
    expect(result).toEqual({
      mapId: MAP_ID,
      version: 3,
      changed: true,
      createdId: STATION_9_ID,
      snapshot: saved,
    });
    expect(stored).toEqual(before);
  });

  it('does not save a station whose name matches an existing one ignoring case', async () => {
    const harness = createHarness({
      found: { snapshot: mapWithStation(STATION_ID, 1, 0, 'Приёмка'), version: 0 },
      nextId: STATION_2_ID,
    });

    await expect(
      harness.useCase.execute({
        mapId: MAP_ID,
        expectedVersion: 0,
        operation: {
          type: 'placeStation',
          name: ' приёмка ',
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
        mapId: MAP_ID,
        expectedVersion: 0,
        operation: {
          type: 'placeStation',
          name: '   ',
          position: { x: 1, y: 1 },
        },
      }),
    ).rejects.toBeInstanceOf(InvalidNameError);
    expect(harness.calls).not.toContain('save');
  });

  it.each([ROBOT_ID, STATION_ID])(
    'does not generate another id when %s is already taken',
    async (nextId) => {
      const map = WarehouseMap.create(MAP_ID, WAREHOUSE_ID);
      map.placeRobot(ROBOT_ID, 'loader', Position.create(0, 0));
      map.placeStation(STATION_ID, 'Dock', Position.create(1, 0));
      const harness = createHarness({ found: { snapshot: map.snapshot(), version: 0 }, nextId });

      await expect(
        harness.useCase.execute({
          mapId: MAP_ID,
          expectedVersion: 0,
          operation: {
            type: 'placeStation',
            name: 'Spare',
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
        nextId: STATION_9_ID,
      });

      await expect(
        harness.useCase.execute({
          mapId: MAP_ID,
          expectedVersion: 0,
          operation: {
            type: 'placeStation',
            name: 'Dock',
            position,
          },
        }),
      ).rejects.toBeInstanceOf(error);
      expect(harness.calls).not.toContain('save');
    },
  );
});

describe('EditWarehouseMap moveStation', () => {
  it('moves a station without changing its id or name', async () => {
    const map = WarehouseMap.create(MAP_ID, WAREHOUSE_ID);
    map.placeStation(STATION_ID, 'Приёмка', Position.create(1, 0));
    map.placeRobot(ROBOT_ID, 'loader', Position.create(0, 0));
    map.addObstacle(Position.create(2, 0));
    const stored = map.snapshot();
    const before = structuredClone(stored);
    const harness = createHarness({
      found: { snapshot: stored, version: 2 },
      saveResult: { status: 'saved', version: 3 },
    });

    const result = await harness.useCase.execute({
      mapId: MAP_ID,
      expectedVersion: 2,
      operation: { type: 'moveStation', stationId: STATION_ID, position: { x: 3, y: 4 } },
    });

    const saved = harness.saved?.map.snapshot();
    expect(saved?.stations).toEqual([
      { id: STATION_ID, name: 'Приёмка', x: 3, y: 4 },
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
      mapId: MAP_ID,
      expectedVersion: 2,
      operation: { type: 'moveStation', stationId: STATION_ID, position: { x: 1, y: 0 } },
    });

    expect(result).toMatchObject({ mapId: MAP_ID, changed: false, version: 2 });
    expect(result).not.toHaveProperty('createdId');
    expect(harness.calls).not.toContain('save');
    expect(harness.calls).not.toContain('nextId');
  });

  it('does not save a move of a missing station', async () => {
    const harness = createHarness();

    await expect(
      harness.useCase.execute({
        mapId: MAP_ID,
        expectedVersion: 0,
        operation: { type: 'moveStation', stationId: ABSENT_ID, position: { x: 1, y: 1 } },
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
    const map = WarehouseMap.create(MAP_ID, WAREHOUSE_ID);
    map.placeStation(STATION_ID, 'Приёмка', Position.create(1, 0));
    map.placeRobot(ROBOT_ID, 'loader', Position.create(0, 0));
    const harness = createHarness({ found: { snapshot: map.snapshot(), version: 0 } });

    await expect(
      harness.useCase.execute({
        mapId: MAP_ID,
        expectedVersion: 0,
        operation: { type: 'moveStation', stationId: STATION_ID, position },
      }),
    ).rejects.toBeInstanceOf(error);
    expect(harness.calls).not.toContain('save');
  });

  it('rejects a stale version before a no-op move', async () => {
    const harness = createHarness({ found: { snapshot: mapWithStation(), version: 4 } });

    await expect(
      harness.useCase.execute({
        mapId: MAP_ID,
        expectedVersion: 1,
        operation: { type: 'moveStation', stationId: STATION_ID, position: { x: 1, y: 0 } },
      }),
    ).rejects.toMatchObject({
      name: 'MapVersionConflictError',
      details: { mapId: MAP_ID, expectedVersion: 1, actualVersion: 4 },
    });
    expect(harness.calls).not.toContain('save');
    expect(harness.calls).not.toContain('nextId');
  });
});

describe('EditWarehouseMap removeStation', () => {
  it('removes a station and keeps the other map objects', async () => {
    const map = WarehouseMap.create(MAP_ID, WAREHOUSE_ID);
    map.placeStation(STATION_ID, 'Приёмка', Position.create(1, 0));
    map.placeRobot(ROBOT_ID, 'loader', Position.create(0, 0));
    map.addObstacle(Position.create(2, 0));
    const stored = map.snapshot();
    const before = structuredClone(stored);
    const harness = createHarness({
      found: { snapshot: stored, version: 2 },
      saveResult: { status: 'saved', version: 3 },
    });

    const result = await harness.useCase.execute({
      mapId: MAP_ID,
      expectedVersion: 2,
      operation: { type: 'removeStation', stationId: STATION_ID },
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
      found: { snapshot: mapWithStation(STATION_ID, 1, 0, 'Приёмка'), version: 0 },
      saveResult: { status: 'saved', version: 1 },
    });
    await removed.useCase.execute({
      mapId: MAP_ID,
      expectedVersion: 0,
      operation: { type: 'removeStation', stationId: STATION_ID },
    });

    const placed = createHarness({
      found: { snapshot: removed.saved?.map.snapshot() ?? emptySnapshot(), version: 1 },
      saveResult: { status: 'saved', version: 2 },
      nextId: STATION_2_ID,
    });
    const result = await placed.useCase.execute({
      mapId: MAP_ID,
      expectedVersion: 1,
      operation: {
        type: 'placeStation',
        name: ' приёмка ',
        position: { x: 1, y: 0 },
      },
    });

    expect(placed.saved?.map.snapshot().stations).toEqual([
      { id: STATION_2_ID, name: 'приёмка', x: 1, y: 0 },
    ]);
    expect(result.createdId).toBe(STATION_2_ID);
  });

  it('does not save removal of a missing station', async () => {
    const harness = createHarness();

    await expect(
      harness.useCase.execute({
        mapId: MAP_ID,
        expectedVersion: 0,
        operation: { type: 'removeStation', stationId: ABSENT_ID },
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
              position: { x: 3, y: 4 },
            }
          : type === 'moveStation'
            ? { type, stationId: STATION_ID, position: { x: 2, y: 2 } }
            : { type, stationId: STATION_ID };
      const found = {
        snapshot: type === 'placeStation' ? emptySnapshot() : mapWithStation(),
        version: 0,
      };
      const conflict = createHarness({
        found,
        saveResult: { status: 'conflict', actualVersion: 8 },
        nextId: STATION_9_ID,
      });
      await expect(
        conflict.useCase.execute({ mapId: MAP_ID, expectedVersion: 0, operation }),
      ).rejects.toMatchObject({
        details: { mapId: MAP_ID, expectedVersion: 0, actualVersion: 8 },
      });

      const missing = createHarness({
        found,
        saveResult: { status: 'not_found' },
        nextId: STATION_9_ID,
      });
      await expect(
        missing.useCase.execute({ mapId: MAP_ID, expectedVersion: 0, operation }),
      ).rejects.toBeInstanceOf(WarehouseMapNotFoundError);
    },
  );

  it('does not settle before unit of work execute settles for placeStation', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const harness = createHarness({ afterCallback: () => gate, nextId: STATION_9_ID });
    let settled = false;
    const pending = harness.useCase
      .execute({
        mapId: MAP_ID,
        expectedVersion: 0,
        operation: {
          type: 'placeStation',
          name: 'Dock',
          position: { x: 1, y: 1 },
        },
      })
      .finally(() => {
        settled = true;
      });

    await Promise.resolve();
    expect(settled).toBe(false);
    expect(harness.notices).toEqual([]);
    release?.();
    await pending;
    expect(settled).toBe(true);
  });
});

describe('EditWarehouseMap realtime', () => {
  it('does not publish a no-op move', async () => {
    const harness = createHarness({
      found: { snapshot: mapWithRobot(), version: 4 },
    });

    const result = await harness.useCase.execute({
      mapId: MAP_ID,
      expectedVersion: 4,
      operation: { type: 'moveRobot', robotId: ROBOT_ID, position: { x: 1, y: 1 } },
    });

    expect(result.changed).toBe(false);
    expect(result.version).toBe(4);
    expect(harness.notices).toEqual([]);
  });

  it('does not publish a version conflict', async () => {
    const harness = createHarness({
      found: { snapshot: emptySnapshot(), version: 2 },
      saveResult: { status: 'conflict', actualVersion: 9 },
    });

    await expect(harness.useCase.execute(addObstacle(2))).rejects.toMatchObject({
      name: 'MapVersionConflictError',
    });
    expect(harness.notices).toEqual([]);
  });

  it('publishes the saved robot id in lowercase without changing the command', async () => {
    const upperRobotId = ROBOT_ID.toUpperCase();
    const operation = {
      type: 'moveRobot' as const,
      robotId: upperRobotId,
      position: { x: 2, y: 2 },
    };
    const harness = createHarness({
      found: { snapshot: mapWithRobot(), version: 4 },
      saveResult: { status: 'saved', version: 5 },
    });

    await harness.useCase.execute({ mapId: MAP_ID, expectedVersion: 4, operation });

    expect(operation.robotId).toBe(upperRobotId);
    expect(harness.notices).toEqual([
      {
        type: 'mapChanged',
        notice: {
          warehouseId: WAREHOUSE_ID,
          mapId: MAP_ID,
          version: 5,
          operation: { type: 'moveRobot', robotId: ROBOT_ID, position: { x: 2, y: 2 } },
        },
      },
    ]);
  });

  it('returns the saved edit when the notifier throws', async () => {
    const harness = createHarness({
      found: { snapshot: emptySnapshot(), version: 0 },
      saveResult: { status: 'saved', version: 1 },
    });
    harness.failNotifier(new Error('socket down'));

    const result = await harness.useCase.execute(addObstacle());

    expect(result.changed).toBe(true);
    expect(result.version).toBe(1);
    expect(harness.notices).toHaveLength(1);
    expect(harness.logs).toContainEqual({
      level: 'error',
      event: 'warehouse.realtime.publish_failed',
      context: { errorClass: 'Error' },
    });
    expect(harness.logs.map((entry) => entry.event)).toContain('warehouse.map.updated');
    expect(JSON.stringify(harness.logs)).not.toContain('socket down');
  });
});
