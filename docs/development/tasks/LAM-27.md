# LAM-27: single source of truth for the cancelled/rejected/cancelled_weather status triple

## Input contract

- **Requested outcome:** The three-element status triple `['cancelled','cancelled_weather','rejected']` (in whatever order/quoting a given call site happened to use) was duplicated inline throughout `allotment_v2/allotment_v2.html`, and a second name, `ACCT_PAID_STATES`, already held the exact same array under a name that reads as "states that ARE paid" when it actually means "states to EXCLUDE from every booking aggregate." Consolidate to one exported constant, `ACCT_EXCLUDED_STATES`, and add a lint-style guard that fails on any new inline duplicate of the triple.
- **Acceptance criteria:**
  1. Grep-count the real number of inline occurrences of the triple (ticket said "roughly ten") and report the actual figure with every location.
  2. Replace every exact-triple occurrence with the single constant; rename `ACCT_PAID_STATES` → `ACCT_EXCLUDED_STATES`, updating all references.
  3. Behavior must be identical afterwards (pure refactor). Any site where the literal set differs from the exact triple must be left alone and reported as a finding, not silently normalized.
  4. Add `tools/check-excluded-states.mjs` — a standalone Node script that greps for new inline duplicates of the triple and exits non-zero — without wiring it into the root `package.json` or `.github/**` (this worker does not own those files).
- **Allowed scope:** `allotment_v2/allotment_v2.html`, `tools/check-excluded-states.mjs`, `docs/development/tasks/LAM-27.md`, `.agent-reports/LAM-27.json`. Nothing else.
- **Constraints/invariants:**
  - Pure refactor — no behavior change.
  - Never `git add -A`/`git add .`; stage only owned paths.
  - LAM-29 is concurrently editing `allotment_v2.html` in a separate worktree (three load-condition sites) — this task's edits must stay clear of that area (they were: LAM-27 touched only status-triple sites, no `Array.isArray(d.sb_...)` load-condition code).
  - `allotment_v2/allotment_v2.html` is explicitly pre-approved for this task by the user; no hard-stop required for editing it.
  - Every JS change verified via `node --check` on the extracted `<script>` content.
- **Base branch:** `refactor/booking-v2-migration` (PR base). Diffs in this report are computed against `origin/refactor/booking-v2-migration` — the local branch ref of the same name in this shared multi-worktree repo was stale (pointing at an older, unrelated commit) at task start, so `git diff --name-status refactor/booking-v2-migration...HEAD` would have wrongly included dozens of files from already-merged sibling tasks (LAM-16..LAM-23, `.github/**`, `package.json`, `test/**`). No shared ref was modified to fix this — the diff was simply recomputed against the correct `origin/...` tracking ref, which agrees exactly with `git status`/`git diff` (working tree) on the single owned file actually changed.
- **Starting assumptions:** The file uses several separate top-level `<script>` blocks (not one), each of which shares the page's global lexical scope with every script tag that runs before it (verified: 8 real `<script>...</script>` pairs, several other `<script>` occurrences are inside JS string literals building HTML strings and are not real tags). A `const` declared at the very top of the FIRST `<script>` block, outside any wrapping function/IIFE, is visible to literally everything that runs afterward in the page — this is the anchor the whole refactor depends on.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| Excluded-status check (booking aggregates, seat/pax counts, van/boat job sheets, accounting, market intel, etc.) | Each call site inlined `['cancelled','rejected','cancelled_weather']` (or `['cancelled','cancelled_weather','rejected']`, or a chained `x.status === 'a' \|\| x.status === 'b' \|\| x.status === 'c'`) independently | Every one of those call sites reads `ACCT_EXCLUDED_STATES`, a single array declared once. Same 3 string values, same order, same semantics (`.includes`/`.indexOf`/chained `===` all preserved as originally used — only chained-`===` sites using the exact 3-value set were rewritten to `ACCT_EXCLUDED_STATES.includes(...)`, which is provably behaviorally identical) |
| `ACCT_PAID_STATES` (accounting: agent credit calc, new-invoice booking picker) | Declared mid-file (line ~42897 pre-edit) as `['cancelled','rejected','cancelled_weather']`, name implied "states that are paid" | Renamed to `ACCT_EXCLUDED_STATES`; declaration itself hoisted to the top of the file so both accounting code (which runs late) and very-early code (e.g. an SSE/health-check IIFE that starts executing at document-parse time) can reference it safely |
| Sites where the underlying status set genuinely differs from the exact triple (2 of the 3 statuses only; the triple plus `'completed'`; a single-status ternary/comparison) | Inline literal | **Left untouched** — see Decisions/Findings below. These are NOT the same constant and normalizing them would be a silent behavior change |
| New-literal guard | None | `tools/check-excluded-states.mjs` — run `node tools/check-excluded-states.mjs [path]`; greps for the exact 3-value array literal (any order/quoting) or chained-`===` triple outside the declaration line and exits 1 if found |

### Interfaces and contracts

- **Added:** `const ACCT_EXCLUDED_STATES` (top-level, first `<script>` block, `allotment_v2/allotment_v2.html`, line 13). `tools/check-excluded-states.mjs` (CLI: `node tools/check-excluded-states.mjs [path-to-html]`, default target `allotment_v2/allotment_v2.html`; exit 0 = clean, 1 = new duplicate found, 2 = setup problem e.g. file or declaration not found).
- **Changed:** `ACCT_PAID_STATES` renamed to `ACCT_EXCLUDED_STATES` (same value, same shape) — every one of its 3 pre-existing references (`agCreditState`, `acctNewInvoiceRender` x2) updated to the new name.
- **Removed:** `ACCT_PAID_STATES` as a name (superseded by `ACCT_EXCLUDED_STATES`; a comment is left at its old declaration site pointing to the new location). `_B2C_CXL`, `_SB_CXL`, `_RC_CXL` (local per-scope aliases that duplicated the triple) now simply alias `ACCT_EXCLUDED_STATES` instead of re-declaring the literal — their own names/usages are unchanged, so no call site needed to change.
- **Compatibility notes:** No public/exported API changed shape. `window.*` surface unaffected (the constant is a bare top-level `const`, not attached to `window`, matching how it's consumed everywhere — as a bare identifier).

### Files changed

```text
modified	allotment_v2/allotment_v2.html
added	tools/check-excluded-states.mjs
added	docs/development/tasks/LAM-27.md
added	.agent-reports/LAM-27.json
```

### Data and persistence impact

- **Database/schema:** None.
- **API or mapper:** None.
- **Migration required:** No.
- **Rollback effect on data:** None — this is a pure code refactor; no localStorage/Postgres shape changed.

## Occurrence count (ticket said "roughly ten" — actual was far higher)

Grep of the exact 3-element array literal `[cancelled, rejected, cancelled_weather]` (any of the 6 permutations, either quote style) found **91 occurrences** before this change, one of which was the `ACCT_PAID_STATES` declaration itself (so 90 call sites plus the definition). In addition, **4 more sites** expressed the identical 3-value set as a chained `x.status === 'a' || x.status === 'b' || x.status === 'c'` instead of an array literal. Total normalized to the single constant: **94 sites** (90 array-literal call sites + 1 declaration + 3 chained-comparison call sites using `bk.status` + 1 chained-comparison call site using `b.status`, in `insTripsForDate`).

Every one of the 90 replaced array-literal call sites and the 4 chained-comparison sites is visible in the diff (`git diff origin/refactor/booking-v2-migration...HEAD -- allotment_v2/allotment_v2.html`); line numbers below are POST-edit (the file grew by 8 lines from the new top-of-file comment block).

Representative locations (not exhaustive — see the diff for the full 94): lines 368 (`_B2C_CXL`), 6212/6247 (`_dashBoardData`/`_dashLiveFeedHtml`), 6324/7157/7180 (`renderDash`), 11959 (`_SB_CXL`), 12060/12202/12982 (`getSeatsConsumed`/`getBookingsForRouteDate`/`progCountBookingImpact` — the 3 `bk.status===...` chained sites), 21849/22069 (`flRenderDR`), 32444 (`_flBoatRanOn`), 39437/39452 (staff welfare), 41885/41914 (lock claims/coverage), 42897→ comment (old `ACCT_PAID_STATES` site), 42921/59073/59080 (accounting, renamed references), 43078–43608 (market-intel `md*` functions, `insTripsForDate`, `renderBookingFlow`), 44162–44928 (pickup-map `pmap*`, `_RC_CXL`, `pfm*`), 45332–46972 (boat-assign, van jobs, van-group heal/conflicts), 47297–56645 (check-in `ck*`/`px*`/pier-ops `po*`/`pj*` families), 59924/59981 (weather), 69109 (`bkV2Aggregate`), 71945/71953/72083/72118 (booking Tab2), 73389 (duplicate-booking badge), 76409/76464/76481/76524 (restore/duplicate/staff-quota), 78153 (restore button), 79842/79866/82186 (pier-ops).

## Findings — sites deliberately left as-is (literal differs from the triple)

Per the task's explicit instruction, any site whose literal set is not exactly `{cancelled, rejected, cancelled_weather}` was left untouched rather than silently normalized. Reporting each for follow-up triage (possibly by LAM-31, which rebases a global rename on top of this task and LAM-29):

1. **Two-element subset (excludes `rejected`)** — `['cancelled','cancelled_weather']`, lines 52422 and 75950. Also 7 bare comparisons of the same 2-value shape (`b.status==='cancelled'||b.status==='cancelled_weather'`) at lines 43403, 43948, 44075, 52398, 70828, 70983, plus a single-value ternary at 70990 and 72820 (`b.status==='cancelled_weather'?...`). These intentionally do NOT exclude `'rejected'` bookings — using `ACCT_EXCLUDED_STATES` here would be a behavior change (rejected bookings would newly be excluded from whatever these compute). Left alone.
2. **Four-element superset (adds `completed`)** — `['cancelled','completed','rejected','cancelled_weather']`, lines 77648 and 77662 (`bkV2DetailReschedule`/`bkV2DetailEdit` guard clauses — "cannot reschedule/edit a completed booking" is a deliberately broader block-list). Left alone; do not collapse into `ACCT_EXCLUDED_STATES`.

None of the above were modified. If a future task wants these consolidated too, they need their own named constants (e.g. a `ACCT_TERMINAL_STATES` including `'completed'`, or a documented "excludes-rejected" variant) rather than reuse of `ACCT_EXCLUDED_STATES` — reusing it here would silently change behavior, which was explicitly out of scope.

## Verification evidence

| Command/check | Result |
|---|---|
| `grep -noE "\[(['\"](cancelled\|rejected\|cancelled_weather)['\"],?\s*){3}\]" allotment_v2/allotment_v2.html` (pre-edit count) | Passed — 91 matches (90 call sites + 1 `ACCT_PAID_STATES` declaration) |
| Same grep, post-edit (expect exactly 1: the new `ACCT_EXCLUDED_STATES` declaration) | Passed — 1 match, at line 13 |
| `grep -noE "<chained ===-triple pattern, any order>" allotment_v2/allotment_v2.html` pre/post | Passed — 4 matches pre-edit, 0 post-edit |
| Extract every `<script>...</script>` block from `allotment_v2/allotment_v2.html`, concatenate, `node --check` on the result | Passed — `blocks: 8`, syntax OK |
| `node --check tools/check-excluded-states.mjs` | Passed |
| `node tools/check-excluded-states.mjs` (against the real, edited file) | Passed — exit 0, "OK — no inline duplicates ... (single source of truth: ACCT_EXCLUDED_STATES, line 13)" |
| `node tools/check-excluded-states.mjs <synthetic file with a fresh array-literal AND a fresh chained-comparison duplicate, plus one deliberately-different 2-element array>` | Passed — exit 1, correctly flagged the array-literal and chained-comparison duplicates, correctly did NOT flag the 2-element array |
| `git diff --name-status origin/refactor/booking-v2-migration...HEAD` / `git diff --name-status` / `git status --short` | Passed — confirms exactly one modified file (`allotment_v2/allotment_v2.html`) plus the 3 new owned files; nothing outside scope |
| Runtime/browser verification (load the page, exercise booking aggregates against live/local Postgres) | Not run — no Postgres/prod service reachable from this sandbox per task constraints; this is a pure static/syntactic refactor with provably-identical `.includes()`/`.indexOf()`/chained-`===` semantics, so runtime behavior is not expected to differ, but this was not empirically exercised in a browser |
| `npm test` / repo-level CI | Not run — this worker does not own `package.json`/`.github/**`; wiring the new guard into either is explicitly out of scope (declared as a dependency below) |

## Decisions, risks, and rollback

- **Decisions:**
  - Hoisted the single `ACCT_EXCLUDED_STATES` declaration to the very top of the file (before the first IIFE in the first `<script>` block) rather than leaving it where `ACCT_PAID_STATES` used to live (line ~42897). The file has 8 separate top-level `<script>` tags; several earlier ones contain code that runs immediately (not deferred inside a function) and referenced the triple (e.g. `_B2C_CXL` at line 368, inside an IIFE that begins executing as soon as its `<script>` block is parsed). A `const` declared partway through the file would not exist yet when that earlier code runs, throwing `ReferenceError`. Placing the declaration first — outside any function, so it joins the page's shared global lexical environment — makes it safely visible to every subsequent `<script>` block and every function they define, however early or deferred. This was verified structurally (mapped all real `<script>`/`</script>` boundaries, distinguishing them from `<script>` text that appears inside JS string literals building HTML strings) and confirmed with the whole-file `node --check` pass.
  - Converted the 4 "chained `===`" sites to `ACCT_EXCLUDED_STATES.includes(x.status)` rather than leaving them as `x.status === 'a' || ...`. This is provably behavior-identical (same 3 string equality checks, OR'd) and was judged in-scope because it duplicates the exact same literal the ticket is about, just in a different syntactic shape — leaving it as bare string literals would have let the same drift the ticket complains about continue in a different form, and the new guard script explicitly checks for this shape too.
  - Did NOT touch the 2-element and 4-element sites (see Findings above) — those encode a genuinely different status set, and the task instructions were explicit that this must stay a pure, literal-preserving refactor everywhere the set actually differs.
  - `tools/check-excluded-states.mjs` is intentionally a plain, dependency-free `.mjs` script (`node:fs`, `node:path`, `node:url` only) so it runs with zero setup and was NOT added to `package.json` scripts or any `.github/workflows/*.yml` — this worker does not own either file (see Dependencies).
- **Known risks:**
  - The guard's array-literal/chained-comparison regexes match by permutation of the 3 known string values; a future refactor that renames the status strings themselves (e.g. `'cancelled_weather'` → `'weather_cancelled'`) would silently stop being caught by the guard until it's updated too — this is inherent to a literal-value guard and was not solvable without a full AST-based check, which was out of scope for a "standalone grep-based script."
  - The guard is not wired into any CI gate yet (see Dependencies) — until a workflow or `package.json` owner wires it in, it only protects the codebase when someone remembers to run it manually.
  - No live/browser verification was possible in this sandbox (no Postgres/prod reachable) — the change is syntactically verified and semantically argued to be behavior-preserving, but was not exercised end-to-end against real booking data.
- **Blockers:** None — task completed within its own scope.
- **Dependencies:**
  - Wiring `tools/check-excluded-states.mjs` into `package.json` (e.g. as an `npm run check:excluded-states` script or part of `npm test`) and/or a `.github/workflows/*.yml` CI step is explicitly deferred to whoever owns those files — this worker's constraints forbid touching either.
  - LAM-29 (three load-condition sites in the same file, concurrent worktree) and LAM-31 (planned global rename rebase on top of both LAM-27 and LAM-29) were not touched or blocked by this change; this task's edits are entirely within the status-triple call sites enumerated above and do not overlap `Array.isArray(d.sb_...)` load-condition code.
- **Follow-up work:**
  - Consider a dedicated `ACCT_TERMINAL_STATES` (or similarly named) constant for the 4-element `{cancelled, completed, rejected, cancelled_weather}` set used by the reschedule/edit guards (lines 77648, 77662), and a documented "excludes-rejected" 2-element constant for the sites listed in Finding 1 — both explicitly out of scope for this pure-refactor task but flagged for whoever picks up the broader status-constant cleanup.
  - Wire `tools/check-excluded-states.mjs` into CI once its owning task/worker is assigned.
- **Rollback procedure:** `git revert <this task's commit>` on the PR branch (single commit, single file touched in the app plus 3 new files) fully restores the pre-refactor inline literals and the `ACCT_PAID_STATES` name; no data/schema rollback needed since nothing persisted changed shape.

## Agent handoff

- **Task:** LAM-27
- **Branch:** `agent/LAM-27-cancelled-status-constant`
- **Worktree:** `D:/projects/wt-sprint2b/LAM-27-cancelled-status-constant`
- **HEAD at scaffold:** `e7d28f0487b2b51c621a89b21689bc649f7f980a`
- **Merge base (recomputed against `origin/refactor/booking-v2-migration`):** `e7d28f0487b2b51c621a89b21689bc649f7f980a`
- **PR:** see `.agent-reports/LAM-27.json` → `git.pr`
- **Unrelated changes left untouched:** Everything outside the 4 owned files. In particular, the stale local branch ref `refactor/booking-v2-migration` (pointing at an unrelated older commit, shared across this multi-worktree repo) was left exactly as found — not force-updated, not checked out, not touched — this report simply computed its diffs against `origin/refactor/booking-v2-migration` instead.
