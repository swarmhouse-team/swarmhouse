import { defineRouting } from 'next-intl/routing';

import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES } from '../config';

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

/**
 * Язык — всегда префикс URL (`/ru/...`, `/en/...`). Адрес без префикса proxy
 * перенаправляет по cookie, затем по `Accept-Language`, иначе на `ru`.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
  localeCookie: { name: LOCALE_COOKIE, maxAge: ONE_YEAR_IN_SECONDS, sameSite: 'lax' },
});
