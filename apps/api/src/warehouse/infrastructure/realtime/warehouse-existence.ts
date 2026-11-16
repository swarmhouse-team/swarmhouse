/** Existence check for a socket subscription. The gateway must not read the warehouse cache. */
export interface WarehouseExistenceReader {
  findById(warehouseId: string): Promise<{ id: string } | null>;
}

export const WAREHOUSE_EXISTENCE = Symbol('WAREHOUSE_EXISTENCE');
