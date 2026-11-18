import { cn } from '@robots/ui';

import type { WarehouseRole } from '../model/mocks';

type WarehouseRoleBadgeProps = {
  role: WarehouseRole;
  className?: string;
};

const roleLabels = {
  owner: 'Владелец',
  observer: 'Наблюдатель',
} satisfies Record<WarehouseRole, string>;

export function WarehouseRoleBadge({ role, className }: WarehouseRoleBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium',
        role === 'owner'
          ? 'bg-primary text-primary-foreground'
          : 'border bg-secondary text-secondary-foreground',
        className,
      )}
    >
      {roleLabels[role]}
    </span>
  );
}
