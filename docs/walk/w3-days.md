# w3-days · split van rows, overnight nights, Boat Operation panel, crew badges, licence chips (2026-10-18)

Branch `wire/w3-days`. Server side: operation-backend `todo/w2-days-boats-model.md` (sections 1, 2 and 6) and `todo/decisions-answers.md` (Q39, Q40, Q48, Q50, Q54).
Idiom: every legacy function is wrapped from `js/ops/*.js`; legacy answers outside ops mode and, for the new reads, until the server's answer has arrived.
No legacy file was edited. Edited adapters: `ops/34-ops-vans.js`, `ops/40-ops-bookings.js`. New adapters: `ops/71-ops-boat-operation.js`, `ops/72-ops-pier-days.js` (script tags added to `allotment_v2.html`; the cache tags of 34 and 40 refreshed).

Commits: `f51f384d` split van rows · `7a53684f` Boat Operation panel · `15227add` crew badges and licence chips · `65fd8184` test `t_walk_days.mjs` and a re-read fix.

Checks run (all in this worktree, real in-process backend):
`node --check` on every changed file: ok · `node --test test/unit/ops-vans.test.mjs`: 33 pass (the 2 NOT YET expectations are gone, 6 split tests added) ·
`node test/ui/t_ops.mjs`: all passed (one earlier run stopped at "locks untouched" once and passed on every rerun: flaky, not understood) ·
`node test/ui/t_walk_locks.mjs`: all passed · `node test/ui/t_walk_pier.mjs`: all passed ·
`node test/ui/t_walk_dayops.mjs`: 1 red check, the known one ("a second machine also sees the moved-away row of b1", belongs to another agent) ·
`node test/ui/t_walk_days.mjs` (new, 5 sections, 39 checks): all passed.

## 1. Functions done

Status: WIRED / SKIPPED-DESIGN / SKIPPED-NOT-NEEDED / SKIPPED-OTHER.

### Q40 split van rows (`34-ops-vans.js`, `40-ops-bookings.js`)

| Legacy name | File | Status | Endpoint / field |
|---|---|---|---|
| `operationsFrom` (builds `ops.vanSplits`) | `ops/40` | WIRED | `operations.van_parts` mapped as the note says (pax, ad/chd/inf/foc, `vanGroup` = group.number, `vanId`, `vanSeq`, `vanReturnId`, `main`, `fromAlt`, pick/drop area/hotel/zone, `pickTime`, `altWho`); built only when more than one part or the one part is not `main`; each split keeps the server idx as `opsIdx` |
| `bookingV2VanSplit` | `ops/34` | WIRED | the NOT YET refusal is gone; legacy's dialog opens as it is (it only reads the parts); a cancelled booking is refused with a toast |
| `bookingV2SplitApply` (the dialog's Apply) | `ops/34` | WIRED | `POST /operations/trip-ops/{trip_id}/van-split {ad,chd,inf,foc}`; then the booking and the day's groups are read again, the dialog closes, legacy's success toast shows; a refusal (`part_too_small`, `bad_split_size`, `alt_pickup_split`, `cancelled`, 400) shows the server's own text and leaves the dialog open; `child_without_adult` is not toasted (legacy's amber note is in the dialog) |
| `bookingV2VanUnsplit` | `ops/34` | WIRED | `POST /operations/trip-ops/{trip_id}/van-unsplit`; a booking with no parts does nothing, as legacy |
| `bookingV2VanGroupSelected` | `ops/34` | WIRED | a ticked `bkId@i` row is sent as `{trip_id, idx: opsIdx}` (refusal removed) |
| `bookingV2VanGroupSave` | `ops/34` | WIRED | `bkId@i` rows keep their place in the order PUT as `{trip_id, idx}` (refusal removed) |
| `bookingV2VanGroupSetVan`, `bookingV2VanGroupSetTime`, `bookingV2VanGroupDisband` | `ops/34` | WIRED | rows of a group with split parts are no longer refused: `planMembers` sends every part of the group by idx; disband clears the parts on screen |
| `bookingV2AssignVan` | `ops/34` | WIRED | on a split booking it acts on the main part (the first part): its group, else a new group with that part |
| `applyGroup`, `fetchDay` (the loader) | `ops/34` | WIRED | every member is applied to `vanSplits` by `opsIdx` (group number, van, sequence, return van) and, for idx 0, to the booking as before; a part not listed any more is cleared; a part's own return van survives the clear |
| `bookingV2AssignVanReturnSplit`, `bookingV2SetSplitPickTime` | `ops/34` | WIRED | send `opsIdx`, not the array position |
| `bookingV2SyncAltPickupSplits`, `bookingV2HealAltSplits`, `bookingV2HealSplitPax` | `ops/34` | WIRED | do nothing in ops mode (return false); the server builds and rebalances the parts on every booking write |
| `bookingV2HealOvnLegs` | `ops/34` | WIRED | does nothing in ops mode (the server heals the leg on write) |
| `bookingV2VanGroupHeal` | `ops/34` | SKIPPED-NOT-NEEDED | already a no-op in ops mode |

### Q39 overnight charter

| Legacy name | File | Status | Note |
|---|---|---|---|
| `bkOvnHealSpans` and the nightly cells | `04-data-core.js`, `ops/20` | SKIPPED-NOT-NEEDED | checked, not changed: the heal still makes the nightly cells in `TRIPS`, the sync posts them and the server accepts them (test: all 4 days of the span deployed, nothing refused) |
| delete of a claimed night cell | `ops/20` | SKIPPED-NOT-NEEDED | the sync already rolls back and `O.fail` shows the server's message: `409 charter_boat` "Cannot unassign - charter is active. Cancel the charter booking first." (test: the message is on screen and the cell is back) |
| `bkOvnHoldMap`, `bkOvnHoldOn`, `baCharterBoatMap` | `08-app.js` | SKIPPED-OTHER | kept: they feed seat counts on every screen and the task says not to change what the page draws. Boat Operation reads the hold from the server (`ovn_hold` on the panel and availability rows). The local map and the server agree in the test |
| `pjBoatSt` state `ovn` | `ops/47` | SKIPPED-OTHER | `ops/47` still keeps legacy's answer when it says `ovn`; the server now sends `ovn` too. See decision 3 |

### Q48 Boat Operation (`71-ops-boat-operation.js`)

The visible range is read once (`GET /v1/fleet/boat-operation?from&to&pier=all` and `GET /v1/fleet/availability?from&to`, queued behind any write, joined into calls of 62 days at most). The pier filter is applied on the answer's `pier`. After any write (`O.wrote`, a change from another user, `save('operations')`, `boatCapPersist`) the answers are old at once and legacy's computation runs until they are read again; a redraw follows each new answer.

| Legacy name | Status | Source |
|---|---|---|
| `bop2FleetStatus` | WIRED | `days[].assigned / available / unavailable` (legacy's shapes; boats are the browser's objects; `reason`, `overdue`, `jobNos`, `ovnHold` from the server); legacy's list if a boat is unknown to the browser |
| `bop2FreeByPier` | WIRED | `days[].free_by_pier` |
| `getStoredStatus` | WIRED (Boat Operation only) | availability `stored_status` (only `.s` is replaced) |
| `boatEffStatus`, `getCurStatus` | WIRED (Boat Operation only) | availability `status`, `not_chartered` (`noCharter`), `blocked_by` (`jobBlock`); `getCurStatus` calls `boatEffStatus` |
| `getBoatCurrentPier` | WIRED (Boat Operation only) | availability `current_pier` (`shop` included) |
| `bop2OpenCellPopover`, `bop2AssignBoatOptsFor`, `bop2CanPlace`, `bop2RenderHeatmapRow`, `bop2RouteDaysNeedingBoats` | WIRED | run inside the Boat Operation scope, so the four primitives above answer from the server; no body was rewritten. `bop2AssignBoatOptsFor` redraws its list when a date outside the visible range arrives |
| `renderOp` | WIRED | wrapper only: sets the scope and asks for the visible dates |
| `boatJobBlock` | SKIPPED-NOT-NEEDED | its result reaches the screens through `boatEffStatus.jobBlock` (from `blocked_by`) |
| the Boats screen (`getCurStatus` outside Boat Operation) | SKIPPED-DESIGN | keeps legacy's status (decision Q3); the test proves it (a status only the browser knows still shows on the Boats side while Boat Operation follows the server) |

### Q50 "already on another boat" (`72-ops-pier-days.js`)

| Legacy name | Status | Source |
|---|---|---|
| `pjCrewBusyAll` | WIRED | `GET /v1/pier-office/{pier}/days/{date}/crew-flags` `assigned` (a typed name is keyed by its text, as legacy's slot is); also feeds `pjOpts` ("⚠ อยู่ …") and the header "คนซ้ำลำ" |
| `pjCrewElsewhere` | WIRED | the job read's `busy_flags` first, else the map above |
| `pjSlotRow` (the red badge) | WIRED | no edit: it calls `pjCrewElsewhere` |
| `pjGdBusy` | WIRED | legacy's answer (the guide orders, `ops/62`) plus the guides the job's `busy_flags` name (`position: guide`) |
| `pjOpts`, header "คนซ้ำลำ" | WIRED | no edit: they call `pjCrewBusyAll` |
| `pjDupReset` | SKIPPED-NOT-NEEDED | clears legacy's memo only |
| the island-list `409 guide_double_booked` | unchanged | `ops/47` still asks "Assign anyway?" |

The server data is used only when no change is waiting to be saved (`P.busy()` false) and no write came after it was read; otherwise legacy's computation answers.

### Q54 licence chips (`72-ops-pier-days.js`)

| Legacy name | Status | Source |
|---|---|---|
| `plCovers` | WIRED | `GET /v1/pier-office/{pier}/licences?boats=pier` (`covers`) for the holder's own pier, `GET …/staff/{id}/licences?boat_id=` (`covers_boat`) for a boat of another pier; legacy's class lookup until the answer is here and while a change is waiting to be saved |
| `plChip`, `plChips` | WIRED | no edit: they call `plCovers` |

## 2. Fields and rows created

None on the server (no field is sent). Browser-side properties only:

- `ops.vanSplits[i].opsIdx` (and `trip.ops.vanSplits[i].opsIdx`): the server's part idx. Read from `van_parts[].idx`, used as the idx of a group member and of a `van_parts` write; never sent as a field of its own. `ops.vanParts` (already there) still carries the raw parts.
- Module state, not persisted, not sent: `71` keeps the last answers per date; `72` keeps the crew-flags and licence-covers answers. All are dropped by any write.

## 3. Decisions needed

1. **Split rows after a passenger edit.** The server rebalances the parts differently from legacy's `bookingV2HealSplitPax` (model note section 1: 4 ad + 2 chd to 4 ad + 1 chd gives server [4,0] + [0,1], legacy [2,1] + [2,0]). The browser's heal is now off in ops mode, so the server's way is what staff see. Keep, or change the server?
2. **`bookingV2AssignVan` on a split booking** acts on the main part (legacy set `ops.vanId`, which the split rows ignore). Assumption; say if another part should be meant.
3. **`ops/47` `pjBoatSt` keeps legacy's `ovn`** although the server's pier board now sends the state `ovn`. Both rules are the same; drop the exception when you want the server's to win.
4. **`bkOvnHoldMap` / `bkOvnHoldOn` / `baCharterBoatMap`** still compute the hold in the browser for the screens other than Boat Operation (seat counts). The model note says to stop; the task said not to change what is drawn. Stop them once Boat Operation has been walked by staff?
5. **New refusal for staff (backend, Q39):** a held boat cannot go on another route on a night of an overnight charter (`409 charter_boat`); legacy allowed it silently. Staff will see the server's text.
6. **Cache tags.** `tools/build-assets.mjs` rewrites the `?v=` tags at deploy, and most hand-kept tags in `allotment_v2.html` are already out of date here (`t_assetver.mjs` fails on this checkout before and after this work). Only the tags of `34` and `40` were refreshed.
7. **Process incident for the developer.** `git stash` is shared between all worktrees. A `git stash -u` / `git stash pop` pair I ran popped another agent's stash (the w3-aboard work) into this worktree. I put every file back (my own stash is the dangling commit `436dce17`, restored), discarded their changes here and saved them as a patch: `C:\Users\ta-za\AppData\Local\Temp\claude\D--projects-operation-backend\aeca2594-2b93-4019-a83b-f7e48580c741\scratchpad\FOREIGN_STASH_popped_into_w3days.patch` (125 lines: `08-app.js`, `30-ops-money.js`, `31-ops-pfm.js`, `36-ops-day-actions.js`, `40-ops-bookings.js` aboard parts, the `71-ops-aboard.js` script tag). Whoever owns it must check that the stash they expected is not missing. Not repeated: no stash used after that.
