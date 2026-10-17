# r2-fleet · fleet rules and fields wired to the server (2026-10-17)

Branch `wire/r2-fleet`. Server side: operation-backend `todo/rules-fleet-model.md` (decided rules) and `todo/fleet-fields-model.md` (earlier fleet fields).
Idiom: every legacy function is wrapped from `js/ops/*.js` (`wrap('fn', function(orig, ...){...})`); legacy answers outside ops mode and until the read has arrived.
Where a render cannot be wrapped from outside, the smallest edit sits in the legacy file (listed in section 4).

Checks: `node --check` on every changed file; `node test/ui/t_ops.mjs` green; `node test/ui/t_walk_fleet2.mjs` (new, 14 items, about 40 checks against the real backend) green;
`node test/ui/t_walk_fleet.mjs` gives the same two failures as before this work (see section 5).

## 1. Functions done

Status: WIRED / SKIPPED-DESIGN / SKIPPED-NOT-NEEDED / SKIPPED-OTHER. Commits: `5ad4c768` service + asset fields, `99fcaf5c` job / daily-log / project fields, `38fa499e` views, repairs, stock, charter, inspection, `0267aec2` inspection fix + test.

### A. Decided rules now on the server

| Legacy function | File | Status | Server field / endpoint |
|---|---|---|---|
| `flRenderDashboard` (Service due tile) | `05-fleet.js`, `ops/68` | WIRED | `GET /v1/fleet/dashboard` `service_due` (fixed 500 h, next multiple, from 70 %); `flDashServiceDue(ds)` |
| `flRenderDashboard` (cost trend card) | `05-fleet.js`, `ops/68` | WIRED | dashboard `cost_trend` (`flDashCostTrend(ds)`) |
| `renderFleetTab` | `04-data-core.js`, `ops/23` | WIRED | engine `service` (`next`, `left`, `pct`) through `flEngListService(e)` |
| engine list rows, "service due" count (`flRenderEngList`) | `05-fleet.js`, `ops/23` | WIRED | engine `service` (`next`, `left`, `due`) |
| `flUpdateAssignEngInfo` | `06-engine-assign.js`, `ops/23` | WIRED | engine `service` (`next`, `left`) |
| `flEngServiceState` (detail panel, Fleet Assets rows, Insights) | `ops/23` | WIRED | engine `service_last` (was `service`; the old object moved) |
| `costAggregate` | `ops/68` | WIRED | `GET /v1/fleet/reports/cost?period=` (totals, categories, types, boats, units, rows, `central`, 12 `months`) |
| `laMemoDirectShare` | `ops/68` | WIRED (through `costAggregate`) | the share is the server's `directShare`: in ops mode the function is no longer reached |
| `flRenderInsights` | `05-fleet.js`, `ops/68` | WIRED | `GET /v1/fleet/insights` `kpis.jobs`, `kpis.spent`, `boats[]` (`jobs`, `jobs_active`, `cost`, `incidents`) |
| `flBoatRepairCostMonth` | `ops/26` | WIRED (adapter already read the upkeep report) | `GET /v1/fleet/reports/upkeep?month=`; comment updated: jobs by start month, any status |
| `renderFuelIntel` | `ops/26` | SKIPPED-NOT-NEEDED | already reads `GET /v1/fleet/reports/fuel`; the job-dating change does not touch the fuel report |
| `faInvRows`, `faInvAt` | `05-fleet.js`, `ops/25` | WIRED | `stocks[].min_qty`, `below_min` per line (item `lines_below_min`, `line_mins`) |
| `faSpInvBlock` | `05-fleet.js` | WIRED | the "N under minimum" count is the lines' `below_min` |
| `flOpenLogInspectionModal` | `ops/26` | WIRED | a new inspection's next-due is only a prefilled hint (`dataset.auto`); if the person does not touch it, `next_due` is left OUT of `POST …/inspections` and the server fills it (date + category `pmMonths`) |
| `invLostScan`, `_invSurplus` | `ops/69` | WIRED | `GET /v1/fleet/stock-repair/lost` (read when the panel opens, `invDupOpen`) |
| `invLostFix` | `ops/69` | WIRED | `POST /v1/fleet/stock-repair/lost/fix {memo_id, idx}`; the confirm text is legacy's, filled from the scan |
| `costNoDropDupes` | `ops/69` | WIRED | `POST /v1/fleet/duplicates/numbers/drop-copies {kind, no}`; `409 not_a_true_copy` shows legacy's "ไม่ใช่ใบซ้ำแท้แล้ว" alert |
| `laRenumberOne` (via `costNoRenumberOne`) | `ops/69` | WIRED | `POST /v1/fleet/duplicates/numbers/renumber-one {kind, id}` |
| `laRenumberSet` (via `costDupRenumber`) | `ops/69` | WIRED | `POST /v1/fleet/duplicates/numbers/renumber {kind}` |
| `laDupClean` (via `costDupClean`) | `ops/69` | WIRED | `POST /v1/fleet/duplicates/clean {kind}` (`maint`, `memo`, `incident`; the nested sets cannot occur on the server: "nothing to clean") |
| `laDupCleanAll` (via `costDupCleanAll`) | `ops/69` | WIRED | `POST /v1/fleet/duplicates/clean-all` |
| `saveCharterBoat` | `ops/22` | WIRED | add: `POST /v1/boats` `ownership: charter` + `period {from_date, to_date, note}`; edit: `PATCH /v1/boats/{id}` and `PATCH …/status-log/{entry}`; `409 charter_overlap` shows the server's "Save anyway?" text, a yes sends `overlap_anyway: true` |
| `LOCATION_TYPES` | `04-data-core.js` | SKIPPED-NOT-NEEDED | only the status form's menu; the server takes any `loc_type` text and a charter boat's window needs none |

### B. Fleet fields merged earlier, now wired

| Legacy function | File | Status | Server field / endpoint |
|---|---|---|---|
| `flBoardBoatDown` | `ops/24` | WIRED | job `days_blocked` (largest of the jobs'; 0 when the job does not hold its boat) |
| `flwParked` | `ops/24` | WIRED | job `parked_reason {key, label, source}` |
| `flwItems` | `ops/68` | WIRED | `GET /v1/fleet/work` `items[]`: `stage`, `silent_days`, `cost`, `parked` |
| `flwBoats` | `ops/68` | WIRED | `GET /v1/fleet/work?boats=&stage=` `boats[]`: which boats, `is_down`, `days_blocked`, order |
| `flRenderWork` | (draws from the two above) | WIRED | no wrapper of its own; page redraws when the read arrives |
| `faPart` | `ops/23` | WIRED | asset `flags` (the data-to-fix flags) |
| `faStages` | `ops/68` | WIRED | `GET /v1/fleet/assets/summary` `engines`, `gearboxes`, `propellers` |
| `faRenderOverview` | `ops/68` (`faShell`) | WIRED | summary `engines.total`, `gearboxes.total`, `propellers.total`, `data_to_fix` (tiles and the "data to fix" chip) |
| `faSpRight` | `ops/68` | WIRED | summary `flag_counts` (the count on each "data to fix" line) |
| `faPartDetail` | `05-fleet.js`, `ops/23` | WIRED | asset `repair_cost`, `repair_jobs_done`, `repair_jobs_total` |
| `flRenderDR` | `05-fleet.js`, `ops/26` | WIRED | daily-log boat row `status`, `operated`, `ran_despite`, `pax_effective`; day `piers[]` (`pax`, `trips`, `operating`, `fuel_litres`, `fuel_cost`, `fuel_cost_missing`); `closed_piers` |
| `flProjCostBreakdown` | `ops/26` | WIRED | project `cost_breakdown` `parts`, `labour`, `memos`, `total` |
| `flProjMJCostBreakdown` | `ops/26` | WIRED | `cost_breakdown.child_jobs[]` line of the job |

What the new test proves (`test/ui/t_walk_fleet2.mjs`, against the real backend): the screen's figure equals the server's for engine service (list and detail rule), days blocked and parked label, Fleet Work stages and boat rows, asset stage counts and the "data to fix" tile, repair cost on an engine, dashboard service-due rows and cost trend, cost totals, insights, per-line stock minimums, project cost split, daily-log boat and pier fields, charter add and the overlap question, the inspection body without `next_due` and the server's date equal to the hint, and that the lost-stock panel and the duplicate buttons call the server.
Not exercised against real data (the API cannot make the case, only imported data can): a lost stock line being fixed, and renumber-one / renumber / drop-copies on real clashing numbers. Those paths are covered by the backend's own tests; here only the calls and messages for the empty case are checked.

## 2. Fields and rows created

No row, table or config key in the frontend. New browser-side properties and hooks (all read-only copies of the server's answer):

- engine: `serviceLast`, `flags`, `repairCost`, `repairJobsDone`, `repairJobsTotal`; gearbox and propeller: `flags`, `repairCost`, `repairJobsDone`, `repairJobsTotal`
- job: `daysBlocked`, `parkedReason` (`false` = server says not parked on purpose)
- stock item: `linesBelowMin`, `lineMins`; stock line: `minQty` (now the line's), `minOwn`, `belowMin`
- globals the legacy renders ask (guarded by `typeof`): `flEngListService`, `flDrServerBoat`, `flDrServerPier`, `flDrPierClosed`, `flDashServiceDue`, `flDashCostTrend`, `flInsightsServer`
- new adapters: `js/ops/68-ops-fleet-views.js` (reads: work, assets summary, dashboard, cost report, insights; one cache, marked stale on a write or change event), `js/ops/69-ops-fleet-repairs.js` (lost stock, duplicates); `laOps.fleetViews`, `laOps.fleetRepairs`
- DOM: `dataset.auto` on `#fl-insp-nextdue` (1 = prefilled hint, not typed by a person)

## 3. Decisions needed

1. **Three answers for one engine (legacy, kept):** the Fleet tab / engine list say "70 h to svc" (next multiple), Fleet Assets rows and the detail panel say "100 h to svc" (from the last service), the dashboard tile uses a fixed 500 h. The server serves all three as decided (Q1). Confirm this is what the screens should show.
2. **Cost Analytics now shows what the server computes:** the 12-month chart always has 12 months (legacy showed one month under "this month"), and the central memo list follows the period filter (legacy ignored it). Both are the backend's "looks wrong, not copied" items; say if legacy's behaviour should be asked of the server instead.
3. **Daily Log, fuel cost per boat row:** the pier total uses the server's `fuel_cost` (the boat's price, else its home pier's). The boat row's own small "฿" figure stays legacy's (litres times the price typed in that row, only when a price is typed). Decide whether the row should show the server's figure too.
4. **Charter boat status form:** `saveStatus` (the timeline form) still asks for province and location type for every boat, as legacy does; the server no longer requires them on a charter boat. Decide whether the form should drop those two fields for charter boats.
5. **Charter edit is two requests:** the window (status-log entry) first, then the boat (name, type, seats, pier). If the person declines the "seats sold" question after the window was saved, the window stays saved. Legacy was one local change. Decide if the server should offer one command.
6. **Charter edit, which window gets the new place:** a `PATCH` of the pier moves the place of the window covering today (else next, else latest), not necessarily the window open in the form.
7. **Duplicate scan screens still read the browser's copies:** `laDupScan` and `costDupInspect` (the bar and the drawer) were not in the list; only the buttons go to the server. `GET /v1/fleet/duplicates` could replace the scan too. Decide.
8. **Lost-stock panel:** the pull is offered only when the server says `pull.possible`; legacy offered it when the surplus was at least the quantity, so a line legacy would pull may now say "will only create the item".
9. **Job board fields:** `parked_reason` source `parked` and the board lane / owner come as null from imported data (backend note); the Work page will show no job as "parked on the job board" until production's source of that field is found.

## 4. Legacy files edited (smallest edits, each guarded by `typeof` or `_fromOpsBackend`)

- `04-data-core.js` `renderFleetTab`: next / left / pct from `flEngListService` (4 lines)
- `05-fleet.js`: `flRenderEngList` (`dueEngs`, `buildEngRow`), `flRenderDashboard` (`engineDue`, cost-trend buckets), `flRenderDR` (boat effective pax, `_drPierClosed`, `sectionCard` pier totals), `flRenderInsights` (period spend, jobs, boat stats), `faPartDetail` (repair cost), `faInvRows` + `faSpInvBlock` (line `below`)
- `06-engine-assign.js` `flUpdateAssignEngInfo`: reads `flEngListService`
- `allotment_v2.html`: two script tags (68, 69) after `26-ops-fleet-daily.js`; existing `?v=` hashes were not recomputed (see 5)

## 5. Test notes

- `t_walk_fleet.mjs` fails two checks before and after this work (same on commit `2a725bdb`): "oversell edit" and "flBoatBookingsFor pax" — the backend now refuses to confirm a booking without lead nationality and guide language, so the test's seed booking is not created. Not caused by this branch. One earlier run of the same file stopped at item 2 (route create) and passed on the next run: it looks flaky.
- `t_assetver.mjs` already fails at the base commit on Windows (the `?v=` hashes are of LF text, the checkout has CRLF); the deploy build re-stamps them.
- `test/unit/ops-fleet-daily.test.mjs` stops at `O.onWrite is not a function` in its stub (a line this work did not add); not compared against the base commit.
