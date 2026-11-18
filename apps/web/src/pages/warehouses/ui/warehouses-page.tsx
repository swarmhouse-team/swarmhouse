'use client';

import { warehouseMocks, type MockWarehouse, type WarehouseMember } from '@/entities/warehouse';
import { WarehouseSettingsDialog } from '@/features/warehouse-settings';
import { WarehouseList } from '@/widgets/warehouse-list';
import { DeleteWarehouseDialog } from '@/features/warehouse-delete';
import { Button, Heading, Text } from '@robots/ui';
import { useState } from 'react';

const handleCreateWarehouse = () => undefined;

export function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<MockWarehouse[]>([...warehouseMocks]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<MockWarehouse | null>(null);
  const [warehouseToDelete, setWarehouseToDelete] = useState<MockWarehouse | null>(null);

  const handleWarehouseSave = (warehouseId: string, name: string) => {
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
  };

  const handleMembersChange = (warehouseId: string, members: readonly WarehouseMember[]) => {
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
  };

  const handleWarehouseDeleteConfirm = (warehouseId: string) => {
    setWarehouses((currentWarehouses) =>
      currentWarehouses.filter((warehouse) => warehouse.warehouseId !== warehouseId),
    );

    setWarehouseToDelete(null);
  };

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Heading level={1}>Склады</Heading>

            <Text variant="muted" className="mt-2">
              Управляйте складами, участниками и настройками симуляции.
            </Text>
          </div>

          <Button type="button" size="lg" onClick={handleCreateWarehouse} className="shrink-0">
            Создать склад
          </Button>
        </header>

        <WarehouseList
          warehouses={warehouses}
          onCreate={handleCreateWarehouse}
          onSettings={setSelectedWarehouse}
          onDelete={setWarehouseToDelete}
        />
      </div>

      <WarehouseSettingsDialog
        key={selectedWarehouse?.warehouseId ?? 'warehouse-settings-closed'}
        warehouse={selectedWarehouse}
        open={selectedWarehouse !== null}
        onMembersChange={handleMembersChange}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedWarehouse(null);
          }
        }}
        onSave={handleWarehouseSave}
      />

      <DeleteWarehouseDialog
        warehouse={warehouseToDelete}
        open={warehouseToDelete !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setWarehouseToDelete(null);
          }
        }}
        onConfirm={handleWarehouseDeleteConfirm}
      />
    </main>
  );
}
