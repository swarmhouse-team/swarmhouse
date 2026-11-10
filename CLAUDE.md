# RobotsProject

Учебный командный проект: платформа управления роботами на симулируемом складе (2D-карта-сетка, роботы, очередь заданий, real-time диспетчерская, ИИ-помощник, Telegram-уведомления).

**Полное ТЗ: [docs/SPEC.md](docs/SPEC.md)** — читай его перед работой над любой фичей, архитектурой или инфраструктурой.

## Ключевые ограничения из ТЗ

- Frontend: Next.js + TypeScript, TanStack Query, Zustand, shadcn + Tailwind, react-hook-form + zod, socket.io; архитектура — Feature-Sliced Design (с линтером FSD); Vitest + RTL, Storybook, Sentry/GlitchTip.
- Backend: NestJS + TypeScript, socket.io, PostgreSQL, Redis, Prisma/TypeORM, BullMQ, Swagger, пакет `openai`.
- Менеджер пакетов — pnpm; ESLint + Prettier + Husky; Docker для dev и prod.
- Логика симуляции отделена от HTTP/WebSocket/БД и покрыта unit-тестами.
- Сервер — источник истины для позиций роботов и статусов заданий; один склад обрабатывается только одним инстансом бэкенда; прод — несколько инстансов.
- Проверка прав (владелец/наблюдатель) в HTTP и WS, включая действия через ИИ; идемпотентность создания заданий.
- BullMQ — только для ИИ и уведомлений, не для каждого шага робота.
- Прод-наблюдаемость: Loki, Promtail, Prometheus, Grafana, node_exporter, cAdvisor.
- Git: trunk-based, прямой пуш в main запрещён, только PR с ревью; CI на PR: lint, tests, build, typecheck; релиз — кнопкой в GitHub.
- Секреты не коммитим: `.env` локально, GitHub Secrets в CI/CD.
- Коммиты небольшие, по зонам ответственности.
