'use client';

import type { MockWarehouse } from '@/entities/warehouse';
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input } from '@robots/ui';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('warehouses.delete');
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
              <DialogTitle>{t('title')}</DialogTitle>

              <DialogDescription className="mt-2">{t('description')}</DialogDescription>
            </div>

            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive">{t('consequencesTitle')}</p>

              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                <li>{t('consequences.map')}</li>
                <li>{t('consequences.robotsAndStations')}</li>
                <li>{t('consequences.settingsAndMembers')}</li>
                <li>{t('consequences.simulationData')}</li>
              </ul>
            </div>

            <div>
              <label htmlFor="warehouse-delete-confirmation" className="text-sm font-medium">
                {t('confirmationLabel')}
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

              <p className="mt-2 text-xs text-muted-foreground">{t('confirmationHint')}</p>
            </div>
          </div>

          <footer className="flex justify-end gap-3 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {t('cancel')}
            </Button>

            <Button type="submit" variant="destructive" disabled={!isConfirmed}>
              {t('submit')}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
