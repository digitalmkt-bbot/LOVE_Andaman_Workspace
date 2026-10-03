# LOVE Andaman — Allotment v2 · Engineering Handoff

**For:** whoever (person or AI session) picks up this codebase next.
**Written:** 2026-09-14 · last revised 2026-09-17 · branch `lk-inbox` @ `579768d`
**Scope:** *how to work on this safely*. For what the system **is**, read `README.md` →
`ARCHITECTURE.md` → `allotment_v2/docs/workflows/README.md`. This file does not repeat them.

---

## 1 · The one thing to understand first

This is a **production operations app for a live tour business**. Every screen has someone
standing at a pier or sitting in front of an agent at 07:00 depending on it. There is no staging
tenant, no seed data, no "it's only a UI bug". A wrong number on a printed sheet becomes a boat
that leaves without a passenger, a kitchen that cooks the wrong meal, or a guest with a nut
allergy served cashews.

That single fact drives every rule below.

---

## 2 · Shape of the code

```
allotment_v2/
  allotment_v2.html     3,015 lines · 236 KB · markup + 10 <script src> + 2 <link>
  js/01-auth-sync.js    1,724   auth, sync, SSE, soft-refresh
  js/02-sidebar.js         18
  js/03-topbar-nav.js      48
  js/04-data-core.js    8,944   load/save, blob ↔ server, schemas
  js/05-fleet.js       23,925   fleet, Daily Fleet Log, maintenance, engines
  js/06-engine-assign.js 1,866
  js/07-charter.js         42
  js/08-app.js         63,117   ← booking, pricing, pier, vans, accounting, print
  js/09-action-board.js 1,057
  css/01-base.css       2,705
  css/02-skins.css        852
                      ─────────
                      107,313 lines · 8.0 MB of JS
```

**These are a file split, not modules.** The nine JS files are classic scripts loaded in order and
share **one global scope**, exactly as the old inline `<script>` blocks did.

- ❌ Never add `defer`, `async`, or `type="module"` to a script tag (currently: zero of each).
- ❌ Never reorder the script tags.
- ❌ Never wrap a file in an IIFE or add `export`.
- There are **2,218 inline `onclick=` handlers**. Renaming a global function breaks HTML strings
  that no bundler and no linter will check for you. Grep the string, not just the symbol.

Verification after any JS edit: `node --check <file>`. It catches the only class of error that
silently blanks the whole app (a syntax error in a file that loads before the rest).

---

## 3 · Hard rules (each one was learned by breaking something)

1. **Never delete a `TRIPS` cell — convert it.**
   Deleting removes the whole boat's seats for that day. The release pattern is
   `delete op.charterBookingId; op.type='normal';` — the boat stays, it just stops being chartered.

2. **Filled/typed passenger names must never duplicate across a day.**
   The park register is a government document.

3. **Never invent person names.** Not for tests that touch the register, not as placeholders.
   If a document needs a real name and there isn't one, the answer is "there isn't one".

4. **The park-ticket page may only write `PIER_CFG.parkTypes` / `parkFix` / `parkName`.**
   It must never touch `SB_BOOKINGS`, `TRIPS`, `passengers[]`, `t.pax`, or `t.nat`.

5. **`git` on the mounted drive cannot unlink.** Create and rename work; delete does not.
   After every commit, sweep the leftovers:
   ```bash
   mkdir -p _to_delete/gitlocks
   for f in $(find .git \( -name '*.lock' -o -name 'tmp_obj_*' \)); do
     mv "$f" "_to_delete/gitlocks/$(echo $f|tr '/' '_').$RANDOM"; done
   ```
   The `warning: unable to unlink …` lines during a commit are expected and harmless — the commit
   still lands. **Do not** ask for delete permission; the answer has been no, and the sweep works.

6. **Push happens from GitHub Desktop, by the owner.** `git push` from the shell does not work here.
   Commit, then say how many commits are waiting.

7. **Before writing any file to the device, prove you are not clobbering someone else's work:**
   ```bash
   md5sum <file>            # what's on disk now
   git show HEAD:<file> | md5sum   # what the last commit says
   ```
   If they differ, someone edited outside this session. Stop and reconcile.

---

## 4 · The working method

The method matters more than any individual fix. It is, in order:

### a. Reproduce and **measure** before touching code
Never patch from reading alone. Build a headless test that demonstrates the bug with numbers, on
**real exported data**, through the **real user path** (open the edit form, click save) rather than
by poking objects directly. Several bugs in this repo looked obvious from the source and turned out
to be somewhere else entirely; two were worse than reported and only the measurement showed it.

State the before-number and the after-number in the commit. "Looks better" is not a result.

### b. Patch with an asserting script, not by hand
```python
def rep(old, new, n=1):
    c = s.count(old)
    assert c == n, 'count=%d want %d :: %r' % (c, n, old[:110])
    s = s.replace(old, new)
```
**Gotcha:** these scripts write the file only at the end, so a failed assertion means *nothing was
written*. That is the desired behaviour — a partial patch on a 63k-line file is far worse than no
patch — but don't go hunting for damage that isn't there.

### c. Cache-bust
`/tmp/w/p_cb.py` rewrites `?v=<md5 first 8>` on all **11** `<script>`/`<link>` tags in
`allotment_v2.html`. It is idempotent. **Run it after every JS/CSS change**, or users keep the old
file and report the bug as unfixed.

### d. Regress
Minimum before any deploy:

| test | what it protects |
|---|---|
| `t_smoke.py` | opens all 68 views · must print `พัง 0` |
| `t_vals.py` + diff vs `vals_base_now.json` | 21 value sets across pricing/loads/counts · must be `ต่าง 0` |
| `t_btreg2.py` | boat registry / by-trip tables |

Add the domain test for whatever you touched (`t_pck` pier, `t_na` print sheet, `t_chboat` charter,
`t_allerg` food, `t_mvslip` kitchen slip, `t_lb`/`t_gdord` slot labels, `t_sb` sales board …).

### e. Deploy, then commit
1. `md5sum` vs `git show HEAD` (rule 7)
2. `SendUserFile` → get `file_uuid` → `device_commit_files`
3. `git add` the exact files → commit → sweep git locks → verify disk md5 == HEAD md5

---

## 5 · The test harness

Lives in `/tmp/w` (scratch; rebuild it if the container is new).

- `stub.js` — static server. Env: `LAF` = entry html, `LAP` = port, `LAD` = data json.
  `stub_sync.js` adds real version bumps + SSE for two-device tests.
- `_boot.js` — fetches `/api/load` and populates the core globals.
  **It does not load everything.** `PIER_STAFF`, `PIER_JOB`, `MEAL_VENUES`, `guides`, `go_asn`
  are absent — a test that needs them must fetch and assign them itself (see `t_wklb.py`,
  `t_mvslip.py` for the pattern). A test that silently measures an empty registry will happily
  tell you a feature works.
- Data: the newest `allotment_v2/data_exports/backup_*.json` on the device. Ask the owner to run a
  fresh export when the booking you need is newer than the last backup.

**The stub server dies between runs (exit 144). Always start on a fresh port.** Ports through
**10360** are used. Symptom of forgetting: `ERR_CONNECTION_REFUSED` on the first `page.goto`.
Start servers detached (`( … nohup node stub.js & )`) — a plain `&` in the same command also
returns 144.

### Testing the real boot path (not just `_boot.js`)

`stub.js` returns `/api/load`'s `data` as an **object**, but `01-auth-sync.js` requires a **string**
and silently keeps the seed data when it isn't one. That is the whole reason `_boot.js` exists. When
you need a genuine cold boot — the path a user's F5 takes, where each module's own top-level loader
reads `localStorage` — use a copy of the stub that does `data: JSON.stringify(d)`. Seeding
`localStorage` before navigating does **not** work: the sync XHR at the top of `01-auth-sync.js`
overwrites it with the server blob. localStorage also caps out around 5 MB, so shrink the dataset
rather than fighting the quota.

### The stale-derived-table detector (`§laDerived`)

Worth rebuilding whenever you touch a load path. Two datasets, D2 = D1 with one extra item carrying
a unique marker appended to every registry array. Boot one page against D2 (cold boot = the correct
answer); boot another against D1, then swap `localStorage.getItem` to return D2 for one call and run
`window._laReloadData()`. Snapshot every global that JSON-stringifies to something containing the
marker, on both pages. **Fresh minus reloaded = the tables the reload path forgot to rebuild.** It
found `RT_ADDON_DEFS` with no code reading at all, and the same run proved the cold boot was
*also* wrong.

⚠ When you enumerate globals, `Object.getOwnPropertyNames(window)` is **not enough**: in a classic
script `let` and `const` at top level do not land on `window` (that hides `RT_ADDON_DEFS`,
`SB_ADDON_TYPES`, `ROUTES` …). Grep the sources for top-level declarations and probe each name with
`(0,eval)(name)` inside a try.

Other harness facts worth knowing:
- Google Fonts and cdnjs are **blocked** from the container. Never add a CDN dependency.
- To capture a print sheet, `window.open` must be stubbed with `document.open`, `document.write`
  **and** `document.close` — missing `open` yields an empty capture that looks like a real failure.
- Writing test files: use the `Write` tool. Heredocs have been killed mid-write by a concurrent
  `pkill`, leaving a truncated file that fails in confusing ways.

---

## 6 · Commit convention

```
§tag · one line in Thai, what changed from the user's point of view

"the user's own words, quoted"

ราก · the measured root cause, not the symptom
วัดจริง · before → after with real numbers
แก้ · what was changed and the reasoning for the trade-off
ทดสอบ · which tests ran and what they printed

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_…
```

**`§tags` are the memory of this project.** There are **839 distinct tags** in the source. Every
non-obvious block carries one plus a comment saying *why* it is that way — usually naming the
failure that forced it. Before you "simplify" something odd-looking, grep its tag; the explanation
is almost always right there, and it is usually a real constraint.

When you add a behaviour, add a tag and write the *why*, not the *what*. The what is the diff.

---

## 7 · Traps that have each cost an hour

| Trap | Reality |
|---|---|
| `agEditSave('ratetype', id)` | Takes **no arguments**. Set `_agEditAgentId` / `_agEditSection` / `_agEditDraft`, then call it. |
| `bkOpsWrite` | Doesn't exist. Use `bkOpsFor(b, date)` (read-write) or `bkOpsRead` (read-only, safe in render loops). |
| `pjOf()` return value | Must spread `lb` (`Object.assign({}, o.lb)`) or custom slot labels are wiped by any unrelated save. |
| Sync-stub shows "no change" | The stub already replaced `BLOB` on a previous run. Restart it per run. |
| 19 MB blob in the stub | Blocks `DOMContentLoaded`. Use a subset (`blob_small.json`, 2.5 MB) for sync tests. |
| `/api/load` | Must return `data` as a **JSON string**, not an object. |
| Editing a booking | `bookingV2CommitBooking` rebuilds the record from the form. **Any field the form does not render is at risk.** This single pattern caused `ops.boatId`, `pierAt/pierBy`, and the food note to be lost. When you add a field, check the save path. |
| Adding a pre-built lookup | A table assembled once from a raw array (`PO_KIND` ← `PIER_KINDS`, `RT_ADDON_DEFS` ← `SB_ADDON_TYPES`) goes stale on **both** load paths. Register the rebuild in `laRebuildDerived()` (`§laDerived`) — nowhere else. |
| Which van a booking is on | It is in `ops.vanId` **or** inside `ops.vanSplits`, never both. Read it with `ckGroupVanId(r)`; grouping on `r.vanId` alone silently files the booking under "มาเอง / เอเย่นต์ส่งเอง". |
| A fix that "only" affects the sync path | Check the cold-boot path too. `§poKindStale` looked like a sync bug; the same fault was firing on every page load and crashing 7 of 21 stock-item buttons. Ask "what does F5 do?" before calling it done. |
| `scrollbar-width` in CSS | Its presence makes Chrome/Safari discard the whole `::-webkit-scrollbar` block. Firefox-only, inside `@supports (-moz-appearance:none)`. |

---

## 8 · Deciding what to build

The owner reports in Thai, briefly, usually from a screenshot, usually mid-shift. The report is a
**symptom**, and the stated symptom has more than once been the smaller half of the problem.

- Answer the question that was asked, then say what else the measurement turned up.
- When a fix has a trade-off, name it in one sentence and offer the alternative — e.g. hiding the
  "Not available" box still prints a one-line count, *because the sheet is photographed and argued
  over later and "no box" must not read as "all boats were ready"*.
- Don't migrate the owner's data silently. Surface it, give them a button, let them press it.
- Push back when a request would lose information. That has been accepted every time.

---

## 9 · What not to do

- Don't refactor `08-app.js` into modules. It is 63k lines in one global scope on purpose, and
  2,218 inline handlers depend on it.
- Don't add a build step, a bundler, a framework, or a CDN dependency.
- Don't add dependencies to make a test pass.
- Don't write a fix you haven't measured, and don't report a result you haven't seen printed.
