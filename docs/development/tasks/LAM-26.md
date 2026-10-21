# LAM-26: Seat-lock and allotment invariant tests (S2-02)

## Input contract

- **Requested outcome:** Add invariant tests (assertions that fail if the rule is
  broken, not just characterization of current behavior) protecting the
  interlocking seat-lock / allotment rules in `allotment_v2.html`: children
  contribute 0 to the pool (`bkV2LockPoolHold:41783`); month locks use rolling
  per-trip release, not a global expiry (`:41696`); `lockDraws` is the source of
  truth for lock usage, not the `used` counter; over-capacity `pending_approval`
  bookings hold no seats (`bkPendHoldsSeat:12040`); charter never consumes seats
  from the pool; the hard-block vs soft-confirm split in the anti-overbook guard
  at `:76672`; and the cancelled-status exclusion (`['cancelled','cancelled_weather','rejected']`)
  across all six named aggregate sites.
- **Acceptance criteria:** Real-execution (vm-sandboxed, extracted-from-source) tests
  for every rule above, added only as delta beyond LAM-77's existing characterization
  suite (`tests/legacy/seat-locks.test.mjs`, `tests/legacy/cancelled-status-aggregates.test.mjs`
  on `origin/main`, not present on this branch), with the overlap stated explicitly and
  the six aggregate sites enumerated with their real count/locations.
- **Allowed scope:** `test/regression/seat-locks/**`, `docs/development/tasks/LAM-26.md`,
  `.agent-reports/LAM-26.json` only. No edits to `test/helpers/**`, `test/fixtures/**`,
  root `package.json`, `test/regression/edit-preserve/**` (LAM-25, concurrent), or
  `allotment_v2/allotment_v2.html` (read-only).
- **Constraints/invariants:** Reuse the LAM-22 harness pattern (`node:test`,
  `node:assert/strict`, zero new dependencies). Do not duplicate LAM-77's existing
  coverage; add only the delta. Declare — don't make — any change needed in files
  this task doesn't own.
- **Base branch:** `refactor/booking-v2-migration`
- **Starting assumptions:** `test/` (helpers/fixtures/unit/e2e, from LAM-22) already
  exists on this branch; `tests/legacy/` (LAM-77) does not exist on this branch — it
  was read via `git show origin/main:tests/legacy/...` without checking it out.

## Decisions

1. **Local `lib/source.mjs` + `lib/sandbox.mjs` instead of editing `test/helpers/`.**
   LAM-77's extraction/sandbox helpers (`tests/legacy/lib/source.mjs`, `sandbox.mjs`)
   live on `origin/main` only and this task does not own `test/helpers/**`. Rather than
   edit a shared file this task doesn't own, `test/regression/seat-locks/lib/source.mjs`
   and `lib/sandbox.mjs` are local re-implementations of the same technique (extract
   real function source out of `allotment_v2.html` at test-run time, run it in a fresh
   `node:vm` context, assert on real output) — same purpose, same design, kept inside
   this task's owned tree. See "Follow-ups" for the suggested consolidation once both
   branches share a base.

2. **The "six aggregate sites" were resolved from LAM-77's own naming, then
   independently re-verified in this branch's source, not assumed.** LAM-77's last
   test in `cancelled-status-aggregates.test.mjs` names exactly six functions using the
   documented 3-status cancelled exclusion: `getSeatsConsumed`, `getBookingsForRouteDate`,
   `baCharterBoatMap`, `flBoatBookingsFor`, `baAssignedPax`, `baAssignedBookings`. All
   six were confirmed to exist in THIS branch's `allotment_v2.html` (`grep -n "function
   <name>("`), and all six use the exclusion list at the same line numbers LAM-77 found:

   | Function | Line | Exclusion form used |
   |---|---|---|
   | `getSeatsConsumed` | `:12046` | inline (`bk.status === 'cancelled' \|\| ...`) |
   | `flBoatBookingsFor` | `:12075` | bracket (`['cancelled','rejected','cancelled_weather'].includes`) |
   | `getBookingsForRouteDate` | `:12189` | inline |
   | `baCharterBoatMap` | `:45323` | bracket |
   | `baAssignedPax` | `:45465` | bracket |
   | `baAssignedBookings` | `:45497` | bracket |

   No seventh site was found among these six specific names, and none of the six was
   missing. This is a genuinely narrower population than "every call site that
   re-checks the 3-status list" — that literal (bracket + inline spellings combined)
   appears **~90+ times** across the whole 83.7k-line file (accounting, market
   intelligence, pickup map, van jobs, PFM, etc.). Those other call sites are a much
   wider population than "the six aggregate sites" the ticket names and are out of
   scope here (see Follow-ups).

3. **`getSeatsConsumed` (site 1/6) is intentionally NOT re-executed here** —
   `tests/legacy/cancelled-status-aggregates.test.mjs` (LAM-77) already executes it for
   real against all three cancelled statuses plus a confirmed control. Re-implementing
   that would be duplication, not delta, per this ticket's explicit instruction. A
   placeholder test in `cancelled-status-six-aggregates.test.mjs` documents this instead
   of silently omitting site 1/6 from the enumeration.

4. **The other five of the six sites are executed for real for the first time** — LAM-77
   only did a source-text `occurrences()` count for `getBookingsForRouteDate`,
   `baCharterBoatMap`, `flBoatBookingsFor`, `baAssignedPax`, `baAssignedBookings`; it never
   ran them. `cancelled-status-six-aggregates.test.mjs` extracts and vm-executes each of
   the five against real fixture bookings (one test per cancelled status, plus a
   confirmed-booking positive control, plus one cross-site consistency test running a
   single mixed fixture set through all five at once).

5. **Anti-overbook guard tiers (`:76672`)** — LAM-77 already covers each tier firing in
   isolation, the edit-only-guards-the-increase carve-out, and the charter/no-allotment
   exemptions. The delta added here is the split's exact BOUNDARY values (`need ===
   physicalFree` is confirmed to be INSIDE the hard-block `lockViolation` tier — the
   comparison in the source is `<=`, not `<` — and the equivalent boundary at
   `licenseAvailable`), plus a MIXED-TIER case where two trips in one booking hit two
   different tiers in a single guard run (LAM-77's guard calls are all single-trip).
   The exact boundary behavior was verified empirically against the real extracted
   source before writing assertions (see Verification) rather than assumed from reading
   the code, since a mis-read `<=` vs `<` would otherwise silently produce a wrong test.

6. **Month-lock rolling release (`:41696`)** — LAM-77 has a release-cutoff test but on a
   day-scope (single-date) lock reusing the release fields, and a separate dow-filter
   test on a month-scope lock without release fields. Neither combines "this IS a
   month/bulk-scope lock" with "two different dates within that SAME lock have
   independently different release states" — which is literally the ticket's claim
   ("month locks use rolling per-trip release not a global expiry"). This file adds
   that combined case, plus the companion half of the same invariant in
   `bkV2LockExpireSweep` (a stale `expiry` field must NOT sweep-expire a bulk/month lock
   — only its date-range end does; a day-scope lock, by contrast, DOES honor `expiry`
   directly) — LAM-77 does not test `bkV2LockExpireSweep` at all.

7. **`lockDraws` is the source of truth, not `used` (`bkV2LockClaims`/`bkV2LockAudit`)**
   — not touched by LAM-77 at all (its suite never imports these two functions). New
   coverage: `bkV2LockClaims` reads only from bookings' `trips[].lockDraws`, never from
   the lock's own `used` field; a cancelled/rejected/cancelled_weather booking's claim
   is kept (for display) but flagged `dead:true` and excluded from `bkV2LockAudit`'s
   "live" sum; a lock whose stale counter (`used`) disagrees wildly with its live claims
   surfaces that as `diff`, which is the whole point of the audit function.

8. **`bkPendHoldsSeat` (`:12040`)** — LAM-77 exercises this end-to-end through
   `getSeatsConsumed` with two representative bookings. The delta here tests
   `bkPendHoldsSeat` in isolation at its own boundary values: every non-
   `pending_approval` status short-circuits to `true` regardless of `approval`
   contents; `totOver` exactly `0` still holds the seat; the `0 → 1` boundary flips it;
   `over` empty-but-`totOver` positive and `over` non-empty-but-`totOver` absent are
   each independently sufficient (the check is an `||`); a missing `approval` object
   entirely defaults to holding the seat.

9. **Charter never consumes seats** — beyond `getSeatsConsumed`'s own charter exemption
   (LAM-77), this adds `baSeatBookingsForRoute` (a second, independent seat-pool listing
   function filtering `bookingMode!=='charter'`, not exercised anywhere in LAM-77) and
   `baDayBoats` (the Boat-Operation-level mechanism: a boat is dropped from the
   "available for seat trips" list only once it is actually chartered in Boat-Op
   `TRIPS` for that date — a booking alone referencing `charterBoatId` does not remove
   availability by itself, matching CLAUDE.md's "Availability only drops if the charter
   reserves its boat in Boat-Op TRIPS").

## Output contract

### Observable behavior

No production behavior changed — this is a test-only addition. `allotment_v2.html`
was read, never edited.

| Area | Before | After |
|---|---|---|
| Seat-lock / allotment invariants | Covered only by LAM-77's characterization suite (`origin/main`, not present on this branch) plus manual reading of the code | 60 real-execution `node:test` assertions in `test/regression/seat-locks/**` covering the 7 invariant clusters listed above, each vm-sandboxed against the actual extracted `allotment_v2.html` source |
| Six cancelled-status aggregate sites | Only 1 of 6 (`getSeatsConsumed`) had ever been executed against fixture data (by LAM-77); the other 5 were only source-scanned | All 6 enumerated with real line numbers; the other 5 are now executed for real, each with a positive and negative (per-status) case, plus one cross-site consistency test |

### Interfaces and contracts

- **Added:** `test/regression/seat-locks/lib/source.mjs`, `lib/sandbox.mjs` (test-only,
  local helper modules — not part of the application's public interface).
- **Changed:** None.
- **Removed:** None.
- **Compatibility notes:** None — no application code touched.

### Files changed

```text
added	.agent-reports/LAM-26.json
added	docs/development/tasks/LAM-26.md
added	test/regression/seat-locks/anti-overbook-guard-tiers.test.mjs
added	test/regression/seat-locks/bk-pend-holds-seat.test.mjs
added	test/regression/seat-locks/cancelled-status-six-aggregates.test.mjs
added	test/regression/seat-locks/charter-never-consumes-seats.test.mjs
added	test/regression/seat-locks/lib/sandbox.mjs
added	test/regression/seat-locks/lib/source.mjs
added	test/regression/seat-locks/lock-draws-source-of-truth.test.mjs
added	test/regression/seat-locks/lock-pool-hold.test.mjs
added	test/regression/seat-locks/month-lock-rolling-release.test.mjs
```

### Data and persistence impact

- **Database/schema:** None.
- **API or mapper:** None.
- **Migration required:** No.
- **Rollback effect on data:** None — no data touched; tests read `allotment_v2.html`
  only (never write to it) and never connect to Postgres.

## Verification evidence

| Command/check | Result |
|---|---|
| `node --check test/regression/seat-locks/*.mjs test/regression/seat-locks/lib/*.mjs` (each file individually) | Passed — all 9 files syntax-check clean |
| `node --test "test/regression/seat-locks/**/*.test.mjs"` | Passed — 60/60 tests, 0 failed, 16 suites, ~0.7s |
| `node --test` (full repo, from root, no path args — matches `test/README.md`'s documented invocation) | 73/75 passed. The 2 failures (`test/e2e/booking-write-path.test.mjs`, `test/helpers/db.mjs`) are pre-existing and unrelated to this task: `node_modules/` is not installed in this sandbox at all (`ls node_modules` → "No such file or directory"), so both fail on `Cannot find package 'pg'` at import time — this is an environment/dependency-install limitation (no network access for `npm install` in this sandbox), not a regression caused by this change. `test/regression/seat-locks/**` has zero external dependencies (only `node:fs`, `node:path`, `node:vm`, `node:test`, `node:assert/strict`) by design, matching LAM-77's zero-dependency pattern, so it is unaffected by the missing `pg` package. |
| `git diff --stat` / `git diff --name-status` / `git diff --cached --stat` / `git diff --cached --name-status` (owned-scope check) | Passed — working tree and staged set both contain only files under `test/regression/seat-locks/**`, `docs/development/tasks/LAM-26.md`, `.agent-reports/LAM-26.json`; `allotment_v2/allotment_v2.html` untouched |
| `npm test` / a package.json `test` script | Not run — this task does not own root `package.json` and none exists to add a `test` script to; the harness is invoked directly via `node --test` per `test/README.md` |
| Live Postgres / prod service reachability | Not run — no Postgres or prod service is reachable from this sandbox (per task instructions); not needed by any test in this task's scope |

## Decisions, risks, and rollback

- **Decisions:** See numbered list above ("Decisions" section under Input contract).
- **Known risks:**
  - The extraction helpers (`lib/source.mjs`) are brittle by nature (grep/brace-scan
    the monolith by exact function name / literal marker text) — a future refactor
    that renames one of the ~20 extracted functions, or changes the exact literal
    markers used by `extractBetween` in `anti-overbook-guard-tiers.test.mjs`, will make
    the corresponding test throw `not found` / `marker not found`, not silently pass
    wrong. This is the same trade-off LAM-77 made for the same reason (real code,
    not a paraphrase) and is treated as acceptable, matching precedent.
  - `test/regression/seat-locks/lib/source.mjs` and `lib/sandbox.mjs` are near-duplicates
    of LAM-77's `tests/legacy/lib/*.mjs` (different branch). This duplication is
    intentional per this task's owned-files constraint, not an oversight — flagged
    explicitly in Follow-ups for future consolidation.
- **Blockers:** None. Task completed within stated scope.
- **Dependencies:** None — zero new npm packages; reuses only Node's built-in
  `node:test`/`node:assert`/`node:fs`/`node:path`/`node:vm`, already relied on by the
  LAM-22 harness.
- **Follow-up work:**
  1. Once this branch (`refactor/booking-v2-migration`) and LAM-77's branch
     (`origin/main`) share a common base, consolidate `test/regression/seat-locks/lib/*`
     and `tests/legacy/lib/*` into one shared `test/helpers/source.mjs`/`sandbox.mjs`
     (outside this task's owned scope to do unilaterally).
  2. The ~90+ OTHER call sites across the file that also re-check the
     `['cancelled','cancelled_weather','rejected']` list (accounting, market
     intelligence, pickup map, van jobs, PFM, etc.) are a much wider population than
     the six aggregate sites named by this ticket and were not executed here — a
     future ticket could decide whether that wider population needs the same
     real-execution coverage or whether the source-scan LAM-77 already did is
     sufficient for that tier.
  3. `db/migrations/002_add_operation_schemas.sql` still does not exist on this branch
     (removed at `094dde1`, per `test/README.md`) — unrelated to this task, but it means
     no test anywhere in `test/` (including this task's) can exercise the real Postgres
     write path; this task's tests deliberately do not need to.
- **Rollback procedure:** `git revert` the merge commit, or simply delete
  `test/regression/seat-locks/`, `docs/development/tasks/LAM-26.md`, and
  `.agent-reports/LAM-26.json` — no other file is touched, no data or schema exists to
  roll back.

## Agent handoff

- **Task:** LAM-26
- **Branch:** `agent/LAM-26-seat-lock-invariants`
- **Worktree:** `D:/projects/wt-sprint2b/LAM-26-seat-lock-invariants`
- **HEAD at scaffold:** `e7d28f0487b2b51c621a89b21689bc649f7f980a`
- **Merge base:** `fa60a96e2d86c7776e04a0cf726f7ed8eb60a7c6`
- **PR:** [#20](https://github.com/digitalmkt-bbot/LOVE_Andaman_Workspace/pull/20) — `agent/LAM-26-seat-lock-invariants` → `refactor/booking-v2-migration`, state OPEN (verified via `gh pr view 20 --json number,url,title,state,baseRefName,headRefName`)
- **Unrelated changes left untouched:** None encountered — worktree was clean at start
  (`git status --short --branch` showed no pre-existing modifications); no other
  agent's files were touched.
