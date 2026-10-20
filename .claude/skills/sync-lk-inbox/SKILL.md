---
name: sync-lk-inbox
description: Pull origin/lk-inbox into the integration/operation-backend refactor branch without losing upstream fixes to functions this branch has moved (bkV2* in 08-app.js -> js/booking/bookingV2*.js, and any later module extraction). Use whenever the user says pull/sync/merge lk-inbox, "the devs pushed again", or before starting refactor work on a module. Also checks what each upstream feature needs from operation-backend (this branch has no server.js) against its live swagger, and covers registering a newly extracted module in tools/refactor-manifest.json.
---

# Sync lk-inbox into the refactor branch

**This branch has no `server.js`** (deleted 2026-10-12). Railway runs `static-server.js` (files + `/health`), and
the browser talks only to operation-backend. lk-inbox still builds features on its own backend, so a merged
feature can look fine and still be broken here:
- an `'/api/…'` call is a **404**;
- a write into the localStorage blob (`LS_KEY`, `*Persist()`, `save()`) **never leaves the browser**: the blob
  reached a server only through `/api/save`;
- a read over `SB_BOOKINGS` or an adapter's cache sees **only the dates some view has loaded** (bookings are
  loaded per range, not at boot).

The rule: every upstream feature that needs data gets it from an operation-backend endpoint, wired in
`js/ops/`. Never revive `server.js` or an `/api/*` route, and never paper over a missing endpoint by keeping
data in the blob. A missing endpoint is reported, then built in operation-backend (we own both repos).

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
     edited` is expected for `server.js` and `os-backend/src/mapping/*` (deleted deliberately on this branch):
     they stay deleted, never restore them. What upstream changed in them is covered by *Backend impact*.
   - *NOT covered by the manifest* — new upstream functions that stay in 08-app.js etc. Only relevant if they
     belong to a module we've already extracted (e.g. `bkUpg*` helpers next to booking) — mention, don't act.
   - *Backend impact* — see step 2b.

2b. **Backend impact: what each upstream feature needs from operation-backend.** The report's last section
   lists every new/changed upstream function that calls `/api/*`, writes the blob, reads `SB_BOOKINGS`, is
   wrapped by a `js/ops/` adapter, or newly calls a function an adapter replaced; plus the lk-inbox server
   files and `server.js` routes upstream touched. Endpoint candidates come from the live swagger
   (`<opsBackend>/docs/json`, override with `--ops-spec <url|file>`, skip with `--no-spec`). They are matched
   by name only, so **open each one** before trusting it. For each item:
   - Find what the feature needs. A `server.js` route change means read that handler's diff
     (`git diff <from>..origin/lk-inbox -- server.js`) and find the frontend caller.
   - Check operation-backend for it in two places: the swagger (what is deployed:
     `https://operationbackend-production.up.railway.app/docs`) and the routes on `main`
     (`git -C D:/projects/operation-backend grep -n "'/v1/<thing>" origin/main -- src/routes`). On `main` but
     not in the swagger = a stale deploy (see CLAUDE.md's infra note), not a missing endpoint.
   - Read the adapter before judging a wrapped function. If it calls the original, upstream's change flows
     through; if it replaces it, port the change. If new code calls an adapter-replaced reader, check the
     adapter serves those calls (a per-day cache can't answer a month view).
   - `b2c-map.js` / `b2c-changelog.js` changed = a B2C import rule changed. operation-backend's B2C import
     needs the same rule (CLAUDE.md keeps these files as the reference for porting).
   - Not flagged ≠ fine: the checks are text heuristics. Skim the upstream commit list
     (`git log --oneline <from>..origin/lk-inbox`) for features that store or load data some other way.

   **Report to the user** before applying, one row per feature, not per function:

   | Upstream feature (commit) | Needs | operation-backend | Action |
   |---|---|---|---|
   | e.g. Park tickets month view (bd6384b) | park tickets for a whole month | **MISSING**: only `GET /v1/pier-office/{pier}/park-tickets?date=` (one day) | add a month/range endpoint, then wire `js/ops/32-ops-park.js` |
   | … | … | **EXISTS**: `METHOD /v1/…` (in swagger + main) | wire in `js/ops/…` |

   For the deeper check, run the `lk-inbox-watcher` agent (defined in operation-backend,
   `.claude/agents/lk-inbox-watcher.md`). It reads the upstream diffs and the backend code itself, instead of
   matching text, and returns this same table with a verdict per feature (NONE / EDIT / NEW / ASK). Use its
   table in place of the heuristic list when they disagree.

   Every MISSING row is the list of endpoints to build. Say plainly which merged features won't work here
   until they're built.

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
   new files, how each conflict was resolved, and the MISSING endpoints from step 2b. Push only if the user
   asks: this branch's frontend is production, so a push ships to staff.

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
