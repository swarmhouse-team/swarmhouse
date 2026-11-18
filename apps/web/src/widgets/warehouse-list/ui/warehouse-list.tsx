'use client';

import {
  NewWarehouseCard,
  WarehouseCard,
  WarehouseCardMenu,
  type MockWarehouse,
} from '@/entities/warehouse';
import { Input, cn } from '@robots/ui';
import { useMemo, useState } from 'react';

import { filterWarehouses, type WarehouseFilter } from '../model/filter-warehouses';

type WarehouseListProps = {
  warehouses: readonly MockWarehouse[];
  onCreate: () => void;
  onSettings: (warehouse: MockWarehouse) => void;
  onDelete: (warehouse: MockWarehouse) => void;
};

const filters = [
  {
    value: 'all',
    label: 'Все',
  },
  {
    value: 'mine',
    label: 'Мои',
  },
  {
    value: 'available',
    label: 'Доступные мне',
  },
] satisfies Array<{
  value: WarehouseFilter;
  label: string;
}>;

export function WarehouseList({ warehouses, onCreate, onSettings, onDelete }: WarehouseListProps) {
  const [activeFilter, setActiveFilter] = useState<WarehouseFilter>('all');
  const [search, setSearch] = useState('');

  const counts = useMemo(
    () => ({
      all: warehouses.length,
      mine: warehouses.filter((warehouse) => warehouse.role === 'owner').length,
      available: warehouses.filter((warehouse) => warehouse.role === 'observer').length,
    }),
    [warehouses],
  );

  const filteredWarehouses = useMemo(
    () => filterWarehouses(warehouses, activeFilter, search),
    [warehouses, activeFilter, search],
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="tablist"
          aria-label="Фильтр складов"
          className="flex flex-wrap gap-1 rounded-lg bg-muted p-1"
        >
          {filters.map((filter) => {
            const isActive = activeFilter === filter.value;

            return (
              <button
                key={filter.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveFilter(filter.value)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  isActive
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {filter.label}

                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-xs',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground',
                  )}
                >
                  {counts[filter.value]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="w-full lg:max-w-xs">
          <label htmlFor="warehouse-search" className="sr-only">
            Поиск по названию склада
          </label>

          <Input
            id="warehouse-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по названию"
          />
        </div>
      </div>

      {warehouses.length === 0 ? (
        <div className="space-y-6 rounded-xl border border-dashed p-8 text-center">
          <div>
            <h2 className="font-semibold">Складов пока нет</h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Создайте первый склад, чтобы начать работу.
            </p>
          </div>

          <NewWarehouseCard onClick={onCreate} className="mx-auto max-w-sm" />
        </div>
      ) : filteredWarehouses.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <h2 className="font-semibold">Ничего не найдено</h2>

          <p className="mt-2 text-sm text-muted-foreground">
            Попробуйте изменить поисковый запрос или выбрать другой фильтр.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredWarehouses.map((warehouse) => (
            <WarehouseCard
              key={warehouse.warehouseId}
              warehouse={warehouse}
              actions={
                <WarehouseCardMenu
                  warehouseName={warehouse.name}
                  onSettings={() => onSettings(warehouse)}
                  onDelete={() => onDelete(warehouse)}
                />
              }
            />
          ))}

          <NewWarehouseCard onClick={onCreate} />
        </div>
      )}
    </section>
  );
}
