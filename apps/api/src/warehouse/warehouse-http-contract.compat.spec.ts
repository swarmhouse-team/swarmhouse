import { describe, expect, it } from 'vitest';

import type { EditWarehouseMapOperation, WarehouseStationType } from '@robots/shared';

import type { MapOperation } from './application/commands/edit-warehouse-map/edit-warehouse-map.types';
import type { StationType } from './domain/enums/station-type';

type Equal<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;

const stationTypesMatch: Equal<WarehouseStationType, StationType> = true;
const operationsMatch: Equal<EditWarehouseMapOperation, MapOperation> = true;

describe('warehouse HTTP contract', () => {
  it('совпадает со StationType и MapOperation', () => {
    expect(stationTypesMatch).toBe(true);
    expect(operationsMatch).toBe(true);
  });
});
