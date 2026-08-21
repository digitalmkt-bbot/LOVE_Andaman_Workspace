# Rewrite — plan of record

Target: turn `allotment_v2.html` (83,651 lines, one file, blob-oriented persistence) into a
**React SPA + centralized Fastify API + relational Postgres**, migrating **booking first** by
strangler-fig.

Baseline commit: `094dde1` on `refactor/booking-v2-migration`. Deploy branch already separated at
`lk-inbox`.

---

## 1. Decisions (confirmed 2026-08-20)

| # | Decision | Consequence |
|---|---|---|
| D1 | **Strangler-fig, booking first** | New API + React run alongside the live monolith. Booking moves first; the monolith keeps everything else and reads booking through an adapter. Nothing is big-banged. |
| D2 | **Migrate live production data** into the new FK schema | The existing `operation_schemas` tables are the source of truth. Reshaping migrations with backfill + verification, not a greenfield import. |
| D3 | **Vite React SPA + Fastify API** | The API is the *only* data boundary. Supersedes the Next.js direction in `LAM-76-nextjs-shell` / `LAM-79-nextjs-app-router-adr` — close those with a note pointing here. |
| D4 | **Four consumer classes** | Ops app (staff), B2C website, ERP/accounting, agent/partner portal. Every one of them goes through the same API. |
| D5 | **B2C already writes to the same database, in its own schema** | Confirmed by the `P0-01` dump. `love_kingdom` (39 tables) is a live second writer alongside `operation_schemas` (133 tables). The API must span schemas from day one — see §2.1. |

### D5 in numbers — measured, not assumed

The `P0-01` dump (2026-08-20, server PostgreSQL 18.4) found **four** schemas and **184 tables**,
not the one schema / ~103 tables the docs assumed:

| Schema | Tables | With PK | With any FK | Rows | Role |
|---|---:|---:|---:|---:|---|
| `operation_schemas` | 133 | 120 | 52 | 50,802 | the ops app |
| `love_kingdom` | 39 | 39 | 24 | 1,641 | **B2C / ERP — the second writer** |
| `allotment` | 4 | 3 | 0 | 3,075 | holds live booking **attachments** (3,038 rows) |
| `public` | 8 | 8 | 0 | 1,314 | mostly empty duplicates + one report table |

**Booking data is spread across three schemas with no enforced relationship between any of them.**
The B2C↔ops link is a *string prefix* (`b2c_<lkId>[_<n>]`), not a key — and it already leaks:
**22 ops `b2c_` bookings have no `love_kingdom` parent**, and **118 `allotment.attachments` rows
point at bookings that do not exist**. Full detail in `db/baseline/REPORT.md` §7.

Two consequences the task list now reflects:

1. Adding foreign keys is **blocked on orphan triage** — the constraints will simply fail otherwise
   (`P0-09`).
2. `love_kingdom` is **better modelled than `operation_schemas`** (39/39 PKs vs 120/133). When the
   two models disagree, prefer love_kingdom's shapes rather than porting the ops app's.

### What D4 forces

This is the single most important architectural consequence and it drives half the task list.

> **Every invariant currently enforced in browser JavaScript must move into the API or the database.**

Today the anti-overbook guard, the seat-lock violation block, the licence-capacity block and the
approval routing all live in `bkV2CommitBooking` in the browser. With four writers, browser-side
guards are decoration — B2C or the agent portal would happily oversell a boat. The guards become
API-side transactional checks (`BK-06`) backed by DB constraints.

---

## 2. Target architecture

```
apps/
  api/            Fastify + TypeScript. The ONLY thing that talks to Postgres.
  ops-web/        Vite + React + TypeScript. The staff app. Replaces allotment_v2.html.
packages/
  contracts/      zod schemas + generated TS types + OpenAPI. Shared by api and every client.
  db/             migrations, seed, typed query layer
  pricing/        rate-type -> price calculation, called by the booking write path
```

```
 ops-web ─┐
 B2C     ─┼─► Fastify API ─► Postgres (relational, FK-enforced)
 ERP     ─┤      ▲
 agents  ─┘      └── monolith adapter (temporary, strangler only)
```

### 2.1 Schema strategy (added after `P0-01`)

The API spans schemas. It does **not** merge them prematurely.

| Schema | Phase 1 treatment |
|---|---|
| `operation_schemas` | Booking tables get reshaped in place with real PKs/FKs. The rest is untouched until its own phase. |
| `love_kingdom` | **Read-only in Phase 1.** B2C keeps writing it. The API reads it to resolve the `b2c_` link. Merging the two booking models is Phase 7, not now. |
| `allotment` | `attachments` gets a real FK to the booking table and moves under booking ownership (`BK-01`). The rest is dead weight pending `P0-08`. |
| `public` | Inventory only. Do not build on it until `P0-08` says what it is. |

Cross-schema foreign keys are legal in Postgres and are the right tool here — a booking attachment
in `allotment` can reference `operation_schemas.sb_bookings` today, before any table moves.

**During the strangle**, `allotment_v2.html` stays deployed and keeps owning fleet, boat ops, vans
and accounting. Its booking view is switched off and it reads booking data through a thin adapter
(`P0-07`). The adapter is deliberately temporary and gets deleted at the end of Phase 2.

---

## 3. Why booking first is the right seam (and where it hurts)

**For:** booking is the domain with the most documented correctness bugs (doc 01 §7), the most
consumers, and the clearest aggregate boundary. Its data model is already written down accurately in
`docs/booking.model.ts` and `docs/workflows/01-booking-lifecycle.md`.

**Against — the two seams that will hurt:**

1. **`bk.ops` (boat/van assignment).** Booking *owns* the `ops` container but Boat Operations
   (doc 03) and Vans (doc 04) are the only things that *read* it operationally. Those stay in the
   monolith at first, so the adapter has to expose `ops` read/write. This is the riskiest part of the
   whole phase — `BK-15` exists solely for it.
2. **Pricing.** Produced by rate types (doc 02), frozen by booking (doc 01), consumed by accounting
   (doc 06) — three owners for one number. Booking cannot create a priced booking without rate
   types, so a slim read-only rate-type API (`RT-01`) is pulled forward as a booking dependency.

---

## 4. Structural bug classes that this rewrite deletes for free

Worth stating up front, because they justify the schema work and should not be re-implemented:

| Bug class | Today | After |
|---|---|---|
| **Edit-preserve** — `bkV2CommitBooking` rebuilds the booking from scratch, so any field not manually carried over in the `if(editing)` block is destroyed | 14 fields must be hand-copied; losing `ops` silently wiped every boat/van assignment | `PATCH` updates named columns. Structurally impossible. |
| **Lock counter drift** — `used` vs the real `lockDraws` | `bkV2LockAudit` / `LockFixUsed` / `LockFixTree` exist to repair the counter | `used` becomes a derived view over `booking_trip_lock_draw`. The repair functions are deleted, not ported. |
| **Empty-array ambiguity** — the relational backend drops empty arrays, so the edit form crashes on `undefined.forEach` | re-hydration hack at `:77833` | Child tables. Zero rows is a legitimate state. |
| **Four-place field registration** — a new persisted field needs mapper + REST index + load condition + save path or it vanishes | doc 07 §4, "most-commonly-got-wrong procedure in the repo" | One migration + one zod schema. |
| **Whole-blob read-modify-write** — every save re-serializes ~6 MB | 4 different write paths | Per-row writes in a transaction. |

---

## 5. Definition of Done (every task)

1. Migrations are forward-only and re-runnable; `migrate status` is clean.
2. Change is covered by a test that **fails without it**.
3. For anything replacing monolith behaviour: a **parity test** against the P0-06 fixtures proving
   the new code produces the same answer as the old code — or an explicit, documented deviation
   (see `BK-10`, where deviating is the point).
4. `pnpm typecheck && pnpm lint && pnpm test` green in CI.
5. OpenAPI regenerated and committed if the API surface changed.
6. The relevant doc in `docs/workflows/` is updated in the same PR. Those docs are the only
   surviving history — `CHANGELOG.md` does not exist.

---

## 6. How to dispatch a task to a subagent

Each task in `TASKS.md` is written to be self-contained. To run one:

```
Read allotment_v2/docs/rewrite/README.md for context, then execute task <ID>
from allotment_v2/docs/rewrite/TASKS.md exactly as specified.
Do not start any task listed under "Depends on" that is not yet marked done.
Report: files changed, tests added, and any spec assumption you had to make.
```

Tasks marked **`[serial]`** must not run concurrently with anything touching the same tables.
Tasks marked **`[parallel-safe]`** can be fanned out together.

---

## 7. Relationship to the existing backlog

`allotment_v2/docs/MODERNIZATION_BACKLOG.md` (E1–E14, 73 Jira rows) targets **fixing the monolith in
place**. Under D1 it is not obsolete, but it is re-scoped:

| Existing epic | Status under this plan |
|---|---|
| E1 Restore a Working Build | **Still required** — `server.js` does not boot at `094dde1`; the monolith must run for the strangler to have something to strangle. Do `S1-01` before anything else. |
| E2 Stop Data Loss, E5 Money Correctness, E7 Runtime/Timezone | **Fold into `BK-10`** for booking; keep as monolith fixes for fleet/accounting until those domains migrate. |
| E3 Regression Safety Net | **Becomes `P0-06`** — characterization fixtures are the migration oracle. |
| E4 Persistence Hardening, E11 Modularize `allotment_v2.html`, E14 Performance | **Drop.** The rewrite deletes these problems; spending sprints modularizing a file we are replacing is waste. |
| E6, E8, E9, E10, E12, E13 | **Keep as monolith maintenance** for the domains still living there. |

---

## 8. Open questions — answer before Phase 0 completes

These do not block writing the tasks, but they block executing some of them.

1. **Production DB access.** Who has read-only credentials for prod Postgres, and can `P0-01` run
   against it? Known hazard from prior work: prod and `db/migrations/003` disagree in both
   directions — build view definitions from `pg_get_viewdef`, never from the repo file.
2. **Does B2C write to this database today, directly?** Doc 01 says bookings with `id` starting
   `b2c_` are "owned by the B2C source" with a `b2cOverride[]` column list. If B2C has its own
   writer, `BK-06` has to account for a second live writer during the strangle.
3. **Team size and target date.** No sprint sizing in this doc for that reason.
4. **Environments.** Is there a staging Postgres, or only prod? `BK-04` and `BK-16` need a prod
   clone to rehearse against.
5. **`os-backend/` fate.** It still exists at repo root and `server.js:34-35` requires it, but
   `db/migrations/` is deleted. Restore it for the monolith (E1) and delete it at end of Phase 2?
