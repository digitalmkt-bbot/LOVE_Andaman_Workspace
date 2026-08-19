# LAM-29: Judge and document the three pier revert-to-seed load guards

## Input contract

- **Requested outcome:** `pier_lic_types`, `pier_lic_classes`, and `pier_codes` load with `Array.isArray(x) && x.length` in `_laReloadData` (`allotment_v2/allotment_v2.html`), which reverts a deliberately-cleared list back to seed on soft refresh — breaking the "an empty array stays empty" rule CLAUDE.md documents for `sb_bookings`/`sb_agents`. Judge whether the `.length` guard is intentional, then either drop it at all three sites or comment it as deliberate at all three sites — not a mix.
- **Acceptance criteria:**
  - Investigate before changing anything: does any UI let a user legitimately clear these three lists, is the seed needed for a fresh install, and how do comparable stores (`sb_bookings`, `sb_agents`) load.
  - State the conclusion and reasoning explicitly.
  - Apply exactly one fix, uniformly across all three sites: drop the `.length` guard, or keep it and add a comment explaining why it's deliberate.
  - If the evidence doesn't settle it, implement the safer option (keep behavior, add comments) and record the open question as a follow-up.
  - Every JS change verified with `node --check` on the extracted main `<script>`.
- **Allowed scope:** `allotment_v2/allotment_v2.html` (explicitly approved for this task), `docs/development/tasks/LAM-29.md`, `.agent-reports/LAM-29.json`. No edits to `test/**`, `package.json`, `.github/**`, `tools/**`, `os-backend/**`, `db/**`.
- **Constraints/invariants:** Minimal edits only. LAM-27 is concurrently editing `allotment_v2.html` (cancelled-status constant) — avoid touching unrelated regions. LAM-31 rebases on top of both afterwards.
- **Base branch:** `refactor/booking-v2-migration`
- **Starting assumptions:** `docs/workflows/07-data-persistence-api.md` §10.6 was taken as the authoritative pointer to the three exact call sites (`:41597`, `:41598`, `:41601` at doc-write time).

## Investigation and judgement

**Two independent load/seed mechanisms exist for these three stores, not one:**

1. **Boot loader** (`allotment_v2.html:79683-79736`, top-level IIFEs that run once per full page load/hard reload):
   - `PIER_LIC_TYPES`/`PIER_LIC_CLASSES`/`PIER_CODES` are declared as hardcoded `DEFAULT_*`-style seed data (deck/eng license types, standard license classes, standard attendance codes) — the same pattern as `FL_DEFAULT_ENGINES` etc. described in CLAUDE.md §2 ("back-fill migration pattern").
   - The load IIFE at `:79702`/`:79706` (`if(Array.isArray(d.pier_lic_types)) PIER_LIC_TYPES=d.pier_lic_types;` etc.) has **no** `.length` guard — it loads whatever is persisted, including `[]`.
   - Immediately after, a **separate, unconditional reseed IIFE** runs: `if(PIER_LIC_TYPES.length) return; PIER_LIC_TYPES=[...seed...]` (`:79729` for LIC_TYPES/LIC_CLASSES, `:79712` for PIER_CODES). This means **any full page load/hard reload already reseeds these three stores whenever they're empty**, regardless of why they're empty (fresh install vs. a user having deliberately cleared every row).
2. **Soft-refresh loader** `_laReloadData()` (`:41535` onward, called on every SSE-driven "someone else saved" update, no page reload): this is where the three flagged `.length` guards live (`:41597`, `:41598`, `:41601`). It re-reads localStorage and, only if the *incoming* array is non-empty, overwrites the in-memory copy.

**Comparison with `sb_bookings`/`sb_agents`:** those stores have **no hardcoded default/seed data and no reseed step anywhere** — they simply start as `[]` and load with plain `Array.isArray(x)` in both the boot loader and `_laReloadData`. There is nothing to "revert to" for them, so the CLAUDE.md rule ("an empty array stays empty") is trivially satisfiable. The three pier stores are architecturally different: they carry real default reference data (license types, license classes, attendance codes) and an explicit reseed-when-empty step that fires on every boot, matching the same documented, deliberate `FL_DEFAULT_*` pattern used throughout the fleet module — not the `sb_bookings`/`sb_agents` pattern.

**UI check:** `PIER_CODES` (`poCodeDel`-style filter at `:81743`) and `PIER_LIC_CLASSES` (filter at `:82090`) do have per-row delete actions reachable from the Pier Office UI, so a user could in principle delete every row. `PIER_LIC_TYPES` has no delete UI at all (only an `active` toggle via `plTypeSet`) — its two entries (`deck`/`eng`) are effectively fixed.

**Conclusion:** Because the boot-time reseed IIFEs (`:79712`, `:79729`) already and independently revert an emptied list back to seed on every hard reload, **dropping the `.length` guard in `_laReloadData` alone would not deliver "clear stays cleared" end-to-end** — it would only make behavior *diverge* between a soft refresh (would go/stay empty) and the next hard reload (would still reseed), which is worse than today's consistent-but-wrong-by-CLAUDE.md-rule behavior. Making "clear stays cleared" actually true for these three stores would require also removing/gating the boot-time reseed IIFEs, which is a materially larger, riskier change (touches first-run seeding for a fresh install/empty database) than this ticket's minimal-edit scope, and risks colliding with LAM-27's concurrent edits to the same file.

Given that the three stores already follow the documented `FL_DEFAULT_*` seed-only-when-empty pattern (a deliberate, precedented pattern in this codebase) rather than the `sb_bookings`/`sb_agents` pattern, and that a partial fix would create new inconsistency rather than resolve the underlying issue, this is judged **the safer, evidence-supported case for "keep behavior, document it"**, per the ticket's own fallback instruction. The `.length` guards at the three `_laReloadData` sites are kept unchanged, and each now carries a comment explaining why, plus a pointer to `docs/workflows/07-data-persistence-api.md` §10.6 and this ticket.

**Open question recorded as a follow-up:** whether the boot-time reseed IIFEs (`:79712`, `:79729`) should themselves be changed to distinguish "never-persisted (fresh install)" from "persisted-and-empty (user cleared it)" — e.g. by seeding only when the key is entirely absent from the blob rather than merely `[]` — so that a deliberate clear of `PIER_CODES`/`PIER_LIC_CLASSES` truly stays cleared across both soft refresh and hard reload. Out of scope here; flagged for a dedicated ticket.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| `_laReloadData()` soft refresh of `pier_lic_types`/`pier_lic_classes`/`pier_codes` | Same as after — `.length` guard already present, so a soft refresh ignores an emptied incoming list and keeps the stale in-memory copy | Unchanged behavior; the guard now carries an explanatory comment at all three sites so a future editor doesn't "fix" it into an inconsistency with the boot-time reseed |

No functional/behavioral change was made. This is a documentation-only change (code comments) after investigation concluded the existing behavior is the safer, already-precedented choice.

### Interfaces and contracts

- **Added:** None
- **Changed:** None (comments only, no logic changed)
- **Removed:** None
- **Compatibility notes:** None — zero-diff in executed logic, `git diff` shows only comment text added on the same three lines.

### Files changed

```text
modified	allotment_v2/allotment_v2.html
added	docs/development/tasks/LAM-29.md
added	.agent-reports/LAM-29.json
```

### Data and persistence impact

- **Database/schema:** None
- **API or mapper:** None
- **Migration required:** No
- **Rollback effect on data:** None — no runtime logic changed, comment-only diff

## Verification evidence

| Command/check | Result |
|---|---|
| `git status --short --branch` (session start) | Passed — clean, `## agent/LAM-29-revert-to-seed-stores...origin/refactor/booking-v2-migration`, no pre-existing changes |
| `grep -n "pier_lic_types\|pier_lic_classes\|pier_codes" allotment_v2/allotment_v2.html` | Passed — located all load/persist sites (`:41597`, `:41598`, `:41601` in `_laReloadData`; `:79702-79736` boot loader + reseed IIFEs; `:79756-79758` persist) |
| Extract main `<script>` block and `node --check` on it (post-edit) | Passed — `node --check` exits 0, no syntax errors, 44492 lines extracted from the largest of 8 `<script>` blocks (3,481,858 chars) |
| `git diff --stat` / `git diff --name-status` (post-edit) | Passed — only `allotment_v2/allotment_v2.html` changed, 3 insertions / 3 deletions (comment text appended to 3 existing lines, no other lines touched) |
| `npm test` / any automated test suite | Not run — task scope excludes `test/**`; no test targets this pier-loader comment-only change |
| Live app / browser verification against Postgres | Blocked — no Postgres/prod service reachable from this sandbox, no logged-in Chrome tab available in this isolated worker context |

## Decisions, risks, and rollback

- **Decisions:** Keep the `.length` guard at all three `_laReloadData` sites (`:41597`, `:41598`, `:41601`) unchanged; document why via inline comments rather than removing the guard, because removing it alone would not achieve "clear stays cleared" (the boot-time reseed IIFEs at `:79712`/`:79729` would still revert an emptied list on the next hard reload) and would instead introduce a new soft-refresh-vs-hard-reload inconsistency.
- **Known risks:** None from this change (comment-only). The underlying inconsistency between soft-refresh and hard-reload behavior for these three stores continues to exist as before — it is now documented rather than fixed, per the ticket's explicit fallback instruction for genuinely unsettled evidence.
- **Blockers:** None.
- **Dependencies:** LAM-27 is concurrently editing `allotment_v2.html` (cancelled-status constant) in a different region of the file — no overlap observed with the edited lines (`:41597`-`:41601`). LAM-31 rebases on top of both this and LAM-27 afterwards.
- **Follow-up work:** Open question (see Investigation section) — consider a dedicated ticket to make the boot-time reseed IIFEs for `pier_lic_types`/`pier_lic_classes`/`pier_codes` (`:79712`, `:79729`) distinguish "key absent (fresh install)" from "key present and empty (user cleared it)", so a deliberate clear survives both soft refresh and hard reload consistently, matching the `sb_bookings`/`sb_agents` rule end-to-end.
- **Rollback procedure:** `git revert` the commit on this branch, or manually strip the added comment text back to the original three lines (no logic changes to undo).

## Agent handoff

- **Task:** LAM-29
- **Branch:** `agent/LAM-29-revert-to-seed-stores`
- **Worktree:** `D:/projects/wt-sprint2b/LAM-29-revert-to-seed-stores`
- **HEAD at scaffold:** `e7d28f0487b2b51c621a89b21689bc649f7f980a`
- **Merge base:** `e7d28f0487b2b51c621a89b21689bc649f7f980a` (branch tip equals `origin/refactor/booking-v2-migration` at task start)
- **PR:** Pending (filled in after publish step)
- **Unrelated changes left untouched:** None — no unrelated pre-existing changes were present at task start
