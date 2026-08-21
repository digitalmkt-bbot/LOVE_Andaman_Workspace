# Skins & Themes

`allotment_v2.html` keeps its visual re-skins as small, named, reversible `<style id="...">`
blocks stacked right before `</head>` (`allotment_v2.html:3337`–`4128`). Per **CLAUDE.md §5**,
most re-skins are "single reversible `<style id="...-skin">` blocks — delete the block to
revert." This doc catalogs each one: what it targets, exactly what it overrides, the glass
recipe they share, and the coral→Ocean-blue token rename that is the app's brand identity.

Base tokens (pre-skin) live in the root `:root{}` block at `allotment_v2.html:1201-1202`:
`--ocean:#1a6a8a; --ocean-mid:#2196be; --ocean-light:#c8eaf5; --ocean-50:#edf7fc;`
`--coral:#e05a38; --coral-light:#fbe8e3;` — this is the "before" picture the Ocean skin edits.

---

## `bkv2-buildaxis-skin` — `allotment_v2.html:3337`

**Scope:** `#view-booking` (Booking v2 — calendar, matrix, seat locks, all sub-tabs).

**What it changes:** a full re-skin of Booking v2's font/color/geometry, independent of the
Ocean skin below:
- Font swapped to `'Inter'`, tabular numerals forced (`font-variant-numeric:tabular-nums`).
- New local accent ramp on `#view-booking` itself: `--bk-navy-deep:#2952C8` → `--bk-navy:#3A6FF7`
  → `--bk-navy-mid:#7DA0E8` → `--bk-navy-soft:#AFC4F0` → `--bk-navy-light:#D6E2FB` →
  `--bk-navy-50:#EEF3FF`.
- Redefines the shared `--coral`/`--coral-light`/`--coral-soft` tokens *inside this scope only*
  to point at the navy-blue ramp (`#3A6FF7` / `#EEF3FF`) instead of Ocean's `#1683C7` — Booking
  has its own bluer, cooler accent than the rest of the app.
- Card geometry vars: `--r:16px; --r-sm:11px; --r-lg:18px;` and a flat shadow
  `--shadow:0 1px 2px rgba(15,23,42,.04),0 1px 3px rgba(15,23,42,.06)`.
- Adds soft shadows to cards that previously had border-only (`.bkv2-stat`, `.bkv2-route-card`,
  `.t2-tripcard`, `.t2-listcard`, `.t2-famcard`, `.t2-side`), and bumps trip/list/family cards to
  `border-radius:16px`.
- Cream cards → clean white/pale-blue (`.bkv2-route-card` → `#fff`, `.bkv2-week-summary` →
  `#EEF3FF`), calendar day chips → cooler neutral (`#F1F5F9`), headings heavier
  (`font-weight:800`), active tab → filled navy.
- **Topbar "Option A" (underline tabs):** `.bkv2-topcard` stripped to transparent/no-border;
  `.bkv2-utabs`/`.bkv2-meta2`/`.bkv2-vseg`/`.bkv2-datechip` become floating glass pill islands
  (see Glass Recipe below) with `backdrop-filter:blur(16px) saturate(1.4)`.
- **Seat Locks tab gets a distinct RED tone** to differentiate it from the blue booking views:
  `.bkv2-locks .bkv2-stat.hero{background:#C0392B;border-color:#9A2D1E}` plus red buttons/inputs.
- **Matrix cell states:** empty/open cells → soft green (`#E9F7EF`/`#3E9B6E`, hover
  `#D6F0E1`/`#2E8159`); selected cell = filled blue outline.
- **Today vs Selected disambiguation** (explicit design decision, comment in source): Today = soft
  tint + blue ring (`#EAF1FE`/`#2952C8`, ring `#9DBFF6`) — "a marker, not a pick"; Selected = solid
  filled blue (`#3A6FF7`, white text) — "the active click." Applied consistently across matrix day
  header, matrix cell, and calendar day cell.

**Reversibility:** safe to delete — everything is `#view-booking`-scoped CSS on top of classes
that exist in the base render functions. Deleting it reverts Booking v2 to plain Inter-less,
flat-shadow, single-accent styling.

---

## `softui-ocean-skin` — `allotment_v2.html:3443` — **the brand recolor**

**Scope:** global (`:root` token overrides) + `.topbar*`, `.brand-icon`, `.sidebar`, `.nav-item*`.

This is the single block that turns the app's original **coral/orange** accent into
**Ocean blue `#1683C7`**, and applies a soft-UI (neumorphic) finish to the topbar and sidebar.

### Token map (coral → Ocean blue)

| Token (scope) | Before (base, `:root`/section block) | After (`softui-ocean-skin`) |
|---|---|---|
| `--fd-coral` (FOC Detail, `:1948`) | `#ff6b47` | `#1683C7` |
| `--fd-coral-soft` | `#fde4dc` | `#E1F0FA` |
| `--fd-coral-veryfaint` | `#fef5f0` | `#F1F8FD` |
| `--fd-coral-deep` | `#d44521` | `#0E6AA8` |
| `--aos-coral` (Add-on Services, `:1819`) | `#ff6b47` | `#1683C7` |
| `--aos-coral-soft` | `#fde4dc` | `#E1F0FA` |
| `--aos-coral-veryfaint` | `#fef5f0` | `#F1F8FD` |
| `--aos-coral-deep` | `#d44521` | `#0E6AA8` |
| `--coral` (root, `:1202`) | `#e05a38` | `#1683C7` |
| `--coral-light` | `#fbe8e3` | `#E1F0FA` |

Note: `--ocean` / `--ocean-mid` / `--ocean-light` / `--ocean-50` (`:1201`, already a blue ramp)
are **not** touched by this skin — only the coral/orange accent tokens are remapped. The reused
Ocean blue ramp across the codebase is:

```
Deep     #0E6AA8   (…-deep)
Base     #1683C7   (the brand accent — "Ocean blue")
Soft bg  #E1F0FA   (…-soft)
Faint bg #F1F8FD   (…-veryfaint)
```
(Booking v2's own navy ramp in `bkv2-buildaxis-skin` — `#2952C8`/`#3A6FF7` — is a parallel,
bluer-and-brighter variant used only inside `#view-booking`, not part of this token map.)

### Non-token overrides (topbar / sidebar soft-UI)

| Selector | Change |
|---|---|
| `.topbar` | flat gray `#E8EBF1`, border removed, soft drop shadow `0 6px 14px -8px #c5cad6` |
| `.topbar-brand` / `.topbar-sub` / `.topbar-sep` / `.topbar-date` | recolored to muted grays (`#3F4654`, `#9AA0AE`, `#D4D8E2`, `#8B91A0`) |
| `.brand-icon` | neumorphic raised: `background:#E8EBF1`, dual shadow `3px 3px 6px #c5cad6, -3px -3px 6px #ffffff`; SVG stroke → `#1683C7` |
| `.topbar-btn` | same neumorphic raised look; `:active` → **inset** shadow (pressed state); `[onclick*="Backup"]` → blue text; `[onclick*="reset"]` → red `#CC3B3B` |
| `.sidebar` | flat `#E8EBF1`, border removed |
| `.nav-item` | muted gray text/borders; `.active` → neumorphic **inset** shadow + `#1683C7` text/icon (pressed-in look for the active page) |
| `.sidebar-footer` | muted gray, top border `#D4D8E2` |

**Reversibility:** safe to delete — it only overrides existing tokens/selectors defined in the
base stylesheet (root tokens at `:1201-1202`, `:1819`, `:1948`; topbar/sidebar classes in the
base `<style>`). Deleting it reverts the whole app to the original coral accent and flat topbar.

---

## `md-glass-skin` — `allotment_v2.html:3470`

**Scope:** `#view-marketdata` (Demand/Market Intelligence, incl. dark mode `.md-dark`).

**What it changes:** the most elaborate glass treatment in the app.
- Base view gets a diagonal pastel gradient background plus **three blurred color-blob
  pseudo-elements** (`::before`, `::after`, `.md-blob3`) — orange `#FBC79A`, mint `#A8E0CF`, pink
  `#F6A8C0` — each `filter:blur(74-76px)` at low opacity, positioned absolutely to fake a frosted
  "aurora" backdrop behind the glass cards.
- `.md-gp`, `.md-card`, `.md-kpi`, `.md-tile`, `.md-importer`, `.md-band`, `.md-dk` — each a
  variant of the glass recipe (see below) at different blur strengths (12–32px) and opacity.
- `.md-import-glass` (import button) uses a gradient glass fill plus a circular icon badge with
  its own blue gradient (`linear-gradient(135deg,#37A0E0,#1683C7)`).
- `.mb-cal` (date badge) — solid blue gradient block `linear-gradient(135deg,#1683C7,#0E6AA8)`,
  not glass.
- `.md-dark` variant: swaps the gradient to warm dark brown/maroon
  (`#43291F→#5E3A2C→#4E3128→#2B1E1A`), blobs recolored orange/teal, `.md-dk` becomes a dark-glass
  card (`rgba(255,255,255,.1)` on dark, `blur(32px)`).

**Reversibility:** partially structural — the pseudo-element color blobs (`::before/::after`,
`.md-blob3`) and the dark-mode gradient are *defined only here*; there is no base fallback
styling for `#view-marketdata`'s background in the main stylesheet, so deleting this block would
leave the view with default page background (functionally fine, but loses the whole visual
identity of the page — treat as "delete = flatten to plain," not "delete = revert to prior skin").

---

## `bkv2-liquid-skin` — `allotment_v2.html:3520`

**Scope:** `#view-booking .bkv2-stat`, `.bkv2-route-card`, `.bkv2-bodycard`, `.bkv2-selday`,
`.bkv2-cal-cell`.

Explicitly commented in source as **"material only · colors kept · reversible: delete this
block."**

- Cards get `border-radius:18px`, a 3-layer shadow (ambient `0 12px 30px rgba(20,40,80,.11)`,
  contact `0 2px 6px rgba(20,40,80,.05)`, inset top highlight `inset 0 1px 0 rgba(255,255,255,.7)`)
  and a hover lift (`translateY(-2px)`, deeper shadow).
- `.bkv2-cal-cell` gets `border-radius:12px` + inset top highlight only (no blur — this is a
  "liquid card," not frosted glass; no `backdrop-filter` here).
- **Past-day de-emphasis** (`§bkCalPast` comment): past, non-today, non-selected calendar cells
  get a flat beige-gray (`#F4F2ED`/border `#E5E2DA`), dimmed day number (`#a8a59d`), and chips
  drop to `opacity:.5;filter:saturate(.6)` (restored to full on hover).
- **Weekend handling** (`§bkCalWeekend` comment): weekend cells that are *not* past stay plain
  white (`var(--white)`) rather than a beige "holiday" tint, specifically so they don't visually
  collide with the past-day gray — weekend-ness is only signaled via a fainter SUN/SAT column
  header.

**Reversibility:** safe to delete (confirmed by source comment) — pure material/shadow layer over
existing classes, no new structural rules.

---

## `cal-liquid-skin` — `allotment_v2.html:3546`

**Scope:** `#view-calendar .cal-card` (the separate Overview/Calendar view, not Booking v2).

Same "material only, reversible" pattern as above: `border-radius:22px`, translucent border
`rgba(255,255,255,.65)`, layered ambient+contact+inset-highlight shadow, hover lift with deeper
shadow. Five lines total — the smallest skin block in the set.

**Reversibility:** safe to delete.

---

## `dash-glass-skin` — `allotment_v2.html:3551`

**Scope:** `#dash-wrap` (Overview dashboard).

- Page background: four soft radial-gradient color washes (mint/blue/amber/green) over a pale
  base `#FAFCF7`.
- **Generic white-card catch-all:** `#dash-wrap [style*="background:#FFFFFF"]` — targets any
  inline-styled white card by attribute-substring selector (not a class) and converts it to
  frosted glass (`rgba(255,255,255,.56)`, `blur(17px) saturate(1.08)`). Comment: *"every white
  dx.card → frosted glass · ไม่แตะ logic"* (doesn't touch logic).
- `.dgx-bookings` (green KPI panel): dark green gradient `#0F7C47→#0A5F3A→#08502F` with deep
  ambient shadow + inset top highlight — solid, not translucent.
- Nested chart well inside it, selected again via inline-style substring
  (`[style*="rgba(255,255,255,.04)"]`) → recessed frosted layer with inset shadows top+bottom
  (top highlight, bottom "carved-in" shadow).
- 4 mini stat cards, selected via `[style*="rgba(255,255,255,.06)"]` → raised glass gradient
  (light-top-to-dark-bottom) simulating a lit bevel.
- `.dgx-fleet` (dark Fleet Score card): dark frosted glass
  (`rgba(48,40,33,.86)→rgba(26,20,15,.9)`, `blur(16px) saturate(1.1)`).
- `.dgx-fcell` (fleet day cells): raised liquid-glass sheen gradient + triple shadow
  (inset highlight, contact shadow, ambient shadow) + `blur(5px) saturate(1.15)`.

**Reversibility:** the comment says *"reversible: delete this block + revert the vivid dx
tokens"* — i.e. deleting the `<style>` block alone is not quite enough; some "vivid dx tokens"
(inline `dx.card` color constants elsewhere in JS) were also changed as part of this re-skin and
would need reverting separately for a full revert. **Note the inline-style-substring selector
technique** (`[style*="background:#FFFFFF"]`) — fragile if the JS ever changes those literal
inline hex strings, the skin silently stops matching.

---

## `bop-glass-skin` — `allotment_v2.html:3601`

**Scope:** `#view-operation` (Boat Operation), `.bo-card`, `.bo-tile`.

Comment: *"keeps existing colors · remove this block to revert."*
- Page background: four radial-gradient washes (mint/orange/blue/pink) over a diagonal
  near-white gradient.
- `.bo-card`: gradient glass fill `linear-gradient(135deg,rgba(255,255,255,.46),rgba(255,255,255,.30))`,
  `blur(26px) saturate(1.5)`, translucent white border, ambient+double-inset-highlight shadow.
- `.bo-tile`: `blur(16px) saturate(1.4)`, translucent border, plus a `::before` pseudo-element
  overlay — a top 42%-height gradient sheen (`rgba(255,255,255,.45)→transparent`) clipped with an
  asymmetric border-radius (`16px 16px 40px 40px`) to fake a glossy top highlight on the tile.

**Reversibility:** safe to delete per source comment.

---

## `topbar-float-skin` — `allotment_v2.html:3632`

**Scope:** `.topbar` (global), `:root` (`--topbar` CSS var).

Structural, not color: removes the topbar as a docked bar entirely.
- `:root{--topbar:0px}` — the layout-offset var (used by sticky headers per CLAUDE.md §6, "never
  hardcode `52`") is zeroed, since the bar is no longer taking layout space.
- `.topbar` becomes `position:fixed`, transparent, `pointer-events:none` (lets clicks pass through
  to content underneath except its own children).
- `.topbar-brand`/`.topbar-sep` hidden entirely.
- `.topbar-right` (the tool buttons) hidden by default, shown only when `.topbar.tools-open` —
  i.e. the full toolbar is now a collapsed flyout toggled by `.topbar-toggle`, styled as a
  neumorphic round button matching `softui-ocean-skin`'s raised/inset language (raised at rest,
  `#1683C7` fill + inset shadow when `tools-open`).
- `.app{margin-top:0}` and `.sidebar{top:0}` reclaim the vertical space the docked topbar used to
  reserve.

**Reversibility:** NOT safely deletable in isolation for full revert — it depends on
`.topbar-toggle` and the `.topbar.tools-open` state class existing/being wired up in JS (the
toggle button markup itself lives in the runtime, not in base CSS as a no-op). Deleting just this
style block would leave `.topbar-right` permanently hidden (default `display:none` with no
`.tools-open` escape if the JS-side toggle isn't separately verified) — treat as a paired
JS+CSS feature, back up before touching.

---

## `bkv2-nb-glass-skin` — `allotment_v2.html:3647`

**Scope:** `#view-booking .bkv2-nb` (New Booking form), `.bkv2-nb-sec`, `.bkv2-nb-card`,
`.bkv2-nb-topbar`, `.bkv2-review-sticky`.

**This is the block that documents the backdrop-filter/dropdown-trap gotcha directly in its own
comment** (matches CLAUDE.md §6 "Gotchas" verbatim):

> *"form-body cards hold typeahead dropdowns → NO backdrop-filter (it traps the dropdown in a
> stacking context = "ซ้อนกัน"). Translucent bg keeps the glass tint."*

- Page background: three radial-gradient washes (mint/blue/pink) over a near-white diagonal.
- `.bkv2-nb-sec` / `.bkv2-nb-card` (form-body cards with dropdowns): **translucent gradient
  background only, no `backdrop-filter`** — `rgba(255,255,255,.78)→rgba(255,255,255,.66)`.
- `.bkv2-nb-topbar` / `.bkv2-review-sticky` (no dropdowns inside) — *these* get full glass:
  `blur(20px) saturate(1.35)`.

**Reversibility:** safe to delete.

---

## `sidebar-glass-skin` — `allotment_v2.html:3673`

**Scope:** `.sidebar`, `.main`, `#la-userbadge`, plus an inline `<script>` that injects a
`.sb-profile` header (avatar + greeting + collapse toggle) into the sidebar DOM at runtime.

Comment: *"revert = restore BACKUP/allotment_v2_20260705_pre_glass_sidebar.html"* — i.e. **this
one explicitly says deleting the block is NOT sufficient**; it's tied to the injected
`.sb-profile` DOM node and the `sb_collapsed` localStorage-driven collapse behavior (an allowed
tiny UI-pref key per CLAUDE.md §2).

- `.sidebar`: floats off the edge (`top:6px;left:14px;bottom:10px`), `border-radius:24px`,
  glass fill (`rgba(255,255,255,.56)` + top radial highlight), `blur(26px) saturate(1.5)`,
  large soft ambient shadow `0 22px 52px -18px rgba(38,52,100,.5)`.
- `.main{margin-left:274px}` — reclaims the space for the now-floating (not edge-docked) sidebar.
- `.nav-item.active` → solid Ocean blue fill (`#1683C7`) with a blue glow shadow (this **overrides**
  `softui-ocean-skin`'s neumorphic-inset active state — later-loaded block wins for `.sidebar`
  contexts specifically).
- Collapsed rail mode (`.sidebar.sb-collapsed`, width `84px`): icons-only, nav-section labels
  collapse to a thin divider line, sub-items hidden.
- `#la-userbadge` (user/logout box) restyled to sit as a glass footer pinned to the sidebar
  bottom, with its own collapsed-width variant.
- Runtime script: builds `.sb-profile` (avatar initials from `window.LA_ME`, greeting, collapse
  toggle button) and prepends it into `.sidebar`; persists collapse state to
  `localStorage.sb_collapsed` (an explicitly allowed key per CLAUDE.md §2).

**Reversibility:** NOT a clean CSS-only revert — the accompanying `<script>` mutates the DOM
(inserts `.sb-profile`/`.sb-divider` nodes) independent of the style block; the source comment
points at a full-file backup restore instead of a block deletion.

---

## `bkv2-cal-filter-skin` — `allotment_v2.html:3748`

**Scope:** `#view-booking .bkv2-cal-filter` (route/program multi-select filter pills on the
booking calendar) and `.bkv2-cal-daytot` (per-day total badge).

Small, purely additive feature-styling block (pills, dot indicator, active-state color via the
`--fc` custom property set inline per pill for per-route coloring, and a bold monospace day-total
badge in the corner of each calendar cell). No glass, no color-system rename.

**Reversibility:** safe to delete, but note it styles a *feature* (the filter pills/day-total
badge), so deleting removes visible functionality-adjacent styling, not just decoration —
verify the feature still renders sanely unstyled before removing.

---

## `cost-v2-skin` — `allotment_v2.html:3761`

**Scope:** `#cost-dw-ov` / `#cost-dw` (Cost Analytics detail drawer — a slide-in panel, not a
view-scoped re-skin).

This is a **structural** style block (defines an entire slide-out drawer component from
scratch: overlay, panel, header, KPI chips, tab pills, scrollable table body, sticky table head,
responsive collapse at `820px`) rather than an override of pre-existing base styles — the
drawer's HTML/classes (`.cdh`, `.cdk`, `.cdt`, `.cdb`, `.cpill`, etc.) have **no styling anywhere
else in the file**.

**Reversibility:** NOT safely deletable — deleting this block leaves the Cost Analytics drawer
completely unstyled (raw unstyled `<div>`/`<table>` markup), since there is no base CSS fallback
for `.cdh`/`.cdk`/`.cdt`/`.cdb` etc. This is a component stylesheet wearing a "skin" id, not a
reversible override.

---

## `bkv2-vc-skin` — `allotment_v2.html:3804`

**Scope:** `#view-booking .bkv2-vc` (Booking Detail / voucher-check view only — explicitly *not*
`.bkv2-nb`, even though both share some class names).

Source comment (translated): *"same design set as Daily Report · same structure entirely, only
change what's visible · scoped to `.bkv2-vc` only (New Booking uses `.bkv2-nb` too, would get
hit if not scoped) · must load after `bkv2-nb-glass-skin` in file order · many lines need
`!important` because the glass skin already declared background/border/box-shadow with
`!important`."* This is the clearest **explicit cascade-order dependency** among all the skins.

- Defines a local Daily-Report-matching palette on `.bkv2-vc`: `--dg:#f3f4f6` (page bg),
  `--di:#111827` (ink), `--d2:#1f2937`, `--dm:#6b7280`, `--df:#9ca3af`, `--dl/--dl2` (dividers),
  `--dind:#4f46e5` (indigo accent dot), `--dblu:#2563eb`, `--dem7:#047857` (emerald),
  `--dam7:#b45309` (amber), `--dro7:#be123c` (rose).
- Breaks out of `.main`'s padding with negative margin (`margin:-22px -22px 0 -14px`) so the gray
  background runs edge-to-edge like Daily Report, while re-centering inner content back to
  `max-width:1320px`.
- Explicitly turns **off** `backdrop-filter:none` on `.bkv2-nb-topbar` inside this scope — undoing
  the glass topbar from `bkv2-nb-glass-skin` for the voucher/detail view specifically, replacing
  it with a flat white bar + `border-radius:24px`.
- Cards get `border-radius:24px`, no border, two-layer soft shadow (`0 10px 25px -5px
  rgba(0,0,0,.03), 0 8px 10px -6px rgba(0,0,0,.02)`), deepening on hover.
- **Alert-card color restoration:** because the glass skin's `!important` background/border wins
  by default, this block explicitly restores color-coded backgrounds for 4 specific alert card
  variants matched by inline `style*="border-color:#..."` substring (FOC pending amber `#F59E0B`→
  `#fffbeb`/`#fde68a`; FOC decided green `#10B981`→`#ecfdf5`/`#a7f3d0`; cancellation red
  `#c43a2e`/`#E89A92`→`#fef2f2`/`#fecaca`).
- `.bkv2-vcdoc` (voucher document header) styled as a white "paper" card, `border-radius:26px`,
  `max-width:760px`.
- Mobile (`≤820px`): reverses the negative-margin breakout (base `.main` padding is only 8-10px on
  mobile, so the desktop breakout would overflow), and the top ticket block switches from a fixed
  200px-image-left layout to stacked column with a dashed divider — "image + text side-by-side
  breaks at 390px width, stack instead."

**Reversibility:** must be deleted together with (or after) `bkv2-nb-glass-skin` is understood —
it depends on cascade order (must load *after* it) and actively fights its `!important`s. Deleting
`bkv2-vc-skin` alone reverts Booking Detail to the glass-topbar/generic-card look shared with New
Booking (probably fine); deleting `bkv2-nb-glass-skin` without also revisiting this block could
leave stale `!important` overrides targeting a glass style that's no longer there (likely harmless
since the overrides degrade to sensible flat values, but re-verify visually).

---

## `la-mobile` — `allotment_v2.html:3900`

**Scope:** global responsive layer. Comment: *"mobile layer · doesn't touch desktop layout at
all"* — everything is gated behind `@media` queries or the `.la-burger`/`.la-navdim` elements
which are `display:none` by default (desktop no-op).

### Breakpoints

**Un-gated (all widths):**
- `html{text-size-adjust:100%}` — disables iOS auto font-boost on rotate (would otherwise distort
  tables).
- `.la-burger` (hamburger button) defined but `display:none` until mobile.
- `.la-navdim` (nav scrim) defined but `display:none` until mobile.

**`@media (max-width:820px)` — the main mobile breakpoint:**
| Area | Collapse/restack behavior |
|---|---|
| Hamburger | `.la-burger` becomes visible (`inline-flex`); topbar date hidden |
| Topbar tools | `.topbar-right` becomes an absolutely-positioned floating panel below the `⋯` toggle (`290px` wide, dark `#0f1f2e` bg) instead of an inline row that would overflow |
| Sidebar | becomes a slide-in drawer: `translateX(-102%)` off-canvas by default, slides to `0` when `body.la-nav-open`; width `min(86vw,300px)`; `.sidebar.sb-collapsed` (desktop rail mode) is neutralized back to full-width labeled items — "narrow rail mode isn't used on mobile" |
| Scroll container | `.main` becomes the app's own scroll container (`height:100vh; overflow:auto`) instead of `body`, specifically because check-in tables set `min-width:1420px` and letting `body` scroll would drag the topbar/drawer along horizontally too |
| Inputs | forced `font-size:16px` on all `input/select/textarea` — below 16px iOS auto-zooms in on focus and doesn't zoom back out; checkboxes/radios floored to `20px` tap target |
| Wide tables | `.la-xscroll` and any inline `overflow-x:auto` / `overflow:auto` container get contained horizontal scroll, not page-level |
| Multi-col grids (inline `style=`) | `repeat(2..6)`, `1fr 1fr`, `repeat(auto-fit...)` → forced to 2 columns; `1fr 310px` / `2fr 1fr` / `1fr 1fr 1fr 1.4fr` → forced to 1 column. Real calendar grids (`.fc-grid`, `.mg`, `.cal2-grid`, `.bkv2-cal-grid`) are exempted and instead get `min-width:640px` + horizontal scroll, "must keep 7 columns" |
| Flex 2-column pages | `#view-agents .sb-wrap`, `#view-rate-types .sb-wrap`, `#view-costing .ct-wrap` → `flex-direction:column`, side panel goes full width |
| Modals | `.modal-box`/`.tm-modal`/`.aos-modal` → full-width/full-height (`max-height:88dvh`) instead of a floating box |
| Corner badges | `#la-viewonly`/`#la-refresh` lifted above the iOS home-indicator via `env(safe-area-inset-bottom)` |
| User badge | `#la-userbadge.la-ub-inside` moves from floating/fixed to static, inline at the bottom of the sidebar drawer — avoids being obscured by the browser's own bottom toolbar |
| Calendar boxes | `.cal2-box`, `.bkv2-cal` get scroll containment (`overflow-x:auto`) with inner min-widths (`600px`) so headers stay aligned to columns while scrolling |
| Tap targets | blanket `min-height:40px` on every `button`/`.btn`/`select`/text-like `input` inside `.view` |
| Grid-column placement | any inline `grid-column:` reset to `auto` (5th-column cards would otherwise hang off-screen once the grid collapses to 1-2 cols) |
| Negative-margin breakouts | `margin:-22px…`/`margin:14px -16px -16px`/`margin:0 -22px` inline styles re-scaled to match mobile's smaller `10px` `.main` padding (desktop assumes 22px/16px padding) |

**`@media (max-width:520px)` — small-phone breakpoint (nested further collapse):**
- All the 2-6 column inline grids from the 820px tier now collapse to **1 column**.
- `.main` padding drops to `10px 8px`; `.page-hd` stacks vertical.
- Any un-wrapped inline `display:flex` row (not already `flex-direction:column`, not
  `.la-nowrap`) gets `flex-wrap:wrap` — "long horizontal rows that were nowrap now wrap only when
  content doesn't fit."
- A long explicit list of **class-based** (not inline-style) multi-column grids across nearly
  every view (`.g2/.g3/.g4`, `.form-2/.form-3`, `.sb-wrap`, `.dr-*`, `#view-agents .*`,
  `#view-booking .*`, `#view-rate-types .*`, `#view-costing .*`, etc.) all collapse to 1 column.
- Pax-count grid is the deliberate exception: `.bkv2-nb-pax-row`/`.bk-pax-grid` stay at
  **2 columns** ("2 rows still easier to fill than one stretched row").
- `:has(> table)` wrapper rule: any element directly wrapping a `<table>` gets forced
  `overflow-x:auto` — targets tables with hardcoded huge `min-width` (e.g. `.ck-tbl` at 1420px)
  where `min-width` always beats `max-width`, so the *wrapper* must scroll instead of the table
  shrinking. A `:has()`-unsupported fallback caps tables *without* an inline `min-width`.
- Card containers around calendars/heatmaps/tables (`.bo-card`, `.cal2-card`, `.ts-card`,
  `.ck-card`, `.fl-card`, `.bkv2-card`, `.card`) get `overflow-x:auto` directly.
- Any inline `grid-template-columns` not matching a 7-column/calendar exemption list collapses to
  1 column (comment notes a prior pass "missed patterns like Dashboard's `1fr 1.7fr 1fr`").
- Flex/grid children get `min-width:0` (fixes children with fixed widths overflowing their
  shrunk parents); inline `width:` (non-table/svg) capped at `max-width:100%`;
  `flex-shrink:0` demoted to `1`.
- JS-rendered `-host` containers' negative margins zeroed on small screens.

**`@supports (height:100dvh)` block:** on iOS, `100vh` includes the (hideable) URL bar and clips
content; swaps `.main`/`.la-navdim` height to `100dvh` (dynamic viewport height) at the 820px
breakpoint only where supported.

**Reversibility:** safe to delete for a desktop-only rollback (comment guarantees zero desktop
impact) but doing so **removes all mobile support** — this is the only block that is a complete,
load-bearing responsive layer rather than a decorative re-skin.

---

## Runtime-injected `<style id="…">` blocks (outside the head skin stack)

These are built by JS and injected into component-local hosts at render time — not part of the
head skin stack, but follow the same `id="...-skin"`/`id="...-style"` naming convention. Noted
briefly since a grep for `-skin` surfaces them:

| id | Line | Host | Note |
|---|---|---|---|
| `rc-skin` | `allotment_v2.html:44731` | `#reconfirm-host` | Small component stylesheet (cards, table, tab pills); active tab already uses Ocean blue `#1683C7` literal (not a var) |
| `vck-style` | `allotment_v2.html:48302` | `#vancheckin-host` | Shared check-in CSS via `ckSharedCSS()` |
| `pck-style` | `allotment_v2.html:51523` | `#piercheckin-host` | `ckSharedCSS()` + pier-specific extra/card/pay CSS |
| `dr-style` | `allotment_v2.html:54613` | Daily Report wrapper | Built by `drCSS()` — this is the palette `bkv2-vc-skin` deliberately imitates |
| `ts-style` | `allotment_v2.html:55128` | — | Built by `tsCSS()` |
| `pl-style` | `allotment_v2.html:57698`, `81995` | Project/Payroll-type host | Built by `pxCSS()` / `pjCSS()+plCSS()+poCSS()` (two different call sites reuse the id) |
| `po-style` | `allotment_v2.html:80080` | — | Built by `poCSS()` |
| `pa-style` | `allotment_v2.html:81282` | — | Combines `pjCSS()+plCSS()+paCSS()+poCSS()` |
| `pj-style` | `allotment_v2.html:83041` | — | `pjCSS()` + optional `plCSS()` |
| `bkv2-t2-style` | `allotment_v2.html:73023` | Booking "by trip date" tab | Layout CSS for `.t2-shell`/`.t2-side`/`.t2-hd*`; reads `var(--topbar,52px)` for its sticky header offset, consistent with the CLAUDE.md sticky-header-offset gotcha |
| `sty` (generic) | `allotment_v2.html:51203, 83319, 83633` | print/export HTML documents | Not app-facing — used when building standalone printable HTML (voucher/contract exports) |

These are component stylesheets (no base-CSS fallback), not overrides — none are "delete to
revert," they are the only styling their component has.

---

## The glass recipe (extracted)

Every glassmorphism block in the skin stack (`md-glass-skin`, `dash-glass-skin`,
`bop-glass-skin`, `bkv2-nb-glass-skin`'s topbar/review panel, `sidebar-glass-skin`, and the
floating islands in `bkv2-buildaxis-skin`) is a variation on the same four-part recipe:

```css
/* base glass recipe */
background: rgba(255,255,255, 0.30–0.78);           /* translucency varies 18%–78% by prominence */
backdrop-filter: blur(12px–32px) saturate(1.08–1.8); /* stronger blur = more "floating", used on
                                                         panels further from page background */
-webkit-backdrop-filter: <same>;                     /* Safari prefix always paired 1:1 */
border: 1px solid rgba(255,255,255, 0.55–0.85);      /* thin bright edge simulates a glass rim */
box-shadow:
  0 Npx Mpx rgba(<tinted-dark>, .08–.20),             /* ambient drop shadow, color-tinted per view
                                                          (green-tinted on dashboard, blue-tinted
                                                          on market data, near-black on sidebar) */
  inset 0 1px 0 rgba(255,255,255, .38–.95);           /* top inner highlight = the "sheen" */
```

**Variation by block:**
| Block | bg alpha | blur | saturate | shadow tint |
|---|---|---|---|---|
| `md-glass-skin` `.md-card` | .58 | 20px | 150% | `rgba(30,55,90,.09)` (cool blue) |
| `md-glass-skin` `.md-dk` (dark) | .10 | 32px | 170% | `rgba(0,0,0,.26)` |
| `dash-glass-skin` catch-all | .56 | 17px | 108% | `rgba(18,60,42,.09)` (green) |
| `bop-glass-skin` `.bo-card` | .30–.46 | 26px | 150% | `rgba(20,60,55,.12)` (teal) |
| `bkv2-nb-glass-skin` topbar | .44–.6 | 20px | 135% | `rgba(30,60,90,.08)` (blue) |
| `sidebar-glass-skin` `.sidebar` | .56 | 26px | 150% | `rgba(38,52,100,.5)` (indigo, much darker/larger — floating card, not a panel) |
| `bkv2-buildaxis-skin` topbar islands | .72 | 16px | 140% | `rgba(31,42,68,.13)` |

The tint color of the ambient shadow is chosen per-view to match that view's background wash
(green dashboard → green shadow, blue market data → blue shadow, etc.) — a deliberate detail, not
noise.

### `backdrop-filter` caution list (dropdown-trap risk)

Per CLAUDE.md §6: *"`backdrop-filter` creates a stacking context that traps typeahead dropdowns…
Keep it off form-body cards that contain dropdowns."* Every selector across the whole file that
sets `backdrop-filter` (head skins + a handful of inline runtime styles) — check any of these
before adding a dropdown/typeahead inside them:

- `allotment_v2.html:1764` `.tm-modal-backdrop` (modal scrim, not a form card — fine)
- `allotment_v2.html:1875` `#view-addonsvc .aos-modal-backdrop` (scrim — fine)
- `allotment_v2.html:2779` `#view-agents .ag-edit-backdrop` (scrim — fine)
- `allotment_v2.html:2843` `#view-agents .ct-wiz-backdrop` (scrim — fine)
- `allotment_v2.html:2931` `#view-agents .ct-arch-backdrop` (scrim — fine)
- `allotment_v2.html:3384` `.bkv2-utabs`, `.bkv2-meta2`, `.bkv2-vseg`, `.bkv2-datechip` (tab/segment/date pills — no dropdowns expected, but confirm before adding one)
- `allotment_v2.html:3475-3518` `md-glass-skin`: `.md-gp`, `.md-import-glass`, `.md-card`, `.md-kpi`, `.md-tile`, `.md-importer`, `.md-band`, `.md-dk` — **`.md-importer` in particular hosts an import control; verify no typeahead lives inside it**
- `allotment_v2.html:3564-3598` `dash-glass-skin`: generic white-card catch-all, `.dgx-bookings` chart well, mini stat cards, `.dgx-fleet`, `.dgx-fcell`
- `allotment_v2.html:3613-3621` `bop-glass-skin`: `.bo-card`, `.bo-tile`
- `allotment_v2.html:3667-3668` `bkv2-nb-glass-skin`: `.bkv2-nb-topbar`, `.bkv2-review-sticky` — **the block's own comment confirms `.bkv2-nb-sec`/`.bkv2-nb-card` were deliberately spared this exact fate**
- `allotment_v2.html:3682` `sidebar-glass-skin`: `.sidebar` itself
- `allotment_v2.html:3719` `#la-userbadge`
- `allotment_v2.html:3826` `bkv2-vc-skin` explicitly sets `backdrop-filter:none` (undoing it) on `.bkv2-nb-topbar` within `.bkv2-vc` scope
- `allotment_v2.html:3911` `.la-navdim` (mobile nav scrim — fine)
- `allotment_v2.html:6710, 6825, 47051, 47467, 47546, 49538, 50362` — assorted inline-style modal overlays/badges built by JS (scrims and small floating pill badges — low risk, but same rule applies if any grow a dropdown)
- `allotment_v2.html:67717, 67731` — sidebar-adjacent inline glass cards (`.sb-in` and a highlight-row helper)

---

## Summary: reversibility at a glance

| Block | Safe to delete alone? |
|---|---|
| `bkv2-buildaxis-skin` | Yes |
| `softui-ocean-skin` | Yes |
| `md-glass-skin` | Mostly — background blobs/dark mode have no fallback, view goes plain |
| `bkv2-liquid-skin` | Yes (source-confirmed) |
| `cal-liquid-skin` | Yes |
| `dash-glass-skin` | Partial — also revert the "vivid dx tokens" per its own comment |
| `bop-glass-skin` | Yes (source-confirmed) |
| `topbar-float-skin` | No — paired with JS toggle state, treat as a feature |
| `bkv2-nb-glass-skin` | Yes |
| `sidebar-glass-skin` | No — restore from the named backup file per its own comment |
| `bkv2-cal-filter-skin` | Yes, but removes a feature's styling, not just decoration |
| `cost-v2-skin` | No — it's the drawer's only stylesheet, not an override |
| `bkv2-vc-skin` | Yes, but only after (or together with) `bkv2-nb-glass-skin` |
| `la-mobile` | Yes for desktop-only rollback, but removes all mobile support |
