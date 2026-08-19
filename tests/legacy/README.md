# LAM-77 — legacy characterization tests

Characterization tests for `allotment_v2/allotment_v2.html` (the ~76.5k-line
single-file client) and its `server.js` persistence contract, covering the six
areas named in LAM-77: booking persistence, edit-preserve fields,
cancelled-status aggregates, seat locks, boat assignment, and rate-type
pricing.

**These tests describe what the code does today, including behavior that
looks wrong.** Where a test's own title says "INTENTIONAL EXCEPTION", that is
a real inconsistency this pass found in the source — it is documented and
asserted on, not fixed. See [`EXCEPTIONS.md`](./EXCEPTIONS.md) for the full
list with file/line references and suggested follow-ups.

## Why this isn't "click through the app and eyeball it"

`allotment_v2.html` has no module boundaries, no build step, and mixes DOM
rendering with business logic in the same functions. There is no way to
`import` a piece of it. Instead, every test in this directory:

1. Reads the **real** `allotment_v2/allotment_v2.html` from disk (read-only —
   nothing here ever writes to it).
2. Pulls out the **exact source text** of one real function (or, for a few
   inline blocks that aren't standalone functions, a marker-delimited span of
   real source lines) using `lib/source.mjs`.
3. Runs that source in a fresh Node `vm` context (`lib/sandbox.mjs`) with a
   minimal, explicitly-listed set of stub globals (fixture data, no-op
   `alert`/`confirm`, a tiny in-memory `localStorage`).
4. Asserts on the real return value / real side effects.

If a future refactor changes what one of these functions does, the matching
test fails — that is the point. If a refactor only changes *how* the function
is written (same behavior, different code), the test still passes, because it
re-extracts the current source every run rather than pinning a copy of it.

A few tests (documented individually in-file) are pure **source-level scans**
(counting/locating literal text) rather than execution, used where a
function's dependency graph was too wide to extract cleanly for this pass —
each such test says so in its title/body.

## Running

No `npm install` needed — everything uses Node's built-in `node:test` /
`node:vm` / `node:assert`. Requires Node >= 18 (developed against Node 24).

```bash
cd tests/legacy
node --test *.test.mjs
# or, equivalently:
npm test
```

From the repo root:

```bash
node --test 'tests/legacy/*.test.mjs'
```

(`node --test tests/legacy` — a bare directory path with no glob — does NOT
recurse into this folder on the Node version this was developed against; use
the glob form above, or `cd` in first. This is called out explicitly because
it is an easy way to get a false "0 tests ran" green result.)

This directory is fully self-contained: its own `package.json`
(`"type":"module"`, scoped to this folder only — it does not touch or require
any change to the repo root `package.json`), its own fixtures, its own test
config. Nothing under `tests/legacy/` requires editing shared root
configuration or CI wiring; see `docs/development/tasks/LAM-77.md` for the one
CI-wiring item that is filed as a follow-up rather than done here.

## File map

| File | Area | What it extracts from allotment_v2.html |
|---|---|---|
| `lib/source.mjs` | (shared) | Loads + caches the file; brace-aware `extractFunction(name)`; marker-based `extractBetween(start,end)`; `occurrences()`/`lineOf()` for source scans. |
| `lib/sandbox.mjs` | (shared) | Runs extracted source in a `node:vm` context with injected stub globals; tiny `localStorage` stand-in. |
| `booking-persistence.test.mjs` | Booking persistence | `save(area)`; the `sb_bookings` `Array.isArray` load guard; the `SB_BOOKINGS` placement (replace-in-place vs `unshift`) + final `localStorage` write inside `bkV2CommitBooking`. |
| `edit-preserve.test.mjs` | Edit-preserve fields | The three `if(editing){...}` carry-over sub-blocks inside `bkV2CommitBooking` (history/weatherResolve/rebook/invoiceId/paymentStatus/ops · upgrades/feeItems/reschedule/partialCancels/cancellation/cancelCategory · travel-date-change ops clearing). |
| `cancelled-status-aggregates.test.mjs` | Cancelled-status aggregates | Executes `getSeatsConsumed` (+ `bkPendHoldsSeat`, `getTripPaxTotal`); source-scans every cancelled-status exclusion literal in the file. |
| `seat-locks.test.mjs` | Seat locks | The full `bkV2Lock*` pool-hold/parent-child/rolling-release cluster; the tiered anti-overbook guard block inside `bkV2CommitBooking`. |
| `boat-assignment.test.mjs` | Boat assignment | `bkV2AssignBoat` + `baCharterBoatMap`/`baCharterBoatMapMemo`/`baCharterBoatIds` + the `bkOps*`/`bkTripDates`/`bkIsFirstDay` cluster; reads the live `BA_CAP_TOL` constant rather than hardcoding it. |
| `rate-type-pricing.test.mjs` | Rate-type pricing | `tsNetOf` (+ `_tsNum`) for real seat/charter net pricing; `_rtNormalizeLongtail`/`_rtLongtailForRoute` for per-route longtail pricing and its 3 legacy-shape migrations. |
| `EXCEPTIONS.md` | (all areas) | The intentional-exception findings, indexed by area, with file/line and a suggested follow-up. |

## Deliberate scoping choices (things NOT executed here)

- **`bkV2CommitBooking` as a whole** is never run end-to-end — it is a
  ~700-line function mixing `alert`/`confirm` UI prompts, DOM re-render calls,
  and business logic with no separable pure core. Instead this suite extracts
  the specific decision blocks that matter for LAM-77's six areas (the
  anti-overbook guard, the edit-preserve carry-over, the final persist path)
  as independently-runnable spans. The full function is characterized at the
  granularity LAM-77 asks for, not line-by-line.
- **`baAssignedPax`** (used by `bkV2AssignBoat`'s cap check) is stubbed rather
  than extracted in `boat-assignment.test.mjs` — it pulls in
  `bkBoatPaxOnBoat` and the multi-boat "split booking across boats" model
  (`§boatSplit` in the source), which is a distinct feature from the cap+2
  tolerance rule this task is characterizing. Documented in that file's header
  comment and in `EXCEPTIONS.md`.
- Seat-lock **rolling release** (`bkV2LockReleaseCutoff`) is characterized for
  its date-boundary logic, not its exact clock-time-of-day math beyond that —
  the `releaseTime` HH:MM parsing is exercised implicitly (far-future vs
  far-past dates) rather than with second-precision boundary tests.
