# [INFRA-001] Костяк проекта

## Цель

Минимальный рабочий каркас монорепозитория. Фронтенд и бэкенд запускаются одной командой. Код проверяют линтеры, тесты и CI. Бизнес-логики пока нет.

## Решения

- Монорепозиторий на pnpm workspaces: `apps/web`, `apps/api`, `packages/shared`, `packages/ui`.
- ORM — Prisma.
- Тесты — Vitest во всех пакетах.
- Версия Node зафиксирована в `.nvmrc`.

## Что сделать

### Репозиторий и инструменты

- `.gitignore`, `.editorconfig`, `.env.example`.
- Общий `tsconfig.base.json` в режиме strict, ESLint, Prettier.
- Husky + lint-staged на pre-commit.
- Корневые скрипты: `dev`, `build`, `lint`, `typecheck`, `test`.

### packages/shared, packages/ui

- **shared:** пример zod-схемы и типа. Пакет подключён в `web` и `api`. Собирается через tsup в `dist/`, при правках пересобирается в watch-режиме, `api` и `web` импортируют собранный пакет. Версия zod одна во всех пакетах (через `catalog:` pnpm).
- **ui:** минимальный набор для первых задач: `Button`, `Input`, `Label`, `Card`, `Form` и toast (sonner).

### Бэкенд apps/api (NestJS)

- Скелет Nest, конфиг из env с валидацией.
- Prisma + PostgreSQL, начальная миграция. `PrismaModule` / `PrismaService` — один на всё приложение.
- Глобальный префикс `/api` и один способ валидации запросов: zod-схемы из `shared` через общий pipe (`ZodValidationPipe` из `nestjs-zod` в провайдерах).
- Единый формат ошибок: тип `ApiError { code, message, details }` в `shared`. Глобальный фильтр в `api` приводит к нему все ошибки: zod, Nest, непредвиденные (500 без деталей, с записью в лог).
- `GET /api/health` проверяет БД. Swagger на `/api/docs`.
- 1 тест: Vitest + `unplugin-swc`.

### Фронтенд apps/web (Next.js)

- Next.js + TypeScript, структура по FSD и линтер FSD (Steiger).
- Роутинг Next в `apps/web/app`, слои FSD в `src/`, пустая `pages/` в корне `apps/web`, алиас `@/`.
- Браузер ходит в API через `/api` (rewrites в Next). HTTP-клиент в `shared/api` разбирает ошибки `ApiError`.
- Tailwind подключён, компоненты берутся из `@robots/ui`. `<Toaster />` в корневом layout.
- react-hook-form и `@hookform/resolvers` установлены.
- Провайдер TanStack Query. HTTP-клиент бросает `HttpError` с `ApiError`; ошибки мутаций по умолчанию показываются тостом (`MutationCache.onError`, отключается через `meta.silent`).
- Страница-заглушка со статусом `/api/health`.
- 1 тест на Vitest + RTL.

### Docker и CI

- `docker-compose.yml` с PostgreSQL для локальной разработки.
- GitHub Actions на каждый PR: install → lint → typecheck → test → build.
- README: требования, быстрый старт, скрипты, переменные окружения. Договорённость: данные с сервера хранятся в TanStack Query.

## Критерии приёмки

1. Проект поднимается по README: `pnpm i` → `docker compose up -d` → `pnpm db:migrate` → `pnpm dev`.
2. На странице фронтенда видно `health: ok`, запрос идёт через `/api`.
3. `pnpm lint`, `pnpm typecheck`, `pnpm test` и `pnpm build` проходят из корня и в CI.
4. Линтер падает, если нарушены слои FSD.
5. Невалидный запрос к API возвращает `400` с ошибками по полям, необработанная ошибка — `500` без стека; обе в формате `ApiError`.

## Перенесено в первые задачи

- `packages/simulation` → прототип симуляции.
- Zustand (стор через контекст, devtools, мок для тестов) → редактор карты.
- Пример формы с `zodResolver`, запросы с сервера Next по `API_INTERNAL_URL` → авторизация.
- Маппинг ошибок Prisma в фильтре → склады.
