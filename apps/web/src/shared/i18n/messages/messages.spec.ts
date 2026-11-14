import { describe, expect, it } from 'vitest';

import { LOCALES } from '../config';
import { messages } from './index';

type Tree = { [key: string]: string | Tree };

/** `{ a: { b: 'x' } }` → `{ 'a.b': 'x' }`. */
function flatten(tree: Tree, prefix = ''): Record<string, unknown> {
  return Object.entries(tree).reduce<Record<string, unknown>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null
      ? { ...acc, ...flatten(value, path) }
      : { ...acc, [path]: value };
  }, {});
}

const flat = Object.fromEntries(
  LOCALES.map((locale) => [locale, flatten(messages[locale] as Tree)]),
) as Record<(typeof LOCALES)[number], Record<string, unknown>>;

describe('словари', () => {
  it.each(LOCALES.flatMap((a) => LOCALES.filter((b) => b !== a).map((b) => [a, b] as const)))(
    'все ключи %s есть в %s',
    (from, to) => {
      const missing = Object.keys(flat[from]).filter((key) => !(key in flat[to]));
      expect(missing, `Нет в ${to}.json`).toEqual([]);
    },
  );

  it.each(LOCALES)('в %s нет пустых значений', (locale) => {
    const empty = Object.entries(flat[locale])
      .filter(([, value]) => typeof value !== 'string' || value.trim() === '')
      .map(([key]) => key);
    expect(empty, `Пустые значения в ${locale}.json`).toEqual([]);
  });
});
