# Workflow Documentation — allotment_v2

How this system actually works, one doc per domain. Written against commit `094dde1` on
`refactor/booking-v2-migration`.

**Browsable HTML version:** open [`html/index.html`](html/index.html) — the same eight docs rendered
as linked pages with a sticky table of contents, colour-coded flow diagrams (the mermaid charts are
re-drawn as HTML so they render without a runtime) and a live filter over each function index.
Self-contained; just double-click. `html/_shell.html` is the shared page template — reuse it if you
add a doc 09.

**Line numbers drift.** Every doc cites `allotment_v2.html:12345` style references. Treat them as
"roughly here" — grep the symbol name instead. The function-index table at the end of each doc is
the fastest way to find anything.

**These docs describe the code, not the intent.** Where an older doc contradicts the code, the code
won.

---

## The docs

| # | Doc | Domain | Lines |
|---|---|---|---|
| 01 | [Booking Lifecycle](01-booking-lifecycle.md) | Booking v2 — create / edit / cancel / partial-cancel / reschedule / weather, approvals, seat locks, allotment math, `priceBreakdown` | 591 |
| 02 | [Sales, Agents & Pricing](02-sales-agents-pricing.md) | Agents, rate types, the data-driven add-on system, longtail, contracts + renewal, FOC, B2C/B2B | 737 |
| 03 | [Boat Operations & Pier](03-boat-operations-pier.md) | Boat op / TRIPS, boat assignment, pier check-in, POA/POL/POJ per pier, doc-check OCR, reconfirm, guides | 683 |
| 04 | [Transfer, Vans & Pickup](04-transfer-vans-pickup.md) | Transfer fleet, van groups + job orders, pickup setup & map, the four "where" concepts | 708 |
| 05 | [Fleet Management](05-fleet-management.md) | Boats, engines/gearboxes/propellers, engine swap, maintenance, incidents, projects, consumables, fuel, `flLoad` lifecycle | 682 |
| 06 | [Accounting & Finance](06-accounting-finance.md) | Invoices, payments, deposits, VAT, statements, Daily PFM, trip P&L, costing | 430 |
| 07 | [Data, Persistence & API](07-data-persistence-api.md) | RAM working copy → diff → `_batch` → Postgres, the mapper, store inventory, server.js routes, migrations, deploy | 767 |
| 08 | [Shell, Dashboards & Config](08-shell-dashboards-config.md) | File anatomy, boot, routing, **shared render utilities and their traps**, dashboards, market intelligence, settings | 446 |

## Where to start

- **New to the codebase** → 07 §1–3 (how data moves), then 08 §1 and §5 (how the file is laid out
  and which render traps will bite you), then whichever domain you're touching.
- **Fixing a booking bug** → 01, then 03/04 for anything downstream of `bk.ops`.
- **Adding a persisted field** → 07 §4. This is the most-commonly-got-wrong procedure in the repo.
- **Adding an add-on type** → 02 §6.
- **Touching fleet data** → 05 §6 before you write anything into `flLoad`.

## The seams between domains

Booking owns `bk.ops` but does not read it operationally; Boat Operations (03) and Vans (04) do.
Pricing is produced by 02, frozen into `bk.priceBreakdown` by 01, and consumed by 06 — three
different owners for one number, which is where most inconsistency lives.

---

## Issues found while documenting

These were found by reading the code, not by testing. Nothing here has been fixed.

### Blocking

- **`server.js` does not boot at `094dde1`.** `server.js:34-35` unconditionally requires
  `./os-backend/src/mapping/os_repo.js`; commit `094dde1` deleted that tree (83 files). Fires in
  blob mode too, not just `DATA_BACKEND=relational`. The mapper (`field_mapping.json`) and the
  `HANDOFF_2026-07-04.md` maintenance scripts went with it and have no surviving copy.
  Recovery: `git checkout HEAD~1 -- os-backend db/migrations`. **Not on `main`** — the break is
  confined to this branch. Detail in 07 §0.

### Silent data loss

- **Permission-gate mismatch.** `sbInvoicesPersist:42846` gates on `laCanEditArea('accounting')`
  but calls `acctPersistBookings:42877`, which gates on `'operations'`. An accounting-only user's
  invoice saves; the booking-side write silently returns. (06 §10)
- **Weather reschedule keeps stale ops.** `bkV2WeatherResolveOne:60032` changes the trip date
  without clearing `bk.ops` boat/van/check-in. Every other date-change path
  (`bkV2RescheduleBooking:77572`, edit path `:76886`) clears it. The booking keeps the *old* day's
  boat and van. (01 §7)
- **Partial cancel leaks seat locks.** `bkV2PartialCancel:77728` reduces pax and total but never
  returns the seat-lock draws and never touches the invoice. (01 §7)
- **Not persisted at all:** `SB_ADDON_SVCS` (add-on services master list) and
  `ctRenewActivate:65317` (contract renewal activation). Both are RAM-only — lost on reload. (02)

### Wrong numbers

- **Calendar zone split is meaningless for v2 bookings.** `bkV2InferZone:69054` reads `bk.pickup`,
  a v1-only field the v2 form never writes, so everything falls through to `PK`. (01 §7)
- **`inv.whtAmount`** is rendered on the printed invoice but never written anywhere — always ฿0. (06)
- **Voiding an invoice** does not reverse its `SB_PAYMENTS` rows. (06)
- **`toISOString().slice(0,10)`** still used for `createdAt`/`bookingDate` (`:76704`, `:76844`)
  despite the project's `bkV2LocalYMD` rule — off-by-one day before 07:00 local. (01)

### Fragile by design (know before you touch)

- `trips` maps to **hardcoded per-boat columns** (`bN_route`, `bN_booked`, …) — adding a boat needs
  manual columns in `server.js:1637`. (07 §5)
- `pier_lic_types` / `pier_lic_classes` / `pier_codes` load with `Array.isArray && .length`, so
  **clearing the list reverts it to seed**. (07 §5)
- Over-payment and deposit double-application have no guard. (06 §10)

## Drift in the pre-existing docs

| Doc | Problem |
|---|---|
| `CHANGELOG.md` | **Does not exist.** `CLAUDE.md` cites it six times as the authoritative per-feature history; `SYSTEM_MAP.md` points at it too. Every reference is dead. |
| `README.md` | Says set `APP_USER` / `APP_PASS`. `server.js:19-20` reads `ADMIN_USER` / `ADMIN_PASS`. |
| `CLAUDE.md:51` | Lists pier `ranong` as "Planned". The code has first-class `ranong` support (98 references, full Pier-Office view family). |
| `docs/BOOKING.md` | Stale Phase-1 spec; line numbers ~35k off; claims the wizard/detail are unbuilt. `docs/booking.model.ts` is accurate. |
| `database_migration/operation_schemas_model.json` | An older, different file from the one `server.js` loaded — not a drop-in replacement for the deleted copy. |
| `allotment_v2.html:68863` | `_bkV2` comment says 3 tabs; there are 6. |
