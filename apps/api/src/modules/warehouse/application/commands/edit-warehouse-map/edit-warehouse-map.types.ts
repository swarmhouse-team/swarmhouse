import type { WarehouseMapSnapshot } from '../../../domain/entities/warehouse-map';
import type { StationType } from '../../../domain/enums/station-type';

export type MapOperation =
  | {
      type: 'addObstacle';
      position: { x: number; y: number };
    }
  | {
      type: 'moveObstacle';
      from: { x: number; y: number };
      to: { x: number; y: number };
    }
  | {
      type: 'removeObstacle';
      position: { x: number; y: number };
    }
  | {
      type: 'placeRobot';
      name: string;
      position: { x: number; y: number };
    }
  | {
      type: 'moveRobot';
      robotId: string;
      position: { x: number; y: number };
    }
  | {
      type: 'removeRobot';
      robotId: string;
    }
  | {
      type: 'placeStation';
      name: string;
      stationType: StationType;
      position: { x: number; y: number };
    }
  | {
      type: 'moveStation';
      stationId: string;
      position: { x: number; y: number };
    }
  | {
      type: 'removeStation';
      stationId: string;
    };

export interface EditWarehouseMapInput {
  mapId: string;
  expectedVersion: number;
  operation: MapOperation;
}

export interface EditWarehouseMapResult {
  mapId: string;
  version: number;
  changed: boolean;
  snapshot: WarehouseMapSnapshot;
  createdId?: string;
}
