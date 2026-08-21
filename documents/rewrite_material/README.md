# Rewrite Material

Three build specifications for rebuilding the LOVE Andaman ops platform on a relational database
behind a REST API. Written for a developer who has never seen the current system: **every rule is
stated, not referenced.**

Browsable HTML version: open [`html/index.html`](html/index.html). Same content, linked pages,
sticky table of contents, theme toggle. Self-contained — just double-click.

---

## The specs

| # | Spec | Covers | Lines |
|---|---|---|---|
| 01 | [Booking System](01-booking-system.md) · [html](html/01-booking-system.html) | Domain model, lifecycle state machine, seat inventory and locks, the full pricing calculation, mutation flows, the `ops` seam, channels and external writers, target schema, REST surface, twenty bugs not to reproduce, build order | 3,569 |
| 02 | [Fleet & Boat Assignment](02-fleet-and-boat-assignment.md) · [html](html/02-fleet-and-boat-assignment.html) | Boats and the status log, drivetrain and engine swap, engine hours, maintenance cost share, boat assignment rules, pier operations, transfer vans and pickup, target schema, REST surface, acceptance criteria | 3,569 |
| 03 | [Design Principles](03-design-principles.md) · [html](html/03-design-principles.html) | 83 design tokens with dark overrides, the per-view skin system, eleven component contracts, layout, iconography, print documents, data display rules, accessibility, render traps, migration and governance | 2,065 |

`html/_shell.html` is the shared page template, copied from `allotment_v2/docs/workflows/html/`.
Reuse it if you add a spec 04.

---

## Where to start

| If you are… | Read |
|---|---|
| Building the API | 01 §9 (schema) and §10 (endpoints), then 02 §9 and §10. Read **01 §11 and 02 §11 before writing a single handler** — they list every invariant that currently lives in browser JavaScript and must not stay there. |
| Building the UI | 03 §2 (tokens) and §4 (components), then §10 (render traps). §11 covers migrating without a visual regression staff will notice. |
| Understanding the business | 01 §1 and 02 §1. Both are plain language before any schema appears; 02 §1 walks a trip day end to end. |
| Pricing anything | 01 §5, all of it. The price is produced by rate types, frozen at commit, consumed by accounting — three owners for one number. |
| Working on seat availability | 01 §4. Locks, the `cap` / `licensePax` distinction, and why the `used` counter becomes a derived view. |
| Assigning boats or vans | 02 §5 and §7, plus 01 §7 for the other side of the `ops` seam. |
| Planning the work | 01 §15 and 02 §15. Both re-express the existing `P0-*` / `BK-*` decomposition framework-neutrally as work packages. |

---

## Conventions

- **Backend specs are framework-neutral.** PostgreSQL 18 DDL, REST endpoint tables, JSON request and
  response shapes, and language-agnostic pseudocode. No Fastify, FastAPI, ORM or validation-library
  code appears anywhere, so the specs survive a stack change.
- **The frontend is a React SPA + Vite** consuming that API. Spec 03 is the only place a framework is
  named.
- **Currency is Thai Baht; time is Asia/Bangkok (+07:00).** The UI is bilingual Thai/English, and the
  Thai-script type rules are in 03 §2.
- **Bugs are marked as bugs.** Where current behaviour is a defect rather than a rule, the spec says
  so and specifies the correct behaviour instead. Do not port the bug for parity's sake.
- **Line numbers drift.** Every `allotment_v2.html:12345` reference means "roughly here" — grep the
  symbol name instead.

### These specs supersede decision D3

`allotment_v2/docs/rewrite/README.md` records decision **D3** — "Vite React SPA + Fastify API" — as
binding. The backend half no longer holds: these specs are framework-neutral by explicit instruction.
**Update that file** so the plan of record does not contradict its own specs. The React SPA half of
D3 stands.

---

## Provenance

Built from the existing documentation set, then **verified against the code and the production schema
dump rather than trusted**:

| Source | Used for |
|---|---|
| `allotment_v2/docs/workflows/*.md` | Eight domain docs, ~5,000 lines, written against `094dde1`. Primary source for all three specs. |
| `allotment_v2/docs/design/*.md` | Seven design docs. Primary source for spec 03. |
| `allotment_v2/docs/booking.model.ts` | The accurate booking data model. |
| `allotment_v2/docs/rewrite/README.md` · `TASKS.md` | Target architecture and the `P0-*` / `BK-*` task decomposition. |
| `db/baseline/` | The real production schema — 4 schemas, 184 tables, 56,832 rows. Several previously undocumented bugs were found by diffing the app's reads against these columns. |
| `allotment_v2/allotment_v2.html` | Grepped to resolve specific ambiguities. Where a doc and the code disagreed, **the code won**. |
| `CLAUDE.md` | Project rules and gotchas, with the drift noted in each spec where it was found. |

**Not a source:** `allotment_v2/docs/BOOKING.md` is a stale Phase-1 spec with line numbers ~35k off.
It was deliberately not used.

---

## Written against `094dde1` — three bugs have since been fixed

These specs describe the code at commit `094dde1`. While they were being written, upstream landed
fixes for three of the defects they list as "do not reproduce":

| Ticket | Fix |
|---|---|
| `LAM-18` | Clears `bk.ops` boat/van assignment on weather reschedule |
| `LAM-19` | Returns seat-lock draws and flags the invoice on partial cancel |
| `LAM-17` | Fixes the accounting/operations permission gate on booking persistence |

The guidance is unchanged — do not reproduce these in the rewrite — but there is now a **correct
implementation to compare against** rather than only a description of the defect. Everything else in
§12 of spec 01 and §13 of spec 02 still stands. Upstream also added `ARCHITECTURE.md`, a test harness
under `test/`, and `docs/development/unpersisted-writes.md`, which overlaps spec 01's persistence
material.

---

## Findings that need a decision

Each spec carries its own open-questions section — 01 Appendix A, 02 "Open questions", 03 §13. These
are the ones that block work or contradict existing documentation.

### Schema gaps found in the production dump — verify before migrating

Found by diffing what the app reads against what `db/baseline/operation_schemas_20260820.sql`
actually stores. Each is silent data loss today.

| | Finding |
|---|---|
| **Seat locks lose their range** | `sb_seat_locks` has no column for `datefrom`, `dateto`, `dow`, or the per-date used counter, yet the app reads all four. A `bulk`-scope lock loses its range on every round-trip and then matches no departure — it silently stops holding seats. Run `SELECT scope, count(*) FROM sb_seat_locks GROUP BY scope` before migrating to size the damage. |
| **Discount approvals lose the amount** | `approval.discount` and `approval.saleName` have no columns — a discount-hold approval loses both the amount and the salesperson who has to sign it off. |
| **Partial cancels lose most pax detail** | `sb_bookings__partialcancels` has columns for 2 of the 12 pax keys. Removing children or Thai adults loses the detail. |
| **`ops.pfm` has no column** | Documented as part of the ops container; stored nowhere. |
| **`completed` status is unreachable** | It is in the enum, has a label, and three guards refuse to act on it — but no code path ever writes it. |
| **`v_seat_availability` disagrees with the app** | The production view omits the `pending_approval` seat-holding rule and does not subtract check-in losses, so it and `getAllotment` return different numbers. Consistent with the known prod/repo drift on this view. |

### Fleet and assignment — latent bugs

| | Finding |
|---|---|
| **The licence ceiling is not enforced per boat** | The assignment guard checks `cap + 2` only. It never checks `licensePax`. This does not bite today purely because every seeded hull happens to have `cap < licensePax` — a data coincidence, not a rule. One boat entered the other way round and the hard block silently stops existing. |
| **Hardcoded per-boat columns dropped three boats** | `trips` maps to fixed per-boat columns (`b1_route`, `b1_booked`, …), so `b8`, `b14` and `b15` were silently absent. The spec replaces this with row-per-boat-per-trip; **the views need rebuilding too**, from `pg_get_viewdef` on the live server, never from the repo file. |
| **Project completion bypasses the close cascade** | Child assets stay stuck in `fixing` forever. Killed structurally by `CHECK (status <> 'done' OR outcome IS NOT NULL)`. |
| **Van-group disband has no return-van reconciliation** | The heal reconciles `vanId` only, by design, so `vanReturnId` has no repair path at all. Fixed by putting the outbound van on the group row and the return van on the assignment row. |
| **Engine meter replacement is not modelled** | If a meter has ever been physically replaced, that engine computes nonsense hours forever and nothing flags it. The spec proposes a `meter_replaced` marker — **this is a proposal, not observed behaviour.** Worth confirming with the workshop. |
| **`pier_lic_types` / `pier_lic_classes` may be re-applied seeds** | These load with `Array.isArray && .length`, so clearing the list reverts it to seed. Prod holds 2 and 4 rows respectively — those may be seeds re-applied over someone's deletion rather than real data. |

### Documentation drift found while writing

- **The voucher hero override layer does not exist.** `CLAUDE.md` §8 describes
  `assets/voucher/<routeId>.jpg` as a live override rendered over the shared hero. Repo-wide grep
  finds zero code references, the directory holds one orphan file (`r12.jpg`), and
  `bkV2VoucherTicket()` renders no photograph at all — it is a typographic card.
- **Sidebar groups are eight, not six.** The shipped markup has Overview · Operations · **Pier
  Office** · Sales · Accounting & Finance · **Admin** · Fleet Management · Config. `CLAUDE.md` §9
  lists six.
- **`ranong` is a real pier in the code**, not "planned" as `CLAUDE.md` §5.1 says — permission areas,
  four rendered pier-office views, colour and label tables, calendar list, dashboard KPIs, a Daily-Log
  section, a Boat-Status group, a `คลัง Ranong` warehouse, and a deliberate `grand andaman` /
  `se la va` keyword mapping. What is missing is only *data*: no seeded boat or route uses it. Spec 02
  models all three piers as lookup rows.
- **`CLAUDE.md` §5.1 states the Boat Status grouping rule wrong.** It says the In Shop group is
  `last.s === 'fixing'`. The code groups by a derived *effective pier*, which returns `shop` only for
  an `inprogress` job that has a non-empty location **and** leaves the boat non-available — so a
  `fixing` boat with no job location stays in its own pier group. The code won; spec 02 documents the
  real rule.
- **Vessel count is 15 seeded, not ~16.** The colour palette has 16 slots, which is likely where the
  number came from. Query production before quoting a figure anywhere.
- **All money columns are `bigint` whole baht.** The rewrite plan's "match to the satang" parity
  requirement is currently vacuous — decide whether the new schema moves to minor units.

### Design decisions to make

Spec 03 captures the current system and marks every proposed change as a proposal. The ones worth
deciding early, because they affect the token set: whether to keep per-view accents at all (17 skins
exist; consolidation to 8 is proposed), whether `pending_approval` is warn rather than danger,
whether dark mode is in v1 scope, and whether an `overdue` invoice chip should exist — today the one
overdue row you need to find looks identical to the forty you do not.

---

*Written against commit `094dde1` on `refactor/booking-v2-migration`.*
