'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
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
          <Icon name="ellipsis" className="size-5" />
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
