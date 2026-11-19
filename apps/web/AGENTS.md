<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Состояние

- Данные с сервера — TanStack Query (`@/shared/api`). Клиентское состояние (UI, выбор, черновики) — Zustand.
  Ответы API в Zustand не копируем.
- Глобального стора нет. Стор лежит в сегменте `model` своего слайса
  (`entities/session/model/session-store.ts`) и экспортируется через `index.ts` слайса.
- Сторы создаём хелперами из `@/shared/lib/store`: `createModelStore` (один экземпляр на модуль)
  или `createScopedStore` (экземпляр на `Provider`, начальное состояние из пропсов/SSR).
  Подробности и примеры — [src/shared/lib/store/README.md](src/shared/lib/store/README.md).
