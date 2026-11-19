'use client';

import { warehouseMocks, type MockWarehouse, type WarehouseMember } from '@/entities/warehouse';
import { CreateWarehouseDialog } from '@/features/warehouse-create';
import { DeleteWarehouseDialog } from '@/features/warehouse-delete';
import { WarehouseSettingsDialog } from '@/features/warehouse-settings';
import { WarehouseList } from '@/widgets/warehouse-list';
import { Button, Heading, Text } from '@robots/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';

export function WarehousesPage() {
  const t = useTranslations('warehouses.page');
  const [warehouses, setWarehouses] = useState<MockWarehouse[]>([...warehouseMocks]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<MockWarehouse | null>(null);
  const [warehouseToDelete, setWarehouseToDelete] = useState<MockWarehouse | null>(null);

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
    <main className="min-h-dvh bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Heading level={1}>{t('title')}</Heading>

            <Text variant="muted" className="mt-2">
              {t('subtitle')}
            </Text>
          </div>

          <Button
            type="button"
            size="lg"
            onClick={handleCreateDialogOpen}
            className="mb-4 shrink-0"
          >
            {t('create')}
          </Button>
        </header>

        <WarehouseList
          warehouses={warehouses}
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
  );
}
