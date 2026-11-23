import { Button, Text, cn } from '@robots/ui';
import { useTranslations } from 'next-intl';

type NewWarehouseCardProps = {
  onClick: () => void;
  className?: string;
};

export function NewWarehouseCard({ onClick, className }: NewWarehouseCardProps) {
  const t = useTranslations('warehouses.newCard');

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={cn(
        'h-auto min-h-72 w-full flex-col gap-3 whitespace-normal rounded-xl border-dashed bg-card p-6 text-card-foreground shadow-none',
        'hover:border-foreground/40 hover:bg-muted/40',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-full bg-muted text-2xl"
      >
        +
      </span>

      <Text as="span" weight="semibold">
        {t('title')}
      </Text>

      <Text as="span" variant="muted" size="sm">
        {t('description')}
      </Text>
    </Button>
  );
}
