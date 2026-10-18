# w5-d · day operations, guide papers, fleet, costing (2026-10-18)

Branch `wire/w5-d`. Lists: `operation-backend/docs/verify/wire2/wire-07.md` and `wire-08.md` (rows of "NOT-WIRED and WIRED-PARTLY").
Server: operation-backend `README.md` (Check-in, "The Pier Check-in sheet", "Pier emergency boat move", "Trip actuals", "Guide orders", "Vans", "Van job orders", "Van board", "Costing", "Pier money"), `todo/decisions-answers.md`.
Idiom: every function is wrapped from `js/ops/83-*.js` (or a small edit of its adapter); the wrapper answers from the server's held answer and returns `undefined` (legacy answers) before the first answer, while a write has made the answer stale, offline and outside ops mode.
New files: `ops/83-ops-pier-day.js`, `83-ops-van-rows.js`, `83-ops-pier-move.js`, `83-ops-meal-preview.js`, `83-ops-pier-extras.js`, `83-ops-guide-papers.js`, `83-ops-boat-auto.js`, `83-ops-fleet-server.js`, `83-ops-cost-plans.js`, `83-ops-pay-chip.js` (script tags in `allotment_v2.html`, each after the file it extends).
Test: `test/ui/t_walk_w5_d.mjs` (10 sections, 120+ checks; every section has a "tampered answer" case: the proxy changes what the server says to a figure legacy's arithmetic would never give, and the screen must show the server's).

## Verdicts

78 rows: **46 WIRED, 8 SKIPPED-NOT-NEEDED, 0 SKIPPED-DESIGN, 24 MISSING-SERVER-FIELD.**

### wire-07

| Function | Verdict | Endpoint / field | Commit |
|---|---|---|---|
| `vckRowSt` | WIRED | `GET /v1/van-checkin` `rows[].status`, matched by the record's trip and slot | `db81032c` |
| `renderVanCheckin` (row order, status, redraw) | WIRED | `GET /v1/van-checkin` `rows[]` order. The pills are the query the answer is asked with; the text search stays the client's (README) | `db81032c` |
| `pckArrivalOf` | WIRED | `GET /v1/pier-checkin` `rows[].arrival` | `be9f841a` |
| `pckInPier` | WIRED | `GET /v1/pier-checkin?pier=` (the routes in that pier's answer) | `be9f841a` |
| `pckProgData`, `pckProgStatus` | WIRED | `programmes[]` and `programmes[].status` (the pier's own answer when a pier is picked). Seats locked with no booking yet are still the seat-lock cache's | `be9f841a` |
| `pckExpandBoatSplits`, `pckExpandVanSplits` | WIRED | `rows[]` with `split {by,index,of}`: booked, expected, boat, van, arrival, money of the part (first row only) | `be9f841a` |
| `pckAgg`, `pckSheetAgg` | WIRED | the rows' server `stage`, `expected`, `no_show`, `money.due`, summed for the rows given (a boat, a van, a zone). Group totals: MISSING `groups` below | `be9f841a` |
| `bkxExGot`, `bkxExCovered` | WIRED | tour sale `covered_by_pier` (kept as `x.coveredByPier` by `36-ops-day-actions.js`); the held sales are read again after a pier write | `b7c8de91` |
| `pckLineFee` | MISSING-SERVER-FIELD | the card-fee preview needs a server preview (below) | - |
| `pckMoveCan`, `pckMoveCtx`, `pckMoveSave` | WIRED | `GET` / `POST /operations/trip-ops/{id}/pier-move` (`may_move`, `options`, reason, note; 409 messages shown in the dialog; history line is the server's) | `25d7f1a6` |
| `pckMealOvnRows`, `pckMealOvnNeed`, `pckMealCount`, `pckAllergyList`, `mvLunchRows` | WIRED | `GET /v1/trip-actuals/{date}/{boat}` `meal_preview` (`overnight`, `undecided_overnight`, counts, `allergies`, `requests`) | `c7d3e926`, `7ce8ed99` |
| `pckMealStep` | SKIPPED-NOT-NEEDED | the +/- stopping at the heads is a hint; `PUT /v1/bookings/{id}/meals` refuses more than the heads (`meals_over_headcount`) and its message is the toast (tested) | - |
| `pckTripStats` | MISSING-SERVER-FIELD | called with any set of rows (boat band, van group); the server has `booked.prep` per boat only, and counts guide languages on booked heads, not on heads still travelling | - |
| `ckRetVan`, `pckJobDrop`, `tsSendBack` | MISSING-SERVER-FIELD | the return van and the drop-off are served per job sheet row only (below) | - |
| `pckJobService` | MISSING-SERVER-FIELD | the on-tour extras and other upgrade lines of the Service column (below) | - |
| `goIsGuide` | WIRED (inside a sheet) | the sheet's `guides[]` while `goSheet` draws. Outside a sheet (the register's own list) the role test is legacy's: MISSING `licensed` below | `29f9ceab` |
| `goRows` | SKIPPED-NOT-NEEDED | the server serves no rows; its two readers (`goCounts`, `goRouteOf`) answer from the sheet | - |
| `goCounts`, `goCrewN`, `goSheet` | WIRED | `GET /v1/guide-orders/{date}/{boat}/sheet`: the seven figures of the page, the seats, the lead guide | `29f9ceab` |
| `pckTravelCrew`, `pckTravelRows`, `pckTravelSheet` | WIRED | `GET /v1/travel-register/{date}/{boat}`: crew, passengers, the nine figures of the summary, the warnings | `29f9ceab` |
| `tsCotCell` | SKIPPED-NOT-NEEDED | not called in ops mode: `59-ops-travelsum-view.js` draws the COT cell from the server (`cot.not_counted` -> "เก็บไม่ได้" suggestion, `suggested_mode`) | - |
| `tsCxlRows` | WIRED | `cancelled_rows`; a booking the browser does not hold is drawn from the server's row (a stand-in carrying code, voucher, lead, agent, status, route, boat, van), no fall back to legacy's list | `4e939065` |
| `tsRefPackList`, `tsInvSlips`, `tsSlipPackList` | MISSING-SERVER-FIELD | which bookings go in the reference pack, the slip pack per booking and the missing count (below). Ops mode prints the packs from the bar | - |
| `drTrendBooked` | MISSING-SERVER-FIELD | `daily-counts?markets=1` counts BOOKINGS per market; the chart is in heads (below) | - |

### wire-08

| Function | Verdict | Endpoint / field | Commit |
|---|---|---|---|
| `baAutoAssign` | WIRED | `POST /operations/deployments/{date}/auto-assign {route_id}`; the assigned boats are drawn; 409 `no_boats` is the alert | `4122de56` |
| `bkV2UpgTargets` | MISSING-SERVER-FIELD | the list of routes a booking can be upgraded to, with free seats (below); the server refuses `route_not_sailing` / `not_enough_seats` on the command and that stays | - |
| `vehJobsFor` | WIRED | `GET /operations/van-jobs?date=` (`bookings`, `pax` per job of the van); the list of bookings in the van's panel is the browser's | `4122de56` |
| `_vehDayJobN` | MISSING-SERVER-FIELD | the matrix asks the job count of every cell of a month; no month read exists (below) | - |
| `_vehRouteZone`, `_vehRouteDemand`, `_vehGroupsForDay` | MISSING-SERVER-FIELD | route zone, route-day demand, groups without a van (below) | - |
| `vehStatusOn` | WIRED | `GET /operations/van-days` `status_on` (legacy's rule answers for a van whose ranges were just written, until the cells are read again, which a range write triggers) | `4122de56` |
| `vehDayCellClick` | SKIPPED-NOT-NEEDED | the click only offers routes open that day; legacy has no rule on the server side to copy (the server accepts any real route) | - |
| `vanCostSet` | MISSING-SERVER-FIELD | no field for a van's cost per day (below) | - |
| `ctBreakEven` | WIRED | `sheet.key_figures.break_even` for the full seats; for a smaller cap the same first profitable head count when it is within the cap, else none | `1afa2657` |
| `ctCalc`, `ctChdAt`, `ctProfitAt`, `ctStepCount` | MISSING-SERVER-FIELD | the plan's own context and `sheet.curve` points are the server's (earlier waves); any other what-if (a tier price, a typed head count, a modified plan) needs a batch calc (below) | - |
| `ctEffLine` | MISSING-SERVER-FIELD | the override editor's placeholders (effective inputs per part) (below) | - |
| `ctAddPlan`, `ctDupPlan`, `ctFamNewPlan` | WIRED | `POST /v1/costing/plans` with `{name}`, `{copy_of}`, `{name, route_key}` only; the server's plan is adopted | `1afa2657` |
| `ctBlankPlan` | SKIPPED-NOT-NEEDED | only the offline fallback builds a plan now; the defaults are the server's `blankPlan` (checked equal) | - |
| `ctRentBlank` | SKIPPED-NOT-NEEDED | a blank rent record is a form of client facts; its figures come in the `PUT` answer | - |
| `ctRentOf`, `_ctRentOfCalc` | WIRED | the `boat-rents` record's `seats`, `total`, `run_days`, `per_day`, `per_trip` (overlay while the local record equals the saved one: before the answer of a just-typed change legacy's figure shows) | earlier (`w4-f3`) |
| `ctRentSpan`, `ctSeasonOf` | SKIPPED-NOT-NEEDED | only legacy's `ctFactSheet` before the sheet answers; the fact sheet draws `sheet.contract` (`75-ops-costing-sheet.js`); `pxRentIdle` no longer calls them | - |
| `ctRentIdle`, `pxRentIdle` | WIRED | `GET /v1/reports/trip-pl/month` `rent_idle` (read with the month page, not by pier) | `1afa2657` |
| `ctTierSeed`, `ctTierSpread` | WIRED | the plan answer's `tiers_effective` (through `ctTiers`) and `tiers_spread` | `1afa2657` |
| `pxDayAgg` | MISSING-SERVER-FIELD | bands, best boat and per-agent sums of the day (below) | - |
| `pxAgents` | MISSING-SERVER-FIELD | the per-trip agent split with the rate-card total (below) | - |
| `pxMxWhy` | WIRED | `agents[].routes[].why` of `GET /v1/reports/analysis` (73-ops-analysis-why.js, w4-f1); the legacy function is not run in ops mode (tested: a tampered reason is drawn) | earlier; test here |
| `mvCost` | WIRED | `meal_preview.amount` when the heads are the preview's; other heads: price x heads | `1afa2657` |
| `renderTravelSum` | WIRED | `59-ops-travelsum-view.js` draws the manifest from the server's rows (`zone_group`, `trip_amount`, `net`, `add_on_lines`) and `cancelled_rows`. A cancelled row's total cell prints the booking's own total, as legacy | earlier (`w4-f2`) |
| `acctNewInvoiceRender` | MISSING-SERVER-FIELD | the agent drop-down: agents with something to invoice (below) | - |
| `bkV2PayChip`, `bkV2PaidSplit` | WIRED (invoice state, paid, balance) | the booking's own `invoice` and `payment_state`, kept as `bk.opsInvoice` / `bk.paymentState`; `acctBookingInvoice` answers from them when `SB_INVOICES` has none. The PFM labels (hold, extended, past cutoff) and the staff-FOC label are still the chip's own rules: MISSING `pfm_status` below | `1afa2657` |

## What the screens do now

- **Pier Check-in sheet** (`74-ops-pier-service.js` holds the day answer; `83-ops-pier-day.js`): one read per day (and one per picked pier). Every row's arrival, booked and expected heads, split rows (per boat or van part), stage totals and the programme cards (pax, arrived, cleared, boarded, PK / KL done of total, "ออกได้ / ขาด n คน / ยังไม่ถึงท่า") are the server's. A write (a tick, a payment, a booking, a trip-op ...) makes the held answer stale and the open sheet reads again; legacy's arithmetic shows for that moment (same numbers unless two machines disagree).
- **Van Check-in**: the row's colour/status and the order of rows inside a van come from `rows[]`; when the answer differs from what was drawn the sheet draws once more.
- **Move boat**: the dialog opens when `GET .../pier-move` answers; it lists the server's boats with their load, "เกิน cap" and "เต็ม"; Save sends `{boat_id, reason, note?}`; a refusal shows in the dialog as the server words it.
- **Kitchen / lunch slip / overnight meals**: counts, allergy list, slip lines, overnight returns and amount from `meal_preview` (read per boat and day when first needed). While the sheet is filtered (boat, van, search ...) the kitchen card counts the rows shown, as legacy.
- **Guide order and travel register**: legacy's markup and Thai texts; the figures and lists are the server's. The print and the dialog wait for the answers.
- **Costing**: new plans are made by the server; tiers, break-even for a smaller cap; idle rent in the month page.
- **Fleet**: a van's status of the day, and its job / pax count, from the server.

## Decisions (design mindset)

1. **Stale answer = legacy's arithmetic until the fresh one lands** (not a blank): the same rule on the pier sheet, the kitchen, the guide papers and the fleet. A write bumps an epoch; the open screen reads again. Cost: one `GET /v1/pier-checkin` per write while the Pier sheet is open (the old test that a tick does not re-read was changed for this reason).
2. **Totals of a subset (a boat band, a van group) are the sum of the server rows' figures**, not a second server read. `pckAgg` / `pckSheetAgg` are therefore WIRED; the missing `groups` field would remove the summing.
3. **Overlay on legacy's markup for the two papers** (`goSheet`, `pckTravelSheet`): the page is legacy's; its figures are replaced by the server's in the order the page prints them. Less risk than copying 200 lines of print markup; the test fails if the order of the figures ever changes.
4. **Server first for creating and moving**: `ctAddPlan`, `ctDupPlan`, `ctFamNewPlan`, `pckMoveSave`, `baAutoAssign` send the smallest request (name, copy_of, route_key, boat, reason, route) and draw the server's answer.
5. **Pre-checks in the move dialog stay** (pick a boat, pick a reason, "other" needs a note), with legacy's words; the server judges the same.
6. **A cancelled booking not held here** is drawn from the server's `cancelled_rows` entry with a stand-in booking; legacy's list is no longer the fallback.
7. **Booking invoice** state for the By-trip chip comes from the booking read (`invoice`, `payment_state`), so the chip no longer depends on the accounting screens having loaded `SB_INVOICES`.

## Assumptions / things to review

- `wire-07` said `renderVanCheckin` "filters, unarranged rows, search": unarranged rows were wired in w4-f2; the route / programme pills are the value the answer is asked with; the text search is the client's by the README. I did not hide legacy rows the server does not list.
- Guide languages in `booked.prep.languages` are counted on **booked** heads, `pckTripStats` counts heads still travelling: not interchangeable, so not wired.
- `pxRentIdle` reads the whole month's `rent_idle` from `trip-pl/month`; that read computes every day of the month on the server (heavier than a day read). The month page already loads each day; consider serving `rent_idle` from the days it has.
- `bkxExCovered` depends on the sales being held; a sale never opened in the browser keeps legacy's rule.
- `t_walk_w4_f2.mjs` section 3 asserts that a pier tick does not read `/v1/pier-checkin` again; this wave reads it again on purpose (decision 1).
- The Travel Summary page (59) draws the day's roster from `GET /v1/bookings`, so `tsCxlRows` serves the callers that still ask it (the Daily Report data builder).

## MISSING-SERVER-FIELD (what a backend agent should add next)

1. **`pckLineFee`**: `POST /v1/bookings/{id}/pier-payments/preview` `{ lines: [{ method, amount, fee_pct?, fee? }] }` -> `{ lines: [{ fee }], fees, total }` (no write).
2. **`pckTripStats`** (and group totals for `pckAgg` / `pckSheetAgg`): `GET /v1/pier-checkin` -> `groups: { boat: { <boat_id>: G }, van: { <van_id>: G }, zone: { <PK|KL|OWN|NOVAN>: G } }`, with `G = { n, pax, arr, clr, on, due, no_show, real: { ad, chd, inf, foc, total }, booked, lost, languages: { <code>: heads still travelling }, meals: { veg, vegan, halal, allergy }, lt_join, lt_charter }`.
3. **`ckRetVan`, `pckJobDrop`, `tsSendBack`**: `rows[].return = { kind: 'self' | 'van' | 'same' | 'pending' | null, van_id, drop_off }` on `GET /v1/pier-checkin`, `GET /v1/van-checkin` and the travel summary rows (today only on a van job sheet row: `return_van_id`, `drop_off`, `drop_own`).
4. **`pckJobService`**: `rows[].service.lines = [{ kind: 'ex' | 'upg' | 'addon', label, qty, amount, done }]` on `GET /v1/pier-checkin` (the combined Service list the job card prints).
5. **`goIsGuide`** in the guide register: `licensed: boolean` on every entry of `GET /v1/config/guides` (computed).
6. **`tsRefPackList`, `tsInvSlips`, `tsSlipPackList`**: `GET /v1/reports/travel-summary` -> `reference_pack: [{ booking_id }]` and `slip_pack: [{ booking_id, paid, missing, slips: [...] }]`.
7. **`drTrendBooked`**: `GET /v1/bookings/daily-counts?markets=1` `days[].markets` as `{ <market>: { bookings, pax } }` (today a bare booking count).
8. **`bkV2UpgTargets`**: `GET /v1/bookings/{id}/upgrade-targets?date=` -> `[{ route_id, route_name, boat_id?, free_seats, allowed, reason? }]`.
9. **Transfer Fleet**: `GET /operations/van-days` `days[].jobs` (jobs or bookings the van carries that day); `routes[].zone` on the route catalogue; `GET /operations/van-board` `routes[].demand { pax, pickup }` and `routes[].groups_without_van`; `vans.cost_per_day` (nullable number, `PATCH /operations/vans/{id}`) for `vanCostSet`.
10. **`ctCalc`, `ctChdAt`, `ctProfitAt`, `ctStepCount`** for what-ifs: `POST /v1/costing/calc-batch { plan, template?, scenarios: [{ pax?, price?, price_child?, ... }] }` -> `[{ calc, children, step_count, break_even }]` (one request for the tier table, the curve and the plan comparison).
11. **`ctEffLine`**: `sheet.line_parts[].parts[]` with the effective inputs after the plan's overrides (`qty`, `unit`, ...), not only `amount`.
12. **`pxDayAgg`**: `GET /v1/reports/trip-pl` day answer: `bands [{ n, net, pax }]` x 4, `best { boat_id, profit }`, `agents` sums, per-boat list.
13. **`pxAgents`**: `trips[].agents = [{ agent_id, name, heads, revenue, expected_total }]` (the rate-card total per trip).
14. **`acctNewInvoiceRender`**: `GET /v1/invoices/candidate-agents?kind=booking|prepay` -> `[{ agent_id, name, bookings, total }]`.
15. **`bkV2PayChip` PFM / staff labels**: `pfm_status` (`hold | approved | paid | prepaid_part | alert | awaiting | no_invoice`) and `past_cutoff` on the booking read.
