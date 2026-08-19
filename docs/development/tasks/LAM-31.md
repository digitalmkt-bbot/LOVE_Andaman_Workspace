# LAM-31: Disambiguate the two save() functions

## Input contract

- **Requested outcome:** Rename the two identically-named `save()` functions in `allotment_v2/allotment_v2.html` to intent-revealing names, update every call site file-wide (a pure rename — behavior unchanged), document why `flSave()` also persists `BOATS`, and describe (as a follow-up, since `test/**` is not owned by this task) the test that proves a fleet-side boat status change survives a reload.
- **Acceptance criteria:**
  - The closure-private cloud-sync `save(v, forceLegacy)` inside the boot IIFE (source: `docs/workflows/07-data-persistence-api.md` §1.3, "The two `save()` functions — a real trap") and the global persist helper `save(area)` that writes `routes`/`boats`/`trips` (source: `docs/workflows/05-fleet-management.md` §10.1 item 1, for context) are each renamed to an intent-revealing, non-colliding name.
  - Every call site of both renamed functions is updated file-wide; zero references to the bare old name `save(` remain outside two known-unrelated locations (Canvas 2D `ctx.save()`/`c.save()`, and the self-contained popup-window script string built by `pjShotScript()`).
  - Pure rename — neither function's persisted data changes.
  - `flSave()`'s definition carries a comment explaining why it independently persists `BOATS`.
  - The reload-survival test is specified precisely enough for a future task/agent to implement it.
  - Verification includes `node --check` on the extracted `<script>` content and a grep proving zero old-name references remain.
- **Allowed scope:** `allotment_v2/allotment_v2.html`, `docs/development/tasks/LAM-31.md`, `.agent-reports/LAM-31.json`.
- **Constraints/invariants:**
  - `allotment_v2/allotment_v2.html` is explicitly pre-approved for this task; never read it whole, grep → 30–50 line window → targeted edit → re-read only the changed region.
  - Every JS change verified with `node --check` on the extracted `<script>` content.
  - Must rebase on siblings `agent/LAM-27-cancelled-status-constant` and `agent/LAM-29-revert-to-seed-stores` before editing, keeping both siblings' work.
  - `test/**` is not owned by this run — no test files added.
  - No force-push; never commit to `main` or `refactor/booking-v2-migration`; stage only the three owned paths.
- **Base branch:** `refactor/booking-v2-migration`
- **Starting assumptions:**
  - "The two `save()` functions" in the Jira title matches, verbatim, the heading of `docs/workflows/07-data-persistence-api.md` §1.3 — that section names exactly two functions: `save(v, forceLegacy)` (closure-private, inside the boot IIFE) and `save(area)` (global persist helper). This pair — not `save()`/`flSave()` — is what "rename to intent-revealing names" targets.
  - `flSave()` already has an intent-revealing, `fl`-prefixed name and is not part of the "two `save()` functions" pair the doc identifies. The Jira ticket's sentence about `flSave()` and `BOATS` is sourced separately (`docs/workflows/05-fleet-management.md` §10.1 item 1) and reads as background/rationale for the documentation sub-requirement, not an instruction to rename `flSave()`.
  - The reload-survival test is real and valuable but out of this task's owned-files scope (`test/**` not owned) — declared as a dependency/follow-up with an exact scenario instead of skipped silently.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| Cloud-sync function (boot IIFE) | `function save(v, forceLegacy)` — same bare name `save` as the unrelated global persist helper ~3,700 lines later; closure-private, shadowed by nothing. Called from the `localStorage.setItem` shim, its own retry paths, and the unsaved-work recovery path. | Renamed to `_laSyncSave(v, forceLegacy)`, matching the file's existing `_la*`-prefixed private-helper convention in the same IIFE (`_laSaveErr`, `_laBlobUsable`, `_laFlush`, `_laMark`, `_laShrinkBlocked`). Identical logic — same XHR POST to `/api/v1/_batch` or `/api/save`, same retry/backoff. |
| Global persist helper for `ROUTES`/`BOATS`/`TRIPS` | `function save(area)` — same bare name as the function above; ~44 call sites across Boat Status, Boat Operation, Route/Season admin, project-close code. | Renamed to `saveData(area)`, pairing it with its existing load-side counterpart `loadData()` (declared immediately above it). Identical logic — same `laCanEditArea(area)` gate, same read-modify-write of `d.routes`/`d.boats`/`d.trips`. |
| `flSave()` BOATS-ownership documentation | Rationale lived only in a terse Thai comment (`§flBoatPersist`) inside the function body. | Added a 9-line English comment (tagged `LAM-31`) directly above the function definition explaining the BOATS-persistence relationship between `flSave()` and `saveData()`. Original Thai comment kept in place, with its `save()` reference updated to `saveData()`. |

### Interfaces and contracts

- **Added:** `_laSyncSave(v, forceLegacy)` (renamed from `save`, IIFE-private); `saveData(area)` (renamed from `save`, global, same signature/semantics).
- **Changed:** None — call signatures and behavior are identical to the pre-rename functions.
- **Removed:** The bare global identifier `save` no longer exists as either function. No external references to `window.save` existed in the file (verified), so nothing outside `allotment_v2.html` needs updating.
- **Compatibility notes:** Pure rename. Any developer notes, scratch console snippets, or documentation elsewhere in the workspace that call `save(...)` on this page will need to switch to `saveData(...)`; the cloud-sync function was never externally callable (closure-private) so no such update is needed for it.

### Files changed

```text
added	.agent-reports/LAM-16.json                        (inherited from base branch history — not authored by LAM-31)
added	.agent-reports/LAM-17.json                        (inherited from base branch history — not authored by LAM-31)
added	.agent-reports/LAM-18.json                        (inherited from base branch history — not authored by LAM-31)
added	.agent-reports/LAM-19.json                        (inherited from base branch history — not authored by LAM-31)
added	.agent-reports/LAM-20.json                        (inherited from base branch history — not authored by LAM-31)
added	.agent-reports/LAM-21.json                        (inherited from base branch history — not authored by LAM-31)
added	.agent-reports/LAM-22.json                        (inherited from base branch history — not authored by LAM-31)
added	.agent-reports/LAM-23.json                        (inherited from base branch history — not authored by LAM-31)
added	.agent-reports/LAM-27.json                        (brought in by required sibling merge — not authored by LAM-31)
added	.agent-reports/LAM-29.json                        (brought in by required sibling merge — not authored by LAM-31)
added	.github/workflows/ci-boot-smoke.yml               (inherited from base branch history — not authored by LAM-31)
added	.github/workflows/tests.yml                       (inherited from base branch history — not authored by LAM-31)
modified	allotment_v2/allotment_v2.html                 (LAM-31: the rename — see below)
added	ARCHITECTURE.md                                    (inherited from base branch history — not authored by LAM-31)
modified	CLAUDE.md                                      (inherited from base branch history — not authored by LAM-31)
added	docs/development/tasks/LAM-16.md .. LAM-23.md      (inherited from base branch history — not authored by LAM-31)
added	docs/development/tasks/LAM-27.md                  (brought in by required sibling merge — not authored by LAM-31)
added	docs/development/tasks/LAM-29.md                  (brought in by required sibling merge — not authored by LAM-31)
added	docs/development/tasks/LAM-31.md                  (this report)
added	docs/development/unpersisted-writes.md            (inherited from base branch history — not authored by LAM-31)
modified	package.json                                    (inherited from base branch history — not authored by LAM-31)
modified	README.md                                       (inherited from base branch history — not authored by LAM-31)
added	test/e2e/booking-write-path.test.mjs               (inherited LAM-22 harness — not authored by LAM-31; test/** not owned)
added	test/fixtures/booking.mjs                          (inherited LAM-22 harness — not authored by LAM-31; test/** not owned)
added	test/helpers/db.mjs                                (inherited LAM-22 harness — not authored by LAM-31; test/** not owned)
added	test/helpers/server.mjs                            (inherited LAM-22 harness — not authored by LAM-31; test/** not owned)
added	test/README.md                                     (inherited LAM-22 harness — not authored by LAM-31; test/** not owned)
added	test/unit/booking-fixture.test.mjs                 (inherited LAM-22 harness — not authored by LAM-31; test/** not owned)
added	tools/check-excluded-states.mjs                    (brought in by required sibling merge — not authored by LAM-31)
added	tools/check-persist-gates.mjs                      (inherited from base branch history — not authored by LAM-31)
added	tools/ci-boot-smoke.mjs                            (inherited from base branch history — not authored by LAM-31)
```

**LAM-31's own change** (the only file this task's commit modifies):

```text
modified	allotment_v2/allotment_v2.html
```

### Data and persistence impact

- **Database/schema:** None.
- **API or mapper:** None. Neither renamed function's HTTP surface changed (`_laSyncSave` still targets `/api/v1/_batch` / `/api/save`).
- **Migration required:** No.
- **Rollback effect on data:** None — pure identifier rename, no persisted-blob shape change, no localStorage key change.

## Verification evidence

| Command/check | Result |
|---|---|
| Pre-rename call-site inventory: `grep -noE "\bsave\([^)]*\)" allotment_v2/allotment_v2.html`, split by the IIFE line range `[18,726]` vs. global scope | Passed. 59 total `save(` occurrences: 7 inside the boot IIFE (1 def + 5 real calls + 1 comment), 52 outside it (1 def + 43 real calls + 2 comment mentions + 3 unrelated Canvas `ctx.save()`/`c.save()` + 2 unrelated `pjShotScript` string occurrences). |
| `node --check` on each of the 8 non-`src` inline `<script>` blocks (extracted with a small Node script that walks `<script>...</script>` pairs via `indexOf`, correctly skipping the escaped `<\/script>` sequences used inside string-built HTML) | Passed. All 8 blocks (lines 5–727, 3737–3755, 4166–4192, 5555–13347, 13770–36213, 36249–38114, 39142–39184, 39203–83696) passed with no output. |
| Post-rename sweep: `grep -noE "[A-Za-z_$.]*save\(" allotment_v2/allotment_v2.html \| awk -F: '$1>726'` | Passed. Only the 3 Canvas `ctx.save(`/`c.save(` calls and the 2 `pjShotScript` string occurrences remain — both confirmed unrelated (see Decisions). Zero unaccounted-for matches. |
| `grep -n "typeof save\b" allotment_v2/allotment_v2.html` (post-rename) | Passed. No matches — a follow-up pass fixed 6 `typeof save==='function'` guards the initial `save(`-syntax sweep missed (no `(` immediately follows the bare identifier in a `typeof` check). |
| `grep -n "^function save(\|  function save(" allotment_v2/allotment_v2.html` (post-rename) | Passed. No matches — no leftover top-level `function save(` definition outside the excluded `pjShotScript` string. |
| `git diff --stat` / `git diff --name-status` on `allotment_v2/allotment_v2.html`, full diff read by hand | Passed. 1 file changed, 63 insertions(+), 54 deletions(-). Every hunk is an identifier rename or a matching comment update, plus the new `flSave()` documentation comment. No logic changes. |
| Reload-survival test for a fleet-side boat status change (`flSave()` → `d.boats=BOATS` → localStorage → reload → status persists) | Blocked. `test/**` is not in this task's owned-files list, so no test file was added. Exact scenario specified under Follow-up work below. |
| `npm test` / existing automated suite | Not run — no test files were touched and `test/**` is outside this task's scope, so there was no in-scope reason to invoke it. |

## Decisions, risks, and rollback

- **Decisions:**
  - Interpreted "the two `save()` functions" as the pair `docs/workflows/07-data-persistence-api.md` §1.3 names verbatim: the closure-private cloud-sync `save(v, forceLegacy)` and the global persist helper `save(area)` — not `save()`/`flSave()`. `flSave()` already has an intent-revealing, non-colliding name; the Jira text about it is background sourced from a different doc section (`05-fleet-management.md` §10.1), informing the documentation sub-requirement rather than a rename target.
  - Named the cloud-sync function `_laSyncSave` to match the file's existing underscore+`la`-prefixed convention for closure-private helpers in that same IIFE (`_laSaveErr`, `_laBlobUsable`, `_laFlush`, `_laMark`, `_laShrinkBlocked`).
  - Named the global persist helper `saveData` to pair it with its existing load-side counterpart `loadData()`, declared immediately above it — the lowest-risk, most direct intent-revealing name available.
  - Kept `flSave()`'s existing Thai `§flBoatPersist` in-body comment (updating only its `save()`→`saveData()` reference) and added a new, fuller English comment directly above the function definition, satisfying "document, in a comment at flSave()'s new definition, why it owns BOATS" by treating "new definition" as "the definition site as it stands after this task's changes."
  - Ran an initial rename pass on the literal `save(` call syntax, then a mandatory follow-up pass after discovering it silently missed 6 `typeof save==='function'` guards (no parens immediately after the bare identifier) — both passes are reflected in the final diff and verification evidence.
- **Known risks:**
  - This is a large, file-wide mechanical rename (48 real call sites + 2 definitions + comments) across a ~4MB single-file app with no automated test suite reachable in this sandbox (no Postgres, no prod service reachable). `node --check` on every extracted `<script>` block is strong evidence the JS still parses, but cannot prove runtime behavior is unchanged the way a browser smoke test or the declared reload test would.
  - `saveData()` and `flSave()` both write `d.boats=BOATS` by design (pre-existing, unchanged by this task). A future edit to either could silently reintroduce ambiguity about BOATS ownership if the new comment at `flSave()` is not kept in sync.
- **Blockers:** None.
- **Dependencies:** The reload-survival test could not be added because `test/**` is outside this task's owned-files list. Depends on a task/agent that owns `test/**`.
- **Follow-up work:**
  - Add an automated test (e.g. under `test/e2e/` or `test/unit/`, following the existing LAM-22 harness pattern — `test/helpers/server.mjs`, `test/fixtures/booking.mjs`) that: (1) loads the app with a fresh/seeded `LS_KEY` blob; (2) drives a fleet-UI boat status change (e.g. the `flSaveEditBoatStatus()` flow, or directly pushes a new entry onto `BOATS[i].log` and calls `flSave()`); (3) asserts `localStorage[LS_KEY].boats` reflects the new status immediately after `flSave()` runs (not after `saveData()`); (4) simulates a reload by re-reading and re-hydrating from `localStorage` (`loadData()`) and asserts the boat's current status (`getCurStatus` / last log entry) still matches. This directly exercises the `§flBoatPersist` / LAM-31 comment's claim and would regress loudly if a future refactor ever removed `d.boats=BOATS` from `flSave()` without adding an equivalent `saveData()` call on every fleet mutation path.
  - Consider whether `_laSyncSave` should eventually be discoverable via a code comment index, since it is currently only reachable by reading the boot IIFE end-to-end — out of scope for this pure-rename task.
- **Rollback procedure:** Revert the single commit on this branch (or `git checkout <previous-commit> -- allotment_v2/allotment_v2.html`) to restore the original `save(v, forceLegacy)` / `save(area)` names. No data migration, schema, or persisted-blob shape changed, so rollback is a pure code revert with no cleanup required.

## Agent handoff

- **Task:** LAM-31
- **Branch:** `agent/LAM-31-save-disambiguation`
- **Worktree:** `D:/projects/wt-sprint2b/LAM-31-save-disambiguation`
- **HEAD at scaffold:** `ca649aa45a0ce6fc670edfdb4391176f43c95047`
- **Merge base:** `fa60a96e2d86c7776e04a0cf726f7ed8eb60a7c6`
- **PR:** TODO_AFTER_PUBLISH
- **Unrelated changes left untouched:** Everything outside `allotment_v2/allotment_v2.html`, `docs/development/tasks/LAM-31.md`, and `.agent-reports/LAM-31.json` — including all files brought in by the required sibling merges (LAM-27, LAM-29) and prior base-branch history (LAM-16 through LAM-23), which were kept exactly as those branches produced them, staged nowhere by this task.
