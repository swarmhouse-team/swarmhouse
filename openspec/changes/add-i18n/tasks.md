# Tasks

## 1. Подключение next-intl и линтера

- [x] 1.1 Прочитать `node_modules/next/dist/docs` (internationalization, proxy) и доки next-intl по маршрутизации с префиксом; установить в `apps/web` `next-intl` (с поддержкой Next 16) и dev-зависимость `eslint-plugin-i18next` — проверка: `pnpm install` без предупреждений о peer-зависимостях
- [x] 1.2 Добавить в `eslint.config.mjs` правило `i18next/no-literal-string` (`jsx-only`, `apps/web/src/**`, без `*.spec.*` и `*.stories.*`) в режиме `warn` — проверка: `pnpm lint` выводит предупреждения на строки в `home-page.tsx`
- [x] 1.3 Создать в `src/shared/i18n` файлы `config.ts`, `routing.ts`, `navigation.ts`, `request.ts`, `next-intl.d.ts`, словари `messages/{ru,en}.json` и `index.ts`; подключить плагин next-intl в `next.config.ts` — проверка: опечатка в ключе `t()` даёт ошибку `tsc`, `lint:fsd` проходит

## 2. Маршруты с префиксом языка

- [x] 2.1 Добавить `apps/web/proxy.ts` (matcher без `/api`, `/_next`, файлов) — проверка: `curl -I /` → редирект на `/ru`; с `-b NEXT_LOCALE=en` → на `/en`; с `-H 'Accept-Language: en-US'` без cookie → на `/en`; `curl /api/health` работает как раньше
- [x] 2.2 Перенести маршруты в `app/[locale]/` (`layout.tsx` с `hasLocale`/`notFound`, `setRequestLocale`, `<html lang>`, `NextIntlClientProvider`, `generateStaticParams`, `generateMetadata`; `page.tsx`) и добавить `app/not-found.tsx` — проверка: `/en` отдаёт `lang="en"` и английский `<title>`, `/de` → `/ru/de` → 404, `/en/xyz` → 404 на английском, в выводе `pnpm build` `/ru` и `/en` помечены как статические
- [x] 2.3 Запретить через `no-restricted-imports` использовать `next/link` и навигацию из `next/navigation` в `apps/web/src` (кроме `shared/i18n`) — проверка: импорт `next/link` в странице даёт ошибку `pnpm lint`

## 3. Тестовая обёртка, проверка словарей, README

- [x] 3.1 Сделать `LocalIntlProvider` (в `shared/i18n`) и `renderWithProviders(ui, { locale })` в `src/shared/lib/test-utils`, при необходимости добавить `server.deps.inline: ['next-intl']` — проверка: `pnpm --filter @robots/web test` проходит
- [x] 3.2 Написать `shared/i18n/messages.spec.ts` (одинаковые ключи в обе стороны, нет пустых значений, в сообщении — названия ключей) — проверка: удалить ключ из `en.json` → тест падает с его названием
- [x] 3.3 Написать `shared/i18n/README.md`: неймспейсы и ключи, как добавить строку, язык или код ошибки, навигация только через `shared/i18n/navigation`, правило линтера, договорённость «явное сообщение zod = ключ», декоратор для Storybook — проверка: ревью; пути в README совпадают с кодом

## 4. Перевод домашней страницы

- [x] 4.1 Перевести строки `home-page.tsx` на `useTranslations('home')` (статус через параметр ICU) — проверка: `pnpm lint` не выдаёт `no-literal-string` для файла
- [x] 4.2 Перевести `home-page.spec.tsx` на `renderWithProviders` и добавить тест с `locale: 'en'` — проверка: тесты проходят
- [x] 4.3 Переключить правило `i18next/no-literal-string` в `error` — проверка: временно написать строку в JSX → `pnpm lint` падает

## 5. Переключатель языка

- [x] 5.1 Создать фичу `src/features/switch-locale` (`useLocale`, `usePathname`, `router.replace(pathname, { locale })`, подписи из `switchLocale.*`) и вывести её в `[locale]/layout.tsx` — проверка: `lint:fsd` и `tsc` проходят
- [x] 5.2 Написать `locale-switcher.spec.tsx` с замоканной навигацией: показывается текущий язык; при выборе English вызывается `replace` с `{ locale: 'en' }` — проверка: тесты проходят
- [x] 5.3 Проверить в браузере (`pnpm dev`): с `/ru` → English переходит на `/en`, тексты и `lang` меняются, в cookie записан `NEXT_LOCALE=en`; затем открытие `/` ведёт на `/en`

## 6. Ошибки API по коду

- [x] 6.1 Добавить в оба словаря `errors.generic` и `errors.api.<CODE>` для всех `API_ERROR_CODES`; убрать русский текст из `http-client.ts` — проверка: в `src/shared/api` нет кириллицы вне комментариев
- [x] 6.2 Заменить `getErrorMessage` на `translateError(error, t)` и `useErrorMessage()`, обновить `home-page.tsx` — проверка: тесты (известный код → перевод; неизвестный код и не-`HttpError` → общий текст; `message` сервера не показывается); тест домашней страницы с `SERVICE_UNAVAILABLE` ждёт переведённый текст
- [x] 6.3 Передавать в `createQueryClient` параметр `getErrorMessage`, а в `Providers` — функцию, которая в момент ошибки берёт актуальный переводчик (`useQueryClientWithI18n`) — проверка: тест тоста мутации на `en` показывает английский текст, `http-client.spec.ts` проходит

## 7. Код правила в ошибках полей API

- [x] 7.1 Добавить `code` (необязательное) в `apiErrorDetailSchema` и тест на разбор с ним и без него — проверка: `pnpm --filter @robots/shared test` и `build` проходят
- [x] 7.2 Заполнять `details[].code` в `ApiExceptionFilter.fromValidation` и обновить `http-errors.spec.ts` — проверка: тест ожидает `code: 'too_small'`, `pnpm --filter @robots/api test` проходит

## 8. Ошибки zod

- [x] 8.1 Добавить ключи `validation.*` (основные коды zod 4, ICU-плюралы, `invalid`, `api.<code>`) и `createZodErrorMap(t)` — проверка: тесты на `ru` и `en`: `min(3)` → сообщение с числом 3, неизвестный код → `validation.invalid`
- [x] 8.2 Реализовать `useZodResolver(schema)` (error map при каждом вызове плюс перевод явных сообщений-ключей) — проверка: тест формы с `FormMessage` на `en` показывает английский текст, сообщение-ключ переводится
- [x] 8.3 Реализовать `applyApiValidationErrors(error, setError, t)` и дописать в README раздел про формы — проверка: тест, где `details[].code = 'too_small'`, ставит переведённую ошибку на нужное поле

## 9. Общая проверка

- [x] 9.1 Запустить из корня `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` — все проходят
- [x] 9.2 Проверить в браузере: `/` → `/ru`; переключение на English меняет URL, тексты, `<title>` и `lang`; если остановить API, ошибка health показывается на текущем языке; при повторном визите на `/` открывается выбранный язык
