'use client';

import type { MockWarehouse } from '@/entities/warehouse';
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input } from '@robots/ui';
import { type FormEvent, useState } from 'react';

type DeleteWarehouseDialogProps = {
  warehouse: MockWarehouse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (warehouseId: string) => void;
};

export function DeleteWarehouseDialog({
  warehouse,
  open,
  onOpenChange,
  onConfirm,
}: DeleteWarehouseDialogProps) {
  const [confirmation, setConfirmation] = useState('');

  if (!warehouse) {
    return null;
  }

  const isConfirmed = confirmation === warehouse.name;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setConfirmation('');
    }

    onOpenChange(nextOpen);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isConfirmed) {
      return;
    }

    onConfirm(warehouse.warehouseId);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <div className="space-y-5 p-6">
            <div>
              <DialogTitle>Удалить склад?</DialogTitle>

              <DialogDescription className="mt-2">Это действие нельзя отменить.</DialogDescription>
            </div>

            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive">
                Вместе со складом будут удалены:
              </p>

              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                <li>карта склада;</li>
                <li>роботы и станции;</li>
                <li>настройки и участники;</li>
                <li>связанные данные симуляции.</li>
              </ul>
            </div>

            <div>
              <label htmlFor="warehouse-delete-confirmation" className="text-sm font-medium">
                Введите название склада для подтверждения:
              </label>

              <p className="mt-1 wrap-break-word text-sm font-semibold">{warehouse.name}</p>

              <Input
                id="warehouse-delete-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={warehouse.name}
                autoComplete="off"
                className="mt-3"
              />

              <p className="mt-2 text-xs text-muted-foreground">
                Название должно совпадать полностью, включая регистр.
              </p>
            </div>
          </div>

          <footer className="flex justify-end gap-3 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Отмена
            </Button>

            <Button type="submit" variant="destructive" disabled={!isConfirmed}>
              Удалить склад
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
