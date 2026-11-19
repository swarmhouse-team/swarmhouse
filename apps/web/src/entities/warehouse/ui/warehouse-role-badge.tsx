import { Text, cn } from '@robots/ui';
import { useTranslations } from 'next-intl';

import type { WarehouseRole } from '../model/mocks';

type WarehouseRoleBadgeProps = {
  role: WarehouseRole;
  className?: string;
};

export function WarehouseRoleBadge({ role, className }: WarehouseRoleBadgeProps) {
  const t = useTranslations('warehouses.roles');

  return (
    <Text
      as="span"
      size="xs"
      weight="medium"
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5',
        role === 'owner'
          ? 'bg-primary text-primary-foreground'
          : 'border bg-secondary text-secondary-foreground',
        className,
      )}
    >
      {t(role)}
    </Text>
  );
}
