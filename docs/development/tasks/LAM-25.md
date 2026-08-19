# LAM-25: Regression suite for the edit-preserve block (S2-01)

## Input contract

- **Requested outcome:** A regression suite for `bkV2CommitBooking`'s edit-preserve block
  (`allotment_v2.html`, `if(editing){...}` inside the function, ~`:76868`–`:76956`, documented in
  `allotment_v2/docs/workflows/01-booking-lifecycle.md` §3.2 "The edit-preserve block"). The block
  rebuilds `newBk` from scratch on every edit, so any field not explicitly copied from `editing` is
  silently destroyed. Carry-overs required by the ticket: `history`, `weatherResolve`, `rebook`,
  `invoiceId`, `paymentStatus`, `ops`, `b2cOverride`, `upgrades`, `feeItems`, `reschedule`,
  `partialCancels`, `cancellation`, `cancelCategory`, resolved `approval`, decided `focApproval`.
  Losing `ops` alone once wiped every boat/van assignment in production (2026-06-14).
- **Acceptance criteria:** One test per carry-over field, data-driven from a single list; deleting
  a carry-over line from `allotment_v2.html` must make the suite go red for that field.
- **Allowed scope:** `test/regression/edit-preserve/**`, `docs/development/tasks/LAM-25.md`,
  `.agent-reports/LAM-25.json`. Read `allotment_v2/allotment_v2.html` only — never edit it. Reuse
  `test/helpers/**`/`test/fixtures/**` (LAM-22 harness) rather than re-implementing them; do not
  edit them or root `package.json`. Never touch `test/regression/seat-locks/**` (LAM-26, running
  concurrently). Do not duplicate LAM-77's `tests/legacy/edit-preserve.test.mjs` (already merged to
  `origin/main`, not present on this branch) — add only the delta beyond what it covers, and state
  the overlap explicitly.
- **Constraints/invariants:** Stage only the owned paths with `git add -- <path>` (never `git add
  .`/`-A`). Commit message exactly `LAM-25: <imperative summary>`. No Postgres/prod reachable from
  this sandbox.
- **Base branch:** `refactor/booking-v2-migration`
- **Starting assumptions:** Worktree started clean at `e7d28f0` (verified via `git status --short
  --branch` before any edit — no pre-existing uncommitted changes). `test/` (LAM-22 harness) and
  `allotment_v2/docs/workflows/01-booking-lifecycle.md` already existed on this branch;
  `tests/legacy/**` (LAM-77) does not.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| Edit-preserve field coverage on `refactor/booking-v2-migration` | No test in this branch's `test/` tree exercised the edit-preserve block at all (LAM-22's harness covers the booking write-path E2E, not this in-browser rebuild logic; LAM-77's characterization suite exists only on `origin/main`, under `tests/legacy/`, unreachable from here). | `node --test` now runs `test/regression/edit-preserve/edit-preserve.test.mjs`: 15 carry-over fields × 2 tests (present-carries-over / absent-not-fabricated) = 30 tests, plus 1 field-list-coverage test = 31 tests, all generated from the single `CARRY_OVER_FIELDS` list in `fields.mjs`. Each test extracts the field's real carry-over line(s) verbatim from `allotment_v2.html` at run time and executes them in an isolated `vm` sandbox — deleting or rewording a carry-over line makes that field's tests fail with a clear "marker not found" error instead of silently passing on stale logic. Proven live (see Verification): deleting the `ops` line, and separately the `b2cOverride` line, in a scratch copy of the file turned exactly that field's two tests red and nothing else, then restoring made the suite green again — with the tracked `allotment_v2.html` never touched (`git diff --stat` empty throughout). |

### Interfaces and contracts

- **Added:**
  - `test/regression/edit-preserve/fields.mjs` — exports `CARRY_OVER_FIELDS`, the single
    data-driven list of the 15 carry-over fields (marker text, present/absent fixtures, assertions).
  - `test/regression/edit-preserve/lib/source.mjs` — exports `resolveHtmlPath()`, `getSource()`,
    `resetCache()`, `assertUnique()`, `extractLine()`, `extractBetween()` — reads
    `allotment_v2.html` (default: the tracked file; overridable via `EDIT_PRESERVE_HTML_PATH` for
    the mutation-proof verification runs) and extracts literal marker text from it.
  - `test/regression/edit-preserve/lib/sandbox.mjs` — exports `runInSandbox()`, a thin `node:vm`
    wrapper (no app globals needed — every carry-over line only touches its own
    `editing`/`newBk` locals).
  - `test/regression/edit-preserve/edit-preserve.test.mjs` — the `node:test` suite generated from
    `CARRY_OVER_FIELDS`.
- **Changed:** None.
- **Removed:** None.
- **Compatibility notes:** New files only, additive to the existing `test/` tree; discovered
  automatically by `node --test`'s default recursive walk (same convention as
  `test/unit/`/`test/e2e/`) and by `.github/workflows/tests.yml`'s existing `node --test` step —
  no CI config change needed.

### Files changed

```text
added	.agent-reports/LAM-25.json
added	docs/development/tasks/LAM-25.md
added	test/regression/edit-preserve/edit-preserve.test.mjs
added	test/regression/edit-preserve/fields.mjs
added	test/regression/edit-preserve/lib/sandbox.mjs
added	test/regression/edit-preserve/lib/source.mjs
```

(`git diff --stat HEAD` / `git status --porcelain` at the time of writing this report show exactly
these four new paths as untracked and nothing else modified — `allotment_v2.html` has zero diff.
The scaffold script's auto-generated file list compared against an unrelated older ref and listed
the whole branch history's files; that table has been replaced with the actual diff above.)

### Data and persistence impact

- **Database/schema:** None — this is a test-only change; no server/API/schema code touched.
- **API or mapper:** None.
- **Migration required:** No.
- **Rollback effect on data:** None — no data ever written; `allotment_v2.html` and `server.js`
  are unmodified.

## Verification evidence

| Command/check | Result |
|---|---|
| `git status --short --branch` (recorded first, before any edit) | Passed — clean, no pre-existing changes: `## agent/LAM-25-edit-preserve-regression...origin/refactor/booking-v2-migration` with no file lines. |
| `node --test "test/regression/edit-preserve/*.test.mjs"` (baseline, real `allotment_v2.html`) | Passed — `tests 31 / pass 31 / fail 0`. |
| `node --test` from repo root (full existing suite, real file) | Partial — the new 31 edit-preserve tests all pass; `test/unit/booking-fixture.test.mjs` (LAM-22, pre-existing) passes; `test/e2e/booking-write-path.test.mjs` and `test/helpers/db.mjs` fail in this sandbox with `Cannot find module 'test\e2e'` / `'test\helpers'` — a pre-existing `node --test <dir>` module-resolution quirk on this Windows/Node 24 sandbox, in files this task does not own and did not modify (confirmed by running `node --test test/e2e test/helpers` in isolation — same failure, unrelated to any edit-preserve change). Not a regression introduced by this task. |
| Mutation proof — `ops`: copied `allotment_v2.html` to a scratch file (`EDIT_PRESERVE_HTML_PATH`, outside the repo, never the tracked file), deleted line 76876 (`if(editing.ops) newBk.ops = editing.ops;`) with `sed -i '76876d'`, re-ran `node --test "test/regression/edit-preserve/*.test.mjs"` | Passed (as designed) — went RED for exactly `ops`: `tests 31 / pass 29 / fail 2`, both failures are the two `ops` tests, error `edit-preserve marker not found in <scratch path> (the carry-over line was deleted, moved, or reworded): "if(editing.ops) newBk.ops = editing.ops;"`. All other 29 tests stayed green. |
| Mutation proof — `ops`: deleted the scratch file, cleared `EDIT_PRESERVE_HTML_PATH`, re-ran the same command against the real (untouched) file | Passed — back to GREEN: `tests 31 / pass 31 / fail 0`. `git status --short` / `git diff --stat -- allotment_v2/allotment_v2.html` confirmed the tracked file was never touched. |
| Mutation proof — `b2cOverride` (repeated independently, since this field is new beyond LAM-77's coverage): scratch copy, deleted line 76892 (`} else if(Array.isArray(editing.b2cOverride)){ newBk.b2cOverride = editing.b2cOverride; }`), re-ran the suite | Passed (as designed) — went RED for exactly `b2cOverride`: `tests 31 / pass 29 / fail 2`, both failures are the two `b2cOverride` tests, same "marker not found" error. |
| Mutation proof — `b2cOverride`: deleted the scratch file, cleared the env var, re-ran against the real file | Passed — back to GREEN: `tests 31 / pass 31 / fail 0`. |
| `node --check` on the extracted `<script>` of `allotment_v2.html` | Not run — not applicable; this task made no edit to `allotment_v2.html` (read-only per task constraints), so there is nothing to check. |
| Postgres / `server.js` boot / prod verification | Not run — out of scope: this is a pure Node-`vm` unit-test change with no server or DB code touched, and no Postgres/prod service is reachable from this sandbox. |

## Decisions, risks, and rollback

- **Decisions:**
  - Built this task's own `lib/source.mjs`/`lib/sandbox.mjs` (owned under
    `test/regression/edit-preserve/lib/`) rather than reusing LAM-77's `tests/legacy/lib/` —
    that directory does not exist on this branch (`refactor/booking-v2-migration`), only on
    `origin/main`, and this task does not own `test/helpers/**` where a shared version could live.
    The implementation follows the same extraction pattern LAM-77 established (literal marker
    string, brace-aware-free since every marker here is a single self-contained statement or a
    two-marker span with no nested braces to balance) for consistency, not novelty.
  - Extracted each field's carry-over as the SMALLEST self-contained unit of source (one line for
    12 of the 15 fields) rather than LAM-77's 3 larger sub-blocks, specifically so "one test per
    field" is real: deleting any single carry-over line invalidates exactly that field's marker
    and only that field's tests go red (proven for `ops` and `b2cOverride`; the same
    `extractLine`/`extractBetween` mechanism applies identically to the other 13 fields).
  - For `b2cOverride` and resolved `approval`, the real code is an `else if` branch attached to an
    earlier condition (`bkV2IsB2CBk(editing)` / `_approvalReq`) that lives outside the extracted
    span. Rather than pull in that unrelated earlier condition (and its dependencies —
    `bkV2B2CDiff`, `d._b2cSnap`, etc. for the B2C merge path), the extracted branch is prefixed
    with a `if(false){` stub so it runs standalone and always reaches the `else if`. This
    correctly characterizes "does `b2cOverride`/resolved `approval` carry over for a normal
    (non-B2C-diff / non-freshly-approval-required) edit" — the exact behavior the ticket names —
    without asserting on the separate, out-of-scope B2C-diff-merge or over-capacity-approval logic
    that shares the same `if`/`else`.
  - Kept the mutation-proof (delete → red → restore → green) entirely outside the tracked
    repository: a scratch copy of `allotment_v2.html` in the OS temp/scratchpad directory, pointed
    at via `EDIT_PRESERVE_HTML_PATH`. The task constraints say read `allotment_v2.html` only, never
    edit it — even temporarily-then-restored — so the proof is done against a throwaway copy
    instead, which still exercises the real extraction/execution path against real (mutated)
    source text.
  - Did not build a permanent "mutation self-test" inside the committed suite (e.g. a test that
    programmatically strips each marker from an in-memory copy and asserts extraction throws).
    That would be a reasonable follow-up, but the ticket's ask reads as a one-time proof activity
    ("confirm the suite goes red") to be captured as verification evidence, not a new invariant to
    assert on every CI run — and `assertUnique`'s explicit, field-named error message already
    means any future accidental line deletion in the real file surfaces immediately and
    specifically the next time this suite runs in CI, without a separate meta-test.

- **Known risks:**
  - The extraction relies on exact marker text matching allotment_v2.html verbatim (including
    whitespace/quote style). A future refactor that reformats these lines (e.g. Prettier) without
    changing behavior would make `assertUnique` throw even though nothing is actually broken —
    the same trade-off LAM-77 already accepted for its own markers.
  - `b2cOverride`'s test exercises only the non-B2C carry-over path (the `else` branch). The B2C
    merge/diff branch above it (`bkV2B2CDiff`, `_b2cSnap`) is a related but separate mechanism not
    covered by this suite — flagged as a follow-up below, not silently assumed correct.
  - `test/e2e/booking-write-path.test.mjs` and `test/helpers/db.mjs` fail outright (not skip) when
    run via `node --test <directory>` on this Windows/Node 24 sandbox (`Cannot find module`) —
    pre-existing, unrelated to this change, not fixed here since those paths are owned by LAM-22
    and out of this task's scope.

- **Blockers:** None.

- **Dependencies:**
  - Relies on `allotment_v2/docs/workflows/01-booking-lifecycle.md` §3.2 staying an accurate
    description of the edit-preserve block's line range for anyone orienting themselves in the
    future; the tests themselves depend only on the marker text, not the doc.
  - Builds on the LAM-22 test harness convention (`node:test`, no framework dependency, discovered
    by `.github/workflows/tests.yml`'s existing `node --test` step) — no `package.json` change
    requested or needed.

- **Follow-up work:**
  - Extend `CARRY_OVER_FIELDS` (or add a sibling suite) to cover the B2C merge/diff branch of the
    edit-preserve block (`bkV2IsB2CBk(editing)` true path: `total`, `priceBreakdown`, `priceMode`,
    `manualTotal`, `trips`, `passengers`, `addOns` all get restored from `editing` verbatim for a
    B2C booking) — related to but distinct from the `b2cOverride` list itself, out of this
    ticket's named field list.
  - Consider whether LAM-77's `tests/legacy/edit-preserve.test.mjs` and this suite should be
    reconciled/merged once both branches land on the same target (`refactor/booking-v2-migration`
    vs `main`) — right now they overlap on 12 of 15 fields with different granularity (LAM-77:
    3 grouped tests; this suite: 15×2 fields, one test per field) and this suite adds 3 fields
    LAM-77 doesn't cover (`b2cOverride`, resolved `approval`, decided `focApproval`).

- **Rollback procedure:** Delete `test/regression/edit-preserve/` (and this report/manifest) —
  purely additive test files with no runtime, schema, or server-code dependency; nothing else
  references them. `git rm -r test/regression/edit-preserve docs/development/tasks/LAM-25.md
  .agent-reports/LAM-25.json` on this branch, or simply do not merge the PR.

## Agent handoff

- **Task:** LAM-25
- **Branch:** `agent/LAM-25-edit-preserve-regression`
- **Worktree:** `D:/projects/wt-sprint2b/LAM-25-edit-preserve-regression`
- **HEAD at scaffold:** `e7d28f0487b2b51c621a89b21689bc649f7f980a`
- **Final commit:** `b4b8c0b716d2081ada059dfba6f101366166393b`
- **PR:** [#17](https://github.com/digitalmkt-bbot/LOVE_Andaman_Workspace/pull/17) — `agent/LAM-25-edit-preserve-regression` → `refactor/booking-v2-migration`, OPEN
- **Unrelated changes left untouched:** All of `test/helpers/**`, `test/fixtures/**`,
  `test/unit/**`, `test/e2e/**`, root `package.json`, `allotment_v2/allotment_v2.html`,
  `test/regression/seat-locks/**` (LAM-26, concurrent) — none read-modified beyond a read of
  `allotment_v2.html` and read-only inspection of the existing `test/` tree for conventions.
