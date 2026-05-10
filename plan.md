# Plano: Portal de Pacientes para Fisioterapeuta

## Context

A fisioterapeuta precisa de uma aplicação web (PT-BR) para organizar pacientes, registrar atendimentos recorrentes, calcular faturamento semanal/mensal e emitir um relatório mensal por paciente em PDF assinado. Hoje provavelmente faz isso em planilhas/papel, o que torna controle de faturamento e geração de relatórios trabalhoso.

**Resultado esperado:** monorepo executável localmente via `docker-compose up` que entrega:
- Login da fisioterapeuta
- CRUD de pacientes (com link direto para WhatsApp)
- Schedule recorrente por paciente (dias da semana fixos) com geração automática de sessões
- Marcação de sessão como **Realizada / Falta / Remarcada** (apenas Realizada fatura)
- Dashboard com totais por semana/mês (geral e por paciente)
- Geração de PDF mensal por paciente com assinatura da fisio (imagem) e valor total em BRL
- Cobertura de testes 100% (backend + frontend), seguindo SOLID / DI

## Decisões já confirmadas (da fase de perguntas)

| Tema | Decisão |
|---|---|
| Usuários | Single-user (apenas a fisioterapeuta) |
| Agenda | Schedule recorrente + sessões geradas; status Realizada/Falta/Remarcada |
| Faltas | Não faturam — apenas Realizadas entram no total |
| Relatório | PDF gerado no backend com assinatura em imagem |
| Monorepo | npm workspaces (sem Turborepo) |
| Auth | Email + senha → JWT; uma usuária seedada |
| Deploy | Local via Docker Compose |
| Testes | 100% rigoroso em backend e frontend |

---

## Estrutura do monorepo

```
physio-portal/
├── package.json                    # workspaces: ["apps/*", "packages/*"]
├── docker-compose.yml              # postgres + api + web
├── tsconfig.base.json
├── .editorconfig / .prettierrc / .eslintrc.cjs
├── apps/
│   ├── api/                        # Express + pg + DI
│   │   ├── src/
│   │   │   ├── container.ts        # composition root (DI)
│   │   │   ├── server.ts           # bootstrap
│   │   │   ├── db/
│   │   │   │   ├── pool.ts         # pg.Pool factory
│   │   │   │   ├── migrate.ts      # runner: aplica/reverte migrations
│   │   │   │   ├── seed.ts         # seed inicial da fisio
│   │   │   │   └── migrations/     # SQL puro, pares up/down
│   │   │   │       ├── 0001_init.up.sql
│   │   │   │       ├── 0001_init.down.sql
│   │   │   │       └── ...
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── patients/
│   │   │   │   ├── schedule/
│   │   │   │   ├── sessions/
│   │   │   │   ├── reports/
│   │   │   │   └── pdf/
│   │   │   ├── shared/
│   │   │   │   ├── http/           # Result types, error mapper
│   │   │   │   ├── middleware/     # auth, errorHandler, validate
│   │   │   │   └── pricing/        # cálculo BRL, semana/mês
│   │   │   └── infra/
│   │   │       └── pdf/            # pdfkit adapter
│   │   ├── tests/                  # vitest + supertest
│   │   └── Dockerfile
│   └── web/                        # React + Vite + TS + RQ
│       ├── src/
│       │   ├── main.tsx
│       │   ├── app/                # router, providers (RQ, auth)
│       │   ├── pages/
│       │   │   ├── Login/
│       │   │   ├── Pacientes/      # lista + form
│       │   │   ├── PacienteDetalhe/  # calendário + sessões
│       │   │   ├── Relatorios/     # dashboard geral
│       │   │   ├── RelatorioMensal/  # geração PDF
│       │   │   └── Configuracoes/  # upload assinatura, dados fisio
│       │   ├── components/
│       │   ├── hooks/              # useAuth, usePacientes, useSessoes…
│       │   └── api/                # client RQ, endpoints tipados
│       ├── tests/
│       └── Dockerfile
└── packages/
    └── contracts/                  # tipos compartilhados (DTOs Zod)
        └── src/
            ├── patient.ts
            ├── session.ts
            ├── report.ts
            └── auth.ts
```

`packages/contracts` exporta schemas **Zod** (única fonte de verdade para validação + tipos). Backend usa para `validate()` middleware; frontend infere tipos via `z.infer`.

---

## Modelo de dados (Postgres puro, SQL)

Tabelas criadas na migration inicial `0001_init`. Colunas em `snake_case`; mapeadas para `camelCase` na camada de repositório (row → entidade tipada). IDs como `uuid` gerados pelo banco (`gen_random_uuid()` via `pgcrypto`).

```sql
-- 0001_init.up.sql
create extension if not exists pgcrypto;

create table users (                       -- a fisioterapeuta (única)
  id             uuid primary key default gen_random_uuid(),
  email          text not null unique,
  password_hash  text not null,
  full_name      text not null,
  cref           text not null,            -- registro profissional
  signature_url  text,                     -- path para PNG da assinatura
  created_at     timestamptz not null default now()
);

create table patients (
  id                  uuid primary key default gen_random_uuid(),
  full_name           text not null,
  address             text not null,
  phone               text not null,        -- E.164 BR para link wa.me
  session_price_cents integer not null check (session_price_cents >= 0),  -- BRL em centavos
  notes               text,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

create table schedules (                   -- dias da semana recorrentes
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null unique references patients(id) on delete cascade,
  weekdays    integer[] not null,           -- 0..6 (Dom..Sáb)
  start_date  date not null,
  end_date    date
);

create type session_status as enum ('SCHEDULED', 'REALIZADA', 'FALTA', 'REMARCADA');

create table sessions (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references patients(id) on delete cascade,
  date        date not null,                -- dia do atendimento
  status      session_status not null default 'SCHEDULED',
  price_cents integer not null check (price_cents >= 0),  -- snapshot do preço
  note        text,
  unique (patient_id, date)
);

create index sessions_date_idx on sessions (date);
```

```sql
-- 0001_init.down.sql
drop index if exists sessions_date_idx;
drop table if exists sessions;
drop type  if exists session_status;
drop table if exists schedules;
drop table if exists patients;
drop table if exists users;
```

**Faturamento** = `SUM(price_cents) WHERE status = 'REALIZADA' AND date BETWEEN $1 AND $2` — falta/remarcada não somam (decisão confirmada).

---

## Migrations (manuais, up/down)

- Cada mudança de schema = nova migration com par `NNNN_<slug>.up.sql` / `NNNN_<slug>.down.sql` em `apps/api/src/db/migrations/`. Numeração sequencial zero-padded.
- Runner próprio em `apps/api/src/db/migrate.ts`, expondo subcomandos:
  - `npm run db:migrate -w apps/api` → aplica todas as migrations pendentes em ordem.
  - `npm run db:migrate:down -w apps/api` → reverte a última migration aplicada (executa o `.down.sql` correspondente).
  - `npm run db:migrate:status -w apps/api` → mostra aplicadas vs pendentes.
- O runner garante tabela de controle (criada na primeira execução, fora das migrations versionadas):
  ```sql
  create table if not exists _migrations (
    id         serial primary key,
    name       text not null unique,
    applied_at timestamptz not null default now()
  );
  ```
- Cada migration roda dentro de uma transação (`BEGIN … COMMIT`), insere a linha em `_migrations` ao final do `up` e remove ao final do `down`. Falha → rollback completo.
- **Regra:** migration já aplicada em qualquer ambiente nunca é editada — sempre criar nova (additive ou corretiva).

---

## API REST (resumo)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/login` | login → JWT |
| GET  | `/auth/me` | dados da fisio logada |
| PATCH | `/auth/me` | atualiza nome/CREF |
| POST | `/auth/me/signature` | upload PNG assinatura (multer) |
| GET  | `/patients` | lista (filtro `active`, busca por nome) |
| POST | `/patients` | cria |
| GET  | `/patients/:id` | detalhe |
| PATCH | `/patients/:id` | atualiza |
| DELETE | `/patients/:id` | inativa (soft delete via `active=false`) |
| PUT  | `/patients/:id/schedule` | define/atualiza schedule recorrente |
| POST | `/patients/:id/sessions/generate` | gera sessões SCHEDULED de um intervalo a partir do schedule |
| GET  | `/patients/:id/sessions?from=&to=` | lista sessões |
| PATCH | `/sessions/:id` | atualiza status (REALIZADA/FALTA/REMARCADA) |
| GET  | `/reports/summary?from=&to=` | totais gerais (mês/semana) |
| GET  | `/reports/patient/:id?from=&to=` | totais por paciente |
| GET  | `/reports/patient/:id/monthly.pdf?month=YYYY-MM` | PDF mensal assinado |

Tudo (exceto `/auth/login`) protegido por middleware JWT.

---

## SOLID / DI no backend

**Composition root** em `src/container.ts` usando **tsyringe** (decoradores TS). Cada módulo expõe:

- `XRepository` (interface) → `PgXRepository` (impl que recebe `pg.Pool` no construtor e executa queries parametrizadas)
- `XService` (lógica) recebe repositório por construtor
- `XController` recebe service por construtor

Exemplo:

```ts
// modules/sessions/SessionService.ts
@injectable()
export class SessionService {
  constructor(
    @inject('SessionRepository') private repo: SessionRepository,
    @inject('ScheduleRepository') private schedules: ScheduleRepository,
    @inject('Clock') private clock: Clock,        // abstração para testes
  ) {}
  generateForRange(patientId: string, from: Date, to: Date) { … }
  markStatus(id: string, status: SessionStatus) { … }
}
```

`Clock` injetado permite testar geração de sessões sem mocks de `Date`.
PDF e arquivos via interfaces `PdfRenderer` e `FileStorage` — implementações trocáveis.

---

## Frontend

- **Roteamento:** `react-router` v6 com guard `<RequireAuth>`.
- **Data fetching:** React Query 5 com `queryClient` no provider; chaves padronizadas (`['patients']`, `['sessions', patientId, range]`).
- **Forms:** `react-hook-form` + resolver Zod usando schemas de `packages/contracts`.
- **UI:** Tailwind CSS + componentes próprios (sem libs pesadas). Tabela de pacientes, calendário mensal simples para sessões (grid 7 colunas), modal de confirmação para marcar status. Strings PT-BR escritas direto no JSX (projeto monolíngue, sem camada de i18n).
- **Formato BRL:** `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
- **WhatsApp:** botão `https://wa.me/55${phoneDigits}` em PatientDetail.
- **PDF:** `<a href="/reports/patient/:id/monthly.pdf?month=…" target="_blank">` com header Authorization injetado via fetch+blob.

---

## Estratégia de testes (100% rigoroso)

### Backend
- **Vitest** + **supertest**. Coverage via `v8` provider, threshold 100% em `--coverage` (lines/branches/functions/statements).
- Repositórios testados contra Postgres real em test container (Testcontainers) — sem mocks do driver `pg` (regra: testes de integração não mockam DB).
- Services testados unitariamente com fakes in-memory das interfaces (nunca mockar `pg.Pool` / `pg.Client`).
- Migrations exercitadas no setup do Testcontainer: aplicar todas as `up.sql` e validar que cada `down.sql` reverte para o estado anterior (round-trip up → down → up).
- Geração de PDF testada por hash do PDF resultante e por extração de texto (`pdf-parse`).
- Cobertura excluindo apenas `server.ts`, `db/migrations/` (arquivos `.sql`) e arquivos de tipos.

### Frontend
- **Vitest** + **@testing-library/react** + **MSW** para interceptar HTTP.
- Cada hook, util, componente e page com testes. Threshold 100%.

### CI local
- Script `npm test` na raiz roda backend + frontend; falha se coverage < 100%.

---

## Stages incrementais

Cada stage é mergeável e deixa o app utilizável até onde foi entregue. Testes 100% obrigatórios ao final de cada stage.

### Stage 0 — Fundação do monorepo
- `package.json` raiz com workspaces, scripts (`dev`, `build`, `test`, `lint`, `typecheck`).
- Configs base: TS, ESLint, Prettier, EditorConfig.
- `packages/contracts` vazio com Zod instalado.
- `docker-compose.yml` com serviço `postgres` + `api` + `web` (placeholders).
- Esqueleto do runner de migrations em `apps/api/src/db/migrate.ts` (lê pasta `migrations/`, controla tabela `_migrations`, suporta `up` / `down` / `status`).
- README PT-BR de setup.

### Stage 1 — API: bootstrap + auth + DI
- Express + tsyringe + driver `pg` (Pool injetável) + middleware de erro.
- Migration `0001_init` criando todas as tabelas (users, patients, schedules, sessions + enum `session_status`).
- Seed da fisioterapeuta em `apps/api/src/db/seed.ts` (email/senha via env, idempotente).
- `POST /auth/login`, `GET /auth/me`, JWT middleware.
- Upload de assinatura (`POST /auth/me/signature`) com multer salvando em `apps/api/uploads/`.
- Testes 100% incluindo round-trip up/down da migration.

### Stage 2 — API: pacientes (CRUD)
- Schemas Zod em `packages/contracts/src/patient.ts`.
- Repository + Service + Controller para Patient.
- Soft delete via `active`.
- Validação de telefone BR (E.164).
- Testes 100%.

### Stage 3 — API: schedule + geração de sessões
- `PUT /patients/:id/schedule`.
- `POST /patients/:id/sessions/generate` recebe `{from, to}` e cria `SessionStatus.SCHEDULED` para cada weekday no intervalo (idempotente via unique `[patientId, date]`).
- `Clock` abstrato injetado.
- Testes 100% incluindo edge cases (DST, mês com 5 segundas, schedule encerrado).

### Stage 4 — API: marcar sessões + cálculo de faturamento
- `PATCH /sessions/:id` com transição de status validada.
- `GET /reports/summary` e `GET /reports/patient/:id` com agregações por semana/mês.
- Módulo `shared/pricing/` puro (testável sem DB).
- Testes 100%.

### Stage 5 — API: PDF mensal assinado
- Adapter `PdfRenderer` com pdfkit (sem Chromium → mais leve em Docker).
- Layout: cabeçalho com nome/CREF da fisio, dados do paciente, tabela de sessões realizadas no mês, total em BRL formatado, imagem da assinatura no rodapé, data de emissão.
- `GET /reports/patient/:id/monthly.pdf?month=YYYY-MM` retorna `application/pdf`.
- Testes: snapshot do texto extraído, validação de presença da assinatura.

### Stage 6 — Frontend: bootstrap + auth + layout
- Vite + React + TS + Tailwind + RQ + react-router.
- `AuthProvider` com token em `localStorage` + interceptor.
- Página `Login` + `RequireAuth` guard.
- Layout com sidebar (Pacientes / Relatórios / Configurações) em PT-BR.
- Testes 100%.

### Stage 7 — Frontend: pacientes (lista + form)
- Lista com busca, filtro ativo/inativo.
- Form de criar/editar (react-hook-form + Zod do `contracts`).
- Botão WhatsApp em cada card.
- Testes 100% (MSW).

### Stage 8 — Frontend: detalhe do paciente + calendário de sessões
- Tela do paciente com schedule recorrente (selector de dias da semana).
- Calendário mensal: cada célula = sessão (cor por status). Click → modal para marcar Realizada/Falta/Remarcada.
- Botão "Gerar sessões do mês" → chama endpoint generate.
- Cálculos de semana/mês visíveis no topo.
- Testes 100%.

### Stage 9 — Frontend: relatórios + PDF mensal
- Dashboard `Relatorios`: total do mês, total da semana, ranking de pacientes.
- Tela `RelatorioMensal`: seleciona paciente + mês → preview + botão "Baixar PDF" (fetch com Bearer, blob download).
- Tela `Configuracoes`: edita nome/CREF, upload de assinatura.
- Testes 100%.

### Stage 10 — Docker Compose + entrega
- Dockerfiles api/web finalizados (multi-stage).
- `docker-compose up` sobe tudo; volume persistente para postgres e uploads.
- Script de seed inicial documentado no README.
- Checklist de smoke manual (login → paciente → schedule → marcar sessões → PDF) descrito no README.

---

## Arquivos críticos a serem criados/modificados

- `package.json` (raiz, workspaces)
- `docker-compose.yml`
- `apps/api/src/db/pool.ts` (factory do `pg.Pool`)
- `apps/api/src/db/migrate.ts` (runner manual up/down + tabela `_migrations`)
- `apps/api/src/db/migrations/0001_init.up.sql` + `0001_init.down.sql`
- `apps/api/src/db/seed.ts`
- `apps/api/src/container.ts` (composition root DI)
- `apps/api/src/server.ts`
- `apps/api/src/modules/{auth,patients,schedule,sessions,reports,pdf}/`
- `apps/api/src/shared/pricing/billing.ts` (cálculo puro testável)
- `apps/api/src/infra/pdf/PdfKitRenderer.ts`
- `apps/web/src/app/router.tsx`
- `apps/web/src/api/client.ts` (axios + interceptor)
- `apps/web/src/pages/PacienteDetalhe/Calendario.tsx`
- `apps/web/src/pages/RelatorioMensal/index.tsx`
- `packages/contracts/src/{patient,session,report,auth}.ts`

Não há código existente a reutilizar — projeto é greenfield.

---

## Verificação end-to-end

1. `docker-compose up -d postgres` e `npm install` na raiz.
2. `npm run db:migrate -w apps/api && npm run db:seed -w apps/api` (cria fisio com email/senha do `.env`).
3. `npm run dev` na raiz sobe API (`:3000`) e Web (`:5173`).
4. Fluxo manual:
   - Login com a fisio seedada.
   - Em **Configurações**, faz upload da assinatura PNG.
   - Cria paciente "Maria Silva", preço R$ 120, telefone, endereço.
   - Define schedule: Seg/Qua/Sex.
   - Gera sessões do mês corrente.
   - Marca 4 sessões como Realizada, 1 como Falta.
   - Em **Relatórios**, verifica total = 4 × R$ 120 = R$ 480.
   - Gera PDF mensal e confere assinatura, valor e tabela.
   - Clica em WhatsApp e abre `wa.me/55…` no navegador.
5. `npm test` na raiz: backend e frontend devem passar com **100% de cobertura** (lines, branches, functions, statements).
