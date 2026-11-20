import { Text, cn } from '@robots/ui';
import { useTranslations } from 'next-intl';

import type { SimulationStatus as SimulationStatusValue } from '../model/mocks';

type SimulationStatusProps = {
  status: SimulationStatusValue;
  className?: string;
};

type StatusDotProps = {
  className?: string;
};

function StatusDot({ className }: StatusDotProps) {
  return <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', className)} />;
}

const statusConfig = {
  running: {
    translationKey: 'running',
    dotClassName: 'bg-emerald-500',
  },
  paused: {
    translationKey: 'paused',
    dotClassName: 'bg-amber-500',
  },
  not_started: {
    translationKey: 'notStarted',
    dotClassName: 'bg-muted-foreground',
  },
} satisfies Record<
  SimulationStatusValue,
  {
    translationKey: 'running' | 'paused' | 'notStarted';
    dotClassName: string;
  }
>;

export function SimulationStatus({ status, className }: SimulationStatusProps) {
  const t = useTranslations('warehouses.statuses');
  const config = statusConfig[status];

  return (
    <Text
      as="span"
      variant="muted"
      size="sm"
      className={cn('inline-flex items-center gap-2', className)}
    >
      <StatusDot className={config.dotClassName} />

      {t(config.translationKey)}
    </Text>
  );
}
