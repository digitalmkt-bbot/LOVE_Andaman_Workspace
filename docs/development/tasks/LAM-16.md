# LAM-16: Add a CI boot smoke test for server.js

## Input contract

- **Requested outcome:** A CI job that would have caught S1-01 — it runs `require('./server.js')` for real (by spawning it) against a scratch Postgres, makes one authenticated `/api/version` request, and fails if `map.*`/`db.*` drift counters are non-zero or `mig.failed`/`mig.pending` is above zero.
- **Acceptance criteria:** New GitHub Actions workflow defines a Postgres service, boots `server.js` against it, and fails the job on any of: `map.tables`/`map.columns` non-zero, `db.missing`/`db.extraInDb` non-zero, `mig.failed` non-zero, `mig.pending` > 0. Documented via `allotment_v2/docs/workflows/07-data-persistence-api.md` §0 and §10 (invariants 5, 7, 18).
- **Allowed scope:** `root package.json`, `.github/workflows/ci-boot-smoke.yml`, plus this task's own `tools/ci-boot-smoke.mjs`, `docs/development/tasks/LAM-16.md`, `.agent-reports/LAM-16.json`. Excludes `allotment_v2/allotment_v2.html`, `test/**`, `.github/workflows/tests.yml` (owned by LAM-22, running in parallel).
- **Constraints/invariants:** No persistence/schema/SQL/API behavior change. No scratch Postgres available in this sandbox — DB-backed checks must be built into the CI workflow itself and reported as `not_run`/`blocked` locally, never `passed`. `esc`/`escapeHTML` and `bkV2LocalYMD` conventions N/A (no HTML edits made).
- **Base branch:** `refactor/booking-v2-migration`
- **Starting assumptions:** `os-backend/` (deleted at `094dde1`, the S1-01 bug) was already restored by `1c10d84` on this branch, so `require('./server.js')` succeeds today — this task adds the regression guard, it does not fix S1-01 itself. `db/migrations/` is documented as still absent from the repo (`07-data-persistence-api.md` §0), a separate, larger gap out of this task's scope.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| CI on this repo | No GitHub Actions workflows exist at all (`.github/workflows/` was absent) | `ci-boot-smoke.yml` runs on every PR into `refactor/booking-v2-migration`/`main` and on push to `refactor/booking-v2-migration`, spawning `server.js` against a real (scratch) Postgres |
| Detecting a broken boot (S1-01 class) | Silent — merges straight to prod, discovered only by the app actually failing to start (as happened at `094dde1`) | `node tools/ci-boot-smoke.mjs` fails loudly if `server.js` exits before listening, e.g. from a `require()` throw |
| Detecting silent mapping/DB drift (`map.*`/`db.*`) | Silent — only visible by manually hitting `/api/version` on a live deploy | CI job fails the moment any drift counter goes non-zero |
| Detecting a stuck/failed migration | Silent — `mig.failed`/`mig.pending` only ever inspected manually | CI job fails if `mig.failed` > 0 or `mig.pending` > 0 |

### Interfaces and contracts

- **Added:** `tools/ci-boot-smoke.mjs` (new script, no existing consumer); `package.json` script `ci:boot-smoke`; `.github/workflows/ci-boot-smoke.yml` (new workflow).
- **Changed:** None.
- **Removed:** None.
- **Compatibility notes:** Purely additive. Does not touch `server.js`, `allotment_v2.html`, or any persisted schema. Making the new check *required* to merge is a GitHub branch-protection setting on `refactor/booking-v2-migration`, which this diff cannot configure (repo-admin action, listed as a follow-up).

### Files changed

```text
tools/ci-boot-smoke.mjs             — new: spawns server.js against $DATABASE_URL, logs in, checks /api/version
.github/workflows/ci-boot-smoke.yml — new: Postgres service container + npm ci + run the smoke script
package.json                        — added scripts.ci:boot-smoke convenience alias
docs/development/tasks/LAM-16.md    — this report
.agent-reports/LAM-16.json          — machine-readable manifest
```

### Data and persistence impact

- **Database/schema:** None. The workflow provisions its own throwaway `postgres:16` service container per run; nothing touches a real database.
- **API or mapper:** None. The script only reads `/api/version` and `/api/login` — no writes.
- **Migration required:** No.
- **Rollback effect on data:** None — CI-only change, no runtime/data effect if reverted.

## Verification evidence

| Command/check | Result |
|---|---|
| `node --check tools/ci-boot-smoke.mjs` | Passed — syntax valid |
| `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"` | Passed — `package.json` still valid JSON after the edit |
| `npx --yes js-yaml .github/workflows/ci-boot-smoke.yml` | Passed — workflow YAML parses cleanly (rendered to equivalent JSON, no errors) |
| `npx --yes @action-validator/cli .github/workflows/ci-boot-smoke.yml` | Passed — no schema errors reported against the GitHub Actions workflow schema |
| Local dry run: `DATABASE_URL=postgres://ci_smoke:ci_smoke@127.0.0.1:59999/ci_smoke node tools/ci-boot-smoke.mjs` (unreachable DB, short timeouts) | Passed as a *script self-test* — confirmed `require('./server.js')` succeeds today (`os-backend` present), `[map] field_mapping.json covers every table and column in operation_schemas_model.json` (map drift is currently 0/0 on this branch), the server boots/listens, and the script's spawn → poll → login-retry → timeout → diagnostic-error path all behave correctly. This is NOT a substitute for the real Postgres-backed check. |
| Full check against a real scratch Postgres (server logs in as the seeded admin, `/api/version` returns clean `map`/`db`/`mig` counters) | **Not run** — no scratch Postgres is available in this sandbox, per task constraints. This is the workflow's actual job on GitHub Actions (the `postgres:16` service container); it has not been executed here. |
| End-to-end CI run on GitHub Actions (the workflow actually executing after push) | **Not run** — requires the push/PR to trigger Actions; not executed as part of this local session. |

## Decisions, risks, and rollback

- **Decisions:**
  - Used `DATA_BACKEND=relational` in the CI job (not the default `blob`) because `db.*`/`mig.*` drift checks are meaningful in that mode — see `server.js:83-84` (`dbDriftCheck` early-returns when not relational) — and this matches how prod actually runs.
  - `/api/version` requires a session, so the script performs a real login as a throwaway `ADMIN_USER`/`ADMIN_PASS` seeded via env vars that `initDb()` creates on first boot against the empty scratch DB (`server.js:1727-1732`), rather than trying to bypass auth.
  - Login is retried with a timeout rather than attempted once, because `initDb()` runs asynchronously after `server.listen()` fires, so the very first request can legitimately race ahead of the admin-user seed step.
  - "Any HTTP response counts as boot success" for the readiness poll (rather than grepping stdout for a specific log line), so the check doesn't silently rot if a log message wording changes.
- **Known risks:**
  - **This job is expected to fail red today, and that is correct, not a bug in the check.** `db/migrations/` is documented as absent from this repo (`07-data-persistence-api.md` §0) — restoring it is out of this task's scope (a schema/persistence change, and not in the owned-files list). Without it, `operation_schemas.*` tables are never created in `DATA_BACKEND=relational` mode, so `initDb()`'s hand-written `ALTER TABLE operation_schemas."sb_markets" ...` step (`server.js:1591` onward) throws on a fresh scratch DB, before the admin-seed step ever runs — so the smoke script's login will time out and fail the job with a message pointing at `db/migrations/`, rather than with a clean `db.missing` count. This surfaces the real, pre-existing gap rather than papering over it; restoring `db/migrations/` is flagged as a follow-up, not attempted here.
  - Branch protection to make this check *required* to merge is not configured by this diff (GitHub repo setting, no file to edit for it) — flagged as a follow-up.
  - The workflow has not actually executed on GitHub Actions yet; first real run may surface environment issues (image pull time, `npm ci` cache behavior) not visible locally.
- **Blockers:** None for this task's own scope — the migrations gap above is a pre-existing, separately-tracked condition, not something this task is blocked on completing.
- **Dependencies:** None on other in-flight tasks. Coexists with LAM-22 (`test/**`, `.github/workflows/tests.yml`) — no shared files.
- **Follow-up work:**
  1. Restore `db/migrations/` (or otherwise provision `operation_schemas.*` tables) so this job's `db.*`/`mig.*` counters are exercised meaningfully rather than failing at the login step.
  2. Configure `ci-boot-smoke` as a required status check under GitHub branch protection for `refactor/booking-v2-migration`.
  3. Once a real Actions run has executed, confirm timing (image pull + `npm ci` + boot) comfortably fits the `timeout-minutes: 10` budget; tune if needed.
- **Rollback procedure:** Delete `.github/workflows/ci-boot-smoke.yml` and `tools/ci-boot-smoke.mjs`, and remove the `ci:boot-smoke` script line from `package.json`. No data or schema changes to undo.

## Agent handoff

- **Task:** LAM-16
- **Branch:** `agent/LAM-16-ci-boot-smoke`
- **Worktree:** `D:/projects/wt-sprint1/LAM-16-ci-boot-smoke`
- **HEAD at scaffold:** `fa60a96e2d86c7776e04a0cf726f7ed8eb60a7c6`
- **Merge base:** `fa60a96e2d86c7776e04a0cf726f7ed8eb60a7c6`
- **PR:** [#10](https://github.com/digitalmkt-bbot/LOVE_Andaman_Workspace/pull/10) — `agent/LAM-16-ci-boot-smoke` → `refactor/booking-v2-migration` (open)
- **Unrelated changes left untouched:** None encountered — worktree was clean at start.
