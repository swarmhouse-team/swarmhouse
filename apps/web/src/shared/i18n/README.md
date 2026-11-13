# shared/i18n

Локализация веб-клиента на [next-intl](https://next-intl.dev). Языки: `ru` (по умолчанию) и `en`.

## Структура

```
config.ts             LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, TIME_ZONE
next-intl.d.ts        типизация ключей t() по messages/ru.json
routing/               язык как префикс URL
  routing.ts            список языков, префикс, параметры cookie
  navigation.ts         Link, useRouter, usePathname, redirect с учётом языка
  request.ts            конфигурация next-intl для серверных компонентов
provider/
  local-intl-provider.tsx   провайдер со словарём из бандла (без серверной конфигурации)
messages/
  ru.json, en.json       словари; ru.json — эталон для типов
  index.ts, messages.spec.ts
validation/            перевод ошибок форм и API по коду
  zod-error-map.ts, use-zod-resolver.ts, api-validation-errors.ts
```

## Как устроено

- Язык — префикс URL: `/ru/...`, `/en/...`. Маршруты лежат в `app/[locale]/`.
- `proxy.ts` (в корне `apps/web`) перенаправляет адрес без префикса: cookie `NEXT_LOCALE` → `Accept-Language` → `ru`.
- `routing/routing.ts` — список языков, префикс, параметры cookie. `config.ts` — константы.
- `routing/request.ts` — конфигурация next-intl для серверных компонентов (подключена в `next.config.ts`).
- `messages/ru.json` — эталон: по нему типизированы ключи `t()`, опечатка в ключе — ошибка `tsc`.

## Тексты

- Любой текст интерфейса — только через словарь: `useTranslations('home')` в компонентах,
  `getTranslations({ locale, namespace })` в серверном коде (метаданные).
- Текст прямо в JSX запрещает линтер (`i18next/no-literal-string`). Технические атрибуты
  (`className`, `variant`, `href` и т. п.) перечислены в `eslint.config.mjs`; если правило
  сработало на технической строке — дополните список там, а не отключайте правило в коде.
- Переменные части — параметрами ICU, без склейки строк: `t('healthStatus', { status })`.

### Ключи

- Верхний уровень — неймспейс по месту использования: `metadata`, `home`, `switchLocale`, `notFound`,
  дальше по слайсам FSD (`warehouses`, `robots`, ...). Общие: `errors`, `validation`.
- Ключи — camelCase. Коды ошибок входят в ключ как есть: `errors.api.SERVICE_UNAVAILABLE`.

### Как добавить строку

1. Добавьте ключ в `messages/ru.json` и `messages/en.json`.
2. `messages.spec.ts` (входит в `pnpm test`) упадёт, если ключ есть только в одном словаре
   или значение пустое.

### Как добавить язык

1. Добавьте код в `LOCALES` (`config.ts`) и словарь `messages/<код>.json`.
2. Подключите его в `messages/index.ts` и подпись в `switchLocale.languages` во всех словарях.

## Навигация

Внутренние ссылки и переходы — только через `Link`, `useRouter`, `usePathname`, `redirect` из
`@/shared/i18n`: они сохраняют префикс языка. `next/link` и эти функции из `next/navigation`
запрещены линтером (`no-restricted-imports`).

## Ошибки API

Пользователю показывается перевод по `code` ошибки, а не `message` сервера:
`useErrorMessage()` в компонентах, `translateError(error, t)` вне React (оба — в `@/shared/api`).
Новый код ошибки в фиче → добавьте ключ `errors.api.<CODE>`; без ключа покажется общий текст.

## Формы и валидация

- Резолвер — `useZodResolver(schema)` вместо `zodResolver`: сообщения правил zod переводятся
  по коду (`createZodErrorMap`, ключи `validation.*`), при смене языка — после следующей проверки.
- Своё сообщение в схеме задаётся ключом словаря: `.refine(fn, 'validation.passwordsMismatch')`.
- Ошибки полей из ответа API: `applyApiValidationErrors(error, form.setError, t)`, где
  `t = useTranslations('validation')`. Поля сопоставляются по `details[].path`, текст — по
  `details[].code` (ключи `validation.api.*`), ошибка всего объекта — в `errors.root`.

```tsx
const t = useTranslations('validation');
const form = useForm({ resolver: useZodResolver(createWarehouseSchema) });
const mutation = useMutation({
  mutationFn: createWarehouse,
  meta: { silent: true },
  onError: (error) => applyApiValidationErrors(error, form.setError, t),
});
```

## Тесты и Storybook

`LocalIntlProvider` — провайдер с настоящими словарями без серверной конфигурации.

В тестах — `renderWithProviders(ui, { locale: 'en' })` из `@/shared/lib/test-utils`
(словари + QueryClient). Хуки навигации next-intl (`useRouter`, `usePathname`) мокайте через
`vi.mock('@/shared/i18n/routing/navigation')`.

Storybook ещё не подключён. Когда появится, декоратор в `.storybook/preview.tsx`:

```tsx
import type { Preview } from '@storybook/nextjs-vite';

import { LocalIntlProvider, LOCALES } from '@/shared/i18n';

const preview: Preview = {
  globalTypes: {
    locale: {
      description: 'Язык интерфейса',
      toolbar: { icon: 'globe', items: [...LOCALES], dynamicTitle: true },
    },
  },
  initialGlobals: { locale: 'ru' },
  decorators: [
    (Story, { globals }) => (
      <LocalIntlProvider locale={globals.locale} timeZone="UTC">
        <Story />
      </LocalIntlProvider>
    ),
  ],
};

export default preview;
```
