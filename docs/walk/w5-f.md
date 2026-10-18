# w5-f · group F of the wiring recheck (2026-10-18)

Branch `wire/w5-f`. Reports: `operation-backend/docs/verify/wire2/wire-11.md`, `wire-12.md` (the "NOT-WIRED and WIRED-PARTLY" rows).
Idiom: every function is wrapped from `js/ops/*.js`; legacy answers outside ops mode and until the server's first answer.
New files: `ops/85-ops-pier-w5.js`, `85-ops-pier-roster-w5.js`, `85-ops-pier-towels-w5.js`, `85-ops-pier-park-w5.js`, `85-ops-fleet-report-w5.js`, `85-ops-b2b-group-w5.js`, `85-ops-cash-longtail-w5.js`, `85-ops-contract-sections-w5.js` (script tags before `90-ops-boot.js`). Test: `test/ui/t_walk_w5_f.mjs`.

## Function table

| Function | Verdict | Endpoint / field | Commit |
|---|---|---|---|
| `pjChtrOf` | WIRED | job `charter { who, heads, mixed, seat_heads, voucher }` | `40ff6be1` |
| `pjItinOf`, `pjItinSet`, `pjItinColor` | WIRED | job `itinerary { text, own, colour, from }`; `PATCH …/job { itinerary_text, itinerary_colour }` | `40ff6be1` |
| `pjCopyYday` | WIRED | `POST …/days/{date}/jobs/copy-yesterday` → `{ copied, skipped_complete, none_yesterday }` | `40ff6be1` |
| `pjPrep` (long-tail heads `lt`) | WIRED | `days/{date}/boats` `boats[].booked.join_heads` | `40ff6be1` |
| `pjAllBoats` | WIRED | `days/{date}/boats` `fleet[]` (which boats, their order, away) | `40ff6be1` |
| `pjGdLead` | WIRED | `GET /v1/guide-orders/{date}/{boat}/sheet` `lead_guide` | `40ff6be1` |
| `pjMjOf` | SKIPPED-NOT-NEEDED | the offered jobs are the fleet-jobs cache (`ops/24`, from `GET /v1/fleet/jobs`); the server refuses a wrong `maintenance_job_id` (400) | - |
| `paRowTotal`, `renderPierAtt` (per-code counts, work days, TOTAL, nights) | WIRED | roster `rows[].totals { by_code, work, row_total, nights }` | `40ff6be1` |
| `paRangeApply` | WIRED | `POST …/roster/range` → `{ written, skipped }` | `40ff6be1` |
| `paNote`, `paCycNote` | WIRED | `PUT …/roster/notes/{cycle}/{staff}`, `GET …/roster/notes?cycle=` | `40ff6be1` |
| `paCycle` | SKIPPED-NOT-NEEDED | cycle dates follow the synced `cycle_start` setting; the roster read takes the screen's `from`/`to` and echoes them | - |
| `poTowelQ`, `poLaundryOpen`, `poQAge`, `poLaundryBlock` (through them), `PO_DIRTY_DUE`, `PO_LAUNDRY_DUE`, `poTodayYMD` | WIRED | `GET …/stock` `towels`, `items[].queue`, `limits`, `today` | `40ff6be1` |
| `pkNmFillLead` | WIRED | `POST …/park-tickets/{date}/fill-lead { boat_id }` | `40ff6be1` |
| `pkNmLeadDup`, `pkNmDropLeadDup` | WIRED | `GET park-tickets` `boats[].lead_duplicates`; drop = `PUT …/names { name: null }` | `40ff6be1` |
| `pk2Month` | MISSING-SERVER-FIELD | see below | - |
| `pkPrice`, `pkPriceSet` | SKIPPED-DESIGN | the park price is the route's cost plan (Q20, decision 20); the typed `parkPrice` is deliberately not imported or used (`todo/frontend-wiring-decisions.md`, "Closed without building (2026-10-17)") | - |
| `repFleetGather` | WIRED | `GET /v1/fleet/reports/fleet?from=&to=` (`current`, `previous`, `stock`, `data_gaps`) | `40ff6be1` |
| `pc2LTDay`, `pc2LT` (booked side, via `pxLongtail`) | WIRED | `days/{date}/boats` `booked { join_heads, charter_boats, upgrades, upgrades_due }` | `40ff6be1`, `be5645f1` |
| `pcLtUsed` | SKIPPED-NOT-NEEDED | the keyed side is the sheet cell (`join_boats`, `charter_boats`, `used_boats`) the cash adapter already pours in; it is a sum of two cell values | - |
| `CT_DOC_SECTIONS` | WIRED | `GET /v1/contract-templates/sections`; template `sections_effective` | `40ff6be1` |
| `bkNbfChecks` | SKIPPED-DESIGN | a checklist of hints while the form is filled; the server has no check-without-saving call, and its `400 booking_incomplete` list is shown on save (`ops/40`). Nothing to ask the server before the save | - |
| `b2dSum` for a route group of 2+ families | WIRED | `GET /v1/reports/b2b` `by_trip[]`: the group's figures are the sum of its families' server figures | `40ff6be1` |
| `b2dAgents`, `b2dBridge`, `b2dShiftSignal`, `b2dTabsScreen` for such a group, and the agent / sales / market detail pages | MISSING-SERVER-FIELD | see below | - |

BROWSER-RULE rows of the reports (`poWhoOk`, `poWhoGuard`) were not on my list (they are not NOT-WIRED or WIRED-PARTLY rows).

Counts: WIRED 20 rows, SKIPPED-NOT-NEEDED 3, SKIPPED-DESIGN 2, MISSING-SERVER-FIELD 2.

## MISSING-SERVER-FIELD (for a backend agent)

1. **`pk2Month`** (park month overview). `GET /v1/pier-office/{pier}/park-tickets/month` answers per boat `counts`, `heads`, `tickets`, `diff`, `miss_total`, but the screen also shows, per boat and day, the heads by nationality and category (`pax8`: `ad_th, chd_th, inf_th, foc_th, ad_fr, chd_fr, inf_fr, foc_fr`, the columns "ไทย / ต่างชาติ / FOC") and "should be issued" (`cntPc`). Needed: in `days[].boats[]` add `nationality { ad_th, chd_th, inf_th, foc_th, ad_fr, chd_fr, inf_fr, foc_fr, tot }` (the same object as `booked.nationality` of `GET …/days/{date}/boats`), and per day / total the sums of it. With it, `pk2Month` can be rebuilt from the month read (today it only draws the loaded day).
2. **B2B dashboard, a route group made of several server families** (Phi Phi = Phi Phi Bamboo + Whale Shark; Other = six families), and the detail pages. `GET /v1/reports/b2b` serves per family only. Needed: a query parameter `families=<id,id>` (or `group=`) that answers the report's `agents[]` (with `route_current`, `route_previous`, `route_class`, `route_growth_pct`, `signal`) for the union of those families, the `bridge` of the route (`b2dBridge` on a group), and `kpis` for it. For the agent / sales owner / market detail pages: `GET /v1/reports/b2b/agent/{id}` (and `/staff/{id}`, `/market/{code}`) answering that entity's period figures, its monthly series (`[{ month, revenue, pax, bookings }]`), and its split by route family (`[{ family, current, previous, class, growth_pct }]`), with the same `from/to/basis/compare/threshold` query. Until then these stay the browser's sums over the trip lines (`ops/55`).

## Decisions taken (design mindset)

1. **Itinerary: the server's carry rule is shown** (lk-inbox `§pjItinCarry`): an untouched day borrows the same boat's nearest earlier day on the same programme (up to 14 days back), and a cleared text means "none today", not the route's islands. Main's legacy code shows the route's islands for a cleared text; the server's answer is what is drawn now. Typed text goes as typed (`->` is turned into `→` by the server; over 200 characters is the server's 400 and the card goes back).
2. **Cycle notes are not cut at 120 characters by the browser** (legacy cut silently). The typed text goes as typed; the server's 400 ("at most 120") shows as a toast and the box goes back to the saved note.
3. **Roster totals are used only when current**: before the roster of the range was read, after any pier write (the read is asked again), and while a hand edit waits to be sent, legacy's own counting shows. One small marked edit in `renderPierAtt` (`08-app.js`, `[w5-f small edit]`) takes the person's counts, work days and nights from `window.opsPierAttTotals`; `paRowTotal` answers the server's `row_total` for such a count object.
4. **Towels**: the batches, limits and "today" are the server's while the stock read is current; after a write legacy's queue shows until the read is back. `PO_DIRTY_DUE` / `PO_LAUNDRY_DUE` are overwritten with `limits`; `poTodayYMD` answers the stock read's `today` so every "N days" mark counts from the server's day.
5. **Long-tail booked side** is asked per pier and day (`days/{date}/boats`, shared with the pier job card). In the month view each day is asked once; a write refreshes only the days drawn on screen. Petty cash can be the first pier screen opened, so the sheet reads the pier office lists first.
6. **Group sums of the B2B dashboard**: a route group of two or more families is the sum of the server's family numbers (revenue, pax, bookings, previous). Class, growth and signals of such a group stay the browser's (missing field 2).
7. **Fleet report**: `repFleetGather` maps `current` / `previous`; the "where the data is thin" sentences stay the screen's text over the server's codes. The server's rules differ from legacy's gather in places (jobs counted by start date, cancelled projects left out, engine hours for every trip type; `todo/frontend-wiring-decisions.md` item 21): the numbers on screen are now the server's.
8. **`copy yesterday`** is one command; the browser no longer reads yesterday's cards or copies slot by slot.

## To review

- `pjAllBoats` now follows the server's list and order (running boats first, then by the server's order); legacy sorted by state then departure and name. A boat the server does not list for the pier is not drawn.
- `pjGdLead` asks the order's `sheet` once per boat per day (redrawn only if the lead differs).
- The test seeds a lead-copy name through a rewritten answer (the in-process store refuses such a name as a duplicate); the month view of the long-tail sheet asks one `days/{date}/boats` read per day with boats (up to 31 at first open).
- Tests: `node test/ui/t_walk_w5_f.mjs` (sections 1 to 8), `t_ops.mjs`, `t_walk_pier.mjs`, `t_walk_w4_f2.mjs`, `t_walk_w4_f1.mjs`, `t_walk_agents.mjs`: results in the final reply of the agent.
