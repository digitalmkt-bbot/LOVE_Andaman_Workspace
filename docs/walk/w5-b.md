# w5-b · Fleet rows and seat-lock / booking-side rows of the wiring recheck (2026-10-18)

Branch `wire/w5-b`. Source lists: operation-backend `docs/verify/wire2/wire-03.md` and `wire-04.md`, the sections "NOT-WIRED and WIRED-PARTLY"
(61 rows). New ops files, all registered in `allotment_v2.html` before `90-ops-boot.js`: `js/ops/81-ops-fleet-w5.js`, `81-ops-locks-w5.js`,
`81-ops-sales-w5.js`. Rows that already had a wrapper were fixed in that wrapper (`22`, `23`, `24`, `25`, `26`, `30`, `68`, `71`, `21`).
Test: `test/ui/t_walk_w5_b.mjs` (real backend, seeded through the API, real screen functions in Chrome). Idiom as in w4: the server's answer drives
the screen; legacy's own answer is kept only until the first answer arrives, offline, and for a record the server did not describe.

Verdicts: **39 WIRED · 2 SKIPPED-NOT-NEEDED · 0 SKIPPED-DESIGN · 20 MISSING-SERVER-FIELD** (61 rows).

Commits: fleet `cae8eb1a` · seat locks `41c69023` · pickup / owed / market `ff8147be` · re-entry guard, tests and this note: the last commit of the branch.

## 1. Fleet (wire-03) · commit `cae8eb1a`

| Function | Verdict | Endpoint / field |
|---|---|---|
| `flProjYoYStats` | MISSING-SERVER-FIELD | see section 4 |
| `flProjInsight` | MISSING-SERVER-FIELD | see section 4 |
| `flProjCancel` | WIRED | `POST /v1/fleet/projects/{id}/cancel {reason, unlink_jobs?}`. Legacy's prompt ("Reason for cancelling:"), the two early toasts, and the confirm "This project has n open child MJ(s). Unlink them…" are back; OK sends `unlink_jobs: true`, Cancel `false`. The wrapper had sent `true` without asking |
| `flMaintStashConfirm` | MISSING-SERVER-FIELD | see section 4 (the wrapper still sends three calls: remove/move, delete the asset, log line) |
| `flStartGearChoice` | SKIPPED-NOT-NEEDED | the keep / stash buttons are not reachable from the engine row (re-entry goes straight to the swap picker). A guard now closes the dialog without a `start` if it ever is reached; the normal path is unchanged (`POST …/start {gear, stash_location}`) |
| `flStartGearSwap` (re-entry) | MISSING-SERVER-FIELD | section 4: swap an engine out of a job that is already started. The engine commands do not do it: `POST /v1/fleet/engines/{id}/remove` makes the engine a spare at the central store and leaves its gearbox on the engine, where legacy leaves the engine `fixing` off the boat and the gearbox waiting on the boat for the replacement |
| `flStartSwapInstall` (re-entry) | MISSING-SERVER-FIELD | follows the swap-out above (the install itself, `POST …/engines/{id}/install {boat_id,pos,job_id}`, is already wired for the start path) |
| `flStartSwapSkip` (re-entry) | MISSING-SERVER-FIELD | follows the swap-out above |
| `flMaintSetRepairLoc` | WIRED | one `PATCH /v1/fleet/jobs/{id} {location}`. The server moves the off-boat / fixing engines and writes the "📍 ตั้งสถานที่ซ่อม … (อัปเดตเครื่อง n ตัว)" line; the wrapper no longer sends the engine PATCHes or the log POST. Engines are read again |
| `flnPreview` | MISSING-SERVER-FIELD | section 4 |
| `flOpenSwapModal` | MISSING-SERVER-FIELD | section 4 (the refusal `409 spare_not_compatible` is already the server's) |
| `flSaveAddSpare` | WIRED | `POST /v1/fleet/propellers` without `cost` (server `PROPELLER_DEFAULT_COST` 8,500). The other form defaults (brand, blades, material, hub, cupping, size 15.5×17) are not server defaults: they stay what the form fills in |
| `flSaveAddStock` | WIRED | `POST /v1/fleet/stock-items` without `min_qty` when the field is blank or 0 (server default 5, as legacy's `parseFloat(…) \|\| 5`) |
| `invDupScan` | MISSING-SERVER-FIELD | section 4 (`GET /v1/fleet/duplicates` is about memo / job / incident numbers, not stock items) |
| `invDupMerge` | MISSING-SERVER-FIELD | section 4 (the merge itself, `POST …/stock-items/{id}/merge`, is wired; the keeper is picked in the browser) |
| `_invPickByName` | WIRED | a new memo line that the form linked by name (no list pick, so no `inventorySnapshot`) is sent without `item_id` and with `auto_register: true`; the server links it by name and part number (`409 part_no_required` when ambiguous). Legacy's function still draws the "linked" badge on the form |
| `flAdvanceMemo` | WIRED | the next step follows the memo's `labor_only` (`memo.laborOnly`); legacy's test only runs for a memo that did not come from the server |
| `flMemoWarehouse` | WIRED | `GET /v1/fleet/memos/{id}` `default_warehouse {warehouse, why}`; `flOpenReceiveMemo` reads it first, then opens the dialog; the warehouse and the "ตั้งให้จาก …" line are the server's |
| `flDeleteEngine` (+ `flEngRefs`) | WIRED | legacy's confirm, then `DELETE /v1/fleet/engines/{id}`; `409 has_history` shows the server's message in an alert and removes nothing. Legacy's pre-check (`flEngRefs` over the browser arrays) is not run |
| `flwItems` | WIRED | `GET /v1/fleet/work?boats=all`: the page lists the server's items (stage, parked, silent days and cost were already the server's). An item only the browser holds is dropped |
| `flwMemoOpen` | MISSING-SERVER-FIELD | section 4 |
| `faDocAlertCount` | WIRED | `GET /v1/fleet/certificates` `counts.exp + counts.warn30`. The matrix is read again after any write |
| `faDocData` / `faRenderDocs` | WIRED (tiles) | `counts` for the stage tiles, the alert badge and the tab badge (`exp` also holds documents with no date, as legacy's tile). The per-boat grouping and "next to do" column are still worked out from the documents (section 4) |
| `flGuessDocType` | WIRED | `doc_type` the server gave that document name |
| `flDocBetter` | WIRED | `current` the server gave the document |
| `_flBuildInspectionSection` | WIRED | the safety item's `state` (REPLACED / MISSING / EXPIRED / DUE ≤ 30 / SOON ≤ 90 / OK / OK_NO_PM): label, colours and "Nd left" in legacy's words |

## 2. Seat locks, booking form, pickup time, money (wire-04)

### Replace wizard, documents, rate types, internal report, hotels, profiles

| Function | Verdict | Endpoint / field · commit |
|---|---|---|
| `_swapDocStep2` | MISSING-SERVER-FIELD | the "Next PM" preview (install date + the category's months, JS `setMonth`) · section 4 |
| `_swapDocStep3` | WIRED | the incident and job numbers shown are `next_no` of `GET /v1/fleet/incidents` and `/jobs` · `cae8eb1a` |
| `nextNo` (in `swapDocExecute`) | WIRED (memo number MISSING-SERVER-FIELD) | `incident_no` / `job_no` sent are the server's `next_no`, read just before the send. `GET /v1/fleet/memos` has no `next_no`, so a bought part's `memo_no` is still the browser's highest + 1 · `cae8eb1a` |
| `flRenderDocsList` | SKIPPED-NOT-NEEDED | only the old fallback page; `faRenderDocs` draws the screen and does not show `valid_pct` / `expired_boats` / `issues` |
| `rtZonesForRoute` | MISSING-SERVER-FIELD | section 4 |
| `laInternalRows` | MISSING-SERVER-FIELD | section 4 |
| `bkV2SplitArea` (`bookingV2SplitArea`) | MISSING-SERVER-FIELD | section 4 |
| `psuResolveProfile` | MISSING-SERVER-FIELD | section 4 |
| `psuHotelGroups`, `psuHotelAreaLabel` | MISSING-SERVER-FIELD | section 4 |
| `psuSaveProfile` | MISSING-SERVER-FIELD | the overlap confirm is the browser's; section 4 |

### Pickup time, money, market

| Function | Verdict | Endpoint / field · commit `ff8147be` |
|---|---|---|
| `bkV2GetPickupTime` (`bookingV2GetPickupTime`) | WIRED | `GET /v1/pickup-time?route_id&area_id&date`, kept per route / area / day until the Pickup Setup changes. The first ask is legacy's answer, the form is drawn again when the server's differs; `404 No pickup time…` means none; `404 Pickup area … not found` (a screen-made area such as `nt-tublamu-pier`) keeps legacy's answer |
| `acctBookingTotal` | WIRED | the booking's `owed` (`srvFlags.owed`) |
| `mdDirTot` | WIRED | the day's `total` of `GET /v1/market-stats` (kept as `inTotal` / `outTotal`) |

### Seat Lock board, booking form lock use, whole-boat holds · commit `41c69023`

ops/30 now keeps, per lock and day, `held_pax`, `holding`, `allocated_pax`, `drawn_pax` and (a hold) `boat_capacity` next to the numbers it already kept.

| Function | Verdict | Endpoint / field |
|---|---|---|
| `bkV2LockHoldsOn` | WIRED | `holding` |
| `bkV2LockAllocated` | WIRED | `allocated_pax` |
| `bkV2LockUnalloc` | WIRED | `pax − released − allocated_pax` of the lock (no dedicated field; both terms are the server's) |
| `bkV2LockUsedTotal` | WIRED | `drawn_pax` (a parent's covers its sub-groups) |
| `bkV2LockHeldRemaining` | WIRED | `held_pax` (a sub-group and a whole-boat hold keep legacy's rule: the server says `0` / `null`) |
| `bkV2LockPoolHold` | WIRED | `held_pax`; a sub-group holds nothing |
| `bkV2LockPendOn` | WIRED | `pending_pax` |
| `bkV2LocksForAgent` | WIRED | the sources of `POST /v1/quote/lock-draws` for the open draft (ops/71 `laOps.lockDraws.sources`); `bookingV2SetTripLockUse` caps the box with their `remaining` |
| `bkV2LockFreeOn` | WIRED | `GET /v1/availability` `available_seats` (+ the lock's own hold when editing it); `null` for a land route or a day with no boat |
| `bkV2DayLockedExact` | WIRED | the badge sums the day locks' `holding` / `held_pax` (the two wrappers above); no per-day field exists for "one-day locks only" |
| `bkV2DayLockedTotal` | WIRED | the sum of `locked_pax` over every route that day (`GET /v1/availability`) |
| `bkV2LockCoverage` | MISSING-SERVER-FIELD | section 4 |
| `bkV2BoatCapOn` | WIRED | the hold's `boat_capacity`, else the boat list's `capacity` (`GET /v1/seat-locks/boat-options`), else the day's `deployments[].capacity` |
| `bkV2BoatLockBlockers` | WIRED | `boat-options` row: `blockers` (charter, hold, bookings with `from_lock`, `pax`, `sold`, `short`), `placed_route_id`; drawn by the same form table |
| `bkV2BoatLockCanTake` | WIRED | the row's `ok`. While the list is not in hand the question is not answered in the browser: it says yes and the server judges the write (`409 boat_taken`, its message shown) |
| `bkV2BoatLockCellClear` | WIRED | no local step; when the set of active holds changes the deployments are read again (ops/30 `refreshBoard`) |
| `bkV2BoatLockOnConvert` | WIRED | no local conversion; only the shape check (the booking is the charter of this boat and day) and the hint for the save (`POST /v1/seat-locks/{id}/convert`) |
| `bkV2DrawLock` / `bkV2ReturnLock` / `bkV2ReturnBookingDraws` | WIRED | no log line, no `depleted` flip, no save; the lock's numbers move for the open form and the reload that follows every booking write puts the server's back. The booking's request still names its draws (`lock_draws`), the server decides and caps. `ReturnBookingDraws` goes through `ReturnLock` |

## 3. Decisions (reverse any of them)

1. **Delete engine asks the server first, no browser pre-check.** Legacy alerted "Cannot delete … it has history" before its confirm, from the browser arrays. Now: confirm → DELETE → the server's 409 message in an alert. One extra confirm for an engine with history.
2. **Safety inspection strip follows the server's `state`** (the nearer of expiry and next PM), in legacy's words. Legacy counted from `nextPM` alone, so an item whose expiry is near but whose next PM is far now reads DUE instead of OK.
3. **A memo line linked by name is sent as `auto_register: true` with no `item_id`** (the server links by name and part number or registers). A line picked from the list, or already saved, keeps its `item_id`.
4. **`CanTake` is optimistic until the boat list arrives**; the server judges the write. Chosen over a browser rule so the form never refuses on a guess.
5. **Draw / return keep a transient move of the numbers** instead of nothing, so an edit (return, then draw again) in one commit does not cap the draw by the old count.
6. **Documents tiles use the matrix counts; the matrix is read again after a write**, and the old browser count is drawn only while the new answer is on its way.
7. **Pickup time: an unknown area keeps legacy's answer** (the form's pseudo areas are not in the catalogue).

## 4. MISSING-SERVER-FIELD (for a backend agent)

| Row | What the browser still decides | Field needed (endpoint + shape) |
|---|---|---|
| `flProjYoYStats` | year-over-year project counts, spend, average cost / duration, on-time %, slip, per-type counts, monthly spend | `GET /v1/fleet/projects/stats?year=` → `{ year, this_year: {…}, last_year: {…} }` with the figures `flProjYoYStats` returns (todo/legacy-browser-rules.md:1142) |
| `flProjInsight` | the budget / schedule / hold / documents lines and recommendations | `insights: { lines: [text], recs: [text] }` on `GET /v1/fleet/projects/{id}` |
| `flMaintStashConfirm` | order of three calls and the log text | `POST /v1/fleet/jobs/{id}/assets/{idx}/stash {location, note?}`: takes the part off (or moves the spare), removes it from the job and writes the "📦 ถอด… ไปเก็บที่ …" line in one transaction |
| `flStartGearSwap`, `flStartSwapInstall`, `flStartSwapSkip` (re-entry) | swapping an engine out of a started job | `POST /v1/fleet/jobs/{id}/swap-out {engine_id}`: engine off the boat and `fixing`, its gearbox / propeller left waiting on the boat, the logs (what `start {gear:'swap'}` does for a pending job); then install with `job_id` (exists) |
| `flnPreview` | "starts today / tomorrow" (`_flBoatRanOn`) | `GET /v1/boats/{id}/ran-on?date=` → `{ ran: bool }` or `dry_run: true` on `POST /v1/fleet/jobs` → `{ starts_on, boat_status }` |
| `flOpenSwapModal` | which spares are offered (brand / size match, not in a shop) | `GET /v1/fleet/incidents/{id}/swap-options?asset_type=&asset_id=` → `{ spares: [{ id, label, location }] }` |
| `invDupScan`, `invDupMerge` | duplicate stock items and which one to keep | `GET /v1/fleet/stock-items/duplicates` → `{ dup: [{ key, name, part_no, keep_id, drop_ids, members }], need_part_no: [{ name, members }] }` |
| `flwMemoOpen` | which memos of a job are open (pending approval, or approved / ordered and not labour) | `memos: [{ id, no, title, status, open, label }]` or `open_memo_ids[]` on each job in `GET /v1/fleet/work` |
| Documents grouping | the per-boat group (30 days / expired / 90 days / fine) and "next to do" | `group` and `next: { days, types[] }` on each row of `GET /v1/fleet/certificates`; also `counts.no_date` (documents with no expiry) and `counts.missing` so `na` is not both |
| `_swapDocStep2` | the "Next PM" preview | `GET /v1/fleet/safety/{id}/replace-preview?install_date=` → `{ next_pm, pm_months }` |
| memo number in `swapDocExecute` | highest MO + 1 | `next_no` on `GET /v1/fleet/memos` |
| `rtZonesForRoute` | which zones a route's rate shows (RN + NoTransfer, or PK + KL + NoTransfer) | `rate_zones: ['PK','KL','NoTransfer']` on each route of `GET /v1/routes` (rule `zonesForRoute`) |
| `laInternalRows` | one row per trip of an internal booking, the money on the first trip only | `GET /v1/reports/internal-trips?year=` → `{ rows: [{ booking_id, date, route_id, purpose, label, unset, pax, foc, free, money, money_here }] }` |
| `bkV2SplitArea` | the area of a split row, and whether it is inherited from the parent booking | `area_effective: { id, name }` and `area_inherited: bool` on each split part |
| `psuResolveProfile` | which profile covers a date (narrowest range, then newest) | `GET /v1/pickup-time-profiles/active?date=` → the profile |
| `psuHotelGroups`, `psuHotelAreaLabel` | which hotel names are similar (fuzzy), the group's keep name, the most-used area | `GET /v1/hotel-names/groups?min=&cross_area=` → `{ groups: [{ id, keep, total, items: [{ name, count, last, areas: [{ area_id, name, count }] }] }] }` |
| `psuSaveProfile` | the overlap warning ("Validity overlaps with …") | `warnings: [{ code: 'overlap', profile_id, name, from_date, to_date }]` on `POST`/`PATCH /v1/pickup-time-profiles`, with `overlap_anyway: true` to confirm |
| `bkV2LockCoverage` | which holder bookings drew from this lock, another lock, or the pool | `coverage: { bookings, pax, self, other, pool, rows: [{ booking_id, voucher_ref, lead, pax, self, other, pool }] }` on `GET /v1/seat-locks/{id}?service_date=` |

## 5. To review

- Fleet Work drops browser-only items; an item only the server lists is not drawn (there is no browser object to draw it from). Fine while the browser loads every job.
- `bookingV2DayLockedExact` has no wrapper of its own: it is a sum over wrapped per-lock values. If the developer wants it as one server number, the field is a per-day `locked_pax` that leaves out bulk departures.
- The memo `default_warehouse` read delays the receive dialog by one request.
- Tests run: see the final reply of the agent (t_walk_w5_b and the walk / ops suites of the touched screens). `t_boatlock`, `t_bklkplaced`, `t_btlockbtn`, `t_flboard` and `t_fleetcal` fail the same way on the unchanged base commit `1007ad2a` (older-name or setup problems); `t_assetver` fails on the base (109 stale cache-bust tags), untouched here.
