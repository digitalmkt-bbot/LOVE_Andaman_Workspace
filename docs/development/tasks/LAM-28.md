# LAM-28: Make the four-registration trap loud

## Input contract

- **Requested outcome:** A new persisted field needs the persist helper, both client load
  paths, `field_mapping.json`, and `operation_schemas_model.json`, plus a real column. Miss
  any one and the data silently disappears. Build a drift check that fails CI when a model
  field has no mapping entry or a mapping entry has no column — restoring the capability of
  the deleted `check_mapping_drift.js` — plus an npm script scaffolding all registrations, and
  commit the `ops.pierNote` worked example into the repo. Source:
  `allotment_v2/docs/workflows/07-data-persistence-api.md` §4 and §10 invariant 5.
- **Acceptance criteria:**
  - A CI-runnable drift check compares `os-backend/src/mapping/field_mapping.json` against
    `os-backend/src/mapping/operation_schemas_model.json` and fails when a model column has no
    mapping entry, or a mapping entry has no matching column.
  - The check restores the *capability* of the deleted
    `os-backend/scripts/check_mapping_drift.js` (removed at `094dde1`) — catching mapping/model
    drift mechanically — without requiring the live blob or `os_repo.js` the old script needed.
  - An npm script scaffolds (prints) all four registrations for a given field, so a developer
    adding a persisted field has a checklist + copy-paste snippets instead of re-deriving §4
    from memory.
  - The `ops.pierNote` worked example (already-live, two-table `json_text` field) is committed
    as documentation of what "all four registrations, done correctly" looks like.
  - Both mapping JSON files are read-only inputs to the check; the check must not modify them,
    and neither may this task's own edits.
  - A GitHub Actions workflow wires the check into PRs, alongside (not replacing or modifying)
    the existing `.github/workflows/ci-boot-smoke.yml` (LAM-16).
- **Allowed scope:** `tools/check-mapping-drift.mjs`, `tools/scaffold-registration.mjs`,
  `docs/development/four-registration-trap.md`, `package.json`,
  `.github/workflows/mapping-drift.yml`, `docs/development/tasks/LAM-28.md`,
  `.agent-reports/LAM-28.json`. Exclusive owner of root `package.json` and
  `.github/workflows/mapping-drift.yml` this run.
- **Constraints/invariants:**
  - `os-backend/src/mapping/field_mapping.json` and `operation_schemas_model.json` are live
    persistence mappings — read and compare only, never modify.
  - Do not edit `allotment_v2/allotment_v2.html`, `server.js`, or any SQL.
  - Do not touch `.github/workflows/ci-boot-smoke.yml` (LAM-16, already on base) — add a
    sibling workflow file instead.
  - Report the *real* drift count found against the current repo; do not tune the check to
    force a particular answer.
  - Stage only the owned paths, explicitly, never `git add -A`/`git add .`.
- **Base branch:** `refactor/booking-v2-migration`
- **Starting assumptions:** The worktree was clean at start
  (`git status --short --branch` showed a clean tree on
  `agent/LAM-28-mapping-drift-check...origin/refactor/booking-v2-migration`, HEAD `e7d28f0`).
  `docs/workflows/07` in the Jira text refers to
  `allotment_v2/docs/workflows/07-data-persistence-api.md` (verified — no `docs/workflows/07*`
  exists at repo root, only under `allotment_v2/`).

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| Mapping-file drift detection | Nothing catches a `field_mapping.json`/`operation_schemas_model.json` mismatch until a real save fails or a value silently vanishes; the old blob-round-trip checker that could have caught related drift was deleted at `094dde1` | `npm run check:mapping-drift` (and the `mapping-drift.yml` CI job) statically diffs the two files on every PR and fails with a specific list of `table.column` drift points if they disagree |
| Registering a new persisted field | Developer re-derives the five-step checklist (client field, persist, both loads, mapper, model, column) from the workflow doc each time, by hand | `npm run scaffold:registration -- --client-path ... --column ... --tables ...` prints the full checklist pre-filled with copy-paste JSON/DDL snippets for the given field |
| Documentation of a correct four-registration field | The `ops.pierNote` example lived only inside `allotment_v2/docs/workflows/07-data-persistence-api.md` §4.1 | Same example is cross-referenced and elaborated in `docs/development/four-registration-trap.md`, with the exact scaffold-tool invocation that reproduces its checklist |

### Interfaces and contracts

- **Added:**
  - `tools/check-mapping-drift.mjs` — CLI, `node tools/check-mapping-drift.mjs [--mapping <path>] [--model <path>]`, exit 0 (no drift) / 1 (drift or read/parse failure).
  - `tools/scaffold-registration.mjs` — CLI, `node tools/scaffold-registration.mjs [--client-path ...] [--column ...] [--kind ...] [--db-type ...] [--tables a,b] [--persist-helper ...] [--load-fn ...]`, prints only, exit 0 always, makes no file edits.
  - `npm run check:mapping-drift` / `npm run scaffold:registration` — new package.json script entries wrapping the two tools above.
  - `.github/workflows/mapping-drift.yml` — new CI workflow, runs `npm run check:mapping-drift` on PRs into `refactor/booking-v2-migration`/`main` and on push to `refactor/booking-v2-migration`.
- **Changed:** None (existing scripts, workflows, and both mapping JSON files are untouched).
- **Removed:** None.
- **Compatibility notes:** Both new tools use only Node core modules (`node:fs`, `node:path`, `node:url`) — no new dependency, no `npm ci`/network requirement to run them, which is why the new CI job needs no `npm ci` step. `check-mapping-drift.mjs` defaults its two file paths to the real `os-backend/src/mapping/*.json` locations but accepts `--mapping`/`--model` overrides, which is how this task verified the failure path against scratch copies without touching the real files.

### Files changed

```text
modified	package.json
added	.github/workflows/mapping-drift.yml
added	docs/development/four-registration-trap.md
added	docs/development/tasks/LAM-28.md
added	.agent-reports/LAM-28.json
added	tools/check-mapping-drift.mjs
added	tools/scaffold-registration.mjs
```

### Data and persistence impact

- **Database/schema:** None. No SQL, no `server.js`, no `allotment_v2.html` touched.
- **API or mapper:** None. `os-backend/src/mapping/field_mapping.json` and
  `operation_schemas_model.json` are read-only inputs to the new check; neither file was
  modified (verified: `git status --short os-backend/` is empty throughout).
- **Migration required:** No.
- **Rollback effect on data:** None — this change adds only tooling, docs, and a CI workflow;
  it has no runtime code path in the app and touches no persisted data or schema.

## Verification evidence

| Command/check | Result |
|---|---|
| `git status --short --branch` (start) | Passed — clean tree on `agent/LAM-28-mapping-drift-check...origin/refactor/booking-v2-migration`, HEAD `e7d28f0` |
| `node --check tools/check-mapping-drift.mjs` | Passed — no syntax errors |
| `node --check tools/scaffold-registration.mjs` | Passed — no syntax errors |
| `node tools/check-mapping-drift.mjs` (real files, no overrides) | Passed — exit 0, output: "OK — no drift. 130 tables compared, every model column has a mapping entry and every mapping entry has a column." (real, unmodified drift count against the current repo is **0** — both mapping files are already in lockstep; see `docs/development/four-registration-trap.md` for why) |
| `npm run check:mapping-drift` | Passed — same result as above via the new npm script |
| Failure-path test: injected one bogus model column and one bogus mapping entry into scratch copies of both JSON files (outside the repo, in the session scratchpad) and ran `node tools/check-mapping-drift.mjs --mapping <scratch>/fm_drift.json --model <scratch>/om_drift.json` | Passed — exit 1, correctly reported `routes.zz_test_bogus_col` (model field, no mapping entry) and `routes.zz_test_bogus_field` (mapping entry, no column); scratch files deleted afterward, real `os-backend/` files confirmed untouched (`git status --short os-backend/` empty) |
| `node tools/scaffold-registration.mjs --client-path "ops.pierNote" --column ops_piernote --kind json_text --db-type text --tables sb_bookings,sb_bookings__trips --persist-helper sbBookingsPersist --load-fn "window._laReloadData"` | Passed — printed the full 8-step checklist with correct per-table `field_mapping.json`/`operation_schemas_model.json`/`ALTER TABLE` snippets matching the real, already-live `ops_piernote` entries |
| `node tools/scaffold-registration.mjs` (no args, defaults) | Passed — printed a runnable template with no errors |
| Cross-check worked example against live source: `grep -na "ops_piernote" os-backend/src/mapping/field_mapping.json` / `operation_schemas_model.json` / `server.js` | Passed — confirmed `ops_piernote` (kind `json_text`, `db_type text`) exists on both `sb_bookings` and `sb_bookings__trips` in both mapping files, and `server.js:1628` has the matching `ALTER TABLE ... ADD COLUMN IF NOT EXISTS "ops_piernote" text` |
| `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"` | Passed — valid JSON after edit |
| YAML syntax check on `.github/workflows/mapping-drift.yml` | Blocked — no `yamllint`/`actionlint`/Python+PyYAML available in this sandbox and no network to install one; verified manually instead: no tabs (`grep -P '\t'` empty), consistent 2-space indentation, and structure mirrors the known-good sibling `.github/workflows/ci-boot-smoke.yml` (same `on`/`concurrency`/`jobs` shape) |
| `git status --short os-backend/` (after every mapping-file touch) | Passed — empty every time; the two live mapping JSON files were never modified |
| Final `git status --short --branch` / `git diff --stat origin/refactor/booking-v2-migration` | Passed — staged/changed set matches exactly the seven owned paths, no other files touched |
| `npm ci` / full CI run of `.github/workflows/mapping-drift.yml` on GitHub Actions | Not run — no network/CI runner available in this sandbox; the workflow was validated by running its single step (`npm run check:mapping-drift`) locally instead, which passed |

## Decisions, risks, and rollback

- **Decisions:**
  - The check compares `field_mapping.json` and `operation_schemas_model.json` directly
    against each other (table-by-table, field-name-by-column-name) rather than reimplementing
    the deleted script's live-blob decompose/assemble round-trip — that round-trip needs
    `os_repo.js` and a real sample blob (neither of which is safe or possible to fabricate
    here), whereas the two JSON files are self-contained, static, and exactly what §10
    invariant 5 calls out as two of the four registrations. This is a narrower, CI-friendly
    check that restores the *capability* (catching the two mechanically-checkable
    registrations), not a byte-for-byte revival of the old script.
  - `scaffold-registration.mjs` deliberately never writes to `field_mapping.json` or
    `operation_schemas_model.json` — it only prints. The task explicitly forbids editing those
    files, and a script that auto-mutates a live persistence mapping is exactly the kind of
    over-eager automation CLAUDE.md §4 warns against.
  - Ran the drift check against the real, current repo before writing anything else, per the
    task's instruction not to tune the check until it reports zero. It reported 0 drift
    immediately and honestly — documented as a genuine (if unexciting) finding in
    `four-registration-trap.md`, not adjusted or hidden.
  - New CI workflow is a sibling file (`mapping-drift.yml`), not an edit to the existing
    `ci-boot-smoke.yml`, per the task's explicit instruction to leave that file alone.
- **Known risks:**
  - The drift check cannot see the other three registrations (persist helper, both client load
    paths) — those are structural JavaScript inside `allotment_v2.html`, not tabular data, and
    checking them mechanically would need either a JS AST pass or a live boot (which
    `ci-boot-smoke.yml` already does for the DB-column side). This is called out explicitly in
    the new doc so nobody mistakes "mapping-drift CI is green" for "all four registrations are
    correct."
  - `mapping-drift.yml`'s actual GitHub Actions execution was not verified end-to-end (no CI
    runner/network in this sandbox) — only its single `npm run check:mapping-drift` step was
    verified locally, and its YAML structure was checked by hand against the known-good sibling
    file rather than a linter.
- **Blockers:** None — task completed within stated constraints.
- **Dependencies:** None on other in-flight tasks. Builds on (does not modify)
  `.github/workflows/ci-boot-smoke.yml` from LAM-16, already merged onto this base at `e7d28f0`.
- **Follow-up work:**
  - Consider whether branch protection on `refactor/booking-v2-migration` should mark
    `mapping-drift` as a required check (this task only adds the workflow; making it required
    is a repo-settings change, same caveat as `ci-boot-smoke.yml`'s own header comment).
  - A future task could extend `check-mapping-drift.mjs` (or a sibling tool) to also assert
    `db_type`/column-`type` agreement is enforced continuously — it already is today (verified
    0 mismatches), but nothing currently fails CI if that drifts later, since this task's scope
    was limited to "field has no mapping entry" / "mapping entry has no column".
- **Rollback procedure:** Revert this task's commit on
  `agent/LAM-28-mapping-drift-check` (or drop the four added files and the `package.json`
  script additions). No data, schema, or runtime app code is affected — rollback is purely
  removing tooling/docs/CI, safe at any time.

## Agent handoff

- **Task:** LAM-28
- **Branch:** `agent/LAM-28-mapping-drift-check`
- **Worktree:** `D:/projects/wt-sprint2b/LAM-28-mapping-drift-check`
- **HEAD at scaffold:** `e7d28f0487b2b51c621a89b21689bc649f7f980a`
- **Merge base:** `e7d28f0487b2b51c621a89b21689bc649f7f980a`
- **PR:** Not yet created at commit time; filled in below after push (see PR metadata step)
- **Unrelated changes left untouched:** All files outside the owned list, including
  `os-backend/src/mapping/field_mapping.json`, `os-backend/src/mapping/operation_schemas_model.json`,
  `.github/workflows/ci-boot-smoke.yml`, `.github/workflows/tests.yml`,
  `allotment_v2/allotment_v2.html`, and `server.js`.
