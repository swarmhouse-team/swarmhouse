import type { WarehouseMapBody } from '../contracts';

/**
 * Моковая карта 20×20 для UI и Storybook. Соответствует `warehouseMapBodySchema`:
 * координаты целые и внутри сетки, клетки не повторяются, имена без пробелов по краям.
 */
export const validWarehouseMap: WarehouseMapBody = {
  mapId: '01933c2a-7b3e-7a1b-8c4d-1a2b3c4d5e6f',
  warehouseId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  version: 3,
  width: 20,
  height: 20,
  obstacles: [
    { x: 8, y: 5 },
    { x: 8, y: 6 },
    { x: 8, y: 7 },
    { x: 12, y: 3 },
    { x: 12, y: 4 },
    { x: 14, y: 14 },
  ],
  robots: [
    { id: 'c232ab00-9414-41ec-b3c8-9f4e5d6c7b8a', name: 'R1', x: 3, y: 12 },
    { id: 'c232ab00-9414-41ec-b3c8-9f4e5d6c7b8b', name: 'R2', x: 16, y: 9 },
  ],
  stations: [
    { id: 'c232ab00-9414-41ec-b3c8-9f4e5d6c7c01', name: 'Receiving', x: 1, y: 1 },
    { id: 'c232ab00-9414-41ec-b3c8-9f4e5d6c7c02', name: 'Shipping', x: 18, y: 18 },
  ],
};
