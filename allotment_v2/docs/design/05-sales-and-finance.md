# Sales, Agents, Pricing, Accounting & Market Intelligence

Covers `#view-agents`, `#view-contract-tmpl`, `#view-sales-board`, `#view-b2b-dash`,
`#view-rate-types`, `#view-addonsvc`, `#view-staff`, `#view-teammkt`, `#view-accounting`,
`#view-dailypfm`, `#view-trippl`, `#view-costing`, `#view-marketdata`, `#view-focdetail`,
`#view-settings`, `#view-pickupmap`, `#view-pickup-setup` in `allotment_v2.html`.

**Headline finding:** this slice of the app is not one design system — it is at least **six**
independently-evolved visual languages stacked side by side, each scoped so it can't leak:

| Language | Scope | Primary accent | Notes |
|---|---|---|---|
| **FinDash** (`--fd-*`) | Agents, Rate Types, Add-on Services (`--aos-*` twin), Accounting, Market Data, FOC Detail, Contract Templates | Ocean blue `#1683C7` (was coral `#ff6b47`) | The "recolored" mainstream skin — see `02-skins-and-themes.md` |
| **Finexy** | Daily PFM only | Forest green `#163d2b` / lime `#9fdb4a` | Not touched by the Ocean skin at all |
| **Contract Document / Balance-Sheet** | Contract Doc wizard, Rate Type detail body | Navy `#1A2B43` | Deliberate "legal document" palette |
| **Trip P&L** | `#view-trippl` (`#trippl-host`) | Indigo `#4F46E5` | Tailwind-style token set (`--pi/--pem/--pam/--pro`), Sarabun font |
| **Costing (P&L)** | `#view-costing` | Vivid orange `#ff4c00` (`--b500`) | Explicitly scoped, comment says "ไม่กระทบหน้าจออื่น" (won't affect other screens) |
| **InvestIQ** | `#view-b2b-dash` (`#b2bdash-wrap`) | Fintech green `#00D084` | Own 12-color categorical palette |
| **Default app chrome** | Team & Markets, Staff & Welfare, Pickup Setup, Programs (Settings) | `--sb-pink` `#d44a7f` / navy `#1B2A55` | Plain `.card`/`.btn-pink`, no bespoke skin |

Full per-page detail follows. Section 9 (end of doc) has the consolidated non-brand-accent table.

---

## Agent List — `#view-agents` (`allotment_v2.html:4709`)

**Skin:** FinDash (`allotment_v2.html:1939-1953`), scoped `#view-agents{...}` at `:3444`. Forces
`Manrope` on every descendant (`:1959`), overriding the app-wide DM Sans/DM Mono rule — a
`!important`-laden override block because global rules were winning otherwise.

### Page shell
- `.page-hd h1` — `24px/700`, `letter-spacing:-0.02em`, color `var(--fd-ink)` (`:1972`). The
  "B2B" superscript span is `11px/400`, `var(--ink-soft)` (inline, `:4712`).
- KPI row: `.sb-kpi-row{grid-template-columns:1.7fr 1fr 1fr 1fr}` (`:1985`).
- Layout: `.sb-wrap{grid-template-columns:340px 1fr}` (`:2028`) — sidebar + detail, no third
  column (Rate Types adds one, see below).
- Sidebar `.sb-side` — `background:var(--fd-card)`, `border:1px solid var(--fd-line)`,
  `border-radius:var(--fd-r)` (22px), **`box-shadow:none`** — flat card, no shadow, unlike the
  base app's `.card` which always carries `var(--shadow)` (`:2031`).
- View toggle "การ์ด / ตาราง" — pill switch, `background:#f1efe9`, active segment
  `background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.09)` (`:4716-4717`, inline).

### Agent row + avatar chip
```css
#view-agents .sb-ag-row{padding:9px 10px;border-radius:14px;border:1px solid transparent}
#view-agents .sb-ag-row.sel{background:var(--fd-coral-soft);border-color:rgba(255,107,71,.25)}
#view-agents .sb-ag-dot{width:34px!important;height:34px!important;border-radius:50%;
  color:#fff;font-size:11px;font-weight:700;box-shadow:none}
#view-agents .sb-ag-row::after{content:'›';color:var(--fd-ink-faint)}  /* chevron affordance */
```
(`allotment_v2.html:2045-2064`). Avatar = a plain filled circle, background = the agent's
**market** color (`mkt.color`), label = two-letter initials from the name (`allotment_v2.html:63295`).
Row also carries: contract-status dot `.ag-ct-dot` (green `#2d9a6a` active / amber `#D48A14`
expiring / red `#C0392B` expired / gray `#CBD2DA` none, `allotment_v2.html:63306-63309`), a
payment-type chip `.ag-pay-chip` (invoice `#185FA5`/`#E6F1FB`, cot `#A05A1A`/`#FBF0DD`, else
`#5F6B7A`/`#EFF1F4`, `:63299-63300`), and a program-count chip `.ag-prog-chip` (neutral gray).

### Agent detail tabs
`.sb-tabs`/`.sb-tab` under `#view-agents` (`allotment_v2.html:2087-2090`):
```css
#view-agents .sb-tab{padding:12px 16px;font-size:12px;font-weight:500;color:var(--fd-ink-soft);
  border-bottom:2px solid transparent}
#view-agents .sb-tab.on{color:var(--fd-ink);border-bottom-color:var(--fd-coral);font-weight:700}
```
Underline-tab pattern (not pill). Tabs: **Information · Pricing Matrix · Recent Bookings ·
Generated Contracts · Activity** (`allotment_v2.html:64296-64304`). Contracts/Activity carry a
tabular-nums count badge (`var(--fd-coral-soft)`/`var(--fd-coral-deep)` for contracts,
`#EEE9FB`/`#6c5ce7` purple for activity — the one spot in this page using a color the Ocean skin
doesn't touch).

**Contract banner** (`.ct-banner`, `allotment_v2.html:2794-2810`): amber gradient
`linear-gradient(90deg,#fbeaea 0%,transparent 50%)` with left border `#854F0B`-ish amber text for
"expiring soon"; `.warn` variant flips to red (`#A32D2D`) for expired. Renew button
`.ct-btn-renew` is solid `var(--fd-coral)` pill, `.warn` variant solid `#A32D2D`.

**Contract history pills** (`.ct-history-pill`, `:2822-2839`): `.active` = green
(`#E1F5EE`/`#0F6E56`) with a glowing dot (`box-shadow:0 0 0 3px rgba(15,110,86,.15)`); `.expired`
= muted gray text, no fill; `.viewing` (archived-view mode) = tan/brown dot `#8a7548` (`:3024`).

### Pricing Matrix tab (shared with Rate Types)
Built once by `rtBuildDetailBody(rt)` (`allotment_v2.html:61848`) and reused by both the Rate
Type detail page and the Agent → Pricing Matrix tab. This is **not** the `rt-matrix-*` hover
widget (see note under Rate Types) — it is a plain ruled ledger table, "Balance Sheet" style:
- Section badges `§ 1 / § 2 / § 3` — navy `#1A2B43` filled pill, white text, `10.5px/700`
  (`allotment_v2.html:61946-61948`).
- Column group headers: Thai `#143F73`, Foreigner `#854F0B` (`allotment_v2.html:61859-61860`),
  each with its own `border-bottom` rule in its own color.
- Price cells: right-aligned, `font-variant-numeric:tabular-nums`, `11.5px`, plain ink
  (`allotment_v2.html:61890`) — **not** DM Mono here (Manrope tabular figures instead, consistent
  with the FinDash font override).
- "Not Offered"/"Not Set" cells: red pill `background:#FBE4E0;color:#C44A36` (`:61888`).
- Bundled-longtail footnote markers use superscript glyphs (¹²³…) in `#A8773B` amber
  (`allotment_v2.html:61870-61875`).

---

## Rate Types — `#view-rate-types` (`allotment_v2.html:4864`)

Same FinDash tokens as Agents (`#view-rate-types` reuses `--fd-*`, no separate palette declared).

### Page shell
- View-mode toggle "Detail / Agents" — pill switch identical construction to Agents' card/table
  toggle, active segment `background:#eeece6` (`allotment_v2.html:4872-4873`).
- `.sb-wrap{grid-template-columns:400px 1fr}` (`:2231`), widened vs. Agents' 340px because the
  sidebar list rows carry more metadata. A `.sb-wrap.three-col{grid-template-columns:280px 1fr
  340px}` variant (`:2259`) appears only in **Agents view-mode**, adding `#rt-agents-col` as a
  third column of agent chips bound to the selected rate type.

### Rate Type ↔ Agent chips (Agents view-mode column)
```css
#view-rate-types .rt-ag-card{border-radius:12px;padding:10px 12px}
#view-rate-types .rt-ag-card.sel{background:var(--fd-coral-soft);border-color:rgba(255,107,71,.3)}
#view-rate-types .rt-ag-dot{width:34px;height:34px;border-radius:50%}         /* same recipe as sb-ag-dot */
#view-rate-types .rt-ag-x{opacity:0} #view-rate-types .rt-ag-card:hover .rt-ag-x{opacity:.7}
```
(`allotment_v2.html:2264-2274`) — unbind ("✕") button is hover-revealed, hover state
`background:#FCEBEB;color:#A32D2D`. Market-filter pills `.rt-mkt-pill.on{background:#eeece6}`
(`:2278`). Aggregate stat cards `.rt-agg-grid` (3-col, `:2279-2282`) show Agents / Programs /
Credit Σ counts.

### ⚠ Important correction on "the Rate Type matrix"
The class prefix `rt-matrix-` (`allotment_v2.html:8239-8321`) — including the hover-revealed
`.rt-matrix-hide-btn` — is **not** part of the Rate Types page. `rt` here stands for **route**,
not **rate type**: it is the Route × Day availability grid rendered inside the
**Overview/Calendar** day-panel (`calHideRoute`/`_calGetHiddenRoutes`, same file region), reached
from the calendar's day-detail view, not from `#view-rate-types`. Documented here anyway since
the task named it explicitly:
```css
.rt-matrix-row:hover .rt-matrix-hide-btn{opacity:.7!important}
.rt-matrix-row .rt-matrix-hide-btn{opacity:0;transition:opacity .12s}
.rt-matrix-row .rt-matrix-hide-btn:hover{opacity:1!important;background:#FBE9E9!important;color:#A32D2D!important}
```
(`allotment_v2.html:8321`, inline `<style>` injected into the returned HTML string). Row = route
(sticky first column, `background:#fafaf8`), columns = one `<th>` per day of month with a coral
pill (`#C75A33`) for the selected day and a faint peach tint for today. Selected-day pill uses DM
Mono for the day number.

The actual **Rate Type pricing matrix** the task means is the `rtBuildDetailBody` ledger table
documented above under Agents → Pricing Matrix (shared renderer, `allotment_v2.html:61848`).

---

## Contract Templates — `#view-contract-tmpl` (`allotment_v2.html:4857`) & Contract Document wizard

`#view-contract-tmpl` is a thin host (`#cttv-wrap`) rendered by `renderContractTemplates()`
(`allotment_v2.html:67779`) — also FinDash-toned. List rows use a green left rule for the
selected template (`box-shadow:inset 3px 0 0 #0F6E56`, `allotment_v2.html:67784`), DEFAULT badge
`#E1F5EE`/`#0F6E56`, disabled badge `#F1EFE8`/`#8a8880`. Each editable field pairs an EN box
(`#0C447C` on `#E6F1FB`) and a TH box (`#993556` on `#FBEAF0`) side by side (`:67817-67821`) —
the one place in this slice using a magenta/rose language tag instead of blue/amber.

### Contract Document wizard (`#ct-doc-modal`, `allotment_v2.html:2096-2152`)
This is the actual **PDF-ish template** — an on-screen A4 page preview with print CSS.
```css
.ct-doc-card{width:96%;max-width:1400px;height:92vh;font-family:Manrope,...}
.ct-doc-hd-icon{background:#1A2B43;color:#fff;border-radius:8px}     /* navy letterhead icon */
.ct-doc-act.primary{background:#1A2B43;color:#fff}
.ct-doc-side{width:340px;background:#F5F4EE;border-right:1px solid #E0DED8}  /* section checklist */
.ct-doc-sec.on{border-color:#0F6E56;background:#F4FBF7}              /* included section = green */
.ct-doc-sec.required{border-color:#185FA5;background:#F4F8FB;cursor:not-allowed}  /* locked = blue */
.ct-doc-preview{background:#E5E2D9;padding:30px 40px}                 /* gray "desk" surround */
.ct-doc-page{width:100%;max-width:794px;background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.12);
  min-height:1123px}                                                  /* 794×1123px = A4 @ 96dpi */
```
- Language toggle `.ct-doc-lang-btn.on{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08)}`
  (pill switch, same recipe as every other "Detail/Agents"-style toggle in this slice).
- In-place edit affordance `.ct-doc-edit:hover{outline:1px dashed transparent→#A8773B;
  background:#FFF7E8}` (`:2144-2146`) — amber dashed outline on hover, solid on focus.
- Clause cards `.ct-doc-clause-card{background:#FAFAF6;border:1px solid #E0DED8}` with a
  hover-revealed remove button (`opacity:0→.85` on card hover, red on button hover) — the same
  hover-reveal idiom as `rt-matrix-hide-btn` and `rt-ag-x`.
- **Print CSS** (`@media print`, `allotment_v2.html:2156-2172+`): `@page{size:A4 portrait;margin:0}`,
  the modal is torn out of overlay mode and each `.ct-doc-page` becomes one physical A4 sheet
  (`width:210mm;height:297mm`) with `page-break-after:always`. Comment explains a prior bug where
  a 10mm `@page` margin double-counted against the on-screen 1123px preview height, forcing the
  fix to zero out `@page` margin and let `.ct-doc-page` padding own the whole margin so print
  output matches the preview pixel-for-pixel.

**Toast** notifications reuse the same navy: `background:#1A2B43;color:#fff` (`allotment_v2.html:66442`).

---

## Sales Board — `#view-sales-board` (`allotment_v2.html:4861`)

Rendered into `#salesboard-wrap` by `renderSalesBoard()` (`allotment_v2.html:67453`), FinDash
tokens again. Distinctive elements not seen elsewhere in this slice:
- **Hexagon avatar chips** — `clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)`
  (`allotment_v2.html:67470`, the `hex()` helper) — used for the podium and the profile-card
  avatar, filled with the sales person's own `color`.
- Podium/leaderboard giant watermark word "Champions" behind the podium, `58px/700`,
  `color:var(--fd-bg,#F1EFE8)` — a low-contrast background flourish (`:67765`).
- Trend-bucket palette (agent momentum categories, `allotment_v2.html:67497-67503`):

| Bucket | Icon | Color | Background |
|---|---|---|---|
| down (dropping) | ⚠ | `#A32D2D` | `#FCEBEB` |
| up (surging) | 📈 | `#3B6D11` | `#EAF3DE` |
| new | ✨ | `#185FA5` | `#E6F1FB` |
| gone | 🚫 | `#854F0B` | `#FBF6EE` |
| flat (steady) | ➖ | `#5F5E5A` | `#fff` |

- Rank chip color is a dedicated pink `#d44a7f` (`allotment_v2.html:67506`) — this is the app's
  original `--sb-pink` value, reused directly rather than through the CSS variable.
- KPI tiles: flat white card, `0.5px` hairline border, value `22px/600` colored per-metric
  (target-hit green `#0F6E56`, else blue `#185FA5`; agents amber `#854F0B`; booking count brown
  `#7a5622`; rank pink `#d44a7f`) — `allotment_v2.html:67505`.
- Agent tier rows use a 5-color rotating tint set for initial chips:
  `['#E6F1FB|#185FA5','#E1F5EE|#0F6E56','#FAEEDA|#854F0B','#FBEAF0|#993556','#EEEDFE|#534AB7']`
  (`allotment_v2.html:67512`).

## B2B Dashboard ("InvestIQ") — `#view-b2b-dash` (`allotment_v2.html:4862`)

Rendered into `#b2bdash-wrap` by `renderB2BDash()` (`allotment_v2.html:79334`). Own token set,
**not** derived from `--fd-*` and **not** touched by the Ocean skin:
```js
const B2D_UI = { accent:'#00D084', accentD:'#059669', green:'#10B981', red:'#EF4444', rose:'#F43F5E',
  ink:'#0F172A', ink2:'#334155', mut:'#94A3B8', line:'#F1F5F9', line2:'#F8FAFC', navy:'#1E293B',
  card:'background:#fff;border:1px solid #F1F5F9;border-radius:24px;
        box-shadow:0 1px 2px rgba(15,23,42,.04),0 1px 3px rgba(15,23,42,.05);' };
const B2D_CLS = { growth:{c:'#059669',bg:'#ECFDF5'}, new:{c:'#0F766E',bg:'#F0FDFA'},
  stable:{c:'#64748B',bg:'#F1F5F9'}, loss:{c:'#E11D48',bg:'#FFF1F2'}, churn:{c:'#B45309',bg:'#FEF3C7'} };
const B2D_PALETTE = ['#10B981','#1E293B','#3B82F6','#F59E0B','#8B5CF6','#EC4899',
                      '#14B8A6','#F97316','#64748B','#0EA5E9','#84CC16','#A855F7'];
```
(`allotment_v2.html:79080-79086`). Segmented control (Booking date / Travel date, WoW/MoM/…):
`background:#F1F5F9;border-radius:99px`, active segment filled `B2D_UI.accent` (`#00D084`) with
`box-shadow:0 2px 8px rgba(0,208,132,.25)` (`allotment_v2.html:79091`). Export button same green,
heavier shadow. Card radius is **24px**, noticeably rounder than FinDash's 22px or the base app's
10-18px scale.

---

## Add-on Services — `#view-addonsvc` (`allotment_v2.html:5034`)

Own token twin of FinDash, `--aos-*` (`allotment_v2.html:1816-1824`), remapped by the Ocean skin
exactly like `--fd-coral` (`--aos-coral` → `#1683C7` at `:3446`). Extra semantic tokens beyond
FinDash: `--aos-green:#0F6E56`/`--aos-green-soft:#E1F5EE`, `--aos-blue:#185FA5`/`#E6F1FB`,
`--aos-amber:#854F0B`/`#FAEEDA` — used to color-code the 4 service categories:

| Category | Icon bg | Icon color |
|---|---|---|
| `.boat` | `--aos-blue-soft` | `--aos-blue` |
| `.van` | `--aos-amber-soft` | `--aos-amber` |
| `.guide` | `--aos-coral-soft` | `--aos-coral-deep` (→ Ocean-blue-deep post-skin) |
| `.other` | `--aos-green-soft` | `--aos-green` |

(`allotment_v2.html:1837-1840`, mirrored in the icon-picker `.aos-icon-sw` variants at `:1888-1892`).
Service cards `.aos-svc-card{border-radius:22px}` (`:1832`), variant rows are pill-radius chips
inside (`.aos-variant-row{border-radius:12px;background:var(--aos-bg)}`, `:1857`). Add buttons are
dashed-outline ghost buttons that solidify to coral-soft on hover (`.aos-variant-add:hover`,
`.aos-svc-add:hover` — `border-color:var(--aos-coral);background:var(--aos-coral-veryfaint)`,
`:1866,1871`). Modal backdrop uses `backdrop-filter:blur(2px)` (`:1896`) — CLAUDE.md flags
backdrop-filter as a stacking-context risk for dropdowns, but this modal has no typeahead inside
so it's safe.

---

## Staff & Welfare — `#view-staff` (`allotment_v2.html:4965`) / Team & Markets — `#view-teammkt` (`allotment_v2.html:4970`)

Neither page has a bespoke skin — both are inline-styled directly against hardcoded hex, no CSS
variables at all (not even the base app's `--ink`/`--sand`). Consistent navy `#1B2A55` for
headings, active tab, and primary buttons (`allotment_v2.html:39528,39531,39546,39552`) — the
same navy family as Pickup Setup below but a **different literal value** than the Contract
Document's `#1A2B43` (both are "navy" by eye, neither derives from the other).

- Tab switch "ทะเบียน · Roster / ทริป · Trips report" — pill switch, active `background:#185FA5`
  (`allotment_v2.html:39530-39531`) — blue, not the page's own navy.
- Staff KPI tiles: plain white card, value in `DM Mono`, colored per-metric (quota blue `#185FA5`,
  used amber `#854F0B`, remaining green `#0F6E56` / red `#A32D2D` if negative) — same semantic
  triad used throughout Accounting/PFM.
- Team & Markets (`#view-teammkt`) uses the **plain default app chrome**: `.card`,
  `.btn btn-pink` (`var(--sb-pink)` = `#d44a7f`), `.g2` two-column grid, `var(--sand-mid)` header
  strip — no FinDash, no navy. It's the most "vanilla" page in this whole slice.

---

## Accounting — `#view-accounting` (`allotment_v2.html:5093`)

FinDash tokens, host `#acct-body` rendered by `renderAccounting()` (`allotment_v2.html:58990`).

### KPI strip
6 flat white tiles (`0.5px` hairline border, `border-radius:12px`), each a differently-colored
number (`allotment_v2.html:58999-59004`):

| KPI | Color |
|---|---|
| Outstanding | `#A05A1A` (amber-brown) |
| Paid this month | `#0F6E56` (green) |
| Credit exposure | `#185FA5` (blue) |
| Overdue invoices | `#A32D2D` (red) if >0, else ink |
| Deposits held | `#5B289A` (purple) |
| Extras · cash · mo | `#0F6E56` (green) |

### Invoice table
- Money columns (`Total`, `Paid`, `Balance`) are `font-variant-numeric:tabular-nums`, right
  aligned; formatted via `acctFmt(n)` = **`'฿'+Math.round(n).toLocaleString()`**
  (`allotment_v2.html:42884`) — comma thousand separators, no decimals, Baht-sign prefix, **not**
  DM Mono (uses the ambient Manrope/DM Sans body font — only some sibling pages route money
  through DM Mono, see Daily PFM below).
- `Paid` column is always green `#0F6E56`; `Balance` is `#A05A1A` amber if >0 else muted ink
  (`allotment_v2.html:59010-59011`).
- Agent name is a blue underlined link (`color:#185FA5;text-decoration:underline`) opening the
  agent's statement (`allotment_v2.html:59009`).
- Row action buttons: ghost `View`/`Void` (white, `var(--fd-line)` border), primary `Record
  payment` filled `var(--fd-coral)` (Ocean blue post-skin) (`allotment_v2.html:59013-59015`).

### Status chip palette — `ACCT_STATE_CHIP` (`allotment_v2.html:42968`)
```js
const ACCT_STATE_CHIP = {
  issued:  ['#FBF0DD','#7A4A00','Awaiting payment'],
  partial: ['#E6F1FB','#185FA5','Partly paid'],
  paid:    ['#E1F5EE','#0F6E56','Paid'],
  void:    ['#F1EFE8','#5F5E5A','Void'],
};
```
There is **no dedicated "overdue" invoice chip** — overdue is only surfaced as a red KPI count
(`#A32D2D`, computed from `dueAt < now && balance>0`); an individual overdue invoice still shows
as the amber "Awaiting payment" or blue "Partly paid" chip. Deposit button uses purple
(`color:#5B289A;border:1px solid #D9C7EE`, `allotment_v2.html:59022`) matching the "Deposits
held" KPI.

### `#acct-modal` (payment-collection sub-forms, `allotment_v2.html:48789-48853`)
Own small vocabulary of classes (`.pckp-*`) built via string concatenation rather than a
`<style>` block, still scoped `#acct-modal .pckp-*`. Segmented "How much did you collect"
buttons: `.pckp-seg button.on{border-color:#0F6E56;background:#DCF4E8}` (green select state).
Amount input focus ring is **blue** `#185FA5` (`:48853`) — distinct from the coral/Ocean focus
ring used in most other form inputs across the app.

---

## Daily PFM — `#view-dailypfm` (`allotment_v2.html:5070`) — "Finexy" skin

**This page deliberately does not use FinDash or Ocean blue at all.** It is documented in-code as
"Finexy" (`allotment_v2.html:45099,45108,45204` comments) — a forest-green fintech dashboard
look, self-contained inside `renderDailyPFM()` (`allotment_v2.html:45062`), no shared `<style>`
block — every rule is inline.

### Palette

| Role | Color |
|---|---|
| Page background | `#f6f7f5` |
| Ink (headings) | `#15201a` / `#1b1b18` |
| Ink-soft | `#7d7d74` / `#8a8a82` / `#9a988f` |
| Primary action (dark pill button) | `#163d2b` text `#eafbe0` |
| Hero "Unpaid" card gradient | `linear-gradient(150deg,#3f9e57 0%,#1f6b3c 60%,#123c25 100%)` |
| Collection-progress bar fill | `#1f7d45` |
| Chart "Collected" (lime, diagonal-hatch pattern) | `#b6e84f` fill / `#d5f283` hatch stroke |
| Chart "Unpaid" (dark bar) | `#16241c` |
| Status dot: paid | `#1D9E75` text `#0F6E56` |
| Status dot: awaiting | `#EF9F27` text `#7A4A00` |
| Status dot: unpaid/alert | `#E24B4A` text `#A32D2D` |
| Status dot: on hold | `#E24B4A` text `#A32D2D` |
| Status dot: no invoice | `#B4B2A9` text `#5F5E5A` |
| Priority-queue banner | bg `#FBF1E4`, border `#F0D7BE`, text `#7A4A00` |
| Alert row tint (past-cutoff) | `background:#FEF6F5` |

(`allotment_v2.html:45097-45103, 45154-45164, 45204-45268`)

### Card style
Flat white rounded cards, **no visible border**, only a soft shadow tuned to the green hue:
`box-shadow:0 1px 3px rgba(20,45,28,.06)` and `border-radius:18px` (KPI/collection cards) or
`14px` (day-group cards) — every shadow's alpha color is greenish (`rgba(20,45,28,...)`), not the
neutral gray used elsewhere in the app (`allotment_v2.html:45204,45242,45209`).

### Typography
`font-family:'DM Sans',sans-serif` for the whole host (`allotment_v2.html:45210`); all money and
counters route through **`'DM Mono',monospace`** consistently (dates, ฿ amounts, pax counts,
segmented-control labels) — unlike Accounting, which mostly leaves money in the body font.

### Distinctive widgets
- **Priority queue**: outstanding bookings sorted by nearest travel date, rendered above the
  normal day-cards when in week/month/year mode (`allotment_v2.html:45224-45244`) — amber card
  chrome, red ฿ totals.
- **Collection chart**: a hand-built SVG bar chart (not a library) with a diagonal-hatch
  `<pattern id="pfmhl">` for the "collected" series and a solid dark bar for "unpaid," stacked
  (`allotment_v2.html:45250-45254`). Y-axis gridlines dashed, `stroke:#e7eae5`.
- Action buttons: green solid `Issue PFM`/`Record` (`background:#163d2b;color:#eafbe0`), ghost
  white `Extend`/`Hold`/`View` with colored text (`#0F6E56` extend, `#A32D2D` hold)
  (`allotment_v2.html:45108-45115`).
- Slip attachment button flips from gray ghost (`+ สลิป`, no attachments) to green
  (`color:#0F6E56`, "สลิป N") once files exist (`allotment_v2.html:45112-45113`).

**Contrast with the rest of the app:** Daily PFM is the single clearest example of a page that
was designed as a completely separate product and dropped in — same data model, entirely
different visual system, and immune to the Ocean-blue re-skin because it never referenced
`--fd-coral`/`--coral` in the first place.

---

## Trip P&L — `#view-trippl` (`allotment_v2.html:5100`, host `#trippl-host`)

Third independent skin, built via one big string-concatenated `<style>` injected at
`allotment_v2.html:56650` ("ทุก selector ขึ้นต้นด้วย #trippl-host เสมอ" — every selector starts
with `#trippl-host`, comment enforcing the scoping discipline). Font is **`Sarabun`/`Noto Sans
Thai`**, not DM Sans — the only page in this slice with its own font stack.

Token set (`allotment_v2.html:56658-56661`):
```css
--pi:#0F172A;   /* ink / brand-dark */
--pm:#64748B;   /* muted */
--pf:#94A3B8;   /* faint */
--pl:#F1F5F9; --pl2:#E2E8F0;   /* light surfaces */
--pem:#059669;  /* emerald = positive margin */
--pam:#D97706;  /* amber = caution */
--pro:#E11D48;  /* rose = loss/negative */
--pblu:#2563EB; /* blue */
--pind:#4F46E5; /* indigo = brand accent for this page */
--pcard: 0 10px 30px -5px rgba(0,0,0,.04), 0 4px 12px -2px rgba(0,0,0,.025);
```
Nav pill bar `.pnav` is a **dark navy pill strip** (`background:#0F172A`), individual buttons
`color:#CBD5E1`, active = white pill with dark text (`allotment_v2.html:56674-56678`) — the
inverse-contrast tab pattern (dark track, light-on-dark idle text, white-on-dark active) not used
anywhere else in this slice. This is a Tailwind-default palette (`slate`/`indigo`/`emerald`/
`amber`/`rose`) dropped in wholesale — recognizable by the exact hex values matching Tailwind's
`indigo-600`/`emerald-600`/`amber-600`/`rose-600`/`blue-600`/`slate-900`.

## Costing — `#view-costing` (`allotment_v2.html:5101`)

Fourth independent skin, `§ctSkin` comment explicitly states it is scoped and won't leak
(`allotment_v2.html:728`, "ดีไซน์ ต้นทุน & จุดคุ้มทุน · scoped ใต้ #view-costing เท่านั้น
ไม่กระทบหน้าจออื่น"). Local token set (`allotment_v2.html:729-736`):
```css
--b50:#fff5f0; --b100:#ffe8dc; --b200:#ffd0b8; --b300:#ffab88; --b500:#ff4c00; --b600:#e63b00;
--cr200:#eae0d2; --sd50:#fdfbf7; --sd100:#f7f2ea; --sd200:#ebe3d5; --sd300:#ded2bf; --sd400:#cebc9f;
--es700:#4a3e36; --es800:#382d26; --es900:#2b221d; --es950:#1d1612;
--mt50:#e6f7f0; --mt100:#ccefe1; --mt500:#10b981; --mt700:#0d7a5f;
```
`--b500:#ff4c00` (vivid orange/red) is the page's brand accent — used for the logo tile
(`.ct-logo`), active tab icon color, the "on" rate-type row in the sidebar (filled `--b500` with
`box-shadow:0 8px 20px rgba(255,76,0,.22)`), hot/highlighted inputs, and the primary KPI number
color (`allotment_v2.html:743,752-753,771,807,812,819,829`). `--mt500`/`--mt700` (mint-green) is
the secondary accent for progress bars and "good" KPI tiles. **This orange is never touched by
`softui-ocean-skin`** — it lives entirely outside the `--fd-*`/`--aos-*`/`--coral` token families
the Ocean skin edits.

Card geometry: `.ct-card{border-radius:22px;box-shadow:0 1px 2px rgba(43,34,29,.04)}`
(`allotment_v2.html:758`) — near-invisible shadow, mostly relying on the `1px` border.
Tab bar `#ct-tabs{background:var(--sd100);padding:4px;border-radius:16px}`, active tab
`.ct-tab.on{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.07)}` — same pill-switch idiom as
every other tab bar in this slice, just re-themed.

---

## Market Intelligence — `#view-marketdata` (`allotment_v2.html:5120`)

FinDash tokens for KPI/page chrome, **plus its own "liquid glass" skin**
(`id="md-glass-skin"`, `allotment_v2.html:3470-3517`) layered on top — frosted-glass cards over a
soft pastel blob background. This is the only page in the app using `backdrop-filter:blur()` as
its primary visual language rather than an occasional accent.

### 6+1 tabs
`Overview · ① Forecast · ② Market Gap · ③ Season & Pricing · ④ Ops & Guides · ⑤ Sales & Agents ·
⑥ Agents` (`allotment_v2.html:44815`) — Overview plus the 6 numbered analytical tabs the task
description refers to. Tab bar `.mb-tabs`/buttons, active = solid `#F4762E` orange pill
(`allotment_v2.html:3499-3500`) — **not** Ocean blue, even though the page otherwise imports
FinDash tokens.

### Glass card recipe
```css
#md-body .md-card, #md-body .md-gp {
  background: rgba(255,255,255,.55–.58);
  backdrop-filter: blur(16–20px) saturate(150%);
  border: 1px solid rgba(255,255,255,.6–.72);
  border-radius: 14–18px;
  box-shadow: 0 6–14px 22–34px rgba(28,52,86,.08–.12), inset 0 1px 0 rgba(255,255,255,.7–.95);
}
```
Background blobs behind the whole view: orange `#FBC79A`, mint `#A8E0CF`, pink `#F6A8C0`, each a
`filter:blur(74-76px)` radial circle at low opacity (`allotment_v2.html:3472-3474`).

### Dead "dark mode" variant
`#view-marketdata.md-dark` (`allotment_v2.html:3510-3517`) defines a full alternate palette —
brown/orange gradient background (`#43291F→#5E3A2C→#2B1E1A`), orange blob `#F2843A`, teal blob
`#2FB39A`, orange active-tab `#E8642A` — but `renderMarketData()` only ever calls
`vw.classList.remove('md-dark')` (`allotment_v2.html:44811`); nothing in the codebase adds the
class. **This is dead CSS — the dark theme is unreachable in the current build.**

### Chart / series color palette
- Year-over-year hero chart: previous year `#F4762E` (orange), current year `#E0738F` (rose)
  (`allotment_v2.html:43162-43164`).
- Gauge / pace-slider accent: `#F4762E` throughout (arc, slider fill, thumb ring).
- Top-markets tile palette: `pal = ['#BA7517','#185FA5','#A32D2D','#0F6E56','#3B6D11','#534AB7']`
  (`allotment_v2.html:43192`).
- Net-flow tile palette: `netPal = ['#1D9E75','#185FA5','#BA7517','#A32D2D','#534AB7','#0F6E56']`
  (`allotment_v2.html:43199`).
- "Opportunities" CTA + checkbox accent: `#E8642A` (`allotment_v2.html:43196-43197`).
- Positive/negative pill convention (used across many mini-charts): green `#0F7A5A`/bg `#E1F5EE`
  for positive change, red `#C2421F`/bg `#FCEBEB` for negative (`allotment_v2.html:43213`).

### Table styling
Leaderboard rows: `9px` uppercase gray header, zebra striping via
`background:rgba(255,255,255,.28)` on odd rows (translucent, so the blob background shows
through), in/out/net columns in `DM Mono`, net-flow direction arrow colored green `#1D9E75`
(positive) or red `#E2655F` (negative) (`allotment_v2.html:43173`).

---

## FOC Detail — `#view-focdetail` (`allotment_v2.html:5129`, host `#foc-host`)

FinDash page chrome, but the KPI band (`renderFocDetail`, `allotment_v2.html:43926`) is its own
glassmorphic **forest-green** composition, unrelated to Finexy but visually adjacent:
```js
const _glHero = 'background:linear-gradient(#1F4D2C,#1F4D2C) padding-box,
  linear-gradient(140deg,rgba(255,255,255,.35),rgba(255,255,255,.05) 42%,rgba(0,0,0,.28)) border-box;
  border:1.5px solid transparent;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 12px 28px rgba(15,45,30,.22)';
```
(`allotment_v2.html:43965`) — a dark-green "hero" tile (`#1F4D2C`) with a double-gradient
border trick (padding-box fill + border-box gradient ring) for a subtle bevel, `#C8F47C` lime
badge inside for "Agent N · Staff N". Sibling tiles use the same `border-box` gradient-ring
technique on white (`_GT`) and on pale red (`_glRed`, for the "KPI ต่ำ" / low-KPI-agents card,
`allotment_v2.html:43966-43967`).

Route-family color-coding for FOC breakdown chips (`_FB`, `allotment_v2.html:43978`):
```js
{ similan:'#5B9BD5', surin:'#9CCC65', phiphi:'#EF6C6C', krabi:'#4DB6AC', whaleshark:'#E0A93C', other:'#B0BEC5' }
```
KPI-ratio color thresholds (used for both agent and staff FOC-rate badges,
`allotment_v2.html:43991,44003`): `≤8% → #1D9E75` (good), `≤20% → #BA7517` (watch),
`>20% → #E24B4A` (bad). Staff FOC section uses blue `#185FA5` (staff total number) split into
"Welfare" (`#3B6D11` green) and "Inspection" (`#854F0B` amber) sub-tiles.

---

## Settings / Config — `#view-settings` "Programs" (`allotment_v2.html:5145`)

The Config sidebar group (`allotment_v2.html:4474`, `LA_AREAS` `config:'ตั้งค่า · Programs/Team'`
at `:407`) contains exactly 3 pages: **Programs** (`settings`), **Team & Markets** (`teammkt`),
**Add-on Services** (`addonsvc`) — there is no separate generic "Settings" form page beyond these.
`#view-settings` itself renders a legacy hidden `.g2` season-editor scaffold (`display:none`,
`allotment_v2.html:5148-5163`, dead markup — superseded by `renderSettings()`'s `#prog-pink-wrap`
host) plus the live "Programs" dashboard.

### Layout & typography
`renderSettings()` (`allotment_v2.html:12437`) builds a KPI/list/detail dashboard directly into
`#prog-pink-wrap`, no CSS classes — everything inline against a small local `dim` object:
```js
const dim = { bg:'#F4F2EE', ink:'#1A1A1A', ink2:'#666', ink3:'#999', ink4:'#bbb', ink5:'#ccc',
               line:'rgba(0,0,0,.04)' };
const SVG_PINK = { accent:'#E03B7E', soft:'#FCE5EC', text:'#9F1B4F' };   // "open today" pill
```
(`allotment_v2.html:12444-12445`) — a dedicated **pink `#E03B7E`** accent used only for the "▴ N
เปิดวันนี้" pill, distinct from both Ocean blue and the app's own `--sb-pink` (`#d44a7f`).
Big hero number (`42px/700`, `letter-spacing:-1.5px`) for total program count
(`allotment_v2.html:12475`). Section separators are plain `1px` hairlines (`dim.line`), no
decorative rules.

### Pier color-coding
```js
const PIER_INFO = {
  tublamu: { label:'Tub Lamu Pier', accent:'#0F6E56', bg:'#E1F5EE', color:'#0F6E56' },
  panwa:   { label:'Visit Panwa',   accent:'#185FA5', bg:'#E6F1FB', color:'#185FA5' },
  ranong:  { label:'Ranong Pier',   accent:'#BA7517', bg:'#FAEEDA', color:'#854F0B' },
};
```
(`allotment_v2.html:12497-12501`) — green/blue/amber, the same semantic triad reused everywhere
else in the app (success/info/caution), applied here to piers rather than statuses.

### Sidebar color pickers (`la_sbcolor_*`)
Not part of `#view-settings` — it's a persistent footer widget injected into the global sidebar
chrome (`laSbColorPickerHTML()`, `allotment_v2.html:5958`), independent of any view. Small "🎨
สีแท็บ" (tab color) disclosure toggle that expands a swatch row; selection persists to
`localStorage.la_sbcolor_<user>` (`allotment_v2.html:5955`) and injects a `<style id="la-sbcolor">`
override tag, reset via `la_sbacc_<user>`-adjacent `laSbResetColor()`. Swatch selection ring:
`box-shadow:0 0 0 2px #888` selected vs `0 0 0 1px rgba(128,128,128,.35)` idle
(`allotment_v2.html:5953`). This is the one legitimate non-`la_view`/`sb_collapsed` localStorage
write CLAUDE.md explicitly allow-lists (`sb_collapsed`, `la_sbcolor_*`, `la_sbacc_*`, `la_pogrp`).

---

## Pickup Map — `#view-pickupmap` (`allotment_v2.html:5138`) & Pickup Setup — `#view-pickup-setup` (`allotment_v2.html:4960`)

Pickup Map is a thin FinDash-chrome host wrapping a Leaflet map inside a sand card
(`background:#F4F2EE;border-radius:14px`, `allotment_v2.html:5142`) — no bespoke palette beyond
"1 dot = 1 pax, dot color = market."

Pickup Setup (`#psu-host`, styles at `allotment_v2.html:40441-40484`) uses its **own navy**,
`#1B2A55` — same literal value as Staff & Welfare, again independently declared:
```css
#view-pickup-setup .psu-h1{color:#1B2A55}
#view-pickup-setup .psu-tab.on{background:#fff;color:#1B2A55}
#view-pickup-setup .psu-zone-pill.on{background:#1B2A55;color:#fff}
#view-pickup-setup .psu-btn-pri{background:#1B2A55;color:#fff}
```
Zone tags are color-coded per transfer zone (`allotment_v2.html:40466-40468`):

| Zone | Background | Text |
|---|---|---|
| `PK` (Phuket) | `#E8F2FB` | `#185FA5` |
| `KL` (Khao Lak) | `#FFF2E8` | `#A05A1A` |
| `NoTransfer` | `#F0F0EC` | `#6B6B62` |

Time-matrix cells: sticky first column (`background:#f5f3ef`, `z-index:2`), editable cells filled
pale blue `#E8F2FB` with navy text, focus ring `box-shadow:0 0 0 2px rgba(27,42,85,.1)` matching
the page's navy (`allotment_v2.html:40483-40484`) — the one input focus-ring color in this slice
that is neither Ocean blue nor the info-blue `#185FA5`.

---

## Non-brand accents — consolidated

Ocean blue `#1683C7` only exists as a *token override* on `--fd-coral`/`--aos-coral`/`--coral`
(`softui-ocean-skin`, `allotment_v2.html:3443-3452`). Everything below is a **hardcoded** color
outside that token family, so the Ocean re-skin cannot reach it even if a future change widened
its scope:

| Accent | Where | Hex |
|---|---|---|
| Forest green + lime ("Finexy") | Daily PFM, entire page | `#163d2b` / `#9fdb4a`–`#7ec24a` |
| Indigo ("Tailwind") | Trip P&L, entire page | `#4F46E5` (+ `#059669`/`#D97706`/`#E11D48`/`#2563EB`) |
| Vivid orange | Costing, entire page | `#ff4c00` (`--b500`) |
| Fintech green | B2B Dashboard, entire page | `#00D084` |
| Navy (contract letterhead) | Contract Doc wizard, Rate Type ledger `§` badges | `#1A2B43` |
| Navy (ops chrome) | Staff & Welfare, Pickup Setup | `#1B2A55` |
| Pink | Sales Board rank chip, Team & Markets/Programs primary buttons | `#d44a7f` (`--sb-pink`) |
| Pink (Programs KPI pill) | Settings "Programs" — "N เปิดวันนี้" | `#E03B7E` (`SVG_PINK`) |
| Orange (Market Data tabs/gauge) | Market Intelligence tab bar, hero gauge, opportunity CTA | `#F4762E` / `#E8642A` |
| Purple | Accounting deposits KPI + button; Agent Activity tab badge | `#5B289A` / `#6c5ce7` / `#534AB7` |
| Info blue (semantic, app-wide) | "invoice" pay-type chips, links, "new agent" trend bucket, blue KPIs | `#185FA5` (distinct literal from Ocean's `#1683C7`) |
| Dead dark theme | Market Data `.md-dark` — unreachable, `classList` never adds it | `#43291F…#E8642A` |

The recurring **semantic triad** (green = good/paid, amber/brown = caution/pending, red = bad/
overdue) is consistent across Accounting, Daily PFM, FOC Detail, Sales Board and Programs, using
a near-identical hex set each time (`#0F6E56`/`#1D9E75` green, `#854F0B`/`#A05A1A`/`#7A4A00`
amber, `#A32D2D`/`#E24B4A`/`#C44A36` red) even though each page re-declares it independently
rather than sharing one token source.
