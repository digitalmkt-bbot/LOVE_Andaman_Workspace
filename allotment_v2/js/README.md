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
`MODERNIZATION_BACKLOG.md` B-15, and the strangler rewrite in `platform/` is the plan of record.

## Load order

| # | file | what's in it | pre-split html lines |
|---|---|---|---|
| 1 | `01-auth-sync.js` | login gate, `/api/me`, cloud sync, `LA_NAV` permission table | 5–719 |
| 2 | `02-sidebar.js` | glass sidebar init | 3729–3747 |
| 3 | — | `xlsx.full.min.js` from cdnjs (still inline in the HTML) | 4129 |
| 4 | `03-topbar-nav.js` | topbar tools toggle, mobile nav | 4160–4186 |
| 5 | `04-data-core.js` | `DATA + localStorage`, defaults, `save()`, export/auto-restore | 5557–13383 |
| 6 | `05-fleet.js` | `FLEET_VERSION`, `FL_DEFAULT_*`, `flLoad`/`flSave`, fleet UI | 13806–36255 |
| 7 | `06-engine-assign.js` | engine assign / unassign / swap | 36291–38157 |
| 8 | `07-charter.js` | charter modal | 39185–39227 |
| 9 | `08-app.js` | everything else — booking v2, sales, accounting, vans, ops | 39246–86154 |

## Working here

- `node --check allotment_v2/js/<file>.js` — this is now a real per-file syntax check. The old
  ritual of extracting the main `<script>` out of the HTML before checking it is gone.
- `node tools/check-persist-gates.mjs` defaults to this directory.
- `node tools/js-split-linemap.mjs 69054` translates a pre-split `allotment_v2.html` line number
  (as cited throughout `CLAUDE.md`, `docs/workflows/**`, `BACKLOG.md`) into `js/<file>:<line>`.
  Those citations all carry the function name too, so `grep -rn <fnName> allotment_v2/js/` works
  just as well.
- `server.js` reads `LA_NAV` out of `01-auth-sync.js` at boot (`laSyncPermKeys`) to sync permission
  keys, and pre-compresses every file here at startup (`prewarmStatic`). Renaming a file means
  touching both.
