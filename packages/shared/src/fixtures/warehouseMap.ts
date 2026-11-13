import type { WarehouseMap } from '../contracts/map';

/** Карта, которая проходит `warehouseMapSchema`: две станции, препятствие и робот на разных клетках. */
export const validWarehouseMap = {
  warehouseId: 'wh-1',
  width: 5,
  height: 5,
  version: 1,
  obstacles: [{ id: 'ob-1', position: { x: 2, y: 2 } }],
  stations: [
    { id: 'st-reception', name: 'Приемка', position: { x: 0, y: 0 } },
    { id: 'st-shipping', name: 'Выдача', position: { x: 4, y: 0 } },
  ],
  robots: [{ id: 'rb-1', name: 'Робот 1', position: { x: 1, y: 1 } }],
} satisfies WarehouseMap;
