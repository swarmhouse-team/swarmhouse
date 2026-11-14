import type { Locale } from '../config';
import en from './en.json';
import ru from './ru.json';

/** `ru` — эталон: по нему типизированы ключи `t()`. */
export type Messages = typeof ru;

/** `satisfies` проверяет, что в `en` есть все ключи `ru`; полную проверку делает messages.spec.ts. */
export const messages = { ru, en } satisfies Record<Locale, Messages>;
