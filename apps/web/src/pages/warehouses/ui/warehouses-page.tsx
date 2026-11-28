'use client';

import { warehouseMocks, type MockWarehouse, type WarehouseMember } from '@/entities/warehouse';
import { CreateWarehouseDialog } from '@/features/warehouse-create';
import { DeleteWarehouseDialog } from '@/features/warehouse-delete';
import { WarehouseSettingsDialog } from '@/features/warehouse-settings';
import { SiteHeader } from '@/widgets/site-header';
import { WarehouseList, type WarehouseFilter } from '@/widgets/warehouse-list';
import { Button, Heading, Text } from '@robots/ui';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';

export function WarehousesPage() {
  const t = useTranslations('warehouses.page');
  const filter = useSearchParams()?.get('filter');
  const activeFilter = filter === 'mine' || filter === 'available' ? filter : 'all';
  const [warehouses, setWarehouses] = useState<MockWarehouse[]>([...warehouseMocks]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<MockWarehouse | null>(null);
  const [warehouseToDelete, setWarehouseToDelete] = useState<MockWarehouse | null>(null);

  const handleFilterChange = useCallback((nextFilter: WarehouseFilter) => {
    const url = new URL(window.location.href);
    if (nextFilter === 'all') {
      url.searchParams.delete('filter');
    } else {
      url.searchParams.set('filter', nextFilter);
    }

    window.history.replaceState(null, '', url);
  }, []);

  const handleWarehouseCreate = useCallback((name: string) => {
    const createdAt = new Date().toISOString();

    const warehouse: MockWarehouse = {
      warehouseId: crypto.randomUUID(),
      name,
      createdAt,
      updatedAt: createdAt,
      role: 'owner',
      mapSize: {
        width: 20,
        height: 20,
      },
      robotsCount: 0,
      stationsCount: 0,
      simulationStatus: 'not_started',
      members: [
        {
          id: 'current-user',
          name: 'Игорь Смирнов',
          email: 'igor@example.com',
          role: 'owner',
          status: 'active',
          isCurrentUser: true,
        },
      ],
    };

    setWarehouses((currentWarehouses) => [...currentWarehouses, warehouse]);
  }, []);

  const handleWarehouseSave = useCallback((warehouseId: string, name: string) => {
    setWarehouses((currentWarehouses) =>
      currentWarehouses.map((warehouse) =>
        warehouse.warehouseId === warehouseId
          ? {
              ...warehouse,
              name,
              updatedAt: new Date().toISOString(),
            }
          : warehouse,
      ),
    );

    setSelectedWarehouse(null);
  }, []);

  const handleMembersChange = useCallback(
    (warehouseId: string, members: readonly WarehouseMember[]) => {
      setWarehouses((currentWarehouses) =>
        currentWarehouses.map((warehouse) =>
          warehouse.warehouseId === warehouseId ? { ...warehouse, members } : warehouse,
        ),
      );

      setSelectedWarehouse((currentWarehouse) =>
        currentWarehouse?.warehouseId === warehouseId
          ? { ...currentWarehouse, members }
          : currentWarehouse,
      );
    },
    [],
  );

  const handleWarehouseDeleteConfirm = useCallback((warehouseId: string) => {
    setWarehouses((currentWarehouses) =>
      currentWarehouses.filter((warehouse) => warehouse.warehouseId !== warehouseId),
    );

    setWarehouseToDelete(null);
  }, []);

  const handleCreateDialogOpen = useCallback(() => setIsCreateDialogOpen(true), []);

  const handleWarehouseSettings = useCallback(
    (warehouse: MockWarehouse) => setSelectedWarehouse(warehouse),
    [],
  );

  const handleWarehouseDelete = useCallback(
    (warehouse: MockWarehouse) => setWarehouseToDelete(warehouse),
    [],
  );

  const handleSettingsDialogOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedWarehouse(null);
    }
  }, []);

  const handleDeleteDialogOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setWarehouseToDelete(null);
    }
  }, []);

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main>
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Heading level={1}>{t('title')}</Heading>

              <Text variant="muted" className="mt-2">
                {t('subtitle')}
              </Text>
            </div>

            <Button type="button" size="lg" onClick={handleCreateDialogOpen} className="shrink-0">
              {t('create')}
            </Button>
          </div>

          <WarehouseList
            warehouses={warehouses}
            activeFilter={activeFilter}
            onFilterChange={handleFilterChange}
            onCreate={handleCreateDialogOpen}
            onSettings={handleWarehouseSettings}
            onDelete={handleWarehouseDelete}
          />
        </div>

        <CreateWarehouseDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onCreate={handleWarehouseCreate}
        />

        <WarehouseSettingsDialog
          key={selectedWarehouse?.warehouseId ?? 'warehouse-settings-closed'}
          warehouse={selectedWarehouse}
          open={selectedWarehouse !== null}
          onMembersChange={handleMembersChange}
          onOpenChange={handleSettingsDialogOpenChange}
          onSave={handleWarehouseSave}
        />

        <DeleteWarehouseDialog
          warehouse={warehouseToDelete}
          open={warehouseToDelete !== null}
          onOpenChange={handleDeleteDialogOpenChange}
          onConfirm={handleWarehouseDeleteConfirm}
        />
      </main>
    </div>
  );
}
