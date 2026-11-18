import { describe, expect, it } from 'vitest';

import { warehouseListOrder } from './prisma-warehouse.repository';

describe('PrismaWarehouseRepository', () => {
  it('lists metadata newest first and keeps undated rows last', () => {
    expect(warehouseListOrder).toEqual([
      { createdAt: { sort: 'desc', nulls: 'last' } },
      { id: 'desc' },
    ]);
  });
});
