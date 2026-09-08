# LAM-21: S1-07 Spike - catalogue every unpersisted write

## Input contract

- **Requested outcome:** Produce a ranked catalogue (mutation site / store / persisted? /
  lost on reload?) of every place in `allotment_v2.html` that mutates a data store but never
  reaches a persistence call, going beyond the four documented instances named in the ticket
  (`aosSaveModal`/`SB_ADDON_SVCS`, `ctRenewActivate`, `flSaveAssignment`/`flCancelAssignment`/
  `flAutoUpdateAssignments`, `fuelSetBudget`).
- **Acceptance criteria:**
  - Deliverable is a document only; `allotment_v2/allotment_v2.html` and every other source
    file are read-only for this task.
  - All four named sites are verified directly against source and included.
  - At least one additional unpersisted-write instance beyond the four named sites is found
    via systematic search and verified.
  - Output is a ranked table (mutation site / store / persisted? / lost on reload?) ordered
    by blast radius.
  - Every claim in the catalogue is backed by a specific line reference read from the actual
    function body, not inferred from ticket text alone.
- **Allowed scope:** `docs/development/unpersisted-writes.md`,
  `docs/development/tasks/LAM-21.md`, `.agent-reports/LAM-21.json` only.
- **Constraints/invariants:** Must not modify `allotment_v2/allotment_v2.html` or any other
  source file (read-only spike); must not touch files owned by other in-flight tasks; must
  not change persistence/schema/SQL/API behavior; stage only the three owned paths
  explicitly, never `git add -A`/`git add .`.
- **Base branch:** `refactor/booking-v2-migration`
- **Starting assumptions:** No Postgres instance or prod service is reachable from this
  sandbox, so DB-round-trip claims are verified statically via `field_mapping.json` /
  `operation_schemas_model.json` / `server.js` logic, not by a live reproduction. Line
  numbers cited will drift as the file is edited elsewhere; the catalogue itself says to
  grep the function name instead of trusting line numbers.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| Unpersisted-write knowledge | The four sites named in the Jira description were known only from two workflow-doc sections; no ranked, verified catalogue existed | `docs/development/unpersisted-writes.md` exists: a 7-row table ranked by blast radius, each row verified against the current function body, plus a "how persistence actually works" primer and a documented method section |

### Interfaces and contracts

- **Added:** None (documentation only).
- **Changed:** None.
- **Removed:** None.
- **Compatibility notes:** N/A — no code or schema touched.

### Files changed

```text
docs/development/unpersisted-writes.md   (added)
docs/development/tasks/LAM-21.md         (added)
.agent-reports/LAM-21.json               (added)
```

### Data and persistence impact

- **Database/schema:** None — read-only investigation.
- **API or mapper:** None — `os-backend/src/mapping/field_mapping.json` and
  `operation_schemas_model.json` were read to verify the `fleet_fuelbudget` finding, not
  modified.
- **Migration required:** No.
- **Rollback effect on data:** None — no data or code path was changed.

## Verification evidence

| Command/check | Result |
|---|---|
| `git status --short --branch` (before any change) | Passed — worktree clean at `fa60a96` |
| `git status --short --branch` / `git diff --stat` (after writing artifacts) | Passed — only the three new files appear untracked; no tracked file (including `allotment_v2/allotment_v2.html`) shows a diff |
| Direct read of all six named functions (`aosSaveModal:79018`, `aosDeleteService:78928`, `ctRenewActivate:65317`, `flSaveAssignment:35420`, `flCancelAssignment:35481`, `flAutoUpdateAssignments:35505`, `fuelSetBudget:29873`) in `allotment_v2.html` | Passed — each function body read in full; presence/absence and conditionality of any `localStorage.setItem`/`*Persist()` call confirmed line-by-line |
| `grep -in "never persist\|not persist\|RAM only\|in-memory only\|lost on reload\|stays in RAM\|silently"` across all 8 `allotment_v2/docs/workflows/*.md` | Passed — surfaced 3 additional candidate rows, each independently re-verified against current source before inclusion |
| `grep -in "fuelbudget"` in `os-backend/src/mapping/field_mapping.json` and `operation_schemas_model.json` | Passed — zero matches in both, confirmed against the registered sibling key `fleet_fuelprice` (`field_mapping.json:6228`) |
| `node --check` on any extracted `<script>` or on `server.js` | Not run — no JavaScript was modified by this task; CLAUDE.md requires this only for JS edits, and none were made |
| Live reproduction of the `fleet_fuelbudget` round-trip loss against Postgres/prod | Blocked — no Postgres and no network-reachable prod service in this sandbox; verified statically instead via `server.js`'s own `§mapDrift` comment (`server.js:46-71`), which describes exactly this failure mode |
| `node change-report.mjs --validate .agent-reports/LAM-21.json --report docs/development/tasks/LAM-21.md` | Passed — see the exact console output captured in the structured result for this task run |

## Decisions, risks, and rollback

- **Decisions:**
  - Classified the ~170 raw `localStorage.setItem` call sites found by a blind grep as
    mostly *not* bugs — this codebase's real persistence pattern is direct
    read-modify-write of the `LS_KEY` blob (confirmed via the `Storage.prototype.setItem`
    override at `allotment_v2.html:64-82`, which auto-syncs any write to that key to
    `/api/save`), not a mandatory single `save()` call. Only mutation sites that never (or
    only conditionally) reach that write were catalogued.
  - Corrected two of the ticket's four named sites after reading the code:
    `flSaveAssignment`/`flCancelAssignment`/`flAutoUpdateAssignments` and `fuelSetBudget` DO
    call `localStorage.setItem(LS_KEY, …)` directly. The verified, real defects are a
    missing `laCanEditArea('fleet')` permission guard on all four, an `if(ls.boats)`
    conditional on the first three, and — new finding — `fuelSetBudget`'s
    `fleet_fuelbudget` key having zero entry in the relational-backend field mapping.
  - Used the existing `docs/workflows/*.md` corpus as a search accelerator (grep for prior
    "not persisted" language) rather than manually scanning all ~600 top-level functions in
    the 83k-line file, given the spike's effort budget. Every candidate surfaced this way
    was independently re-verified against current source, not copied from the docs as-is.
- **Known risks:**
  - Row 4 (`fleet_fuelbudget`) is verified statically only — no live Postgres to reproduce
    the round-trip loss end-to-end.
  - Line numbers throughout the catalogue will drift; the document itself says to grep the
    function name instead.
  - Not exhaustive — covers the four named sites plus everything the doc-grep sweep plus
    direct reading of adjacent code surfaced; a full line-by-line audit of all ~600
    top-level functions was out of scope for a spike-level effort budget.
- **Blockers:** None.
- **Dependencies:** None.
- **Follow-up work:** See `docs/development/unpersisted-writes.md` §4 for the fix list (add
  `sbAgentsPersist()` to `ctRenewActivate`; load/persist `SB_ADDON_SVCS`; add the missing
  `laCanEditArea('fleet')` guard to the four fleet functions; register `fleet_fuelbudget`
  server-side; align the accounting/booking edit-area guards; persist the OCR failure
  branch). Also worth considering: a lint rule flagging any top-level function that mutates
  a global `SB_*`/`FL_*` array without a same-function persist call.
- **Rollback procedure:** Revert this commit, or delete
  `docs/development/unpersisted-writes.md`, `docs/development/tasks/LAM-21.md`, and
  `.agent-reports/LAM-21.json` — documentation-only change, zero effect on application
  behavior or data.

## Agent handoff

- **Task:** LAM-21
- **Branch:** `agent/LAM-21-unpersisted-write-catalogue`
- **Worktree:** `D:/projects/wt-sprint1/LAM-21-unpersisted-write-catalogue`
- **HEAD at scaffold:** `fa60a96e2d86c7776e04a0cf726f7ed8eb60a7c6`
- **Merge base:** `fa60a96e2d86c7776e04a0cf726f7ed8eb60a7c6`
- **PR:** [#7](https://github.com/digitalmkt-bbot/LOVE_Andaman_Workspace/pull/7) — `agent/LAM-21-unpersisted-write-catalogue` → `refactor/booking-v2-migration`, state OPEN
- **Unrelated changes left untouched:** None observed in the worktree at any point during
  this task.
