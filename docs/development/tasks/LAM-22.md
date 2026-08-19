# LAM-22: Stand up the test harness (S1-08)

## Input contract

- **Requested outcome:** Stand up a test harness for the areas that currently have no framework wired in — a runner in CI, ephemeral Postgres provisioned per run, one end-to-end proof that creates a booking through the real write path and asserts the row in Postgres, and a fixture helper that builds a booking without the DOM.
- **Acceptance criteria:**
  - A CI workflow (`.github/workflows/tests.yml`) runs the test suite on push/PR against an ephemeral Postgres service container.
  - A DOM-free fixture helper builds a valid `SB_BOOKINGS`-shaped booking object for reuse across tests.
  - One end-to-end test creates a booking through the application's real write path (not a mock) and asserts the resulting row exists in Postgres.
  - The existing informal checks (`db/test_seat_lock_race.mjs`, `db/rt.cjs`) are accounted for / wired where reasonable.
  - No test is reported as passed unless it was actually executed and observed to pass.
- **Allowed scope:** `test/`, `.github/workflows/tests.yml`, `docs/development/tasks/LAM-22.md`, `.agent-reports/LAM-22.json`.
- **Constraints/invariants:**
  - Do not edit root `package.json` (owned exclusively by LAM-16, running in parallel this sprint) — record needed devDependency/script changes in this report instead.
  - `db/migrations/` does not exist on this base branch (deleted at `094dde1`); **LAM-73** (still To Do) owns whether it is rebuilt from `pg_get_viewdef`, restored as-is, or abandoned — do not invent migration SQL and do not restore deleted files.
  - No Postgres is reachable from the target sandbox for this task; any test that cannot actually be executed there must be reported `not_run` or `blocked`, never `passed`.
  - Do not edit `allotment_v2/allotment_v2.html`.
  - Stage only the owned paths, explicitly, never `git add .`/`-A`.
- **Base branch:** `refactor/booking-v2-migration`
- **Starting assumptions:**
  - "The real write path" refers to the relational backend's REST API (`POST /api/v1/_batch` → `restApplyOp` → `operation_schemas.sb_bookings` via `os_repo.decomposeBlob`), matching CLAUDE.md's statement that prod currently runs `DATA_BACKEND=relational` — not the legacy whole-blob `/api/save` path.
  - Node's built-in test runner (`node:test`, stable since Node 18) is acceptable given the package.json edit restriction, since it needs zero new devDependencies.
  - A local, fully ephemeral Postgres instance stood up solely inside this session to verify the harness's own logic (never committed, discarded before finishing, never a shared instance) does not conflict with "no Postgres is reachable from this sandbox" as a description of the delivered CI/test artifacts' target environment.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| CI | No workflow runs any test on push/PR; `db/test_seat_lock_race.mjs` and `db/rt.cjs` are runnable scripts but wired into no pipeline | `.github/workflows/tests.yml` runs `node --test` (unit + e2e, e2e self-skipping until LAM-73) plus `db/test_seat_lock_race.mjs` on every push to `agent/**`/`refactor/booking-v2-migration` and on PRs into `refactor/booking-v2-migration` or `main` |
| Booking test fixtures | No way to construct a valid `SB_BOOKINGS` object outside the browser/DOM | `test/fixtures/booking.mjs` builds a DOM-free, schema-verified booking (+trip+passenger) object reusable by any future test |
| Write-path coverage | No test exercises `POST /api/v1/_batch` (the relational booking write path) end to end | `test/e2e/booking-write-path.test.mjs` exists and is correct against `server.js`'s actual code paths (verified by inspection + a real boot-safety check); it will start actually running once LAM-73 provisions `operation_schemas.sb_bookings` |

### Interfaces and contracts

- **Added:**
  - `test/fixtures/booking.mjs`: `buildBooking(overrides)`, `buildTrip(overrides)`, `buildPassenger(overrides)`, `zzTestId(prefix)`, `CANCELLED_STATUSES`
  - `test/helpers/db.mjs`: `getPool()`, `closePool()`, `hasBookingSchema(pool)`, `fetchBookingRow(pool,id)`, `deleteBooking(pool,id)`
  - `test/helpers/server.mjs`: `startServer(opts)`, `loginClient(baseUrl,username,password)`
- **Changed:** None
- **Removed:** None
- **Compatibility notes:** Purely additive — no existing file was modified. `test/e2e/booking-write-path.test.mjs` writes and deletes only a scratch record (id prefixed `zz_test_`), through the same public endpoint the app itself uses, and only when its schema precondition is met (currently never, until LAM-73).

### Files changed

```text
added	.github/workflows/tests.yml
added	.agent-reports/LAM-22.json
added	docs/development/tasks/LAM-22.md
added	test/README.md
added	test/e2e/booking-write-path.test.mjs
added	test/fixtures/booking.mjs
added	test/helpers/db.mjs
added	test/helpers/server.mjs
added	test/unit/booking-fixture.test.mjs
```

### Data and persistence impact

- **Database/schema:** None changed. The e2e test, once its precondition is met, writes and deletes one scratch `sb_bookings` row via the existing REST endpoint — identical in kind to a normal app write.
- **API or mapper:** None changed. `test/helpers/db.mjs` reads `field_mapping.json`/`operation_schemas_model.json` conventions but does not modify `os_repo.js` or the mapping files.
- **Migration required:** No new migration authored here. A migration (`db/migrations/002_add_operation_schemas.sql` or its successor) is required for the e2e test to actually run its PASS path, but that is tracked entirely by LAM-73, not by this task.
- **Rollback effect on data:** None — every changed file is net-new.

## Verification evidence

| Command/check | Result |
|---|---|
| `node --test` (repo root, no `DATABASE_URL` set) | **Passed** — 12 passed, 1 skipped ("DATABASE_URL not set — no Postgres reachable from this environment"), 0 failed. `test/unit/booking-fixture.test.mjs`: 10/10 assertions passed. |
| `node --test` with `DATABASE_URL` pointing at a fresh, fully isolated, session-local ephemeral Postgres with **no** `operation_schemas` schema at all (own `initdb` in a scratch temp dir, own port, destroyed at the end of this session — never a shared/CI/prod instance) | **Passed** — e2e test correctly self-skips with `"operation_schemas.sb_bookings/users not provisioned on this DATABASE_URL — blocked on LAM-73 (db/migrations was removed at 094dde1 and not yet rebuilt/restored)"`; 12 passed, 1 skipped, 0 failed. |
| Boot `server.js` (`DATA_BACKEND=relational`) against that same schema-less ephemeral Postgres, then `curl /api/login` | **Passed** (as a safety check, not a claim about the e2e test itself) — server boots and listens without crashing (`LOVE Andaman on 8790 · db on`). `initDb()` logs exactly the expected gap: `[db] init failed at step "sb_markets.sort col": relation "operation_schemas.sb_markets" does not exist`. Because that abort happens before the admin-seed step, `/api/login` correctly returns a normal 401 for any credentials — not a crash. This is precisely the condition `hasBookingSchema()` is built to detect and skip on. |
| `node --test test/e2e/booking-write-path.test.mjs` against a Postgres with the relational booking schema actually provisioned (the test's **PASS path**: real write + readback) | **Not run** — `operation_schemas.sb_bookings` does not exist on this branch (deleted at `094dde1`, not yet rebuilt — LAM-73). Hand-authoring that schema locally to force a green run was deliberately avoided per this task's explicit constraint against inventing migration SQL, even uncommitted/local-only. Verified instead by code inspection against `server.js`'s `restApplyOp`/`decomposeBlob`/`os_repo` mapping and `field_mapping.json`, plus the boot-safety check above. |
| `db/test_seat_lock_race.mjs` against the same session-local ephemeral Postgres (`DATABASE_URL` set, no TLS) | **Failed** — `Error: The server does not support SSL connections`. Pre-existing bug in a file outside this task's owned paths: the script hardcodes `ssl:{rejectUnauthorized:false}`, which makes `node-postgres` require TLS; a plain ephemeral/CI Postgres (including the stock `postgres:16` GitHub Actions service container this task's own workflow provisions) does not speak TLS. Wired into `.github/workflows/tests.yml` as `continue-on-error: true` with this exact explanation, rather than hiding the failure or leaving the script unwired. See Follow-up work. |
| `.github/workflows/tests.yml` (GitHub Actions YAML) | **Not run** — no GitHub Actions runner or `actionlint`/YAML validator was available in this sandbox. Reviewed by hand (no tabs, consistent indentation, structure matches GitHub's documented postgres-service-container example); each step reproduces, one by one, a command already verified above against the equivalent local ephemeral Postgres — but the workflow file itself was not executed end-to-end by a real Actions runner. |

## Decisions, risks, and rollback

- **Decisions:**
  - Used Node's built-in test runner (`node:test`) instead of Jest/Vitest/Mocha — zero new devDependencies, and root `package.json` is off-limits this run.
  - Targeted the relational REST write path (`POST /api/v1/_batch`) as "the real write path" for the e2e proof, per CLAUDE.md's statement that prod currently runs `DATA_BACKEND=relational`.
  - Built and destroyed a throwaway, fully isolated local Postgres cluster purely to verify the harness's own precondition/skip logic and `server.js`'s boot behavior for real — never to fabricate a passing result for the e2e test's actual write+readback assertions, and never touching any shared or pre-existing Postgres instance found in the environment.
  - Declined to hand-write a local-only `operation_schemas.sb_bookings` schema to force the e2e test's happy path green, even uncommitted, because the task explicitly forbids inventing migration SQL and that decision belongs to LAM-73.
  - Wired `db/test_seat_lock_race.mjs` into CI as `continue-on-error` rather than omitting it (the Jira scope calls it out by name) or leaving it as a hard-required gate the harness cannot currently pass through no fault of its own.
- **Known risks:**
  - The e2e test has only been verified on its SKIP path. Its PASS path is correct by code review but unexercised against a live populated schema — a real mismatch would only surface once LAM-73 lands and CI runs it for the first time.
  - `db/test_seat_lock_race.mjs` will keep failing (non-blocking) in the added CI workflow until its SSL option is made conditional the way `server.js`'s own `Pool` setup already is.
  - `.github/workflows/tests.yml` was authored and manually reviewed but never executed by an actual GitHub Actions runner in this sandbox.
- **Blockers:**
  - `test/e2e/booking-write-path.test.mjs` cannot be proven to pass until LAM-73 provisions `operation_schemas.sb_bookings`/`__trips`/`__passengers` and `operation_schemas.users` (`db/migrations/002_add_operation_schemas.sql`, deleted at `094dde1`) on the environment CI uses.
- **Dependencies:**
  - Root `package.json` (owned by LAM-16, not edited here) would benefit from: `scripts.test = "node --test"`; `scripts["test:e2e"] = "node --test test/e2e"`. No new devDependencies required — `node:test` is built into Node ≥18 (already the `engines` floor) and `pg` is already a dependency.
  - `db/package.json` / `db/test_seat_lock_race.mjs` (not owned by this task) needs its `Pool` `ssl` option made conditional the same way `server.js:1411` already is — otherwise it cannot pass against any plain ephemeral/CI Postgres, including the one this task's own workflow provisions.
  - LAM-73: rebuild/restore/abandon `db/migrations/` decides whether `test/e2e/booking-write-path.test.mjs` and the CI workflow's "apply db/migrations" step ever activate. No code change is needed in this task's files once that lands — `hasBookingSchema()` will simply start returning `true`.
- **Follow-up work:**
  - Once LAM-73 lands: run the CI workflow for real and confirm `test/e2e/booking-write-path.test.mjs`'s PASS path actually passes; fix any field-name mismatch it surfaces.
  - Fix `db/test_seat_lock_race.mjs`'s hardcoded `ssl:{rejectUnauthorized:false}` to match `server.js`'s conditional pattern, then flip `continue-on-error` back to `false` (or remove it) in `.github/workflows/tests.yml`.
  - Once LAM-16 lands root `package.json` changes, add the `test`/`test:e2e` npm scripts listed under Dependencies above.
  - Consider wiring `db/rt.cjs` (the live-prod round-trip safety gate) into a separate, manually-triggered workflow — it intentionally reads a live prod-shaped DB and does not belong in the per-PR ephemeral-Postgres job this task added.
- **Rollback procedure:** Revert the merge commit / close the PR without merging. Every file this task touches is net-new (`test/`, `.github/workflows/tests.yml`, `docs/development/tasks/LAM-22.md`, `.agent-reports/LAM-22.json`) — nothing existing was modified, so rollback is a pure deletion with no data or schema effect.

## Agent handoff

- **Task:** LAM-22
- **Branch:** `agent/LAM-22-test-harness`
- **Worktree:** `D:/projects/wt-sprint1/LAM-22-test-harness`
- **HEAD at scaffold:** `fa60a96e2d86c7776e04a0cf726f7ed8eb60a7c6`
- **Merge base:** `fa60a96e2d86c7776e04a0cf726f7ed8eb60a7c6`
- **PR:** TBD — created after this report is committed and pushed (see Publish step of the agent-change-pr skill).
- **Unrelated changes left untouched:** `package.json`/`package-lock.json` (LAM-16's exclusive scope this run), `db/migrations/` (not restored/invented — LAM-73's scope), `db/rt.cjs`/`db/test_seat_lock_race.mjs` internals (not owned by this task; issues found are reported under Dependencies/Follow-up work instead of fixed directly).
