'use client';

import {
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
        <button
          type="button"
          aria-label={t('openLabel', { name: warehouseName })}
          className="flex size-9 items-center justify-center rounded-md border bg-background text-xl opacity-0 shadow-sm transition hover:bg-accent group-hover:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="currentColor">
            <circle cx="5" cy="12" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="19" cy="12" r="1.5" />
          </svg>
        </button>
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
