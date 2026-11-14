'use client';

import { Button } from '@robots/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { LOCALES, type Locale, usePathname, useRouter } from '@/shared/i18n';

/**
 * Переключает язык: открывает ту же страницу с другим префиксом. Cookie `NEXT_LOCALE`
 * next-intl обновляет сам, кеш TanStack Query при этом сохраняется.
 */
export function LocaleSwitcher() {
  const t = useTranslations('switchLocale');
  const currentLocale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(locale: Locale) {
    startTransition(() => {
      router.replace(pathname, { locale });
    });
  }

  return (
    <nav aria-label={t('label')} className="flex gap-1">
      {LOCALES.map((locale) => {
        const isCurrent = locale === currentLocale;
        return (
          <Button
            key={locale}
            size="sm"
            variant={isCurrent ? 'secondary' : 'ghost'}
            aria-pressed={isCurrent}
            disabled={isPending}
            lang={locale}
            onClick={() => !isCurrent && switchTo(locale)}
          >
            {t(`languages.${locale}`)}
          </Button>
        );
      })}
    </nav>
  );
}
