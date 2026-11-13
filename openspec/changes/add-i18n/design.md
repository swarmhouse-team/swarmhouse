# Design

## Context

- `apps/web` — Next.js 16.4 на App Router. `app/` только связывает маршруты со слоем FSD `src/pages`, FSD проверяет `steiger`. Корневой layout задаёт `<html lang="ru">` и статичный `metadata`; клиентские провайдеры — `src/app/providers` (там только `QueryClientProvider`).
- Тексты ошибок формируются в `src/shared/api`: `http-client.ts` пишет русский текст для `NETWORK_ERROR` и `UNKNOWN_ERROR`, `getErrorMessage()` возвращает `message`, `query-client.ts` показывает его в тосте вне React.
- Бэкенд отдаёт `ApiError { code, message, details?: { path, message }[] }`, где `message` — английский технический текст. Набор кодов `API_ERROR_CODES` открыт: фичи добавляют свои коды.
- Стек форм: zod 4, `@hookform/resolvers` 5, `react-hook-form`. Форм в приложении пока нет; `FormMessage` из `packages/ui` выводит `error.message` без обработки.
- Storybook ещё не установлен. Тесты на Vitest, RTL и jsdom.
- В Next 16 бывший `middleware` называется `proxy` (`node_modules/next/dist/docs/.../proxy.md`).
- Мотивация описана в proposal.md, требования — в specs/web-i18n/spec.md.

## Goals / Non-Goals

**Goals:**

- Список языков, язык по умолчанию и cookie задаются в одном месте, ключи `t()` типизированы.
- Ни `shared/api`, ни схемы не формируют пользовательский текст: там только коды и ключи.
- Страницы можно рендерить статически для каждого языка.

**Non-Goals:**

- Переведённые сегменты путей (`pathnames`).
- Ленивая загрузка словарей по неймспейсам.
- Изменения в `packages/ui`: компоненты остаются без собственных текстов.

## Decisions

### 1. next-intl с префиксом языка в URL

- `shared/i18n/routing.ts`: `defineRouting({ locales: ['ru','en'], defaultLocale: 'ru', localePrefix: 'always', localeCookie: { name: 'NEXT_LOCALE', maxAge: 1 год } })`.
- `shared/i18n/navigation.ts`: `createNavigation(routing)` → `Link`, `useRouter`, `usePathname`, `redirect`. Внутренняя навигация идёт только через них; `next/link` и `next/navigation` для внутренних путей запрещены через `no-restricted-imports`.
- `apps/web/proxy.ts`: `createMiddleware(routing)`. Matcher исключает `/api`, `/_next`, `/_vercel` и файлы с расширением. Если префикса нет, proxy перенаправляет: сначала по cookie, затем по `Accept-Language`, иначе на `ru`.
- `shared/i18n/request.ts`: `getRequestConfig` берёт явно переданный `locale` (например, из `getTranslations({ locale })`), иначе `requestLocale`; проверяет через `hasLocale` и возвращает словарь и `timeZone`. Явный `locale` обязателен там, где нет `setRequestLocale` (`generateMetadata`): иначе next-intl читает заголовки и страница становится динамической.
- Неподдерживаемый первый сегмент (`/de`) proxy считает путём без префикса: `/de` → `/ru/de` → 404.
- Почему префикс `always`, а не `as-needed`: у каждой страницы на каждом языке один адрес, нет особого случая для `ru`, и proxy работает проще.
- Почему не вариант «только cookie» (прежняя версия плана): язык должен быть виден в URL, ссылкой можно поделиться с нужным языком, а страницы рендерятся статически.

### 2. Маршруты в `app/[locale]`

- `app/[locale]/layout.tsx`: если язык не прошёл `hasLocale`, вызывается `notFound()`. Затем `setRequestLocale(locale)`, рендер `<html lang={locale}>` и `NextIntlClientProvider` вокруг `Providers`, а также `generateStaticParams` по языкам и `generateMetadata` через `getTranslations('metadata')`.
- `app/[locale]/page.tsx` реэкспортирует страницу из `src/pages/home`, как сейчас.
- `app/[locale]/[...rest]/page.tsx` вызывает `notFound()` → `app/[locale]/not-found.tsx` на языке страницы.
- `app/layout.tsx` только пропускает `children`; он нужен для `app/not-found.tsx` (404 вне `[locale]`, на языке по умолчанию, со своим `<html>`), как в доках next-intl.
- `NotFoundPage` — клиентский компонент: граница 404 рендерится вне `setRequestLocale`, и серверный `getTranslations` там сделал бы все страницы динамическими. Корневой 404 получает словарь через `LocalIntlProvider`.
- Ограничение Next 16: ответ 404 отдаётся оболочкой `__next_error__`, и `lang` у `<html>` появляется только после гидрации.

### 3. Сегмент `src/shared/i18n`

```
config.ts            LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE
next-intl.d.ts       AppConfig { Locale; Messages: typeof ru }
routing/             routing.ts, navigation.ts, request.ts
provider/            local-intl-provider.tsx
messages/            ru.json (эталон для типов), en.json, index.ts
validation/          zod-error-map.ts, use-zod-resolver.ts, api-validation-errors.ts
index.ts, README.md
```

Ключи группируются по неймспейсам, соответствующим месту использования (`metadata`, `home`, `switchLocale` и далее по слайсам), плюс общие `common`, `errors` и `validation`. Коды ошибок входят в ключ как есть: `errors.api.SERVICE_UNAVAILABLE`, `validation.too_small.string`.

### 4. Переключатель: фича `src/features/switch-locale`

Клиентский компонент вызывает `router.replace(pathname, { locale })` из `shared/i18n/navigation`. URL меняется, next-intl записывает cookie `NEXT_LOCALE`, кеш TanStack Query не сбрасывается. Подпись каждого языка берётся из словаря на этом же языке (`switchLocale.languages.*`). Переключатель стоит в углу экрана: его выводит `AppLayout` из `src/app/layout`, а не `app/[locale]/layout.tsx`, чтобы steiger (он проверяет только `src/`) видел использование слайса. Когда появится шапка, переключатель переедет туда.

### 5. Запрет текста в JSX

`eslint-plugin-i18next`, правило `i18next/no-literal-string` в режиме `jsx-only` в корневом `eslint.config.mjs`, только для `apps/web/src/**`. Файлы `*.spec.*` и `*.stories.*` исключены. Атрибуты вроде `className`, `data-*`, `href` и `type` правило по умолчанию не проверяет; при необходимости список дополняется в конфиге.

- Альтернатива: `react/jsx-no-literals` (уже есть через `eslint-config-next`). С включённой проверкой атрибутов она ругается на `className`, поэтому пришлось бы вести длинный список исключений.
- На время миграции правило стоит в `warn`, после перевода домашней страницы его переключают в `error`.

### 6. Ошибки API по коду

- У ошибок, созданных на клиенте (`NETWORK_ERROR`, `UNKNOWN_ERROR`), `message` — технический английский текст для логов, пользователю он не показывается.
- `getErrorMessage` заменяется на `translateError(error, t)`: если ошибка — `HttpError` и есть ключ `t.has(`api.${code}`)`, возвращается перевод, иначе `t('generic')`. Для компонентов есть хук `useErrorMessage()`.
- Тосты: `createQueryClient({ getErrorMessage })` получает стабильную функцию, которая в момент ошибки берёт актуальный переводчик. Это делает клиентский хук `useQueryClientWithI18n` (`shared/api/use-query-client.ts`): переводчик хранится в замыкании и обновляется в `useEffect`. Ref не используется, потому что на него ругается `react-hooks/refs`. При смене языка `QueryClient` не пересоздаётся. Хук вынесен в отдельный модуль с `'use client'`, чтобы серверный layout мог импортировать `shared/api` и `shared/i18n`.

### 7. `details[].code` в ответе API

В `apiErrorDetailSchema` добавляется `code: z.string().optional()`, а `ApiExceptionFilter.fromValidation` записывает туда `issue.code`. Параметры правила (например, минимум) не передаются: формы проверяются на клиенте теми же схемами, поэтому для ошибок полей с сервера хватает общего текста `validation.api.<code>`, а если такого ключа нет — `validation.invalid`.

### 8. Ошибки zod

- `createZodErrorMap(t)` переводит ошибку по `issue.code` и подставляет параметры ICU: `minimum`, `maximum`, `origin`, `format`.
- Error map передаётся при каждом вызове (`useZodResolver(schema)` = `zodResolver(schema, { error })`), а не глобально через `z.config()`. Глобальная настройка — синглтон модуля, и на сервере она общая для запросов на разных языках.
- Сообщение, явно заданное в схеме, zod ставит выше error map. Поэтому договорённость такая: явное сообщение — это ключ из `validation.*`, и обёртка резолвера переводит его через `t.has`.
- `applyApiValidationErrors(error, setError, t)` раскладывает `details` по полям формы; запись с `path === ''` уходит в `root`.

### 9. Тесты, Storybook, проверка словарей

- `LocalIntlProvider({ locale = 'ru', timeZone })` — клиентский `NextIntlClientProvider` со словарём из бандла, без серверной конфигурации. Используется в корневом 404, в тестах (`timeZone="UTC"`) и в Storybook.
- В Vitest для `next-intl` включён `server.deps.inline`: пакет импортирует `next/navigation` без расширения.
- `src/shared/lib/test-utils`: `renderWithProviders(ui, { locale })` оборачивает в Intl и QueryClient. Его импортируют только spec-файлы. Хуки навигации next-intl в тестах мокаются.
- Для Storybook пример декоратора на `LocalIntlProvider` с переключателем `locale` в тулбаре лежит в `shared/i18n/README.md`.
- `messages.spec.ts` разворачивает оба словаря в плоский список ключей, сравнивает их в обе стороны и проверяет, что значения не пустые.

## Risks / Trade-offs

- [next-intl может не поддерживать Next 16.4 (`proxy.ts`, Turbopack)] → при установке проверить `peerDependencies` и доки; если придётся закрепить версию, записать это в память о версиях.
- [next-intl может не работать в Vitest (ESM, импорты `next/*`)] → `test.server.deps.inline: ['next-intl']`, навигацию мокать.
- [Старые адреса без префикса] → proxy перенаправляет их, ссылки не ломаются.
- [Определение по `Accept-Language` даёт английский при первом визите, а ожидается русский] → это сознательное решение: в next-intl определение по cookie включается только вместе с ним.
- [Правило линтера может срабатывать на технические строки] → дополнять список исключений в конфиге, а не отключать правило в коде.
- [Весь словарь попадает в клиентский бандл] → когда словарь вырастет, передавать в провайдер только нужные неймспейсы.

## Migration Plan

Релиз обычный. Адреса без префикса перенаправляются, контракт API совместим: `details[].code` необязателен. Откат — revert PR.

## Open Questions

- Часовой пояс: пока одна константа `TIME_ZONE = 'Europe/Moscow'` (`shared/i18n/config.ts`) на сервере и клиенте. Показывать ли пояс склада или пользователя, решим вместе с первыми датами в интерфейсе.
