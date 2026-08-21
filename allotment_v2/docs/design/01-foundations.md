# Foundations — allotment_v2 design system

Scope: the two "base" `<style>` blocks and the `<head>` font links that precede
every view-specific skin. Block A is `allotment_v2.html:727-1198` (turns out to
be a fully **`#view-costing`-scoped** stylesheet, not shared foundation — see
note in §2). Block B is `allotment_v2.html:1199-3336` and is where the real
shared design tokens and core component primitives live (`:root`, `body`,
`.card`, `.btn`, `table`, `.modal`, …). Everything below cites exact line
numbers in `allotment_v2/allotment_v2.html` so a claim can be jump-verified.

> Housekeeping note: nothing in these two blocks is dead — later parts of
> Block B are just as real, but they are already **view-scoped** (`#view-agents`,
> `#view-addonsvc`, `.ct-doc-*` contract-wizard, `#view-costing` itself repeated
> inline) rather than shared foundation. Those module skins are out of scope
> for this doc; only the unscoped, reusable rules are catalogued here.

## 1. Font stack

`<head>` link, single Google Fonts request (`allotment_v2.html:726`):

```
https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400
  &family=DM+Mono:wght@400;500
  &family=Inter:wght@400;500;600;700;800
  &family=Manrope:wght@400;500;600;700;800
  &family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700
  &family=Noto+Sans+Thai:wght@300;400;500;600;700;800
  &family=Quicksand:wght@500;600;700
  &family=Sarabun:wght@300;400;500;600;700;800
  &display=swap
```

One `<link>` pulls in 8 families up front; only **DM Sans** and **DM Mono** are
used by the global foundation (Block B). The rest (Inter, Manrope, IBM Plex
Sans Thai, Noto Sans Thai, Quicksand, Sarabun) are pulled for later
**view-scoped skins** (e.g. `#view-agents` forces `Manrope` at
`allotment_v2.html:1965`; `#view-costing` forces `'IBM Plex Sans Thai'` at
`allotment_v2.html:735`). Several print/export surfaces (voucher, pier boards)
re-inject their own `<link>` for Sarabun / Noto Sans Thai at runtime
(`allotment_v2.html:50661`, `50852`, `51202`, `81845`, `83318`, `83632`) so the
printed HTML doesn't depend on the parent document's stylesheet.

- **Body default:** `font-family:'DM Sans',sans-serif` — `allotment_v2.html:1217`.
- **Monospace (numbers):** `'DM Mono',monospace` — applied to `.td-mono`
  (`allotment_v2.html:1316`), `.topbar-date` (`allotment_v2.html:1225`),
  `.op-inp` (`allotment_v2.html:1487`), `.drt-val`/`.gantt-*` and other tabular
  number contexts. Rule of thumb across the file: any money/count/date figure
  that needs column alignment gets DM Mono + `font-variant-numeric:tabular-nums`.
- **Default body type:** `font-size:13px; line-height:1.5` — `allotment_v2.html:1217`.
  No explicit root `letter-spacing` (individual labels set their own, see §6).

## 2. CSS custom properties

### 2.1 The real global `:root` (`allotment_v2.html:1200-1216`)

| Variable | Value | Purpose / where used |
|---|---|---|
| `--ocean` | `#1a6a8a` | Primary brand/accent (dark) — buttons, links, focus rings. 33 uses. |
| `--ocean-mid` | `#2196be` | Accent (interactive/hover) — `.btn-primary:hover`, focus borders, nav active. 18 uses. |
| `--ocean-light` | `#c8eaf5` | Accent tint — hover backgrounds (`.cal-day:hover` border), status ring. 9 uses. |
| `--ocean-50` | `#edf7fc` | Faintest accent tint — selected-row backgrounds (`.boat-item.sel`, `.pill-blue`). 29 uses. |
| `--coral` | `#e05a38` | Secondary/legacy accent color (KPI stripe `.kpi.k-coral`). 22 uses. |
| `--coral-light` | `#fbe8e3` | Coral tint (rarely used directly; 1 use — most coral tints are module-local `--fd-coral-*`). |
| `--sand` | `#f5f2ed` | Page background, hover fills. 68 uses. |
| `--sand-dark` | `#e8e4dc` | Scrollbar thumb, fill-bar track, hairline dividers. 14 uses. |
| `--sand-mid` | `#ede9e3` | Secondary sand tone (used by later module skins mostly). 26 uses. |
| `--ink` | `#1a2332` | Primary text color. 219 uses. |
| `--ink-mid` | `#435870` | Secondary text (labels, sub-text). 24 direct + reused inside many module palettes. |
| `--ink-soft` | `#7a8fa3` | Muted/tertiary text — table headers, hints, meta. 619 uses (the single most-used token in the file). |
| `--white` | `#ffffff` | Card/surface background. 158 uses. |
| `--navy` | `#0f1f2e` | Topbar/sidebar background (also hardcoded as `#0f1f2e` in `.topbar`/`.sidebar` rather than via the var). 21 uses. |
| `--green` | `#2d9a6a` | Success accent — pill, KPI stripe, boat status "available". 43 uses. |
| `--green-light` | `#d8f4e8` | Success tint background. 17 uses. |
| `--green-dark` | `#1a6040` | Success text-on-tint color. 16 uses. |
| `--amber` | `#d48a14` | Warning accent — boat "fixing" status, warn pill. 23 uses. |
| `--amber-light` | `#fef6df` | Warning tint background. 7 uses. |
| `--red` | `#c43a2e` | Danger accent — boat "unavailable", `.btn-danger`, `.pill-red`. 58 uses. |
| `--red-light` | `#fdecea` | Danger tint background. 14 uses. |
| `--purple` | `#6c5ce7` | Info/misc accent (`.pill-purple`, charter-mode tag). 4 uses. |
| `--purple-light` | `#ede9ff` | Info tint background. 2 uses. |
| `--border` | `rgba(26,35,50,0.09)` | Universal 1px hairline border color. 399 uses — the single most common structural token. |
| `--r` | `10px` | Default card/panel radius. 34 uses. |
| `--r-sm` | `6px` | Small radius — buttons, inputs, icon buttons. 127 uses (2nd most-used radius token). |
| `--r-lg` | `14px` | Large radius — modal. 1 direct use (`.modal`) — intentionally reserved for the modal shell. |
| `--sidebar` | `220px` | Sidebar width (`.sidebar`, `.main{margin-left}`). 2 uses. |
| `--topbar` | `52px` | Topbar height, sidebar/app top offset, sticky-header math (`--t2-vangroup-top` per CLAUDE.md gotcha). 4 direct uses in this block; recomputed live via JS rAF elsewhere and re-declared as `:root{--topbar:0px}` at `allotment_v2.html:3634` for print/embed contexts. |
| `--shadow` | `0 1px 3px rgba(26,35,50,.07), 0 4px 12px rgba(26,35,50,.04)` | Default card/panel elevation. 28 uses. |

Note: `--shadow-md` is *referenced* at `allotment_v2.html:1707`
(`.doc-edit-popup{box-shadow:var(--shadow-md)}`) but is **never defined** in
either base block — only a same-named-but-different token `--cp-shadow-md`
exists (`allotment_v2.html:1933`, a different custom property, scoped to the
Agent/Core-Panel palette). This is a latent CSS bug: `.doc-edit-popup`
currently gets no shadow at all (`var()` falls back to the property's initial
value, `none`) unless some other rule overrides it later in the cascade.

### 2.2 Later `:root` blocks in the same file (context, not core)

Three more `:root{...}` blocks appear after the true global one, each adding a
**module-specific color palette** rather than extending the shared tokens —
worth knowing about so a reader doesn't assume `--ocean`/`--ink`/etc. is the
whole palette:

- `allotment_v2.html:1910` — Sales & Booking shared palette: `--sb-pink`,
  `--sb-pink-light`, `--sb-pink-dark`, `--sb-bg`, plus the "Core Panel" indigo
  set `--cp-accent*`, `--cp-bg/card/border/ink*`, `--cp-green/red/amber*`,
  `--cp-shadow*` — backs Agent Info's older skin and the pink `.btn-pink`
  variant (`allotment_v2.html:2096`).
- `allotment_v2.html:1939` — Agent List "FinDash" palette: `--fd-bg`,
  `--fd-card`, `--fd-line*`, `--fd-ink*`, `--fd-coral*`, `--fd-r`/`--fd-r-md` —
  backs the current `#view-agents` bento redesign exclusively.
- `allotment_v2.html:3444` — a further `:root` (outside this doc's line range,
  belongs to the next style block) for another module skin.

None of these three override the Block-B global tokens; they add new
`--prefix-*` names, so both layers coexist without collision. This is the
same pattern CLAUDE.md's "reversible `<style id=…-skin">` block" convention
describes, just applied at the `:root` level instead of a scoped selector.

### 2.3 What Block A (`#view-costing`, `allotment_v2.html:727-1198`) actually is

Despite being the first `<style>` block after `<head>`, **every single
selector in it is prefixed `#view-costing`** — it is a fully self-contained,
view-scoped design skin (its own near-duplicate palette as local custom
properties: `--b50…--b600` orange/coral scale, `--sd50…--sd400` warm-gray
scale, `--es700…--es950` ink scale, `--mt50/100/500/700` mint/green scale —
all declared *inside* `#view-costing{...}` at `allotment_v2.html:730-734`, not
on `:root`). It contributes nothing to the shared global look and is
documented here only to confirm it is out of scope for "global foundations" —
see the Costing-module design doc (if/when written) for its own palette,
radii (`22px` cards, `12-18px` controls) and shadow recipes.

## 3. Color palette (global, deduplicated)

All hexes that appear more than once in Block B, with semantic role:

| Hex / value | Token | Role |
|---|---|---|
| `#1a6a8a` | `--ocean` | Brand accent — primary buttons, active nav, links |
| `#2196be` | `--ocean-mid` | Accent hover/focus state |
| `#c8eaf5` | `--ocean-light` | Accent border tint (calendar hover, status ring) |
| `#edf7fc` | `--ocean-50` | Accent background tint (selected rows/pills) |
| `#e05a38` | `--coral` | Secondary accent (legacy KPI stripe) |
| `#fbe8e3` | `--coral-light` | Coral tint |
| `#f5f2ed` | `--sand` | Page background |
| `#e8e4dc` | `--sand-dark` | Scrollbar thumb / dividers |
| `#ede9e3` | `--sand-mid` | Secondary neutral surface |
| `#1a2332` | `--ink` | Primary text |
| `#435870` | `--ink-mid` | Secondary text |
| `#7a8fa3` | `--ink-soft` | Muted/meta text, table headers |
| `#ffffff` | `--white` | Card/surface background |
| `#0f1f2e` | `--navy` | Topbar/sidebar background (also hardcoded directly, see below) |
| `#2d9a6a` | `--green` | Success |
| `#d8f4e8` | `--green-light` | Success tint bg |
| `#1a6040` | `--green-dark` | Success text-on-tint |
| `#d48a14` | `--amber` | Warning |
| `#fef6df` | `--amber-light` | Warning tint bg |
| `#c43a2e` | `--red` | Danger |
| `#fdecea` | `--red-light` | Danger tint bg |
| `#6c5ce7` | `--purple` | Info/misc accent |
| `#ede9ff` | `--purple-light` | Info tint bg |
| `rgba(26,35,50,0.09)` | `--border` | Universal hairline border |
| `rgba(26,35,50,.05)` | (inline) | Lighter table-row border (`td`, `allotment_v2.html:1313`) |
| `rgba(26,35,50,.015)` | (inline) | Row hover tint (`tr:hover td`, `allotment_v2.html:1315`) |
| `#f0f8ff` | (inline) | `.cal-day.today` background — one-off, not tokenized |
| `rgba(0,0,0,.45)` | (inline) | Modal overlay scrim (`allotment_v2.html:1328`) |
| `rgba(26,127,160,.1)` / `.15` | (inline) | Focus-ring glow derived from ocean but hand-written as rgba, not `var()` — appears at `allotment_v2.html:1321` (inputs) and `allotment_v2.html:1489` (`.op-inp:focus`) |

Note the repeated pattern: **structural/hairline colors are always tokens**
(`var(--border)`, `var(--ink-soft)`), but **glow/shadow rgba accents are
hand-written per rule** rather than derived from a shared "glow" variable —
e.g. focus rings independently re-declare `rgba(26,127,160,.1)` in at least
two places instead of a `--focus-ring` token. `#0f1f2e` (navy) is also
hardcoded directly on `.topbar`/`.sidebar` backgrounds (`allotment_v2.html:1221`,
`1233`) rather than written as `var(--navy)`, even though the same hex is also
exposed as a variable — a minor inconsistency to know about if re-theming.

## 4. Shape language

**Border-radius** — 3 tokens cover the vast majority of shared chrome:

| Token | Value | Used by |
|---|---|---|
| `--r-sm` | `6px` | buttons, inputs, icon buttons, small pickers, tabs underline area (127 uses) |
| `--r` | `10px` | `.card`, `.kpi`, list/detail panels, most containers (34 uses) |
| `--r-lg` | `14px` | `.modal` only (1 use) |

Beyond the tokens, hardcoded pixel radii recur across Block B (counted
directly, not via var): `14px`×28, `8px`×17, `3px`×17 (fill bars, dots),
`10px`×17, `18px`×16 (pills/chips, `.ag-filter-row`-style), `2px`×15 (bar
segments), `12px`×12, `5px`×11, `4px`×10, `20px`×9 (`.pill`, `.fp` filter
chips), `24px`×3, `11px`×3, `7px`×2, `9px`/`22px`×1. Circular elements (dots,
avatars, status swatches) use `50%`.

**Borders:** effectively one universal weight and color —
`1px solid var(--border)` (`rgba(26,35,50,.09)`) — used on cards, tables,
inputs, list rows. Status-colored 3px left borders mark list-item state
(`.boat-item.st-available/.st-fixing/.st-unavailable` — `allotment_v2.html:1387-1389`,
using `--green`/`--amber`/`--red` directly).

**Box-shadow recipes** (exact strings):

```css
/* default card/panel elevation — the workhorse shadow, token: --shadow */
box-shadow: 0 1px 3px rgba(26,35,50,.07), 0 4px 12px rgba(26,35,50,.04);   /* allotment_v2.html:1216 */

/* modal shell */
box-shadow: 0 20px 60px rgba(0,0,0,.2);                                    /* allotment_v2.html:1330 */

/* input/button focus ring (ocean-tinted) */
box-shadow: 0 0 0 3px rgba(26,127,160,.1);                                 /* allotment_v2.html:1321 */
box-shadow: 0 0 0 2px rgba(26,127,160,.15);                                /* allotment_v2.html:1489, .op-inp:focus */

/* status dot halo (timeline) */
box-shadow: 0 0 0 2px var(--green-light) / var(--amber-light) / var(--red-light);  /* allotment_v2.html:1428-1430 */

/* portal dropdown */
box-shadow: 0 8px 24px rgba(0,0,0,.15);                                    /* allotment_v2.html:1503 */

/* hover elevation on calendar day cell */
box-shadow: 0 2px 8px rgba(10,79,110,.1);                                  /* allotment_v2.html:1348 */
```

**Transitions:** almost everything interactive uses one of three timings —
`.15s` (default, most hover/focus states — buttons, nav items, inputs),
`.12s` (list rows, icon buttons, tighter chrome), `.1s`/`.2s` (a handful of
one-offs: `.route-row-item` border, `.po-gch` chevron rotate). Property is
usually `all`, occasionally scoped to `border-color`, `background`,
`transform`, `opacity`, or `width` (fill bars: `transition:width .3s` at
`allotment_v2.html:1307`). No named `@keyframes` animation exists in either
base block.

## 5. Spacing / layout

- **Topbar:** `height:52px` (`--topbar`), fixed, full-width, `padding:0 18px`,
  background `#0f1f2e` — `allotment_v2.html:1221`.
- **Sidebar:** `width:220px` (`--sidebar`), fixed, `top:var(--topbar)`,
  `padding:10px 8px`, background `#0f1f2e` — `allotment_v2.html:1233`.
- **App shell:** `.app{display:flex;margin-top:var(--topbar);min-height:calc(100vh - var(--topbar))}`
  — `allotment_v2.html:1230`.
- **Main content:** `.main{margin-left:var(--sidebar);flex:1;padding:22px;min-width:0}`
  — `allotment_v2.html:1251`. Every view gets a flat `22px` page gutter; note the
  `.view{padding-bottom:64px}` addition (`allotment_v2.html:1259`) reserved so
  the fixed-position `#la-userbadge`/`#la-viewonly`/`#la-refresh` chrome never
  overlaps a table's last row (a documented, deliberate gotcha — see the
  `§laBadgeGap` comment at `allotment_v2.html:1256-1258`).
- **Card/panel padding:** `.card{padding:16px 18px}` (`allotment_v2.html:1267`);
  `.kpi{padding:14px 16px}` (`allotment_v2.html:1295`); `.modal-body{padding:16px 18px}`
  (`allotment_v2.html:1332`); `.modal-hd{padding:14px 18px 12px}`
  (`allotment_v2.html:1331`); `.modal-footer{padding:12px 18px}`
  (`allotment_v2.html:1333`).
- **Grid helpers:** `.g2` (2-col, `gap:14px`), `.g3` (3-col, `gap:14px`), `.g4`
  (4-col `repeat(4,1fr)`, `gap:12px`) — `allotment_v2.html:1269-1271`. Form
  equivalents are tighter: `.form-2`/`.form-3` use `gap:8px`
  (`allotment_v2.html:1324-1325`).
- **Modal max-width:** `420px`, `width:94%`, `max-height:88vh` —
  `allotment_v2.html:1330` (this is a small-dialog default; several later
  module modals override `max-width` locally, e.g. the Contract Doc wizard at
  96%/1400px, `allotment_v2.html:1988`).
- **No page/container max-width** is set anywhere in Block B — layout is
  sidebar+main flex, not a centered max-width container.

## 6. Core component primitives

### Buttons (`allotment_v2.html:1274-1283`)

```css
.btn{display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:var(--r-sm);
  font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;cursor:pointer;
  transition:all .15s;border:1px solid}
.btn svg{width:13px;height:13px}
.btn-primary{background:var(--ocean);border-color:var(--ocean);color:#fff}
.btn-primary:hover{background:var(--ocean-mid)}
.btn-ghost{background:transparent;border-color:var(--border);color:var(--ink-mid)}
.btn-ghost:hover{background:var(--sand)}
.btn-sm{padding:5px 10px;font-size:11px}
.btn-danger{background:transparent;border-color:var(--red-light);color:var(--red)}
.btn-danger:hover{background:var(--red-light)}
```

Plus a global `.btn-pink` variant (`background:var(--sb-pink)`,
hover `var(--sb-pink-dark)`) at `allotment_v2.html:2096-2097`, and `.btn-xs`
(`font-size:10px;padding:2px 8px;border-radius:5px`,
`allotment_v2.html:1441`) for inline timeline/table actions, with a `.del`
modifier (`color:var(--red)`, hover `background:var(--red-light)`). There is
no base `.btn:disabled` rule and no `.btn-secondary`.

### Cards (`allotment_v2.html:1267-1268`)

```css
.card{background:var(--white);border:1px solid var(--border);border-radius:var(--r);
  padding:16px 18px;box-shadow:var(--shadow)}
.card-title{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-soft);margin-bottom:12px}
```

The same recipe (`var(--white)` / `var(--border)` / `var(--r)` /
`var(--shadow)`) is repeated verbatim on 10+ panel classes rather than
composed from `.card` (`.cal-detail`, `.boat-list-panel`, `.boat-detail-panel`,
`.settings-nav`, `.settings-content`, `.da-right`, `.fl-list-col`,
`.fl-detail-col`, `.op-toolbar`, `.matrix-wrap`) — i.e. `.card` is a
convention, not an inherited base class.

### KPI tile (`allotment_v2.html:1295-1303`)

```css
.kpi{background:var(--white);border:1px solid var(--border);border-radius:var(--r);
  padding:14px 16px;position:relative;overflow:hidden;box-shadow:var(--shadow)}
.kpi::after{content:'';position:absolute;top:0;left:0;right:0;height:3px}  /* colored top stripe */
.kpi.k-blue::after{background:var(--ocean-mid)}
.kpi.k-coral::after{background:var(--coral)}
.kpi.k-green::after{background:var(--green)}
.kpi.k-amber::after{background:var(--amber)}
.kpi-lbl{font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-soft)}
.kpi-val{font-size:26px;font-weight:600;color:var(--ink);line-height:1}
.kpi-sub{font-size:11px;color:var(--ink-soft);margin-top:3px}
```

### Tables (`allotment_v2.html:1311-1317`)

```css
table{width:100%;border-collapse:collapse;font-size:12px}
th{text-align:left;font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;
  color:var(--ink-soft);padding:7px 10px;border-bottom:1px solid var(--border)}
td{padding:9px 10px;border-bottom:1px solid rgba(26,35,50,.05);vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(26,35,50,.015)}
.td-mono{font-family:'DM Mono',monospace;font-size:11px}
.td-bold{font-weight:500}
```

`th` uses the full `--border` hairline; `td` rows use a lighter, hand-written
`rgba(26,35,50,.05)` divider — the two are intentionally different weights,
not the same token reused.

### Form inputs (`allotment_v2.html:1320-1325`)

```css
select,input[type=date],input[type=text],input[type=number],input[type=time]{
  font-family:'DM Sans',sans-serif;font-size:12px;padding:6px 9px;border:1px solid var(--border);
  border-radius:var(--r-sm);background:var(--white);color:var(--ink);outline:none;
  transition:border-color .15s}
select:focus,input:focus{border-color:var(--ocean-mid);box-shadow:0 0 0 3px rgba(26,127,160,.1)}
.form-label{font-size:10px;font-weight:500;color:var(--ink-soft);margin-bottom:3px;display:block}
.form-row{margin-bottom:10px}
.form-2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.form-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
```

Note the selector list omits bare `textarea` and `input[type=checkbox|radio]`
— those are styled per-module wherever they appear (e.g. `.ct-vat input`,
`.tm-fld textarea`), not from this shared rule.

### Badges / pills (`allotment_v2.html:1285-1291`)

```css
.pill{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:20px;
  font-size:10px;font-weight:500}
.pill::before{content:'';width:4px;height:4px;border-radius:50%}   /* leading status dot */
.pill-green{background:var(--green-light);color:var(--green-dark)}   .pill-green::before{background:var(--green)}
.pill-amber{background:var(--amber-light);color:#7a4a00}             .pill-amber::before{background:var(--amber)}
.pill-red{background:var(--red-light);color:var(--red)}              .pill-red::before{background:var(--red)}
.pill-blue{background:var(--ocean-50);color:var(--ocean)}            .pill-blue::before{background:var(--ocean-mid)}
.pill-purple{background:var(--purple-light);color:var(--purple)}     .pill-purple::before{background:var(--purple)}
.pill-gray{background:var(--sand-dark);color:var(--ink-soft)}        .pill-gray::before{background:var(--ink-soft)}
```

Six semantic colors, always tint-background + solid-dot + darker/solid text —
a consistent recipe. `.pill-amber` is the one exception that hardcodes its
text color (`#7a4a00`) instead of reusing a token.

### Tabs

There is **no single global `.tab`/`.tabs` class**. Each module defines its
own tab look reusing the same underline convention (`border-bottom:2px solid
transparent`, active state colors border + text with `var(--ocean)` or a
module accent): e.g. `.detail-tab`/`.detail-tab.on`
(`allotment_v2.html:219-220`, boat detail panel — active color `var(--ocean)`),
`.fl-tab-btn` (fleet), `.sb-tab` (`#view-agents`, active color
`var(--fd-coral)`), `.ct-tab` (`#view-costing`, pill-style active state, not
underline). Any new tab UI should follow the underline+accent-color pattern
of `.detail-tab` for visual consistency with the oldest/most central instance.

### Modals (`allotment_v2.html:1328-1337`)

```css
.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:200;
  align-items:center;justify-content:center}
.modal-overlay.open{display:flex}
.modal{background:var(--white);border-radius:var(--r-lg);max-width:420px;width:94%;
  box-shadow:0 20px 60px rgba(0,0,0,.2);position:relative;max-height:88vh;
  display:flex;flex-direction:column;overflow:hidden}
.modal-hd{padding:14px 18px 12px;border-bottom:1px solid var(--border);
  display:flex;align-items:center;gap:10px;flex-shrink:0}
.modal-body{padding:16px 18px;display:flex;flex-direction:column;gap:10px;overflow-y:auto;flex:1}
.modal-footer{padding:12px 18px;border-top:1px solid var(--border);
  display:flex;gap:7px;justify-content:flex-end;background:var(--sand);flex-shrink:0}
.modal-title{font-size:14px;font-weight:600;color:var(--ink)}
.modal-sub{font-size:11px;color:var(--ink-soft);margin-top:1px}
.modal-close{margin-left:auto;width:28px;height:28px;border-radius:6px;border:none;
  background:var(--sand);cursor:pointer;display:flex;align-items:center;justify-content:center;
  font-size:16px;color:var(--ink-soft);flex-shrink:0}
.modal-close:hover{background:var(--sand-dark)}
```

`z-index:200` for the base modal layer; note `#dd-portal` (dropdown portal,
`allotment_v2.html:1502`) sits at `z-index:99999` and the Contract Doc modal
at `z-index:2100` — z-index is not tokenized/tiered, just picked per feature
to clear whatever else is on screen.

### Tooltips

No `.tooltip` class exists in either base block — there is no shared tooltip
primitive in the global foundation. Any hover-detail UI in the app is built
per-module (e.g. `title=` attributes, or bespoke absolutely-positioned popups
like `.doc-edit-popup`, `allotment_v2.html:1707`).

### Scrollbars (`allotment_v2.html:1904-1906`, repeated verbatim at
`allotment_v2.html:1902-1904` — the rule is declared twice back-to-back in the
file, likely leftover from a merge)

```css
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--sand-dark);border-radius:3px}
```

Thin (5px), transparent track, `--sand-dark` thumb, `3px` radius — applied
globally via the universal `::-webkit-scrollbar` selector (WebKit/Blink only;
no Firefox `scrollbar-color` fallback is declared in either block).

## 7. Responsive breakpoints

**None.** Across both base blocks (`allotment_v2.html:727-3336`) there is no
`max-width`/`min-width` `@media` breakpoint at all — the only two `@media`
rules present are both `@media print` (`allotment_v2.html:1260` — hides the
fixed user-badge/view-only/refresh chrome when printing; `allotment_v2.html:2156`
— the Contract Document wizard's A4 print layout, `@page{size:A4 portrait;
margin:0}` plus a full reset of `.ct-doc-*` for print). The layout (`52px`
topbar + `220px` fixed sidebar + fluid `.main`) is effectively desktop-only in
the foundation layer; any responsive/mobile behavior would have to live in a
module-specific skin, and none of the ones scanned here (`#view-costing`,
`#view-agents`, `#view-addonsvc`, contract-doc) add width-based breakpoints
either — `#view-costing`'s two `@media (max-width:…)` rules
(`allotment_v2.html:1067`, `1173`) only reflow its own internal grid columns,
not the app shell.
