'use client';

import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';

import { DEFAULT_LOCALE, type Locale, TIME_ZONE } from '../config';
import { messages } from '../messages';

type LocalIntlProviderProps = {
  locale?: Locale;
  /** В тестах и Storybook — `UTC`, чтобы даты не зависели от машины. */
  timeZone?: string;
  children: ReactNode;
};

/**
 * Провайдер со словарём из бандла, без обращения к серверной конфигурации next-intl.
 * Нужен там, где языка из сегмента [locale] нет: корневой 404, тесты, Storybook.
 */
export function LocalIntlProvider({
  locale = DEFAULT_LOCALE,
  timeZone = TIME_ZONE,
  children,
}: LocalIntlProviderProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone={timeZone}>
      {children}
    </NextIntlClientProvider>
  );
}
