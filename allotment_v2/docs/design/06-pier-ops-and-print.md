# 06 · Pier Ops, Van/Transfer, Check-in & Print System

Scope: `#view-vanjobs`, `#view-vancheckin`, `#view-piercheckin`, `#view-poa-*` (attendance), `#view-pol-*`
(licenses), `#view-poj-*` (boat job board), `#view-po-*` (pier office / equipment — panwa/tublamu/ranong),
`#view-travelsum`, `#view-dailyreport`, `#view-devlog`, plus every print/PDF/email popup document reachable
from this area. All line refs are `allotment_v2.html:N`.

**Headline finding:** this slice of the app is a patchwork of *at least six unrelated visual systems* laid over
one shared base font (DM Sans/DM Mono). The main app skin is Ocean blue `#1683C7` (per `CLAUDE.md`), but almost
none of the pages here actually use it as their primary accent — each page picked its own identity color at
build time and never got re-skinned. See §7 for the full inventory.

---

## 0. Shared foundations

### `ckSharedCSS(scope)` — `allotment_v2.html:47819`
The base stylesheet shared by **Pier Check-in** and **Van Check-in** (both call it with their own host
selector as `scope`, e.g. `#piercheckin-host`, `#vancheckin-host`). Defines the sticky day-header, the KPI
pill bar, the shared `table.ck-tbl` row styling, and the checked/unchecked visual language:

```css
/* unchecked row = desaturated */
.ck-row.ck-plain .ck-agblk{filter:grayscale(1);opacity:.5}
.ck-row.ck-plain .ck-lead{background:#F1EFE8 !important;color:#8a8a82}
/* checked-in row = full color restored */
.ck-row.ck-done .ck-agblk{filter:none;opacity:1}
```
Row-state background colors:

| State | Background | Left-edge accent | Meaning |
|---|---|---|---|
| default | `#fff` (hover `#fcfcfd`) | — | normal row |
| `.ck-lost` | `#F6CFCB` (hover `#F2C2BD`) | `#C0392B` | pax lost (no-show/cancel) |
| `.ck-nsfull` | `#F1B8B2` | — | whole booking no-show |
| `.ck-late` | (row bg unchanged) | `#C0392B` | overdue check-in |
| `.ck-row.ck-arr` (pier) | `#F3F8FD` | `#7EAED8` | arrived at pier |
| `.ck-row.ck-clr` (pier) | `#FDF8EE` | `#D9A441` | cleared (docs + money done) |

Time-pill states (`.ck-tm-*`, `.ck-gtm-*` on group headers) — a 5-state traffic light reused everywhere a
countdown-to-departure shows:

| State | Text | Chip bg / fg |
|---|---|---|
| soon | `#854F0B` | `#FAEEDA` / `#854F0B` |
| due | `#0C447C` | `#E6F1FB` / `#0C447C` |
| late | `#A32D2D` | `#FCEBEB` / `#A32D2D` |
| done | `#0F6E56` | `#DCF4E8` / `#0C6B47` |
| missed | `#8a8a82` | `#F1EFE8` / `#7a7a72` |

### `pckExtraCSS()` — `allotment_v2.html:47780`
Pier-check-in-only additions layered on top of `ckSharedCSS`: the filter bar (`.ck-fbar`), the van-group
outline (`tbody.pck-vgrp` gets a colored `border-left/right` driven by CSS var `--vc` = that van's identity
color, §0.2), and the passenger detail drawer (`#pck-drawer`, primary button `#1C4A30` — a **third green**,
distinct from both Ocean blue and the `#0F6E56` teal-green used almost everywhere else).

### §0.2 — Two independent per-entity color systems
Two unrelated “identity color” engines feed swatches across this whole area; neither uses the brand palette:

**Boat color** — `pckBoatColor(id)` (`allotment_v2.html:49148`) reads `boat.color`, falling back to a fixed
`#185FA5`. Also feeds the by-trip-date boat palette `PAL_BOAT` (`allotment_v2.html:72192`), a 7-color set:
```
['#E6F1FB','#185FA5'] ['#E1F5EE','#0F6E56'] ['#EEEDFE','#534AB7'] ['#FAEEDA','#854F0B']
['#FAECE7','#993C1D'] ['#FBEAF0','#993556'] ['#EAF3DE','#3B6D11']
```
(bg/text pairs, assigned by boat index unless the boat has an editable color).

**Vehicle color** — `vehColor(vid)` (`allotment_v2.html:39362`) reads `v.color`, else hashes the vehicle id into
a **32-color** stable palette `VEH_COLORS` (`allotment_v2.html:39351`), so a van's color is fixed day-to-day
(this replaced an older scheme that colored rows `PAL[i % 6]` by *position*, which changed daily — see the
comment at `allotment_v2.html:39348`). `vehGrad()` darkens it 22% for a gradient chip; `vehChipPair()` tints it
87% toward white for a light bg / dark text pair. Both Van Job Orders and Van Check-in use this for the van
pill and card border.

**Zone color** — `bkV2ZoneColor(z)` (`allotment_v2.html:71741`): `PK` → `#185FA5`, `KL` → `#3B6D11` (olive),
`NoTransfer`/`NT` → `#8b909c` (grey). Used on Van Check-in zone-header dots and Pier Check-in zone chips.

**Conflict color ("รถปนกัน" — mixed vans in one group)** — a **stand-alone purple**, `#7A1FA2` on `#F3E0F7`
bg, border `#D9A8E8` (`allotment_v2.html:72446`, banner variant `allotment_v2.html:46969`). This color is used
for nothing else in the app — purple exclusively means "a van-group conflict needs resolving."

---

## 1. Pier Check-in — `#view-piercheckin` → `renderPierCheckin()` (`allotment_v2.html:51256`)

CSS: `ckSharedCSS('#piercheckin-host')` + `pckExtraCSS()` + `pckCardCSS('#piercheckin-host')`
(`allotment_v2.html:49223`). Hierarchy rendered: **boat card → trip → zone → van group → passenger row**
(`§pierHierarchy`, `allotment_v2.html:51321`).

### Boat card (`pckCardCSS`, `allotment_v2.html:49223`)
```css
.pck-boat{border-radius:22px;margin-bottom:18px;overflow:hidden;padding-bottom:12px;
  box-shadow:0 10px 30px -6px rgba(15,23,42,.10),0 3px 10px -3px rgba(15,23,42,.06)}
.pck-bband{padding:14px 18px 13px;display:flex;align-items:center;gap:13px}       /* colored header band */
.pck-bmark{width:40px;height:40px;border-radius:13px;font:800 14px 'DM Mono'}     /* boat initials */
.pck-bname{font-size:19px;font-weight:800;letter-spacing:-.2px}
.pck-rchip{background:#fff;border-radius:999px;padding:5px 14px 5px 11px;font:800 14px/1.15 inherit;
  box-shadow:0 1px 4px rgba(0,0,0,.18)}                                          /* route pill, on white */
.pck-rdep{font:800 13.5px 'DM Mono';padding:4px 13px;border-radius:999px;color:#fff;
  border:1.5px solid rgba(255,255,255,.9)}                                       /* departure time pill */
```
The band background is the boat's own color (from `pckBoatColor`/boat palette) — every boat card is a
differently-colored banner, so there's no single "brand" color on this page; it's whatever the boat's
identity color happens to be.

Zone cards nest inside a trip block: `.pck-zone{background:#fff;border-radius:16px;padding:11px;border:1px
solid #E7E4DC}`, and van groups nest inside zones: `.pck-van{border:1.5px solid;border-radius:15px}` (border
color = that van's identity color).

### Check-in row states & big-touch targets
Rows are inside the shared `table.ck-tbl` (from `ckSharedCSS`) with `td{padding:13px 8px}` — comfortably
tap-sized for a tablet at the pier, though this is a *dense table*, not big cards; the touch targets that are
deliberately oversized are the action buttons:

```css
.pck-ok{height:30px;padding:0 12px 0 5px;border-radius:999px;background:#0F6E56;color:#fff;
  box-shadow:0 2px 6px -2px rgba(15,110,86,.55)}      /* checked-in pill, green, ~30px tall */
.pck-ok .tk{width:20px;height:20px;border-radius:50%} /* circular tick badge inside it */
.pck-ok.off{background:#fff;border:1.5px solid #D7DBD5;color:#5F5E5A;box-shadow:none}
.ck-ck{width:24px;height:24px;border-radius:7px;border:1px solid #D7DBD5}   /* generic checkbox-style toggle */
.ck-ck.on{background:#0F6E56;border-color:#0F6E56;color:#fff}
```
Stage colors (`pckStage`): waiting → default grey text, arrived → blue accent `#7EAED8`, cleared → gold
`#D9A441`, on-board (checked in) → green `#0F6E56`, void/cancelled-on-site → red chip `.pck-vdchip` on
`#FBE9E9`/`#A32D2D`.

### On-site money widget (`pckPayCSS`, `allotment_v2.html:48787`)
Modal-scoped (`#acct-modal .pckp-*`). Uses a **purple accent for fee/COT lines** (`#5B289A` on `.pckp-lnhd
.amt i`, `.pckp-unit button.on`), separate from the green (paid, `.pckp-tot.ok` = `#0F6E56`), amber (short,
`#7A4A00`) and red (over, `#A32D2D`) settlement states. Payment-method chips: cash `#DCF4E8`/`#0F6E56`,
transfer `#E6F1FB`/`#185FA5`, card `#EDE7FB`/`#5B289A`.

### On-site notes & meals (`pckNoteCss`, `allotment_v2.html:49478`; meal chips `allotment_v2.html:49514`)
Small modal for "โน้ตหน้างาน" (day-of notes) — cream note box `background:#FFF8E6;border:1px solid
#EEDFAE;color:#7A4A00`. Meal chips: veg/vegan → green `#0F6E56`/`#E7F4EF`, halal → blue `#185FA5`/`#E9F1FB`,
allergy warning → red `#A32D2D`/`#FCEBEB`.

---

## 2. Van Check-in — `#view-vancheckin` → `renderVanCheckin()` (`allotment_v2.html:48205`)

Reuses `ckSharedCSS('#vancheckin-host')` — same row states as Pier Check-in — but groups rows by **zone →
van group** (no boat layer; a van group header row replaces the boat band). The van-group header pill uses
`vehChipPair(vid)` for its background (`allotment_v2.html:48244`), so each van keeps a stable color across
both check-in pages and Van Job Orders. Zone headers use `bkV2ZoneColor` dots (PK blue / KL olive / NoTransfer
grey).

---

## 3. Van Job Orders — `#view-vanjobs` → `renderVanJobs()` (`allotment_v2.html:46547`)

No dedicated CSS function — this page is built with **inline styles** directly in the render function. Van
rows use `vehGrad(vid)` for a diagonal gradient chip (`linear-gradient(135deg, color, darker-22%)`).

Hero banner (top-of-page "is everything dispatched" status) — three states, red/amber/green, computed once
(`allotment_v2.html:46583`):

| State | bg | ring | label |
|---|---|---|---|
| outbound pax unassigned | `#8A1C1C` | `#C0392B` | ⚠ ยังไม่จัดรถ |
| only return unassigned | `#8A5A1C` | `#B9791F` | ↩ ยังไม่จัดรถกลับ |
| fully dispatched | `#1C4A30` | — | ✓ จัดครบแล้ว |

Ownership tag chips (`vanJobsOwnerTag`, `allotment_v2.html:46544`): partner (รถร่วม) `#9A5B00`/`#FBF0E0`,
rental/charter (เช่า) `#185FA5`/`#EAF1FB`, company (บริษัท) `#0F6E56`/`#E3F0EA`. Over-capacity cells turn red
(`#B4232A` text on `#FDECEC`). The "รถปนกัน" conflict banner is the stand-alone purple described in §0.2.

### Guide job cards / guide job sheet (`pckGuideJobCss`, `allotment_v2.html:49805`)
Not a screen page — this is the print-only "ใบงานไกด์" (per-van/per-boat guide job sheet), documented in the
print table below since it's a document, not a live view.

---

## 4. Pier Office family (equipment, attendance, licenses, boat job board)

All four pages share one host class `.pj-host` and one accent navy, **`#16265C`** / **`#0F172A`** — a
Tailwind-Slate palette completely unrelated to Ocean blue. Per-pier views (`panwa`/`tublamu`/`ranong`) are
separate DOM hosts (`po-host-<pier>`, `pa-host-<pier>`, `pl-host-<pier>`, `pj-host-<pier>`) that all call the
**same** render function with a pier argument — **there is no per-pier color theme**. `PO_PIERS`
(`allotment_v2.html:79597`) does carry a per-pier `c` field —
`panwa:'#0F6E56'`, `tublamu:'#185FA5'`, `ranong:'#BA7517'` — but a repo-wide grep confirms `P.c` is **never
read anywhere**; it's dead data left over from an abandoned per-pier-color idea. The only visible per-pier
difference is the badge initials (`VP`/`TL`/`RN`) and which boats/staff the data filters to.

### 4.1 Pier Office (equipment check-out/in) — `poCSS()` (`allotment_v2.html:79915`)
Host `.po-host`. "§poSkin: slate tone, big rounded cards, soft shadow" per the code comment. Deliberately its
own Tailwind-slate design language:

```css
.po-host{color:#1E293B;background:#F0F2F5}
.po-badge{width:40px;height:40px;border-radius:14px;background:#0F172A;color:#fff}
.po-bar button.pri{background:#0F172A;color:#fff}
.po-bar button.now{background:#EEF2FF;color:#4F46E5}        /* "today" pill: indigo, not Ocean blue */
.po-kpi{background:#fff;border:1px solid #F1F5F9;border-radius:22px;
  box-shadow:0 10px 30px -5px rgba(0,0,0,.04),0 4px 12px -2px rgba(0,0,0,.02)}
.po-kpi .v{font:800 26px 'DM Mono',monospace;color:#0F172A}
.po-btn.warn{background:#F59E0B;border-color:#F59E0B;color:#fff}
```
KPI icon accent colors are per-metric, not brand: boats-out `#2563EB`/`#EFF6FF`, issued `#D97706`/`#FFFBEB`,
close-out `#059669`/`#ECFDF5` (or amber if pending), stock-ready `#4F46E5`/`#EEF2FF`, laundry/repair
`#E11D48`/`#FFF1F2`. In-stock quantity numbers render in `#10B981` (emerald, not the app's usual `#0F6E56`
teal-green).

### 4.2 Attendance schedule — `paCSS()` (`allotment_v2.html:80949`), pop `paSectCSS()` (`allotment_v2.html:81584`)
A literal spreadsheet grid (`§paSheet`: "grid lines on all four sides, like a spreadsheet — the old version
only had bottom borders and columns were unreadable"). Sticky 4-column header (no./name/nickname/role),
sticky month header row `background:#1F3C88` (navy), edit-mode focus ring/accent `#16265C`:

```css
table.pa{border-collapse:collapse!important}
th.pa-h0{background:#1F3C88;color:#fff}                 /* month band */
.pa-cd{ /* one shift-code cell, filled edge-to-edge — conditional-formatting style */
  display:block;font:800 9px/23px inherit}
td.pa-c.we::before{background:rgba(20,30,50,.05)}       /* weekend tint layered ON TOP of the code color */
.pa-edb.on{background:#8A5A00;border-color:#8A5A00;color:#fff}  /* "editing" toggle = amber, not navy */
```
Shift-code colors are fully user-defined per `PIER_CODES` (`paCodeColor`, `allotment_v2.html:81695`) — no
fixed palette to document; operators pick their own colors per code.

### 4.3 Licenses — `plCSS()` (`allotment_v2.html:81923`)
Small badge/table page. License status badges: ok `#0F6E56`/`#E6F3EC`, expiring-soon `#B4560A`/`#FFF0D8`,
expired `#C0271C`/`#FDECEA` (strikethrough), n/a `#8B93A1`/`#F4F6FA`. Side tags: deck `#20477E`/`#E9EFF7`,
engine `#0E7D74`/`#E2F7F5`.

### 4.4 Boat Job Board ("ใบงานเรือ" assignment) — `pjCSS()` (`allotment_v2.html:82422`)
The largest and most bespoke page in this family — a horizontally-scrolling strip of per-boat cards (`.bc`),
width-switchable 3/4/5-up (`.pj-strip.w3/w4/w5`). Card anatomy: colored `.top` banner (route/program color) →
colored `.pg` program band → white `.stbar` status bar → license-check box → crew/guide/customer/note rows
(color-coded by `PJ_SEC`, `allotment_v2.html:82417`) → pax count strip → footer buttons.

```css
.pj-host{font-family:"Sarabun","DM Sans",sans-serif}         /* Thai-first font stack, unlike rest of app */
.pj-bar button.pri{background:#16265C;border-color:#16265C}  /* primary = navy, not Ocean blue */
.bc.lk{border-color:#BFE0CD;box-shadow:0 0 0 2px rgba(15,110,86,.09)}   /* locked/confirmed card = green ring */
.bc.clash{border-color:#E8B4AE;box-shadow:0 0 0 2px rgba(192,39,28,.10)} /* clash = red ring */
.pj-lb{background:#0F6E56;border-color:#0F6E56;color:#fff}    /* lock button */
.pj-lb.ed{background:#FFF6E5;border-color:#EFD9AE;color:#8A5A00}  /* "editing a locked card" = amber */
```
`PJ_SEC` row-group colors (`allotment_v2.html:82417`): crew `#1B4A87`/`#EAF0F9`, guide `#5B3B96`/`#F2EBFA`,
customer `#14603E`/`#EAF4EE`, note `#8A5A00`/`#FDF3E2`.

Boat readiness status band colors (`PJ_ST`, `allotment_v2.html:82216` — these color the left edge / status
chip of each card and drive sort order):

| Key | Label | Group | Color |
|---|---|---|---|
| `clash` | ขัดกัน · ช่างแจ้งไม่พร้อม | go | `#A0342A` |
| `run` | ออกทริปวันนี้ | go | `#0F6E56` |
| `away` | ไปวิ่งท่าอื่นวันนี้ | go | `#1B4A87` |
| `idle` | ว่าง · เรือพร้อม | ready | `#4A5D7A` |
| `broke` | เสีย · ซ่อมแก้ไข | work | `#A0342A` |
| `maint` | ซ่อมบำรุงตามแผน | work | `#8A5A00` |
| `dd` | ขึ้นคาน | work | `#5B3B96` |
| `donor` / `off` | ให้เครื่องลำอื่น / ไม่พร้อมใช้งาน | down | `#5A6270` |

Document-expiry chips on the card top (`.pj-dl.d1`…`.d4`, `allotment_v2.html:82469`): expired `#8E1E14` solid,
then a 4-step amber→green gradient as expiry gets further away (`d1` red-ish `#9B2B20` → `d4` green `#1D6A4C`),
plus a blue "renew" state `#17538F`.

---

## 5. Travel Summary — `#view-travelsum` → `tsCSS()` (`allotment_v2.html:51731`)

A **fourth** unrelated design system: a lime-green + zinc "manifest" theme, built entirely on CSS custom
properties scoped to `#travelsum-host`:

```css
#travelsum-host{
  --lm50:#f7fee7;--lm100:#ecfccb;--lm200:#d9f99d;--lm400:#a3e635;--lm600:#65a30d;--lm800:#3f6212;--lm950:#1a2e05;
  --em50:#ecfdf5;--em200:#a7f3d0;--em600:#059669;--em800:#065f46;
  --zn50:#fafaf9;--zn100:#f5f5f4;--zn200:#e7e5e4;--zn400:#a8a29e;--zn500:#78716c;--zn700:#44403c;--zn900:#1c1917;
  --rs50:#fff1f2;--rs200:#fecdd3;--rs700:#be123c;--rs900:#881337;
  --am50:#fffbeb;--am200:#fde68a;--am700:#b45309;--am900:#78350f;
  --bl50:#eff6ff;--bl200:#bfdbfe;--bl700:#1d4ed8;--pu50:#faf5ff;--pu200:#e9d5ff;--pu700:#7e22ce;
}
```
Primary action/active color throughout is lime (`.ts-btn.pri`, `.ts-k.act`, `.ts-db.on` all use `--lm400`
background / `--lm950` ink), with a top hairline gradient `linear-gradient(90deg,var(--lm400),var(--em600),
var(--lm200))` on `.ts-hd::before`. KPI cards recolor per metric: `.ts-k.lime` (on-track), `.ts-k.rose`
(problem), `.ts-k.amber` (pending). Payment-method cards: cash = emerald, transfer = blue, card = purple,
pending = amber, **cash-out (money owed back) = rose** (`§tsCashNet` comment: "red because it's a subtraction,
not revenue"). A `§tsFactSheet` overlay near the end of the function (`allotment_v2.html:51919`) restyles the
same classes into a flatter "printed document" look (`border-radius:4px`, thinner header) for the print/PDF
variant — same palette, less screen chrome.

---

## 6. Daily Report — `#view-dailyreport` → `drCSS()` (`allotment_v2.html:53098`)

A **fifth** design system — matches `CLAUDE.md`'s "Daily PFM (Finexy skin)" note. Indigo/purple/orange
dashboard aesthetic, large rounded white cards on a light-grey ground:

```css
#dailyreport-host{
  --dg:#f3f4f6;--di:#111827;--d2:#1f2937;--dm:#6b7280;--df:#9ca3af;
  --dind:#4f46e5;--dblu:#2563eb;--dem:#10b981;--dem7:#047857;--dor:#f97316;--dpu:#8b5cf6;
  --dam:#f59e0b;--dam7:#b45309;--dte:#14b8a6;--dro:#e11d48;--dro7:#be123c;--dsl:#64748b;
}
.dr-logo{background:linear-gradient(45deg,#4f46e5,#8b5cf6)}          /* indigo→purple brand mark */
.dr-ins{background:linear-gradient(135deg,#f97316 0,#f59e0b 50%,#ea580c 100%)}   /* orange insight card */
.dr-ins.g2{background:linear-gradient(135deg,#4f46e5 0,#8b5cf6 50%,#6366f1 100%)} /* indigo variant */
```
KPI icon tints: blue `#eff6ff`/`#2563eb`, emerald `#ecfdf5`/`#047857`, purple `#f5f3ff`/`#8b5cf6`, orange
`#fff7ed`/`#f97316`, rose `#fff1f2`/`#be123c`, teal `#f0fdfa`/`#0d9488`. The email-compose modal
(`#dr-mail-host`) reuses `#111827`/`#4f46e5` and is the source of the "no flex/grid/`<style>`" email build
covered in §6 below — it renders its own live preview in an `<iframe>` while the underlying HTML is built with
inline-styled `<table>`s (`DRM` tokens, `allotment_v2.html:53856`).

---

## 7. Dev Log — `#view-devlog` → `renderDevLog()` (`allotment_v2.html:44459`)

Small admin-only utility list, styled entirely inline. This is the one page in this whole slice that actually
uses the **app's real Ocean blue** as its primary action color:
```
onclick="devlogAdd()" style="...background:#1683C7;color:#fff..."
```
Filter chips: To-do `#1683C7` (on-brand), Bug `#A32D2D` (red), Idea `#8A6A0B` (gold), Done `#0F6E56` (green) —
`allotment_v2.html:44467`.

---

## 8. Print / PDF / Email output system

Every print document here is a `window.open('','_blank')` popup fed via `document.write`/`document.open`+
`document.write`, not the browser print dialog on the live page. Each one **redeclares its own font stack**
and its own `@page` rule — there is no shared print stylesheet. Several print documents intentionally switch
away from DM Sans (Arial/Helvetica for the insurance list; Sarabun for hand-written-at-the-pier forms) and
several force `-webkit-print-color-adjust:exact` because color is load-bearing information on that document
(not decoration) — each does so with an explicit code comment explaining why.

### 8.1 Document inventory

| Document (Thai name) | Builder fn : line | `@page` | Body font | Primary accent(s) |
|---|---|---|---|---|
| Insurance passenger list | `insPrint` : `43922` | A4, 14mm | **Arial/Helvetica** | rule `#185FA5` |
| Re-confirm sheet (per-agent) | `renderReconfirm`'s print block : `44656` | A4 landscape, 9mm | DM Sans/Arial | agent color (dynamic) + green section bar `#0F6E56` |
| Guide Job Sheet ("ใบงานไกด์") | `pckGuideJobCss`/`pckGuideJobSheet` : `49805` | A4 landscape, **margin 0** | DM Sans/DM Mono | **none — pure black-on-white grid** (`#111827` rules), density auto-fit d1–d4 |
| Guide Assignment Order ("ใบสั่งงานมัคคุเทศก์") | `goCss`/`goPrint` : `50595` | A4 portrait, 10mm | **Sarabun** | none — dotted-line official form, black text only |
| Lunch order slip ("ใบสั่งอาหาร") | `mvOrderSlip` : `51120` | A4 portrait, 9mm | DM Sans + Noto Sans Thai | legacy spreadsheet colors: header `#C9D9F0`/`#8DB4E2`, restaurant flag `#FFF200`/`#C00000`, special-request `#00E64D` |
| Travel Summary manifest | `tsPrintSheet` : `52192` (2 `@page`s: `ts` landscape / `doc` portrait) | 9mm | DM Sans | lime `--lm400` (carries the screen palette, §5) |
| Document verification pack | `_docPackCSS`/`docCheckPrintPack` : `75461`/`75548` | A4 portrait, 9mm, fixed **192mm×279mm** pages | DM Sans | green `#0F6E56` trip bar, red `#A32D2D` warnings |
| Daily PFM slip-review print | build in `pfmPrint`-style fn : `75919` | A4 landscape, 8mm, **281mm×194mm** pages | DM Sans/DM Mono | green `#0F6E56`, red `#A32D2D` |
| Van Job Order | `vanJobsOrderCss`/`bkV2VanJobOrder` : `46768` / `55133` | A4 landscape, 10mm (unscoped variant only) | DM Sans/Arial | blue `#185FA5`, red call-out box `#9B1B12`/`#FBECEA` |
| Attendance schedule | `paPrint` : `81811` | A4 landscape, 8mm | **Sarabun** | navy rule `#16265C` |
| Boat Job Sheet ("ใบงานเรือ") | inline `css` in the pj print fn : `83151` | A4 landscape, 8mm | Noto Sans Thai/DM Sans | Slate `#0F172A` + indigo `#4F46E5` button + per-boat program-color bands |
| Sign Sheet ("ใบเซ็น") | inline `css` in the pj sign-sheet fn : `83526` | A4 landscape, **7mm** | DM Sans + Noto Sans Thai | legacy Excel colors: outbound pink `#E7A9A9`/`#F6DDDD`, return yellow `#FFD98A`/`#FDF0D2`, total badge green `#00B050`, route name red `#C00000`, top rule blue `#1E5FA8` — code comment: "3 colors matching the original file exactly" |

Common mechanics across nearly all of them:
- Popup blocked → `alert('...อนุญาต pop-up...')` guard before every `window.open`.
- `-webkit-print-color-adjust:exact;print-color-adjust:exact` forced wherever color encodes meaning (guide
  sheet, boat job sheet, sign sheet, lunch slip all have a comment explaining this explicitly).
- Several inject a `setTimeout(...print()...)` or wait on `document.fonts.ready`/image `onload` before calling
  `window.print()` so the popup doesn't print blank while fonts/images are still loading (see the `fit()` IIFE
  at `allotment_v2.html:50880` for the Guide Job Sheet's auto-density-fit-then-print flow, and `_docPackDrive`
  at `allotment_v2.html:75509` which additionally renders attached PDFs to `<canvas>` via pdf.js before
  printing).
- The Guide Job Sheet, Lunch Slip, Boat Job Sheet and Sign Sheet all also offer a "save as PNG" button
  (`shot()`/`pjShotScript`) for sending the sheet over LINE instead of printing it.

---

## 9. Email HTML constraints

Only one true email-HTML builder exists in this slice: the Daily Report's "send mail" feature
(`allotment_v2.html:53853`). The governing code comment states the rule directly:

```js
// ── ชิ้นส่วน HTML สำหรับอีเมล · inline style ล้วน ────────────────────────
//   ห้ามใช้ flex/grid/<style> · Gmail กับ Outlook ตัดทิ้งหมด
var DRM={ ink:'#111827', mut:'#6b7280', fain:'#9ca3af', line:'#e9ebef', soft:'#f7f8fa' };
```
("Email HTML pieces — inline style only. No flex/grid/`<style>` — Gmail and Outlook strip them all.")

Practical rules followed everywhere in `drm*` helpers (`allotment_v2.html:53853`–`53990` region):
- Layout is `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">`, nested per row/column
  — no `<div>` flex/grid anywhere.
- Every color/spacing value is an **inline `style=""` attribute**; there is no `<style>` block at all in the
  emitted document.
- A fixed, small ink/gray token set (`DRM`) is reused rather than the page's CSS-variable system, since custom
  properties are unreliable in email clients too.
- KPI "cards" (`drmKpis`) are actually `<table>`-in-`<td>` grids with percentage `width` on each `<td>` to fake
  a responsive row.

---

## 10. Non-brand accent summary

Ocean blue `#1683C7` (the app's documented brand accent) appears in exactly **one** place in this entire
slice — Dev Log's "+ Add" button (§7). Everywhere else, each page/print-document brought its own accent:

| Color | Hex | Where |
|---|---|---|
| Info blue | `#185FA5` | Boat default color, Van Job Order print, Insurance print rule, PK zone |
| Teal-green | `#0F6E56` | Dominant "success/confirmed/on-board" green across nearly every page |
| Deep green (drawer) | `#1C4A30` | Pier Check-in passenger drawer primary button only |
| Navy (`pj-host` family) | `#16265C` / `#0F172A` | Pier Office, Attendance, Licenses, Boat Job Board — all 4 |
| Indigo/purple | `#4F46E5` / `#8B5CF6` | Daily Report ("Finexy" skin), Boat Job Sheet print's image button |
| Lime/zinc | `--lm400` `#a3e635` etc. | Travel Summary screen + its print/PDF variant |
| Conflict purple | `#7A1FA2` | "รถปนกัน" (mixed-van) warnings only, app-wide |
| Fee/COT purpose purple | `#5B289A` | On-site payment modal fee lines only |
| Legacy-Excel set | `#E7A9A9` / `#FFD98A` / `#00B050` / `#C00000` | Sign Sheet print — deliberately matches an old spreadsheet |
| Kitchen-form set | `#FFF200`/`#C00000`, `#00E64D` | Lunch order slip print |
| Olive (KL zone) | `#3B6D11` | Zone color for Khao Lak pickups |
| Amber "editing" | `#8A5A00` | Attendance edit-mode toggle, license "renew" chips |

Net effect: **there is no single accent color for "pier operations"** — color is used consistently as a
*semantic* signal (green=done/good, red=problem, amber=pending, purple=conflict/fee) but the *brand* color per
page/document is essentially arbitrary and inherited from whenever that page was last built.
