# allotment_v2 — Design Principles

The distilled rules behind how this app looks. Written from a full audit of
`allotment_v2/allotment_v2.html` (83,651 lines) captured in six companion docs:

| Doc | Covers |
|---|---|
| [01-foundations.md](01-foundations.md) | Global `:root` tokens, fonts, palette, shape, spacing, component primitives |
| [02-skins-and-themes.md](02-skins-and-themes.md) | The 14 head-stack `<style id="…">` skin blocks + 11 runtime-injected ones |
| [03-booking-and-dashboards.md](03-booking-and-dashboards.md) | Booking v2, Calendar, Dashboard, B2C, Booking Flow, Re-confirm, Doc-Check |
| [04-fleet.md](04-fleet.md) | 17 Fleet views — boats, daily log, assets, maintenance, cost, fuel |
| [05-sales-and-finance.md](05-sales-and-finance.md) | Agents, Rate Types, Contracts, Accounting, Daily PFM, Market Data, Settings |
| [06-pier-ops-and-print.md](06-pier-ops-and-print.md) | Pier/van/check-in views + the entire print, PDF and email output system |

Every claim below is traceable to a line-cited entry in one of those six docs.
Read this file for the *rules*; read the others for the *values*.

---

## 0. The headline finding

**This is not one design system. It is a shared shell hosting ~15 independent
visual languages.**

The app-wide chrome (topbar, sidebar, `.card`, `.btn`, `table`, `.pill`) is one
coherent system. Almost every major view then overrides it with its own scoped
palette, and often its own font. The documented brand accent — Ocean blue
`#1683C7` — reaches far less of the app than the name suggests: it exists only
as a *token override* on the `--coral` family (`softui-ocean-skin`,
`allotment_v2.html:3443`), so any view that hardcodes its accent is untouched
by it. In the entire pier-ops/print slice, Ocean blue appears in exactly one
place (the Dev Log page).

### Divergence map

| Visual language | Accent | Views |
|---|---|---|
| **Global shell / Ocean** | `--ocean #1a6a8a`, re-skinned to `#1683C7` | topbar, sidebar, generic `.card` pages, Accounting, Add-on Services |
| **BuildAxis navy** | `#3A6FF7` on `#1F2A44` | `#view-booking`, `#view-fl-projects` (borrowed) |
| **Cream / lime (Manrope)** | forest + lime | `#view-dashboard` |
| **Fleet pink** | `#E03B7E` / `#FCE5EC` / `#9F1B4F` | 10 Fleet views (dashboard, daily log, boats, maintenance, incident, inventory, consumables, cost, insights, fuel) |
| **Mint-teal ops** | `#0F6E56` | `#view-operation`, `#view-fleetcal`, pier check-in confirm states |
| **Legacy blue** | `#185FA5` | pier ops screens + most print documents |
| **Slate navy** | `#0F172A` / `#16265C` | Pier Office, Attendance, Licenses, Boat Job Board |
| **Finexy** | `#163d2b` + `#9fdb4a` | `#view-dailypfm` |
| **Tailwind indigo** | `#4F46E5` | `#view-trippl` |
| **SaaS indigo/violet** | `#4f46e5`, `#8b5cf6`, `#14b8a6` | `#view-dailyreport` |
| **Vivid orange** | `#ff4c00` (+ IBM Plex Sans Thai) | `#view-costing` |
| **InvestIQ green** | `#00D084` | `#view-b2b-dash` |
| **Market orange + glass** | `#F4762E` | `#view-marketdata` |
| **Sales pink** | `#d44a7f` (`--sb-pink`) | `#view-sales-board`, Team & Markets, Programs |
| **Ops navy** | `#1B2A55` / `#1A2B43` | Staff & Welfare, Pickup Setup, Contract wizard, Rate Type ledger |
| **Lime / zinc** | `#a3e635` | `#view-travelsum` |
| **Excel replica** | `#FFF200`/`#C00000`/`#00B050` | Lunch Order Slip, Sign Sheet (deliberate: reproduces a legacy spreadsheet) |

Treat this table as the first thing to check before touching any page. "Match
the app's style" is not an actionable instruction here — **match *that page's*
style**, or make a deliberate decision to converge it.

---

## 1. Principles the codebase actually follows

These hold across nearly all 15 languages. They are the real design system.

### P1 — Density over decoration
13px body / 1.5 line-height, 12px tables, 10px uppercase labels, 22px page
gutter, 6–9px control padding. This is an operations tool read at a desk by
staff who already know the domain. Whitespace is spent on grouping, never on
"breathing room". Any new screen that looks airy is off-system.

### P2 — Numbers get their own typeface
`'DM Mono', monospace` + `font-variant-numeric:tabular-nums` for **every**
money, count, date, time, hours, PAX and serial value. Body text is DM Sans.
This is the single most consistently obeyed rule in the entire file — it holds
in all 15 languages, in print, and in the pink/mint/indigo sub-brands alike.
Never render a figure that appears in a column in DM Sans.

### P3 — Color is data, not decoration
The semantic triad — green = good/available/paid, amber = caution/fixing/
pending, red = bad/unavailable/overdue — is re-implemented on almost every
page. It survives into print, where the code forces
`-webkit-print-color-adjust:exact` with comments stating outright that the
color on that sheet *is* the data, not decoration. Consequence: **never
recolor a status indicator for aesthetic reasons**, and never assume a printed
sheet can be read in greyscale.

### P4 — Status = tint background + solid dot + dark text
The `.pill` recipe (`allotment_v2.html:1285-1291`): 20px radius, 10px/500 text,
a 4px `::before` dot in the solid hue, background in the ~10%-tint hue, text in
the dark hue. Six variants (green/amber/red/blue/purple/gray). Solid-filled
status chips are not part of the system.

### P5 — Elevation is nearly flat
One workhorse shadow does most of the work:
```css
box-shadow: 0 1px 3px rgba(26,35,50,.07), 0 4px 12px rgba(26,35,50,.04);
```
Borders are a single universal hairline — `1px solid rgba(26,35,50,.09)`. State
is expressed with a **3px colored left border** on list items, not with
elevation. Only modals get real depth (`0 20px 60px rgba(0,0,0,.2)`).

### P6 — Three radii, and they mean something
`6px` = controls (buttons, inputs, chips) · `10px` = containers (cards, panels,
KPI tiles) · `14px` = modals and the "floating" card tier. Pills use `20px`.
Circles (`50%`) are avatars, status dots and code badges only.

### P7 — Interaction timing is 0.12–0.15s
`.15s` for buttons/inputs/nav, `.12s` for list rows and tight chrome, `.3s`
reserved for fill-bar width. There are no entrance animations in the base
layer. Motion signals "this responded", never "this is delightful".

### P8 — Modules are skins, not components
There is **no** global `.tab`, `.tooltip`, or `.modal` system beyond a 420px
default dialog. Each module re-implements tabs, overlays and detail panels
inside its own `#view-*` scope. The `.card` recipe itself is copy-pasted onto
10+ panel classes rather than composed. This is the architecture, for better
and worse: a module's look is self-contained and safe to change in isolation,
at the cost of any change being 15× to roll out.

### P9 — Re-skins are additive, reversible `<style id="…">` blocks
Visual changes ship as a named style block appended before `</head>`, overriding
by specificity rather than editing base CSS. Deleting the block reverts the
look. **Five blocks break this contract** and are not safely deletable —
`topbar-float-skin` (paired with JS state), `sidebar-glass-skin` (needs a named
backup file), `cost-v2-skin` (it *is* the drawer's stylesheet, not an
override), `dash-glass-skin` (also needs its "vivid dx token" reverts),
`md-glass-skin` (blobs/dark mode have no base fallback).

### P10 — Glass is one recipe, tinted per view
```css
background: rgba(255,255,255, .30–.78);
backdrop-filter: blur(12–32px) saturate(1.08–1.8);   /* -webkit- always paired 1:1 */
border: 1px solid rgba(255,255,255, .55–.85);
box-shadow: 0 Npx Mpx rgba(<view-tinted dark>, .08–.20),
            inset 0 1px 0 rgba(255,255,255, .38–.95);
```
The ambient shadow is tinted to match the view's background wash (green on
dashboard, blue on market data, indigo on sidebar) — deliberate, not noise.
**Hard constraint:** `backdrop-filter` creates a stacking context that traps
typeahead dropdowns. `bkv2-nb-glass-skin` documents this in its own comment and
deliberately spares form cards. See the full caution list in
[02-skins-and-themes.md](02-skins-and-themes.md) before putting a dropdown
inside any glass surface.

### P11 — Desktop-first; mobile is a separate, single artifact
There are **no responsive breakpoints in the base CSS at all** — only two
`@media print` rules. The shell is a fixed 52px topbar + 220px sidebar with no
container max-width. All mobile behaviour lives in one block, `la-mobile`
(`allotment_v2.html:3900`). Mobile is a supported target, not a design mode.

### P12 — Print is a distinct design system
15 print documents, and they follow their own rules: **A4 landscape is the
default** (11 of 15), margins 7–14mm, `print-color-adjust:exact` wherever color
carries meaning, and each sheet re-declares its own fonts because it is written
into a fresh `window.open()` document that cannot see the app stylesheet.
Font choice is by document purpose, not by brand: DM Sans + DM Mono for
data-heavy operational sheets, **Sarabun** for Thai government-adjacent forms
(Guide Registration, Staff Attendance), Arial only for the legacy Insurance
list. Several sheets wait on `document.fonts.ready` and image load before
`window.print()` — printing early is a known recurring failure.

### P13 — Email is table-only
Per the comment at `allotment_v2.html:53855`: no `flex`, no `grid`, no
`<style>` — Gmail and Outlook strip all three. Every email layout primitive is
a `<table role="presentation">` with inline `style=""`, including the 4-up KPI
row. Email also uses a deliberately plainer neutral palette than the screen it
mirrors.

---

## 2. Canonical values (build with these)

For a new screen with no reason to diverge, this is the system:

```css
/* type */
font-family:'DM Sans',sans-serif;  font-size:13px;  line-height:1.5;
/* figures */  font-family:'DM Mono',monospace; font-variant-numeric:tabular-nums;
/* label */    font-size:10px; font-weight:600; letter-spacing:.05em;
               text-transform:uppercase; color:var(--ink-soft);
/* hero num */ font-size:42px; font-weight:700; letter-spacing:-1.5px;

/* surface */
.card { background:var(--white); border:1px solid var(--border); border-radius:var(--r);
        padding:16px 18px; box-shadow:var(--shadow); }
/* control */
.btn  { padding:7px 14px; border-radius:var(--r-sm); font-size:12px; font-weight:500;
        border:1px solid; transition:all .15s; }
/* table */
th { font-size:10px; font-weight:600; letter-spacing:.05em; text-transform:uppercase;
     color:var(--ink-soft); padding:7px 10px; border-bottom:1px solid var(--border); }
td { padding:9px 10px; border-bottom:1px solid rgba(26,35,50,.05); }
```

Core tokens (`allotment_v2.html:1200-1216`): `--ocean #1a6a8a` · `--ocean-mid
#2196be` · `--ocean-50 #edf7fc` · `--sand #f5f2ed` (page bg) · `--ink #1a2332`
· `--ink-mid #435870` · `--ink-soft #7a8fa3` (619 uses) · `--border
rgba(26,35,50,.09)` (399 uses) · `--green #2d9a6a` · `--amber #d48a14` ·
`--red #c43a2e` · `--purple #6c5ce7` · `--r-sm 6px` / `--r 10px` / `--r-lg
14px`.

The `42px / weight 700 / letter-spacing -1.5px` hero-number recipe recurs
identically across every Fleet KPI strip — treat it as fixed.

---

## 3. Rules for new work

1. **Identify the page's visual language first** (§0 table). Match it, or
   converge it deliberately — never split the difference.
2. **Ship visual change as a new `<style id="…">` block**, not an edit to base
   CSS. Name it, and make deleting it a clean revert (P9).
3. **Every figure in DM Mono.** No exceptions.
4. **Use `.pill` for status.** If you need a new status color, add a `.pill-*`
   variant rather than an inline badge.
5. **Never hardcode an accent you want re-skinnable.** The Ocean skin only
   reaches the `--coral`/`--fd-coral`/`--aos-coral` token family. A literal hex
   is permanently outside the theming system.
6. **Check the `backdrop-filter` list before adding any dropdown** (P10).
7. **Read sticky offsets from `--topbar` / `--t2-vangroup-top`,** never
   hardcode `52`.
8. **New print sheet:** A4 landscape, own font links, `print-color-adjust:exact`
   if color means anything, and gate `window.print()` on `document.fonts.ready`.
9. **Keep `.view{padding-bottom:64px}`** — it reserves space for the fixed
   `#la-userbadge` / `#la-refresh` chrome (`allotment_v2.html:1256`).
10. **Inside `#view-booking`, `var(--coral)` renders blue.** Don't reason about
    coral by name there.

---

## 4. Known defects and drift (audit findings)

Ranked by how much they'll cost someone later.

| # | Finding | Where |
|---|---|---|
| 1 | **`--coral` silently remapped to blue** inside `#view-booking` by `bkv2-buildaxis-skin` — the same component renders orange elsewhere, blue here | `:3337` |
| 2 | **Semantic triad re-declared per page** with near-identical but non-identical hexes (`#0F6E56`/`#1D9E75` green, `#854F0B`/`#A05A1A`/`#7A4A00` amber, `#A32D2D`/`#E24B4A`/`#C44A36` red) instead of one token source | app-wide |
| 3 | **`SVG_PINK`/`dim` token objects copy-pasted verbatim** into ~10 Fleet render functions — no shared class, so a palette change is a 10-site edit | `:21112, :21899, :22019, :28971, :33331, :34616, :19844` |
| 4 | **`.doc-edit-popup` references undefined `var(--shadow-md)`** — renders with no shadow today | `:1707` |
| 5 | **Dead theme:** `#view-marketdata.md-dark` defines a full dark/orange theme that `renderMarketData()` only ever *removes*, never applies | `:3510-3517` |
| 6 | **Dead per-pier color:** `PO_PIERS[].c` defines distinct colors for panwa/tublamu/ranong, but no code path reads the field — all three piers render identically, differing only in name/initials | `06` §5 |
| 7 | **Status-chip coverage gap:** `cancelled_weather` and `pending_approval` have no `.bkv2-chip` entry; shown via ad-hoc inline badges | `:2544`, `:69235` |
| 8 | **Focus ring hardcoded twice** as `rgba(26,127,160,.1)` / `.15` rather than a `--focus-ring` token — and derived from a hue no longer in the palette | `:1321`, `:1489` |
| 9 | **`--navy #0f1f2e` exists as a token but topbar/sidebar hardcode the hex** | `:1221`, `:1233` |
| 10 | **No `.btn:disabled` and no `.btn-secondary`** in the base layer — every module invents its own | `:1274-1283` |
| 11 | **Two unrelated blues in play:** Ocean `#1683C7` (brand) and legacy `#185FA5` (pier ops + print) — close enough to read as a mistake, far enough to look wrong side by side | `06` §10 |
| 12 | **Eight font families loaded in one request**, only two used by the global layer; the other six back individual module skins | `:726` |
| 13 | **Five skin blocks are not cleanly reversible** despite the convention (P9) | `02` summary table |

**Cheapest high-value fixes:** #4 (one line), #5 and #6 (delete dead code), #7
(two chip entries), #8 (one token). **Highest-leverage structural fix:** #2 +
#3 — promoting the semantic triad and the pink token object to real shared
tokens would make future re-skins tractable without touching any page's layout.

---

## 5. If you converge this later

The audit suggests the realistic path is not "unify all 15 languages" but:

1. Extract the semantic triad + focus ring + pink object into `:root` tokens
   (no visual change, purely mechanical).
2. Widen the Ocean skin's reach by converting hardcoded module accents into a
   per-module `--accent` token, so each page keeps its identity but becomes
   themeable.
3. Promote the three genuinely-shared patterns — `.pill`, the KPI hero number,
   the card recipe — into single definitions the modules consume.
4. Leave the deliberate outliers alone: the Excel-replica print sheets and the
   Thai-government form typography are correct as they are.
