# LAM-77: Legacy characterization tests for critical workflows

## Input contract

- **Requested outcome:** Capture current behavior of `allotment_v2.html` / `server.js` before the modular-extraction work, prioritizing booking persistence, edit-preserve fields, cancelled-status aggregates, seat locks, boat assignment, and rate-type pricing, so that behavior which looks wrong can be flagged as an intentional exception instead of silently "fixed" during extraction.
- **Acceptance criteria:**
  - Repeatable tests document current behavior and identify any intentional exceptions before modular extraction.
  - Tests characterize (assert what the code does today) rather than refactor or fix anything, including behavior that looks wrong.
  - All six named areas are covered: booking persistence, edit-preserve fields, cancelled-status aggregates, seat locks, boat assignment, rate-type pricing.
  - Tests are repeatable and runnable without manual setup beyond a Node install.
- **Allowed scope:** `tests/legacy/**` (new); isolated legacy-test configuration and fixtures, inside `tests/legacy/` only; `docs/development/tasks/LAM-77.md`; `.agent-reports/LAM-77.json`.
- **Constraints/invariants:**
  - Never alter production code — `allotment_v2/allotment_v2.html` is read-only for this task (grep + narrow windows only).
  - Never alter `apps/web/**` (LAM-76), `docs/adr/**` or `SYSTEM_MAP.md` (LAM-79).
  - Keep every test config/fixture inside `tests/legacy/` — no shared root configuration.
  - Do not edit the root `package.json` or `.github/` — not owned this run; record as a declared dependency/follow-up instead.
  - No characterization may itself change persistence/schema/SQL/API behavior.
  - Read `allotment_v2.html`/`server.js` only via grep + narrow windows, never a whole-file read.
  - Stage only the owned path list; never `git add .` / `git add -A`.
  - No Postgres/prod service reachable from this sandbox; never claim a check passed without running it.
- **Base branch:** `main`
- **Starting assumptions:**
  - The worktree's base ref (`origin/main` at `17a15c4`) predates an already-**merged**, separate prior run of LAM-77 (PR #2, branch `task/LAM-77`) now sitting on the live `origin/main` tip. Per explicit task instructions this is expected: that older PR is left untouched, and this task's own independent characterization work is produced fresh on this branch and published as its own PR — reconciling the two is the coordinator's concern.
  - No npm registry access can be assumed, so the suite is built entirely on Node's built-in `node:test`/`node:vm`/`node:assert` (Node ≥18) — no `npm install` required to run it.
  - "Characterize" is read literally: every test asserts the real, executed output of source text extracted verbatim from `allotment_v2.html` at test-run time, not a hand-written paraphrase.
  - Where a function's dependency graph was too wide to extract cleanly within scope, the dependency is stubbed and the choice is documented, rather than silently narrowing coverage without a note.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| Repository test coverage | No characterization tests existed for `allotment_v2.html`'s booking-persistence / edit-preserve / cancelled-status / seat-lock / boat-assignment / rate-type-pricing behavior on this branch. | 70 repeatable, passing tests (`tests/legacy/*.test.mjs`, 15 suites) assert the real, currently-executing behavior of those six areas by extracting and running the actual source. Runnable via `node --test 'tests/legacy/*.test.mjs'` with zero npm installs. No application behavior changed — only tests and documentation were added. |

### Interfaces and contracts

- **Added:**
  - `tests/legacy/lib/source.mjs`: `getSource()`, `extractFunction(name)`, `extractBetween(startMarker,endMarker,opts)`, `assertUnique(src,marker)`, `occurrences(marker)`, `lineOf(marker)`, `findMatchingBrace(src,openIdx)`.
  - `tests/legacy/lib/sandbox.mjs`: `runInSandbox(code, globals, exportNames)`, `makeLocalStorage(initial)`.
- **Changed:** None.
- **Removed:** None.
- **Compatibility notes:** These are internal test-only helpers under `tests/legacy/`, not part of the app's public surface; no compatibility impact on `allotment_v2.html` or `server.js`.

### Files changed

```text
added   tests/legacy/lib/source.mjs
added   tests/legacy/lib/sandbox.mjs
added   tests/legacy/booking-persistence.test.mjs
added   tests/legacy/edit-preserve.test.mjs
added   tests/legacy/cancelled-status-aggregates.test.mjs
added   tests/legacy/seat-locks.test.mjs
added   tests/legacy/boat-assignment.test.mjs
added   tests/legacy/rate-type-pricing.test.mjs
added   tests/legacy/package.json
added   tests/legacy/README.md
added   tests/legacy/EXCEPTIONS.md
added   docs/development/tasks/LAM-77.md
added   .agent-reports/LAM-77.json
```

Per-file purpose is in [`tests/legacy/README.md`](../../../tests/legacy/README.md#file-map).

### Data and persistence impact

- **Database/schema:** None. No table, migration, or API contract touched.
- **API or mapper:** None. `server.js` was read (grep + narrow windows) but not modified.
- **Migration required:** No.
- **Rollback effect on data:** None — every test uses fixture data and an in-memory `localStorage` stand-in (`tests/legacy/lib/sandbox.mjs`); no test touches a real browser, Postgres, or a running `server.js` process.

## Verification evidence

| Command/check | Result |
|---|---|
| `cd tests/legacy && node --test *.test.mjs` | **Passed** — 70 tests, 15 suites, 70 pass / 0 fail / 0 cancelled / 0 skipped. |
| `cd tests/legacy && npm test` | **Passed** — same 70/70 via the isolated `tests/legacy/package.json` `test` script (confirms it's runnable via `npm` without touching the repo root `package.json`). |
| `node --test 'tests/legacy/*.test.mjs'` (from repo root) | **Passed** — same 70/70 using the documented glob form. |
| `node --test tests/legacy` (bare directory path, repo root) | **Failed** — `MODULE_NOT_FOUND`. Node's `--test` did not recurse into a bare directory path on this build (v24.18.0) the way it does with an explicit glob. Documented as a gotcha in `tests/legacy/README.md` so this isn't mistaken for a valid "0 tests, exit success" run — the glob form above is the verified way to run the suite. |
| `node --version` / built-in `node:test` availability check | **Passed** — Node v24.18.0, `node:test` available; no `npm install` needed or attempted. |
| `git status --short --branch` (task start, before any change) | **Passed** — branch clean at `17a15c46429b126d6e2eda9f2ebcd6b26cb31351`, no pre-existing uncommitted changes (hard-stop #1 not triggered). |
| `git status --short --branch` (after writing files, before staging) | **Passed** — only untracked paths were `tests/`, `docs/`, `.agent-reports/`; nothing outside the owned scope, and `allotment_v2/allotment_v2.html` / `server.js` / root `package.json` / `.github/` show no modifications. |

## Decisions, risks, and rollback

- **Decisions:**
  - Built the suite on Node's built-in `node:test`/`node:vm`/`node:assert` instead of a third-party runner, since npm-install availability couldn't be assumed and the task requires no shared root configuration.
  - Characterization is done by extracting **real** source text from `allotment_v2.html` at test-run time (brace-aware `extractFunction`, marker-based `extractBetween` for inline non-function blocks) and executing it in an isolated `vm` context with stub globals — not a hand-written paraphrase. A future behavior-changing edit makes the matching test fail; a pure refactor that keeps the anchor markers/function names intact keeps passing.
  - `extractBetween` requires each marker to be a unique literal substring of the file (`assertUnique` throws otherwise) — a future edit that makes an anchor ambiguous fails loudly instead of silently extracting the wrong span.
  - `allotment_v2.html` is CRLF-encoded; `getSource()` normalizes to LF once so multi-line markers can be written as plain JS template literals.
  - Where a target function's dependency graph was too wide for this task's scope (`baAssignedPax`'s boat-split model; the full `bkV2CommitBooking` UI/alert/confirm flow as a whole), the dependency was stubbed instead of extracted, and that choice is documented in the relevant test file's header, in `README.md`, and cross-referenced in `EXCEPTIONS.md` where relevant.
  - For the three inline (non-function) blocks characterized — the anti-overbook guard, the edit-preserve carry-over, and the `SB_BOOKINGS` placement+persist block — the exact span was extracted via unique text markers and wrapped in a minimal harness (re-supplying only the one enclosing brace the marker boundary excluded, verified against the real surrounding source before writing the marker).
  - Found/documented 4 intentional-exception items in `EXCEPTIONS.md` (3 newly found, 1 restated from an existing source comment), each backed by a passing test assertion — none fixed, per LAM-77's characterize-only scope. Summary:
    1. Three different "is this booking closed?" status lists (`['cancelled','cancelled_weather','rejected']` vs `['cancelled','completed','rejected']` vs `['cancelled','rejected']`) disagree across `bkV2DetailCancel`/`canCancel`/`canEdit` on the Booking detail screen.
    2. `bkPendHoldsSeat` gates only the seat-pool math (`getSeatsConsumed`), not Boat Operation's pax counts (`baAssignedPax`/`baAssignedBookings`) or the displacement list (`getBookingsForRouteDate`).
    3. The anti-overbook guard silently skips a route/date with no boat assigned at all (already source-commented as intentional; restated with a test).
    4. `save(area)` bypasses its own edit-guard entirely when called with no `area` argument (already source-commented as intentional; restated with a test).
- **Known risks:**
  - Marker-based extraction is coupled to the exact literal text at each anchor point; a future edit changing that text makes the extraction throw loudly (not silently pass on stale logic) — but will require re-anchoring as part of that change.
  - Coverage is real-execution for the core decision logic of each area, not exhaustive of every code path in the ~76.5k-line file (e.g. the B2C-owned-booking override sub-block and the "self-arrive cancels outbound van" sub-block inside the edit-preserve `if(editing)` block were read/confirmed present but not independently executed).
  - Verified only in this sandboxed worktree — no live Postgres, browser, or running `server.js`; characterizes the pure-JS decision logic reachable via source extraction, not full browser/DOM/network-integrated behavior.
  - The already-merged, separate prior LAM-77 run (PR #2, branch `task/LAM-77`, now part of `origin/main`) also added `tests/legacy/**`, `docs/development/tasks/LAM-77.md`, and `.agent-reports/LAM-77.json` with independently-chosen content. This branch was **not** rebased onto that history (per explicit task instructions to leave that older PR untouched), so merging this PR will very likely show these paths as conflicting/duplicate additions. Reconciling the two is a coordinator-level decision.
- **Blockers:** None.
- **Dependencies:**
  - None required to run the suite today. If CI wiring is later added for `tests/legacy/` (e.g. a GitHub Actions job running `node --test 'tests/legacy/*.test.mjs'` on PRs), that belongs in `.github/`, owned by LAM-76 this run — filed as a follow-up, not done here.
  - Reconciling this branch's `tests/legacy/**`/report/manifest with the already-merged prior LAM-77 run's identically-named files on `main` is a coordinator-level follow-up.
- **Follow-up work:**
  - File a ticket for `EXCEPTIONS.md` #1 (unify or explicitly document the 3 different closed/cancelled status lists on the Booking detail screen).
  - File a ticket for `EXCEPTIONS.md` #2 (decide whether Boat Operation's pax counts / displacement list should also gate on `bkPendHoldsSeat`, or document why they intentionally don't).
  - When CI wiring for this suite is added, wire `node --test 'tests/legacy/*.test.mjs'` into `.github/` — owned by LAM-76 this run, not this task.
  - When the modular extraction work begins, extend coverage of the B2C-owned-booking override and "self-arrive cancels outbound van" sub-blocks inside `bkV2CommitBooking`'s edit-preserve block (currently read/confirmed present, not independently executed).
  - Coordinate with whoever owns the already-merged prior LAM-77 run's output on reconciling the two independently-produced `tests/legacy/**` trees before/at merge time.
- **Rollback procedure:** Revert the single commit on `agent/LAM-77-characterization-tests` (or close the PR without merging). All changes are additive — new files only under `tests/legacy/**`, `docs/development/tasks/LAM-77.md`, and `.agent-reports/LAM-77.json` — nothing existing was modified, so rollback has zero effect on any other code path, data, or running service.

## Agent handoff

- **Task:** LAM-77
- **Branch:** `agent/LAM-77-characterization-tests`
- **Worktree:** `D:/projects/wt-sprint2/LAM-77-characterization-tests`
- **HEAD at scaffold:** `17a15c46429b126d6e2eda9f2ebcd6b26cb31351`
- **Merge base:** `17a15c46429b126d6e2eda9f2ebcd6b26cb31351`
- **PR:** [#14](https://github.com/digitalmkt-bbot/LOVE_Andaman_Workspace/pull/14) — `agent/LAM-77-characterization-tests` → `main`, state: open.
- **Unrelated changes left untouched:** None — `allotment_v2/allotment_v2.html`, `server.js`, the root `package.json`, `.github/`, `apps/web/**`, `docs/adr/**`, and `SYSTEM_MAP.md` were all left exactly as found (the first four were read via grep/narrow windows only where relevant; the last three were not touched or read for this task).
