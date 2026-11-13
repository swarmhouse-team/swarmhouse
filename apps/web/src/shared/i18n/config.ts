/** Поддерживаемые языки. Первый — язык по умолчанию. */
export const LOCALES = ['ru', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ru';

/** Cookie, в которой next-intl запоминает выбранный язык. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/**
 * Часовой пояс форматирования дат — один на сервере и клиенте, иначе разметка разойдётся
 * при гидратации. Временное значение: какой пояс показывать (склада или пользователя),
 * решим вместе с первыми датами в интерфейсе.
 */
export const TIME_ZONE = 'Europe/Moscow';
