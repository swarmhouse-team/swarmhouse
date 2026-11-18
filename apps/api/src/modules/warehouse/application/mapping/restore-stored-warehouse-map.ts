import { DomainError } from '../../../../common/domain/domain.error';
import { WarehouseMap, type WarehouseMapSnapshot } from '../../domain/entities/warehouse-map';
import { InvalidGridSizeError, InvalidNameError } from '../../domain/errors/value.errors';
import { CorruptedMapStateError } from '../errors/application.errors';

/** Turns a failed `WarehouseMap.restore` into the stored-map application error. */
export function restoreStoredWarehouseMap(input: WarehouseMapSnapshot): WarehouseMap {
  try {
    return WarehouseMap.restore(input);
  } catch (error) {
    if (error instanceof InvalidGridSizeError) {
      throw new CorruptedMapStateError(input.id, 'GRID_SIZE_MISMATCH');
    }
    if (error instanceof InvalidNameError && error.value !== error.value.trim()) {
      throw new CorruptedMapStateError(input.id, 'DENORMALIZED_NAME');
    }
    if (error instanceof DomainError) {
      throw new CorruptedMapStateError(input.id, 'DOMAIN_INVARIANT', error);
    }
    throw error;
  }
}
