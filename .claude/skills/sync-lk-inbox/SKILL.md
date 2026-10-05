---
name: sync-lk-inbox
description: Pull origin/lk-inbox into the integration/operation-backend refactor branch without losing upstream fixes to functions this branch has moved (bkV2* in 08-app.js -> js/booking/bookingV2*.js, and any later module extraction). Use whenever the user says pull/sync/merge lk-inbox, "the devs pushed again", or before starting refactor work on a module. Also covers registering a newly extracted module in tools/refactor-manifest.json.
---

# Sync lk-inbox into the refactor branch

**Never run a plain `git merge origin/lk-inbox` (or rebase) here.** lk-inbox still edits `bkV2Foo` inside
`js/08-app.js`; this branch moved it to `js/booking/bookingV2Foo.js`. A textual merge either conflicts in
3,000-line hunks or gets resolved to "ours", and then the upstream fix silently never reaches the moved
copy. `tools/sync-upstream.mjs` merges per function instead, driven by `tools/refactor-manifest.json`.

## Steps

1. **Clean tree + right branch.** `git status` must show no tracked changes (WIP-commit if needed — never bare
   `git stash`, the stash stack is shared across worktrees). Branch must be `integration/operation-backend`
   (or a branch off it). Sync small and often — the fewer upstream commits, the fewer conflicts.

2. **Report first.** `npm run sync:upstream` (fetches, touches nothing). Read it to the user in short:
   - *Moved functions changed upstream* — `ported` = auto three-way merged into our file; `(merged with our
     edits)` = we had changed that function too, check the result; `CONFLICT` = hand resolve.
     `OUR FILE MISSING` / `OUR FN NOT FOUND` = manifest is stale (file renamed/rewritten) — fix the manifest
     entry or port by hand from `git diff <from>..origin/lk-inbox`.
   - *New upstream functions -> new files* — each gets a file + `<script>` tag before `js/09-action-board.js`.
     **`LOAD ORDER` warning** = upstream calls it from top-level code in 08-app.js; its tag must move above
     `08-app.js` next to `bookingV2LocalYMD.js` (see the §loadOrder comment in the HTML), else 08-app.js dies
     mid-load and the whole app breaks.
   - *Moved functions deleted upstream* — delete our file + its `<script>` tag + manifest entry, after grepping
     that nothing on our side still calls it (our operation-backend code may).
   - *Other files* — merged in "our space" (renames applied, moved functions cut out). `we deleted, upstream
     edited` is expected for `os-backend/src/mapping/*` (deleted deliberately on this branch) — tell the user,
     don't restore. For `server.js`: it's dead on this branch, merging is fine, don't spend effort on it.
   - *NOT covered by the manifest* — new upstream functions that stay in 08-app.js etc. Only relevant if they
     belong to a module we've already extracted (e.g. `bkUpg*` helpers next to booking) — mention, don't act.

3. **Apply.** `npm run sync:upstream -- --apply`. It starts a real merge (`git merge -s ours --no-commit`),
   writes the computed files, stages the clean ones, leaves conflicted ones unstaged with diff3 markers
   (`<<<<<<< ours:` / `||||||| base` / `=======` / `>>>>>>> upstream`). The manifest gets the new entries.

4. **Resolve** each conflicted file. Typical case: upstream appended code at the spot where we added a line
   (e.g. our `try{ bookingV2LoadFromOpsBackend(); }catch(e){}` at the end of 08-app.js) — keep both, ours last.
   When upstream changed logic that this branch rewired to operation-backend (`laOpsFetch`, `opsId`,
   `LA_LEGACY_UNAVAILABLE` gates), keep our wiring and port the upstream behaviour into it — ask the user if the
   two genuinely contradict.

5. **Verify before committing.**
   - `git grep -n "^<<<<<<< ours:\|^>>>>>>> upstream"` → must be empty.
   - `node --check` every touched `.js`: `git diff --cached --name-only HEAD -- '*.js' | xargs -n1 node --check`.
   - `git grep -nP "(?<![\w$])bkV2" -- 'allotment_v2/*.js' 'allotment_v2/*.html'` → must be empty (README prose is fine).
   - `npm run build:try` — the deploy build bundles `js/booking/*.js`; it must succeed.
   - `?v=` hashes: no hand bump needed on this branch — `tools/build-assets.mjs` re-stamps them at deploy.
     The tool keeps our values on merge so they never conflict.

6. **Commit** (it's a merge commit, both parents already recorded):
   `Merge origin/lk-inbox (<N> commits) via tools/sync-upstream.mjs` + a body listing ported functions,
   new files, and how each conflict was resolved. Push only if the user asks.

Abort at any point: the tool prints the exact command (`git merge --abort && git checkout HEAD -- <conflicted>`
— `merge --abort` alone leaves unstaged conflicted files behind).

## Registering a newly extracted module

When refactor work moves another family out of a monolith file (e.g. agents → `js/agents/`), add it to
`tools/refactor-manifest.json` **in the same commit** as the extraction, or the next sync will treat the move as
"we deleted it" and lose upstream fixes:

- `functions`: one entry per moved function, keyed by its **upstream** name:
  `"sbAgentSave": "allotment_v2/js/agents/sbAgentSave.js"`, or
  `{"file": "...", "name": "ourNewName"}` if it was renamed beyond `renames`.
- `patterns`: `{"match": "^sbAgent", "dir": "allotment_v2/js/agents", "insertBefore": "js/09-action-board.js"}`
  so new upstream functions of that family land in the module too.
- `renames`: only for a mechanical identifier-prefix rename applied across the whole codebase (like `bkV2` →
  `bookingV2`); it is applied to every upstream file the sync touches.
- Moved code must be **verbatim** first (rename only), cleanups in a later commit — otherwise upstream diffs
  stop lining up and every port conflicts.
- If a function becomes an ES module export, the tool still finds `export function name` — but anything that is
  no longer a top-level function declaration (class method, object property) won't be found; port those by hand.

After changing the manifest run `node tools/sync-upstream.mjs --selftest` (`--verbose` for the diff): it rebuilds 08-app.js / 04-data-core.js /
the HTML from upstream@merge-base through the transform and diffs against ours. The only differences should be
this branch's deliberate edits (a handful of lines in the .js; the HTML additionally shows our ~630 `js/booking/` script tags, expected). A large .js diff means the manifest or the cut is wrong and sync
results can't be trusted.
