# w6-b · The w5-b MISSING-SERVER-FIELD list, wired to the new backend fields (2026-10-18)

Branch `wire/w6-b` (from `main`). Source list: `docs/walk/w5-b.md` section 4 (18 rows). Server side: operation-backend `todo/w5b-model.md` and the README
section "Server fields for the walk's MISSING-SERVER-FIELD list". New adapters, registered in `allotment_v2.html` before `90-ops-boot.js`:
`js/ops/92-ops-w6b-fleet.js` (fleet rows) and `js/ops/92-ops-w6b-sales.js` (booking-side rows). Three older wrappers were fixed in place:
`21-ops-pickup.js` (profile overlap), `26-ops-fleet-daily.js` and `81-ops-fleet-w5.js` (memo number).
Test: `test/ui/t_walk_w6_b.mjs` (real backend, seeded through the API, real screen functions in Chrome).

Idiom (as in w4 and w5): the server's answer drives the screen; legacy's own answer is kept only until the first answer arrives, offline, and for a
record the server did not describe. An answer is kept until the next write, then read again while the old one is still drawn. Only user choices are
sent (a place, a note, an engine, `overlap_anyway`); no computed field is sent.
The walk test changes the BROWSER'S OWN COPY first so that legacy's answer would differ (extra projects, a lost gearbox, a wrong engine position, a
route moved to Ranong, an empty booking list ...), asserts that difference through legacy's function (`fn.__orig`), and then checks that the screen shows
the server's figure.

Verdicts: **18 WIRED · 0 SKIPPED-NOT-NEEDED · 0 SKIPPED-DESIGN · 0 STILL-MISSING** (18 rows of section 4), plus the notes in section 3.

## 1. Fleet

| Row | Verdict | Adapter · endpoint and field |
|---|---|---|
| `flProjYoYStats` | WIRED | `GET /v1/fleet/projects/stats?year=` `{this_year, last_year, previous_year}` → legacy's `{yearTY, yearLY, TY, LY}` (snake to camel). Test: 4 extra completed projects in the browser, the modal's "Projects · total" is the server's count |
| `flProjInsight` | WIRED | `insights {lines, recs}` on `GET /v1/fleet/projects/{id}`. Test: the browser copy put on hold would add a hold line; the card shows the server's lines |
| `flMaintStashConfirm` | WIRED | ONE command `POST /v1/fleet/jobs/{id}/assets/{idx}/stash {location, note?}` replaces the three calls (remove or move, delete the asset, log line). The browser no longer needs its own copy of the part: test deletes the gearbox from the browser and the stash still works. `409 not_stashable` is shown as the server says |
| `flStartGearSwap`, `flStartSwapInstall`, `flStartSwapSkip` (re-entry) | WIRED | swap-out of a started job: `POST /v1/fleet/jobs/{id}/swap-out {engine_id}` → `waiting [{engine_id, pos}]` fills the replacement picker (positions are the server's, test sets a wrong one in the browser). The install (`…/engines/{id}/install {boat_id, pos, job_id}`) and skip (engine place) steps were already server commands and run on `ctx.started`; both walked |
| `flnPreview` | WIRED | `GET /v1/boats/{id}/ran-on?date=` `ran`, through `_flBoatRanOn` (so "from tomorrow, because it already ran a trip today" is the server's). Test: the browser's trip list says the opposite for two boats |
| `flOpenSwapModal` | WIRED | `GET /v1/fleet/incidents/{id}/swap-options?asset_type&asset_id`: the four groups (on this boat, pier now, home pier, other pier), the "moved away" note and `model_match` warning. Legacy's dialog is drawn first and redrawn from the answer. Test: the browser has put the spares in a shop (legacy: "no spare") |
| `invDupScan`, `invDupMerge` | WIRED | `GET /v1/fleet/stock-items/duplicates` (`dup`, `need_part_no`, `ok`); the merge sends the server's `keep_id` / `drop_ids` and the confirm shows its `total_qty`. Opening the dialog asks again. See section 3 note 1 for how the test makes a duplicate |
| `flwMemoOpen` (+ `flwMemoLabel`) | WIRED | `memos [{id, open, label}]` on each job item of `GET /v1/fleet/work` (the same cache as `flwItems`). Test: the browser copy says "ordered parts memo"; the server says an approved labour memo is not open and reads "approved, not paid yet" |
| Documents grouping (`faDocData`) | WIRED | `group`, `next {days, types}` on each boat row of `GET /v1/fleet/certificates`; tiles use `counts.all` and `counts.exp + counts.no_date`. Test: the browser copy holds no documents |
| `_swapDocStep2` | WIRED | `GET /v1/fleet/safety/{id}/replace-preview?install_date=` `{next_pm, pm_months}`. Test: the browser's category table says six months |
| memo number in `swapDocExecute` (and the step-3 preview) | WIRED | `next_no` of `GET /v1/fleet/memos` (read just before the send, like the incident and job numbers). The browser's count is only the fallback for a failed read |

## 2. Booking side

| Row | Verdict | Adapter · endpoint and field |
|---|---|---|
| `rtZonesForRoute` | WIRED | `rate_zones` of `GET /v1/routes`; a zone the rate already holds is kept (the union stays the screen's). Test: the browser copy moves the route to Ranong |
| `laInternalRows` | WIRED | `GET /v1/reports/internal-trips?year=` rows (money on the first trip only); the report page redraws when they arrive. Test: the browser has no bookings |
| `bookingV2SplitArea` | WIRED | `area_effective` / `area_inherited` on the booking's `operations.van_parts[]`, found by the part's own pickup (area, hotel, zone) among the parts the booking kept (`bkOpsRead(...).vanParts`). Test: the browser copy lost the booking's area |
| `psuResolveProfile` | WIRED | `GET /v1/pickup-time-profiles/active?date=` (narrowest, then newest, else the fallback, else none). Test: the browser has no profiles |
| `psuHotelGroups`, `psuHotelAreaLabel` | WIRED | `GET /v1/hotel-names/groups?min=&cross_area=` (the two choices on the tab are sent); `area_label` of each name. Test: the browser has no bookings; the tab draws the group and its merge button |
| `psuSaveProfile` | WIRED | the first save of a NEW profile is `POST /v1/pickup-time-profiles`; `409 profile_overlap` with `warnings` opens legacy's "Validity overlaps with … Continue?" confirm from the server's name and dates; OK sends the same save with `overlap_anyway: true`, Cancel sends nothing more. The browser no longer looks for the overlap itself (test empties the browser's profiles) |
| `bookingV2LockCoverage` | WIRED | `GET /v1/seat-locks/{id}/coverage` (the lock's server id of that day); the manage dialog redraws when it arrives. Test: the browser has no bookings |

## 3. Decisions and notes (reverse any of them)

1. **A real duplicate stock item cannot be made through the API** (`409 stock_item_exists`, and `409 part_no_required` for a name with no part number
   next to a named one): those groups only exist in imported legacy data. The test therefore doctors ONE read of `GET /v1/fleet/stock-items/duplicates`
   (two real items named as a group) and checks the screen and the merge request. The server's own rule is tested in operation-backend
   `test/w5b-fleet.test.ts`. The real server then refuses the merge of the two (different) items with its own message, which the test also checks.
2. **Split-part areas are only on the booking read and list** (backend "Left open"): a booking object the van-job sheet got from the day-detail answer
   has no `area_effective`, and `bookingV2SplitArea` falls back to legacy's answer for it (no error).
3. **The profile modal's live "overlaps with …" hint** (`psuRenderProfileModal`, drawn while the dates are typed) is still computed from the browser's
   profile list. It is only a hint; the save is decided by the server (note on `psuSaveProfile`). There is no preview endpoint, so nothing to read.
4. **Hotel groups: the group `id` (`g<n>`) is not stable across data changes** (backend note). The tab keeps the answer until the next write, so a radio pick
   and the merge button use the ids of the answer on screen.
5. **Not in the list, not touched:** `bookingV2DayLockedExact` (backend "Left open": still the sum of the wrapped per-lock values; `days[].locked_exact` of
   `GET /v1/bookings/calendar` from w5-e is a different wave's field).

## 4. Tests run

See the final reply of the agent: `node --check` on the changed JS, `node --test test/unit/*.test.mjs`, every `test/ui/t_ops*.mjs` and `t_walk_*.mjs` one
file at a time.
