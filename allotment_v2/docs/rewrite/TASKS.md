# Rewrite tasks — Phase 0 (foundation) + Phase 1 (booking)

Read `README.md` first. Every task is written to be handed to a subagent as-is.

**Legend** — `[serial]` must not run concurrently with tasks touching the same tables ·
`[parallel-safe]` can be fanned out · **Est** is rough working days for one developer.

**Status key:** `☐ todo` · `◐ in progress` · `☑ done` · `⊘ blocked`

---

## Sequencing changes (2026-08-21)

Goal: reach a working system sooner. The migration is deferred, not dropped.

| Task | Was | Now | Why |
|---|---|---|---|
| `BK-04` data migration | Sprint 4 | **Sprint 8** | **Nothing depends on it.** It appears in no other task's `Depends on` — only in `BK-16`'s "everything above". Development runs on `P0-06` fixtures, which is already how `BK-03` parity is specified. |
| `P0-09` orphan triage | unscheduled | **Sprint 8** | Exists only to make `BK-04`'s FKs apply. Travels with it; stops gating Sprint 3. |
| `BK-09` pricing | Sprint 5 | **Sprint 3** | Depends only on `RT-01`, is `[parallel-safe]`, and is pure functions with no DB access. |

**The cost of this, stated plainly:** `BK-04` is where you find out production data does not fit the
model. Deferring it moves that discovery to cutover week, on top of a schema already built. The
mitigation is entirely `P0-06` — the fixtures must be a real anonymized production slice covering the
awkward shapes listed in that task. Under-invest there and this trade turns bad.

**Scoping note on `P0-09`:** `BK-01` adds foreign keys on ~8 reference paths (agent, rate_type, route,
charter_boat, boat/van, pickup_area, attachment→booking, booking_b2c_link). The other ~118 of the 126
unenforced columns belong to fleet, accounting and pier and get no constraint until Phases 5, 6 and 3.
The gating triage is 8 paths, not 126. Run the full read-only scan early anyway — it gates nothing and
tells you what is quietly broken.

Sprint assignments live in Jira as `sprint-N` **labels**: the project has no Sprint field
(`customfield_10020` is null on every issue), so the `Sprint` column in `jira-import.csv` never landed.

---

# Phase 0 · Foundation

Nothing in Phase 1 can start until `P0-01`, `P0-02`, `P0-03`, `P0-05` are done.
**All four are done as of 2026-08-21** — Phase 1 is unblocked.

---

## ☐ P0-00 · Restore the monolith build `[serial]` · Est 0.5

**Why.** The strangler needs a running monolith. `server.js:34-35` unconditionally requires
`./os-backend/src/mapping/os_repo.js`; commit `094dde1` deleted that tree (83 files). The require is
at module top level so it fires in blob mode too, not only under `DATA_BACKEND=relational`.

**Do.**
1. `git checkout HEAD~1 -- os-backend db/migrations`
2. Verify: `node -e "require('./server.js')"` exits 0.
3. Commit with a note that this is life support for the strangle, deleted at end of Phase 2.

**Acceptance.** Clean checkout → `npm start` → app serves and `/api/load` returns data.
**Depends on.** —
**Note.** This is `S1-01` from the existing `MODERNIZATION_BACKLOG.md`. Do not re-derive it.

---

## ☑ P0-01 · Capture the production schema as the real baseline `[serial]` · Est 2 — **DONE 2026-08-20**

**Delivered.** `db/baseline/` contains `operation_schemas_20260820.sql`, `love_kingdom_20260820.sql`,
`allotment_20260820.sql`, `public_20260820.sql` (pg_dump 18, `--schema-only --no-owner
--no-privileges`), plus `inventory.json` (428 KB) and `REPORT.md`.

**Headline results.** Four schemas, 184 tables, 56,832 rows. 170/184 have a PK; only 76/184 have any
FK; 14 have neither; 126 columns look like foreign keys but are unenforced. No enum types exist
anywhere — every status column is free text. Full cross-schema analysis in `REPORT.md` §7.

**Tooling note for anyone re-running this.** The server is **PostgreSQL 18.4**; `pg_dump` 17 aborts
with a version mismatch. Use `/c/Program Files/PostgreSQL/18/bin/pg_dump`.

<details><summary>Original spec</summary>

**Why.** `db/migrations/` was deleted and the repo's copies have drifted from production **in both
directions** — a previously-confirmed hazard on `v_seat_availability`. Any schema work built on the
repo files will be built on a lie. There is no trustworthy written description of the current
~103-table schema.

**Do.**
1. Connect to production Postgres **read-only**.
2. Dump full DDL of the `operation_schemas` schema: tables, columns, types, nullability, defaults,
   indexes, constraints, sequences.
3. Dump every view with `pg_get_viewdef(oid, true)` — **not** from any repo `.sql` file.
4. Commit as `db/baseline/schema_<YYYYMMDD>.sql`.
5. Emit `db/baseline/inventory.json`: for each table → columns, PK, FKs, indexes, approximate row
   count.
6. Emit `db/baseline/REPORT.md` answering: which tables have a PRIMARY KEY, which have any FOREIGN
   KEY, which have neither, and which columns look like foreign keys by name but are not enforced.

**Acceptance.**
- The dump restores into an empty Postgres without error.
- `REPORT.md` accounts for every table in `inventory.json`.
- A diff of the dump against `database_migration/operation_schemas_model.json` is committed as
  evidence of drift (that file is known to be an older, different artefact — do not treat it as truth).

**Don't.** Do not build from `db/migrations/`, `database_migration/*.json`, or `SYSTEM_MAP.md`.
**Depends on.** — (needs prod credentials — see README §8.1)

</details>

---

## ☐ P0-08 · Cross-schema ownership map and the B2C sync contract `[serial]` · Est 3 ⚠ **new, from P0-01**

**Why.** `P0-01` found booking data living in **three** schemas with no enforced relationship. The
ops↔B2C link is a string prefix (`b2c_<lkId>[_<n>]`) that nothing validates, and it already leaks in
both directions. Nothing in Phase 1 can be modelled correctly until this is written down.

**Do.**
1. For all four schemas, record per table: owner system, live/dead, and whether any other schema
   references it. Deliver `db/baseline/OWNERSHIP.md`.
2. Document the **B2C sync contract** precisely: who writes `love_kingdom.bookings`, who writes the
   `b2c_` rows in `operation_schemas.sb_bookings`, what triggers the fan-out into `_1`/`_4` suffixed
   rows, and which side wins on conflict. Cross-check against the app's `BKV2_B2C_OWN` field map and
   `bk.b2cOverride[]`, which already encode an ownership split.
3. Decide and record: does `love_kingdom.bookings` become the same entity as
   `operation_schemas.sb_bookings` in the target model, or do they stay distinct with an explicit
   link table? **Recommendation: distinct + a real link table** — they have genuinely different
   shapes (love_kingdom is hotel-package oriented with `booking_items`, `hotels`, `room_types`).
4. Classify `public` and `allotment`: what is live, what is abandoned scaffolding.

**Acceptance.** `OWNERSHIP.md` accounts for all 184 tables. The B2C sync contract is specific enough
that `BK-06` can state which writer wins. No table is left "unknown".
**Depends on.** `P0-01` ☑

---

## ☐ P0-09 · Orphan triage before any FK can be added `[serial]` · Est 2 ⚠ **new, from P0-01**

**Why.** Adding a foreign key to data that already violates it **fails**. These are the known
violations; there are almost certainly more behind the 126 unenforced reference columns.

| Known orphan set | Count |
|---|---:|
| `allotment.attachments` → no `sb_bookings` row | 118 |
| ops `b2c_` bookings → no `love_kingdom` parent | 22 |
| `love_kingdom` bookings never synced to ops | 1 |

**Do.**
1. Write a read-only orphan scanner covering **all 126** unenforced reference columns from
   `inventory.json`, not just the three known sets. Emit `db/baseline/ORPHANS.md`: column, target
   table, orphan count, sample offending values.
2. For each orphan set, propose a disposition — **backfill / relink / soft-delete / accept and make
   the column nullable-with-no-FK**. Do not delete anything.
3. Land the dispositions as a migration that runs **before** the FK-adding migrations.

**Acceptance.** Scanner is re-runnable and read-only. Every one of the 126 columns has a disposition
recorded. Running the FK migrations after the disposition migration succeeds on a prod clone.

**Don't.** Do not delete production rows to make a constraint pass. An orphan is evidence of a real
process gap and someone needs to see it before it disappears.
**Depends on.** `P0-01` ☑, `P0-08`

---

## ☐ P0-02 · Monorepo scaffold `[serial]` · Est 1.5

**Do.** pnpm workspace on `lk-inbox`:

```
apps/api          Fastify 5 + TypeScript, tsx dev, node build
apps/ops-web      Vite + React 19 + TypeScript
packages/contracts  zod schemas, inferred types, OpenAPI emit
packages/db         migrations + typed query layer
packages/pricing    (empty stub for now — BK-09 fills it)
```

TypeScript `strict: true`, ESLint, Prettier, Vitest. Root scripts: `dev`, `build`, `typecheck`,
`lint`, `test`.

**Acceptance.** `pnpm dev` runs API on `:3001` and web on `:5173` concurrently; `pnpm build` clean;
GitHub Actions runs `typecheck + lint + test` on PR.
**Depends on.** —

---

## ☐ P0-03 · Fastify skeleton + cross-cutting concerns `[serial]` · Est 2

**Do.**
- Env config validated by zod at boot; fail fast on missing vars.
- `pino` logging with a request id on every line.
- One error envelope for all failures: `{ error: { code, message, details?, requestId } }`.
- Request/response validation from `packages/contracts` zod schemas.
- OpenAPI 3.1 generated from those schemas, served at `/docs`.
- `/healthz` (process up) and `/readyz` (DB reachable).
- CORS allow-list driven by config, one origin per consumer class.

**Acceptance.** A request failing validation returns the standard envelope with HTTP 400 and a
`requestId` that appears in the logs. `/docs` renders. Contract test asserts the envelope shape.
**Depends on.** `P0-02`

---

## ☐ P0-04 · AuthN/AuthZ for four consumer classes `[serial]` · Est 3

**Why.** D4. Four writers, three of them outside the building.

**Do.** Implement four principal types and a single authorization middleware:

| Principal | Credential | Scope |
|---|---|---|
| Staff (ops app) | user JWT | area permissions mirroring today's `laCanEditArea`: `operations`, `accounting`, `sales`, `fleet` |
| B2C service | service token | availability read, booking create. **No** approve, no cancel-with-charge, no price override |
| ERP service | service token | booking + pricing read, ledger write |
| Agent portal | per-agent token | **row-scoped**: only rows where `booking.agent_id = token.agentId` |

Row scoping must be enforced in the query layer, not by filtering after fetch.

**Acceptance.**
- Test: agent token A requesting agent B's booking gets 404 (not 403 — do not leak existence).
- Test: B2C token calling `POST /bookings/:id/approve` gets 403.
- Test: a staff user without `operations` cannot `PATCH` a booking.

**Depends on.** `P0-03`

---

## ☐ P0-05 · Migration tooling + CI database `[parallel-safe]` · Est 1

**Do.** Forward-only, checksummed migration runner in `packages/db`. `migrate up|status|new`.
No auto-down in production. CI spins a throwaway Postgres, applies `db/baseline/` then all
migrations, and runs the test suite against it.

**Acceptance.** CI job goes from empty Postgres → migrated → tests green. A tampered migration
checksum fails the run.
**Depends on.** `P0-02` (and `P0-01` for the baseline, but tooling can be built in parallel)

---

## ☐ P0-06 · Characterization fixtures from production `[parallel-safe]` · Est 3

**Why.** These fixtures are the **oracle** for every parity test in Phase 1. Without them, "the new
API behaves like the old app" is an unverifiable claim.

**Do.** Export an anonymized slice of real production data (scrub names, phones, emails, passport
numbers — keep structure, dates, money and IDs intact). The set **must** include at least one of
each:

- multi-trip booking · charter trip · OVN pair (outbound + `ovnLeg` return)
- booking drawing seat locks (parent lock, sub-group lock, month lock with rolling release)
- every status: `quote`, `pending_foc`, `pending_approval`, `confirmed`, `cancelled`,
  `cancelled_weather`, `rejected`, `completed`
- `pending_approval` held for over-capacity (does **not** hold seats) and one held for discount (**does**)
- partially-cancelled booking · rescheduled booking · weather-resolved booking
- B2C-owned booking with a non-empty `b2cOverride[]`
- legacy `schemaVer !== 2` booking
- a booking with `ops` boat + van + van group assigned

Commit as `packages/db/fixtures/`. Include a `MANIFEST.md` mapping each fixture to the doc-01
behaviour it exercises.

**Acceptance.** Every status in the enum and every branch flagged in doc 01 §7 has at least one
fixture. A script asserts coverage and fails if a status is unrepresented.
**Depends on.** `P0-01`

---

## ☐ P0-07 · ADR: the strangler bridge for booking `[serial]` · Est 1

**Why.** The monolith keeps fleet, boat ops and vans. Those read `bk.ops`. Something has to give
them booking data once the API owns it.

**Do.** Write `docs/rewrite/adr/001-strangler-bridge.md` evaluating:
- (a) API is source of truth; monolith's booking store is replaced by a read-through adapter
- (b) dual-write with reconciliation
- (c) monolith booking view disabled, users redirected to the new UI

**Recommended: (c) + (a).** Disable the monolith's booking view, redirect to the React app, and give
the monolith a read-through adapter for the `bk.ops` and manifest reads that boat/van assignment
needs. Reject (b) — dual-write across a blob store and a relational store with no shared transaction
will diverge, and reconciliation is a permanent tax.

The ADR must specify the adapter's exact contract and its deletion criteria.

**Acceptance.** ADR committed, decision explicit, adapter contract written down.
**Depends on.** —

---

## ☐ RT-01 · Rate types read-only API (pulled forward) `[parallel-safe]` · Est 3

**Why.** Booking cannot price a trip without rate types. This is the minimum slice of doc 02 needed
to unblock `BK-09`. Do **not** migrate the whole sales domain here.

**Do.** Relational tables for `rate_type`, `rate_type_seat_rate` (route × zone × pax type),
`rate_type_route_validity`, `rate_type_route_bundle`, `rate_type_charter_rate`, `rate_type_addon`.
Migration from the existing store. `GET /v1/rate-types`, `GET /v1/rate-types/:id`.
Normalize the per-route longtail shape at migration time (`_rtNormalizeLongtail` logic) so the old
flat shape never reaches the new schema.

**Acceptance.** For every fixture booking in `P0-06`, the rate type it references resolves and
returns seat rates matching what the monolith read.
**Depends on.** `P0-01`, `P0-05`

---

# Phase 1 · Booking

---

## ☐ BK-01 · Relational model for the booking aggregate `[serial]` · Est 5

**Why.** This schema is the foundation of everything else in Phase 1. Get it wrong and 15 tasks
inherit the mistake.

**Source of truth for the model:** `allotment_v2/docs/booking.model.ts` (accurate) and
`docs/workflows/01-booking-lifecycle.md` §4. **Not** `docs/BOOKING.md` (stale, line numbers ~35k off).

**Do.** Design and migrate:

| Table | Notes |
|---|---|
| `booking` | one row per booking. `id` keeps the `BK-YYMMNNNN-XXXX` business code as a natural key **plus** a surrogate `uuid` PK |
| `booking_trip` | `(booking_id, trip_index)` unique. route, date, zone, booking_mode, charter fields, ovn fields |
| `booking_trip_pax` | one row per pax type per trip — replaces the 12-key `pax{}` object. Kills the legacy `ad`/`ad_fr` dual shape |
| `booking_passenger` | named passengers; `is_lead` flag |
| `booking_addon`, `booking_adjustment`, `booking_fee_item` | child rows; empty = zero rows |
| `booking_price_breakdown` | seat, addon, foc_discount, discount, extra, total. **Signed** — keep `foc_discount`/`discount` negative as today |
| `booking_ops` | `(booking_id, service_date)` — **this replaces the day-1-on-`bk.ops` / day-2+-on-`trip.ops` split entirely.** Every day gets a row. |
| `booking_history` | append-only audit |
| `booking_cancellation`, `booking_partial_cancel`, `booking_reschedule` | one-to-one / one-to-many |
| `booking_approval`, `booking_foc_approval`, `booking_weather_resolve` | |
| `booking_alt_pickup`, `booking_attachment` | |

**Foreign keys required:** `agent_id → agent`, `rate_type_id → rate_type`, `route_id → route`,
`charter_boat_id → boat`, `boat_id/van_id → boat/vehicle`, `pickup_area_id → pickup_area`.

**Cross-schema, added after `P0-01`:** `booking_attachment` must take a real FK to the booking
table. The rows live in `allotment.attachments` today (3,038 of them, 118 already orphaned) — a
cross-schema FK is legal in Postgres and is the right first step; physically moving the table can
wait. A `booking_b2c_link` table replaces the `b2c_<lkId>[_<n>]` string-prefix convention with a
real, enforced link to `love_kingdom.bookings` — per the `P0-08` decision, the two stay distinct
entities joined by that table.

**Constraints required:**
- `status` as a Postgres enum or CHECK over the 8 known values.
- Trip in `charter` mode ⇒ `charter_boat_id IS NOT NULL`.
- All pax counts `>= 0`.
- Partial unique index preventing two active bookings on the same `voucher_ref`.

**Deliverables.** ERD (mermaid in a `.md`), the migration, and `MAPPING.md` — a row per old blob
field → new column, covering every field in doc 01 §4. Any field you decide to drop must be listed
with a reason.

**Acceptance.** Migration applies to the `P0-01` baseline; `MAPPING.md` accounts for 100% of the
fields in `booking.model.ts`; peer review sign-off before `BK-04` starts.
**Depends on.** `P0-01` ☑, `P0-05`, `P0-08`

---

## ☐ BK-02 · Seat lock model `[serial]` · Est 3

**Why.** Seat locks are the subtlest correctness area in the app and the source of a whole class of
counter-drift bugs.

**Do.**
- `seat_lock` — scope (`day`|`bulk`|`month`), route, date range, dow, holder (`agent`|`office`|`global`),
  `parent_id` self-FK, qty, release rules, status.
- `seat_lock_usage` — `(lock_id, trip_date)` unique. Replaces the `usedBy{date:n}` object.
- `booking_trip_lock_draw` — `(booking_trip_id, lock_id)` with qty. **This is the single source of truth.**

**The important change:** the `used` counter becomes a **derived view** over
`booking_trip_lock_draw`, not a stored column. This deletes `bkV2LockAudit`, `bkV2LockCoverage`,
`bkV2LockFixUsed` and `bkV2LockFixTree` — do **not** port them.

**Invariants to preserve** (from doc 01 §3.10 / §7):
- A child lock contributes **0** to the available pool; only parent/standalone locks hold seats.
  Enforce in the pool view, not with a table constraint.
- Month/bulk locks use rolling per-trip release (`release_days_before` + `release_time`), never a
  single global expiry.

**Acceptance.** Property test: for any sequence of draw/return/edit operations, the derived `used`
equals `SUM(booking_trip_lock_draw.qty)` for live bookings — by construction, so the test should be
impossible to fail. A parent + two children never double-count against the pool.
**Depends on.** `BK-01`

---

## ☐ BK-03 · Availability as a view + service `[serial]` · Est 4

**Why.** `getAllotment` is consulted by every consumer and is the thing that must never be wrong.

**Do.** Port `getAllotment`:
`seats_available = available_capacity − seats_consumed − locked_seats`

Must honour, exactly as today:
- Exclude `['cancelled','cancelled_weather','rejected']` from every aggregate.
- Exclude `booking_mode = 'charter'` trips from seat consumption entirely.
- Subtract check-in losses (no-show / on-site cancel).
- `bkPendHoldsSeat`: a `pending_approval` booking holds seats **unless** it was held for
  over-capacity. Discount / B2C / closed-day holds **do** reserve.
- Charter boats are removed from the seat pool.

**Hazard.** A `v_seat_availability` view already exists in production and has drifted from the repo
migration in both directions. Build from `pg_get_viewdef` (`P0-01` output), then supersede it with a
new, named view — do not edit the old one in place.

**Acceptance.** For every (route, date) in the `P0-06` fixtures, the view returns byte-identical
numbers to the monolith's `getAllotment`. Differences must be explained in writing, not adjusted away.
**Depends on.** `BK-01`, `BK-02`, `P0-06`

---

## ☐ BK-04 · Data migration: existing → new booking schema `[serial]` · Est 5

**Do.** Backfill the `BK-01`/`BK-02` tables from the current production tables.

- `schemaVer = 2` bookings migrate fully.
- `schemaVer != 2` (legacy v1: `programId` + `travelDate` + `pax{adult,child,infant}`) migrate into
  the same tables with a `legacy_v1` flag; they are read-only in the UI today and stay read-only.
- Normalize the dual pax shape (`ad` vs `ad_fr`/`ad_th`) into `booking_trip_pax` rows.
- Collapse `bk.ops` (day 1) + `trip.ops` (day 2+) into `booking_ops` rows keyed by service date.
- Empty arrays become zero child rows — no sentinel, no re-hydration hack.
- **Populate `booking_b2c_link`** from the `b2c_` prefix convention, and carry the 22 parentless
  `b2c_` bookings through with the disposition `P0-09` assigned them — do not drop them silently.
- **Attach `allotment.attachments`** to their bookings via the new FK; the 118 orphans follow their
  `P0-09` disposition.

**Verification the migration must emit** (`MIGRATION_REPORT.md`):
- booking row count in = out
- `SUM(total)` and `SUM(price_breakdown.total)` match to the satang
- count by status matches
- every booking that failed to migrate, with the reason — **failing loudly beats silently dropping**

**Acceptance.** Idempotent and re-runnable. Report shows zero unexplained losses. Rehearsed against a
prod clone, not just fixtures.
**Depends on.** `BK-01`, `BK-02`, `P0-06`, `P0-09`

---

## ☐ BK-05 · Booking read API `[parallel-safe]` · Est 4

**Do.**
```
GET /v1/bookings              filter: date range, route, agent, status, channel; paginated
GET /v1/bookings/:id          full aggregate
GET /v1/manifest?date=&routeId=   the by-trip-date ops view, in ONE round trip
GET /v1/availability?date=&routeId=
GET /v1/seat-locks            filter by route/date/holder
```

The manifest endpoint must return everything `bkV2RenderTab2` renders today — pax, boat, van, pickup
time, flags — without the client making N follow-up calls.

Row-scoping from `P0-04` applies: an agent token sees only its own bookings.

**Acceptance.** OpenAPI committed. A manifest request for the busiest fixture date issues a bounded
number of SQL queries (assert it — no N+1). Agent-scoping test passes.
**Depends on.** `BK-01`, `BK-03`, `P0-04`

---

## ☐ BK-06 · Port the guard gauntlet server-side `[serial]` · Est 8 ⚠ **highest risk**

**Why.** This is the task that makes the multi-consumer API safe. Today all of this lives in
`bkV2CommitBooking` in the browser; with B2C, ERP and the agent portal writing, browser guards are
worthless.

**Do.** Implement every guard as API-side validation inside **one transaction**:

| Guard | Behaviour to preserve |
|---|---|
| Required fields | agent/channel, ≥1 trip with route+date, pax ≥ 1, lead name, rate type (unless manual), lead nationality, nationality per named passenger, guide language, hotel when a pickup area is set, pickup point when status ≠ quote, route open that day |
| B2C exemption | B2C bookings exempt from guide-language and route-closed **hard** blocks — those degrade to soft `incomplete` flags |
| Contract programme whitelist | agent's `programPeriods`/`programs` |
| Duplicate detection | voucher match, or lead name + shared date/route |
| **Anti-overbook tiering** | `lockViolation` → **hard block, no override**; `licenseBlock` → **hard block**; over company cap within licence → `pending_approval`; discount > 0 on a confirmed save → `pending_approval` |
| Edit case | only a genuine **increase** is guarded — compare against the same trip's previous general-seat need, and exclude the booking's own seats from availability |

**Concurrency is the point.** Two simultaneous requests must not oversell. Use `SELECT … FOR UPDATE`
on the affected (route, date) capacity rows, or a serializable transaction with retry. Prove it.

**Acceptance.**
- One table-driven test per guard, driven by `P0-06` fixtures.
- **Concurrency test**: N parallel booking creates against a boat with N−1 free seats results in
  exactly N−1 successes and 1 clean rejection. Run it 100×.
- A `lockViolation` cannot be overridden by any consumer, including staff.

**Don't.** Do not let any guard live only in `ops-web`. The API is the boundary.
**Depends on.** `BK-01`, `BK-02`, `BK-03`, `RT-01`

---

## ☐ BK-07 · Booking write API `[serial]` · Est 5

**Do.**
```
POST   /v1/bookings                    create (runs BK-06)
PATCH  /v1/bookings/:id                partial update, named fields only
POST   /v1/bookings/:id/cancel
POST   /v1/bookings/:id/restore
POST   /v1/bookings/:id/partial-cancel
POST   /v1/bookings/:id/reschedule
POST   /v1/bookings/:id/approve | /reject
POST   /v1/bookings/:id/foc-approve | /foc-reject
```

Every mutation writes a `booking_history` row in the same transaction. Optimistic concurrency via a
row `version` column (replaces the global `app_state.version`).

**The `PATCH` requirement is the point of the whole rewrite:** updating one field must not touch
`ops`, `upgrades`, `fee_items`, `reschedule`, `partial_cancels`, `cancellation`, `history`,
`invoice_id` or `payment_status`. Write the test that proves it.

**Acceptance.** Test: `PATCH { leadPhone }` on a booking with boat+van assigned leaves
`booking_ops` byte-identical. Cancel returns lock draws and voids the invoice in the same
transaction — a failed invoice void **rolls the cancellation back** (today it only `console.warn`s).
**Depends on.** `BK-06`

---

## ☐ BK-08 · Lock draw / return as transactional operations `[serial]` · Est 3

**Do.** Draw on create; return-then-redraw on edit; return on cancel; redraw on restore with an
explicit shortfall report when someone else took the seats meanwhile. Holder priority
`agent → office → global` when no explicit pick is made.

**Acceptance.** The "edit a booking ten times, lock counted as used ten times" regression is
structurally impossible. Property test over random operation sequences.
**Depends on.** `BK-02`, `BK-07`

---

## ☐ BK-09 · Pricing service `[parallel-safe]` · Est 5

**Do.** `packages/pricing` — pure functions, no DB access, fed rate-type data by the caller.
Port `bkV2TripSubtotal` (seat fr/th + bundle, or charter starter + extra-per-pax), `bkV2AddOnInfo`,
`bkV2CalcQuote`, promo overlay resolution, FOC discount as forgone revenue (stored negative).
OVN return legs price ฿0 with the charge on the outbound leg.

The booking write path calls it and **freezes** the result into `booking_price_breakdown`.

**Acceptance.** For every fixture booking, the computed breakdown matches the stored one to the
satang. Any mismatch is investigated, not tolerated — a mismatch means either the port is wrong or
the stored value was already wrong.
**Depends on.** `RT-01`

---

## ☐ BK-10 · Fix the documented bugs — do not port them `[parallel-safe]` · Est 3

Each of these is a known defect in the monolith. The new implementation must **not** reproduce it.
Name each test after the finding.

| Fix | Today's behaviour |
|---|---|
| Weather reschedule clears `ops` | `bkV2WeatherResolveOne` moves the trip date without clearing boat/van/check-in — the booking keeps the old day's boat and van |
| Partial cancel returns lock draws and adjusts the invoice | reduces pax and total, touches neither |
| No `toISOString().slice(0,10)` anywhere | used for `createdAt`/`bookingDate`; in +07:00 lands on the previous day before 07:00 local. Store `DATE`, resolve "today" in `Asia/Bangkok` explicitly |
| Status labels complete | `pending_approval` and `cancelled_weather` render as raw status strings |
| Calendar zone from the trip | `bkV2InferZone` reads `bk.pickup`, a v1-only field the v2 form never writes, so every v2 booking buckets to `PK` |
| Invoice void reverses payments | voiding does not reverse the `SB_PAYMENTS` rows |

**Acceptance.** Six tests, each failing against a deliberate re-introduction of the old behaviour.
**Depends on.** `BK-07`

---

## ☐ BK-11 · React — booking read screens `[parallel-safe]` · Est 5

Calendar (month grid), matrix (routes × days), by-trip-date manifest, all-bookings table, booking
detail. TanStack Query against `BK-05`. No global mutable store, no `innerHTML`.

**Carry over the hard-won UI lessons** (doc 01 §7, doc 08 §5): sticky-header offsets computed not
hardcoded; no full-subtree re-render while an input has focus; keep `backdrop-filter` off any card
containing a dropdown.

**Acceptance.** Manifest screen renders the busiest fixture date without a visible re-render jank;
keyboard focus survives a data refetch.
**Depends on.** `BK-05`

---

## ☐ BK-12 · React — the booking form `[serial]` · Est 6

Create + edit. Per-field `PATCH`. **Validation is server-driven**: `BK-06` returns structured errors
and the form renders them. Do not duplicate a single guard rule in the client — client-side checks
are for immediate affordance only (disabled buttons, inline hints) and must never be the enforcement.

**Acceptance.** Removing a client-side hint never changes what the API accepts. Editing a booking
with boat+van assigned and saving leaves the assignment intact (the regression that motivated the
entire edit-preserve block).
**Depends on.** `BK-07`, `BK-11`

---

## ☐ BK-13 · React — action modals `[parallel-safe]` · Est 3

Cancel (reason catalogue + charge mode), restore, partial cancel (per-pax-type reduce with
charged/waived split), reschedule (fee mode + collection), approve/reject with impact preview, FOC
approve/reject.

**Acceptance.** Each modal maps 1:1 to a `BK-07` endpoint. The approval modal shows the
seats-after-approval preview, as today.
**Depends on.** `BK-07`, `BK-11`

---

## ☐ BK-14 · React — seat locks screen `[parallel-safe]` · Est 3

List, create (day/bulk/month), sub-group create, release, add seats, per-agent KPI, and the
draw-source picker used inside the booking form.

**Acceptance.** Creating a month lock with rolling release behaves per `BK-02`; the UI never shows a
stale `used` count because there is no stored counter to go stale.
**Depends on.** `BK-02`, `BK-08`

---

## ☐ BK-15 · Strangler bridge for booking `[serial]` · Est 5 ⚠ **riskiest integration**

**Why.** Fleet, boat ops and vans stay in the monolith and they read `bk.ops`. Once the API owns
bookings, the monolith needs a supply line.

**Do.** Per the `P0-07` ADR:
1. Disable the monolith's booking view; link out to the React app.
2. Implement the read-through adapter so `bkV2RenderTab2`'s consumers — boat assignment, van
   assignment, van groups, pickup times, check-in — keep working against API-owned bookings.
3. Writes the monolith still performs (boat/van assignment) go through the adapter to
   `PATCH /v1/bookings/:id/ops`.

**Acceptance.** With booking served by the API, a full operational day still works end to end in the
monolith: assign boat → assign van → van group → job order → pier check-in. Rehearsed on a prod
clone. Adapter deletion criteria written into the code as a comment referencing the ADR.
**Depends on.** `BK-07`, `P0-07`

---

## ☐ BK-16 · Cutover + rollback `[serial]` · Est 3

**Do.** Runbook covering: freeze window, final `BK-04` migration run, reconciliation check
(counts + money), DNS/route switch, smoke tests, and a **rollback to the monolith inside 15
minutes** including how to replay writes taken by the new system.

**Acceptance.** Full dry run on a prod clone, timed. Rollback rehearsed at least once and it works.
**Depends on.** everything above

---

# Phase 2+ · Named, not yet specified

Do not start these until booking is cut over and stable.

| Phase | Domain | Notes |
|---|---|---|
| 2 | Sales — agents, rate types (full), contracts, add-ons | `RT-01` already took the read slice |
| 3 | Boat operations + pier | removes the `BK-15` adapter's boat half |
| 4 | Transfer, vans, pickup | removes the rest of the adapter — **delete the bridge here** |
| 5 | Fleet management | the largest single block: 290 `fl*` functions, and `flLoad()` at 5,423 lines (see doc 09) |
| 6 | Accounting + finance | |
| 7 | B2C public API + agent portal | the external consumers get first-class endpoints |
| 8 | Delete `allotment_v2.html`, `server.js`, `os-backend/` | the actual finish line |
