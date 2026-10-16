# Replacement Readiness — 2026-10-14

## Verdict

**BLOCK — do not replace `lk-inbox` yet**, but the gap narrowed today: the first side-by-side
browser acceptance campaign ran (identity + live writes, both systems on one copy of legacy's
13 Oct data), the booking write path passed it, and the remaining work is enumerated with
evidence rather than suspected.

Supersedes `readiness-2026-10-13-en.md`. Everything that doc says about adapters existing still
holds; what this adds is acceptance results, one new deployment blocker, and corrections to the
operation-backend repo's older readiness doc (whose blockers 1–2 — attachments, "dead screens" —
were already resolved by the 2026-10-13 merges; its 2026-10-14 successor now defers to this file).

**Interrupted work resumes from `D:/projects/compare-stack/handoffs/README.md`** (one handoff per
open task; evidence in `PROBLEMS-2026-10-14.md`, `identical-report.html`,
`rules-triage-2026-10-14.md`).

## Deploy state (2026-10-14)

- **operation-backend** `origin/main` `8c0ab08` deployed (unchanged). Note: a local checkout that
  is behind this (e.g. `dfee632`) misled one review today — `git fetch` before citing "main".
- **This frontend** `main` `5a6e6d3` pushed and **verified live**: production serves
  `34-ops-vans.js?v=762d3633` containing the §vanKeep fix. Van Jobs now shows the day's vans
  (was: 0 jobs on days the server had 6).
- **NEW BLOCKER — the deploy build is not running.** Production serves 715 separate `<script>`
  tags; `08-app.js` is byte-identical to source (5.45 MB, `?v=0d58024c`, unminified); nothing is
  compressed (21.7 MB cold boot). `railway.json` orders `npm run build:deploy` (bundle ~650
  booking files, minify); it demonstrably does not run. This also explains the 2026-10-13 note
  about the page "still serving the previous build". Railway dashboard check — operator only
  (compare the Sept config-as-code incident).

## Acceptance run (2026-10-14, local Docker, side-by-side with lk-inbox)

Both apps served from one stack (`D:/projects/compare-stack`): lk-inbox on the `legacy` copy,
this frontend (`5a6e6d3` + round-1 branch) against operation-backend on the imported `operations`
copy (5,794 bookings).

| Area | Result |
| --- | --- |
| Booking lifecycle through the real save path | **Pass**: create (agent a06, rate-priced, server total ฿3,600) → edit (PATCH, trip id kept) → cancel → restore → cancel. Availability 14→16→17→14 exact; `If-Match` + validations enforced ("price_mode must be rate…", "note is required…") |
| Booking data parity vs lk-inbox | **Pass**: 100% on id/status/lead/agent/route/pax across 4 test dates; the only gap is the 22 `b2c_*` lines the import drops by design (13 no-route + 9 test — the same 22 the 10-13 import run flagged) |
| Screen identity, all 70 menu screens | 18 identical · 15 close (≥90%) · 36 different · 1 not compared (lk-inbox froze on marketdata). Causes per screen in `identical-report.html`; most differences are data drift (ops is master for agents/rate-types; fleet newer here) or the partial-data bugs below |
| Van Jobs | **Fixed and shipped** (`5a6e6d3`): day bookings load before groups apply; van fields survive booking merges |
| Six partial-data screens (focdetail, b2b-dash, actionboard, bookingflow, travelsum, pickup-setup) | **Fixed and browser-verified** on `fix/round1-combined` @ `e674c80` — **unmerged, ready to ship**. travelsum was a false alarm (server answers 38/80/80 correctly); its money columns are ฿0 → data gap below |
| Seat locks, first browser attempt | **Fail/undiagnosed**: after an on-screen day-lock create, the suite's direct `GET /v1/seat-locks` reads back empty. Locks remain never browser-verified (the 10-13 lock rewrite was store-tested only) |
| `test/ui/t_ops.mjs` (8-section functional suite) | **Rotted, red on every frontend version**: contract drift since ~10-11 (manual-price restriction; deployment answer now carries capacity 34 w/ license_pax+registered_persons where it expected 30 — intended-or-regression undecided; the lock read-back above). Until rehabbed there is **no green automated write-path suite** |

## Release blockers (updated)

| Area | State | Still open |
| --- | --- | --- |
| Deploy build (new) | not running on Railway | operator dashboard check |
| Browser acceptance of the 10-13 wave | partially done by the campaign (booking writes, reconfirm/petty-cash/pier-ledger passed 10-13) | locks, "anyway" dialogs, attachments' residual paths, contract artifact upload, auth expiry, concurrent writes |
| Attachments residual | adapters exist (`38-ops-attachments.js`); 4 raw `api/attach` call sites remain (3 in `08-app.js`, 1 in `05-fleet.js`) + the 10-13 doc's heuristic gaps (multi-booking invoices, pier payments, upgrades, COT) | close the 4 sites, acceptance; Railway `import:attachments --commit` re-run |
| Partial-data screens, round 2 | rep-ops, pickupmap, poa-* piers, calendar; calendar started (`fix/agg-round2` @ `6657302`) | finish per handoff 06; three proposed server views (`foc-stats`, `sales-summary`, `agent-month-stats`) make it clean |
| t_ops suite | ~170 lines of rehab survived uncommitted (`D:/projects/wt-tops`) | handoff 05; doubles as the first lock browser verification |
| Pier office non-job-sheet groups | boat close wired (`fix/pier-office-client` @ `06ffcad`, unit-tested, live check unfinished); stock/roster/licences/settings still `poPersist` | handoff 03. The backend 500 fixes cited there are ALREADY deployed in `8c0ab08` — no backend merge needed |
| Legacy browser rules | **triage complete**: 175/175 dispositioned — 11 BLOCKER (2 client-wiring, 9 server work), 64 accept-difference, 6 owner decisions (`compare-stack/rules-triage-2026-10-14.md`) | act on it (handoff 04); do not re-triage |

## Data gaps and decisions (owner)

- **Day money**: the import fills `booking_trips` but not `tour_sales`, `pier_payments`,
  `cot_decisions`, `noshow_charges` → Travel Summary money columns all ฿0 here (fits the 10-13
  note "104 legacy columns no import reads" — these four matter; decide before cutover).
- **P13**: the 22 dropped `b2c_*` lines (2 confirmed incl. a ฿2,800 transfer) — do transfer /
  third-party / hotel lines live here?
- **C1**: `addon_services` is empty here (API is master) — import once or recreate by hand.
- **C3**: three agents proforma in legacy vs invoice here → Daily-PFM totals differ (192 vs 180).
- **locked_pax**: server says 901 where legacy's client computes 516 — legacy applies month-lock
  release rules client-side; decide whether the server should.
- lk-inbox's own Sep count (1,001) disagrees with the DB (1,171) — a legacy-side anomaly worth a look.
- Plus the 10-13 carried items and the triage's 6 decision rows.

## Branches awaiting review/merge (none pushed)

`fix/round1-combined` `e674c80` (verified, ready) · `fix/dead-screens` `6f438a8` (Sales Board
counts/mix — review against the already-wired `27-ops-sales-board.js` for overlap) ·
`fix/pier-office-client` `06ffcad` · `fix/agg-round2` `6657302` + uncommitted poa-panwa ·
`fix/t-ops-rehab` uncommitted. Note `wt-pier` and `wt-round2` both touch
`48-ops-pier-office.js` — merge will conflict; resolve knowingly.

## Cutover rule (unchanged)

Do not schedule the one-day cutover until every blocker above is resolved and the browser
acceptance list passes. On the day: stop legacy writes, run the importers once
(`import:legacy`, `import:pier-office`, `import:attachments`), then staff enter data only here.
