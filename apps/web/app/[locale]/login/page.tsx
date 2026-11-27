import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

import { LoginPage } from '@/pages/login';
import { routing } from '@/shared/i18n';

export default async function Page({ params }: PageProps<'/[locale]/login'>) {
  const { locale } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  return <LoginPage />;
}
