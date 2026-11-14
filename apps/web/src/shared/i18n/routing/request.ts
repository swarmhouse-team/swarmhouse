import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { TIME_ZONE } from '../config';
import { messages } from '../messages';
import { routing } from './routing';

// Точка входа для плагина next-intl (см. next.config.ts): язык берётся из сегмента [locale].
// Явный `locale` (`getTranslations({ locale })`) берём без чтения заголовков — иначе страница
// перестаёт быть статической.
export default getRequestConfig(async ({ locale: explicitLocale, requestLocale }) => {
  const requested = explicitLocale ?? (await requestLocale);
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return { locale, messages: messages[locale], timeZone: TIME_ZONE };
});
