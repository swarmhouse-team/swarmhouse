import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

import { WarehousesPage } from '@/pages/warehouses';
import { routing } from '@/shared/i18n';

export default async function Page({ params }: PageProps<'/[locale]/warehouses'>) {
  const { locale } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  return <WarehousesPage />;
}
