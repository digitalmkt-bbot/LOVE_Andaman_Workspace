# Cutover TODO — unwired / legacy-dependent screens

Source: `D:/projects/operation-backend/docs/readiness-2026-10-13-en.md`, rechecked 2026-10-13.  These must work against operation-backend before the one-day cutover; the static frontend has no legacy `/api/*` server.

## Screens and adapters

- [ ] **User admin and password reset** — replace `/api/users*` calls in `allotment_v2/js/01-auth-sync.js` with `/v1/users` operations. Confirm the API method/payloads for listing, create/update, roles and password reset.
- [ ] **B2C health panel** — replace `/api/b2c/health` in `01-auth-sync.js` with views built from `/v1/b2c/issues` and `/v1/b2c/held-orders`.
- [ ] **Pier office (except park tickets)** — add client adapters and server hydration for job, stock, roster, licences, settings and moves under `/v1/pier-office/*`; stop persisting the browser-local `poPersist` copy. The server model notes identify three still-missing reads, so this is not client-only.
- [ ] **Commission payouts** — wire the screen to `/v1/commissions` and `/v1/commission-payouts`.
- [ ] **Pier money and van bills** — wire screens to `/v1/pier-money` and `/v1/van-bills`.
- [ ] **Trip P&L, analysis and costing** — wire reporting screens to `/v1/reports/trip-pl`, `/v1/reports/analysis` and `/v1/costing/*`.
- [ ] **Sales Board** — wire targets, follow-ups and board reads/writes to `/v1/sales/{id}/targets/{month}`, `/v1/sales/{id}/followups` and `/v1/sales-board`. Verify the existing `ops/27-ops-sales-board.js` against the actual rendered flows before doing duplicate work.
- [ ] **Day capacity override reason** — send overrides to `/v1/boats/{id}/capacity-overrides`, rather than only embedding `raise_capacity` in boat assignment.
- [ ] **Booking edit quote** — replace browser-only `bookingV2CalcQuote` pricing with `POST /v1/quote` for the displayed quote while editing.

## Verification for each item

- [ ] Load its screen with operation-backend enabled; no `/api/*` requests occur.
- [ ] Verify reads survive reload and writes are refused/reported correctly.
- [ ] Add/update focused adapter tests where practical.
- [ ] Bump every edited JS/CSS asset `?v=` in `allotment_v2/allotment_v2.html`.

## Separate blocker

- [ ] **Attachments** — Luna is implementing `/v1/attachments` adapters separately (booking documents, PFM/payment slips and all discovered legacy `/api/attach` flows).
