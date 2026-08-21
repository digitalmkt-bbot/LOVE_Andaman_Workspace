# 03 · Design Principles

> **Rebuild spec.** The design system of the LOVE Andaman ops platform, captured from the
> production monolith (`allotment_v2/allotment_v2.html`, ~83k lines) precisely enough to rebuild
> in React without staff noticing a regression.
>
> Source of record: the seven audit docs under `allotment_v2/docs/design/`, `CLAUDE.md` §7–§8,
> `allotment_v2/docs/workflows/08-shell-dashboards-config.md`, and targeted greps of the monolith.
> **Where a doc and the code disagreed, the code won and the disagreement is noted.**

---

## 0. What this is

### 0.1 The document

A specification for the visual and interaction layer of the rewrite. It governs tokens,
components, layout, print output, and the rules that keep those three consistent. It is written
for one reader: the developer or designer who has to build `platform/apps/ops-web` and make it
feel like the thing staff already use.

**Target stack.** React + Vite + TypeScript, consuming the REST API. That framing matters here
and only here:

- Docs 01 and 02 (data model, API) are deliberately **framework-neutral** — they describe
  contracts any client can consume. Nothing in this document changes that.
- This document is the one place a frontend framework is named, and it names one only for the
  frontend. Design tokens ship as CSS custom properties (framework-agnostic by construction);
  the component inventory is expressed as React contracts because React is what will consume it.
- Code here is illustrative. A token file and a handful of prop signatures are in scope. A
  component library implementation is not — that is the build, not the spec.

### 0.2 What it governs

Tokens · typography · color · spacing · shape · elevation · motion · the per-route skin system ·
the component inventory and its states · layout templates · iconography · print and document
output · number, currency and date display · accessibility · the render traps that constrain how
components may be built · migration order · governance.

### 0.3 What it does not govern

Business logic, data shapes, API contracts, permissions, routing keys, or anything about how a
booking is priced. Those live in docs 01, 02 and the workflow docs. It also does not govern the
monolith: the monolith is production and frozen from this document's point of view. This is what
replaces it.

### 0.4 The honest starting position

The audit's headline finding is uncomfortable and important:

> **This is not one design system. It is a shared shell hosting ~15 independent visual languages.**

The app-wide chrome — topbar, sidebar, `.card`, `.btn`, `table`, `.pill` — is one coherent
system. Almost every major view then overrides it with its own scoped palette, and often its own
font. Seventeen distinct visual languages are identifiable (§3.3). Ocean blue `#1683C7`, the
documented brand accent, reaches far less of the app than its name suggests: it exists only as a
*token override* on the `--coral` family, so any view that hardcoded its accent is untouched. In
the entire pier-ops and print slice, Ocean blue appears in exactly one place — the Dev Log page's
"+ Add" button.

That is not a reason to throw the system away. Most of the divergence is decoration; underneath
it, eleven principles hold across all fifteen-plus languages, in print, and in every sub-brand
(§1). Those principles *are* the design system. The rewrite keeps them, keeps the deliberate
per-view identity, and drops the accidental drift.

---

## 1. Design principles

Every principle below is traceable to how the product is actually used. Staff run this all day —
at a desk in the office, on a tablet on a pier in bright sun, under time pressure, entering
numbers that become money. That operational reality, not taste, is why each rule exists.

### P1 — Density over decoration

**Rule.** 13px body at 1.5 line-height. 12px tables. 10px uppercase labels. 22px page gutter.
6–9px control padding. Whitespace groups; it never "breathes".

**Why.** A boat manifest is 40+ rows and a dispatcher needs the whole trip on one screen. Every
row pushed below the fold is a scroll, and a scroll during a departure window is a mistake
waiting to happen. Airy layouts are for products with one number per screen; this product has
two hundred.

**Consequence.** Any new screen that looks generous is off-system. If a design needs more room,
the answer is fewer columns, not more padding.

### P2 — Numbers get their own typeface

**Rule.** `DM Mono` + `font-variant-numeric: tabular-nums` for **every** money, count, date,
time, hours, pax and serial value. Body text is DM Sans. No exceptions on screen.

**Why.** Three reasons, all operational. **Column alignment** — a right-aligned proportional-font
column of prices does not line up digit-for-digit, so scanning for the odd one out fails.
**Digit legibility** — `1`/`7`, `0`/`O`, `5`/`S` are distinguishable in DM Mono at 11px on a
sunlit tablet; in a humanist sans they are not. **Tabular comparison** — capacity vs licence,
booked vs allotment, quoted vs collected are all read as a pair, and a pair only reads as a pair
when the glyph widths match.

**Evidence.** This is the single most consistently obeyed rule in the entire monolith. It holds
in all fifteen visual languages, in print, and in the pink, mint and indigo sub-brands alike.
Two deliberate exceptions exist and both are Thai-script accommodations (§2.1.4).

### P3 — Color is data, not decoration

**Rule.** Green = good / available / paid. Amber = caution / fixing / pending. Red = bad /
unavailable / overdue. Violet = exception / conflict. Gray = inactive / not applicable. Never
recolor a status indicator for aesthetic reasons.

**Why.** The semantic triad survives into print, where the monolith forces
`print-color-adjust: exact` with code comments stating outright that the color on that sheet *is*
the data. A printed van job order handed to a driver is read by color first, text second. If a
red row prints gray, the driver misses the no-show.

**Consequence.** Never assume a printed sheet can be read in greyscale. Never reuse a status hue
for branding. And because color alone is not sufficient (§9.5), status always carries a shape and
a label too.

### P4 — Status = tint background + solid dot + dark text

**Rule.** The pill recipe, unchanged from the monolith: full-round, 10px/500 text, a 4px leading
dot in the solid hue, background in the ~10% tint, text in the dark hue. Six colors. Solid-filled
status chips are not part of the system.

**Why.** A tinted pill sits quietly inside a dense table without shouting; a solid-filled chip
does not, and thirty solid chips in a manifest is a christmas tree. The dot restores the
signal strength the tint gives up — and, critically, the dot is a *second channel* so the pill
does not rely on hue alone.

### P5 — Elevation is nearly flat

**Rule.** One workhorse shadow does most of the work. Borders are a single universal hairline.
State is expressed with a **3px colored left border** on list items, not with elevation. Only
modals, popovers and drawers get real depth.

**Why.** Depth is a scarce signal. If every card floats, nothing reads as "this one is on top of
the page and wants an answer". Reserving real shadow for genuinely-layered surfaces means a
modal is unmistakable even at a glance.

### P6 — Three radii, and they mean something

**Rule.** `6px` = controls. `10px` = containers. `14px` = the floating tier (modals, drawers,
popovers). Three. Full-round (`999px`) is a *shape*, not a fourth step, and belongs to pills and
segmented tracks only. `50%` is avatars, status dots and code badges only.

**Why.** Radius is a grammar for "what kind of thing is this". When a card and a button share a
radius the hierarchy collapses. Three steps is enough to say control / container / floating, and
few enough that nobody has to look it up.

**Note.** The monolith drifted here — module skins introduced 11, 12, 16, 18, 20, 22, 24 and 26px
radii. That drift is the single most visible symptom of the per-page-CSS problem, and the rewrite
does not carry it forward.

### P7 — Motion signals response, never delight

**Rule.** `120ms` for list rows and tight chrome. `150ms` for buttons, inputs, nav. `300ms`
reserved for fill-bar width. No entrance animations in the base layer. Motion is banned outright
in dense tables and anywhere it would delay a keystroke.

**Why.** A pier check-in operator taps forty rows in ninety seconds. A 200ms row-enter animation
is 8 seconds of waiting across that session, and worse, it makes the app feel like it is thinking
when it should feel like it already knew.

### P8 — Figures are always legible

**Rule.** Minimum 11px for any figure that appears in a column. Never below `#31485a`-equivalent
contrast on the panel background. Right-align numerics. Never truncate a number — truncate the
label instead.

**Why.** Bright sun on a pier plus a tablet at half brightness plus a number that becomes an
invoice. A clipped `฿12,4…` is not a smaller problem than a wrong number; it is the same problem.

### P9 — Per-view identity is a feature, centrally governed

**Rule.** A route may set its own accent. It may not set its own type scale, spacing, radii,
shadows or status colors. Skins are four tokens deep (§3.4).

**Why.** The per-view palettes were not an accident — staff navigate partly by color. "The pink
one" means Fleet; "the green one" means Daily PFM. That orientation is worth keeping. What is not
worth keeping is fifteen independent implementations of the same table.

### P10 — Print is a first-class output

**Rule.** Vouchers, van job orders, invoices, manifests and pier documents are products, not
exports. A4 landscape is the default. Color that carries meaning is forced to print. Thai
government-adjacent forms use Sarabun by purpose, not by brand.

**Why.** A large share of this system's output leaves the building on paper. The guide gets a job
sheet, the driver gets a job order, the agent gets a voucher, immigration gets a manifest. If the
print layer is an afterthought the product fails at the exact moment it matters.

### P11 — Bilingual by construction, not by translation

**Rule.** Every surface must survive Thai and English text in the same line, same cell, same
button. Thai carries taller ascenders and stacked vowel/tone marks and needs more line-height and
a larger effective size than Latin at the same nominal px.

**Why.** This is not an i18n nicety — it is the daily reality. A boat name is English, its status
is Thai, and they share a row. The monolith has a code comment recording exactly what happens
when this is ignored: `body` set only `'DM Sans'`, which has no Thai glyphs, so Thai fell through
to the system font — *"different weight, different height than the English on the same line."*

---

## 2. Foundations / tokens

### 2.1 Typography

#### 2.1.1 Families

| Role | Stack | Notes |
|---|---|---|
| Body / UI | `"DM Sans", "Noto Sans Thai", system-ui, -apple-system, "Segoe UI", sans-serif` | The Thai fallback is **mandatory**, not optional — see §2.1.4 |
| Figures | `"DM Mono", "Noto Sans Thai", ui-monospace, "SF Mono", Menlo, Consolas, monospace` | Thai fallback present for the rare mixed cell |
| Thai print forms | `"Sarabun", "DM Sans", sans-serif` | Government-adjacent forms only (§7.4) |

Two families on screen. The monolith loads **eight** in a single Google Fonts request — DM Sans,
DM Mono, Inter, Manrope, IBM Plex Sans Thai, Noto Sans Thai, Quicksand, Sarabun — of which only
two are used by the global layer; the other six back individual module skins. **The rewrite loads
three** (DM Sans, DM Mono, Noto Sans Thai) and adds Sarabun only on print documents that need it.
Dropping Inter, Manrope, Quicksand and IBM Plex Sans Thai is a deliberate loss of per-module
typographic identity, traded for one consistent product and ~400KB less on first paint.

#### 2.1.2 Type scale

Every step is a token. Nothing between steps.

| Token | px | Weight | Line-height | Letter-spacing | Used for |
|---|---|---|---|---|---|
| `--fs-label` | 10 | 600 | 1.4 | `.05em`, uppercase | Table headers, field labels, card titles, KPI labels |
| `--fs-micro` | 11 | 400/500 | 1.45 | 0 | Meta text, sub-values, hints, badge text |
| `--fs-table` | 12 | 400 | 1.45 | 0 | Table cells, buttons, form inputs, chips |
| `--fs-body` | 13 | 400 | 1.5 | 0 | Body default |
| `--fs-body-lg` | 14 | 400/500 | 1.55 | 0 | Modal titles, emphasized body, list item titles |
| `--fs-h3` | 17 | 500 | 1.35 | `-.01em` | Section headings inside a page |
| `--fs-h2` | 20 | 600 | 1.25 | `-.015em` | Page heading (`.page-hd h1`) |
| `--fs-h1` | 24 | 700 | 1.2 | `-.02em` | Dashboard/detail page heading |
| `--fs-kpi` | 26 | 600 | 1 | `-.01em` | KPI tile value |
| `--fs-hero` | 42 | 700 | 1 | `-.035em` | Hero figure — the single big number on a KPI strip |

The `42px / weight 700 / letter-spacing -1.5px` hero recipe recurs *identically* across every
Fleet KPI strip in the monolith. Treat it as fixed; `-1.5px` at 42px is `-.035em`, which is the
form to use so it scales.

#### 2.1.3 Hard rules

1. **Every figure in DM Mono.** Money, counts, dates, times, hours, pax, serials, percentages,
   IDs. If it appears in a column, it is mono. No exceptions on screen.
2. **`font-variant-numeric: tabular-nums`** accompanies mono everywhere. DM Mono is already
   monospaced; the declaration also fixes the fallback path when the webfont has not loaded.
3. **Labels are 10px/600 uppercase with `.05em` tracking.** This is the only place uppercase is
   used. Never uppercase Thai — Thai has no case, and `text-transform: uppercase` on a mixed
   string silently produces a mismatched-looking pair.
4. **Never set a font-size that is not a token.**

#### 2.1.4 Thai script handling — the real constraint

Thai needs different treatment than Latin and this is not cosmetic. Three facts drive the rules:

- **Neither DM Sans nor DM Mono contains Thai glyphs.** If Thai text lands on a stack that names
  only DM Sans, the browser falls back to a system font per-glyph, mid-line. The monolith records
  the result in a code comment at `paCSS()`: *"body sets a font stack of only 'DM Sans', which has
  no Thai letters · Thai falls through to the system font · different weight, different height than
  the English on the same line."* Two different Thai fonts on one screen is the failure mode after
  that, when a second page names a different fallback.
- **Thai glyph height exceeds Latin at the same px.** Thai stacks up to two marks above the base
  glyph and one below (สระ + วรรณยุกต์ above, สระ below). At 13px/1.5 those marks clip against
  the line above.
- **Thai has no case and no word spaces.** Uppercase transforms do nothing useful; line-breaking
  is different; and truncation by character count cuts mid-cluster.

**The rules:**

| # | Rule |
|---|---|
| T1 | Every font stack that can receive Thai names a Thai font explicitly. Both `--font-sans` and `--font-mono` carry `"Noto Sans Thai"` as the second family. This is enforced by the token, never per-component. |
| T2 | **One Thai font in the product.** Noto Sans Thai on screen; Sarabun in print, and only where the document is government-adjacent (§7.4). Never two Thai fonts on one screen. |
| T3 | **Line-height floor of 1.55 for any block that can contain Thai** — that is, all body text. Latin-only surfaces may go tighter; nothing user-authored is Latin-only, so in practice `--lh-body: 1.55`. Headings use `--lh-th-tight: 1.3`, never below. |
| T4 | Thai runs ~8% shorter than English for the same content but needs ~10% more vertical room. Size buttons and cells by the *taller* requirement and the *longer* string — test every label in both languages. |
| T5 | Never `text-transform: uppercase` on a string that may contain Thai. Label components take an `uppercase` prop that defaults to `true` for Latin keys and must be set `false` for Thai labels. |
| T6 | Truncate with CSS `text-overflow: ellipsis`, never by JS character count — a `slice()` can cut between a Thai base glyph and its tone mark and render a broken cluster. |
| T7 | Thai figures still use DM Mono via the Thai fallback. The **one sanctioned exception** is a fully-Thai document surface where a single font across the page matters more than digit alignment: the monolith's Trip P&L does exactly this — `"Sarabun"` throughout with `font-variant-numeric: tabular-nums` on figures instead of DM Mono, with the comment *"the whole page uses Sarabun · numbers use tabular-nums instead of DM Mono so there is one font on the page."* That is a legitimate pattern for print-like documents. It is not a licence to drop DM Mono on a data screen. |

### 2.2 Color

#### 2.2.1 The accent

**Ocean blue `#1683C7`.** In dark mode it lifts to `#49b2ee` — `#1683C7` on a `#0b1317` ground
fails contrast for text and reads muddy for fills.

The ocean ramp, already coherent in the monolith's `softui-ocean-skin`:

```
Deep     #0E6AA8   accent-deep    — pressed states, links on tint
Base     #1683C7   accent         — fills, focus, active nav
Ink      #0f6ba6   accent-ink     — accent-colored text on light surfaces
Soft     #E1F0FA   accent-soft    — tint backgrounds, focus ring
Faint    #F1F8FD   accent-faint   — selected-row wash
```

Two blues currently exist in the monolith and this is defect #11 in the audit: brand Ocean
`#1683C7` and legacy info-blue `#185FA5`, *"close enough to read as a mistake, far enough to look
wrong side by side."* **PROPOSAL: collapse them.** The rewrite has one blue. Anywhere the monolith
used `#185FA5` for an informational chip, link, or "invoice" pay-type, use `--accent`. There is no
separate `--info` token.

#### 2.2.2 Semantic status colors

Six, and only six. Every business status in the product maps onto one of them (§4.1.4).

| Role | Token | Light | Dark | Meaning |
|---|---|---|---|---|
| Success | `--ok` / `--ok-soft` | `#137a52` / `#e6f5ee` | `#4ccb95` / `#0f2b21` | good, available, paid, confirmed, done |
| Caution | `--warn` / `--warn-soft` | `#b46a00` / `#fdf3e3` | `#e0a24a` / `#33260f` | pending, fixing, awaiting, expiring |
| Danger | `--danger` / `--danger-soft` | `#c8384c` / `#fdecee` | `#f2798c` / `#33161c` | bad, unavailable, overdue, rejected, over capacity |
| Information | `--accent` / `--accent-soft` | `#1683C7` / `#e8f3fb` | `#49b2ee` / `#0f2c3d` | in progress, completed, arrived, partly paid |
| Exception | `--violet` / `--violet-soft` | `#6a4bbd` / `#f0ecfb` | `#a48bef` / `#221b3a` | conflict, weather, charter, on-hold — "not an error, not normal" |
| Inactive | `--muted` / `--line-2` | `#68808f` / `#eef2f6` | `#89a0af` / `#182831` | cancelled, void, not applicable, no data |

The monolith re-declares this triad on almost every page with near-identical but non-identical
hexes — `#0F6E56`/`#1D9E75`/`#2d9a6a` green, `#854F0B`/`#A05A1A`/`#7A4A00` amber,
`#A32D2D`/`#E24B4A`/`#C44A36` red. That is audit defect #2 and the highest-leverage structural
fix available. **One token source. No page re-declares a status color.**

#### 2.2.3 The full token block

Copy-pasteable. This is the complete set — 83 tokens.

```css
:root{
  /* ---- surface layers ---- */
  --bg:#f6f8fa;              /* page ground */
  --panel:#ffffff;           /* card, table, modal surface */
  --panel-2:#fbfcfd;         /* table header strip, recessed strip, row hover */
  --panel-3:#f1f5f8;         /* sunken well: code, chart ground, disabled field */
  --overlay:rgba(15,32,41,.45);   /* modal scrim */

  /* ---- ink ---- */
  --ink:#0f2029;             /* primary text, figures */
  --ink-2:#31485a;           /* secondary text, table cells */
  --muted:#68808f;           /* labels, meta, table headers, placeholders */
  --ink-on-accent:#ffffff;   /* text on any filled accent/status surface */

  /* ---- lines ---- */
  --line:#e1e8ee;            /* the hairline: cards, tables, inputs, dividers */
  --line-2:#eef2f6;          /* fainter: row dividers inside a table body */
  --line-strong:#cbd7e1;     /* emphasis: focused field, selected row edge */

  /* ---- accent (Ocean) ---- */
  --accent:#1683C7;
  --accent-ink:#0f6ba6;      /* accent text on a light ground */
  --accent-deep:#0E6AA8;     /* pressed / active fill */
  --accent-soft:#e8f3fb;     /* tint background, focus ring */
  --accent-faint:#f4fafd;    /* selected-row wash */

  /* ---- status ---- */
  --danger:#c8384c;   --danger-soft:#fdecee;
  --warn:#b46a00;     --warn-soft:#fdf3e3;
  --ok:#137a52;       --ok-soft:#e6f5ee;
  --violet:#6a4bbd;   --violet-soft:#f0ecfb;

  /* ---- code / mono surfaces ---- */
  --code-bg:#f0f4f8;  --code-ink:#173446;

  /* ---- type ---- */
  --font-sans:"DM Sans","Noto Sans Thai",system-ui,-apple-system,"Segoe UI",sans-serif;
  --font-mono:"DM Mono","Noto Sans Thai",ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --fs-label:10px; --fs-micro:11px; --fs-table:12px; --fs-body:13px; --fs-body-lg:14px;
  --fs-h3:17px;    --fs-h2:20px;    --fs-h1:24px;    --fs-kpi:26px;   --fs-hero:42px;
  --lh-body:1.55;  --lh-tight:1.3;  --lh-flat:1;
  --ls-label:.05em; --ls-tight:-.015em; --ls-hero:-.035em;

  /* ---- space (2px-granular at the bottom, where controls live) ---- */
  --space-2:2px;  --space-4:4px;   --space-6:6px;   --space-8:8px;
  --space-10:10px; --space-12:12px; --space-14:14px; --space-16:16px;
  --space-18:18px; --space-22:22px; --space-28:28px; --space-36:36px; --space-48:48px;

  /* ---- radii: three, and only three ---- */
  --r-sm:6px;    /* controls: buttons, inputs, chips, icon buttons */
  --r:10px;      /* containers: cards, panels, KPI tiles, table wrappers */
  --r-lg:14px;   /* floating tier: modals, drawers, popovers */
  --r-pill:999px;/* SHAPE, not a scale step — pills and segmented tracks only */

  /* ---- elevation ---- */
  --shadow-sm:0 1px 2px rgba(15,32,41,.05);
  --shadow:0 1px 2px rgba(15,32,41,.05), 0 8px 24px -14px rgba(15,32,41,.22);
  --shadow-pop:0 8px 24px -6px rgba(15,32,41,.18);
  --shadow-modal:0 24px 60px -12px rgba(15,32,41,.35);
  --focus-ring:0 0 0 3px var(--accent-soft);

  /* ---- motion ---- */
  --dur-fast:120ms; --dur:150ms; --dur-slow:300ms;
  --ease:cubic-bezier(.2,.6,.3,1);

  /* ---- layout ---- */
  --topbar:52px; --sidebar:220px; --sidebar-collapsed:84px;
  --page-gutter:22px; --page-max:1320px; --badge-gap:64px;

  /* ---- z-index scale (the monolith has none; this is the fix) ---- */
  --z-sticky:40; --z-topbar:100; --z-drawer:300;
  --z-modal:400; --z-popover:500; --z-toast:600;
}

/* dark: system preference, only when no explicit light choice is stamped */
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg:#0b1317; --panel:#111d24; --panel-2:#0e181e; --panel-3:#0d1b23;
    --overlay:rgba(0,0,0,.6);
    --ink:#e7eff5; --ink-2:#bfd0dc; --muted:#89a0af; --ink-on-accent:#07141b;
    --line:#1f313c; --line-2:#182831; --line-strong:#2e4655;
    --accent:#49b2ee; --accent-ink:#7ccbf8; --accent-deep:#8ad4fb;
    --accent-soft:#0f2c3d; --accent-faint:#0d222f;
    --danger:#f2798c; --danger-soft:#33161c;
    --warn:#e0a24a;   --warn-soft:#33260f;
    --ok:#4ccb95;     --ok-soft:#0f2b21;
    --violet:#a48bef; --violet-soft:#221b3a;
    --code-bg:#0d1b23; --code-ink:#cfe0eb;
    --shadow-sm:0 1px 2px rgba(0,0,0,.4);
    --shadow:0 1px 2px rgba(0,0,0,.4), 0 10px 30px -16px rgba(0,0,0,.7);
    --shadow-pop:0 10px 28px -8px rgba(0,0,0,.7);
    --shadow-modal:0 28px 70px -14px rgba(0,0,0,.8);
  }
}

/* dark: explicit choice — must repeat, so the toggle wins in both directions */
:root[data-theme="dark"]{
  --bg:#0b1317; --panel:#111d24; --panel-2:#0e181e; --panel-3:#0d1b23;
  --overlay:rgba(0,0,0,.6);
  --ink:#e7eff5; --ink-2:#bfd0dc; --muted:#89a0af; --ink-on-accent:#07141b;
  --line:#1f313c; --line-2:#182831; --line-strong:#2e4655;
  --accent:#49b2ee; --accent-ink:#7ccbf8; --accent-deep:#8ad4fb;
  --accent-soft:#0f2c3d; --accent-faint:#0d222f;
  --danger:#f2798c; --danger-soft:#33161c;
  --warn:#e0a24a;   --warn-soft:#33260f;
  --ok:#4ccb95;     --ok-soft:#0f2b21;
  --violet:#a48bef; --violet-soft:#221b3a;
  --code-bg:#0d1b23; --code-ink:#cfe0eb;
  --shadow-sm:0 1px 2px rgba(0,0,0,.4);
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 10px 30px -16px rgba(0,0,0,.7);
  --shadow-pop:0 10px 28px -8px rgba(0,0,0,.7);
  --shadow-modal:0 28px 70px -14px rgba(0,0,0,.8);
}
```

#### 2.2.4 The three-state theme pattern — why it is written that way

Theme has three states, not two:

| State | Root attribute | Resolved by |
|---|---|---|
| Explicit light | `data-theme="light"` | bare `:root` |
| Explicit dark | `data-theme="dark"` | `:root[data-theme="dark"]` |
| **System (default)** | *no attribute* | `@media (prefers-color-scheme: dark)` guarded as `:root:not([data-theme="light"])` |

Three rules make an explicit toggle and a system preference coexist correctly:

1. **The complete light palette is defined on bare `:root`.** Every token gets its value there.
   Nothing has its only definition inside a media query or an attribute selector — a token defined
   only under `prefers-color-scheme: dark` is simply undefined for a light-mode user.
2. **The media block is guarded with `:not([data-theme="light"])`.** Without the guard, a user on
   a dark OS who explicitly picks light gets the media block anyway (media queries and attribute
   selectors have different specificity paths and the media block wins by source order). The guard
   is what lets "I chose light on a dark machine" work.
3. **The dark palette appears twice — under the media query and under `[data-theme="dark"]`.**
   The duplication is the point: the attribute selector is what lets "I chose dark on a light
   machine" work. Keep them byte-identical; a divergence between the two blocks is a bug that only
   shows on one machine.

In React, the toggle writes the attribute on `document.documentElement` and persists the choice.
Three values, not two — `'light' | 'dark' | null`, where `null` means "follow the system":

```tsx
type Theme = 'light' | 'dark' | null;
function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t) root.setAttribute('data-theme', t);
  else root.removeAttribute('data-theme');
  try { t ? localStorage.setItem('la_theme', t) : localStorage.removeItem('la_theme'); } catch {}
}
```

Body must paint an explicit `background: var(--bg)` — a transparent body borrows whatever ground
the host paints, which is how a theme-aware page ends up with light text on a light background.

### 2.3 Spacing and layout

**Scale.** 2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 22 · 28 · 36 · 48. Denser than a typical
4/8 scale at the bottom because control padding lives at 6–9px and rounding it to 8 loses a whole
row per ten table rows. Above 16 it becomes coarse — nothing needs 20px.

**Standard measurements** (carried forward from the monolith unchanged):

| Thing | Value |
|---|---|
| Topbar height | `52px` (`--topbar`) |
| Sidebar width | `220px` (`--sidebar`); collapsed rail `84px` |
| Page gutter | `22px` (`--page-gutter`) |
| Card padding | `16px 18px` |
| KPI tile padding | `14px 16px` |
| Modal header / body / footer | `14px 18px 12px` / `16px 18px` / `12px 18px` |
| Table `th` padding | `7px 10px` |
| Table `td` padding | `9px 10px` |
| Control padding | `7px 14px` (default), `5px 10px` (small) |
| Input padding | `6px 9px` |
| Grid gaps | `14px` (2/3-col), `12px` (4-col), `8px` (form grids) |
| Page bottom reserve | `64px` (`--badge-gap`) |

**Container.** The shell is a fixed topbar + fixed sidebar + fluid main. The monolith sets **no**
page max-width anywhere in its base CSS. **PROPOSAL:** introduce `--page-max: 1320px` for
form-shaped and document-shaped pages (the monolith's own Booking form already caps at 1320px),
and keep list/matrix/manifest pages fluid — a 40-column manifest on a 32" monitor should use the
monitor.

**Page bottom reserve.** `.view { padding-bottom: 64px }` exists because fixed-position chrome
(user badge, view-only banner, refresh button) sits at the bottom of the viewport and otherwise
covers the last table row. Keep it. In React it becomes a layout constant, not a per-page style.

**Sticky headers.** See §5.4 — the rule is a hard constraint, not a preference.

### 2.4 Borders and elevation

**Borders.** One weight, one color: `1px solid var(--line)`. It is the primary separator for
cards, tables, inputs, list rows and panels. Table body rows use the fainter `--line-2` — the two
weights are intentionally different and should stay different; a table where the header rule and
the row rules are equal weight loses its header.

**State borders.** A 3px colored left border marks list-item state (available / fixing /
unavailable, assigned / unassigned). This is a load-bearing pattern, not decoration: it is
readable at a glance down a 40-row list in a way a pill in column 6 is not. Keep it, and keep it
3px.

**Shadows.** Four tokens, used sparingly:

| Token | Use |
|---|---|
| `--shadow-sm` | Almost nothing. A raised segmented-control thumb. |
| `--shadow` | Cards and panels — the workhorse. |
| `--shadow-pop` | Dropdowns, popovers, typeahead menus, boat pickers. |
| `--shadow-modal` | Modals and drawers only. |

`--focus-ring` is `0 0 0 3px var(--accent-soft)` and is the *only* focus treatment. The monolith
hardcodes its focus glow twice as `rgba(26,127,160,.1)` / `.15` — a hue that is no longer in the
palette (audit defect #8). One token fixes it.

**Glass is out.** The monolith has seven glassmorphism skins built on `backdrop-filter`. They look
good and they cost: a stacking context that traps every dropdown inside them (§10.1), a real
compositing cost on the low-end tablets used at the pier, and a translucency that fights the
"figures always legible" principle under sun. **The rewrite does not use `backdrop-filter`.**
Where a floating surface needs separation from what is behind it, it uses an opaque `--panel`
with `--shadow-pop`. This is a deliberate reduction and staff will notice it; §11.3 covers how to
land it.

### 2.5 Motion

| Token | Value | Where |
|---|---|---|
| `--dur-fast` | `120ms` | List rows, icon buttons, tight chrome, hover tints |
| `--dur` | `150ms` | Buttons, inputs, nav items, tabs — the default |
| `--dur-slow` | `300ms` | Fill-bar width, drawer slide |
| `--ease` | `cubic-bezier(.2,.6,.3,1)` | Everything. One curve. |

**Motion is banned:**

- Inside dense tables. No row-enter, no row-reorder animation, no stagger. A 40-row manifest
  repaint must be instantaneous.
- On anything in the input path. Never animate a property that can delay a keystroke's visible
  effect — no transition on `input` value rendering, no debounced-looking focus animation.
- On the number itself. Counting-up KPI values are banned outright: a figure that is mid-animation
  is a figure that is wrong, and someone will read it.
- Under `prefers-reduced-motion: reduce`, where every transition and animation resolves to `1ms`.

Animate `opacity`, `transform`, `background-color`, `border-color`, `box-shadow` and `width`
(fill bars only). Never animate `height` or layout-affecting properties on a list.

---

## 3. The skin system

The most distinctive thing in this product, and the part most likely to be thrown away by
someone who does not understand why it is there.

### 3.1 What a skin is

In the monolith, a skin is a named, additive, reversible `<style id="…-skin">` block appended
before `</head>`. It overrides by specificity rather than by editing base CSS, so deleting the
block reverts the look. Fourteen sit in the head stack; eleven more are injected at runtime into
component hosts.

Almost all of them do one of two things: recolor a view's accent, or re-material a view's cards.
The recolor is the part worth keeping.

### 3.2 Why per-view palettes exist in an ops tool

**Instant orientation.** A dispatcher context-switches between Booking, Boat Operation, Van Job
Orders and Pier Check-in dozens of times an hour, often mid-phone-call. A per-module accent means
the answer to "which screen am I on" arrives in peripheral vision, before reading anything. Staff
refer to modules by color — "the pink one", "the green one".

**Error prevention.** Modules with adjacent, dangerous operations — assigning a boat vs assigning
a van — look different, so a muscle-memory click in the wrong module is caught by the eye.

**Ownership.** Each module was built and is maintained as a unit. A self-contained look means a
change is safe in isolation, which is the one genuinely good property of the monolith's
copy-paste architecture.

The cost, in the monolith, is that a module's look is *entirely* self-contained — including its
tables, its tabs, its buttons and its status colors. A palette change is a fifteen-site edit. The
rewrite keeps the benefit and drops the cost by making a skin exactly four tokens deep.

### 3.3 The skins, enumerated

Seventeen distinct visual languages are identifiable in the monolith. The audit calls it "~15";
this is the precise list, with the accent each one actually renders.

| # | Language | Accent | Views |
|---|---|---|---|
| 1 | **Global shell / Ocean** | `#1683C7` (re-skin of `--ocean #1a6a8a`) | topbar, sidebar, generic `.card` pages, Accounting, Add-on Services |
| 2 | **BuildAxis navy** | `#3A6FF7` on `#1F2A44` | `#view-booking`, `#view-fl-projects` (borrowed) |
| 3 | **Cream / lime** (Manrope) | forest `#0A6B3F` + lime `#A6EB7E` | `#view-dashboard` |
| 4 | **Fleet pink** | `#E03B7E` / soft `#FCE5EC` / ink `#9F1B4F` | 10 Fleet views — dashboard, daily log, boats, maintenance, incident, inventory, consumables, cost, insights, fuel |
| 5 | **Mint-teal ops** | `#0F6E56` | `#view-operation`, `#view-fleetcal`, pier check-in confirm states, Consumables |
| 6 | **Legacy blue** | `#185FA5` | pier ops screens + most print documents |
| 7 | **Slate navy** | `#16265C` / `#0F172A` | Pier Office, Attendance, Licenses, Boat Job Board |
| 8 | **Finexy** | `#163d2b` + lime `#9fdb4a` | `#view-dailypfm` |
| 9 | **Tailwind indigo** | `#4F46E5` (+ Sarabun) | `#view-trippl` |
| 10 | **SaaS indigo/violet** | `#4f46e5`, `#8b5cf6`, `#14b8a6` | `#view-dailyreport` |
| 11 | **Vivid orange** | `#ff4c00` (+ IBM Plex Sans Thai) | `#view-costing` |
| 12 | **InvestIQ green** | `#00D084` | `#view-b2b-dash` |
| 13 | **Market orange + glass** | `#F4762E` / `#E8642A` | `#view-marketdata` |
| 14 | **Sales pink** | `#d44a7f` (`--sb-pink`) | `#view-sales-board`, Team & Markets, Programs |
| 15 | **Ops navy** | `#1B2A55` / `#1A2B43` | Staff & Welfare, Pickup Setup, Contract wizard, Rate Type ledger |
| 16 | **Lime / zinc** | `#a3e635` | `#view-travelsum` |
| 17 | **Excel replica** | `#FFF200` / `#C00000` / `#00B050` | Lunch Order Slip, Sign Sheet — deliberate: reproduces a legacy spreadsheet |

The head-stack skin blocks that produce them, for reference when porting:
`bkv2-buildaxis-skin` · `softui-ocean-skin` · `md-glass-skin` · `bkv2-liquid-skin` ·
`cal-liquid-skin` · `dash-glass-skin` · `bop-glass-skin` · `topbar-float-skin` ·
`bkv2-nb-glass-skin` · `sidebar-glass-skin` · `bkv2-cal-filter-skin` · `cost-v2-skin` ·
`bkv2-vc-skin` (13), plus `la-mobile` which is a responsive layer, not a skin.

### 3.4 The React translation

**A skin is four tokens. Nothing else.**

```ts
export type Skin = {
  key: string;          // 'booking' | 'fleet' | 'pier' | …
  label: string;        // for the governance registry, not the UI
  accent: string;       // fills, focus, active nav
  accentInk: string;    // accent-colored text on a light ground
  accentDeep: string;   // pressed / active fill
  accentSoft: string;   // tint background, focus ring
  dark: Pick<Skin,'accent'|'accentInk'|'accentDeep'|'accentSoft'>;
};
```

A skin may set `--accent`, `--accent-ink`, `--accent-deep`, `--accent-soft` (and their dark
counterparts). It may **not** set type, spacing, radii, shadows, motion, surfaces, ink, lines, or
any status color. There is no per-skin table, no per-skin button, no per-skin pill.

**Scoping — how it cannot leak.** Apply the skin as inline custom properties on a single
route-root element. Custom properties inherit down the subtree and stop at its boundary, so a
portal rendered outside that element gets the global accent unless it is told otherwise.

```tsx
export function SkinProvider({ skin, children }: { skin: Skin; children: React.ReactNode }) {
  const style = {
    '--accent': skin.accent,
    '--accent-ink': skin.accentInk,
    '--accent-deep': skin.accentDeep,
    '--accent-soft': skin.accentSoft,
  } as React.CSSProperties;
  return <div className="route-root" data-skin={skin.key} style={style}>{children}</div>;
}
```

**Portals need explicit handling.** Modals, drawers, popovers and toasts render into a portal
root outside the route subtree, so they lose the skin. Two choices, and the choice must be
consistent:

- **Chrome is global.** Modals, drawers and toasts use the global Ocean accent regardless of
  which route opened them. *This is the recommended default* — it makes "you are in a dialog" a
  distinct state.
- **Popovers inherit.** Anchored popovers (typeahead menus, boat pickers, date pickers) belong
  visually to the field that opened them and should carry the route skin. Pass the four custom
  properties through to the portal container explicitly; do not rely on inheritance.

**Governance.** The skin registry is a single file — `packages/ui/skins.ts` — and adding an entry
requires review (§12.3). Target: **8 skins, not 17.** A defensible starting set, merging the
monolith's seventeen:

| Skin | Accent | Absorbs |
|---|---|---|
| `core` | `#1683C7` Ocean | 1, 6, 15 — global chrome, legacy blue, ops navy |
| `booking` | `#3A6FF7` | 2 |
| `fleet` | `#E03B7E` | 4 |
| `ops` | `#0F6E56` | 5 — boat operation, fleet calendar, consumables |
| `pier` | `#16265C` | 7 |
| `finance` | `#163d2b` | 8, 9, 10, 11 — PFM, Trip P&L, Daily Report, Costing |
| `sales` | `#d44a7f` | 3, 12, 13, 14 — dashboard, B2B, market data, sales board |
| `manifest` | `#65a30d` | 16 |

Language 17 (Excel replica) is print-only and correct as it is — it deliberately reproduces a
spreadsheet staff still cross-check against. It is not a skin; it is a document template (§7.5).

---

## 4. Component inventory

Every component below specifies purpose, anatomy, variants, the full state set, sizing,
accessibility and a React prop contract. The full state set is always:
**default · hover · focus-visible · active · disabled · loading · empty · error** — a component
that cannot be in a state still has to declare that it cannot.

### 4.1 StatusPill — the signature pattern

**Purpose.** Communicate one record's state inside dense content, without shouting.

**Anatomy.** `[ dot ][ 3px gap ][ label ]` inside a full-round tinted container.

```css
.pill{
  display:inline-flex; align-items:center; gap:3px;
  padding:2px 8px; border-radius:var(--r-pill);
  font-size:var(--fs-label); font-weight:500; line-height:1.6;
  border:1px solid transparent;         /* becomes visible in dark mode */
  white-space:nowrap;
}
.pill::before{ content:''; width:4px; height:4px; border-radius:50%; flex:none }
```

**Exact derivation** — no per-status hexes, ever:

| Part | Value |
|---|---|
| Background | the status `-soft` token |
| Dot | the status solid token |
| Text | the status solid token (except `ok`, which uses a darkened variant on light for contrast) |
| Border | `color-mix(in srgb, <status> 28%, transparent)` — invisible on light, a defining edge on dark |
| Dot size | `4px`. Not 5, not 6. At 10px text this is the largest dot that still reads as a marker rather than a bullet. |

**Sizes.** `sm` (2px 8px, 10px text — the default, and what tables use) · `md` (3px 10px, 11px
text — for detail headers). No large.

**States.** Static by default. If `onClick` is provided it becomes a filter toggle: `hover` raises
the tint one step, `focus-visible` shows `--focus-ring`, `active` (selected) inverts to a filled
pill with `--ink-on-accent` text. `disabled` drops to `--muted`/`--line-2`. No loading state.
Empty is not applicable — a record always has a status; if it does not, that is `unknown` and
renders gray with the label "—".

**Accessibility.** The dot is decorative (`aria-hidden`); the label carries the meaning. Never
render a pill with no text label — a dot-only status is a color-only signal (§9.5). Interactive
pills are `<button aria-pressed>`.

**Contract:**

```tsx
type StatusTone = 'ok' | 'warn' | 'danger' | 'info' | 'exception' | 'neutral';

interface StatusPillProps {
  tone: StatusTone;
  children: React.ReactNode;   // the label — required, never omitted
  size?: 'sm' | 'md';          // default 'sm'
  onClick?: () => void;        // presence makes it a toggle
  selected?: boolean;          // only meaningful with onClick
  disabled?: boolean;
  title?: string;              // long-form explanation on hover
}
```

#### 4.1.4 Business status → tone map

Every status in the product, on six colors. "Current" is what the monolith renders; "Spec" is what
the rewrite renders. Where they differ the change is marked **PROPOSAL** and justified.

**Booking status** (`SB_BOOKINGS.status`)

| Status | Current | Spec | Label EN / TH |
|---|---|---|---|
| `quote` | gray | `neutral` | Quote / ใบเสนอราคา |
| `pending_foc` | amber | `warn` | FOC pending / รอ FOC |
| `pending_approval` | red inline badge | `warn` **PROPOSAL** | Awaiting approval / รออนุมัติ |
| `confirmed` | green | `ok` | Confirmed / ยืนยันแล้ว |
| `completed` | blue | `info` | Completed / เสร็จสิ้น |
| `rejected` | red | `danger` | Rejected / ไม่อนุมัติ |
| `cancelled` | gray | `neutral` | Cancelled / ยกเลิก |
| `cancelled_weather` | red-tinted, ad hoc | `exception` **PROPOSAL** | Weather / ยกเลิกเพราะอากาศ |

Two proposals, both fixing audit defect #7 (`cancelled_weather` and `pending_approval` have no
chip entry at all in the monolith and are surfaced via ad-hoc inline badges):

- **`pending_approval` → warn, not danger.** An approval queue is not an error. Red is already
  carrying `rejected`, and in the monolith the two render at `#A32D2D` and `#791f1f` — visually
  the same thing with opposite meanings.
- **`cancelled_weather` → exception (violet), not neutral or danger.** The three cancelled
  statuses have different financial consequences and must be distinguishable at a glance: customer
  cancellation (gray), weather cancellation (violet — nobody's fault, different refund rule),
  rejection (red). Violet already means "conflict / not-an-error exception" elsewhere in the
  product (the van-mixing warning).

All three of `cancelled`, `cancelled_weather`, `rejected` are excluded from every pax and revenue
aggregate. That is a data rule, not a display rule, but the display must never imply otherwise —
a cancelled row is never included in a column total, and a total that excludes rows must say so.

**Boat status** (`boat.log[last].s`)

| Status | Tone | Label |
|---|---|---|
| `available` | `ok` | Available / พร้อมใช้งาน |
| `fixing` | `warn` | In shop / ซ่อม |
| `unavailable` | `danger` | Unavailable / ไม่พร้อม |

**Asset status** (engines, gearboxes, propellers)

| Status | Tone |
|---|---|
| `ready` | `ok` |
| `fixing` | `warn` |
| `spare` | `neutral` |
| `broken` | `danger` |

**Invoice / payment status**

| Status | Current | Spec |
|---|---|---|
| `issued` (awaiting payment) | amber | `warn` |
| `partial` | blue | `info` |
| `paid` | green | `ok` |
| `overdue` | *no chip exists* | `danger` **PROPOSAL** |
| `void` | gray | `neutral` |
| `no_invoice` | gray | `neutral` |
| `hold` | red | `exception` **PROPOSAL** |

The monolith has no overdue chip at all — overdue surfaces only as a red KPI count, while the
individual overdue invoice still shows amber "Awaiting payment". That is the single worst status
gap in the product: the one row you need to find looks identical to the forty you do not.
`hold` → violet distinguishes "we stopped it" from "they did not pay".

**Approval state:** `pending` → `warn` · `approved` → `ok` · `rejected` → `danger`.

**Check-in stage:** `waiting` → `neutral` · `arrived` → `info` · `cleared` → `warn` ·
`on_board` → `ok` · `no_show` / `lost` → `danger` · `void` → `neutral`.

**Countdown to departure (5-state):** `soon` → `warn` · `due` → `info` · `late` → `danger` ·
`done` → `ok` · `missed` → `neutral`.

**Document check:** `verified` → `ok` · `issue` → `danger` · `pending` → `warn` ·
`no_files` → `neutral`.

**Contract / licence:** `active` → `ok` · `expiring` → `warn` · `expired` → `danger` ·
`none` → `neutral`.

**Van dispatch:** `dispatched` → `ok` · `return_unassigned` → `warn` · `unassigned` → `danger` ·
`mixed_van` (รถปนกัน) → `exception`.

**Trip / day:** `open` → `neutral` · `closed` → `neutral` (hatched cell, not a pill) ·
`weather_closed` → `exception` · `over_capacity` → `danger` · `over_licence` → `danger` (and
blocked, §8.5).

### 4.2 DataTable — the core surface

**Purpose.** The product is mostly tables. This component carries more weight than anything else
in the inventory.

**Density.** `th` `7px 10px`, 10px/600 uppercase, `--muted`, bottom `1px solid var(--line)`.
`td` `9px 10px`, 12px, `--ink-2`, bottom `1px solid var(--line-2)`. Row height lands at ~33px.
There is one density. A "comfortable" mode is not offered — see P1.

**Alignment.** Text left. **Figures right-aligned and in DM Mono, always** (P2). Dates left
(they read as labels). Status pills left. Actions right. Numeric column headers are right-aligned
too, or the header floats away from its column.

**Header.** `--panel-2` ground, sticky by default. Sticky offset comes from CSS variables,
never a literal (§5.4). A sticky header uses `box-shadow: inset 0 -1px 0 var(--line)` rather
than `border-bottom`, because a bordered sticky header hairline-flickers during scroll in Blink.

**Zebra: no.** Hairline row dividers plus a hover tint. Zebra striping plus a 3px status left
border plus a tinted row state is three background signals fighting; the row states carry
information and win.

**Row hover.** `background: var(--panel-2)`, `--dur-fast`, no transform, no shadow.

**Row states** — these are information, and they compose with hover:

| State | Treatment |
|---|---|
| Selected | `--accent-faint` background + 3px `--accent` left border |
| Status-flagged | 3px left border in the status solid token |
| Warning frame | 2px `--warn` border (all sides) — "not yet assigned" |
| Error frame | 2px `--danger` border — "cannot proceed" |
| Cancelled | `opacity: .5`, lead name struck through |
| Hard failure (no-show) | `--danger-soft` fill + 5px `--danger` inset left shadow |

**Sorting.** Header is a `<button>` inside the `<th>`; the `<th>` carries
`aria-sort="ascending|descending|none"`. The indicator is a caret, always rendered (in `--line`
when inactive) so the column does not reflow on sort.

**Selection.** Checkbox in a 32px leading column. Header checkbox is tri-state
(`indeterminate`). Selection count and bulk actions appear in a bar above the table, not floating
over it — a floating bar covers the last row.

**Empty state.** Inside the table body, spanning all columns: a one-line statement of what is
missing and, where one exists, the action that fixes it. Never "No data".

**Loading.** Skeleton rows matching the real row height and column widths (§4.13), for at most
`n` rows where `n` is the previous result count or 8. Never a spinner over a table — the layout
shift when it resolves loses the reader's place.

**Error.** Row spanning all columns, `--danger-soft`, with a retry action. The header stays.

**Horizontal scroll — the rule that keeps the page from breaking.** A wide table scrolls *inside
its own container*; the page body never scrolls horizontally.

```css
.tw{ overflow-x:auto; border:1px solid var(--line); border-radius:var(--r); background:var(--panel) }
.tw > table{ min-width: <the table's real minimum> }
```

The monolith learned this the hard way: check-in tables set `min-width: 1420px`, and letting the
body scroll dragged the topbar and nav drawer sideways with the content. Every table is wrapped.
On mobile the main region becomes the scroll container so the chrome stays put.

**Accessibility.** Real `<table>` semantics — never a div grid. `<caption>` (visually hidden) names
the table. `scope="col"` on headers. Sticky header must not be `aria-hidden`. Row actions are real
buttons and reachable in tab order; do not hide them behind `:hover` opacity (the monolith does
this in three places and it makes those actions keyboard-invisible).

```tsx
interface Column<T> {
  key: string;
  header: React.ReactNode;
  align?: 'left' | 'right' | 'center';   // default 'left'
  numeric?: boolean;                     // implies align:'right' + mono + tabular-nums
  width?: string;
  sortable?: boolean;
  sticky?: 'left';                       // pins the first column(s)
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  minWidth?: number;                     // drives the inner min-width
  stickyHeader?: boolean;                // default true
  stickyOffsetVar?: string;              // default 'var(--topbar)' — see §5.4
  rowState?: (row: T) => RowState | undefined;
  sort?: { key: string; dir: 'asc' | 'desc' };
  onSortChange?: (s: { key: string; dir: 'asc' | 'desc' }) => void;
  selection?: { selected: Set<string>; onChange: (s: Set<string>) => void };
  loading?: boolean;
  error?: { message: string; onRetry?: () => void };
  empty?: React.ReactNode;
  caption: string;                       // required, visually hidden
}
```

### 4.3 Card and Panel

**Card.** `--panel` background, `1px solid var(--line)`, `--r`, `16px 18px`, `--shadow`.
`CardTitle` is 10px/600 uppercase `--muted` with `.06em` tracking and 12px bottom margin.

**Panel.** The same recipe *without* the shadow — for a container that is structurally part of
the page rather than sitting on it (a list rail beside a detail pane). The monolith copy-pastes
the card recipe onto 10+ panel classes rather than composing it (audit defect #3). One component,
two variants.

**Variants:** `default` · `flat` (no shadow) · `inset` (`--panel-2` ground, no shadow — a well
inside a card) · `accent` (3px top stripe in `--accent`, the KPI treatment).

**States.** `interactive` cards (a whole card that is a link) get hover `border-color:
var(--line-strong)` and `focus-visible` ring. Non-interactive cards have no hover state at all —
a hover effect on a non-clickable surface is a lie.

```tsx
interface CardProps {
  variant?: 'default' | 'flat' | 'inset' | 'accent';
  accentTone?: StatusTone;      // colors the top stripe on variant='accent'
  title?: React.ReactNode;      // rendered as CardTitle
  actions?: React.ReactNode;    // right side of the title row
  interactive?: boolean;
  padding?: 'default' | 'tight' | 'none';
  children: React.ReactNode;
}
```

### 4.4 Forms

**Shared anatomy.** `Field` wraps every control: label (10px/500 `--muted`, 3px bottom margin) →
control → description or error. Required is marked with a `*` in `--danger` *after* the label,
plus `aria-required`. Optional is never marked — most fields are required, so marking optional
inverts the signal.

**Base control:**

```css
.control{
  font-family:var(--font-sans); font-size:var(--fs-table);
  padding:6px 9px; border:1px solid var(--line); border-radius:var(--r-sm);
  background:var(--panel); color:var(--ink); outline:none;
  transition:border-color var(--dur), box-shadow var(--dur);
}
.control:focus-visible{ border-color:var(--accent); box-shadow:var(--focus-ring) }
.control:disabled{ background:var(--panel-3); color:var(--muted); cursor:not-allowed }
.control[aria-invalid="true"]{ border-color:var(--danger) }
.control[aria-invalid="true"]:focus-visible{ box-shadow:0 0 0 3px var(--danger-soft) }
```

| Control | Notes |
|---|---|
| `TextField` | The base. `readOnly` renders `--panel-3` ground, no focus ring, still selectable. |
| `NumberField` | **DM Mono, right-aligned, `tabular-nums`.** `inputMode="numeric"`. No spinner arrows — they are 8px targets and a mis-click on a pax count is a real cost. Step with ↑/↓ keys instead. |
| `CurrencyField` | NumberField + a `฿` prefix rendered as a non-focusable adornment inside the border, `--muted`. Value formats with thousands separators on blur, strips them on focus. Zero decimals (§8.2). |
| `DateField` | Native `<input type="date">` — the OS picker is better than anything we would build and staff already know it. **DM Mono.** Value is always a local `YYYY-MM-DD` string, never a `Date` (§8.3). |
| `Select` | Native `<select>` for ≤ 12 static options. Above that, Typeahead. |
| `Typeahead` | Filtered async list in an anchored popover. **Its container must never have `backdrop-filter` (§10.1).** Full combobox semantics: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`; ↑/↓ move, Enter selects, Esc closes and restores, Tab commits the highlighted option. Renders in a portal with collision-aware positioning. |
| `MultiSelect` | Typeahead + removable chips inside the field. Backspace on an empty input removes the last chip. Chips wrap; the field grows. Never a fixed-height field with hidden chips. |
| `Checkbox` | 16px box, `--r-sm`... at 16px use 4px. Checked = `--accent` fill + white glyph. Indeterminate = `--accent` fill + white dash. Tap target 40px via padding, not size. |
| `Radio` | 16px circle, 50%. Same target rule. Always in a `<fieldset>` with a `<legend>`. |
| `Toggle` | 34×20 track, 16px thumb, `--r-pill`. **Only for settings that apply immediately.** A toggle that requires a Save button is a checkbox wearing a costume. |
| `Textarea` | Base control, `min-height: 72px`, vertical resize only. |

**Validation display.** Errors appear **below** the field, 11px `--danger`, with the field
`aria-invalid` and `aria-describedby` pointing at the message. Validate on blur and on submit,
never on keystroke — a required-field error that appears after the first character is hostile.
A form with errors on submit moves focus to the first invalid field and announces the count.

**Form layout.** `FormGrid` with `columns: 1 | 2 | 3` and an 8px gap. Fields that belong together
(date + time, first + last) share a row; unrelated fields do not. A field whose value is long
(hotel name, notes) spans the full width regardless of grid.

```tsx
interface FieldProps {
  label: React.ReactNode;
  htmlFor: string;
  required?: boolean;
  description?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  span?: 1 | 2 | 3 | 'full';
}
```

### 4.5 Buttons

```css
.btn{
  display:inline-flex; align-items:center; gap:5px;
  padding:7px 14px; border-radius:var(--r-sm); border:1px solid transparent;
  font-family:var(--font-sans); font-size:var(--fs-table); font-weight:500;
  cursor:pointer; transition:background var(--dur), border-color var(--dur), color var(--dur);
}
.btn svg{ width:13px; height:13px; flex:none }
```

| Variant | Rest | Hover | Active |
|---|---|---|---|
| `primary` | `--accent` fill, `--ink-on-accent` | `--accent-deep` fill | `--accent-deep`, no transform |
| `secondary` | `--panel`, `--line` border, `--ink-2` | `--panel-2` ground, `--line-strong` border | `--panel-3` |
| `ghost` | transparent, `--ink-2` | `--panel-2` | `--panel-3` |
| `danger` | transparent, `--danger-soft` border, `--danger` text | `--danger-soft` fill | `--danger-soft`, darker text |
| `danger-solid` | `--danger` fill, white | darker | — |

**Destructive treatment.** `danger` (outline) is the default for a destructive action in a row or
toolbar. `danger-solid` is reserved for the confirming button inside a confirmation dialog — the
one place where the user has already committed. A destructive action that cannot be undone
requires a confirmation dialog; one that can be undone gets a toast with Undo instead, which is
faster and safer.

**Sizes.** `sm` (5px 10px, 11px) · `md` (7px 14px, 12px — default) · `lg` (9px 18px, 13px, for
the primary action on a full-page form). Minimum tap target 40px enforced via a transparent
`::before` inset expansion on touch, not by growing the visual button.

**Icon button.** Square, `--r-sm`, 28px (`sm`) or 32px (`md`), icon 14–16px. **Requires
`aria-label`.** A tooltip is not a label.

**States.**

- `focus-visible`: `--focus-ring`. Never removed.
- `disabled`: `opacity: .45`, `cursor: not-allowed`, `pointer-events` retained so the tooltip
  explaining *why* still works. The monolith has no base `:disabled` rule at all (audit defect
  #10) and every module invents one.
- `loading`: a 13px spinner replaces the leading icon; the label stays; width is locked to the
  rest width so the button does not resize; `aria-busy="true"`; the button is disabled.

```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-solid';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
}
```

### 4.6 Badge and Chip

**Badge** — a non-interactive label. Same tint recipe as StatusPill but **no dot**, `--r-sm`
(not pill), and it may be mono. Use for counts, codes, tags, route names, agent codes. A badge
never carries a status; if it would, it is a StatusPill.

**Chip** — an interactive, removable token. Pill radius, `--panel` ground, `--line` border, a
leading color dot when it represents a colored entity (route, boat, van, market), a trailing
`×` at 12px. Hover reveals nothing — the `×` is always visible, because a hover-revealed remove
button is unreachable by keyboard and invisible on touch. (The monolith hides it at `opacity: 0`
in three places.)

**FilterChip** — a chip in a filter bar. `aria-pressed`. Selected state fills with `--accent`.

### 4.7 Overlays

| Component | Layer | Shape | Dismiss |
|---|---|---|---|
| `Modal` | `--z-modal` | centered, `--r-lg`, `max-width` 420 (sm) / 640 (md) / 960 (lg), `max-height: 88vh` | Esc, scrim click, close button |
| `Drawer` | `--z-drawer` | right edge, `min(420px, 92vw)`, full height, `--r-lg` on the leading corners | Esc, scrim click |
| `Popover` | `--z-popover` | anchored, `--r-lg`, `--shadow-pop`, collision-aware | Esc, outside click |
| `Tooltip` | `--z-popover` | anchored, `--r-sm`, dark `--ink` ground, 11px | blur / mouseleave |
| `Toast` | `--z-toast` | bottom-right stack, `--r`, `--shadow-pop` | 5s auto, or dismiss |

**Modal.** Header `14px 18px 12px` with title (14px/600) + optional sub (11px `--muted`) + close.
Body `16px 18px`, scrollable, `flex: 1`. Footer `12px 18px`, `--panel-2` ground, actions right,
primary last. Focus is trapped; focus moves to the first interactive element on open and returns
to the trigger on close. `role="dialog" aria-modal="true"` with `aria-labelledby` on the title.
Background scroll is locked.

**A modal is for a decision, not a form.** The monolith's Booking v2 deliberately avoids modals
for its main flows and uses full-page takeovers instead — that is correct and the rewrite keeps
it. A create/edit flow with more than ~6 fields is a route, not a modal.

**Drawer.** Same semantics as Modal. Slides in over `--dur-slow`. Used for a detail pane that
sits *beside* the list conceptually — a day's bookings, a passenger's record.

**Popover.** Never traps focus (that is what makes it a popover and not a modal). Returns focus
to the anchor on close. **Renders in a portal.** The anchor's ancestors must not create a
stacking context that traps it — see §10.1.

**Tooltip.** Supplementary only. Never the sole carrier of information, never the label of an icon
button, never interactive. 500ms open delay, 0ms close. Suppressed on touch entirely — there is
no hover on a pier tablet, so anything tooltip-only is invisible to half the users.

**Toast.** `success` · `error` · `info`. Max 3 stacked; a 4th replaces the oldest. `error` toasts
do not auto-dismiss. `role="status"` for info/success, `role="alert"` for error. An action (Undo,
Retry) may be included and is a real button.

### 4.8 Tabs

Underline pattern, not pills. `border-bottom: 2px solid transparent`; active sets the border and
text to `--accent` with weight 600. Idle is `--muted`. The tab strip has a `1px solid var(--line)`
bottom rule that the active tab's 2px border overlaps.

Full ARIA tabs: `role="tablist"` / `role="tab"` / `role="tabpanel"`, `aria-selected`, roving
tabindex, ←/→ to move, Home/End to jump. A count badge sits after the label in `--line-2` /
`--muted`, or `--danger-soft` / `--danger` when the count is an alert (pending approvals).

Segmented controls are a different component: `--panel-3` track, `--r-sm`, 2px padding, active
segment `--panel` fill + `--shadow-sm`. Use for a view-mode switch (card/table, day/week/month),
never for navigation.

### 4.9 Navigation

**Sidebar.** `220px`, dark ground, grouped. Groups are 9px/600 uppercase `.08em` labels at 25%
white. Items are 12px, `7px 10px`, `--r-sm`, 14px leading icon at 60% opacity. Active item:
raised background, full-opacity icon, weight 500. Collapsible groups persist per user. Collapsed
rail mode is 84px, icons only, group labels become a divider line.

The actual sidebar groups in production, in order: **Overview · Operations · Pier Office ·
Sales · Accounting & Finance · Admin · Fleet Management · Config**. (Fleet Management has five
sub-groups; Admin is `data-adminonly`.) Note this is eight, not the six commonly cited — Pier
Office and Admin are real groups in the shipped markup.

**Topbar.** 52px, dark, brand at left, tools at right, date in DM Mono. Fixed, `--z-topbar`.

**Breadcrumbs.** Only on detail routes that are more than one level deep. 11px `--muted`, `/`
separators in `--line`, current page not a link. `aria-label="Breadcrumb"` on the `<nav>`.

### 4.10 Flow and step visualization

Two patterns, both carried over from the monolith's docs and both worth keeping.

**Rail** — a vertical process list with a 2px line and 11px node circles. Node border is
`--accent` by default; `--danger` filled for a blocking step, `--warn` outlined for a decision
point, `--ok` filled for a completed step. Used for booking lifecycle, approval chains,
maintenance job history.

**Flow** — a horizontal stage row of equal-width cards with arrow separators, wrapping on narrow
screens (the arrows rotate 90° at ≤700px). Each stage carries a mono key, a value, and an
optional sub. Used for pipeline states and status progressions.

Both are presentational. `aria-hidden` on the connector line and arrows; the content is a real
ordered list.

### 4.11 Dashboard tiles / KPI

**KpiTile.** `--panel`, `--line`, `--r`, `14px 16px`, `--shadow`, `overflow: hidden`, with a 3px
top stripe (`::after`) in the tone color. Label 10px/500 uppercase `--muted`. Value
`--fs-kpi`/600, `--ink`, **DM Mono**, `line-height: 1`. Sub 11px `--muted`.

**HeroFigure.** The single big number that opens a KPI strip: `--fs-hero` (42px), weight 700,
`--ls-hero`, DM Mono, with a unit in 13px `--muted` and status pills beneath. This exact recipe
recurs identically across every Fleet KPI strip in the monolith — treat it as fixed.

**Rules.** A KPI value never animates. A KPI with no data shows `—` in `--muted`, never `0`
(§8.6). A KPI whose value is a currency shows `฿` and thousands separators. Deltas are `+`/`−`
prefixed with tone — and tone follows *business* meaning, not sign: falling cancellations are
`ok` even though the number went down.

### 4.12 Loading skeletons

Skeleton blocks are `--line-2` with a `--r-sm`, sized to the real content they replace and no
animation beyond a 1.4s opacity pulse (suppressed under `prefers-reduced-motion`). Shimmer
gradients are banned — they are motion in a dense layout.

Rule: **skeletons match the real layout's geometry.** A skeleton that is the wrong height causes
a layout shift when it resolves, which is worse than a spinner. If the geometry is unknown, use a
centered spinner in a fixed-height container instead.

### 4.13 Empty states

Three parts: a one-line statement of what is not there, an optional one-line explanation of why,
and the action that changes it. `--muted` text, centered, 32px vertical padding. No illustration.

Never "No data", "Nothing here", or "Empty". Write "No bookings on 12 Sep" and "No boats are
marked available at Tub Lamu today". The difference between an empty list and a broken filter is
the most common support question this product generates; the empty state is where it gets
answered.

Distinguish three cases and never conflate them:

| Case | Message shape |
|---|---|
| No records exist yet | "No rate types yet." + primary action to create one |
| Records exist, the filter excludes them | "No bookings match these filters." + "Clear filters" |
| The request failed | Error state, not empty state — with Retry |

---

## 5. Layout patterns

### 5.1 App shell

```
┌──────────────────────────────────────────────────┐
│ Topbar (52px, fixed, --z-topbar)                 │
├────────────┬─────────────────────────────────────┤
│ Sidebar    │ Main                                │
│ 220px      │ padding: 22px                       │
│ fixed      │ padding-bottom: 64px (badge gap)    │
│ scrolls    │                                     │
└────────────┴─────────────────────────────────────┘
```

`main` is the scroll container on mobile (≤820px) rather than `body` — because wide tables set
large `min-width`, and a scrolling body drags the topbar and drawer sideways with the content.

### 5.2 Page templates

| Template | Shape | Used by |
|---|---|---|
| **List** | Page header → filter bar → DataTable → pagination | All bookings, invoices, agents, assets |
| **List + detail** | 340px list rail + fluid detail pane; rail scrolls independently | Agents, Rate Types, Boat Status |
| **Detail** | Header with status + actions → tab strip → tab body, `--page-max` | Booking detail, boat detail |
| **Form** | Full-page takeover, section cards, sticky review rail (320px), sticky footer actions | New/edit booking |
| **Dashboard** | KPI strip → 2–3 column card grid | Overview, Fleet dashboard |
| **Wizard** | Step rail (left, 340px) + step body + Back/Next footer | Contract document |
| **Matrix** | Sticky first column + sticky header + scrolling grid, wrapped in `.tw` | Availability matrix, attendance |

### 5.3 Responsive behaviour

The monolith has **no responsive breakpoints in its base CSS at all** — mobile is one 226-line
block, `la-mobile`. That is a defensible architecture for a desktop tool with a tablet
afterthought, and it is not what the rewrite should do: pier check-in is a tablet-first task now.

Three breakpoints:

| Breakpoint | Behaviour |
|---|---|
| ≥1180px | Full shell. Sidebar docked. Multi-column grids at full width. |
| 820–1180px | Sidebar collapses to the 84px rail. 4-column grids → 2. Detail panes stack below their list. |
| ≤820px | Sidebar becomes an off-canvas drawer with a scrim. Topbar tools collapse behind a `⋯`. `main` becomes the scroll container. Grids → 1–2 columns. All inputs forced to **16px** (below 16px, iOS zooms on focus and does not zoom back). Tap targets floored at 40px; checkboxes and radios at 20px visual / 40px target. Tables keep their `min-width` and scroll inside `.tw`. |

Calendar and matrix grids are exempt from column collapsing — a 7-column month grid stays 7
columns and scrolls horizontally instead. Collapsing it produces a list that is not a calendar.

### 5.4 Sticky offsets — never hardcode 52

**The rule.** Any sticky element's `top` reads a CSS custom property. Never a literal.

```css
.table-head    { position:sticky; top:var(--topbar); z-index:var(--z-sticky) }
.trip-head     { position:sticky; top:var(--t2-head-top, var(--topbar)); z-index:var(--z-sticky) }
```

**Why it exists.** `--topbar` is not a constant. The monolith's `topbar-float-skin` sets
`:root{--topbar:0px}` — it removes the docked bar entirely and floats its controls. Every sticky
element that hardcoded `52` gaps by 52px the moment that skin is on. The same applies to print
and embed contexts, which re-declare `--topbar: 0px`.

**Stacked sticky headers must be measured, not assumed.** When a second sticky bar sits below the
first, its offset is `--topbar` + the *measured* height of the bar above it — which changes with
content. The monolith computes this in a `requestAnimationFrame` after render and writes it back
as a custom property, with a code note that a fixed `96` both gapped and overlapped depending on
real height.

**The React enforcement.** A hook owns this; components never compute it.

```tsx
/** Measures a stacked sticky bar and publishes its offset as a CSS var on `scopeRef`. */
function useStickyOffset(
  scopeRef: React.RefObject<HTMLElement>,
  barRef: React.RefObject<HTMLElement>,
  varName: string,
) {
  useLayoutEffect(() => {
    const publish = () => {
      const top = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--topbar')
      ) || 0;
      const h = barRef.current?.offsetHeight ?? 0;
      scopeRef.current?.style.setProperty(varName, `${top + h}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    if (barRef.current) ro.observe(barRef.current);
    return () => ro.disconnect();
  }, [scopeRef, barRef, varName]);
}
```

`ResizeObserver` replaces the monolith's rAF-and-hope. Lint rule: **no numeric literal in a
`top` declaration on a `position: sticky` element.** It is mechanically checkable, so check it.

---

## 6. Iconography

**Icons are inline SVG. There is no Tabler webfont.** This has burned people repeatedly — the
monolith's Dashboard contains `ti ti-bolt` and `ti ti-refresh` class names that render as nothing
because no icon font is loaded anywhere in the file. If a class name that looks like an icon font
appears in ported markup, it is dead and must be replaced, not carried over.

**Specification.**

| Property | Value |
|---|---|
| Grid | 24×24 viewBox |
| Stroke | `stroke="currentColor"`, `stroke-width="2"`, `fill="none"`, round caps and joins |
| Sizes | 13px (inside buttons), 14px (nav, inline with body), 16px (standalone), 20px (empty states) |
| Color | Always `currentColor`. An icon never sets its own color. |
| Alignment | Optically centered with text: `vertical-align: -0.125em` for inline, flexbox `align-items: center` in a control |

**In React: a typed icon component, not string names.**

```tsx
// packages/ui/icons.tsx — one file, one export per glyph
export const IconBoat = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
       strokeLinecap="round" strokeLinejoin="round" width={p.size ?? 16} height={p.size ?? 16}
       aria-hidden={p.label ? undefined : true} role={p.label ? 'img' : undefined}
       aria-label={p.label}>
    <path d="…" />
  </svg>
);

export type IconName = keyof typeof icons;
export const icons = { boat: IconBoat, van: IconVan, /* … */ } as const;
```

Why typed components rather than `<Icon name="boat" />` with a string: a typo in a string name
fails silently at runtime and renders nothing; a typo in an import fails at build. Every icon in
this product sits next to a number that matters, and a silently-missing icon is a silently-missing
signal. The string-keyed `icons` map exists for the cases where a name genuinely comes from data
(a route's chosen icon) — and that lookup has a fallback glyph.

**Rules.** An icon-only control has `aria-label`. A decorative icon beside text has
`aria-hidden="true"`. One glyph per concept across the whole product — the icon set is a registry
with review (§12), not a folder anyone can add to.

---

## 7. Print and document design

Print is a product surface. The monolith ships **15 print documents** and they carry real
operational weight: the guide gets a job sheet, the driver gets a job order, the agent gets a
voucher, the pier gets a manifest, immigration gets a passenger list.

### 7.1 Page setup

**A4 landscape is the default** — 11 of the 15 documents. Portrait is for documents that are
read as documents (contracts, invoices, guide assignment orders) rather than as tables.

| Property | Value |
|---|---|
| Default | `@page { size: A4 landscape; margin: 9mm }` |
| Portrait documents | `@page { size: A4 portrait; margin: 10mm }` |
| Dense manifests | margin `7–8mm` |
| Body type | 9–10pt |
| Table type | 8–9pt |
| Rules | 0.5pt `#111827` — hairlines that survive a laser printer |

**The margin trap.** The monolith records a real bug: a `@page` margin of 10mm double-counted
against an on-screen preview sized at 1123px (A4 at 96dpi), so print output did not match the
preview. The fix was `@page { margin: 0 }` with the page element owning the entire margin as
padding. **Rule: one owner for the margin.** Either `@page` owns it and the page element has zero
padding, or `@page` is zero and the page element owns it. Never both.

### 7.2 Print stylesheet

The rewrite uses a **real print stylesheet on the same document** — not the monolith's
`window.open('','_blank')` + `document.write` popup. That popup pattern exists because the
monolith has no build step and no way to render a second React tree; the rewrite does. Consequences:

- No popup blocker guard needed, and no `alert('…allow pop-ups…')`.
- Fonts are already loaded — no per-document `<link>` re-injection, no blank-page race.
- The print view is a route (`/print/voucher/:id`), so it is linkable, testable and previewable.

```css
@media print {
  :root { --topbar:0px; --shadow:none; --shadow-pop:none; --shadow-modal:none }
  .app-chrome, .sidebar, .topbar, .toast-root, .no-print { display:none !important }
  .print-page { break-after: always; box-shadow:none; border-radius:0 }
  a[href]::after { content:none }              /* never print URLs — these go to guides, not readers */
  table { break-inside: auto }
  tr, .keep { break-inside: avoid }
  thead { display: table-header-group }        /* repeat headers across pages */
  tfoot { display: table-footer-group }
}
```

### 7.3 Color that carries meaning

Where color is data (§P3), force it:

```css
@media print {
  .prints-color { -webkit-print-color-adjust: exact; print-color-adjust: exact }
}
```

Apply to status pills, row-state fills, the sign sheet's outbound/return bands, the lunch slip's
restaurant flags. And because a printer can still fail or a sheet can be photocopied, **every
printed status also carries a text label or a glyph.** A printed sheet that is only readable in
color is one photocopy from useless.

### 7.4 Bilingual print

| Document class | Font | Why |
|---|---|---|
| Operational data sheets (manifests, job orders, job sheets) | `"DM Sans", "Noto Sans Thai"` + DM Mono figures | Matches screen; staff cross-check between the two |
| Thai government-adjacent forms (guide registration, staff attendance) | `"Sarabun"` | These forms are read alongside official documents that use Sarabun; matching is the point |
| Legacy spreadsheet replicas (sign sheet, lunch slip) | `"DM Sans", "Noto Sans Thai"` at the original metrics | Staff cross-check against an old Excel file |

Bilingual layout rules: label in Thai above value in English, or a two-column EN/TH pair — never
inline `Thai (English)`, which breaks at the line end. Thai line-height goes to **1.7** in print
(marks clip at print DPI more readily than on screen). Never justify Thai text; there are no word
spaces to distribute and the result is glyph-spaced.

### 7.5 The shared hero image system — history and fix

**What exists today.** Route hero photos live at `assets/hero/<routeId>.jpg`, resolved as:
explicit `route.heroImage` → convention path → gradient fallback. Twelve files exist (`r1`–`r12`).
The consumer today is the **Pickup Setup export card** (`psuRenderExportModal`).

**The history.** The hero image was shared between the voucher and the pickup-setup card. It was
sourced from marketing, which means **the marketing text is baked into the pixels** — route name,
tagline, sometimes a price. That is fine on a marketing card and wrong on a customer voucher,
where the text is already rendered live and now appears twice, in two typefaces, sometimes
contradicting each other after a price change. The fix at the time was an override layer:
`assets/voucher/<routeId>.jpg`, a clean-plate version, composited on top for the voucher only.

**What the code actually does now** — and this is a doc/code disagreement worth recording.
`CLAUDE.md` §8 describes the voucher override layer as live. It is not:

- A repo-wide grep finds **zero** references to `assets/voucher` in any source file. The only
  mention is in `CLAUDE.md` itself.
- `assets/voucher/` exists on disk and contains exactly **one orphan file, `r12.jpg`**.
- `bkV2VoucherTicket()` renders no photograph at all — it is a navy card with a route-colored
  left border and typographic content.

So: the override layer was built, one route was migrated, the voucher was later redesigned to
drop imagery entirely, and the mechanism was orphaned. The doc kept describing it.

**How the rewrite handles it properly.** The underlying mistake was treating one image as
serving two purposes. Fix it at the data model:

```ts
interface RouteImagery {
  marketing?: string;   // text baked in — marketing card, pickup-setup export. Never a document.
  plate?: string;       // clean plate, no text — vouchers, documents, anything with live text over it
  thumb?: string;       // 16:9 crop for list rows and cards
  alt: { en: string; th: string };
}
```

Rules:

1. **A document never renders an image with baked-in text.** If only `marketing` exists, the
   document renders the gradient fallback. A missing image is better than a contradictory one.
2. **Images are route data, not convention paths.** No filesystem-convention lookup; the API
   returns URLs. The convention path is how one route ended up with a file nobody references.
3. **`alt` is bilingual and required.** These images reach printed customer documents.
4. **The gradient fallback stays** and stays good — it uses the route color and is the correct
   rendering more often than people expect.
5. **Delete `assets/voucher/r12.jpg`** during migration, or promote it to `plate` for route 12 —
   but do not leave it.

---

## 8. Data display rules

### 8.1 Numbers

Right-aligned, DM Mono, `tabular-nums`. Thousands separators with `,`. Negative numbers use a
true minus `−` (U+2212), not a hyphen, and take `--danger` **only when negative is bad** — a
negative variance on a cost line is good news.

Never use scientific notation, never abbreviate on a data screen (`1.2k` in a table is a
rounding error waiting to be argued about). Abbreviation is permitted on a KPI hero figure where
the exact value is one click away, and there the full value goes in the `title`.

### 8.2 Currency

Thai Baht, symbol `฿`, prefix, no space: `฿12,450`.

**Zero decimals** on all operational surfaces. The monolith's `acctFmt` is
`'฿' + Math.round(n).toLocaleString()` and that is right — every price in this business is a whole
Baht, and a trailing `.00` on forty rows is forty units of noise. Decimals appear only where a
computed rate genuinely has them (per-litre fuel price, per-pax averages), and there to exactly
two.

Locale is `en-US` for grouping (`Intl.NumberFormat('en-US')`) even in the Thai UI — this is what
the monolith does and what staff read. Do not switch to `th-TH` grouping; it is identical for
Baht but the change would be invisible until it was not.

Negative amounts — refunds, cash-out — render as `−฿1,200` in `--danger`, never in parentheses.

### 8.3 Dates and times

**Everything is Asia/Bangkok (+07:00).** There is no second timezone in this product.

**The rule that matters most:** build a `YYYY-MM-DD` from local accessors, never from
`toISOString().slice(0,10)`. At +07:00, any local time before 07:00 converts to the *previous*
calendar day in UTC, so a booking made at 06:00 lands on yesterday. This is the single most
expensive class of bug in the monolith's history.

```ts
export const localYMD = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
```

Formats:

| Context | Format | Example |
|---|---|---|
| Table cell | `DD MMM` | `12 Sep` |
| Table cell, cross-year | `DD MMM YY` | `12 Sep 25` |
| Detail / document | `DD MMM YYYY` | `12 Sep 2025` |
| Machine / input value | `YYYY-MM-DD` | `2025-09-12` |
| Time | `HH:mm`, 24-hour | `07:30` |
| Timestamp | `DD MMM · HH:mm` | `12 Sep · 07:30` |

Month names are English abbreviations even in Thai UI — they are unambiguous, they are what the
monolith prints, and Thai month abbreviations collide (มี.ค. / พ.ค.). The day number and year are
DM Mono; the month name is DM Sans. The monolith's voucher does exactly this, with the comment
*"month as letters · day number and year in mono so the figures line up on every voucher."*

**Ranges.** `12 – 15 Sep` (shared month), `28 Sep – 3 Oct` (crossing), en dash with hair spaces,
never a hyphen. A range where start equals end renders as a single date.

**Buddhist era.** Thai official documents use BE (Gregorian + 543). The screen UI uses CE.
Print documents that are government-adjacent use BE. The formatter takes an `era` parameter; it is
never inferred from the locale.

### 8.4 Pax counts

Pax is always an integer and always DM Mono. The breakdown is
`ad_fr · ad_th · chd_fr · chd_th · inf_fr · inf_th · foc` and it displays as short labels with the
count: `AD 12 · CHD 3 · INF 1 · FOC 2`. **A zero category still renders**, dimmed to `--muted`,
because a missing chip and a zero chip are different claims — the monolith's voucher makes this
explicit: *"every ticket always shows four chips · the zero ones fade but never disappear."*

Foreign/Thai splits render as `12 FR / 4 TH` when the split matters (pricing, manifests) and as
a single total when it does not (capacity).

### 8.5 Capacity — `cap` vs `licensePax`

Two numbers that must never be confused visually, because confusing them is either lost revenue
or an illegal sailing.

| Field | Meaning | Consequence of exceeding |
|---|---|---|
| `cap` | **Booking cap** — the commercial limit we sell to | Booking goes to `pending_approval`. Soft. |
| `licensePax` | **Licensed seats** — the registered legal maximum | **Hard block.** Not a warning. |

Display rules:

1. **Never render them adjacent as two bare numbers.** `45 / 47` is unreadable and will be read
   backwards. Render as `45 booked · cap 47` or as a labelled pair.
2. **The capacity bar always plots against `cap`**, with `licensePax` marked as a distinct tick on
   the same bar — one bar, two references, so the relationship is visible.
3. **Three zones, three tones.** `≤ cap` → `ok`. `cap` to `cap + BA_CAP_TOL` (tolerance = 2) →
   `warn`, and the label says "over cap, needs approval". `> licensePax` → `danger`, and the
   control that would cause it is **disabled**, not just warned. A hard block must not be
   expressible in the UI.
4. **The word "capacity" alone is banned in UI copy.** Say "booking cap" or "licensed seats".
   Ambiguity here has a legal edge.

### 8.6 Null, empty, and zero

**A zero and a missing value must never look the same.** This is the rule this section exists for.

| Value | Renders as | Style |
|---|---|---|
| `0` | `0` | Normal ink, DM Mono — it is a real measurement |
| `null` / `undefined` | `—` (em dash) | `--muted` |
| Empty string | `—` | `--muted` |
| Not applicable | `—` with `title` explaining why | `--muted` |
| Failed to load | `⚠` | `--danger`, with `title` |

`0 boats available` is an operational emergency. `— boats available` means the query did not
answer. If they render identically, the emergency is invisible. The monolith gets this right in
its fuel heatmap — a boat that did not run shows `ไม่ออก` / `—`, never `0` — and the rewrite
enforces it globally through the formatter, not per component.

Related: a computed average from a single sample carries an `n=1` marker. This is a real pattern
in the monolith's fuel intelligence page and it is good practice — a low-confidence figure that
looks like a high-confidence figure is worse than no figure.

### 8.7 Truncation and overflow

Truncate with CSS `text-overflow: ellipsis` and always provide the full value in `title`. Never
truncate: a figure, a currency amount, a date, a status label, or an ID. Truncate: names, hotel
names, notes, addresses.

Long free text in a table cell gets `-webkit-line-clamp: 2` rather than a single-line ellipsis —
two lines of a hotel name is usually enough to identify it, one line often is not.

Never truncate by JS `slice()` on a string that may contain Thai (§2.1.4, T6).

---

## 9. Interaction and accessibility

### 9.1 Keyboard

Everything interactive is reachable and operable by keyboard. Concretely:

| Context | Keys |
|---|---|
| Global | Tab / Shift+Tab through the page; `/` focuses the page search where one exists |
| Modal / Drawer | Focus trapped; Esc closes; focus returns to the trigger |
| Popover | Esc closes; focus returns to the anchor; focus is **not** trapped |
| Tabs | ←/→ move, Home/End jump, roving tabindex (only the active tab is tabbable) |
| Typeahead | ↑/↓ move, Enter selects, Esc closes and restores the prior value, Tab commits the highlight |
| Table | Tab reaches row actions; sort headers are buttons and activate on Enter/Space |
| Number field | ↑/↓ step by 1, Shift+↑/↓ by 10 |
| Destructive dialog | Focus lands on **Cancel**, never on the destructive button |

### 9.2 Focus management

`:focus-visible` only — never `:focus`, so a mouse click does not leave a ring. The ring is
`--focus-ring` and is **never** removed, not even on a custom control that "looks better without
it".

After an action that changes context, move focus deliberately: a deleted row moves focus to the
next row; a submitted form with errors moves focus to the first invalid field; a closed dialog
returns focus to its trigger; a route change moves focus to the page `<h1>` (which is `tabIndex={-1}`).

### 9.3 Tab order in dense forms

Tab order follows visual order, which means DOM order must follow visual order. Never use
`tabIndex` above 0 to patch a mismatch — fix the DOM. In a multi-column form grid, tab order runs
**down each logical group, then to the next group** — not left-to-right across unrelated fields,
which is what a naive 3-column grid produces. Group with `<fieldset>` and let the grid place the
groups.

Read-only fields stay in the tab order (staff copy values out of them). Disabled fields leave it.

### 9.4 Screen readers

Landmarks: `<header>` topbar, `<nav>` sidebar, `<main>` content, `<footer>` where present. One
`<h1>` per page. Headings never skip a level.

Live regions: a toast root with `aria-live="polite"` (`assertive` for errors); a status region
announcing async result counts ("24 bookings"). Never announce every keystroke of a filter — debounce
the announcement to 500ms.

Tables use real table semantics with a `<caption>`. Icon-only buttons carry `aria-label`. Loading
states set `aria-busy`. Sortable headers carry `aria-sort`.

### 9.5 Color and contrast

**Targets:** WCAG AA. Body and figures ≥ **4.5:1** against their background. Large text (≥18.66px
bold or ≥24px) ≥ **3:1**. UI component boundaries and focus indicators ≥ **3:1**. These are floors,
not goals — a pier tablet in sunlight is effectively a low-contrast environment before the design
starts.

The token set is built to hit them in both themes. `--muted` on `--panel` is the tightest pair in
the light palette and clears 4.5:1; that is why `--muted` cannot get lighter without re-checking
everything downstream of it.

**Color alone never carries meaning.** This is why the status pill is tint **plus dot** **plus
label** — three channels, of which two survive a color-blind reader and one survives a
photocopier. The same rule applies everywhere: a red row also has a label; a green tick also has
text; a chart series has a direct label, not only a legend swatch.

### 9.6 Touch

Minimum target 40×40px on touch, achieved with padding or a transparent expanded hit area — never
by inflating the visual control. Checkboxes and radios: 20px visual, 40px target. Table row
actions on touch are not hover-revealed; they are always visible or behind an explicit overflow
menu.

No hover-only affordances anywhere. If it only appears on hover, it does not exist on a tablet.

---

## 10. Render traps that are really design constraints

These read as bugs. They are constraints on how components may be built, and each one has already
cost this project real time.

### 10.1 `backdrop-filter` traps dropdowns

**Symptom.** A typeahead dropdown renders *behind* the cards next to it instead of on top, no
matter what `z-index` it is given. In the monolith's own words: ซ้อนกัน — "stacked/overlapping".

**Cause.** `backdrop-filter` creates a new stacking context. An absolutely-positioned child is
then confined to that context and cannot escape above later-painted siblings, regardless of its
`z-index`. `filter`, `transform`, `will-change`, `contain`, `perspective`, `opacity < 1` and
`position: fixed` on an ancestor do the same thing.

**The rule.**

1. The rewrite does not use `backdrop-filter` at all (§2.4).
2. **Every popover, dropdown, tooltip, menu and typeahead renders in a portal** at the document
   root, positioned with a collision-aware anchoring library. This makes the ancestor's stacking
   context irrelevant by construction.
3. Nothing may introduce a stacking context on a form card. Lint for `backdrop-filter`, `filter`,
   `transform` and `contain` on any element matching a card or field-container class.

The monolith documents this in the skin block that works around it: *"form-body cards hold
typeahead dropdowns → NO backdrop-filter (it traps the dropdown in a stacking context). Translucent
bg keeps the glass tint."* That workaround is correct for the monolith and unnecessary in a
portal-based system — which is the point of moving to one.

### 10.2 Scroll-jump on re-render

**Symptom.** Typing in a filter, toggling a row, or saving a field scrolls the list back to the
top and drops focus.

**Cause, monolith.** Replacing a mount's `innerHTML` destroys the focused element. The browser
resets the container's `scrollTop` and focus falls back to `<body>`.

**Cause, React** — the same failure with a different mechanism, and it is *easier* to hit:

- **Unstable keys.** `key={index}` on a filtered list means every item's identity changes when the
  filter changes; React unmounts and remounts the subtree, including whatever had focus.
- **Component identity defined inline.** A component defined *inside* another component's render
  body is a new type on every render, so React unmounts and remounts its entire subtree — a
  guaranteed focus loss that is invisible in code review.
- **Conditional wrapper.** `cond ? <div><Form/></div> : <Form/>` remounts `Form` when `cond` flips.
- **A `key` on a container that changes with data** (`key={selectedDate}`) deliberately remounts —
  useful, but never on a subtree that owns focus.

**The rules.**

1. `key` is a stable domain id. Never an index, never a value that changes with the filter.
2. Never define a component inside a render body. Lint for it.
3. Keep the element tree shape constant across renders — branch on props, not on wrapper structure.
4. A subtree that owns focus is never conditionally remounted. If a re-mount is genuinely needed,
   capture `document.activeElement` and `scrollTop` in `useLayoutEffect` and restore after commit.
5. Async results never replace the whole list — update rows in place so React reconciles.
6. Virtualized lists must be keyed by domain id, not by row index.

### 10.3 Sticky offsets from CSS variables

Covered in §5.4. Symptom: sticky headers gap or overlap by exactly 52px, or by a variable amount
when a second bar is stacked. Cause: a hardcoded `52`, or an assumed height for a bar whose height
depends on content. Rule: read `--topbar`; measure stacked bars with `ResizeObserver` and publish
the offset as a custom property.

### 10.4 `100vh` on iOS

**Symptom.** The bottom of a full-height panel is cut off on an iPhone, and the amount cut off
changes as the URL bar hides.

**Cause.** `100vh` includes the hideable browser chrome.

**Rule.** Use `100dvh` with a `100vh` fallback for any full-height container. `@supports
(height: 100dvh)`.

### 10.5 iOS input zoom

**Symptom.** Tapping a field on a phone zooms the page in and never zooms back out.

**Cause.** Any `font-size` below 16px on a focusable input triggers iOS auto-zoom.

**Rule.** At ≤820px, `input`, `select` and `textarea` are forced to 16px. This overrides the 12px
control size and is correct — a zoomed-in page is a worse density problem than a larger field.
Pair with `html { -webkit-text-size-adjust: 100% }` to stop iOS font-boosting tables on rotate.

### 10.6 `min-width` always beats `max-width`

**Symptom.** A table with a large `min-width` overflows its container and pushes the page
sideways, and adding `max-width: 100%` does nothing.

**Cause.** In CSS, `min-width` wins against `max-width` when they conflict. The table cannot
shrink.

**Rule.** The *wrapper* scrolls, not the table. `.tw { overflow-x: auto }` with the `min-width` on
the inner `<table>` (§4.2). Never put `overflow` on the table itself.

### 10.7 Sticky header hairline flicker

**Symptom.** A sticky table header's bottom border shimmers or disappears during scroll in Blink.

**Cause.** Sub-pixel positioning of a `border-bottom` on a sticky element.

**Rule.** Use `box-shadow: inset 0 -1px 0 var(--line)` instead of `border-bottom` on sticky
headers. The monolith already does this on its manifest table.

### 10.8 Fonts not ready at print time

**Symptom.** A printed document comes out in a fallback font, or blank, intermittently.

**Cause.** `window.print()` fires before webfonts and images have loaded.

**Rule.** Gate printing on `await document.fonts.ready` plus every `<img>`'s decode. Since the
rewrite prints from the live document rather than a popup (§7.2), fonts are already loaded in the
common case — but a print route entered directly still needs the gate.

### 10.9 Escaping is not automatic in string-built HTML

Symptom in the monolith: a passenger name containing `<` breaks a render. Cause: template-string
HTML with no escaping, and `esc()` declared locally in 25+ places rather than globally.

**In React this trap disappears** — JSX escapes by default. The rule is therefore narrow and
absolute: **`dangerouslySetInnerHTML` is forbidden** outside a single reviewed sanitizer used for
one purpose (rendering stored rich-text notes), and that sanitizer is allow-list based.

---

## 11. Migration guidance

The goal is a rewrite staff experience as continuity, not as a new product they have to relearn
during a high season.

### 11.1 Extraction order

1. **Tokens first, with no visual change.** Publish `packages/ui/tokens.css` and verify against
   the monolith's computed values. This is mechanical and independently reviewable.
2. **Status map second.** Build `StatusPill` and the complete status → tone table (§4.1.4). Every
   status in the product is enumerated here; a status not on the list is a bug in the data model.
   This is the highest-leverage single artifact in the migration.
3. **DataTable third.** Most screens are a table plus a filter bar. A correct DataTable makes each
   subsequent screen small.
4. **Forms fourth**, with Typeahead ported early — it is the highest-risk control (portal
   positioning, keyboard, async) and everything else depends on the pattern it establishes.
5. **Layout shell fifth.** Topbar, sidebar, page templates, sticky-offset hook.
6. **Print last, and as its own project.** Print has no shared code with the screen layer beyond
   tokens, and treating it as a phase rather than a footnote is what stops it from being skipped.

Screens follow booking first, per the strangler plan.

### 11.2 What must stay pixel-identical

Staff have muscle memory measured in thousands of repetitions. These do not change:

| Thing | Why |
|---|---|
| **Dense table geometry** — 7px/10px header, 9px/10px cell, 12px text | Row count per screen is a learned quantity. Change it and every "third row down" reflex is wrong. |
| **Status colors and their meanings** | Green-is-good is read pre-attentively. Remapping a hue costs weeks. |
| **The status pill recipe** — tint + 4px dot + label | The single most repeated visual in the product. |
| **Figures in DM Mono, right-aligned** | Scanning a column is a trained skill. |
| **Print documents, all of them** | These leave the building. A guide job sheet that looks different is a support call from a pier. |
| **Sidebar group order and labels** | Navigation is spatial memory. |
| **The 42px hero KPI figure** | Recognized at a glance across every Fleet page. |

### 11.3 What may safely improve

| Change | Notes |
|---|---|
| Radius normalization to 6/10/14 | The most visible improvement per unit of risk |
| Dropping `backdrop-filter` glass | Ship it *with* the module port, never as a standalone "we removed the pretty thing" release |
| One green, one amber, one red, one blue | Nobody can name the current variants; nobody will miss them |
| Focus rings everywhere | Currently absent or inconsistent — pure gain |
| Real empty states | Currently mostly absent |
| Consistent disabled states | Currently invented per module |
| Skin consolidation 17 → 8 | Do it per-module as each is ported, never in one sweep |
| Dark mode | New capability; opt-in, system-default |

### 11.4 Verifying parity

1. **Token diff.** A script reads the monolith's computed `:root` and diffs it against
   `tokens.css`. Every intentional difference is listed with a reason; the list is the review
   artifact.
2. **Status coverage test.** A test asserts every value in every status enum has a tone and a
   bilingual label. Fails the build on a gap. This alone would have caught audit defect #7.
3. **Side-by-side screenshots** at 1440 and 1024, per screen, before and after. Reviewed by
   someone who uses the screen, not only by the person who built it.
4. **Print diff.** Print each document from both systems to PDF and compare page count, page
   breaks, and column positions. Page count changing is a regression even when it looks fine.
5. **The 40-row test.** Every list screen is reviewed with 40+ rows of real data, at real density,
   not with 5 rows of fixtures. Density problems are invisible at 5 rows.
6. **Both languages, every screen.** Thai and English, with the longest real strings, not with
   lorem.

---

## 12. Governance

### 12.1 Adding a token

**Rare, and it should feel rare.** The token set is complete for the product as specified. Before
adding one, answer: is this genuinely a new *concept*, or a value that belongs to a component?
A component-specific value belongs in the component.

Process: propose with the concept and at least three call sites → confirm no existing token covers
it → add to `tokens.css` with **both** theme values (light on bare `:root`, dark repeated in both
dark blocks) → add a swatch to the design doc's specimen grid → review.

**Never** add a token that is a tint or shade of an existing one to solve one component's problem;
use `color-mix()` at the call site.

### 12.2 Adding a component

Process: check the inventory — the answer is usually a variant of something in §4 → if it is
genuinely new, specify purpose, anatomy, variants, **the full state set**, a11y and the prop
contract *before* writing it → build with tokens only, zero literal values → add a specimen to
the design doc → review.

A component ships with: all eight states, keyboard operation, both themes, both languages, and a
specimen. Missing any of those, it is not done.

**Composition rules.** Components compose downward only: primitives (Button, Field, Icon) know
nothing about domain; patterns (DataTable, FormGrid, Modal) compose primitives; features compose
patterns and may know about domain. A primitive that imports a domain type is a layering
violation and fails review.

### 12.3 Adding a skin

**The highest bar in this document.** A new skin means a new visual language in the product, and
seventeen of them is how the monolith got here.

Process: justify why an *existing* skin cannot serve → provide accent, accent-ink, accent-deep,
accent-soft for **both** themes → prove AA contrast for text-on-accent and accent-on-panel in both
→ add to `skins.ts` and to the design doc's skin strip → review by whoever owns the design system.

A skin sets four tokens. A proposal that needs to set a fifth is not a skin — it is a request to
change the design system, and it goes through §12.1.

### 12.4 Keeping the system from drifting back

Six mechanisms, all mechanical:

1. **No literal colors in feature code.** A lint rule bans hex, `rgb()` and `hsl()` outside
   `tokens.css` and `skins.ts`. This is the single most important rule in this section — it is what
   the monolith lacked, and it is why the monolith has 17 visual languages.
2. **No literal font sizes, radii, or durations** outside the token file.
3. **No numeric literal in a sticky `top`.**
4. **No component definitions inside render bodies.**
5. **No `backdrop-filter`, and no `filter`/`transform` on card or field containers.**
6. **No `dangerouslySetInnerHTML`** outside the one reviewed sanitizer.

Plus one social mechanism: **the design doc's specimens are rendered from the real tokens**
(§14 and the HTML companion). If a token changes and a specimen looks wrong, the doc has caught
it. The page is its own regression test.

---

## 13. Open questions

Genuinely ambiguous in the sources. Each needs a decision before the corresponding work starts.

| # | Question | Context | Blocks |
|---|---|---|---|
| Q1 | **Does the rewrite keep per-view accents at all?** This document assumes yes and specifies 8. The alternative — one accent product-wide — is simpler, cheaper, and loses the orientation benefit staff actually use. | §3 | Skin registry, all module ports |
| Q2 | **`pending_approval`: warn or danger?** Spec'd as warn (PROPOSAL); the monolith renders red. Ops should decide — is an approval queue a caution or an alert? | §4.1.4 | Status map |
| Q3 | **`cancelled_weather`: violet or gray?** Spec'd as violet (PROPOSAL) to separate three cancellation types with different refund rules. Confirm the refund rules genuinely differ. | §4.1.4 | Status map |
| Q4 | **Is dark mode in scope for v1?** The tokens support it and the doc specifies it. Shipping it means testing every screen twice. It may be worth deferring to v1.1 while keeping the token structure. | §2.2.4 | Test matrix, effort estimate |
| Q5 | **Where does the voucher hero image actually stand?** `assets/voucher/` holds one orphan file and no code references it; the voucher renders no image at all. Is imagery wanted back on the voucher, or is the current text-only design final? | §7.5 | Route imagery model, `RouteImagery` |
| Q6 | **Do print documents keep their current per-document accents?** Fifteen documents, most with their own color, two deliberately replicating a legacy spreadsheet. Full unification would break the Excel cross-check. Which are cosmetic and which are load-bearing? | §7.5 | Print phase |
| Q7 | **Is `ranong` a real pier?** `CLAUDE.md` calls it planned; the shipped Calendar, Programs and the whole Pier Office nav group already treat it as first-class. Affects every 3-vs-4-group layout. | §4.9, §5.2 | Pier grouping components |
| Q8 | **Does Thai UI text need a size bump, or only a line-height bump?** This doc specifies line-height only (1.55/1.7). If Thai at 13px tests poorly at the pier, a `--fs-body-th: 14px` token is the fix — but it needs testing on the actual devices before it is added. | §2.1.4 | Type scale |
| Q9 | **Mobile scope.** The monolith supports ≤820px as a single retrofitted layer. Is tablet-first pier check-in a v1 target, or does the pier keep using the monolith through cutover? | §5.3 | Responsive effort |
| Q10 | **Does anything still need `#185FA5`?** Collapsing info-blue into Ocean is proposed. Confirm no printed document or external artifact depends on the exact legacy blue. | §2.2.1 | Token set |

---

## 14. Quick reference

The page to keep open.

### 14.1 Tokens

| Group | Tokens |
|---|---|
| Surface | `--bg` `--panel` `--panel-2` `--panel-3` `--overlay` |
| Ink | `--ink` `--ink-2` `--muted` `--ink-on-accent` |
| Line | `--line` `--line-2` `--line-strong` |
| Accent | `--accent` `--accent-ink` `--accent-deep` `--accent-soft` `--accent-faint` |
| Status | `--ok`/`--ok-soft` `--warn`/`--warn-soft` `--danger`/`--danger-soft` `--violet`/`--violet-soft` |
| Type | `--font-sans` `--font-mono` · `--fs-label|micro|table|body|body-lg|h3|h2|h1|kpi|hero` · `--lh-body|tight|flat` · `--ls-label|tight|hero` |
| Space | `--space-2|4|6|8|10|12|14|16|18|22|28|36|48` |
| Radius | `--r-sm:6` `--r:10` `--r-lg:14` (+ `--r-pill:999` = shape) |
| Elevation | `--shadow-sm` `--shadow` `--shadow-pop` `--shadow-modal` `--focus-ring` |
| Motion | `--dur-fast:120ms` `--dur:150ms` `--dur-slow:300ms` `--ease` |
| Layout | `--topbar:52` `--sidebar:220` `--page-gutter:22` `--page-max:1320` `--badge-gap:64` |
| Z | `--z-sticky:40` `--z-topbar:100` `--z-drawer:300` `--z-modal:400` `--z-popover:500` `--z-toast:600` |

### 14.2 The three radii

| Token | px | For |
|---|---|---|
| `--r-sm` | 6 | Buttons · inputs · chips · icon buttons · badges |
| `--r` | 10 | Cards · panels · KPI tiles · table wrappers |
| `--r-lg` | 14 | Modals · drawers · popovers |

Full-round `999px` is pills and segmented tracks. `50%` is avatars, dots, code badges. Neither is a
fourth radius.

### 14.3 Status colors

Six tones. Every business status maps to one.

| Tone | Token | Means | Examples |
|---|---|---|---|
| `ok` | `--ok` | good, done, paid | confirmed · available · paid · verified · ready · on-board · dispatched |
| `warn` | `--warn` | pending, caution | pending FOC · awaiting approval · fixing · awaiting payment · expiring · over cap · cleared · soon |
| `danger` | `--danger` | bad, blocked | rejected · unavailable · overdue · no-show · broken · over licence · unassigned · late |
| `info` | `--accent` | in progress | completed · partly paid · arrived · due |
| `exception` | `--violet` | not-an-error exception | weather cancelled · van conflict · on hold · charter |
| `neutral` | `--muted` | inactive, n/a | quote · cancelled · void · spare · waiting · missed · no data |

### 14.4 Hard rules

1. **Every figure in DM Mono, tabular-nums, right-aligned.** No exceptions on screen.
2. **Every font stack that can hold Thai names a Thai font.** One Thai font in the product.
3. **Three radii: 6 / 10 / 14.**
4. **Six status tones. One token source. No page re-declares a status color.**
5. **Status = tint + 4px dot + label.** Color alone never carries meaning.
6. **A zero and a missing value never look the same.** `0` is ink; missing is `—` in `--muted`.
7. **`cap` and `licensePax` are never rendered as two bare adjacent numbers.** Over licence is a
   hard block, disabled in the UI.
8. **Dates are built with `localYMD()`.** Never `toISOString().slice(0,10)`. Asia/Bangkok, always.
9. **Currency is `฿12,450`.** Prefix, no space, comma groups, zero decimals.
10. **Sticky `top` reads a CSS variable.** Never `52`.
11. **Popovers render in portals.** No `backdrop-filter` anywhere; no stacking context on a form card.
12. **`key` is a stable domain id.** Never an index. Never define a component inside a render body.
13. **Tables scroll inside `.tw`.** The page body never scrolls horizontally.
14. **Icons are inline SVG at 24×24, stroke 2, `currentColor`.** There is no Tabler webfont.
15. **`:focus-visible` is never removed.**
16. **Motion is banned in dense tables and anywhere it delays a keystroke.** KPI figures never animate.
17. **No literal colors, font sizes, radii or durations outside `tokens.css` and `skins.ts`.**
18. **A skin sets four tokens.** Accent, accent-ink, accent-deep, accent-soft. Nothing else.
19. **Print is a product surface.** A4 landscape default, `print-color-adjust: exact` where color is
    data, and every printed status carries a label as well as a color.
20. **Density over decoration.** If a screen looks airy, it is off-system.

---

*Written 2026-08-22 against `refactor/booking-v2-migration`. Sources: `allotment_v2/docs/design/00`–`06`,
`CLAUDE.md` §7–§8, `allotment_v2/docs/workflows/08-shell-dashboards-config.md`,
`documents/rewrite_material/html/_shell.html`, and targeted greps of `allotment_v2/allotment_v2.html`.
Where a doc and the code disagreed, the code won and the disagreement is recorded in place.*
