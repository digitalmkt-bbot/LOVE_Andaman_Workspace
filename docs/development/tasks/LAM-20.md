# LAM-20: Fix esc undefined in the rate-type picker

## Input contract

- **Requested outcome:** `agEditBuildRateTypePicker` (~line 63783 of `allotment_v2/allotment_v2.html`) calls a bare `esc(...)` in the branch taken whenever the agent has a sales owner. No global `esc` exists in this file, so the picker throws a `ReferenceError` and renders nothing for most agents. Add a local `const esc` per file convention, and grep every top-level render function for the same class of bug and report what is found.
- **Acceptance criteria:**
  - `agEditBuildRateTypePicker` declares a local `const esc` consistent with the file's per-function `esc` convention.
  - The bare `esc(_salesNm||'เซลล์ผู้ดูแล')` call at the former line 63867 resolves to the local `esc` instead of throwing `ReferenceError`.
  - `node --check` passes on the extracted main `<script>` block after the edit.
  - A sweep of every top-level function in `allotment_v2.html` for the same class of bug (bare `esc(`/`escapeHTML(` call with no local declaration) is performed and reported — any additional sites found are **not** fixed in this diff, only reported as follow-ups.
  - Only `agEditBuildRateTypePicker` is modified in `allotment_v2.html` for this task.
- **Allowed scope:**
  - `allotment_v2/allotment_v2.html` (fix ONLY `agEditBuildRateTypePicker`)
  - `docs/development/tasks/LAM-20.md`
  - `.agent-reports/LAM-20.json`
- **Constraints/invariants:**
  - Fix only `agEditBuildRateTypePicker` in this task; other bare-esc sites go into this report as follow-ups, not into the diff, to avoid colliding with LAM-17/18/19 which edit the same file concurrently.
  - Never touch `package.json`, `test/**`, `.github/**`, `CLAUDE.md`, `README.md`.
  - `esc`/`escapeHTML` is not global in this file — every top-level render function must declare its own local `esc`.
  - Stage only the three owned paths explicitly with `git add -- <path>`, never `git add -A` / `git add .`.
  - No Postgres and no network-dependent prod service reachable from this sandbox.
- **Base branch:** `refactor/booking-v2-migration`
- **Starting assumptions:**
  - The per-function local-`esc` convention already used elsewhere in the file (e.g. `agEditBuildTmplPicker` at line 63754) is the correct pattern to replicate here.
  - Merge conflicts with LAM-17/LAM-18/LAM-19 (which also edit `allotment_v2.html`) are accepted per task instructions and not this worker's concern to resolve.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| Agent Edit modal → Rate Type picker (`agEditBuildRateTypePicker`) | For any agent that has a sales owner set (the common, non-`noSales` branch), the picker's hint text called a bare `esc(_salesNm||'เซลล์ผู้ดูแล')` with no `esc` defined anywhere in scope. This threw a synchronous `ReferenceError` inside the template literal, so `agEditBuildRateTypePicker`'s return statement never completed and the Rate Type picker section rendered blank/broken for most agents opening Agent Edit. | `agEditBuildRateTypePicker` now declares its own local `const esc` (same HTML-escaping convention as the neighboring `agEditBuildTmplPicker`). The sales-owner hint renders correctly with the sales name (or `'เซลล์ผู้ดูแล'` fallback) HTML-escaped, and the picker's rate-type list, hint text, and "show other sales" toggle all render as designed. |

### Interfaces and contracts

- **Added:** A local `const esc` inside `agEditBuildRateTypePicker` (function-scoped, not exported/global).
- **Changed:** None.
- **Removed:** None.
- **Compatibility notes:** Pure bugfix, no signature/contract change. No other function calls `agEditBuildRateTypePicker`'s internals.

### Files changed

```text
modified	allotment_v2/allotment_v2.html
added	docs/development/tasks/LAM-20.md
added	.agent-reports/LAM-20.json
```

Exact diff to `allotment_v2/allotment_v2.html`:

```diff
 function agEditBuildRateTypePicker(){
   const d = _agEditDraft;
+  const esc = s => String(s||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
   const currentId = d.rateTypeId;
```

### Data and persistence impact

- **Database/schema:** None.
- **API or mapper:** None.
- **Migration required:** No.
- **Rollback effect on data:** None — pure client-side render-function fix, no persisted state involved either direction.

## Verification evidence

| Command/check | Result |
|---|---|
| `node --check` on the extracted main `<script>` block (real tag pair at lines 39186–83628, verified by pairing every literal `<script>`/`</script>` in the file and excluding matches that are inside JS string/template literals such as lines 13211, 50865, 51208, 55143, 83305, 83619) | Passed — Node v24.18.0, no syntax errors, exit 0 (`SYNTAX_OK_FINAL`) |
| `git diff -- allotment_v2/allotment_v2.html` | Passed — exactly one line added inside `agEditBuildRateTypePicker`; no other lines changed; CRLF line endings preserved throughout the file (verified with a `sed -b` binary-mode diff before/after) |
| Custom Node sweep script (brace-matches all 3071 top-level `function NAME(){...}` declarations and flags any body calling bare `esc(`/`escapeHTML(` with no local `const`/`let`/`var`/`function`/param declaration of that identifier in scope) run against the fixed file | Passed — `Top-level functions scanned: 3071` / `Functions with bare esc()/escapeHTML() and no local declaration: 0` |
| Same sweep script run against the pre-fix `BACKUP/allotment_v2_20260819_LAM20-esc-fix.html` copy, as a detector sanity check | Passed — correctly and exclusively flagged `agEditBuildRateTypePicker` (fn L63783–63875, bare call at L63867), confirming the detector reproduces the known bug and does not over/under-match (also confirmed no false positive on the `bop2RenderShell`/`bop2RenderHeatmapRow`/`bop2RenderFleetPool` family, which each declare their own local `escapeHTML` in nested helper blocks) |
| Manual review of `agEditBuildTmplPicker` (function immediately preceding `agEditBuildRateTypePicker`) to confirm the local-`esc` convention being replicated | Passed — line 63754 declares the identical escape-map pattern now added to `agEditBuildRateTypePicker` |
| Manual browser / live-app verification of the rendered Agent Edit → Rate Type picker (e.g. via a logged-in prod Chrome tab or `localhost:8765`) | Not run — no live browser session or Postgres-backed server is reachable from this sandboxed worktree; static-only sandbox. Fix verified statically (syntax check + convention match + sweep) only. Recommend a human/coordinator do a quick visual check of Agent Edit for an agent with a sales owner set before/after merge |

### Bug-class sweep — what was found

Per the task's ask to "grep every top-level render function for the same class of bug and report what you find": a Node script brace-matched every one of the 3071 top-level `function NAME(){...}` declarations in `allotment_v2.html`, and for each checked whether its body calls a bare `esc(...)` or `escapeHTML(...)` without a local `const`/`let`/`var`/`function`-named declaration (or matching parameter) of that identifier anywhere in the function body.

- **Result on current (fixed) HEAD: 0 additional sites.** No other top-level function in the file currently calls a bare `esc(`/`escapeHTML(` without a local declaration.
- The detector was validated two ways before trusting a "0" result:
  1. Run against the **pre-fix backup**, it correctly and exclusively flagged the known LAM-20 bug (`agEditBuildRateTypePicker`, line 63867) — proving the detector actually catches this bug class.
  2. An earlier version of the script (checking only for a declaration named `esc`, not `escapeHTML`) produced 11 false positives across `bop2RenderShell`, `bop2RenderHeatmapRow`, `bop2RenderFleetPool`, `psuRenderProfilesTab`, `psuRenderAreasTab`, `psuRenderAreaModal`, `bkV2RenderNewBooking`, `bkV2RenderPickupSection`, `bkV2RenderTripsSection`, `bkV2RenderPassengerRows`, and `bkV2RenderBookingDetail` — every one of these turned out to already declare its own local `const escapeHTML = ...` (sometimes several times, once per inner helper block) and was not actually broken. Fixing the script's per-identifier scoping (checking `esc` and `escapeHTML` declarations independently) eliminated all 11 false positives.
- **Caveat:** the brace-matcher is a best-effort heuristic (handles line/block comments and string/template literals, but not every edge case of nested `${...}` expressions inside template literals) — validated against this specific bug and against the `bop2Render*`/`bkV2Render*`/`psuRender*` families with correct results, but a residual chance of an undetected site elsewhere in 3071 functions can't be fully ruled out without a real JS parser (no `acorn`/`espree` available in this sandbox). Also confirmed separately that essentially all render/build-style functions in this file use the `function NAME(){` top-level form (only 2 top-level arrow-`const` declarations exist file-wide, neither `Render`/`Build`-named), so the top-level-`function` scope matches the task's "top-level render function" ask.

## Decisions, risks, and rollback

- **Decisions:**
  - Matched the existing per-function local-`esc` convention exactly (same escape map, same arrow-function shape) rather than introducing a shared/global `esc` helper, per `CLAUDE.md`'s "esc is not global — every new render fn must declare its own" rule, and to avoid a structural change that could collide with LAM-17/18/19's concurrent edits to the same file.
  - Scoped the file-wide bug sweep to top-level `function NAME(){...}` declarations at column 0 (confirmed this covers essentially all render/build functions in the file).
  - Did not fix any other site, since none were found after correcting the sweep script's per-identifier scoping — reported the sweep methodology and zero-result outcome instead of expanding this diff, per the explicit instruction to fix only `agEditBuildRateTypePicker` in this task.
- **Known risks:**
  - The sweep is a heuristic static-analysis script, not a real parser; validated against the known bug and the multi-helper `bop2Render*` family with correct results, but not formally proven exhaustive.
  - This fix was verified by static analysis only (`node --check` + convention match); no live browser/server session was available in this sandbox to click through the actual rendered picker.
- **Blockers:** None.
- **Dependencies:** LAM-17, LAM-18, LAM-19 edit `allotment_v2/allotment_v2.html` concurrently on sibling branches off the same base; merge conflicts against this PR are expected and accepted per task instructions, not something this worker resolves.
- **Follow-up work:**
  - No other bare `esc()`/`escapeHTML()` call sites without a local declaration were found in any of the 3071 top-level functions in `allotment_v2.html` as of this task's HEAD — no further follow-up fixes of this exact bug class are currently outstanding.
  - Recommended (not performed here): a lightweight lint/CI check that greps new top-level render functions for `esc(`/`escapeHTML(` usage without a matching local declaration, to catch this bug class before merge in future PRs (per the recurring-gotcha note in `CLAUDE.md` §6, "esc / escapeHTML is NOT global").
  - Recommended: once LAM-17/18/19 land, a human should smoke-test Agent Edit → Rate Type picker for an agent with a sales owner set, since this was verified statically only.
- **Rollback procedure:** Revert the single added line in `agEditBuildRateTypePicker` (`allotment_v2/allotment_v2.html`): remove the `const esc = s => String(s||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));` line immediately after `const d = _agEditDraft;`. This restores the pre-fix `ReferenceError` behavior with no data/schema impact either way.

## Agent handoff

- **Task:** LAM-20
- **Branch:** `agent/LAM-20-esc-rate-type-picker`
- **Worktree:** `D:/projects/wt-sprint1/LAM-20-esc-rate-type-picker`
- **HEAD at scaffold:** `fa60a96e2d86c7776e04a0cf726f7ed8eb60a7c6`
- **Merge base:** `fa60a96e2d86c7776e04a0cf726f7ed8eb60a7c6`
- **PR:** [#9](https://github.com/digitalmkt-bbot/LOVE_Andaman_Workspace/pull/9) — open, base `refactor/booking-v2-migration` ← head `agent/LAM-20-esc-rate-type-picker`
- **Unrelated changes left untouched:** None — worktree was clean at start; only the three owned paths were touched.
