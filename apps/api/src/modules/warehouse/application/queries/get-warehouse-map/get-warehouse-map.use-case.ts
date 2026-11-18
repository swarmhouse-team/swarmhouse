import { WarehouseMapNotFoundError } from '../../errors/application.errors';
import { restoreStoredWarehouseMap } from '../../mapping/restore-stored-warehouse-map';
import type { WarehouseMapRepository } from '../../ports/repositories/warehouse-map.repository';
import type { GetWarehouseMapInput, GetWarehouseMapResult } from './get-warehouse-map.types';

/** Reads one stored map. It does not write, bump the version, or repair data. */
export class GetWarehouseMap {
  constructor(private readonly maps: WarehouseMapRepository) {}

  async execute(input: GetWarehouseMapInput): Promise<GetWarehouseMapResult> {
    const record =
      'mapId' in input
        ? await this.maps.findById(input.mapId)
        : await this.maps.findByWarehouseId(input.warehouseId);
    if (!record) {
      throw new WarehouseMapNotFoundError(
        'mapId' in input ? { mapId: input.mapId } : { warehouseId: input.warehouseId },
      );
    }

    return {
      snapshot: restoreStoredWarehouseMap(record.snapshot).snapshot(),
      version: record.version,
    };
  }
}
