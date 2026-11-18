import { cn } from '@robots/ui';

import type { SimulationStatus as SimulationStatusValue } from '../model/mocks';

type SimulationStatusProps = {
  status: SimulationStatusValue;
  className?: string;
};

const statusConfig = {
  running: {
    label: 'Идёт',
    dotClassName: 'bg-emerald-500',
  },
  paused: {
    label: 'Пауза',
    dotClassName: 'bg-amber-500',
  },
  not_started: {
    label: 'Не запущена',
    dotClassName: 'bg-muted-foreground',
  },
} satisfies Record<
  SimulationStatusValue,
  {
    label: string;
    dotClassName: string;
  }
>;

export function SimulationStatus({ status, className }: SimulationStatusProps) {
  const config = statusConfig[status];

  return (
    <span className={cn('inline-flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <span
        aria-hidden="true"
        className={cn('size-2 shrink-0 rounded-full', config.dotClassName)}
      />

      {config.label}
    </span>
  );
}
