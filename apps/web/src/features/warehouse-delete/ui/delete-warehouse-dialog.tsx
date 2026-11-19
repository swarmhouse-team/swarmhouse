'use client';

import type { MockWarehouse } from '@/entities/warehouse';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Label,
  Text,
} from '@robots/ui';
import { useTranslations } from 'next-intl';
import { type ChangeEvent, type FormEvent, useCallback, useState } from 'react';

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

  const isConfirmed = warehouse !== null && confirmation === warehouse.name;

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setConfirmation('');
      }

      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const handleConfirmationChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setConfirmation(event.target.value),
    [],
  );

  const handleCancel = useCallback(() => handleOpenChange(false), [handleOpenChange]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!warehouse || !isConfirmed) {
        return;
      }

      onConfirm(warehouse.warehouseId);
      handleOpenChange(false);
    },
    [handleOpenChange, isConfirmed, onConfirm, warehouse],
  );

  if (!warehouse) {
    return null;
  }

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
              <Text variant="destructive" size="sm" weight="medium">
                {t('consequencesTitle')}
              </Text>

              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                <Text as="li" variant="muted" size="sm">
                  {t('consequences.map')}
                </Text>
                <Text as="li" variant="muted" size="sm">
                  {t('consequences.robotsAndStations')}
                </Text>
                <Text as="li" variant="muted" size="sm">
                  {t('consequences.settingsAndMembers')}
                </Text>
                <Text as="li" variant="muted" size="sm">
                  {t('consequences.simulationData')}
                </Text>
              </ul>
            </div>

            <div>
              <Label htmlFor="warehouse-delete-confirmation">{t('confirmationLabel')}</Label>

              <Text size="sm" weight="semibold" className="mt-1 wrap-break-word">
                {warehouse.name}
              </Text>

              <Input
                id="warehouse-delete-confirmation"
                value={confirmation}
                onChange={handleConfirmationChange}
                placeholder={warehouse.name}
                autoComplete="off"
                className="mt-3"
              />

              <Text variant="muted" size="xs" className="mt-2">
                {t('confirmationHint')}
              </Text>
            </div>
          </div>

          <footer className="flex justify-end gap-3 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={handleCancel}>
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
