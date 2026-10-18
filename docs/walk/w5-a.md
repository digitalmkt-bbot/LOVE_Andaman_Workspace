# w5-a · leftovers of the wiring recheck, reports wire-01 and wire-02 (2026-10-18)

Branch `wire/w5-a`. Reports: operation-backend `docs/verify/wire2/wire-01.md` and `wire-02.md` (rows of "NOT-WIRED and WIRED-PARTLY").
Server: operation-backend `README.md` (embed token, `/v1/users` `dept_effective`, `/operations/deployments/swap`, `/operations/boat-replacements`, `/v1/availability`, `/v1/fleet/dashboard`, config `bop2_templates`), `todo/decisions-answers.md` (Q3, Q49, Q52, 58, 60, 61).
Idiom: every legacy function is wrapped from `js/ops/*.js` (legacy runs outside ops mode and until the server's first answer). New files: `ops/80-ops-bop-bulk.js`, `ops/80-ops-w5a-reads.js` (script tags in `allotment_v2.html`, after `76-ops-fleet-kpis.js`). Test: `test/ui/t_walk_w5_a.mjs` (60 checks).

## Counts

33 rows: **22 WIRED, 3 SKIPPED-NOT-NEEDED, 2 SKIPPED-DESIGN, 6 MISSING-SERVER-FIELD.**

## Function table

Commit key: `d55ef39b` embed · `dc3f1c5d` department · `a1322e83` everything else · `9170f273` test only.

| Row (report) | Verdict | Endpoint / field | Commit |
|---|---|---|---|
| wire-01 Embed: `embedTokenOk`, `embedSessionCookie`, `GET /embed/*` (`10-embed.js`) | WIRED | `POST /v1/embed/token {ticket}` -> read-only Bearer (details below). The short `/embed/calendar` and `/embed/bytrip` redirects are not reproduced (SKIPPED-DESIGN, see decisions) | `d55ef39b`, `a1322e83` |
| wire-01 `laGuessDept`, `laDeptOf` | WIRED | `GET /v1/users` `dept_effective` -> row `deptEffective`; the username guess stays for the add-user hint and offline | `dc3f1c5d` |
| wire-01 `window.LA_UID` (ids of invoices, payments, jobs, inventory, engines, gearboxes) | WIRED (audited, no change needed) | every caller is wrapped by an ops adapter (list below) that sends no client id; the test mints `ZZUID_` ids and checks no request body carries one | `a1322e83` (test) |
| wire-01 `_dashBkTs`, `_dashBkDay` | WIRED | the entry day is the Bangkok (+07:00) day, as `GET /v1/bookings/recent created_from/created_to` filters it | `a1322e83` |
| wire-01 `renderDash` bucket stats (top 3 + Other, best / slowest, averages) | MISSING-SERVER-FIELD | see list, item 1 | - |
| wire-01 `_calSetByName`, `calSetNameCheck` | MISSING-SERVER-FIELD | see list, item 2 | - |
| wire-01 `_calPierClosed` | SKIPPED-NOT-NEEDED | it is "every route of the pier is closed" over `getDayStatus`, which is already the server's calendar (`GET /v1/routes?from&to` days[date]); same rule as the server's `closed_piers`. No number or rule of its own | - |
| wire-01 `renderCal`, month stats, `routeCards` | MISSING-SERVER-FIELD | see list, item 3 | - |
| wire-01 `getStoredStatus`, `boatEffStatus` outside Boat Operation | SKIPPED-DESIGN | decision Q3 (Boats screen keeps legacy status); Boat Operation already reads the server (`ops/71`) | - |
| wire-01 `getBoatShopLocation` | WIRED | `GET /v1/boats` `at_shop` (the boat's `atShop`; `null` = no started job -> `''`) | `a1322e83` |
| wire-01 `getOp`, `opLocked`, `opHoldOnly` | SKIPPED-NOT-NEEDED | hints; `POST /operations/deployments` 409 `charter_boat` / `boat_held` is final and `ops/20` rolls the cell back and shows the server's text | - |
| wire-01 `bop2PierIssue` | SKIPPED-NOT-NEEDED | hint; 409 `boat_other_pier` is final (shown by swap, deployments) | - |
| wire-02 `bop2LoadTemplates`, `bop2SaveTemplates`, `bop2SaveTemplateForm`, `bop2ApplySaveTemplate`, `bop2DeleteTemplate` | WIRED | `GET` / `PUT /v1/config/bop2_templates` through the config store (`ops/61`); the form functions stay legacy, they call the two storage functions | `a1322e83` |
| wire-02 `bop2ApplyTemplate` | WIRED | reads the server list; the deployments it creates go through `POST /operations/deployments` (`ops/20` diff-sync), each judged by the server | `a1322e83` |
| wire-02 `bop2CopyWeekToNext`, `bop2CopyDayToWeek`, `bop2ApplyAssignRange`, `bop2ApplyWeekdayPattern`, `bop2ClearWeek` | SKIPPED-DESIGN | keep the browser pre-guards (decision below); the server stays final and rolls back | - |
| wire-02 `bop2ApplySwap` | WIRED | `POST /operations/deployments/swap {service_date, boat_a, boat_b[, remove_anyway]}` | `a1322e83` |
| wire-02 `bop2ReplacePlan` | WIRED | `POST /operations/boat-replacements {dry_run: true}` (cached per boat / dates, redraws the preview when it lands) | `a1322e83` |
| wire-02 `bop2ApplyReplace` | WIRED | the dry run for the confirm text, then one `POST /operations/boat-replacements`; the diff-sync sends nothing for it | `a1322e83` |
| wire-02 `bop2RenderShell`, `bop2RenderHeatmapRow` | WIRED | sold %, "full", charter cell, seats: `getAllotment` now takes pool / charter seats / sold share from the server's `deployments` of `GET /v1/availability`; status and pier from the Boat Operation scope (`ops/71`); "needs a boat" from `boat_broken` / `unplaced_pax` (already) | `a1322e83` |
| wire-02 `fcLoadMap` | WIRED | `GET /v1/fleet/daily-log?from&to` `boats[].pax_booked` | `a1322e83` |
| wire-02 `fcCell` | WIRED | runs inside the `ops/71` Boat Operation scope (`GET /v1/fleet/availability`, `/v1/fleet/boat-operation`): status, pier, charter flag of the day | `a1322e83` |
| wire-02 `getRouteStatusNow`, `isRouteActiveToday` | WIRED | `GET /v1/routes?from&to` days[today] (override, season, outside-all-seasons) | `a1322e83` |
| wire-02 `renderSettings` KPIs, `renderProgDetailPink` badge | WIRED | follow `getRouteStatusNow` (they call it) | `a1322e83` |
| wire-02 `progCountBookingImpact` | MISSING-SERVER-FIELD | see list, item 4 | - |
| wire-02 `getSeatsConsumed` | WIRED | `GET /v1/availability` `booked_pax` (a no-show keeps its seat, Q52 / 58); the three direct callers read it | `a1322e83` |
| wire-02 `getAllotment` local count / loading state | WIRED | `ops/50` already replaces the seat fields with the server's; legacy's count only shows until the first answer (the task's rule), no loading state added (SKIPPED-DESIGN for that part) | `a1322e83` |
| wire-02 `getBookingsForRouteDate` | WIRED | `GET /v1/manifest?date&route_id` (its only caller is the charter-this-boat confirm) | `a1322e83` |
| wire-02 `bkPendHoldsSeat` | WIRED | booking read `allocated_pax` (0 = holds no seat) -> `bk.srvAllocatedPax` | `a1322e83` |
| wire-02 `agentTrend` | WIRED | `GET /v1/sales-board` agent `trend.category` / `pct` / `change`; the badge and note texts stay legacy's | `a1322e83` |
| wire-02 `flMaintCostShare` | MISSING-SERVER-FIELD | see list, item 5 | - |
| wire-02 `flBoardScan` | WIRED | `GET /v1/fleet/dashboard` `board` (`open`, `boats_down`, `company_boats`, `money_tied`, `silent_over_60`, `no_owner`, `parked`) | `a1322e83` |
| wire-02 `flExtraToCol` | MISSING-SERVER-FIELD | see list, item 6 | - |

## Embed in detail (`10-embed.js`)

- The page URL carries the ticket as `?t=<ticket>` (legacy `server.js` name) or `?ticket=`. The file is the first script, so it posts the ticket (`POST /v1/embed/token`, body only, synchronous XHR) **before** `01-auth-sync.js` boots, keeps the Bearer in `sessionStorage` (`la_ops_token`, this tab only), sets `la_ops_embed=1` and removes the ticket from the address bar at once.
- Legacy rule kept: a session already in the tab wins, the ticket does not replace it.
- An embed token is read-only for the server, so the page is forced read-only (`edit=1` no longer opens the buttons) and `window.__laEmbedToken` is set.
- A refused ticket (401, 404 door shut, 429): no token is kept; the page shows legacy's "ยังไม่ได้เข้าสู่ระบบ" card with the server's message under it, as it is.
- The boot in embed mode skips every load the token may not make (staff, nationalities, cancel reasons, park tickets, add-on types, market data, meals, markets, sales, `/v1/config`, `/v1/changes`, seat-lock groups, capacity overrides). Before this, `catalogue` failed (markets and sales are 403) and the page kept seed routes.

## LA_UID audit

Callers and their adapters (all send no client id; the server makes the id): `acctCreateInvoice`, `acctCreateFeeInvoice`, `acctRecordPayment`, `acctCreateDeposit` (`ops/30-ops-money`), `pckPaySave` (`ops/44`), `vsSave` (`ops/35`), `flSaveCreateJob`, `flSaveIncident`, `flEngSplitIntoJobs`, `flSplitExistingJob` (`ops/24`), `flSaveMemo`, `flConsumeSubmit` (`ops/25`), `flSaveEngine`, `flSaveGearbox`, `flSavePropeller` (`ops/23`), `agCreateSubmit`, `agImportApply` (`ops/10`, `ops/16`), `ctSaveAddPromo` (`ops/18`), `rtSaveDraft` (`ops/17`, covers `rtClone`'s draft). The test drives the deposit and invoice creates with a sentinel `LA_UID` and checks the bodies. `flLoad` (`05-fleet.js:5097`) is the legacy blob loader, not a create.

## Small marked edits in other files

`ops/20` `adopt()` (take a server-made deployment change without sending it); `ops/71` `O.boatOperation.run` (enter the Boat Operation scope from another file); `ops/40` `bk.srvAllocatedPax` (read-only, never sent: checked in the test); `ops/27` `O.salesBoardFor`; `08-app.js` two `agentTrend(p, pp, id, ym)` call sites; `ops/10`, `ops/30`, `ops/49`, `ops/61`, `ops/70`, `ops/90` skip loads in embed-token mode; `ops/61` adds `bop2_templates`; `01-auth-sync.js` `laDeptOf`; `ops/14` `deptEffective`.

## Decisions taken (design mindset, to reverse if wrong)

1. **Embed ticket arrives as `?t=` (also `?ticket=`) on the page URL** and is exchanged in the page, not by a redirect route. `/embed/calendar` and `/embed/bytrip?date=` need a host rewrite (static hosting here, no `server.js`): SKIPPED-DESIGN; CS builds `allotment_v2.html?embed=1&view=booking&tab=cal&t=...`. The backend allow-list does not include `/v1/seat-lock-groups` or `/v1/boats/{id}/capacity-overrides`; the embedded pages work without them (single locks only, no per-day seat overrides), add them there if the embedded calendar must show groups.
2. **Department:** the server's `dept_effective` wins everywhere the Users window groups people.
3. **Entry day** (`_dashBkDay`) is the Bangkok day, like the server's feed filter; before, it was the browser's local day (a browser outside +07 put late bookings on the wrong day).
4. **Today's status of a route** now follows overrides and "outside all seasons", like `getDayStatus` and the server calendar. A route with no season (the server says `no-seasons`, open) keeps legacy's "no data" (null), so Settings and Programs look as before for those. New difference from legacy: a route whose override closes today, or that is outside every season, shows Closed (legacy showed its season, or no data).
5. **Seats sold** = the server's `booked_pax`; the pool, charter seats and sold share = the server's deployments (licence clamp included). A no-show keeps its seat (Q52). Screens can show slightly different seat figures than legacy where the clamp or a no-show applies.
6. **Fleet Calendar** takes status, pier and charter flag from the server (Boat Operation scope). Q3 names the Boats screen; the Fleet Calendar is a different screen, so it follows Boat Operation. Revert by removing the `fcCell` wrapper.
7. **`getBoatShopLocation`** has no date argument; it answers "now" from `atShop`, the same meaning as legacy (a started job).
8. **Swap and Replace go to the server whole** (one transaction). Refusals: swap shows the server's sentence in `alert()` (legacy used `alert()` for its own refusals); "bookings on the boat" is the same confirm as Unassign (OK resends `remove_anyway`). Replace shows the server's plan (preview, confirm, "Done." counts). **New difference:** the plan has a reason legacy lacked, `closed` ("โปรแกรมปิดวันนั้น": the route does not run that day, the server's `route_closed` rule, decided 2026-10-17 in the backend), and a past day is never moved, even by an admin. Please review.
9. **Bulk forms keep their browser pre-guards** (copy week / day, assign range, weekday pattern, clear week, apply template): they are skip-and-count loops whose alert texts ("Copied N, skipped M, not copied K") are legacy's screen. Dropping the guards would send cells the server refuses and roll the whole batch back instead of skipping, a worse screen. Inside the Boat Operation scope the guards already read the server's availability (`bop2CanPlace`), and the server is final. Copy-week's count already shows the server-saved number (Q27).
10. **Templates are one config document** (`bop2_templates`): every save sends the whole list. The server key has no per-template command, so "send only what changed" is not possible there (a per-template command would be a backend addition, not needed now).
11. **`agentTrend`** takes the board row's category when the agent's numbers match the board; the thresholds (25 %, -20 %, base 5) are no longer applied by the browser in that case.
12. **`flBoardScan`** reads `GET /v1/fleet/dashboard` (the same read as the Fleet Dashboard, shared cache, one more read when the Work or Dashboard board is drawn).
13. **Fleet Calendar pax** reads `GET /v1/fleet/daily-log` for the visible days (the only range read that gives passengers per boat).

## MISSING-SERVER-FIELD (what a backend agent should add)

1. **Dashboard window stats.** The screen's bars are legacy's windows (last 30 days ending on the picked day, last 12 months), stitched from two calendar answers. `series_stats`, `top_routes` and `other_routes_pax` describe the server's calendar month / year (decision 61), so they do not match what is drawn. Needed: `GET /v1/dashboard?date=YYYY-MM-DD&mode=day|month|year&window=rolling` (or `from` / `to`) answering `series[]`, `series_stats {total_pax, total_capacity, fill_percent, average_per_bucket, charter_pax, weather_routes, best, slowest}`, `top_routes[]`, `other_routes_pax` for **those 30 days / 12 months**. Then `renderDash` reads them instead of adding the bars.
2. **Calendar route-set names.** `PUT /v1/config/cal_route_sets` should refuse a duplicate `name` compared case-insensitively inside the list (409 with a message the dialog can show, legacy hint: "A set with this name already exists. Saving will replace it." stays the dialog's replace flow), and cap `name` at 40 characters (the server allows 80, legacy 40).
3. **Calendar month summary.** `GET /v1/availability/summary?month=YYYY-MM[&route_id=][&pier=]` -> per route and per day: `{route_id, trips, free_seats, sold_percent, tier (t1..t5 or soldout/none/wx), off_season, closed}`, and per route and month: `{month_trips, month_free, weekly_average, closed_all_month, average_free}` (what `renderCal` month stats, sold-% tiers and `routeCards` add up from the rows today).
4. **Closing a day that holds something.** The `409 bookings_on_closed_day` body should carry the list, not only the sentence: `details: { bookings: [{ booking_id, ref, service_date, pax, lead_name, status }], boats: [{ boat_id, service_date }] }`. The impact dialog (`progShowImpactModal`, `progCountBookingImpact`) counts bookings and boats from the bookings loaded in the browser, which are only the ranges another screen loaded.
5. **Maintenance cost share per asset.** `GET /v1/fleet/jobs` (and the job read) rows: `cost_share: { engine: number, gearbox: number, propeller: number }` or per asset id (`jobCost / number of assets of that kind`, legacy `flMaintCostShare`: full cost divided by the count of assets of that kind, at least 1).
6. **Extra -> issue column in one step.** `POST /v1/fleet/daily-log/{date}/boats/{boat_id}/extras/{extra_id}/to-issue {item_id}` -> adds the extra's quantity onto the issue column's quantity and deletes the extra in one transaction (legacy `flExtraToCol`: add, not overwrite), answers `{ before, added, after, unit_mismatch: {extra_unit, item_unit} | null }` so the browser keeps its confirm text without doing the sum. Today two writes (PUT issue, DELETE extra) can leave the quantity added and the extra still there.

## Tests

`node test/ui/t_walk_w5_a.mjs`: 60 checks, all passed. It seeds through the API, opens the real screens in Chrome, compares the screen to the server's answer, checks request bodies carry only choices, and in several places changes the server's answer on the way to the page (department, pool capacity, shop location, boat status, job board money, sales trend, held seats, plus the real server differing from legacy for route status, no-show seats, and the replace plan's `closed` day) so the screen must show the server's figure. Embed: ticket posted once, Bearer kept, URL clean, read-only forced, boot has no failed step, nothing written; expired ticket -> 401, no token, card with the server's message.

Regression (one file at a time): `t_ops` passes (5 of 6 runs; the other run, made while other agents were testing, had one failing check and did not repeat), `t_walk_booking`, `t_walk_booking2`, `t_walk_locks`, `t_walk_w4_f1`, `t_walk_w4_f3`, `t_walk_agents`, `t_walk_fleet`, `t_walk_fleet2`, `t_walk_days` (one run under load died early, passed on the rerun), `t_bopreplace`, `t_boppier`, `t_smoke` pass; unit tests 657 / 657. `t_embed` (legacy page mode, not the ticket flow), `t_bopfree`, `t_bopoutpier`, `t_fleetcal`, `t_fcmid`, `t_flboard`, `t_dashchboat`, `t_rtseason`, `t_closewarn`, `t_userrename` fail the same way on the base commit `1007ad2a` (checked in a throw-away worktree): not caused by this branch.

## To review

- The Fleet Calendar now shows the server's status (decision 6 above).
- Route status today for routes under an override or outside every season (decision 4).
- Replace plan reason `closed` and "past never moved, even for an admin" (decision 8).
- Embed: the exact `?t=` URL form to give CS; the allow-list gap for seat-lock groups and capacity overrides.
- `t_embed` (already failing on the base commit) tests the legacy embed page mode, not the ticket flow; not touched.
