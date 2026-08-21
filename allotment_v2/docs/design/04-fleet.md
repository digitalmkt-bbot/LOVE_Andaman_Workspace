# Fleet Management — Visual Design Reference

Scope: `#view-boats`, `#view-operation`, `#view-fleetcal`, `#view-fl-dashboard`, `#view-fl-dailyreport`, `#view-fl-asset`, `#view-fl-maintenance`, `#view-fl-projects`, `#view-fl-incident`, `#view-fl-inventory`, `#view-fl-consumables`, `#view-fl-cost`, `#view-fl-insights`, `#view-fl-fuel`, `#view-boatassign`, `#view-vehicles`, `#view-insurance`. All line refs are `allotment_v2/allotment_v2.html:N`.

## 0. The shared "Pink-dashboard" design system

Almost every Fleet sub-page (Dashboard, Daily Report, Boat Status, Maintenance, Incident, Inventory, Consumables) is built by hand-rolled JS template strings that repeat the **same local design tokens** verbatim in every render function — there is no shared CSS class for it, just a copy-pasted object:

```js
const SVG_PINK = {accent:'#E03B7E', soft:'#FCE5EC', text:'#9F1B4F'};
const dim = {bg:'#F4F2EE', ink:'#1A1A1A', ink2:'#666', ink3:'#999', ink4:'#bbb', ink5:'#ccc',
             line:'rgba(0,0,0,.04)', line2:'#f0f0f0'};
```
(e.g. `allotment_v2.html:21112`, `:21899`, `:22019`, `:28971`, `:33331`, `:34616`, `:19844`)

This is a **distinct sub-brand inside Fleet**, separate from the app-wide Ocean-blue skin (`--ocean #1683C7` from `CLAUDE.md` §5) and separate from the Booking module's navy-blue "BuildAxis" skin. Its recipe:

- Page background `dim.bg = #F4F2EE` (warm grey-pink), applied by wrapping each panel's whole body in a negative-margin bleed div: `style="background:${dim.bg};margin:14px -16px -16px;padding:18px 20px 22px"` — this is the literal markup already sitting in the view shells, e.g. `#fl-dash-body`'s parent isn't styled but `#bs-pink-wrap`, `#fl-boats-pink-wrap`, `#fl-maint-pink-wrap`, `#fl-inc-pink-wrap`, `#fl-inv-pink-wrap` etc. all carry this inline (`allotment_v2.html:4575`, `:5211-5217`, `:5228`, `:5245`).
- Body text `dim.ink = #1A1A1A`, secondary `#666`, muted `#999`, faint `#bbb`, hairline `#ccc`.
- Hairline borders `rgba(0,0,0,.04)` (almost invisible — cards read as flat white blocks on `#F4F2EE`, not bordered boxes).
- Brand accent for this sub-system is **pink**, not ocean-blue: `#E03B7E` (accent chips / "active" pills) with soft tint `#FCE5EC` and deep text tone `#9F1B4F`. This is the same magenta as the Agent-list `--sb-pink` family but reused independently here.
- Font: `'DM Sans'` body, `'DM Mono'` for all numeric readouts (hours, PAX, ฿, dates) — consistent with the app-wide rule in CLAUDE.md §5.
- Header pattern repeated on every page: a row of pill-shaped chips (`border-radius:20px`, white bg, 1px hairline border, a 24×24 colored circular avatar with a 2-letter code + label) for pier/brand/category counts, ending in a plain black circular avatar badge with a single capital letter (`F`=Fleet dashboard, `B`=Boat Status, `M`=Maintenance, `J`=Job/Incident, `I`=Inventory, `G`=Gearbox, `ค`=Consumables…).
- KPI strip pattern: CSS grid, first column is a "hero" stat (42px bold number + unit + colored pill badges), remaining columns are `14px`-radius white cards (`padding:11px 13px`, border `1px solid dim.line`, or `2px solid <accent>` to flag "needs attention"), last column often inverted to `background:dim.ink;color:white` for a "by breakdown" mini-list.

## 1. Fleet Dashboard (`#view-fl-dashboard`, `flRenderDashboard()` — `allotment_v2.html:21024`)

**Shell** (`allotment_v2.html:5171-5181`): standard `.page-hd` (`h1`/`p`), date-nav in the actions row: two `.cal-nav` chevron buttons + `<input type=date>` styled `font-family:'DM Mono';border:1px solid var(--border);border-radius:var(--r-sm)` + a ghost "Today" button. Body is a single empty `#fl-dash-body` mount — 100% JS-rendered.

**Header bar** (`:21114-21122`): pill chips for Tub Lamu (`#185FA5`/"TL"), Visit Panwa (`#0F6E56`/"VP"), Ranong (`#BA7517`/"RN", conditional), plus black "F" badge — see §0 pattern.

**KPI strip** (`:21128-21167`) — 6-column grid `1.5fr 0.9fr 0.8fr 0.85fr 0.85fr 0.85fr`:
| Col | Content | Visual |
|---|---|---|
| 1 (hero) | `totalBoats` boats, `avail` pill (pink accent), `fixing`/`unavail` soft pills | 42px `DM Sans` bold number, `-1.5px` letter-spacing |
| 2 | Total fuel used today + Avg L/PAX | white card, clickable → Daily Report |
| 3 | "High alert" boat (most open incidents+maint) | **inverted** card `background:dim.ink;color:#fff`, ⚠ icon |
| 4 | Maintenance open/total + ฿ cost | `2px solid` pink-accent border (call-out) |
| 5 | Projects active/on-hold + boats off-line | `2px solid #1B2A4E` (navy) border — the only tile borrowing the Projects-page navy accent |
| 6 | Incidents open, major/minor breakdown | plain hairline border |

**Pill row** (`:21215-21230`): 3 flex-1 rounded-24px chips (Honda `#185FA5`/HN, Suzuki `#A32D2D`/SZ, Charter `#534AB7`/⚡) each showing count + "%"/label, ending in a black `+ Details` pill button.

**Boat Status card** ("heatmap variant C", `:21221-21260`): per-pier grouped mini rows, each a flat 4px-radius line: colored status dot (`STATUS_DOT = {available:'#0F6E56', fixing:'#854F0B', unavailable:'#A32D2D'}`), boat name, engine-count label in `DM Mono`, and an `M{n}` pink badge if it has open maintenance jobs.

## 2. Daily Fleet Log (`#view-fl-dailyreport`, `flRenderDR()` — `allotment_v2.html:21792`)

**Shell** (`:5187-5197`): same `.page-hd` + date-stepper pattern as Dashboard. Body mounts into `#fl-dr-body`.

**Layout order** (built at `:21875-22240`): `headerBar` → `kpiStrip` → `pillRow` (Honda/Suzuki/Charter, identical to Dashboard) → `weekStrip` (Mon–Sun day chips, current day filled solid pink `SVG_PINK.accent`, a dedicated month/year "stamp" card 208px wide aligned to the Boat column below) → 3× `sectionCard()` (Tub Lamu / Visit Panwa / Ranong) → boat entry rows.

### 2.1 Entry-cell design (`fldr-cell` / `fldr-in`) — exact recipe

Shared box style, built inline per cell (`CARD` const, `:22105`):
```css
border-radius:9px; padding:0 13px; box-sizing:border-box; height:50px;
display:flex; flex-direction:column; justify-content:center;
```
Input style (`INP` const, `:22106`):
```css
width:100%; font-family:'DM Mono',monospace; font-size:19px; font-weight:600;
background:transparent; border:none; text-align:right; outline:none; padding:2px 0 0; line-height:1.15;
```

Injected once per render, scoped to `#fl-dr-body` (`:22232`):
```css
#fl-dr-body .fldr-cell{transition:box-shadow .1s,border-color .1s}
#fl-dr-body .fldr-cell:focus-within{
  box-shadow:0 0 0 3px var(--ring,#E1F5EE);
  border-color:var(--rb,#1D9E75)!important; border-style:solid!important;
}
#fl-dr-body .fldr-in::placeholder{color:#c2c0b6}
#fl-dr-body .flfp-need::placeholder{color:#BA7517;opacity:1;font-weight:600}
@keyframes flfpPulse{
  0%,100%{box-shadow:0 0 0 0 rgba(239,159,39,.30)}
  50%{box-shadow:0 0 0 4px rgba(239,159,39,.12)}
}
#fl-dr-body .flfp-box-need{animation:flfpPulse 1.6s ease-in-out infinite}
#fl-dr-body .flfp-box-need:focus-within{animation:none}
```
The focus ring color is per-cell-type, set via inline CSS custom properties `--ring`/`--rb` on each `.fldr-cell`, not a single global ring:

| Cell | Empty bg | Filled bg | Border (empty / filled) | `--ring` | `--rb` (focus border) | Note |
|---|---|---|---|---|---|---|
| **PAX** (read-only, `:22125`) | `#E6F1FB` always | — | `0.5px solid #B5D4F4` | n/a (not editable) | n/a | label `PAX` blue `#185FA5`, value `#0C447C` |
| **Fuel (L)** (`:22110`) | `dim.bg #F4F2EE` | `#FAEEDA` (soft amber) | dashed `#EAD9B0` → solid `#FAC775`; anomaly → solid `#E6B0AA` on `#FCEBEB` | `#FAEEDA` | `#EF9F27` | shows live `L/pax` in header row |
| **฿/L price** (`:22119`) | `#FBF6EC` | `#FFF3E0`; **needs price** (`_fpNeed`) → `#FFF6E0` + pulsing `flfpBoxNeed` animation | solid `#EAD9B0` / `#F0CF9A` / need→`#EF9F27` | (uses default `#E1F5EE`) | (uses default `#1D9E75`) | text color `#854F0B`; shows `฿cost` or ⚠ when fuel entered but no price |
| **Engine hours** (per position, `:22138`) | `dim.bg` | `#fff` | dashed `dim.line2` → solid `#CFD8E3` | `#E1F5EE` | **`#1D9E75`** ← the one non-brand green called out below | shows `+Δh` since previous reading, red if negative |

**The `#1D9E75` accent** is the *only* place in Fleet that uses a teal-green distinct from the app's standard `--green:#2d9a6a` (CLAUDE.md palette). It is used specifically as: the engine-hour cell's focus ring border, the "READY" status pill background across Engine/Gearbox lists (§4), and the 0–60% "safe" service-hours legend dot. It reads as a slightly cooler/brighter green than the app-wide `--green`, reserved for "asset in good/ready state," while `--green` (`#2d9a6a`/`#0F6E56` dark variant) is used for booking/availability "available" states. Both exist in the codebase without a documented reason to unify them — treat as a semantic pair (`#1D9E75` = asset readiness, `#0F6E56`/`#2d9a6a` = operational availability).

**Placeholder colors:** default input placeholder `#c2c0b6` (muted tan); the "need price" input (`flfp-need` class) overrides to bold amber `#BA7517`.

### 2.2 Row / section chrome
- Section card: white, `border-radius:14px`, `padding:13px 14px`, hairline border, header row with 18px colored circular pier badge + operating-count pill + right-aligned PAX/trips/fuel/cost summary + Save/Edit button (`#0F6E56` filled "Save" → after saving becomes an outlined "Edit" chip `#185FA5` on `#E1F5EE` bg with a lock icon and "บันทึกแล้ว" label) — `allotment_v2.html:22195-22222`.
- Row grid: `grid-template-columns:32px 162px 232px 1fr` (avatar / name+meta / route chips / entry cards), `gap:14px`, `border-top:0.5px solid dim.line` — `:22183`.
- Anomaly row (fuel L/PAX > 20): whole row bg `#FCEBEB`, name turns `#A32D2D`, ⚠ badge.
- Unavailable/fixing boats with no entry: `noEntry` branch shows "ไม่ต้องกรอก" in muted `dim.ink3`; a boat that ran anyway shows an amber/red "ออกแล้ว…" chip (`ranChip`, `:22165`).

## 3. Boat Status (`#view-boats`, `renderBoats()` — `allotment_v2.html:8569`)

**Static shell** (`:4567-4646`): `.page-hd` with "+ เรือเช่า" ghost button; `#bs-pink-wrap` bleed div (hidden `.boats-layout` grid kept for legacy/API compatibility, `display:none`); a hidden legacy filter-pills block (`#boats-pier-filter`/`#boats-st-filter` — `.fp`/`.fp.on` classes from `:1603-1606`, ocean-blue `on` state) that the pink renderer replaces visually with its own pill buttons.

**Custom render** (`renderBoats()`) reuses the §0 header/KPI pattern:
- Header pills: TL/VP/RN pier chips + black "B" badge, "+ เรือเช่า" pill button top-right.
- KPI strip `1.6fr 1fr 0.85fr 0.85fr 0.85fr`: hero (Available count, 42px) → Available/Fixing/Unavailable clickable filter tiles → inverted "Charter active" tile.
- Filter bar: 3 pill-groups (pier / status / location-type), each a white rounded-24px track with a solid-black "on" pill — `pierBtn`/`stBtn`/`locBtn` helpers `:8674-8676`.

### 3.1 Three-tab pier grouping (`sectionHd()` — `allotment_v2.html:8767`)

Not literally `<tab>` elements — it's a **vertically stacked list grouped by section headers**, one header + boat-row block per pier, built in fixed order `tublamu → panwa → ranong → shop`:
```html
<div style="display:flex;align-items:center;gap:6px;margin:14px 0 8px;padding:0 4px 8px;border-bottom:1px solid rgba(0,0,0,.06)">
  <div style="width:18px;height:18px;border-radius:50%;background:${color}">${label.slice(0,2)}</div>
  <span style="color:${color};font-weight:600">${label}</span>
  <span style="background:${bg};color:${color};border-radius:9px;padding:1px 8px">${count}</span>
</div>
```
| Group | Color | Soft bg |
|---|---|---|
| Tub Lamu | `#0F6E56` | `#E1F5EE` |
| Visit Panwa | `#185FA5` | `#E6F1FB` |
| Ranong | `#BA7517` | `#FAEEDA` |
| 🔧 In Shop | `#854F0B` | `#FAEEDA` |

`getBoatCurrentPier(b)==='shop'` is what buckets a boat into "In Shop" regardless of its home pier — i.e. the 3(+1)-group split described in CLAUDE.md §3.1 is **pier + shop-override**, not literally pier+status; status (`available/fixing/unavailable`) is instead shown as a per-row pill, not a separate grouping tier. Charter boats get their own gradient banner section below the company list (`:8874`, `linear-gradient(to right,#FFF5EC 0%,#FBEAF0 60%,#F5DDE6 100%)`).

**Boat row** (`buildBoatRow`, `:8787-8830`): 32px circular avatar (initials, per-boat color from `getBoatColor`/palette fallback), name + `STATUS_STYLE` pill, optional pier-transfer badge (`📍`, pink `#9F1B4F`/`#FDF2F8`) and project chip (blue `#3A6FF7`/`#EEF3FF`), meta line (type · PAX · engines · brand), location pill. Selected row: pink-tinted bg `SVG_PINK.soft` + `1px solid #F0C0D0`. Unavailable/fixing (not selected): `filter:grayscale(1)` on avatar + `opacity:.65` on text content — a distinctive "fade to grey" treatment not used elsewhere in the app.

```js
STATUS_STYLE = {
  available:  {bg:'#1D9E75', color:'white',   label:'AVAILABLE'},
  fixing:     {bg:'#FAEEDA', color:'#854F0B', label:'FIXING'},
  unavailable:{bg:'#FCEBEB', color:'#A32D2D', label:'UNAVAIL'}
}
```
(`allotment_v2.html:8659-8663`)

### 3.2 Legacy static detail panel CSS (still defined, used as fallback / `.gantt`/`.st-picker`)
From the base stylesheet (`:1389-1470`):
- `.boats-layout` — `grid-template-columns:250px 1fr`.
- `.boat-list-panel`/`.boat-detail-panel` — white, `var(--r)` radius, `var(--shadow)`.
- `.boat-item.st-available/.st-fixing/.st-unavailable` — 3px left border in `--green`/`--amber`/`--red` (the **app-wide** palette, not the `#1D9E75` Fleet accent).
- `.detail-tabs`/`.detail-tab.on` — underline tab, ocean-blue active color/border.
- `.gantt-bar.g/.a/.r/.e` — green/amber/red/sand-dark(0.5 opacity) bars; `.gantt-today-line` ocean-mid at 50% opacity.
- `.st-picker`/`.st-opt.sel-available/.sel-fixing/.sel-unavailable` — the "Add Status" modal 3-way picker, tinted `--green-light`/`--amber-light`/`--red-light` backgrounds with matching border.

## 4. Company Asset (`#view-fl-asset`)

**Tabs** (`:5201-5208`, CSS `:1610-1614`): `.fl-tab-btn`/`.fl-tab-panel` — underline-style tab bar in a bordered `var(--white)` pill container (`border-radius:8px`, inner buttons flat). Active tab: `color:var(--navy); border-bottom-color:var(--navy); background:rgba(10,79,110,.05)`. Tabs: Overview · Boats · Engines · Gearboxes · Propellers · Documents · Safety. Each non-overview tab panel has its own `<tab>-pink-wrap` bleed div (`#F4F2EE`) matching §0.

**Overview tree** (`flRenderAssetTree`, `allotment_v2.html:23190-23263`): per-boat card with a 3-row aligned grid (`Engine` / `Gearbox` / `Propeller` label rows, each cell keyed by position). Spare parts riding on a boat (not installed) get a dashed-top-border strip labelled "📦 Spare" in indigo `#1c4e7e`/`#ede9ff`. Retired boats get their own greyscale section: circular grey (`#888`) avatar, strikethrough name, black "✕ RETIRED" pill, green "↩ Restore" button (`#1D9E75`).

### 4.1 Engine/Gearbox/Propeller detail — spec layout (`flRenderEngDetailPink`, `allotment_v2.html:24016-24243`)

**Header strip:** full-width gradient banner `linear-gradient(to right,#FFF5EC 0%,#FBEAF0 60%,#F5DDE6 100%)` (a warm pink/peach wash, distinct from the flat-white cards elsewhere), containing a 50×50 rounded-12px position chip (see below), serial number in 20px `DM Mono`, status pill, and an "Edit" button.

**Position chip** — the canonical Port·C.Port·Center·C.Std·Std labels (`FL_POS_CANON`, `allotment_v2.html:23792-23795`) render as a small stacked badge:
```html
<div style="width:50px;height:50px;border-radius:12px;background:${ac};color:white;
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            font-family:'DM Mono',monospace">
  <span style="font-size:9px;opacity:.85">${posLbl}</span>   <!-- e.g. "Port" -->
  <span style="font-size:13px;font-weight:700">EN</span>     <!-- asset-type code -->
</div>
```
Chip background `ac` = brand color by engine make: Suzuki `#A32D2D` (red), Honda `#185FA5` (blue); unassigned/spare `#999`. The same chip pattern repeats for Gearbox (`GB`) and is used in list rows too.

**Hours card** (`hoursCard`, `:24063-24081`): soft gradient `linear-gradient(135deg,${SVG_PINK.soft} 0%,#FFFAFB 100%)`, 32px `DM Mono` current-hours number, a "time to next service" pill colored by urgency, and a progress bar:
```js
barColor = pct>=80 ? SVG_PINK.accent /* #E03B7E */ : pct>=60 ? '#BA7517' : '#1D9E75';
```
Legend row under the bar: green dot "0–60% safe", amber dot "60–80% plan svc", pink dot "≥80% urgent". "Last service" line + a green `#1D9E75` "✓ บันทึกเซอร์วิส" (mark serviced) button.

**Stat cards** (`statCards`, `:24101-24118`): 4-col grid of flat `dim.bg` (`#F4F2EE`) rounded-10px tiles — Brand / Power (HP) / Service interval (h) / Position — label uppercase 10px muted, value 14–18px bold (HP/interval in `DM Mono`).

**Linked gearbox / history / maintenance sections:** all use the same `#FBFAF7` (near-white cream) rounded-10px list container with `0.5px` hairline row dividers; maintenance job rows carry a 3px colored left stripe (`done`=`#1D9E75`, `inprogress`=`#BA7517`, else grey) and a status pill from the shared `M_STATUS`/`STATUS_STYLE` maps (`ready/fixing/spare/broken` — same 4-state palette as gearbox list rows, `:24044-24048`).

Gearbox/Propeller list rows (`flRenderGbList`, `:24263`) reuse the identical header-pills + KPI-strip + filter-bar + status-pill recipe as every other Fleet sub-list (brand filter Honda/Suzuki, status filter Ready/Fixing/Spare/Broken, location filter Installed/Spare).

## 5. Maintenance (`#view-fl-maintenance`, `flRenderMaint()` — `allotment_v2.html:28967`)

Follows §0 exactly: header pills for job **type** (Corrective `#A32D2D`/CR, Preventive `#BA7517`/PV, Scheduled `#185FA5`/SC) + black "M" badge + "+ Create Job" button. KPI strip `1.6fr 0.85fr 0.85fr 0.85fr 1fr`: hero (total jobs, active/pending pills) → Pending (red `2px` border when >0) → In progress (amber `2px` border) → Done this month (green number) → inverted "by type" breakdown tile. Job list below splits into Active / Awaiting-invoice / Archive tabs (`_maintArchiveTab`).

## 6. Job Assignment / Incidents (`#view-fl-incident`, `flRenderIncident()` — `allotment_v2.html:33327`)

Same recipe, severity-keyed: Critical `#A32D2D`/CR, Major `#BA7517`/MJ, Minor `#666`/MN, black "J" badge. Two action buttons top-right: ghost "+ Log Incident" and solid black "+ Create Job". KPI strip: hero (total incidents, active count in solid red pill) → Open (red `2px` border) → In progress (amber `2px` border) → Resolved (green number, avg fix days). `effStatus()` derives incident status from its linked maintenance job rather than storing it directly.

## 7. Inventory / Memo (`#view-fl-inventory`, `flRenderInventory()` — `allotment_v2.html:34612`)

Header pills by top stock **category** (Engine `#185FA5`, Gearbox `#BA7517`, Propeller `#0F6E56`, Hull `#7F77DD`, General `#666`; `CAT_COLOR`/`CAT_ABBR` map at `:34641-34643`) + black "I" badge; 3 action buttons (+Receive, +Add item, solid +Create Memo). KPI strip: hero (total items, ฿ value pill, low-stock warning pill) → Low stock (red `2px` border) → Pending memos (amber `2px` border) → Paid this month (green) → inverted "by status" breakdown (Pending/Approved/Received/Paid).

Two sub-tabs (`tabBtn` pill toggle, `:34637`): **Stock items** table and **Memorandum** table. Stock table row: checkbox cell, item name + category pill (`CAT_COLOR+'22'` tint bg / `CAT_COLOR` text), part no. in `DM Mono`, per-warehouse qty breakdown, quantity in 16px bold `DM Mono` colored green (`#1D9E75`) or red (`#A32D2D`) if ≤ min, ฿ cost right-aligned `DM Mono`, and inline Receive/Transfer/Edit/Order action buttons. Selected row: `SVG_PINK.soft` bg + 3px pink left border on the name cell.

## 8. เบิกของใช้/น้ำมัน — Consumables (`#view-fl-consumables`, `renderConsumables()` — `allotment_v2.html:19834`)

Same header/KPI recipe but its own accent `ACC = '#0F6E56'` (teal-green, matches Tub Lamu pier color) instead of pink. Month-stepper pill (‹ label ›) replaces the date input. KPI strip `1.6fr 0.85fr 0.85fr 1.1fr`: hero (total ฿ consumed, item count pill) → Oil/units withdrawn (blue `#185FA5`) → Repair cost MJ (amber `#854F0B`) → inverted "Upkeep รวม" breakdown (repair + consumables split, consumables highlighted `#9FE1CB` on dark). Per-boat cost table below (repair / consumables / total upkeep columns) plus a full withdrawal-history table.

## 9. Cost Analytics (`#view-fl-cost`, `flRenderCostAnalytics()` — `allotment_v2.html:29579`)

Departs from the pill-KPI recipe — this page is **card-based**, not strip-based:
- Header: single black circular icon badge (bar-chart SVG) + a pill time-range filter (`All time` / `YTD` / `Last 30 days` / `This month`), same black-fill "on" pill style as elsewhere.
- **Total card**: 42px `DM Mono` ฿ total, then a **segmented horizontal bar** (`display:flex;height:13px;border-radius:7px`) split black (`dim.ink`, "ปิดงานแล้ว") vs gold `PROC = '#E0B24B'` ("กำลังดำเนินการ · ยังไม่ปิด") — this specific gold `#E0B24B` is unique to Cost Analytics' in-progress-cost legend and not reused elsewhere.
- **Central-cost card**: separate ฿ figure for memos not tied to a specific boat, with an amber `#FFF6E5`/`#A05A1A` explainer callout box.
- `legBox()` helper renders each breakdown row as a bordered chip with a colored 11px square swatch, hover-highlights pink (`PK.soft`).

## 10. Fleet Insights (`#view-fl-insights`, `flRenderInsights()` — `allotment_v2.html:30185`)

Health-scorecard page. Time filter pills (This Month / This Quarter / YTD / All Time). Per-boat health tiers (`getHealth()`, `:30260-30263`):

| Level | Trigger | Color | Soft bg |
|---|---|---|---|
| Critical | ≥3 jobs OR cost ≥ ฿100,000 | `#A32D2D` | `#FBE9E9` |
| Watch | ≥1 job | `#854F0B` | `#FAEEDA` |
| Healthy | else | `#0F6E56` | `#E6F4ED` |

Boat rows are sortable (cost/incidents/jobs/name), with a Tier-1 "most attention needed" alert card at top reusing the §0 pink-accent pattern.

## 11. Fuel Intelligence (`#view-fl-fuel`, `allotment_v2.html:29944`)

The most data-dense Fleet page — a genuinely distinct sub-skin using its own scoped classes rather than inline-only styling:
```css
#fl-fuel-wrap .fi-card{background:#fff;border-radius:16px;border:0.5px solid rgba(0,0,0,.06);box-shadow:0 1px 3px rgba(20,20,20,.045)}
#fl-fuel-wrap .fi-kpi{border-radius:16px;box-shadow:0 1px 4px rgba(20,20,20,.07)}
#fl-fuel-wrap table.fi-tbl{width:100%;border-collapse:collapse}
#fl-fuel-wrap table.fi-tbl th{font-weight:500;padding:0 10px 9px}
#fl-fuel-wrap table.fi-tbl td{padding:10px}
#fl-fuel-wrap table.fi-tbl tbody tr:hover{background:#FAFAF7}
#fl-fuel-wrap .fi-sec{font-size:13px;font-weight:600;color:#262626;display:flex;align-items:center;gap:8px}
#fl-fuel-wrap .fi-tick{width:4px;height:15px;border-radius:2px;background:${PK.accent};display:inline-block;flex:none}
#fl-fuel-wrap .fi-mut{font-size:11px;color:${ink3}}
```
(`allotment_v2.html:30101-30110`) — `PK = {accent:'#E03B7E', soft:'#FCE5EC', text:'#9F1B4F'}` (same pink as §0, given a local alias). Section headers use a 4px colored "tick" bar (`.fi-tick`) instead of a circular badge — the one place in Fleet using a tick-mark section-header instead of an avatar-circle.

Distinctive elements:
- **Expandable boat→route rows** in the main fuel table (click a boat row to reveal per-route sub-rows indented 55px, `▶` rotates 90° when open).
- **Weekly heatmap table** (`wkCard`): each week-cell background/text tone-mapped against that boat's own prior-month baseline — `toneM()` (`:30021`): ≤95% of baseline → green (`#E7F5EE`/`#0F6E56`), <115% → amber (`#FBF3E2`/`#8A5B00`), else red (`#FCE9E9`/`#A32D2D`). A boat that didn't run shows greyed "ไม่ออก"/"—" instead of 0.
- **Efficiency bars** (`effRows`): horizontal L/hr bar chart per boat, worst performer flagged red with a "เปลือง ⚠" tag, best flagged green "ดีสุด".
- **Weekly bar chart** (`wkBars`): CSS bar chart, peak week bar `#D4537E` (deep pink), others `#F4C0D1` (pale pink) — a two-tone bar palette unique to this chart.
- **Sparklines** in the monthly trend table: tiny `<i>` bars, current month `PK.accent` pink, history bars `#D9D5CC` grey.
- **n=1 caveat styling**: any average computed from a single day gets an inline `background:rgba(0,0,0,.07)` "n=1" badge next to the value — a deliberate low-confidence marker.

## 12. Fleet Projects (`#view-fl-projects`, `flRenderProjects()` / `flProjRenderList()` — `allotment_v2.html:27162`)

**This page breaks from the pink/`dim` Fleet sub-brand entirely** and instead reuses the Booking module's navy-blue "BuildAxis" skin, via its own palette object:

```js
const PROJ_PALETTE = {
  navy:'#1F2A44', ink:'#0F172A', ink2:'#475569', ink3:'#94A3B8', ink4:'#CBD5E1',
  line:'#E5E7EB', bg:'#F6F7F9', card:'#FFFFFF',
  blue:'#3A6FF7', blueSoft:'#EEF3FF',
  mint:'#10B981', mintSoft:'#E7F6F0', mintInk:'#047857',
  amber:'#F59E0B', amberSoft:'#FEF3CD', amberInk:'#B45309',
  red:'#EF4444', redSoft:'#FEE7E7', redInk:'#B91C1C',
  purple:'#A855F7', purpleSoft:'#F3E8FF',
  cyan:'#06B6D4', cyanSoft:'#CFFAFE',
  shadow:'0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.06)',
  shadowLg:'0 4px 12px rgba(15,23,42,.06), 0 2px 6px rgba(15,23,42,.04)'
};
```
(`allotment_v2.html:26310-26327`) — note `blue #3A6FF7` matches `--bk-navy` in `#view-booking`'s BuildAxis skin almost exactly (CLAUDE.md-documented re-skin), and `line #E5E7EB` is a **solid** grey border (not the `rgba(0,0,0,.04–.09)` hairlines used everywhere else in Fleet/base app) — a deliberately crisper, "SaaS product" look versus the soft warm-grey Fleet sub-brand.

Custom icon set `PROJ_ICONS` (Lucide-style inline SVG paths, `:26332+`) is scoped to this page only (`flProjIcon()` helper).

Layout is a 2-column "greeting hero" header: left card is a gradient `linear-gradient(120deg,#EEF3FF 0%, #F5F8FF 60%, #FFFFFF 100%)` panel with a time-of-day greeting ("Good morning/afternoon/evening, Operations 👋"), today's date pill, and a "Live Data" pill with a mint status dot; right card is an "AI Project Insight" health-score card (0–100 score, computed from in-progress+completed ÷ total). This BuildAxis/greeting-hero pattern does not appear anywhere else in Fleet.

## 13. Boat Operation (`#view-operation`, `renderOp()`/`bop2RenderShell()` — `allotment_v2.html:11209-11211`)

Third distinct palette — its own code comment calls it out explicitly:
```css
/* ─── Mint dashboard palette ───────────────────────────── */
```
(`allotment_v2.html:11271`) Primary accent is **mint-teal `#0F6E56`** (not pink, not navy):
- `.bo-tile` — white, `1px solid rgba(0,0,0,.08)`, `radius:16px`, number in `'Manrope','DM Mono'` 28px bold.
- `.bo-btn` — pill button, mint text/border, mint-tint hover (`#DDF0E5`); `.bo-btn.primary` solid mint fill.
- `.bo-seg` segmented toggle — track `#F1F5F1`, active segment solid mint with a soft shadow.
- `.bop2-cell-day.sel` — `box-shadow:0 0 0 2px #0F6E56` ring on the selected heatmap day.
- `.bo-day-h` circular day-of-week header: today = mint filled circle; **selected** day = **yellow** filled circle (`#FFD93D` bg, dark `#2F2410` text, `box-shadow:0 2px 6px rgba(255,217,61,.4)`) — yellow-for-selected is unique to this page; **alert** day (needs boats) = coral-red filled circle (`#FF7560`).
- Heatmap grid (`.bop2-grid`/`.bop2-cell`) is a borderless, transparent-background pastel grid — cells get their fill color inline per allotment status, not via CSS classes.

## 14. Fleet Calendar (`#view-fleetcal`, `renderFleetCal()` — `allotment_v2.html:10386`)

Shares the Boat Operation mint palette by explicit reuse (code comment: *"token ชุดเดียวกับ Boat Operation · คัดลอกมาให้ scope นี้ใช้ได้ตรง ๆ"* — `allotment_v2.html:10476`). Month-grid day cells:

```css
.fc-day{background:#FAFCFA;border:1px solid rgba(0,0,0,.055);border-radius:12px;
         padding:8px 9px 9px;min-height:132px;transition:transform .12s,box-shadow .12s}
.fc-day:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(26,42,51,.08)}
.fc-day.today{border-color:#0F6E56;box-shadow:0 0 0 1px #0F6E56}
.fc-day.closed{background:#FFF6F4;border-color:rgba(196,74,54,.25)}   /* weather-cancelled */
.fc-day.past{background:#FBFBF9;opacity on .fc-b: .55}
```
Each cell shows: day number in a circular badge (mint-filled if today), a "พร้อม N" ready-count pill (mint `#DDF0E5`/`#0F6E56` normal, red `#FFE2DC`/`#C44A36` if zero ready, grey `#F1F5F1`/`#9AA39C` if past), per-route colored dot + boat chips, a weather-cancel banner (`.fc-wx`, red-on-red), a "Ready at pier" footer section per pier, and an in-shop/fixing line in red if any boat is fixing that day. Charter rows use a distinct **purple** `#6B289A` (route name + boat chip inset shadow) not used anywhere else in Fleet — purple is otherwise reserved for `--purple #6c5ce7` general-app accents.

## 15. Boat Assign (`#view-boatassign`, `allotment_v2.html:55236`)

Plain ad-hoc inline styling (no shared palette object) built around per-route cards: white, `radius:12px`, hairline border, header row (route name, "N bookings · X/Y pax · Z boats", "auto-assign" solid blue `#185FA5` button, an "all assigned"/"N unassigned" status pill in mint/amber). Boat capacity mini-cards show a load bar (`#0F6E56` normal, `#A32D2D` if over capacity). Booking rows use a `<select>` for boat assignment with border color reflecting assignment state (mint `#9FE1CB` assigned / red-tinted `#E6C9C3` unassigned) plus an "⤴ Upgrade" toggle button (purple `#6B289A`/`#F4E8FB` when active) for emergency cross-boat/cross-route moves.

## 16. Transfer Fleet — Vehicles (`#view-vehicles`, `renderVehicles()` — `allotment_v2.html:55735`)

Reuses the Fleet-Insights-style header (comment: *"Shared Fleet-Insights-style header (used by all tabs)"*, `:55747`) but with its own zone-based chips (Phuket `#185FA5`/PK, Khao Lak `#0F6E56`/KL) and a forest-green "hero" tile (`#1C4A30` bg, mint `#9BCBA6` labels) for the "พร้อมวิ่งครบ / ต้องสนใจ" alert card — a darker, more saturated green than the mint used in Boat Operation/Fleet Calendar. A 4-tab pill switcher: สถานะ (status) / ตารางเดือน (matrix) / ทะเบียน (registry) / รายวัน (daily). "พร้อมใช้" (available) KPI tile is unique in using a `1.5px solid #F48FB1` (pink) border rather than the usual hairline.

## 17. Insurance (`#view-insurance`, `allotment_v2.html:43815`)

Table-first working page (per-route booking/passenger insurance data-entry), not KPI-strip based. Route group header: `border-left:4px solid #185FA5` on a pale blue `#F7FAFC` band, with 4 summary numbers (pax, "no age" count red if >0, "missing name" count amber if >0, and a reviewed-progress bar green `#0F6E56` fill on `#EEECE4` track). Data grid rows are a CSS grid (`32px 128px 1fr 1fr 118px 1.4fr 118px 30px`) with per-field inline inputs; a field the user has manually overridden gets a small purple `#7F77DD` "override" dot next to it, and a blank required field (age) gets a red-outlined input (`#E24B4A` border, `#FDECEC` bg) with an inline "!" glyph. "Reviewed" toggle button: green filled pill when reviewed, plain outline otherwise.

## 18. Cross-page color reference

| Token | Hex | Used for |
|---|---|---|
| App base green | `--green` `#2d9a6a` (dark `#1a6040`, light `#d8f4e8`) | app-wide "available"/success (base stylesheet, `:1207`) |
| App base amber | `--amber` `#d48a14` (light `#fef6df`) | app-wide "fixing"/warning |
| App base red | `--red` `#c43a2e` (light `#fdecea`) | app-wide "unavailable"/danger |
| Fleet pink accent | `#E03B7E` / soft `#FCE5EC` / text `#9F1B4F` | §0 "SVG_PINK" — Dashboard, Daily Report, Boat Status, Maintenance, Incident, Inventory, Cost, Insights, Fuel |
| Fleet asset-ready green | `#1D9E75` | engine-hours focus ring, READY status pill, service-safe legend — distinct from `--green` |
| Fleet mint (ops) | `#0F6E56` | Boat Operation, Fleet Calendar, Consumables accent, "available" status color in pink-dashboard pages |
| Boat status red (dark) | `#A32D2D` | unavailable/critical text+bg pairs across all Fleet pages (paired bg `#FCEBEB`) |
| Boat status amber (dark) | `#854F0B` / `#BA7517` | fixing/watch text+bg pairs (paired bg `#FAEEDA`) |
| Suzuki brand red | `#A32D2D` | engine/gearbox brand chips |
| Honda brand blue | `#185FA5` | engine/gearbox brand chips, "TL" pier chip |
| Charter purple | `#534AB7` / chip `#6B289A` (Fleet Calendar) | charter boat avatars, charter route rows |
| Cost Analytics gold | `#E0B24B` (`PROC`) | "in-progress, not yet closed" cost segment — unique to Cost Analytics |
| Projects navy/blue (BuildAxis) | `#1F2A44` / `#3A6FF7` | Fleet Projects page only — borrowed from `#view-booking` skin |
| Insurance override dot | `#7F77DD` | manually-edited field marker |

## 19. Typography summary

- Body: `'DM Sans', sans-serif` everywhere in Fleet (base app rule).
- All numeric/monetary/date/time values: `'DM Mono', monospace` — hours, ฿, PAX, dates, serials, percentages. Enforced consistently across every sub-page audited above.
- Boat Operation / Fleet Calendar use `'Manrope','DM Mono'` for their day numbers and stat tiles specifically (a small deviation, `:11276` etc.) — Manrope is otherwise the Agent-list/Rate-Types page font per the base stylesheet's `#view-agents` overrides (`allotment_v2.html:1994-2006`), so its appearance in Boat Op/Fleet Calendar is a deliberate borrow, not a stray.
- Hero KPI numbers: 42px, `font-weight:700`, `letter-spacing:-1.5px` — this exact recipe (`42px/-1.5px`) recurs identically across Dashboard, Daily Report, Boat Status, Maintenance, Incident, Inventory KPI strips; treat it as the fixed "hero number" style for any new Fleet KPI tile.
