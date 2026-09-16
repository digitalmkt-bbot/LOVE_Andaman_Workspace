# allotment_v2/js — the app's JavaScript

Until 2026-08-27 all of this lived inline in `allotment_v2.html`. It was lifted out **verbatim** —
byte-identical content, same order, no reformatting, no reordering, zero JS changed. The commit that
did it can be verified by concatenating these files back into the script tags and diffing against
`BACKUP/allotment_v2_20260827_pre_js_split.html`.

## Why this is not a refactor

These are **classic scripts, not modules.** `allotment_v2.html` loads them with plain
`<script src="js/NN-name.js"></script>` in the order below — no `defer`, no `async`, no
`type="module"`. That combination is a semantic no-op versus inline blocks:

- top-level `function` declarations still land on `window`, so the ~2,500 inline `onclick=` /
  `onchange=` attributes in the HTML still resolve exactly as before;
- top-level `const` / `let` still share one global lexical environment across all the files, the
  same as they did across the eight inline blocks;
- the parser still blocks on each one in order, so `DOMContentLoaded` still fires after all of them
  (which `04-data-core.js` depends on — see its `_safeRenderDash` comment).

**Do not add `defer`, `async`, or `type="module"` to these tags,** and do not reorder them. Any of
those changes breaks every inline handler in the app. The same reason **Cloudflare Rocket Loader
must stay off** applies here with a larger blast radius: Rocket Loader defers external scripts.

There is still exactly one global scope shared by ~3,100 top-level functions. Splitting the files
bought load performance and editing ergonomics; it did not buy encapsulation. Real modularization is
`MODERNIZATION_BACKLOG.md` B-15. On `main`/`lk-inbox` the strangler rewrite was `platform/`; on
`integration/operation-backend` that's been superseded by a separate repo, `operation_backend` — see
`CLAUDE.md` §0 for the current state of that migration (it's actively in progress, `server.js` no
longer boots on this branch).

## Load order

| # | file | what's in it | pre-split html lines |
|---|---|---|---|
| 1 | `01-auth-sync.js` | login gate, cloud sync, `LA_NAV` permission table | 5–719 |
| 2 | `02-sidebar.js` | glass sidebar init | 3729–3747 |
| 3 | — | `xlsx.full.min.js` from cdnjs (still inline in the HTML) | 4129 |
| 4 | `03-topbar-nav.js` | topbar tools toggle, mobile nav | 4160–4186 |
| 5 | `04-data-core.js` | `DATA + localStorage`, defaults, `save()`, export/auto-restore | 5557–13383 |
| 6 | `05-fleet.js` | `FLEET_VERSION`, `FL_DEFAULT_*`, `flLoad`/`flSave`, fleet UI | 13806–36255 |
| 7 | `06-engine-assign.js` | engine assign / unassign / swap | 36291–38157 |
| 8 | `07-charter.js` | charter modal | 39185–39227 |
| 9 | `08-app.js` | everything else — sales, accounting, vans, ops (booking v2 moved out, see below) | 39246–86154 |
| 10 | `booking/*.js` (532 files) | every `bookingV2*` function (renamed from `bkV2*` 2026-09-16), one file each — see below | n/a, added 2026-09-16 |
| — | `09-action-board.js` | action board | (after `08-app.js`) |

**On `integration/operation-backend` only (2026-09-16):** `08-app.js`'s ~531 `bkV2*` functions plus
one in `04-data-core.js` were renamed to `bookingV2*` and extracted verbatim (AST-based split, not
regex — verified byte-identical non-whitespace content before/after) into individual files under
`allotment_v2/js/booking/<FunctionName>.js`, each its own `<script src>` tag inserted right after
`08-app.js` in `allotment_v2.html`. This is still the same "classic scripts, one global scope"
model — nothing here needed `defer`/`async`/`type="module"`, because a function declaration's
*physical file* doesn't affect when it becomes callable, only load order relative to when something
first calls it (unchanged: everything loads before any user interaction). No `?v=` cache-buster was
added manually — `server.js`'s `_laStampAssets` already stamps every `js/*.js` script tag regardless
of how many there are. The private `_bkV2` state object/namespace (`_bkV2.newBooking`,
`_bkV2T2Cursor`, etc.) was deliberately left unrenamed — it's app state, not a function name, and
renaming it was out of scope.

## Working here

- `node --check allotment_v2/js/<file>.js` — this is now a real per-file syntax check. The old
  ritual of extracting the main `<script>` out of the HTML before checking it is gone.
- `node tools/check-persist-gates.mjs` defaults to this directory.
- `node tools/js-split-linemap.mjs 69054` translates a pre-split `allotment_v2.html` line number
  (as cited throughout `CLAUDE.md`, `docs/workflows/**`, `BACKLOG.md`) into `js/<file>:<line>`.
  Those citations all carry the function name too, so `grep -rn <fnName> allotment_v2/js/` works
  just as well — for a `bkV2*` name from a citation older than 2026-09-16, grep for the renamed
  `bookingV2*` form instead (or drop the `bkV2`/`bookingV2` prefix and grep the rest of the name).
- `server.js` reads `LA_NAV` out of `01-auth-sync.js` at boot (`laSyncPermKeys`) to sync permission
  keys, and pre-compresses every file here at startup (`prewarmStatic`, non-recursive — it does NOT
  descend into `js/booking/`, so those 532 files aren't pre-warmed, only served on first request).
  Renaming a top-level `js/` file means touching both; this doesn't apply to files already under
  `js/booking/`. **On `integration/operation-backend`, `server.js` can't boot at all** (see
  `CLAUDE.md` §0) — none of this runs there until that's resolved.
