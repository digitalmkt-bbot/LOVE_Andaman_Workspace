# LAM-30: Spike — trips per-boat hardcoded columns, normalize vs generate-from-BOATS

## Input contract

- **Requested outcome:** A spike document (no code/SQL/migration changes) at
  `docs/development/trips-per-boat-columns.md` covering: the real, verified current `bN_*` column scheme on
  `trips`; confirmation/correction of the ticket's b8/b14/b15 claim against `server.js:1637-1644` and
  `os-backend/src/mapping/operation_schemas_model.json`; an honest comparison of normalize-to-child-table vs
  generate-columns-from-BOATS, including cost to the existing `os_repo` `assembleBlob`/`decomposeBlob` path;
  a recommendation with reasoning; and a prose migration plan preserving existing `bN_*` data while making
  future boat additions require zero schema edits.
- **Acceptance criteria:** the spike document exists and covers all of the above; LAM-73 (still To Do) is
  recorded as a dependency governing the fate of `db/migrations`; the task is read-only on all code — no SQL,
  no `server.js` edit, no mapping-file edit, no migration file created; only the three owned files are
  staged/committed.
- **Allowed scope:** `docs/development/trips-per-boat-columns.md`, `docs/development/tasks/LAM-30.md`,
  `.agent-reports/LAM-30.json`.
- **Constraints/invariants:** SPIKE ONLY — no SQL, no `server.js` edit, no mapping-file edit, no migration
  file; read-only on all code; stage only the three owned files with `git add -- <path>`, never `git add .`.
- **Base branch:** `refactor/booking-v2-migration`.
- **Starting assumptions:** worktree was clean at start (`git status --short --branch` showed no
  pre-existing uncommitted changes); `os-backend/` (deleted at `094dde1`, restored at `1c10d84`) is present in
  this worktree since `1c10d84` is an ancestor of `HEAD` — confirmed via
  `git merge-base --is-ancestor 1c10d84 HEAD`.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| Application runtime behavior | Unchanged | Unchanged — this is a documentation-only spike; no code, SQL, or schema was touched |
| Team knowledge / decision record | The `trips` per-boat column fragility was known informally (`server.js` comment, `BACKLOG.md`, `07-data-persistence-api.md` §10.12) but with no verified current column list and no formal option comparison | `docs/development/trips-per-boat-columns.md` gives a verified column-by-column state, a concrete recommendation (normalize, following the already-shipped `fleet_daily__boat` precedent), and a mechanism-agnostic migration plan ready for whoever picks up the implementation once LAM-73 lands |

### Interfaces and contracts

- **Added:** None.
- **Changed:** None.
- **Removed:** None.
- **Compatibility notes:** N/A — no interface, schema, or code changed.

### Files changed

```text
added	.agent-reports/LAM-30.json
added	docs/development/tasks/LAM-30.md
added	docs/development/trips-per-boat-columns.md
```

### Data and persistence impact

- **Database/schema:** None. No SQL was written or run.
- **API or mapper:** None. `os-backend/src/mapping/*` was read and analyzed but not modified.
- **Migration required:** No — for this change itself. The spike *documents* a future migration plan in
  prose (§4 of the spike doc); implementing it is explicitly out of scope for this task.
- **Rollback effect on data:** None — no data exists to roll back.

## Verification evidence

| Command/check | Result |
|---|---|
| `git status --short --branch` (task start) | Passed — clean worktree, no pre-existing changes |
| `sed -n '1637,1644p' server.js` | Passed — confirmed the exact `b8`/`b14`/`b15` ALTER loop matching the ticket |
| `node -e` enumeration of `os-backend/src/mapping/operation_schemas_model.json`'s `trips.columns` grouped by boat | Passed — all 15 boats have `route`/`type`/`booked`; `charterbookingid` exists for only 5 of 15 (`b6,b8,b13,b14,b15`) |
| `grep -na 'charterbookingid' server.js` | Passed — single match at line 1641, confirming `b6`/`b13`'s `charterbookingid` columns came from an untracked one-off DDL, not the visible migration path |
| Diff of `os-backend/.../operation_schemas_model.json` vs `database_migration/operation_schemas_model.json` (`trips` entry) | Passed — DIFFERENT; the `database_migration` copy is stale and still lacks b8/b14/b15 entirely |
| `grep` for `TRIPS[...][...].field` patterns + `DEFAULT_BOATS` id/name pairs in `allotment_v2.html` | Passed — confirmed `TRIPS[date][boatId] = {route,type,booked,charterBookingId}` shape and `b8=Tadeo, b14=Juliet, b15=Rolanda` |
| `grep` for `BOATS.push`/`saveCharterBoat`/`fmBoatSave`/`LA_UID` in `allotment_v2.html` | Passed — confirmed runtime-added boats get non-sequential ids (`'b'+Date.now()`, `LA_UID('b')`), raising the real cost of a generate-columns-from-BOATS approach |
| Full read of `os-backend/src/mapping/os_repo.js` (329 lines) | Passed — confirmed the generic mapping engine's 4 shapes don't cover `trips[date].bN`, and located the exact prior fix for the identical `fleet_daily[day][boatId]` bug (`fleetDailyAssembleFix`/`fleetDailyDecompose`, `os_repo.js:119-161`) used as this report's precedent |
| `grep -n 'trips' BACKLOG.md` + read `⏸ trips mapping` section | Passed — confirmed BACKLOG.md already proposes child-table/`map_value_json` and cites `vanjob_driver`/`boat_capovr` as the correct existing pattern |
| Read `allotment_v2/docs/workflows/07-data-persistence-api.md` §0 and §10 item 12 | Passed — independently confirms the same gap and the `os-backend` deletion/restore history; `git merge-base --is-ancestor 1c10d84 HEAD` confirmed the restore is present in this worktree |
| `node -e "require('./server.js')"` | Blocked — hung and was killed by the tool's 2-minute timeout (server.js attempts to connect to Postgres/listen at require time); no Postgres/prod network reachable in this sandbox per task constraints. No orphaned process remained afterward. Module resolution was instead confirmed statically (git ancestry + individually `require()`-ing each mapping file, which loaded fine standalone) |
| `node .../change-report.mjs --validate .agent-reports/LAM-30.json --report docs/development/tasks/LAM-30.md` | Passed — `valid: LAM-30`, run once before the implementation commit and again after recording PR #18 metadata |

## Decisions, risks, and rollback

- **Decisions:** Recommended Option A (normalize to a child table, e.g. `trips__byboat`, keyed by boatId with
  the per-boat object stored as one JSON value) over Option B (automate/generate `bN_*` columns from the
  `BOATS` registry) — see §3.1 of the spike doc for full reasoning. Treated the ticket's b8/b14/b15 claim as
  accurate but incomplete: reported the still-live `charterbookingid` gap (11 of 15 boats) as the more urgent,
  previously-undocumented finding.
- **Known risks:** The two checked-in schema-snapshot files (`os-backend/.../operation_schemas_model.json`
  and `database_migration/operation_schemas_model.json`) already disagree with each other and may have
  drifted further from the live DB since this spike — the report tells the implementer to re-verify against
  production before writing any real migration. No claim about mapper runtime behavior was verified by
  actually executing `assembleBlob`/`decomposeBlob` (no DB/network reachable in this sandbox); all such claims
  rest on static reading of `os_repo.js` cross-checked against its own shipped `fleet_daily__boat` fix.
- **Blockers:** None — the spike completed within its stated scope.
- **Dependencies:** LAM-73 (status: To Do) — decides the fate of `db/migrations/` and therefore the
  mechanism through which the migration plan in §4 of the spike doc would actually be applied. The plan is
  written mechanism-agnostically so it can slot into whatever LAM-73 lands on.
- **Follow-up work:** (1) Implement the Option A migration once LAM-73 settles the mechanism. (2) Consider a
  small interim fix adding `charterbookingid` for the remaining 10 boats that currently lack it — independent
  of the long-term design choice, since it's a live silent-data-loss bug today. (3) Reconcile/regenerate
  `database_migration/operation_schemas_model.json` against the live DB so the two snapshot files stop
  disagreeing.
- **Rollback procedure:** `git revert` the merge commit, or simply don't merge the PR — three new
  documentation files, nothing else to unwind.

## Agent handoff

- **Task:** LAM-30
- **Branch:** `agent/LAM-30-trips-columns-spike`
- **Worktree:** `D:/projects/wt-sprint2b/LAM-30-trips-columns-spike`
- **HEAD at scaffold:** `e7d28f0487b2b51c621a89b21689bc649f7f980a`
- **Merge base:** `fa60a96e2d86c7776e04a0cf726f7ed8eb60a7c6`
- **PR:** [#18](https://github.com/digitalmkt-bbot/LOVE_Andaman_Workspace/pull/18) — open, base `refactor/booking-v2-migration`, head `agent/LAM-30-trips-columns-spike`
- **Unrelated changes left untouched:** all other files in the worktree — verified via `git status --short`
  and `git diff --name-status` showing only the three owned files
