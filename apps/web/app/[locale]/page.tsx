// Файлы в app/ только связывают маршрут Next со страницей из слоя FSD `pages`.
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

import { HomePage } from '@/pages/home';
import { routing } from '@/shared/i18n';

export default async function Page({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  return <HomePage />;
}
