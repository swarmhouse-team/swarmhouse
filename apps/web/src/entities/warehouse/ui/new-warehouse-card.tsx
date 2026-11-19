import { cn } from '@robots/ui';
import { useTranslations } from 'next-intl';

type NewWarehouseCardProps = {
  onClick: () => void;
  className?: string;
};

export function NewWarehouseCard({ onClick, className }: NewWarehouseCardProps) {
  const t = useTranslations('warehouses.newCard');

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-72 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card p-6 text-card-foreground transition-colors',
        'hover:border-foreground/40 hover:bg-muted/40',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-full bg-muted text-2xl"
      >
        +
      </span>

      <span className="font-semibold">{t('title')}</span>

      <span className="text-sm text-muted-foreground">{t('description')}</span>
    </button>
  );
}
