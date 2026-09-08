# 08 · App Shell, Dashboards & Config

> Scope: the single-file app's structural skeleton (head/style/body/script anatomy, boot order, sidebar router, modal/toast/skin conventions) plus the four view-groups that hang off it — Dashboards & Reports, Market/Demand Intelligence, Staff & Team, Config/Dev tools. Code: `allotment_v2.html` unless noted. Line numbers are as of **`094dde1`** and drift; grep the symbol name instead.
> Persistence, boot/load sequencing, and the write path are owned by [07-data-persistence-api.md](./07-data-persistence-api.md) — this doc only describes what the shell does *after* a value is in RAM. Booking-specific rendering is owned by [01-booking-lifecycle.md](./01-booking-lifecycle.md); this doc borrows a few shared utilities from it (`bkV2LocalYMD`, `bkV2ConfirmModal`, the `bkV2Render` sticky-offset rAF) because every other module depends on them.

---

## 1. Anatomy of the single file

The file is not modular in any build-tool sense — it's one `<head>` + one `<body>` with ~15 `<script>`/`<style>` tags, most of them thousands of lines long. A few `<style>`/`<script>` open/close tags reported by a naive grep are **not real top-level tags** — they're literal `<style>...</style>` text inside a JS template string (e.g. the printable-memo HTML built at `:25628-25633`, or the Calendar's `CAL2CSS` template at `:7347`). Verify any boundary you rely on by reading a few lines of context, not just the grep hit.

| Approx. lines | Content |
|---|---|
| 1–4 | `<!DOCTYPE html>`, `<html>`, `<head>`, `<meta charset>` |
| **5–719** | `<script>` — the login + cloud-sync boot IIFE. Storage shim, `/api/me`, `/api/load`, permission model (`LA_NAV`, `LA_AREAS`, `laAllowed`/`laApplyPerms`), user badge, toast (`_laToast`), SSE. Full detail in doc 07 §2; §4 of this doc covers the permission/nav pieces. |
| 720–726 | Google Fonts `<link>` — DM Sans, DM Mono, Inter, Manrope, IBM Plex Sans Thai, Noto Sans Thai, Quicksand, Sarabun (`:726`) |
| 727–1198 | `<style>` — `#view-costing`-scoped design tokens (`ct-*` classes) for the Cost & Break-even page. Sits *before* the global stylesheet even though it's a single-page skin — historical placement, not a convention to copy. |
| **1199–3336** | `<style>` — the base design system: `:root` tokens (`--ocean`, `--ink`, `--sidebar:220px`, `--topbar:52px`, `--r`, `--shadow`…), `.topbar`, `.sidebar`, `.app` layout, `.card`, `.modal`/`.modal-overlay`, buttons, form controls. Every other view's inline styles build on these tokens. |
| 3337–3899 | Ten reversible `<style id="*-skin">` blocks (§10) — ocean-blue re-skin, several glass/liquid treatments, topbar-float, sidebar-glass |
| 3729–3747 | `<script>` — `initGlassSidebar` (paired with `sidebar-glass-skin`) |
| 3900–4126 | `<style id="la-mobile">` — the mobile layer, `@media (max-width:820px)`, hamburger nav, floating topbar tools |
| 4127 | `<script src="…xlsx.full.min.js">` — SheetJS, the only external runtime dependency, loaded for the Market Intelligence `.xls` importer (§7) |
| 4132–4157 | `<header class="topbar">` markup |
| 4158–4184 | `<script>` — mobile nav toggles (`toggleTopbarTools`, `laNavOpen/Close/Toggle`, `laUbPlace`) |
| **4187–4492** | `<nav class="sidebar">` — every `.nav-item[data-view]` in the app, grouped into `.nav-section`s (§3/§4) |
| **4493–5546** | The view containers — one `<div id="view-*" class="view">` per module, empty or with a `<div id="*-host">` mount point, in sidebar order. See the table in §6–§9 for which id belongs to which renderer. |
| **5547–13339** | `<script>` — the core render engine: `nav()` (the router), `renderDash`, `renderCal`, `renderDA`, `renderBoats`, sidebar personalization (`laSb*`), `openModal`/`closeModal`, `renderSettings`/`renderSettingsLegacy`, ending in the legacy boot tail (`updateDate();seed();save();initOpListeners();` + deferred `renderDash()` on `DOMContentLoaded`) |
| 13762–36196 | `<script>` — the largest single business-logic block: Agents, Rate Types, most of Booking v2 (`bkV2*`), the start of Fleet (`fl*`), ending in `flLoad()` (fleet store init) |
| 36198–38097 | Fleet modal markup interleaved with a `<script>` of fleet modal logic (engine assign, etc.) |
| **39186–83627** | `<script>` — the remaining ~44k lines: Staff & Welfare (`staff*`), Team & Markets (`tm*`), Market/Demand Intelligence (`md*`), System Log (`devlog*`), Re-confirm, Pier Office, Accounting, and the tail of Booking v2. This is where most of §6–§9 of this doc lives. |
| 83627 | final `</script>` |

**Practical consequence:** "which script tag is this function in" is almost never useful — the file behaves as one global scope regardless of tag boundaries. Always locate code by `grep -n "function xyz"`, never by counting `<script>` tags.

---

## 2. Boot order

Full detail (storage shim, `/api/load`, diff/sync) is doc 07 §2. The parts that matter for the **shell**:

1. Head IIFE runs (`:10`) — login gate, storage shim install, `/api/load`, `/api/v1` resource index. `window.LA_UID` defined first, deliberately before any early return.
2. `onReady(fn)` (`:396`, defined inside the IIFE) — runs immediately if `document.body` already exists, else waits for `DOMContentLoaded`. Used to defer any DOM-touching boot step until the body markup exists.
3. Inside `onReady` (`:397-405`): inject the user-badge `<style>`, mount `#la-userbadge`, mount `#la-viewonly` banner if the user can't edit, then **`laWrapNav()` → `laApplyPerms()` → `laApplyAdminOnly()`**, each re-run again at `setTimeout(...,600)` (safety net for a nav re-render that lost the permission hiding), and **`_laRestoreView` at `setTimeout(...,850)`** — this re-selects whatever view/tab/scroll position was saved to `sessionStorage.la_view` before the last reload (§3).
4. The body markup parses (topbar, sidebar, all `#view-*` containers).
5. Main script block executes top-to-bottom, defining `nav()` and every top-level render function, then at its tail (`:13329-13338`): `updateDate(); seed(); save(); initOpListeners();` and a **deferred** `renderDash()` gated on `DOMContentLoaded` — deliberately deferred because `FL_*` arrays declared in later `<script>` tags aren't populated yet if `renderDash` (indirectly, via other calls) touches them before all inline scripts have run; a bare `setTimeout(0)` can fire between two inline `<script>` tags in Chrome and throw `ReferenceError`, so `DOMContentLoaded` (which only fires after every inline script has executed) is the correct gate.
6. Every remaining `<script>` tag runs in file order, each declaring its own store globals and calling its own boot IIFE / loader (e.g. `flLoad()` at `:36192`) — see doc 07 §5 for the full store inventory.
7. `sidebar-glass-skin`'s `initGlassSidebar` (`:3729-3747`) and this doc's `laSbInit()` (`:6016`, called from inside `nav()` on the first click if the color-picker swatch is missing) attach the sidebar's per-user accordion/color UI.

The net effect: **Dashboard is the default active view** (`#view-dashboard.view.active` and the first `.nav-item.active` are hardcoded in the markup), and `_laRestoreView` (step 3) overrides that ~850ms later if a saved `sessionStorage.la_view` exists and the role permits that view.

---

## 3. Navigation & routing

There is **one router function**: `nav(el)` at `allotment_v2.html:6027`. Every `.nav-item` in the sidebar carries `data-view="<key>"` and `onclick="nav(this)"` — clicking calls `nav` with the clicked DOM element, not a view name.

```js
function nav(el){
  const view = el.dataset.view;
  const actualView = view==='fl-boatstatus' ? 'boats' : view;   // alias: two menu keys, one view+renderer
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('view-'+actualView)?.classList.add('active');
  if(view.startsWith('fl-')) { /* dispatch to flRender* */ }
  else { /* one long if/else-if chain dispatching view → render function */ }
}
```

No view-key → function lookup table exists — it's a **hardcoded if/else-if chain** (`:6053-6095`) mapping `view==='dashboard'` → `renderDash()`, `view==='calendar'` → `renderCal()`, etc. Adding a new view means adding both a `data-view` nav-item, a `#view-<key>` container, and a branch in this chain (or the `fl-` chain if it's a fleet view). Pier-office views (`poa-*`/`pol-*`/`poj-*`/`po-*`) are matched by prefix instead of exact key, because they're parameterized by pier (`panwa`/`tublamu`/`ranong`).

`nav()` also does two pieces of housekeeping before switching:
- `laNavClose()` — closes the mobile drawer (`body.la-nav-open` class) so picking a menu item on mobile auto-dismisses it.
- `laSbInit()` — re-attaches the sidebar color-picker swatch if a prior full re-render of the sidebar dropped it (defensive, checks `!document.getElementById('la-sbcolor-sw')` first).

**Permission gating happens one layer up**, via `laWrapNav()` (`:482`) which monkey-patches `window.nav` once: it checks `laAllowed(view)` before calling the original `nav`, and alerts + returns if the current role can't see that view. `laApplyPerms()` (`:464`) separately hides/shows `.nav-item[data-view]` elements and `.nav-section` headers based on the same permission set — so a role restriction affects both what's clickable *and* what's visible.

```mermaid
flowchart TD
  Click["User clicks a .nav-item\n(onclick=\"nav(this)\")"] --> Wrap{"laWrapNav-wrapped\nnav(el)"}
  Wrap -->|"laAllowed(view) false"| Deny["alert('ไม่มีสิทธิ์') · return"]
  Wrap -->|allowed| Core["original nav(el)"]
  Core --> Close["laNavClose() — close mobile drawer"]
  Core --> Toggle["toggle .active on nav-item + #view-&lt;key&gt;"]
  Core --> Dispatch{"view.startsWith('fl-')?"}
  Dispatch -->|yes| FlChain["fl-prefixed if/else chain\n→ flRenderDashboard / flRenderMaint / …"]
  Dispatch -->|no| MainChain["main if/else chain\n→ renderDash / renderCal / renderBooking / …"]
  FlChain --> Painted["view's render function repaints its #…-wrap / #…-host"]
  MainChain --> Painted
```

**Session-scoped view memory** (not synced, per-tab): `_laSaveView()` (`:278`, inside the head IIFE) snapshots the active nav-item's `data-view`, Booking v2's tab/filter/detail state, the open Agent-detail id, and `main`/`window` scroll into `sessionStorage.la_view` every 3s (`setInterval`, `:357`) and on `beforeunload`. `_laRestoreView()` (`:287`) reads it back, clicks the matching `.nav-item` (re-running the whole `nav()` flow above), restores the booking/agent sub-state, then restores scroll after a 220ms `setTimeout` (long enough for the view's render to finish painting).

---

## 4. Sidebar & layout state

All of these are **localStorage-only, per-device, never synced to Postgres** — explicitly allowed by CLAUDE.md §2's "tiny UI/cache keys" exception.

| Key | Written by | Read by | Purpose |
|---|---|---|---|
| `sb_collapsed` | `setC()` inside `initGlassSidebar` (`:3740-3742`) | same | rail-only collapsed sidebar (`body.sb-collapsed`) |
| `la_sbcolor_<username>` | `laSetSidebarColor()` (`:5955`) | `laApplySidebarColor()` (`:5947`) | per-user active-tab accent color, one of `LA_SB_COLORS` (7 swatches) or cleared (default ocean blue) |
| `la_sbacc_<username>` | `laSbSetCollapsed()` (`:5971`) | `laSbCollapsed()` (`:5970`), `laSbInitAccordion()` (`:5978`) | which `.nav-section` groups are collapsed, keyed by a truncated label of the section's text |
| `la_pogrp` | `poNavGroup()` (`:5990-5997`) / `poNavGroupOpen()` (`:5999`) | `poNavGroupInit()` (`:6005`) | collapsed/expanded state of the three Pier Office sub-groups (`panwa`/`tublamu`/`ranong`), single JSON object `{panwa:0|1, tublamu:0|1, ranong:0|1}` |
| `sessionStorage.la_view` | `_laSaveView()` (§3) | `_laRestoreView()` (§3) | current view + Booking v2 sub-state + scroll, **per-tab**, not `localStorage` |

`laSbUser()` (`:5945`) keys the color/accordion prefs by `LA_ME.username||LA_ME.name` (falls back to `'guest'`), so two users sharing a browser profile each keep their own sidebar look — but this is **per-device**, not per-account across devices.

`poNavGroupInit()` has one deliberate guard: a group whose active child is inside it is never force-collapsed on load, even if the stored state says collapsed (`:6009-6010` — "กลุ่มที่กำลังเปิดอยู่ ห้ามพับ", *the currently-open group must not be collapsed*), so navigating directly into a pier sub-page never hides the very menu you're standing in.

---

## 5. Shared render utilities & conventions

This is the section every other module's developer needs. All five traps below are called out in CLAUDE.md §6; here's the code-level detail.

### 5.1 `esc` / `escapeHTML` is NOT global

There is no single global `esc()`. It's declared **locally, per function**, and its implementation varies slightly between call sites (some also escape `'`, some don't; some are arrow functions, some `function`). A representative instance, inside `renderDevLog` (`:44460`):

```js
function renderDevLog(){
  var esc = function(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
  // esc is NOT global in this app — must be local, or this line throws silently on click
  ...
}
```

**Wrong way** — assume `esc` exists because you saw it used two functions away:
```js
function myNewRenderFn(){
  return `<div>${esc(userInput)}</div>`;   // ReferenceError: esc is not defined — the fn that had it was a different one
}
```

**Right way** — declare your own at the top of any new top-level render function that builds HTML:
```js
function myNewRenderFn(){
  const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  return `<div>${esc(userInput)}</div>`;
}
```
There are 25+ independent `const esc=...` / `function esc(...)` declarations scattered through the file (`grep -n "const esc="` to see them all) — this is intentional repetition, not an oversight to "fix" by hoisting one global.

### 5.2 Date/timezone — `bkV2LocalYMD`

```js
function bkV2LocalYMD(dt){ return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`; }   // allotment_v2.html:71746
```

**Wrong way:** `dt.toISOString().slice(0,10)` — this converts to UTC first. At UTC+7 (Thailand), any local time before 07:00 rolls back to the *previous* calendar day once converted to UTC, silently shifting bookings/dashboards by one day.

**Right way:** `bkV2LocalYMD(dt)` everywhere a `YYYY-MM-DD` string is derived from a `Date` object — it reads `getFullYear/getMonth/getDate`, which are local-timezone accessors. Dashboards use it for date math (`pfmSetDate`, `pfmPeriodRange`) and Market Intelligence uses it via `mdToday()` (`:43100`), which falls back to the UTC-slice form only if `bkV2LocalYMD` isn't loaded yet — a defensive fallback, not a recommended pattern.

### 5.3 Scroll-jump on re-render → surgical update

Replacing a mount's `innerHTML` while the focused/clicked element lives inside it makes the browser scroll the container back to `0`. Two fix patterns recur throughout the shell/dashboard code:

**Pattern A — preserve & restore scroll around a full re-render** (`flSelEng`, `allotment_v2.html:24003-24014`):
```js
function flSelEng(id){
  flSelEngId = id;
  const lp = document.getElementById('fl-eng-listpanel');
  const lt = lp ? lp.scrollTop : 0;
  const wy = window.scrollY || window.pageYOffset || 0;
  if(document.activeElement && document.activeElement.blur) document.activeElement.blur();   // blur first — a focused element fights the scroll restore
  flRenderEngList();
  const _restore = () => { const p=document.getElementById('fl-eng-listpanel'); if(p) p.scrollTop=lt; window.scrollTo(0,wy); };
  _restore();
  requestAnimationFrame(_restore);   // once more after layout settles
}
```

**Pattern B — surgical update of just the changed sub-region**, avoiding the full re-render entirely (`flMaintRefreshParts`, referenced at `:32905`/`:32928` — "surgical update · keeps +Withdraw button alive → no scroll jump"). Extract an inner-render function that only updates one `#...-list`/`#...-body` element instead of the whole page mount.

Contract templates (`:67765`) capture-and-restore a preview box's own scroll before any DOM rebuild, with the comment pointing straight back at this convention: *"เก็บตำแหน่งสกรอลล์ของกล่องพรีวิวไว้ก่อนทุบ DOM (ดู CLAUDE.md §6 'scroll-jump on re-render')"*.

### 5.4 `backdrop-filter` traps typeahead dropdowns

`backdrop-filter` creates a new CSS stacking context. A dropdown positioned `absolute`/`fixed` *inside* an ancestor with `backdrop-filter` gets trapped under later-painted siblings — it renders behind other cards ("ซ้อนกัน", *stacked/overlapping*) instead of on top. The fix, documented inline at `:3656`:

```css
/* form-body cards hold typeahead dropdowns → NO backdrop-filter (it traps the dropdown in a stacking
   context = "ซ้อนกัน"). Translucent bg keeps the glass tint. */
#view-booking .bkv2-nb-sec,
#view-booking .bkv2-nb-card{
  background: linear-gradient(135deg, rgba(255,255,255,.78), rgba(255,255,255,.66)) !important;   /* translucent, no blur */
}
/* topbar + right review panel have no dropdowns → safe to frost */
#view-booking .bkv2-nb-topbar,
#view-booking .bkv2-review-sticky{
  backdrop-filter: blur(20px) saturate(1.35);   /* fine here — nothing inside pops a dropdown */
}
```
**Rule of thumb:** before adding `backdrop-filter` to any card, ask whether anything inside it renders a typeahead/autocomplete dropdown. If yes, use a translucent background gradient instead — same glass look, no trap.

### 5.5 Sticky-header offsets — `--topbar` / `--t2-vangroup-top`

Never hardcode `52` (the topbar's nominal height) for a sticky element's `top`. Two CSS custom properties carry the real, current value:

- `--topbar` — defined on `:root` at `1213` (`52px`), overridden to `0px` by the `topbar-float-skin` block (`:3634`) which removed the visible top bar and floats its controls instead. Any code that assumes `52` breaks the moment that skin is toggled.
- `--t2-vangroup-top` / `--t2-head-top` — computed **at runtime**, not in CSS, inside the `bkV2Render()` rAF (`allotment_v2.html:69240-69250`, Booking v2's tab-2 view):
  ```js
  requestAnimationFrame(() => {
    const TOP = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--topbar')) || 0;
    const vs = host.querySelector('.bkv2-vanstrip');
    const VANGROUP = (vanOn && vs) ? vs.offsetHeight : 0;   // measured, not hardcoded — a fixed 96 gapped/overlapped when real height differed
    vb.style.setProperty('--t2-vangroup-top', (TOP + h) + 'px');
    vb.style.setProperty('--t2-head-top', (TOP + h + VANGROUP) + 'px');
  });
  ```
  Any other view that stacks multiple sticky headers below the topbar should follow the same measure-in-rAF-then-`setProperty` pattern rather than assuming a literal pixel offset — Vehicles' matrix scroll box (`:55891`) and both `.t2-hd`/`.t2-boatpin` sticky rules (`:73006`, `:73093`) consume these vars with a literal fallback (`var(--topbar,52px)`) only for the case the JS hasn't run yet.

### 5.6 Modal system

Two coexisting patterns, both still active:

1. **Static markup + class toggle** — the older, still-dominant pattern. Every modal is pre-baked into the body HTML as `<div class="modal-overlay" id="some-modal"><div class="modal">…</div></div>` (hidden by default via CSS), and:
   ```js
   function openModal(id){ document.getElementById(id).classList.add('open'); }     // :13166
   function closeModal(id){ document.getElementById(id).classList.remove('open'); } // :13167
   document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', e => { if(e.target===m) m.classList.remove('open'); }));  // click-outside-closes, wired once at boot
   ```
   Used everywhere from Boat Status (`status-modal`, `boat-modal`) to every Fleet modal (`fl-modal-*`).
2. **Dynamically created overlay** — newer code (booking v2, dev-log, most confirm dialogs) builds a `.la-modal`/`.la-card` (or a bespoke `<div style="position:fixed;inset:0...">`) with `document.createElement`, appends it to `body`, and removes it on close. The reusable instance of this pattern is `bkV2ConfirmModal(opts)` (`allotment_v2.html:75032`) — despite the `bkV2` prefix it's used app-wide (e.g. `devlogDelete` at `:44457`) as the de-facto standard confirm/cancel dialog: `{title, message, okText, cancelText, danger, onConfirm, onCancel}`, Escape/Enter keyboard support, click-outside-cancels.

`_laBusy()` (doc 07 §2.2) checks for `document.querySelector('.la-modal')` when deciding whether an auto soft-refresh may proceed — so a `.la-modal` dialog left open blocks background refreshes, but a `.modal-overlay` classic modal does **not** (only checked implicitly through the "focus in an input" / "interacted in last 2s" heuristics). Keep that asymmetry in mind if you add a long-lived dialog.

### 5.7 Toast / alert conventions

`_laToast(msg)` (`:456`, inside the head IIFE) is the one shared toast — a bottom-right amber pill, 2.6s auto-dismiss, reused via `window.laGuardEdit()` for permission denials ("👁 ส่วนนี้คุณมีสิทธิ์ดูอย่างเดียว"). Most feature code instead calls the browser's native `alert()`/`confirm()` directly (e.g. every `md*` import-error path, `staffDelete`). Per CLAUDE.md §1, any new `alert()`/`console.log()` text must stay English/ASCII — Thai encoding is known to break in some contexts there, even though Thai is fine in rendered HTML.

---

## 6. Dashboards & reports

### 6.1 Dashboard — `#view-dashboard` / `renderDash()` (`:6271`)
The default landing view. Mounts into `#dash-wrap`. Selected date is `window._dashDate` (defaults to `TODAY_STR`), stepped via `setDashDate(d)`/`resetDashDate()` (`:6107-6115`), each just re-running `renderDash()`.

Aggregation for the selected date (`:6294-6330`):
- Iterates `TRIPS[_ds]` (per-boat trip assignments for that date) to sum capacity (`totAllot`) per available, non-weather-closed boat, splitting **charter** trips (counted directly from `op.booked`) from **seat** trips (routes collected into a `Set`, counted afterward).
- Separately walks `SB_BOOKINGS` for schema-v2 bookings on that date to catch boats/routes assigned purely through a booking (not present in `TRIPS`), adding their capacity too so the card total matches what the seat chart below it shows.
- For every seat-mode route touched, calls `getSeatsConsumed(routeId, date)` (`:12046`) exactly once to get real booked pax — avoids double-counting a route with multiple boats.
- The center card renders a month calendar (`_dashSeatCalHtml`, `:6117`) color-tiered by sell-through percentage using `getAllotment(routeId, date)` (`:12145`) per day, skipping days a route's season/override marks closed (`bkV2IsRouteOpenOn`) and flagging weather-cancelled trips (`bkV2IsWeatherClosed`) separately from "no data".

### 6.2 Calendar — `#view-calendar` / `renderCal()` (`:7330`)
A full-month, per-pier grid (`CAL_PIERS = ['tublamu','panwa','ranong']`), 5-tier color scale identical in spirit to the Dashboard's (`colorFor`/`bgFor`, `:7343-7344`) — INVERTED so **high sell-through = green**, many free seats = amber/red ("aware"). Injects its own scoped `<style>` block (`CAL2CSS`, `:7347`) once per render into the mount, containing a two-pane layout: a fixed left "today" side panel and a scrollable route/day grid.

### 6.3 Daily Availability — `#view-daily` / `renderDA()` (`:8479`)
Produces the "seat availability announcement" staff paste to agents — a formatted Thai text block plus a matching visual card list, grouped by pier then route, for a single selectable date (`daDate`). Uses `buildDAGroups(ds)` to aggregate allotment/booked/locked per route, `freeClass`/`freeColor` for tiering, and treats "full" as `free<=0 || pct>=100` (matches the wording sent to agents, not the looser 95% threshold used elsewhere — CLAUDE.md-style gotcha: don't reuse the generic threshold here without checking this one first).

### 6.4 Boat Status — `#view-boats` / `renderBoats()` (`:8569`)
Also reachable via the Fleet-menu alias `fl-boatstatus` (`nav()` maps both keys to the same `#view-boats` container and this same renderer — §3). Filters `BOATS` by `boatPier`/`boatSt`/`boatLocType` globals, but computes its KPI counts (`availCount`, `fixCount`, `unavCount`, per-pier counts) from **the unfiltered `BOATS`** so the summary numbers never shift when a filter is applied — only the list below does. Splits `companyBoats` vs `charterBoats` by `b.ownership==='charter'`. Per CLAUDE.md §2.1, the 3-tab grouping (Tub Lamu / Visit Panwa / In Shop) is driven by `getBoatCurrentPier(b)` (`:9920`, current physical location, falling back to `b.pier`) combined with `getCurStatus(b, TODAY_STR).s` (`:5879`, the boat's live status from `log[last]`) — a boat with status `fixing` always lands in "In Shop" regardless of its `pier`.

---

## 7. Market / Demand Intelligence

`#view-marketdata` / `renderMarketData()` (`:44807`), mounting into `#md-body`. Backed by `SB_MARKET_STATS` (date-keyed daily immigration counts) and `SB_MARKET_MONTHLY` (older monthly-only totals). If neither has data, shows an empty state pointing at the import button.

### 7.1 The six tabs
A `tabs` array (`:44814`) drives both the tab strip and the dispatch:

| Key | Label | Render fn |
|---|---|---|
| `overview` | Overview | `mdTabOverview(days)` `:43146` |
| `forecast` | ① Forecast | `mdTabForecast(days)` `:43313` |
| `gap` | ② Market Gap | `mdTabGap(days)` `:43329` |
| `season` | ③ Season & Pricing | `mdTabSeason(days)` `:43357` |
| `ops` | ④ Ops & Guides | `mdTabOps(days)` `:43369` |
| `sales` | ⑤ Sales & Agents | `mdTabSales(days)` `:43381` |
| `agents` | ⑥ Agents | `mdTabAgents(days)` `:44054` |

Selection is `_mdTab` (module-level var), switched by `mdSetTab(t)` (`:43099`) which just sets it and re-runs `renderMarketData()`. Overview and Agents render full-width (`max-width:100%`); the other four tabs cap at 1200px. `mdOvInit()` (`:43311`) runs once after Overview paints to draw its interactive chart (`mdOvDraw`), because the chart needs real DOM dimensions that don't exist mid-`innerHTML`-assignment.

### 7.2 The immigration `.xls` import pipeline
Entry point is the file input at `:5125` (`Import .xls` button, accepts `.xls,.xlsx`, `multiple`), wired to `mdImportFiles(this.files)`.

1. **`mdImportFiles(files)`** (`:43018`) — guards that SheetJS (`XLSX`, loaded via the CDN `<script>` at `:4127`) is present, then for each file: `FileReader.readAsArrayBuffer` → `XLSX.read` → `sheet_to_json(sh, {header:1, raw:false, defval:''})` to get a raw array-of-arrays (`aoa`). Calls `mdIngest(aoa, file.name)` per file; once every file has been read, calls `renderMarketData()` once.
2. **`mdDetectDir(aoa, fname)`** (`:42993`) — decides arrivals vs departures: filename containing `IN1` → `'in'`, `OUT1` → `'out'`; otherwise scans the sheet text for the Thai words ขาเข้า (*inbound*) / ขาออก (*outbound*). Returns `null` (import aborts with an alert) if neither matches.
3. **Date extraction** — scans every row for a cell containing ประจำวันที่ (*"for the date of"*) and parses the Thai date via `mdThaiDateToISO(str)` (`:42992`, converts a Buddhist-era `D Month YYYY` string to Gregorian ISO). Import aborts if no date row is found.
4. **Row parsing** (`:42998-43009`) — for each row, finds the official grand-total row (รวม/รวมทั้งสิ้น/ผลรวม) and remembers its number as the authoritative day total; otherwise finds the nationality cell (contains `/` and Thai script), takes the segment after the last `/` as the nationality name, and sums all numeric-looking cells into `data[nat]`.
5. **Write** — `SB_MARKET_STATS[iso][dir] = data`, `SB_MARKET_STATS[iso][dir+'Total'] = grand || sum(data)` (official total wins over the computed sum when present), `SB_MARKET_STATS[iso][dir+'At'] = now`, then `sbMarketStatsPersist()` (`:42974`, the standard read-modify-write persist helper, gated on `laCanEditArea('sales')`).
6. **Nationality reconciliation** — `mdArrivalsByCode()` sums imported arrivals by 2-letter code (via `MD_NAT_TH2CODE`); `mdOurMixByCode()`/`mdBkMix(b)` (`:43046`) distribute each booking's pax across its *actual* passengers' nationalities (not just the lead's) to compare our sales against the immigration data. `mdMissingNat()` (`:43067`) lists bookings the guesser can't resolve at all, surfaced as an actionable card (`mdMissingNatCard`, `:43070`) with a direct "Fix →" link into that booking's detail (`mdOpenBk`, `:43068`, which drives the shell's own `nav()` under the hood). `mdBackfillNat()` (`:43082`) is a one-time, confirm-gated batch fill for existing bookings, keeping any nationality already set.

Deleting one imported day: `mdDeleteDay(iso)` (`:43028`), a plain `delete SB_MARKET_STATS[iso]` + persist, confirm-gated.

---

## 8. Staff & team views

### 8.1 Staff & Welfare — `#view-staff` / `renderStaff()` (`:39508`)
Manages `SB_STAFF` — the employee roster plus an annual free-trip welfare quota. Two tabs (`_staffTab`, `staffSetTab`): **Roster** (editable table — code/name/dept, `staffSetField`), and **Trips report** (`staffTripsReport(yr)`, `:39459`, listing which staff took which welfare trip that year). Quota math is per-year: `staffQuota(id, year)` reads `s.quota[String(year)]`; `staffWelfareUsed(id, year)` (`:39428`) counts consumed seats; `staffRemaining` is the difference, colored red when negative. `staffSetQuota`/`staffSetField`/`staffDelete` all funnel through `sbStaffPersist()` (`:39327`, edit-guarded on the `'sales'` area — Staff & Welfare lives under the Sales permission group per `LA_VIEW_AREA`, not a dedicated HR area).

### 8.2 Team & Markets — `#view-teammkt` / `renderTeamMkt()` (`:78473`)
A single view managing two registries side by side: **Sales people** (`SB_SALES`, persisted by `sbSalesPersist()` `:39564`) and **Markets** (`SB_MARKETS`, persisted by `sbMarketsPersist()` `:39290`). Each row shows a live-computed agent count (`SB_AGENTS.filter(a=>a.sales===s.id)` / `a.market===m.id`) so removing a sales person or market that still has agents attached is visibly risky before you click delete. CRUD via `tmAddSales`/`tmEditSales`/`tmDeleteSales` (`:78538-78554+`) and the market equivalents `tmAddMarket`/`tmEditMarket` (`:78569+`); `tmApplyMarketOrder(ids)` (`:12424`) persists a drag-reordered market list.

---

## 9. Settings & dev tools

### 9.1 Config → Programs — `#view-settings` / `renderSettings()` (`:12437`) vs `renderSettingsLegacy()` (`:12796`)
The view's markup (`:5145-5167`) contains **both** layouts simultaneously: a visible `<div id="prog-pink-wrap">` (empty, JS-filled) and a `display:none` legacy two-column block (`#prog-list-main` + `#prog-detail-content`).

`renderSettings()` is the live implementation — a KPI-strip + pier-grouped program list styled to match the "pink/glass" design language shared with Boat Status. Its **first line** is the split:
```js
function renderSettings(){
  const wrap = document.getElementById('prog-pink-wrap');
  if(!wrap) return renderSettingsLegacy();   // legacy path — fallback to old render if wrap not found
  ...
}
```
Since `#prog-pink-wrap` is always present in the current markup, `renderSettingsLegacy()` is **effectively dead code** under normal operation — it only fires if that specific `<div>` were ever removed from the body markup (e.g. a partial revert of the redesign). It's kept as a safety fallback, not an alternate UI a user can reach. Both call `renderProgDetail()` at the end to paint the selected route's season editor into `#prog-detail-content`/its pink-wrap equivalent. `openRouteModal()` opens the shared add/edit-route dialog (classic `.modal-overlay` pattern, §5.6).

### 9.2 Dev tools — `#view-devlog` / `renderDevLog()` (`:44459`)
"System Log" — an admin-only running to-do/bug/idea list, gated by `devlogIsAdmin()` (`:44449`, `role==='admin'` **or** no `LA_ME` at all — i.e. also open on the degraded localhost path where there's no login). Data is `admin_devlog`, a **JSON-string-in-a-string** top-level scalar in the blob (`devlogLoad`/`devlogSave`, `:44447-44448` — note the double `JSON.stringify`/`JSON.parse`, not a plain array field), so on the write path (doc 07 §3.1) it lands in the `sets` bucket → `app_meta`, not a proper collection table. Entries: `{id, text, tag ('task'|'bug'|'idea'), by, at, done, doneAt, doneBy}`. `devlogAdd`/`devlogToggle`/`devlogDelete` (the last routed through `bkV2ConfirmModal`, §5.6) all read-modify-write the whole array through `devlogSave`. The sidebar nav item (`data-view="devlog"`, `:4388`) carries `data-adminonly="1"`, hidden for non-admins by `laApplyAdminOnly()` independently of the `devlogIsAdmin()` check inside the renderer itself — belt and suspenders.

---

## 10. Visual system

**Fonts:** DM Sans (body text) and DM Mono (numbers/monospace figures), both loaded from Google Fonts alongside Inter, Manrope, IBM Plex Sans Thai, Noto Sans Thai, Quicksand, and Sarabun in one combined `<link>` (`:726`) — different feature areas pick a different display font for their headers/branding (Manrope for the Dashboard, IBM Plex Sans Thai for Costing, Quicksand for the Calendar's big date, etc.) while DM Sans/DM Mono stay the shared defaults (`body{font-family:'DM Sans',...}` `:1217`).

**Ocean-blue skin** — `<style id="softui-ocean-skin">` (`:3443-3469`) recolors the brand accent from the original coral to `#1683C7` by overriding the `--coral`/`--fd-coral`/`--aos-coral` CSS variable families plus a handful of hardcoded topbar/sidebar selectors (soft-UI neumorphic shadows). **To revert:** delete this one `<style>` block — nothing else references it by name, and every consumer reads through the CSS variables it redefines. This is the reference example for the "reversible skin block" convention used throughout the file.

**Full skin-block inventory** (`<style id="*-skin">`, all self-contained and independently deletable):

| id | Line | What it does |
|---|---|---|
| `bkv2-buildaxis-skin` | 3337 | Booking v2 build-axis styling |
| `softui-ocean-skin` | 3443 | brand accent → ocean blue (see above) |
| `md-glass-skin` | 3470 | Market Intelligence glass-card treatment |
| `bkv2-liquid-skin` | 3520 | Booking v2 liquid-glass accents |
| `cal-liquid-skin` | 3546 | Calendar liquid-glass accents |
| `dash-glass-skin` | 3551 | Dashboard glass-card treatment |
| `bop-glass-skin` | 3601 | Boat Operation glass treatment |
| `topbar-float-skin` | 3632 | removes the fixed top bar, floats controls top-right, sets `--topbar:0px` |
| `bkv2-nb-glass-skin` | 3647 | Booking v2 "New Booking" form glass cards (with the backdrop-filter dropdown-trap fix, §5.4) |
| `sidebar-glass-skin` | 3673 | floating rounded-card sidebar |
| `bkv2-cal-filter-skin` | 3748 | Booking v2 calendar filter chips |
| `cost-v2-skin` | 3761 | Costing page v2 styling |
| `bkv2-vc-skin` | 3804 | Booking v2 voucher/contract styling |

`la-mobile` (`:3900`) is a related but different animal — a genuine responsive layer (`@media (max-width:820px)` rules), not a reversible aesthetic skin; don't delete it to "revert" anything.

**Icon convention:** no icon font or Tabler webfont anywhere in the app — every icon is inline `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">...</svg>`, hand-written per usage. This keeps icons themeable via `currentColor`/`stroke` without any extra asset loading, at the cost of duplicated SVG path data across the file.

---

## 11. Invariants & gotchas

- **`nav()` dispatch is a hardcoded if/else chain, not a lookup table.** A new view needs a nav-item + `#view-<key>` container + a new branch in `nav()` (or the `fl-` sub-chain) — nothing auto-wires from the `data-view` attribute.
- **`esc` is local, always.** Any new top-level HTML-building function needs its own `const esc=...` at the top or it throws on first click, silently, into the console. See §5.1.
- **Never `toISOString().slice(0,10)`** for a date derived from a `Date` object — use `bkV2LocalYMD`. UTC+7 makes this a silent one-day-off bug for anything before 07:00 local. See §5.2.
- **`backdrop-filter` on a card containing a typeahead dropdown traps the dropdown behind other content.** Check what's inside before adding it. See §5.4.
- **Sticky offsets must read `--topbar`/`--t2-vangroup-top`, never a literal `52`.** The `topbar-float-skin` re-skin already zeroes `--topbar`, and `--t2-vangroup-top` is measured at runtime, not authored. See §5.5.
- **`renderSettingsLegacy()` is dead code under normal operation** — it only runs if `#prog-pink-wrap` is missing from the markup. Don't "fix" bugs by editing it; edit `renderSettings()`.
- **`admin_devlog` is a double-encoded JSON string**, not a real collection — `devlogLoad`/`devlogSave` `JSON.parse`/`JSON.stringify` it a second time on top of the blob's own serialization. A new persisted dev-tool field should probably not copy this shape.
- **Boat Status's KPI counts always read unfiltered `BOATS`**, even while the visible list is filtered by pier/status/location-type — this is intentional (the summary shouldn't shift under a filter), but easy to "fix" into a bug if you don't notice the two separate `boats`/`allCompany` variables.
- **`_laBusy()` only special-cases `.la-modal` dialogs**, not classic `.modal-overlay` ones, when deciding whether a background soft-refresh may proceed. A long-lived classic modal relies on the "input focused" / "interacted in last 2s" heuristics instead.
- **Sidebar/layout prefs are per-device, not per-account.** `la_sbcolor_*`/`la_sbacc_*`/`la_pogrp`/`sb_collapsed` never sync — a user switching machines starts over on sidebar personalization, by design (CLAUDE.md §2's "tiny UI/cache keys" exception).
- **Pier enum reality check:** `CLAUDE.md` marks `ranong` as "Planned", but by `094dde1` the Calendar (`CAL_PIERS`), Settings/Programs (`PIER_INFO`), and the entire Pier-Office nav group (`poa/pol/poj/po-ranong`) already have full first-class `ranong` support in this doc's domain. Verify current enum usage with `[...new Set(d.boats.map(b=>b.pier))]` before assuming which piers are "real" versus planned — the shell code has moved ahead of that note.
- **`devlogIsAdmin()` returns `true` when there's no `LA_ME` at all** — i.e. the degraded localhost-without-`/api` path (doc 07 §2.1) gets full System Log access with no login. Harmless for a dev toy dataset, worth remembering if that path is ever pointed at real data.

---

## 12. Function index

| Function | Line | Purpose |
|---|---|---|
| `nav(el)` | 6027 | The router — toggles `.active`, dispatches to the right `render*()` |
| `laWrapNav()` | 482 | Monkey-patches `window.nav` to enforce `laAllowed()` before dispatch |
| `laApplyPerms()` | 464 | Hides nav-items/sections the current role can't see |
| `laApplyAdminOnly()` | 450 | Hides every `[data-adminonly]` node for non-admins |
| `laAllowed(view)` | 463 | True if the current role's permission set includes this view key |
| `laFullAccess()` | 462 | True if no `ME`, role is admin, or perms array is absent (unrestricted) |
| `laCanEdit()` | 454 | Global "can this user save anything" gate |
| `laCanEditArea(area)` | 455 | Per-section ("sales"/"fleet"/"pier"/…) edit gate, used by every `*Persist()` helper |
| `laExpandPerms(perms)` | 426 | Expands a stored perms array (which may hold group keys) into a Set of view keys |
| `laGuessDept(u)` / `laDeptOf(u)` | 565/573 | Infer a user's department from username if not explicitly set |
| `laAreaBadges(u)` / `laAreaState(u,area)` | 583/575 | Render the per-area access chips in the user-admin UI |
| `_laSaveView()` | 278 | Snapshots current view + booking sub-state + scroll to `sessionStorage.la_view` |
| `_laRestoreView()` | 287 | Restores the above 850ms after boot |
| `onReady(fn)` | 396 | Run now if `document.body` exists, else on `DOMContentLoaded` |
| `laNavOpen/Close/Toggle()` | 4160-4162 | Mobile drawer open/close/toggle (`body.la-nav-open`) |
| `laUbPlace()` | 4167 | Moves the user badge into/out of the sidebar depending on viewport width |
| `toggleTopbarTools()` | 4158 | Toggles the floated topbar tools panel (`.topbar.tools-open`) |
| `laSbUser()` | 5945 | Resolve the current username for keying per-user sidebar prefs |
| `laApplySidebarColor()` | 5947 | Injects a `<style>` overriding `.nav-item.active` background with the user's chosen color |
| `laSetSidebarColor(c)` / `laSbResetColor()` | 5955/5956 | Set/clear `la_sbcolor_<user>` |
| `laSbColorPickerHTML()` / `laSbToggleColorPicker()` | 5957/5963 | Render/toggle the sidebar footer color swatch picker |
| `laSbCollapsed()` / `laSbSetCollapsed(a)` | 5970/5971 | Read/write `la_sbacc_<user>` (collapsed nav-section labels) |
| `laSbToggleSection(sec)` / `laSbInitAccordion()` | 5973/5978 | Collapse/expand a nav-section, attach click handlers once |
| `poNavGroup(el)` / `poNavGroupOpen(g)` / `poNavGroupInit()` | 5990/5999/6005 | Pier-Office sidebar sub-group collapse, open, and boot-time restore |
| `laSbInit()` | 6016 | Attaches accordion + pier-group + color-picker behavior; re-run defensively from `nav()` |
| `openModal(id)` / `closeModal(id)` | 13166/13167 | Classic `.modal-overlay` show/hide via `.open` class |
| `bkV2ConfirmModal(opts)` | 75032 | App-wide dynamic confirm/cancel dialog (despite the `bkV2` prefix) |
| `_laToast(msg)` | 456 | Bottom-right amber toast, 2.6s auto-dismiss |
| `bkV2LocalYMD(dt)` | 71746 | Local-timezone `YYYY-MM-DD` — the timezone-safe date formatter |
| `updateDate()` | 6100 | Paints the topbar date label |
| `refreshData()` | 6097 | `seed(); renderDash();` — manual "↻ Refresh" topbar button |
| `renderDash()` | 6271 | Dashboard renderer |
| `setDashDate(d)` / `resetDashDate()` | 6107/6112 | Change the Dashboard's selected date |
| `_dashSeatCalHtml(dx,F)` | 6117 | Dashboard's month seat-availability calendar widget |
| `renderCal()` | 7330 | Calendar view renderer |
| `renderDA()` | 8479 | Daily Availability (agent announcement text) renderer |
| `_daSortRows` / `daEditRouteName` | (near 8489/8510) | DA row ordering / inline route short-name editing |
| `renderBoats()` | 8569 | Boat Status board renderer (shared by `boats` and `fl-boatstatus` nav keys) |
| `getCurStatus(boat, ds)` | 5879 | Boat's live status (`log[last]`) as of a date |
| `getBoatCurrentPier(b, ds)` | 9920 | Boat's real current physical pier (vs. its home `pier`) |
| `getDayStatus(r, dateStr)` | 11915 | A route's open/closed status for one date (seasons + overrides) |
| `getSeatsConsumed(routeId, dateStr, excludeBkId)` | 12046 | Real booked pax for a seat-mode route/date |
| `getAllotment(routeId, dateStr, excludeBkId)` | 12145 | Full allotment object (capacity/booked/free/locked) for a route/date |
| `renderSettings()` | 12437 | Config → Programs, live implementation |
| `renderSettingsLegacy()` | 12796 | Dead-code fallback, only runs if `#prog-pink-wrap` is missing |
| `renderProgDetail()` | 12851 | Paints the selected route's season editor |
| `openRouteModal(id?)` | (called from 12467/12825/etc.) | Opens the add/edit-route classic modal |
| `renderMarketData()` | 44807 | Market/Demand Intelligence shell — band, tabs, dispatch |
| `mdSetTab(t)` | 43099 | Switch `_mdTab`, re-render |
| `mdImportFiles(files)` | 43018 | `.xls`/`.xlsx` file input handler — reads via SheetJS |
| `mdDetectDir(aoa,fname)` | 42993 | Arrivals vs departures detection |
| `mdIngest(aoa,fname)` | 42994 | Parses one sheet, writes into `SB_MARKET_STATS` |
| `mdThaiDateToISO(str)` | 42992 | Buddhist-era Thai date string → ISO |
| `mdDeleteDay(iso)` | 43028 | Removes one imported day, confirm-gated |
| `mdArrivalsByCode()` | 43033 | Imported arrivals summed by nationality code |
| `mdBkMix(b)` / `mdOurMixByCode()` | 43046/43064 | Per-booking / aggregate nationality mix from actual passengers |
| `mdMissingNat()` / `mdMissingNatCard()` | 43067/43070 | Bookings with unresolvable nationality + the actionable UI card |
| `mdBackfillNat()` | 43082 | One-time confirm-gated nationality auto-fill for existing bookings |
| `mdTabOverview/Forecast/Gap/Season/Ops/Sales/Agents(days)` | 43146/43313/43329/43357/43369/43381/44054 | The six tab bodies |
| `sbMarketStatsPersist()` | 42974 | Persist helper for `SB_MARKET_STATS` |
| `renderStaff()` | 39508 | Staff & Welfare renderer |
| `staffQuota(id,year)` / `staffWelfareUsed(id,year)` | 39426/39428 | Per-staff annual welfare quota / consumption |
| `staffSetQuota` / `staffSetField` / `staffDelete` | 39506/39505/39507 | Staff row edits |
| `sbStaffPersist()` | 39327 | Persist helper for `SB_STAFF` |
| `renderTeamMkt()` | 78473 | Team & Markets renderer |
| `tmAddSales/tmEditSales/tmDeleteSales` | 78538/78546/78554 | `SB_SALES` CRUD |
| `tmAddMarket/tmEditMarket` | 78569/78576 | `SB_MARKETS` CRUD |
| `sbSalesPersist()` / `sbMarketsPersist()` | 39564/39290 | Persist helpers for the two registries |
| `tmApplyMarketOrder(ids)` | 12424 | Persist a drag-reordered market list |
| `renderDevLog()` | 44459 | System Log (dev to-do) renderer |
| `devlogLoad()` / `devlogSave(arr)` | 44447/44448 | Read/write the double-JSON-encoded `admin_devlog` blob scalar |
| `devlogIsAdmin()` | 44449 | Gate — admin role, or no `LA_ME` (degraded localhost) |
| `devlogAdd/Toggle/Delete` | 44452/44456/44457 | System Log entry CRUD |

---
