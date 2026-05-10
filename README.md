# physio-portal

Aplicação web PT-BR single-user para uma fisioterapeuta gerenciar pacientes, sessões recorrentes, faturamento semanal/mensal e emitir relatórios mensais em PDF assinados. Roda localmente via `docker-compose up`.

> **Status:** projeto _greenfield_. Apenas o documento de design (`plan.md`) e este README existem — Stage 0 (fundação do monorepo) ainda não foi iniciado, então o repositório ainda **não é executável**.

## Funcionalidades planejadas

- Login da fisioterapeuta (single-user, JWT).
- CRUD de pacientes com link direto para WhatsApp.
- Schedule recorrente por paciente (dias da semana fixos) com geração automática de sessões.
- Marcação de sessão como **Realizada / Falta / Remarcada** — apenas `REALIZADA` fatura.
- Dashboard de totais por semana/mês (geral e por paciente).
- PDF mensal por paciente com assinatura em imagem e total em BRL.

## Stack

- **Monorepo:** npm workspaces (sem Turborepo/Nx).
- **Backend (`apps/api`):** Express + `pg` (sem ORM) + tsyringe (DI) + Zod + JWT + pdfkit.
- **Frontend (`apps/web`):** React + Vite + TypeScript + React Query + react-router + Tailwind + react-hook-form.
- **Contratos compartilhados (`packages/contracts`):** schemas Zod como única fonte de verdade para tipos e validação.
- **Banco:** PostgreSQL com migrations SQL manuais (pares `up.sql` / `down.sql`) e runner próprio.
- **Testes:** Vitest + supertest no backend (Postgres real via Testcontainers), Vitest + Testing Library + MSW no frontend. **100% de cobertura** (linhas, branches, funções, statements) é obrigatório.

Ver `plan.md` para schema, rotas REST, regras de DI e roadmap completo (Stages 0–10).

## Comandos (a serem implementados)

Os scripts abaixo serão wireados conforme cada stage avança. Hoje **nenhum existe**.

| Comando | Função |
| --- | --- |
| `npm run dev` (raiz) | Sobe API (`:3000`) e Web (`:5173`) |
| `npm test` (raiz) | Backend + frontend com gate de 100% de cobertura |
| `npm run lint` / `npm run typecheck` | Checks estáticos em todos os workspaces |
| `npm run db:migrate -w apps/api` | Aplica migrations pendentes |
| `npm run db:migrate:down -w apps/api` | Reverte a última migration aplicada |
| `npm run db:migrate:status -w apps/api` | Mostra aplicadas vs pendentes |
| `npm run db:seed -w apps/api` | Cria a fisioterapeuta a partir das envs |
| `docker-compose up` | Sobe postgres + api + web para uso local |

## Roadmap

`plan.md` define **Stage 0 … Stage 10**. Cada stage é independentemente mergeável, deixa o app utilizável até seu escopo e precisa terminar com 100% de cobertura antes do próximo:

- **Stages 0–1:** bootstrap do monorepo, runner de migrations, auth, migration `0001_init`.
- **Stages 2–5:** verticais da API — pacientes → schedule + geração de sessões → status + faturamento → PDF mensal.
- **Stages 6–9:** verticais do frontend espelhando a ordem da API.
- **Stage 10:** Dockerfiles, finalização do `docker-compose` e checklist de smoke manual.

## Licença

[MIT](./LICENSE)
