# RobotsProject

Платформа управления роботами на симулируемом складе: 2D-карта, роботы, очередь заданий, диспетчерская в real time. Полное ТЗ — [docs/SPEC.md](docs/SPEC.md).

## Требования

- **Node.js 22** (версия в [.nvmrc](.nvmrc): `nvm use` / `fnm use`). Рекомендуется свежий 22.x.
- **pnpm 10** — версия зафиксирована в `packageManager`, ставится через Corepack: `corepack enable`.
- **Docker** с Docker Compose — для PostgreSQL.

## Быстрый старт

```bash
corepack enable        # один раз: включает pnpm нужной версии
pnpm i                 # зависимости, .env из .env.example, Prisma Client, git-хуки
pnpm db:migrate        # поднимет Postgres (если ещё не запущен) и применит миграции
pnpm dev               # shared (watch) + api + web; Postgres поднимается сам
```

`pnpm dev` и `pnpm db:migrate` сами поднимают Postgres из `docker-compose.yml` (`predev`/`predb:migrate` → `pnpm docker:up`) и ждут, пока контейнер станет healthy — вручную `docker compose up -d` не нужен. Остановить инфраструктуру: `pnpm docker:down`.

- Фронтенд: http://localhost:3000 — на странице должно быть `health: ok`.
- API: http://localhost:3001/api, Swagger: http://localhost:3001/api/docs.

## Структура

```
apps/
  api/        NestJS + Prisma (PostgreSQL)
  web/        Next.js (App Router) + FSD
packages/
  shared/     zod-схемы и типы, общие для api и web (собирается tsup в dist/)
  ui/         UI kit на shadcn/ui + Tailwind (подключается исходниками)
```

## Скрипты (из корня)

| Скрипт             | Что делает                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `pnpm dev`         | Поднимает Postgres (`predev`), собирает `shared`, запускает `shared` (watch), `api` и `web` |
| `pnpm docker:up`   | `docker compose up -d --wait`: поднять Postgres и дождаться healthy                         |
| `pnpm docker:down` | `docker compose down`: остановить инфраструктуру                                            |
| `pnpm build`       | Продакшн-сборка всех пакетов                                                                |
| `pnpm lint`        | ESLint по всему репозиторию + Steiger (правила FSD) для `apps/web`                          |
| `pnpm typecheck`   | `tsc --noEmit` во всех пакетах                                                              |
| `pnpm test`        | Vitest во всех пакетах                                                                      |
| `pnpm format`      | Prettier: исправить форматирование (`format:check` — только проверка)                       |
| `pnpm db:migrate`  | `prisma migrate dev`: применить миграции, создать новую после правок схемы                  |
| `pnpm db:generate` | Перегенерировать Prisma Client                                                              |
| `pnpm db:studio`   | Prisma Studio                                                                               |

Запуск в одном пакете: `pnpm --filter @robots/api test`, `pnpm --filter @robots/web dev` и т. д.

## Переменные окружения

Один файл `.env` в корне (не коммитится). Шаблон — [.env.example](.env.example); `pnpm i` копирует его в `.env`, если файла ещё нет.

| Переменная          | По умолчанию                                                     | Кто читает      | Назначение                              |
| ------------------- | ---------------------------------------------------------------- | --------------- | --------------------------------------- |
| `NODE_ENV`          | `development`                                                    | api             | Режим работы                            |
| `DATABASE_URL`      | `postgresql://robots:robots@localhost:5432/robots?schema=public` | api, Prisma CLI | Подключение к PostgreSQL (обязательная) |
| `API_PORT`          | `3001`                                                           | api             | Порт бэкенда                            |
| `API_INTERNAL_URL`  | `http://localhost:3001`                                          | web (сервер)    | Куда Next проксирует `/api/*`           |
| `POSTGRES_USER`     | `robots`                                                         | docker compose  | Пользователь БД                         |
| `POSTGRES_PASSWORD` | `robots`                                                         | docker compose  | Пароль БД                               |
| `POSTGRES_DB`       | `robots`                                                         | docker compose  | Имя БД                                  |
| `POSTGRES_PORT`     | `5432`                                                           | docker compose  | Порт БД на хосте                        |

Окружение `api` проверяется при старте zod-схемой ([apps/api/src/config/env.ts](apps/api/src/config/env.ts)): с некорректными значениями приложение не запустится. Новую переменную добавляем в схему, в `.env.example` и в эту таблицу.

## Договорённости

### Общие

- **Контракты — в `packages/shared`.** Zod-схема описывает запрос или ответ один раз: `api` валидирует по ней, `web` выводит из неё типы и проверяет формы. Версия zod одна на весь репозиторий (`catalog:` в [pnpm-workspace.yaml](pnpm-workspace.yaml)).
- **`shared` импортируется собранным** (`dist/`). В `pnpm dev` правки в `packages/shared/src` (включая новые файлы) пересобирают `dist`, после чего `api` перезапускается (nodemon следит за `packages/shared/dist`), а `web` подхватывает изменения сам. `typecheck` и `test` собирают `shared` перед запуском.
- **Ошибки API — всегда `ApiError`** `{ code, message, details? }` из `shared`. `details` — массив `{ path, message }` для ошибок валидации.
- Git: trunk-based, в `main` только через PR с ревью. На pre-commit работает lint-staged (ESLint + Prettier), на PR — CI: lint → typecheck → test → build.

### Бэкенд

- Глобальный префикс `/api`.
- **Один способ валидации:** DTO через `createZodDto(схема из shared)` — глобальный `ZodValidationPipe` проверит запрос, Swagger возьмёт схему. Образец — [apps/api/src/example](apps/api/src/example) (удалить с первой настоящей фичей).
- **Один `PrismaService`** на приложение: `PrismaModule` глобальный, в модулях фич его не объявляем.
- Глобальный фильтр приводит к `ApiError` любую ошибку: zod → `400 VALIDATION_ERROR` с полями, `HttpException` → её статус, всё остальное → `500 INTERNAL_ERROR` без деталей (подробности в логе).

### Фронтенд

- **Данные с сервера хранятся в TanStack Query.** Не копируем их в Zustand или `useState`: клиентские сторы — только для состояния интерфейса.
- **FSD:** роутинг Next — в `apps/web/app` (файлы там только реэкспортируют страницы), слои FSD — в `apps/web/src`. Папка `apps/web/pages` пустая намеренно, не удалять. Алиас `@/` → `src/`. Нарушения слоёв ловит Steiger (`pnpm lint`).
- **Запросы — только через `http` из `@/shared/api`**, путь без префикса: `http('/health')`. Браузер ходит на `/api/*`, Next проксирует в бэкенд. При ошибке клиент бросает `HttpError` с `ApiError` внутри.
- **Ошибки мутаций показываются тостом автоматически.** Если компонент обрабатывает ошибку сам: `useMutation({ meta: { silent: true } })`.
- **Компоненты — из `@robots/ui`**, минимум стилей по месту. Тема (CSS-переменные) — в [packages/ui/src/styles/theme.css](packages/ui/src/styles/theme.css).
