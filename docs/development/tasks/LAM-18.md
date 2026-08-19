# LAM-18: Weather reschedule must clear bk.ops

## Input contract

- **Requested outcome:** When a weather-cancelled trip is resolved with the "reschedule" outcome, the booking's boat/van/check-in assignment for the old day must be cleared, matching the behavior already implemented by `bkV2RescheduleBooking` and the booking-edit date-change path, instead of silently carrying the previous day's boat and van onto the new date.
- **Acceptance criteria:**
  - `bkV2WeatherResolveOne`'s `reschedule` branch clears the OLD date's ops (`boatId`, `vanId`, `vanReturnId`, `returnSameVan`, `vanGroup`, `vanSeq`, `vanSplits`, `pickupTimeFinal`, `vanCheckin`, `pierCheckin`) before moving the trip date, for both single-day bookings (`bk.ops`) and multi-day/OVN bookings (the matching `t.ops`), per `bkOpsRead`/`bkOpsFor`'s per-day semantics.
  - The fix reuses the existing `bkOpsClear(b, date, opts)` helper (added in commit `a747f42`, "Per-trip ops: boat/van assignment moves onto the travel day") rather than duplicating a third inline copy of the clearing logic already present in `bkV2RescheduleBooking` (`:77572`) and the `bkV2CommitBooking` edit-path date-change block (`:76886`).
  - No change to the non-reschedule outcomes (refund/credit/cancel) of `bkV2WeatherResolveOne`.
  - `node --check` passes on the extracted main `<script>` after the edit.
- **Allowed scope:**
  - `allotment_v2/allotment_v2.html` (`bkV2WeatherResolveOne` only, ~line 60024-60037)
  - `docs/development/tasks/LAM-18.md`
  - `.agent-reports/LAM-18.json`
- **Constraints/invariants:**
  - Reuse the existing ops-clear helper rather than writing a third variant.
  - Respect `bkOpsRead`/`bkOpsFor` per-day semantics (day 1 lives on `bk.ops`, later days live on the matching trip's `t.ops`).
  - Do not touch `package.json`, `test/**`, `.github/**`, `CLAUDE.md`, `README.md`.
  - Do not edit files owned by concurrent LAM-17/LAM-19/LAM-20 worktrees editing the same HTML file.
  - Editing `allotment_v2/allotment_v2.html` is explicitly approved for this task.
- **Base branch:** `refactor/booking-v2-migration`
- **Starting assumptions:**
  - `bkV2WeatherTagBookings` only ever tags seat-mode trips (`t.bookingMode !== 'charter'` is excluded at `:59968`, per `allotment_v2/docs/workflows/01-booking-lifecycle.md` §3.7), so the weather-reschedule path never needs the charter "keep the boat" exception that `bkV2RescheduleBooking` and the edit-path both carry for charter bookings.
  - `bkOpsClear(b, date)` is safe to call with the OLD date before the trip's `date` field is mutated, because `bkIsFirstDay`/`bkOpsFor` re-derive "is this the first day" and "which `t.ops`" from the trips array as it stands at call time — calling it after the date move would look up the wrong (already-vacated) date.
  - No Postgres/network-backed verification was possible in this sandbox; verification here is static (`node --check`) plus an isolated unit exercise of the reused `bkOpsClear` helper against single-day and multi-day mock bookings.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| Weather resolve → Reschedule outcome (`bkV2WeatherResolveOne`) | `trip.date` was moved to the new date but `bk.ops` (or the matching trip's `t.ops` on later OVN days) was left untouched — the booking kept the previous day's `boatId`, `vanId`, `vanReturnId`, `vanGroup`/`vanSeq`, `vanSplits`, `pickupTimeFinal`, and stale `vanCheckin`/`pierCheckin` results. | Before the trip date moves, `bkOpsClear(bk, date)` wipes that day's `boatId`, `vanId`, `vanReturnId`, `returnSameVan`, `vanGroup`, `vanSeq`, `vanSplits`, `pickupTimeFinal`, `vanCheckin` and `pierCheckin` — on `bk.ops` for a first/only day or on the matching trip's `t.ops` for a later OVN day — so dispatch has to re-assign boat/van on the new date, matching `bkV2RescheduleBooking` and the booking-edit date-change path. |

### Interfaces and contracts

- **Added:** None
- **Changed:** None (no function signatures changed — `bkOpsClear` was already public/available; this task only adds a call site)
- **Removed:** None
- **Compatibility notes:** No interface change. `bkOpsClear` guarded with `typeof bkOpsClear==='function'` so the call is a no-op (old behavior) if that helper is ever absent, rather than throwing.

### Files changed

| Path | Purpose | Owned by this task? |
|---|---|---|
| `allotment_v2/allotment_v2.html` | In `bkV2WeatherResolveOne`'s `reschedule` branch (~line 60032-60037), call `bkOpsClear(bk, date)` on the OLD date before moving `trip.date` to the new date, guarded by `ndv!==date` so a no-op resolve (new date left equal to the old date) does not clear a still-valid assignment. | Yes |
| `docs/development/tasks/LAM-18.md` | Durable I/O report for this task per `agent-change-pr` skill. | Yes |
| `.agent-reports/LAM-18.json` | Coordinator-readable manifest for this task per `agent-change-pr` skill. | Yes |

### Data and persistence impact

- **Database/schema:** None — reuses the existing `bk.ops` / `t.ops` fields and the existing `bkOpsClear` helper; no new fields introduced.
- **API or mapper:** None.
- **Migration required:** No.
- **Rollback effect on data:** None — the change only affects in-memory mutation order before the existing `sbPaymentsPersist()`/`acctPersistBookings()` calls (unchanged) read-modify-write the `loveandaman_v2` localStorage blob and sync to Postgres through the existing REST path.

## Verification evidence

| Command/check | Result |
|---|---|
| `node --check` on the extracted main `<script>` block of `allotment_v2/allotment_v2.html` (3,477,755 chars, largest inline script) | Passed — printed `SYNTAX_OK`, exit 0, no syntax errors. |
| Isolated unit exercise of `bkOpsClear` against a single-day mock booking and a multi-day/OVN mock booking (`bkTripDates`/`bkIsFirstDay`/`bkOpsRead`/`bkOpsFor`/`bkOpsClear` extracted verbatim from the edited file into a scratch script, run under `node`) | Passed — single-day case: `bk.ops` `{boatId,vanId,vanGroup,vanSeq,pickupTimeFinal,vanCheckin,pierCheckin}` cleared to `{boatId:null,vanId:null,vanGroup:0,vanSeq:0,pickupTimeFinal:'',vanReturnId:null,returnSameVan:false}` with `vanCheckin`/`pierCheckin` deleted. Multi-day case: clearing date `2026-08-21` left `trips[0]` (date `2026-08-20`) ops untouched (`{boatId:'bA'}`) and cleared only `trips[1]`'s `t.ops`, confirming `bkOpsClear`'s per-day targeting behaves as required. |
| `git diff --stat` / `git diff -- allotment_v2/allotment_v2.html` | Passed — diff is a single 4-line insertion inside `bkV2WeatherResolveOne`'s `reschedule` branch; no other lines touched. |
| Manual live-app / Postgres-backed regression test (open `allotment_v2.html` via `start_server.command`, mark a trip weather-closed, resolve a tagged booking with "reschedule", confirm boat/van cleared on the new date) | Not run — no browser/local server or Postgres instance is reachable from this sandbox; this is a static-only worker environment. Recommended as a follow-up manual smoke test before merge. |

## Decisions, risks, and rollback

- **Decisions:**
  - Reused the existing `bkOpsClear(b, date, opts)` helper (added in commit `a747f42` for the per-trip-ops migration) instead of copy-pasting the inline clearing block from `bkV2RescheduleBooking` or the edit-path, satisfying the task's "reuse the existing clear rather than writing a third variant" constraint and keeping per-day semantics centralized in one place.
  - Called `bkOpsClear` with the OLD date, before mutating `trip.date`, because `bkOpsFor`/`bkIsFirstDay` derive their target from the CURRENT trips array — clearing after the move would look up a date no trip has any more.
  - Guarded the clear with `ndv!==date` so resolving with the date field left equal to the original weather-closure date (a no-op reschedule) does not wipe a still-applicable assignment.
  - Did not add the charter "keep the boat" exception that `bkV2RescheduleBooking` and the edit-path both implement, because `bkV2WeatherTagBookings` only tags seat-mode trips (charter trips are excluded at `:59968`), so that branch is unreachable from this code path.
- **Known risks:**
  - Not verified against a live app/Postgres instance in this sandbox (no browser or DB reachable); only a static syntax check plus an isolated unit exercise of the reused helper were performed.
  - LAM-17, LAM-19 and LAM-20 edit the same `allotment_v2/allotment_v2.html` file concurrently in separate worktrees; a merge conflict when this PR lands against `refactor/booking-v2-migration` is expected and accepted per the task brief.
- **Blockers:** None
- **Dependencies:** Depends on the `bkOpsClear`/`bkOpsRead`/`bkOpsFor` helper family introduced in commit `a747f42` ("Per-trip ops: boat/van assignment moves onto the travel day"), already present on `refactor/booking-v2-migration` at the base commit used by this worktree.
- **Follow-up work:**
  - Manually smoke-test in the running app: mark a trip weather-closed (Boat Op → cell → Cancel trip weather), notify the agent, resolve with "Reschedule" to a new date, and confirm the booking shows no boat/van assigned on the new date and that `vanCheckin`/`pierCheckin` from the old date are gone.
  - Consider also routing `bkV2RescheduleBooking`'s and the `bkV2CommitBooking` edit-path's inline ops-clear blocks through `bkOpsClear()` for consistency, since both currently duplicate logic that now overlaps with the helper (out of scope for this ticket).
- **Rollback procedure:** `git revert` the LAM-18 commit on this branch (a single 4-line addition inside `bkV2WeatherResolveOne`); no data migration or persisted-schema change to unwind, since the fix only changes in-memory mutation order of existing `bk.ops`/`t.ops` fields before the existing persistence calls run.

## Agent handoff

- **Task:** LAM-18
- **Branch:** `agent/LAM-18-weather-reschedule-clear-ops`
- **Worktree:** `D:/projects/wt-sprint1/LAM-18-weather-reschedule-clear-ops`
- **HEAD at scaffold:** `fa60a96e2d86c7776e04a0cf726f7ed8eb60a7c6`
- **Merge base:** `fa60a96e2d86c7776e04a0cf726f7ed8eb60a7c6`
- **PR:** None yet — created during publish step.
- **Unrelated changes left untouched:** None — the only implementation edit is the 4-line insertion inside `bkV2WeatherResolveOne` described above.
