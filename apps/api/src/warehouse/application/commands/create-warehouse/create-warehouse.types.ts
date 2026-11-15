export interface CreateWarehouseInput {
  name: string;
}

export interface CreateWarehouseResult {
  warehouseId: string;
  name: string;
  mapId: string;
  version: number;
}
