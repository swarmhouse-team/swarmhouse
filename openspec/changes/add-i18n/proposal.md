# Proposal

## Why

Тексты веб-клиента написаны прямо в компонентах на русском (`home-page.tsx`, `layout.tsx`). Тексты ошибок собираются в `shared/api` или берутся из `message` ответа API, а он на английском. Интерфейса пока мало, поэтому заложить i18n сейчас дешевле всего: потом пришлось бы переписывать каждый компонент.

## What Changes

- Подключаем `next-intl` в `apps/web` с языками `ru` (по умолчанию) и `en`. Язык задаётся префиксом в URL (`/ru/...`, `/en/...`); адрес без префикса перенаправляется по cookie `NEXT_LOCALE`, затем по `Accept-Language`, иначе на `ru`.
- Словари лежат в `apps/web/src/shared/i18n/messages/{ru,en}.json`. Все тексты интерфейса, включая метаданные страницы, выводятся через `t('...')`.
- Добавляем переключатель языка: он меняет префикс в URL и сохраняет выбор в cookie `NEXT_LOCALE`. `<html lang>` берётся из префикса.
- Линтер запрещает писать текст прямо в JSX (`eslint-plugin-i18next`).
- Ошибки API переводятся по `ApiError.code`, ошибки zod — по коду правила. **BREAKING (внутри web)**: `getErrorMessage(error)` заменяется переводом по коду.
- В `ApiErrorDetail` (`@robots/shared`) появляется необязательное поле `code`, бэкенд заполняет его для `VALIDATION_ERROR`.
- Обёртка провайдера для тестов и Storybook; тест на одинаковые ключи в `ru` и `en`.

Не входит в изменение: переведённые сегменты путей (`/en/warehouses` и `/ru/sklady`), перевод текстов бэкенда, установка Storybook, перевод пользовательских данных.

## Capabilities

### New Capabilities

- `web-i18n`: языки веб-клиента, язык в URL, переключатель, `<html lang>`, тексты из словарей и запрет текста в JSX, перевод ошибок API и валидации, одинаковые ключи в словарях.

### Modified Capabilities

<!-- Существующих спецификаций нет. -->

## Impact

- **apps/web**: зависимости `next-intl` и `eslint-plugin-i18next` (dev). Маршруты переезжают в `app/[locale]/`. Новый `proxy.ts`. `next.config.ts` получает плагин next-intl. Новые сегмент `src/shared/i18n` и фича `src/features/switch-locale`. Меняются `src/shared/api` и `src/pages/home` вместе с их тестами.
- **Корень**: в `eslint.config.mjs` добавляется правило запрета текста в JSX для `apps/web/src`.
- **packages/shared**: `apiErrorDetailSchema` получает необязательное поле `code`.
- **apps/api**: `ApiExceptionFilter.fromValidation` заполняет `details[].code`.
- **URL**: все страницы получают префикс языка; старые адреса без префикса перенаправляются.
