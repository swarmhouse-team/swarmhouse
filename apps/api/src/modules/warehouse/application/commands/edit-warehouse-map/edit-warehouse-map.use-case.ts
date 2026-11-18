import type { EditWarehouseMapOperation } from '@robots/shared';

import type { WarehouseMap } from '../../../domain/entities/warehouse-map';
import { normalizeId } from '../../../domain/vo/id';
import { Position } from '../../../../../common/domain/position';
import { publishAfterCommit } from '../../cache/publish-after-commit';
import {
  MapVersionConflictError,
  WarehouseMapNotFoundError,
} from '../../errors/application.errors';
import { restoreWarehouseMap } from '../../mapping/restore-warehouse-map';
import type { IdGenerator } from '../../ports/system/id-generator';
import type { LoggerPort } from '../../ports/system/logger.port';
import type { UnitOfWork } from '../../ports/system/unit-of-work';
import type { WarehouseNotifier } from '../../ports/system/warehouse-notifier';
import type { EditWarehouseMapInput, EditWarehouseMapResult } from './edit-warehouse-map.types';

interface AppliedEdit {
  changed: boolean;
  createdId?: string;
}

/**
 * Applies one map edit inside a unit of work.
 * A no-op returns the consistent snapshot and version of the state it read.
 * `expectedVersion` is checked against that read. A later concurrent change is allowed.
 * A changing `save` performs its own atomic version check.
 */
export class EditWarehouseMap {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly ids: IdGenerator,
    private readonly logger: LoggerPort,
    private readonly notifier: WarehouseNotifier,
  ) {}

  async execute(input: EditWarehouseMapInput): Promise<EditWarehouseMapResult> {
    const result = await this.unitOfWork.execute(async (tx) => {
      const record = await tx.maps.findById(input.mapId);
      if (!record) {
        throw new WarehouseMapNotFoundError({ mapId: input.mapId });
      }
      if (record.version !== input.expectedVersion) {
        throw new MapVersionConflictError({
          mapId: input.mapId,
          expectedVersion: input.expectedVersion,
          actualVersion: record.version,
        });
      }

      const map = restoreWarehouseMap(record.snapshot);
      const applied = this.apply(map, input.operation);
      if (!applied.changed) {
        return {
          mapId: input.mapId,
          version: record.version,
          changed: false,
          snapshot: map.snapshot(),
        };
      }

      const saved = await tx.maps.save(map, input.expectedVersion);
      if (saved.status === 'conflict') {
        throw new MapVersionConflictError({
          mapId: input.mapId,
          expectedVersion: input.expectedVersion,
          actualVersion: saved.actualVersion,
        });
      }
      if (saved.status === 'not_found') {
        throw new WarehouseMapNotFoundError({ mapId: input.mapId });
      }

      return {
        mapId: input.mapId,
        version: saved.version,
        changed: true,
        snapshot: map.snapshot(),
        ...(applied.createdId === undefined ? {} : { createdId: applied.createdId }),
      };
    });

    if (result.changed) {
      await publishAfterCommit(this.logger, {
        publish: () =>
          this.notifier.mapChanged({
            warehouseId: result.snapshot.warehouseId,
            mapId: result.mapId,
            version: result.version,
            operation: publishedOperation(input.operation),
            ...(result.createdId === undefined ? {} : { createdId: result.createdId }),
          }),
      });
      this.logger.info('warehouse.map.updated', {
        mapId: result.mapId,
        operationType: input.operation.type,
        version: result.version,
        ...(result.createdId === undefined ? {} : { createdId: result.createdId }),
      });
    } else {
      this.logger.debug('warehouse.map.noop', {
        mapId: result.mapId,
        operationType: input.operation.type,
        version: result.version,
      });
    }

    return result;
  }

  private apply(map: WarehouseMap, operation: EditWarehouseMapOperation): AppliedEdit {
    switch (operation.type) {
      case 'addObstacle':
        map.addObstacle(Position.create(operation.position.x, operation.position.y));
        return { changed: true };
      case 'moveObstacle':
        return { changed: this.moveObstacle(map, operation.from, operation.to) };
      case 'removeObstacle':
        map.removeObstacle(Position.create(operation.position.x, operation.position.y));
        return { changed: true };
      case 'placeRobot':
        return this.placeRobot(map, operation.name, operation.position);
      case 'moveRobot':
        return {
          changed: this.moveRobot(map, operation.robotId, operation.position),
        };
      case 'removeRobot':
        map.removeRobot(operation.robotId);
        return { changed: true };
      case 'placeStation':
        return this.placeStation(map, operation);
      case 'moveStation':
        return {
          changed: this.moveStation(map, operation.stationId, operation.position),
        };
      case 'removeStation':
        map.removeStation(operation.stationId);
        return { changed: true };
      default:
        return assertNever(operation);
    }
  }

  private placeRobot(
    map: WarehouseMap,
    name: string,
    point: { x: number; y: number },
  ): AppliedEdit {
    const position = Position.create(point.x, point.y);
    const id = this.ids.next();
    map.placeRobot(id, name, position);
    return { changed: true, createdId: id };
  }

  private placeStation(
    map: WarehouseMap,
    operation: Extract<EditWarehouseMapOperation, { type: 'placeStation' }>,
  ): AppliedEdit {
    const position = Position.create(operation.position.x, operation.position.y);
    const id = this.ids.next();
    map.placeStation(id, operation.name, position);
    return { changed: true, createdId: id };
  }

  private moveStation(
    map: WarehouseMap,
    stationId: string,
    point: { x: number; y: number },
  ): boolean {
    const id = normalizeId(stationId);
    const position = Position.create(point.x, point.y);
    const station = map.getStations().find((item) => item.id === id);
    if (station && station.position.equals(position)) {
      return false;
    }

    map.moveStation(id, position);
    return true;
  }

  private moveRobot(map: WarehouseMap, robotId: string, point: { x: number; y: number }): boolean {
    const id = normalizeId(robotId);
    const position = Position.create(point.x, point.y);
    const robot = map.getRobots().find((item) => item.id === id);
    if (robot && robot.position.equals(position)) {
      return false;
    }

    map.moveRobot(id, position);
    return true;
  }

  private moveObstacle(
    map: WarehouseMap,
    fromPoint: { x: number; y: number },
    toPoint: { x: number; y: number },
  ): boolean {
    const from = Position.create(fromPoint.x, fromPoint.y);
    const to = Position.create(toPoint.x, toPoint.y);
    const exists = map.getObstacles().some((obstacle) => obstacle.equals(from));
    if (exists && from.equals(to)) {
      return false;
    }

    map.moveObstacle(from, to);
    return true;
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected operation: ${JSON.stringify(value)}`);
}

function publishedOperation(operation: EditWarehouseMapOperation): EditWarehouseMapOperation {
  switch (operation.type) {
    case 'moveRobot':
    case 'removeRobot':
      return { ...operation, robotId: normalizeId(operation.robotId) };
    case 'moveStation':
    case 'removeStation':
      return { ...operation, stationId: normalizeId(operation.stationId) };
    default:
      return { ...operation };
  }
}
