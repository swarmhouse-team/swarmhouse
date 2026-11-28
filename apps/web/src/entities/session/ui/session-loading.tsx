import { Spinner, Text, cn } from '@robots/ui';
import { useTranslations } from 'next-intl';

export function SessionLoading({ className }: { className?: string }) {
  const t = useTranslations('session');

  return (
    <div
      role="status"
      className={cn('flex flex-col items-center justify-center gap-4 p-6 text-center', className)}
    >
      <Spinner />
      <Text size="lg" weight="medium">
        {t('checking')}
      </Text>
    </div>
  );
}
