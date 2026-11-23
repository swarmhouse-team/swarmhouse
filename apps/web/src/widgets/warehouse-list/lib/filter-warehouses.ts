import type { MockWarehouse } from '@/entities/warehouse';

export type WarehouseFilter = 'all' | 'mine' | 'available';

export function filterWarehouses(
  warehouses: readonly MockWarehouse[],
  filter: WarehouseFilter,
  search: string,
): MockWarehouse[] {
  const normalizedSearch = search.trim().toLowerCase();

  return warehouses.filter((warehouse) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'mine' && warehouse.role === 'owner') ||
      (filter === 'available' && warehouse.role === 'observer');

    const matchesSearch =
      normalizedSearch.length === 0 || warehouse.name.toLowerCase().includes(normalizedSearch);

    return matchesFilter && matchesSearch;
  });
}
