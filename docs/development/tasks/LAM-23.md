# LAM-23: Point ARCHITECTURE.md and CLAUDE.md/README.md at the real workflow docs, drop the CHANGELOG.md fiction, fix env var names and the start_server.command path

## Input contract

- **Requested outcome:** CLAUDE.md cites a `CHANGELOG.md` that does not exist and was never tracked in git (6 references) — fix them. `README.md` claims all runtime data lives in `localStorage` (the opposite of the truth: Postgres via `server.js` is the durable source of truth, `localStorage` is the in-browser working copy) and documents `APP_USER`/`APP_PASS` while `server.js` lines 19-20 actually read `ADMIN_USER`/`ADMIN_PASS` — fix both. Also fix the `start_server.command` path and state explicitly that it gives you no `/api`. Create `ARCHITECTURE.md` pointing at `allotment_v2/docs/workflows/`.
- **Acceptance criteria:**
  - Every CLAUDE.md reference to CHANGELOG.md (6 occurrences) is replaced with a working pointer.
  - README.md states Postgres via server.js is the durable store; localStorage/in-memory is the working copy.
  - README.md documents `ADMIN_USER`/`ADMIN_PASS`, not `APP_USER`/`APP_PASS`.
  - CLAUDE.md's `start_server.command` reference uses the real path (`allotment_v2/start_server.command`) and states it serves no `/api`.
  - A new `ARCHITECTURE.md` exists and points at `allotment_v2/docs/workflows/`.
  - Every claim written is independently verified against the actual tree, not assumed from the ticket text.
- **Allowed scope:** `ARCHITECTURE.md`, `CLAUDE.md`, `README.md`, `docs/development/tasks/LAM-23.md`, `.agent-reports/LAM-23.json`.
- **Constraints/invariants:** must not edit `allotment_v2/allotment_v2.html`, `package.json`, `test/**`, or `.github/**`; no persistence/schema/SQL/API behavior change; stage only owned paths explicitly, never `git add -A`/`.`.
- **Base branch:** `refactor/booking-v2-migration`
- **Starting assumptions:** None — every factual claim below was checked directly against this worktree's files, git history, and `server.js` source, per the ticket's explicit "verify every claim" instruction, rather than taken on faith from the Jira description or the workflow doc's drift table.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| `CLAUDE.md` CHANGELOG.md references (6×) | Point at a `CHANGELOG.md` file that does not exist and was never tracked in git | Point at `allotment_v2/docs/workflows/` (via the new `ARCHITECTURE.md`) or state directly that no CHANGELOG.md exists |
| `CLAUDE.md` §4 / file tree, `start_server.command` | Referenced as `start_server.command` with no path context; no mention it lacks an API | Referenced as `allotment_v2/start_server.command`; explicitly states it is a static-file server with **no `/api`**, so no login/sync, and points to `node server.js` for the full stack |
| `README.md` intro | "all runtime data lives in the browser's `localStorage`" | "Postgres... the durable source of truth. The browser keeps a working copy... `localStorage` alone is not where the data lives." |
| `README.md` Data section | "Each browser keeps its own data in `localStorage`" | "Postgres (via `server.js`) is the durable store; each browser's `localStorage`/in-memory copy is a working cache, not the source of truth." |
| `README.md` Deploy section env vars | `APP_USER` / `APP_PASS` | `ADMIN_USER` / `ADMIN_PASS` (matching `server.js:19-20`) |
| `ARCHITECTURE.md` | did not exist | new pointer doc summarizing the Postgres/RAM/localStorage model, the two local-run modes, and linking into `allotment_v2/docs/workflows/` |

### Interfaces and contracts

- **Added:** `ARCHITECTURE.md` (new documentation file).
- **Changed:** None (no code interfaces touched).
- **Removed:** None.
- **Compatibility notes:** Documentation-only change; no runtime, API, or schema surface is affected.

### Files changed

| Path | Purpose | Owned by this task? |
|---|---|---|
| `ARCHITECTURE.md` | New pointer doc: three-layer data model, local-run modes, links to `allotment_v2/docs/workflows/`, notes CHANGELOG.md does not exist | Yes |
| `CLAUDE.md` | Replaced all 6 CHANGELOG.md references; fixed `start_server.command` path + no-`/api` note; added `ARCHITECTURE.md` to companion docs and file tree | Yes |
| `README.md` | Fixed the localStorage-is-the-store claim (both occurrences) and `APP_USER`/`APP_PASS` → `ADMIN_USER`/`ADMIN_PASS` | Yes |
| `docs/development/tasks/LAM-23.md` | This report | Yes |
| `.agent-reports/LAM-23.json` | Machine-readable manifest for the coordinator rollup | Yes |

### Data and persistence impact

- **Database/schema:** None — no schema, mapper, or server code touched.
- **API or mapper:** None.
- **Migration required:** No.
- **Rollback effect on data:** None — Markdown-only change.

## Verification evidence

| Command/check | Result |
|---|---|
| `git log --all --oneline -- CHANGELOG.md` and `git log --all --diff-filter=A --name-only --pretty=format: \| grep -i changelog` | **Passed.** Both returned zero output — `CHANGELOG.md` has never existed at any point in this repo's tracked history, on any branch. |
| `grep -na "ADMIN_USER\|ADMIN_PASS" server.js` | **Passed.** `server.js:19: const ADMIN_USER = (process.env.ADMIN_USER \|\| '').trim();` / `server.js:20: const ADMIN_PASS = process.env.ADMIN_PASS \|\| '';` — confirms the correct env var names. |
| `find . -iname start_server.command -not -path '*/node_modules/*'` | **Passed.** Only match: `./allotment_v2/start_server.command` — confirms it is not at repo root. |
| `grep -n "allotment_v2/start_server.command" allotment_v2/docs/workflows/07-data-persistence-api.md` | **Passed.** Line 569 confirms: "serves static files only on :8765 ... No /api ⇒ the degraded path of §2.1." |
| `grep -n CHANGELOG CLAUDE.md` (after edits) | **Passed.** Only one hit remains, in the new intro line stating CHANGELOG.md does not exist / is not tracked in git; all 5 other references now point at `allotment_v2/docs/workflows/`. |
| `node -e "require('./server.js')"` | **Passed (module load only).** `os-backend/src/mapping/os_repo.js` and `operation_schemas_model.json` load without error (this branch already has commit `1c10d84` restoring them). No `DATABASE_URL`/live Postgres in this sandbox, so login/sync were not exercised — stated plainly, not faked. |
| `git diff --cached --name-status` after `git add -- <owned paths>`, plus `git diff --cached --check` | **Passed.** Staged set was exactly `A .agent-reports/LAM-23.json`, `A ARCHITECTURE.md`, `M CLAUDE.md`, `M README.md`, `A docs/development/tasks/LAM-23.md` — matches the owned-files list exactly. No whitespace conflicts reported. |
| `node --check` on the extracted `<script>` of `allotment_v2.html` | **Not applicable / not run** — this task made no edits to `allotment_v2.html`. |

No Postgres instance and no network-reachable prod/staging service were available in this sandbox; nothing beyond static file inspection, git history, and a local `require()` smoke test was attempted, and none of that touches persistence.

## Decisions, coordination, and rollback

- **Decisions:**
  - Left README.md's `npm start ... opens the app` line and the `(If unset, the app is open to anyone with the URL.)` line unchanged: neither was named in this ticket's scope, and the second is not a simple var-name typo — `ADMIN_USER`/`ADMIN_PASS` only seed an initial admin row when the `users` table is empty, while every API route separately requires a session (`401 login required`), so its precise truth needs its own verification pass outside this ticket.
  - Did not add a claim that `SYSTEM_MAP.md`'s storage-model sections are stale (the source drift table asserts this), because that specific claim was not independently re-verified here and `SYSTEM_MAP.md` was not in this ticket's owned-files scope.
  - `ARCHITECTURE.md` does **not** repeat the workflow doc's now-resolved "server does not boot" warning about `os-backend/` being deleted at `094dde1`: verified with `node -e "require('./server.js')"` that `os-backend/src/mapping/*` is present and loads cleanly on this branch (restored by commit `1c10d84`), so that historical claim no longer holds and was not carried into a fresh document.
  - `ARCHITECTURE.md` does note `db/migrations/` is still absent (`ls db/migrations` → no such directory; `tools/apply-migration.js`'s header still references a path under it) since that part of the drift is still true on this tree.
- **Known risks:** None to runtime behavior — Markdown-only change. Residual risk is documentation drifting again if `CHANGELOG.md`/`start_server.command` move in a future commit.
- **Blockers:** None.
- **Dependencies:** None.
- **Follow-up work:**
  - `SYSTEM_MAP.md` §0/§6's storage-model claims are flagged as possibly stale by `allotment_v2/docs/workflows/07-data-persistence-api.md` §10 but were not verified/touched here.
  - README.md's `npm start` / "open to anyone" claims are in the same drift table and may warrant their own ticket.
  - `db/migrations/` is still absent while `tools/apply-migration.js`'s header still references a path under it — noted in `ARCHITECTURE.md`'s "Known drift" section but out of scope to fix here.
- **Rollback procedure:** Revert the single commit on this branch (or `git checkout <prev-commit> -- CLAUDE.md README.md && rm ARCHITECTURE.md`) — everything is Markdown-only with no code, schema, or data effect, so rollback is a plain file revert with no migration or data cleanup.

## Agent handoff

- **Branch:** `agent/LAM-23-architecture-docs`
- **Commit:** `14822b150f3da80a9837624044e5a858a230e410`
- **Worktree:** `D:/projects/wt-sprint1/LAM-23-architecture-docs`
- **Jira:** LAM-23
- **PR:** [#6](https://github.com/digitalmkt-bbot/LOVE_Andaman_Workspace/pull/6) (open, base `refactor/booking-v2-migration` ← head `agent/LAM-23-architecture-docs`)
- **Manifest:** `.agent-reports/LAM-23.json`
- **Unrelated changes left untouched:** `os-backend/`, `database_migration/`, `db/`, `SYSTEM_MAP.md`, `BACKLOG.md`, `HANDOFF_2026-07-04.md`, and every other file in the worktree — none were modified; only the 5 owned paths above were touched.
