# w5-c · wave 5, group c: the browser rules the 2026-10-18 recheck still found (2026-10-18)

Branch `wire/w5-c`. Lists: operation-backend `docs/verify/wire2/wire-05.md` and `wire-06.md`, every row of "NOT-WIRED and WIRED-PARTLY".
Backend guides read: `CLAUDE.md`, `todo/decisions-answers.md`, `todo/frontend-wiring-decisions.md`, README "Vans and the month matrix", "Van board",
"Van groups", "Van stops", "Van job orders", "A boat's seats for one day", "Dispatch", "Pickup and overnight fields", "Pier office: petty cash",
"The Pier Check-in sheet", "Partner van bills", "Invoices", `todo/van-bill-pier-model.md`.
Test: `node test/ui/t_walk_w5_c.mjs` (real Chrome, real in-process backend; 6 sections). New ops files (prefix 82, registered before `90-ops-boot.js`):
`ops/82-ops-w5c-boats.js`, `82-ops-w5c-vans.js`, `82-ops-w5c-money.js`, `82-ops-w5c-pier.js`. The van-bills adapter `45-ops-van-bills.js` was rewritten.

In this branch the legacy `bkV2*` names are `bookingV2*` (`bkV2BoatPulled` is `bookingV2BoatPulled`).

## 1. Functions

Verdicts: WIRED · SKIPPED-NOT-NEEDED · SKIPPED-DESIGN · MISSING-SERVER-FIELD (field named in section 4).

| Function (legacy) | Verdict | Endpoint / field | Commit |
|---|---|---|---|
| **Market Data** | | | |
| `mdLangBuckets` | MISSING-SERVER-FIELD (1) | `GET /v1/market-stats` has days by nationality *name*; the code table stays client (README). A language bucket needs the code | |
| `mdArrivalsByWeekday` | MISSING-SERVER-FIELD (2) | weekday totals of the days in a range | |
| `_mdOvMonthly` | MISSING-SERVER-FIELD (3) | the merged "monthly only where no daily data" series | |
| **Insurance** | | | |
| `insSetField` (name, nationality) | SKIPPED-DESIGN | name / nationality overrides were decided not to be copied (`todo/frontend-wiring-decisions.md` item 19); the age and the reviewed mark are already `PUT /v1/bookings/{id}/insurance` | |
| `insRevertRow` (name, nationality) | SKIPPED-DESIGN | same | |
| **Pickup Map / Booking Flow** | | | |
| `pmMarket` | MISSING-SERVER-FIELD (4) | no booking read carries the resolved report market (`bookingReportMarket`) | |
| **Daily PFM** | | | |
| `pfmPrepayTotal` | WIRED | `GET /v1/invoices/candidates?agent_id=&kind=prepay&q=` `invoice_total` (the dialog's amount and balance line) | 7af7c858 |
| `pfmPrepayCands` | MISSING-SERVER-FIELD (5) | the picker lists every invoice agent; the candidates read needs one `agent_id` | |
| `pfmChartBuckets` | SKIPPED-NOT-NEEDED | the bucket totals are already the server's (`31-ops-pfm.js`, `GET /v1/pfm?from&to`); the eight date windows are screen layout | |
| `_pfmEditTotals` | MISSING-SERVER-FIELD (6) | no dry run on `payment-corrections`; the submit is checked by the server (`409 overpayment`) | |
| **Overnight / boats** | | | |
| `baCharterBoatMap` | WIRED | boat-operation panel `assigned[].is_charter` + `charter_booking_id`, plus the server's overnight holds (already wired) | 7af7c858 |
| `bkOvnHealSpans` | SKIPPED-DESIGN | Q39 and README "Overnight charter holds": the browser keeps creating the nightly cells (deployments the server accepts as the charter's own); the leg rewrite is repair of old rows, the server validates the legs of every new write | |
| `bkV2CharterBoatHeal` | WIRED | does nothing in ops mode: `charterSynced` puts the boat on the trip when the server saves | 7af7c858 |
| `baAssignedPax` | MISSING-SERVER-FIELD (7) | no per-boat pax on a read (`GET /v1/dashboard` boats[].booked_pax counts another set) | |
| `bkV2BoatPulled` | WIRED | `trips[].operations.boat_pulled` (projected as `ops.boatPulled`) | 7af7c858 |
| **Vans / van jobs** | | | |
| `bkV2HealSelfArrivePickup` | WIRED | does nothing in ops mode: "Repairs on write" | 7af7c858 |
| `bkV2VanGroupConflicts` | WIRED | none in ops mode: a group has one `van_id` | 7af7c858 |
| `bkV2RetInfo` | WIRED (`alert`) | van-board `routes[].return_unarranged[]`. `selfRet`, `sameVan`, `retId` stay the booking's own fields | 7af7c858 |
| `vehEffectiveZone`, `_vehUsableOn` | WIRED | `GET /operations/van-days` `zone_on`, `usable` | 7af7c858 |
| `vanVehiclesForZone` | WIRED | (calls the two above) | 7af7c858 |
| `vanVehiclesForRoute` | WIRED | van-board `routes[].pool.outbound` | 7af7c858 |
| `vanJobsSreqFinal` | WIRED | booking `special_request` | 7af7c858 |
| `vjRoundAll`, `vjRoundPick`, `vehDayRoundN` | WIRED | `GET /operations/van-jobs?date=` `jobs[].round {no, of, time}` | 7af7c858 |
| `vsFor` | WIRED | the order of `GET /operations/van-stops` (the sort stays in the browser only for a stop the server has not sent yet) | 7af7c858 |
| `vsSeats` | MISSING-SERVER-FIELD (8) | the stop row has no `seats` | |
| **Van stops (wire-06)** | | | |
| `vsSeatsOfVan`, `vsOnLeg` | WIRED | van group `stop_seats` (outbound leg); `vsOnLeg` is only its helper. A return-leg ask still walks the stops, no screen asks it | 7af7c858 |
| `vsSubmit` | WIRED | the browser's seat sum is off in ops mode; `409 van_over_capacity` + `seats_anyway` (`vsSave`) | 7af7c858 |
| **Partner van bills** | | | |
| `vbCanSet` | SKIPPED-NOT-NEEDED | the filled-cell lock is a screen rule (the server refuses only a paid bill, `409 bill_paid`) | |
| `vbRenderOneV1` | WIRED | the `new` flag of the rows (= `new_rows`): marked rows and the banner, on the owner's sheet | 3aa1ca5a |
| `vbPerOf`, `vbSetPer` | WIRED | `per_pax_by_pier`; a PATCH sends the whole map with one pier changed | 3aa1ca5a |
| `vbRenderOv2`, `vbAggP`, `vbPiersOf`, `vbSum`, `vbPk`, `vbXPier` | WIRED | `GET /v1/van-bills` `piers[]`, `tabs[]`, `totals`, `idle_partners[]`, `?pier=` | 3aa1ca5a |
| `vbRenderSheet` | WIRED | `GET /v1/van-bills/{partner}/{month}/{period}?pier=[&van_id=]` | 3aa1ca5a |
| **Boat seats per day** | | | |
| `boatCapInfo`, `boatCapFor` | WIRED (overridden day) | the day object `{capacity, normal, ceiling}` | 7af7c858 |
| `boatCapBase`, `boatCapLicense` | SKIPPED-NOT-NEEDED | they read the boat record's own seats and licence, which the server sent; a day without an override has no day object (MISSING-SERVER-FIELD 9, the same ask) | |
| **Check-in** | | | |
| `ckCap`, `ckCeil` | WIRED | no new code: the pier ceiling is `pckExpected` (`aboard.expected`, wired in w3), the other is the trip's booked heads; checked in the test | |
| `ckRoutePills` (pier page) | WIRED | `GET /v1/pier-checkin` `programmes[].variants[]`: arrived / cleared / boarded heads, `zones` PK/KL/OWN, `due`; land page unchanged | 7af7c858 |
| `ckRoutePills` (Van Check-in page, hover booked / lost heads, booking counts) | MISSING-SERVER-FIELD (10) | programmes for the van page; `zones.*.booked`; row counts per stage | |
| `bkNatTH` | SKIPPED-NOT-NEEDED | the cap on Thai heads is a form hint; the server stores the shape only (`thai_passengers`), as the report says | |
| **Pier petty cash** | | | |
| `pcLedgerSort`, `PC_PK_ISL_ORD` | WIRED | the order of `GET /v1/pier-cash/{pier}/days/{date}` `rows[]` (legacy's helper still gives the park-line colours) | 7af7c858 |
| `pcSheetMain` | WIRED | each row's `balance`, the day's `closing` (`pcRunBal`, `pcClosing`; used by the live `pc2Main`, `pcPrintLedger`) | 7af7c858 |
| `pcMonthTable` | SKIPPED-NOT-NEEDED | dead: `pcSheetMain` returns `pc2Main` first. The live month list uses `pcClosing` | |
| `pcSheetLT`, `pcLtUsed` | WIRED | `used_boats` of the cell, the day's `totals` (join / charter boats, amount) in `pc2LTDay`, `pc2LT` and the print day sums. The print month sum is the sum of the server's day sums | 7af7c858 |
| `pcSheetPK`, `pcDiffCell` | WIRED | the boat's `check.diff` (`pcPkDiff`); the day's / month's keyed heads, amount, dock = sheet `totals` (`pcSheetTot`) on the screen | 7af7c858 |
| route-group and day difference of the park sheet, the print layout of the park sheet | MISSING-SERVER-FIELD (11) | the sheet `check` adds unkeyed boats' dues; legacy compares only keyed boats | |

## 2. Fields and rows created

None on the server. Browser side only (memory, nothing stored, never sent): `bk.specialRequest` (40-ops-bookings.js), `groupInfo.stopSeats` (34), `BOAT_CAP_OVR[..].normal/.ceiling` (49), `row.srvBal` (46), the caches of
`82-ops-w5c-vans.js` (van-days window, van-jobs per date) and of `82-ops-w5c-pier.js` (programmes per date), one write counter.

Edits outside the new files: `08-app.js` (marked `§w5c…`: `vsSubmit` gate, `ckRoutePills` hook, `pc2Main`/`pcPrintLedger` closing and balance, `pc2PKDay` diff, sheet-sum hooks, five tiny new functions
`pcClosing`, `pcRunBal`, `pcPkDiff`, `pcSheetTot`), `ops/34-ops-vans.js` (stop seats), `ops/35-ops-van-jobs.js` (special request answer), `ops/40-ops-bookings.js`, `ops/46-ops-pier-cash.js` (row balance),
`ops/49-ops-capacity-overrides.js`, `ops/75-ops-by-trip-extras.js` (a current-only board read), `ops/45-ops-van-bills.js` (rewritten screens), `allotment_v2.html` (four script tags).

## 3. Decisions and assumptions (reverse any)

1. **A write counter drops the cached reads.** `82-ops-w5c-vans.js` and `82-ops-w5c-pier.js` wrap `laOpsFetch` (the one door of every call) and count the writes to vans, groups, stops, trips, bookings (check-in taps only for the pier page); the change feed counts too. An answer read before the last write is
   "old": legacy's rule answers until the new one is here (asked for at once). Nothing shows two kinds of answer mixed. (Van groups, stops and van-days writes do not call `O.wrote`, which is why the counter is not `O.onWrite`.)
2. **Own reads, not shared ones.** The van-days window (±20/40 days), the day's van jobs and the pier programmes are read again by the new files (one extra GET each after a write) so `35-ops-van-jobs.js` and `74-ops-pier-service.js` stay as they are.
3. **A stop write reads the group and the day again.** The group (for `stop_seats`) and the day (for the server's stop order) are loaded after any `POST/PATCH/DELETE /operations/van-stops` (not the check-in).
4. **`vsSubmit` has no browser seat sum in ops mode.** The server counts per round (README "Van groups": seats are checked per round, never summed); legacy summed every group of the van. The confirm is the server's own message plus "Add anyway?" (already in `vsSave`).
5. **Van bills draw legacy's current screens.** The ops screen drew the older single list; legacy (lk-inbox 9882365) has the pier screens. The settle buttons the earlier waves added (send, unsend, pay, unpay and their state lines) stay on the owner's sheet as extra buttons: legacy has none.
6. **A van-bill write builds on the whole bill.** `?pier=` and `?van_id=` answers hold only part of the extra lines; a write that sent them back would delete the others (extra lines are "sent whole"). So every PATCH reads the whole bill first, and the extra lines go out without `bill` / `sale`.
7. **"ค่ารถ" (bill − extra + deduction) on the overview is one subtraction of a server line's own figures**; the print summary sends it as `car_cost`, the overview does not (MISSING-SERVER-FIELD 12, optional).
8. **`bookingV2RetInfo.alert` excludes bookings waiting for approval** (they are off the van board, decided 2026-10-17); legacy alerted for them too.
9. **`baCharterBoatMap` lists the boats of the panel's `assigned[]`** (ready boats with a programme); a charter boat under repair that day is not in it (it is in `unavailable[]`). Used only for the allotment fallback and the pickers.
10. **Pier pills**: the booked heads and the booking counts in the hover texts still come from the walk over the browser's bookings; the server does not send them (MISSING-SERVER-FIELD 10).
11. **Petty cash**: the sheets' `totals` include a cell of a boat that has no route that day; the rows drawn do not list such a boat. Rare; the number is the server's.
12. **The pier programmes read carries `&programmes=1`** (ignored by the server) so a test can tell it from the Service column's read; `t_walk_w4_f2.mjs` was changed to leave it out of its "a tap does not re-read the Service answer" check. A check-in tap does make the programmes old (the pills must follow), so one extra GET follows a tap.
13. **`t_assetver.mjs` reports 109 stale ?v= tags in this checkout (CRLF working copy); not touched.** The legacy-mode UI tests that need `LAD=…` data (t_pc*, t_vb*) could not run here: the data export is not in the checkout.

## 4. MISSING-SERVER-FIELD (the exact ask)

1. `GET /v1/market-stats?from&to` → per day, `in_by_code: { "RU": n, "CN": n, … }` (the nationality-name → code table moves to the server), and `lang_buckets: { Russian, Chinese, English }` of the range.
2. `GET /v1/market-stats?from&to` → `arrivals_by_weekday: [sun … sat]` (arrivals only).
3. `GET /v1/market-stats?from&to` → `monthly_merged: [{ ym, pax, source: "daily"|"monthly" }]`.
4. `report_market` on every booking read and list row (the result of `bookingReportMarket`: snapshot, else agent, else `b2c`, else `unassigned`).
5. `GET /v1/invoices/candidates?kind=prepay` without `agent_id` (staff): all invoice agents, `agent_id` and `agent_name` on every candidate, `q`, a `limit` and the count left.
6. `POST /v1/invoices/{id}/payment-corrections` with `dry_run: true` → the invoice `{ total, paid, balance, status }` it would have, nothing stored.
7. Per boat and day, the pax placed on it and the bookings: `GET /v1/fleet/boat-operation` `assigned[]` and `available[]` `booked: { pax, bookings }` (what `baAssignedPax`, `baAssignedBookings` return).
8. Van stop row: `seats` (= `pax` for a staff stop, 0 for cargo) and, with it, `stop_seats_return` on the group.
9. `GET /v1/boats/{id}/capacity-overrides?all=true` (or the same on `/v1/fleet/availability` rows): the day object `{ capacity, normal, ceiling }` for a day with no override.
10. Pier check-in sheet `programmes[].variants[].zones.{PK,KL,OWN}.booked`, `programmes[].arr_rows / clr_rows / brd_rows`; and the same `programmes[]` for the Van Check-in page (`GET /v1/van-checkin`, done = van ticks).
11. Park sheet: `days[].check.diff_paid` and `check.diff_paid` of the sheet: paid − due over the boats that have both (legacy's day / route difference).
12. Optional: `car_cost` on an overview line and block total.
13. Optional, for `bkOvnHealSpans`: the server creating the nightly deployments of an overnight charter itself (then the browser's heal goes).
14. `selfRet` of `bookingV2RetInfo` (a separate drop-off that is a self-arrive place): `drop.self_return` on the booking trip row.

## 5. To review

- `45-ops-van-bills.js` changed a lot (the v2 screens). Compare on paper with legacy: pier tabs, the block per pier, the spreadsheet, the fx bar, the keyboard moves (legacy's `vbxBind` is reused), the NEW rows banner.
- The pier pills hover texts lose nothing, but their booked / lost heads are the walk's.
- `82-ops-w5c-vans.js` reads `GET /operations/van-days` and `/operations/van-jobs` on its own: if the extra requests matter, share the reads with `35-ops-van-jobs.js` later.

## 6. Tests

`node test/ui/t_walk_w5_c.mjs`: 1 boats (boat pulled, both heals, charter boats with the booking out of the browser, the seats of a day), 2 vans (zone_on / usable with a range only the server knows, pools, return alert, mixed vans,
special request, rounds with the browser's times swapped, stop order, `stop_seats`, the stop form's 409 and "Add anyway?" and the reload after the write), 3 pier pills (server check-ins the browser was not told of) and petty cash (order with a tampered
time, balances with a tampered amount, closing, month list, longtail boats used, park difference, the sheets' sums), 4 van bills (overview by pier, one pier, idle owners, the sheet of a pier, new row banner, the pier's sale price request body, extra lines of two piers kept, mark seen),
5 Daily PFM prepay amount (an agent the browser does not know: legacy would add no VAT), 6 check-in ceilings. Every section also checks that nothing computed was sent.
