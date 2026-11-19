'use client';

import {
  NewWarehouseCard,
  WarehouseCard,
  WarehouseCardMenu,
  type MockWarehouse,
} from '@/entities/warehouse';
import { Button, Heading, Input, Label, Text, cn } from '@robots/ui';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { filterWarehouses, type WarehouseFilter } from '../model/filter-warehouses';

type WarehouseListProps = {
  warehouses: readonly MockWarehouse[];
  onCreate: () => void;
  onSettings: (warehouse: MockWarehouse) => void;
  onDelete: (warehouse: MockWarehouse) => void;
};

const filters = ['all', 'mine', 'available'] satisfies WarehouseFilter[];

export function WarehouseList({ warehouses, onCreate, onSettings, onDelete }: WarehouseListProps) {
  const t = useTranslations('warehouses.list');
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
          aria-label={t('filterLabel')}
          className="flex flex-wrap gap-1 rounded-lg bg-muted p-1"
        >
          {filters.map((filter) => {
            const isActive = activeFilter === filter;

            return (
              <Button
                key={filter}
                type="button"
                variant="ghost"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveFilter(filter)}
                className={cn(
                  'gap-2 px-3',
                  isActive
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(`filters.${filter}`)}

                <Text
                  as="span"
                  size="xs"
                  className={cn(
                    'rounded-full px-1.5 py-0.5',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground',
                  )}
                >
                  {counts[filter]}
                </Text>
              </Button>
            );
          })}
        </div>

        <div className="w-full lg:max-w-xs">
          <Label htmlFor="warehouse-search" className="sr-only">
            {t('searchLabel')}
          </Label>

          <Input
            id="warehouse-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('searchPlaceholder')}
          />
        </div>
      </div>

      {warehouses.length === 0 ? (
        <div className="space-y-6 rounded-xl border border-dashed p-8 text-center">
          <div>
            <Heading level={2} size="sm" className="text-base">
              {t('empty.title')}
            </Heading>

            <Text variant="muted" size="sm" className="mt-2">
              {t('empty.description')}
            </Text>
          </div>

          <NewWarehouseCard onClick={onCreate} className="mx-auto max-w-sm" />
        </div>
      ) : filteredWarehouses.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Heading level={2} size="sm" className="text-base">
            {t('noResults.title')}
          </Heading>

          <Text variant="muted" size="sm" className="mt-2">
            {t('noResults.description')}
          </Text>
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
