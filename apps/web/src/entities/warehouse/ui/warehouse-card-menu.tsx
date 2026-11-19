'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@robots/ui';

type WarehouseCardMenuProps = {
  warehouseName: string;
  onSettings: () => void;
  onDelete: () => void;
};

export function WarehouseCardMenu({ warehouseName, onSettings, onDelete }: WarehouseCardMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Открыть меню склада «${warehouseName}»`}
          className="flex size-9 items-center justify-center rounded-md border bg-background text-xl opacity-0 shadow-sm transition hover:bg-accent group-hover:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span aria-hidden="true">⋯</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onSettings}>Настройки склада</DropdownMenuItem>

        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          Удалить склад
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
