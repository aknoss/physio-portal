# physio-portal

Web app for a physiotherapist to manage patients, recurring sessions, weekly/monthly billing, and signed monthly PDF reports. Runs locally via `docker-compose up`.

## Planned features

- Physiotherapist login (single-user, JWT).
- Patient CRUD with a direct WhatsApp link.
- Per-patient recurring schedule (fixed weekdays) with automatic session generation.
- Session status as **Realizada / Falta / Remarcada** — only `REALIZADA` bills.
- Dashboard with weekly/monthly totals (overall and per patient).
- Monthly per-patient PDF with image signature and total in BRL.

## Stack

- **Monorepo:** npm workspaces (no Turborepo/Nx).
- **Backend (`apps/api`):** Express + `pg` (no ORM) + tsyringe (DI) + Zod + JWT + pdfkit.
- **Frontend (`apps/web`):** React + Vite + TypeScript + React Query + react-router + Tailwind + react-hook-form.
- **Shared contracts (`packages/contracts`):** Zod schemas as the single source of truth for types and validation.
- **Database:** PostgreSQL with manual SQL migrations (paired `up.sql` / `down.sql`) and a custom runner.
- **Tests:** Vitest + supertest on the backend (real Postgres via Testcontainers), Vitest + Testing Library + MSW on the frontend. Coverage gate (lines, branches, functions, statements) is **100% on `apps/api`** and **80% on `apps/web`**. TDD is the default workflow — failing test first.

UI strings are written directly in PT-BR in JSX — the project is monolingual and has no i18n layer. See `plan.md` for the full schema, REST surface, DI rules, and the Stage 0–10 roadmap.

## Commands (to be implemented)

The scripts below will be wired up as each stage lands. None exist today.

| Command                                 | Purpose                                        |
| --------------------------------------- | ---------------------------------------------- |
| `npm run dev` (root)                    | Start API (`:3000`) and Web (`:5173`)          |
| `npm test` (root)                       | Backend + frontend (100% gate on api, 80% on web) |
| `npm run lint` / `npm run typecheck`    | Static checks across workspaces                |
| `npm run db:migrate -w apps/api`        | Apply pending migrations                       |
| `npm run db:migrate:down -w apps/api`   | Revert the last applied migration              |
| `npm run db:migrate:status -w apps/api` | Show applied vs pending migrations             |
| `npm run db:seed -w apps/api`           | Seed the physiotherapist from env vars         |
| `docker-compose up`                     | Boot postgres + api + web for local use        |

## Roadmap

`plan.md` defines **Stage 0 … Stage 10**. Each stage is independently mergeable, leaves the app usable up to its scope, and must end at the configured coverage gates (100% api / 80% web) before the next one starts:

- **Stages 0–1:** monorepo bootstrap, migration runner, auth, `0001_init` migration.
- **Stages 2–5:** API verticals — patients → schedule + session generation → status + billing → monthly PDF.
- **Stages 6–9:** frontend verticals mirroring the API order.
- **Stage 10:** Dockerfiles, `docker-compose` finalization, and a manual smoke checklist.

## License

[MIT](./LICENSE)
