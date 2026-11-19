'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@robots/ui';
import { useTranslations } from 'next-intl';

type WarehouseCardMenuProps = {
  warehouseName: string;
  onSettings: () => void;
  onDelete: () => void;
};

export function WarehouseCardMenu({ warehouseName, onSettings, onDelete }: WarehouseCardMenuProps) {
  const t = useTranslations('warehouses.menu');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t('openLabel', { name: warehouseName })}
          className="bg-background text-xl opacity-0 shadow-sm group-hover:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="currentColor">
            <circle cx="5" cy="12" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="19" cy="12" r="1.5" />
          </svg>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onSettings}>{t('settings')}</DropdownMenuItem>

        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          {t('delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
