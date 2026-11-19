import { Card, CardHeader, CardTitle, Text, cn } from '@robots/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import type { MockWarehouse } from '../model/mocks';
import { SimulationStatus } from './simulation-status';
import { WarehouseRoleBadge } from './warehouse-role-badge';

type WarehouseCardProps = {
  warehouse: MockWarehouse;
  actions?: ReactNode;
  className?: string;
};

export function WarehouseCard({ warehouse, actions, className }: WarehouseCardProps) {
  const t = useTranslations('warehouses.card');
  const { name, role, mapSize, robotsCount, stationsCount, simulationStatus } = warehouse;

  return (
    <Card
      className={cn(
        'group relative gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md',
        className,
      )}
    >
      {role === 'owner' && actions ? (
        <div className="absolute top-3 right-3 z-10">{actions}</div>
      ) : null}

      <div
        role="img"
        aria-label={t('mapPlaceholderLabel', { name })}
        className="flex aspect-video items-center justify-center border-b bg-muted/60"
      >
        <Text as="span" variant="muted" size="sm">
          {t('mapPlaceholder')}
        </Text>
      </div>

      <CardHeader className="gap-4 py-5">
        <div className="space-y-2">
          <CardTitle className="truncate">{name}</CardTitle>

          <Text variant="muted" size="sm">
            {t('summary', {
              width: mapSize.width,
              height: mapSize.height,
              robots: robotsCount,
              stations: stationsCount,
            })}
          </Text>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <SimulationStatus status={simulationStatus} />
          <WarehouseRoleBadge role={role} />
        </div>
      </CardHeader>
    </Card>
  );
}
