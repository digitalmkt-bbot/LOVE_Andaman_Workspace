# Booking v2, Calendar & Dashboards — Visual Design Reference

Scope: `#view-booking` (`bkV2Render`, tabs cal / bytrip / all / locks / approvals / cancel), `#view-dashboard` (`renderDash`), `#view-calendar` (`renderCal`), `#view-daily`, `#view-b2c` (`renderB2C`), `#view-bookingflow` (`renderBookingFlow`), `#view-reconfirm` (`renderReconfirm`), `#view-doccheck` (`renderDocCheck`).

All line refs are into `allotment_v2/allotment_v2.html`.

---

## 0. Shared tokens relevant to this slice

Base app tokens (`:root`, `allotment_v2.html:1200-1215`): `--coral:#e05a38`, `--sand:#f5f2ed`, `--border:rgba(26,35,50,.09)`, `--r:10px`/`--r-sm:6px`/`--r-lg:14px`, `--topbar:52px`, `--shadow:0 1px 3px rgba(26,35,50,.07),0 4px 12px rgba(26,35,50,.04)`.

`#view-booking` gets its own **scoped navy palette**, defined twice (cascade order matters — the second wins):

1. Base "letterhead navy" (`allotment_v2.html:2322-2331`): `--bk-navy-deep:#0F1A33`, `--bk-navy:#1B2A55`, `--bk-navy-mid:#5C75A8`, `--bk-navy-light:#DCE3F0`, `--bk-navy-50:#F0F3FA`.
2. **Live override — "BuildAxis" re-skin** (`allotment_v2.html:3337-3356`, `<style id="bkv2-buildaxis-skin">`), applied after and wins: font family → `Inter`, background `#F6F7F9`, `--bk-navy-deep:#2952C8`, **`--bk-navy:#3A6FF7`** (bright blue — this is the color you actually see as the Booking accent), `--bk-navy-mid:#7DA0E8`, `--bk-navy-light:#D6E2FB`, `--bk-navy-50:#EEF3FF`, `--ink:#1F2A44`, `--border:#E5E7EB`, `--r:16px`/`--r-sm:11px`/`--r-lg:18px`, and remaps `--coral`→`#3A6FF7` so any coral-accented component (tab underline, primary buttons) reads blue inside Booking. Card radius is bumped to 16px on `.t2-tripcard/.t2-listcard/.t2-famcard` and soft shadows are added to stat/route cards (`allotment_v2.html:3358-3366`).

Delete `#bkv2-buildaxis-skin` to revert Booking to the plain navy variant; it's a self-contained, reversible block per CLAUDE.md §5.

---

## 1. `#view-booking` — page shell

### 1.1 Topbar (`bkV2RenderTopbar`, `allotment_v2.html:70768-70792`)
Floating "liquid glass" pill row, class `.bkv2-topbar2` (`allotment_v2.html:3382`): `display:flex;gap:10px;padding:4px 2px;background:transparent`.

Islands inside it all share the glass treatment (`allotment_v2.html:3384`):
```css
#view-booking .bkv2-utabs,#view-booking .bkv2-meta2,#view-booking .bkv2-vseg,#view-booking .bkv2-datechip{
  backdrop-filter:blur(16px) saturate(1.4); -webkit-backdrop-filter:blur(16px) saturate(1.4);
  box-shadow:0 6px 18px rgba(31,42,68,.13); border:1px solid rgba(255,255,255,.75);
}
```
- **`.bkv2-utabs`** (main tab group) — pill container `background:rgba(255,255,255,.72);border-radius:999px;padding:4px` (`3385`).
- **`.bkv2-utab`** — idle `color:#64748B;padding:6px 15px;border-radius:999px;background:none`; hover `color:#3A6FF7;background:rgba(58,111,247,.12)`; **active `.on`** → `color:#fff;font-weight:600;background:#3A6FF7;box-shadow:0 2px 6px rgba(58,111,247,.32)` (`3386-3389`).
- Tabs rendered (order): **Calendar** · **By trip · date** · **All bookings** · **Seat Locks** · **รออนุมัติ** (approvals, red badge count when >0) · **Cancellations** (`allotment_v2.html:70773-70778`).
- **`.bkv2-vseg`** (Calendar-view segmented switch, only on `cal` tab) — `background:rgba(255,255,255,.72);border-radius:999px;padding:3px`; buttons `30×26px`, active `.on` → white bg + `color:#3A6FF7` + `box-shadow:0 1px 2px rgba(15,23,42,.08)` (`3391-3393`).
- **`.bkv2-datechip`** month nav — pill `background:rgba(255,255,255,.72);border-radius:999px;padding:4px 6px`; `.bkv2-dclbl` label `13px/700/#1F2A44`, tabular-nums (`3394-3397`).
- **`.bkv2-todaylink`** — text button `12px/700/#3A6FF7` (`3398`).
- **`.bkv2-newbtn2`** ("+ New booking") — `background:#1F2A44;color:#fff;border-radius:999px;padding:8px 15px`, hover `#2952C8`; kbd hint chip `.bkv2-kbd2` `background:rgba(255,255,255,.2)` (`3401-3403`). On the **Locks** tab this button is re-themed red: `.bkv2-locks .bkv2-newbtn2{background:#C0392B}` hover `#9A2D1E` (`3410-3411`).

### 1.2 "By trip · date" sub-header (`t2-hd`, the sticky trip toolbar — `allotment_v2.html:73028`)
This is a *different*, denser header used only inside the By-trip tab (`t2-*` class family, defined in the `bkv2-t2-style` block, `allotment_v2.html:73023-73327`):
- `.t2-hd` — sticky, `top:var(--topbar,52px)`, `z-index:45`, `box-shadow:0 2px 6px -3px rgba(15,23,42,.18)` (never hardcode the offset — always `var(--topbar)`).
- `.t2-hd-date` — big date label `24px/800/var(--ink)`, `letter-spacing:-.4px`.
- `.t2-hd-total` / `.t2-hd-tnum` — right-aligned total pax, `32px/800`, tabular-nums.
- `.t2-hd-lockbar` — coral-red banner when seat locks active on the visible day: `background:#FBEAE6;border:1px solid #EAC6BF;border-radius:9px`; badge `.t2-hd-lockbadge` `background:#C0392B;color:#fff`.
- `.t2-hd-warn` — red advisory banner (over-capacity etc.), same red-on-cream palette (`#FCEBEB` bg / `#C0392B` icon / `#A32D2D` text).
- `.t2-pc` program/route mini-cards row (`.t2-hd-progs`) — white card, `border-left:3px solid var(--c)` (per-family color), selected state `.on` → `box-shadow:0 0 0 2px var(--c) inset`.
- `.t2-filterbar` — segmented control `.t2-seg` (`background:var(--bg);border-radius:8px;padding:2px`, active button `.on{background:var(--coral);color:#fff}` — remember `--coral` is remapped to `#3A6FF7` inside Booking).

### 1.3 New-Booking / Edit-Booking full-page flow (not a modal — `.bkv2-nb` shell)
Entered via `bkV2NewBooking()` (`allotment_v2.html:73449`), rendered full-width in place of the list.
- `.bkv2-nb` shell — `background:#F4F5F3;max-width:1320px;padding:14px` (`2573`).
- `.bkv2-nb-topbar` — white card, `border-radius:14px;margin-right:354px` (leaves room for a fixed side panel), `box-shadow:0 1px 2px rgba(26,35,50,.03)` (`2574`).
- `.bkv2-nb-back` — outline pill button; `.bkv2-nb-h1` — `15px/700`; **`.bkv2-nb-draft`** status chip — amber `background:#faeeda;color:#633806` with a small dot, turns blue (`#dbeafe`/`#1e40af`) while *Editing* (`2578-2579`, `69351`).
- `.bkv2-nb-sec` — white section card, `padding:18px 20px;border-radius:14px;margin-bottom:12px`; `.bkv2-nb-sec-h` — `10px/700` uppercase label with a small navy dot bullet (`::before`).
- Field grid `.bkv2-nb-row` (2-col grid, 16px gap) → `.bkv2-nb-field` → `.bkv2-nb-label` (`10px/600` uppercase) + `.bkv2-nb-input` (`border:1px solid var(--border);border-radius:var(--r-sm);padding:8px 11px`, focus ring `box-shadow:0 0 0 2px rgba(27,42,85,.08)`, disabled/read variant `.read{background:#f8f7f3}`).
- Agent typeahead dropdown `.bkv2-nb-dd` — floating panel `border-radius:10px;box-shadow:0 8px 24px rgba(26,35,50,.12);z-index:200`; item hover/active → `background:var(--bk-navy-50)`; market tag `.bkv2-nb-dd-mkt` — small navy pill.
- Rate-type / B2C info callout `.bkv2-nb-rt-preview` — `background:var(--bk-navy-50);border:1px solid var(--bk-navy-light);border-radius:var(--r-sm)`; B2C-direct variant recolors it blue (`#EEF5FF`/`#C3D8F2`/`#185FA5`, `allotment_v2.html:69332`), "no Rate Type" variant recolors it amber (`#FFF6E5`/`#EAD9B0`/`#633806`, `69334`).
- Action buttons `.bkv2-nb-btn` — outline default; `.ghost` transparent; **`.pri`** primary → filled `background:var(--bk-navy)` (i.e. `#3A6FF7` live), disabled → `opacity:.4` (`2658-2663`). The FOC-review variant of the submit button is inline-recolored to amber `background:#BA7517` (`allotment_v2.html:70762`). A hard "No rate" blocking state renders instead as a disabled red-outline button (`#FDECEA`/`#A32D2D`, `70757`).

### 1.4 Booking Detail page (`bkV2RenderBookingDetail`, `allotment_v2.html:78065`)
Reuses `.bkv2-nb` shell (class `bkv2-nb bkv2-vc`) with `background:var(--sand-mid)`. Two-column layout `grid-template-columns:1fr 320px`. Header row shows the status chip (`.bkv2-chip`, §4) + FOC flag + action buttons (`Edit` / `Reschedule` / `Reduce pax` / `Cancel` / `Restore`, each an outline `.bkv2-nb-btn` tinted by intent color — blue for reschedule `#185FA5`, amber for reduce-pax `#A05A1A`, red for cancel `#c43a2e`, green for restore `#0F6E56`). A voucher/ticket hero (`bkV2VoucherTicket`) sits above the two-column body.

Older/simpler `.bkv2-detail` card variant (list-embedded detail, `allotment_v2.html:2484-2505`) — `border:2px solid var(--bk-navy);border-radius:var(--r-sm)`, rows are `96px 1fr` grid with top border dividers, footer stats row in `DM Mono`.

---

## 2. Cards / panels (Booking body)

| Class | Recipe | Line |
|---|---|---|
| `.bkv2-stat` | `background:var(--white);border:1px solid var(--border);border-radius:var(--r-sm);padding:14px 18px;min-height:84px` | 2355 |
| `.bkv2-stat.hero` | filled navy `background:var(--bk-navy);color:#fff` | 2356 |
| `.bkv2-stat.warn` | `#FFF6E5` / border `#EAD9B0` | 2357 |
| `.bkv2-stat.success` | `#E1F5EE` / border `#9FE1CB` | 2358 |
| `.bkv2-stat .s-val` | `26px/700`, `letter-spacing:-.02em` | 2363 |
| `.bkv2-rd-card` (route-day mini card, calendar side drawer) | white, `border-left:3px solid var(--bk-navy)` | (grep block above §2400) |
| `.t2-tripcard` (by-trip trip card) | `border:1px solid var(--border);border-left:5px solid var(--fam)` (family color), `border-radius:14px` (16px under BuildAxis skin) | 73084 |
| `.t2-listcard` | same but no left accent, `overflow:visible` | 73085 |
| `.t2-famcard` (family/program group) | `border-left:5px solid #8b909c;border-radius:14px` | 73170 |
| `.t2-vcard` (van card inside family) | white, `border-radius:10px`, header `border-top:3px solid #185FA5` | 73179-73182 |

Trip-level state overlays (all on `.t2-tripcard`/`.t2-listcard`):
- **Closed day**: `background:#FDFAF3;border-color:#E7D6B4`, name text `#8A5B00` (`73111-73112`).
- **Weather-cancelled**: `background:#FDEEEC;border-color:#E89A92` (`73211`).

---

## 3. Tables & grids

### 3.1 "By trip · date" manifest table (`table.t2-mtbl`, `allotment_v2.html:73278-73326`)
- `border-collapse:collapse;min-width:1180px;font-size:12px`.
- Header: sticky (`position:sticky;top:0;z-index:35;background:#fff`), `9px/700` uppercase `var(--ink-faint)`, bottom shadow instead of a border (`box-shadow:inset 0 -1px 0 var(--border)`).
- Cell padding `13px 8px`, `vertical-align:middle`, `white-space:nowrap` by default (long fields override with `word-wrap`).
- Row hover: `background:#fcfcfd`.
- Numeric alignment: `.t2-mono` = `font-family:'DM Mono',monospace`; helper classes `.t2-c` (center) / `.t2-r` (right) on both `td` and `th`.
- Row-state frames (border-only, so the boat-tint row background still shows through):
  - `.t2-unassigned` → amber 2px frame `#E6A85C` (not yet van-grouped).
  - `.t2-novan` / `.t2-novan-last` → red 2px frame `#E05B5B` (group has no van yet).
  - `.t2-cxl` (cancelled row) → `opacity:.5;background:#FBF7F6`, lead name struck through.
  - `.t2-cklost` (check-in "lost"/no-show) → solid red fill `#F6CFCB` with a 5px left inset shadow `#C0392B`.
- Sub-row for pax breakdown `.t2-paxrow td` — `background:#f6f7f9;padding:9px 10px 9px 40px`.
- Zone group header `.t2-zhead` — `background:#f6f7f9` band with a colored `.t2-zdot`.

### 3.2 Calendar-tab Matrix view (`table` inside `.bkv2-mx`, `allotment_v2.html:2444-2482`)
Heat-map style, `border-spacing:1px`, `font-family:'DM Mono',monospace`.
- Day header `th.dh` — `8px`, today gets a filled navy pill (`background:var(--bk-navy);color:#fff;border-radius:3px`).
- Cell intensity classes from `bkV2CellIntensity()` (`allotment_v2.html:69146-69152`, thresholds ≤10/≤24/≤50/>50 pax → `lo`/`mid`/`hi`/`peak`):
  | class | bg | text |
  |---|---|---|
  | `.empty` | `var(--sand-mid)` | `#b4b2a9` |
  | `.closed` | 45° hatch `#f0ebe0` | `#b4b2a9` |
  | `.closed-with-data` | 45° hatch `#fdecea` | `#A32D2D` |
  | `.lo` | `var(--white)` + `1px solid var(--border)` | `var(--ink)` |
  | `.mid` | `var(--bk-navy-50)` | `var(--bk-navy-deep)` |
  | `.hi` | `var(--bk-navy-light)` | `var(--bk-navy-deep)` |
  | `.peak` | `var(--bk-navy)` (filled) | `#fff` |
  | `.foc` | `#faeeda` | `#633806` |
- `.sel` → `outline:2px solid var(--bk-navy)`. `.focdot::after` → 4px amber dot, top-right.
- Family (program) parent rows: `border-left:3px solid #c0392b`, expanded state highlights the row-header cell `background:var(--bk-navy-50)`.

### 3.3 Re-confirm sheet table (`renderReconfirm`, `allotment_v2.html:44688-44780`)
Inline-styled (no class-based table skin besides `.rc-card`/`.rc-scroll`): header cells `background:#FAF9F6;color:#5F5E5A;font-size:10.5px uppercase`, body cells `font-size:11.5px;color:#2C2C2A`, numeric columns (`AD/CHD/INF/FOC`) centered with muted color when zero (`#C9C7C0`).

### 3.4 Doc-Check table (`renderDocCheck`, `allotment_v2.html:75924+`)
White card, `border-radius:12px`, header `background:#F4F7F5`, route-group divider rows `background:#EEF3F8` with a `2px solid #d3deea` top rule. Verified rows get a green tint (`rowBg:'#E7F6EC'`), selected/open row `#EAF3FB`.

---

## 4. Status colors

### 4.1 Booking status chip (`.bkv2-chip`, `allotment_v2.html:2544-2557`)
```css
#view-booking .bkv2-chip{padding:3px 9px;border-radius:var(--r-sm);font-size:10px}
```
| Status | bg | text | dot |
|---|---|---|---|
| `confirmed` | `#e1f5ee` | `#0f6e56` | `#1d9e75` |
| `pending_foc` | `#faeeda` | `#633806` | `#ba7517` |
| `quote` | `var(--sand-mid)` | `var(--ink-soft)` | `var(--ink-soft)` |
| `rejected` | `#fcebeb` | `#791f1f` | `#a32d2d` |
| `cancelled` | `var(--sand-mid)` | `#888780` | `#9c9c95` |
| `completed` | `var(--bk-navy-50)` | `var(--bk-navy)` | `var(--bk-navy)` |

Note: **`cancelled_weather` and `pending_approval` are not in this chip map** — `bkV2StatusLabel()` (`allotment_v2.html:69235-69244`) only knows `quote/pending_foc/confirmed/completed/rejected/cancelled` and falls back to printing the raw status string for anything else. In practice those two statuses are surfaced via separate inline badges instead of the chip:
- **`pending_approval`** — small inline badge next to the lead name in the By-trip table: `background:#FCEBEB;color:#A32D2D;font-size:8px;font-weight:700` text "รออนุมัติ" (`allotment_v2.html:72637`), and drives the whole **Approvals tab** red theme (see §7).
- **`cancelled_weather`** — rendered as a Thai label "ยกเลิกเพราะอากาศ" wherever status text is shown (`52384`), and in the By-trip weather-closed variant the family/route chip goes red with a strike-through pax count (`.bkv2-cal-chip` inline override, `71107`: `border-left-color:#A32D2D`, text `#A32D2D`).
- Generic cancelled-row badge `.t2-cxlbadge` — `background:#FCEBEB;color:#A32D2D;border:1px solid #E6C9C3` text "CXL" (`73230`).

### 4.2 Foc / addon flags
- `.bkv2-foc-flag` — `background:#faeeda;color:#633806` (`2558`), a "pill" variant inside voucher card rounds to `999px` with `#fef3c7` bg (`3874`).
- `.t2-aochip-join` (join add-on) `background:#E6F1FB;color:#1565A8`; `.t2-aochip-chtr` (charter add-on) `#EFEAFB`/`#5B289A`; `.t2-aochip-tr` (transfer add-on) `#E1F5EE`/`#0F6E56` (`73122-73124`).

### 4.3 Seat-lock badges
- `.t2-lockbadge` (count badge) — `background:#C0392B;color:#fff` (`73162`).
- `.t2-lockchip` — white chip, red-brown text `#9a3b21`, border `#EAC6BF` (`73163`).
- Locks-tab summary cards use a red gradient for "active locks" (`linear-gradient(180deg,#FCF3F1,#fff)`, value color `#C0392B`), green for "sold" (`#0F6E56`), amber for "soon to release" (`linear-gradient(180deg,#FDF4E7,#fff)`, `#A05A1A`) — `allotment_v2.html:42264-42277`.

### 4.4 Re-confirm status colors (`RC_STATES`, `allotment_v2.html:44504-44511`)
| value | label | color | bg |
|---|---|---|---|
| `''` | Not started | `#8A8880` | `#F1EFE8` |
| `wa` | WhatsApp sent · awaiting | `#1D9E5A` | `#E1F5EE` |
| `noans` | Called · no answer | `#8A5A1C` | `#FAEEDA` |
| `off` | Called · phone off | `#A32D2D` | `#FCEBEB` |
| `callback` | Call back later | `#534AB7` | `#EEEDFE` |
| `done` | Confirmed | `#0F6E56` | `#C7EBAF` |

User-customizable per-status color is stored via `rcSaveStatusColor` and read through `rcStateColor(v)` (falls back to the table above, `allotment_v2.html:44531`). The status pill in both Reconfirm and By-trip-date (`t2-lead` background) always calls `rcStateColor`, so a custom color changes both places consistently.

### 4.5 Doc-Check status badges (`_docBadge`, `allotment_v2.html:75365`)
| status | bg | text |
|---|---|---|
| `verified` | `#E6F5EA` | `#1B7F4B` (label "✅ ตรวจแล้ว") |
| `issue` | `#FCEBEB` | `#B5271F` ("⚠ มีปัญหา") |
| `pending` | `#FFF6E0` | `#8A5B00` ("⏳ รอตรวจ") |
| `nofiles` (default) | `#F0F0EC` | `#8a8a82` ("📄 ยังไม่แนบ") |

Same 4-state palette is reused inline for the By-trip row doc icon (`allotment_v2.html:72637`, `_m` lookup: verified/issue/pending).

### 4.6 Cancellation-report fault colors (`bkV2RenderCancelReport`, `allotment_v2.html:70979+`)
Fault-side bar: **Customer** `#A32D2D` (red) / **Operator** `#185FA5` (blue) / **Other** `#8a8a82` (grey) — `grpColor()` at `71029`. KPI card accents: Cancellations `#A32D2D`, No-show `#A05A1A`, Fees collected `#0F6E56`.

### 4.7 Approvals-tab accent
Card left-border/accent is red `#A32D2D` when the reason is capacity overflow, amber `#A05A1A` for a discount-pending approval (`allotment_v2.html:70859`). Approve button green `#0F6E56`; Reject button red-outline `#A32D2D` on `#fff`.

---

## 5. Buttons, chips, filters, date pickers

- **Segmented control** `.t2-seg` — `background:var(--bg);border-radius:8px;padding:2px`; active `.on{background:var(--coral);color:#fff}` (`73056-73058`) — remember `--coral` resolves to `#3A6FF7` in Booking.
- **Route/program filter pill** `.t2-hd-progs .t2-pc` — white card with 3px left color bar per family; selected state uses an inset box-shadow ring in the family color, not a fill (`73048-73050`).
- **Calendar-tab program filter pills** `.bkv2-cal-fpill` (`allotment_v2.html:71129`) — colored dot + label, `--fc` custom prop carries the family color.
- **Clear-filter button** `.t2-clearf` — outline, hover turns coral/blue (`73060-73061`).
- **Boat-assign button** (`.t2-assign`) — dashed outline default, hover solid coral/blue border (`73105/73113`); **`.t2-assign-off`** (assignment blocked) — red pill `#FCEBEB`/`#A32D2D` (`73106`).
- **Boat picker popover** (`bkV2BoatPicker`, `allotment_v2.html:45627-45673`) — floating card `288px` wide, `border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.22)`, positioned next to the trigger button (flips left/clamps on-screen). Each boat row: colored dot + name (palette cycles through 6 pairs, e.g. `['#EEEDFE','#534AB7']`, `['#E6F1FB','#185FA5']`…), current selection has a checkmark and `#F3FBF7` row tint. "Unassign" row is red text, appears only when a boat is already set.
- **Confirm dialog** (`bkV2ConfirmModal`, `allotment_v2.html:75054-75083`) — centered overlay `rgba(20,26,34,.42)`, card `border-radius:16px;max-width:400px;box-shadow:0 22px 64px rgba(0,0,0,.30)`, pop-in animation (`scale(.96)→scale(1)`, 140 ms). Accent color: **`#185FA5`** default / **`#C0392B`** when `danger:true` (a round icon badge — `?` or `⚠` — sits left of the title). Buttons: outline Cancel, filled `accent` OK.
- **Doc-check filter chips** — pill buttons, active state fills with the chip's own accent color; inactive is white/outline (`allotment_v2.html:75940`).
- **Re-confirm status button** — pill, `border-radius:16px;padding:4px 11px`, colored per `RC_STATES` (see §4.4), unset state is a dashed-outline "+ set status" button.

---

## 6. Calendar cell design

### 6.1 Booking-tab "Calendar" (`.bkv2-cal-cell`, `allotment_v2.html:2424-2441`, day cells inside `#view-booking`)
- Base: `min-height:118px;border-radius:var(--r-sm);background:var(--white);border:1px solid var(--border);padding:6px 5px 5px`.
- Hover: `border-color:var(--bk-navy-mid);box-shadow:0 2px 10px rgba(27,42,85,.15)`.
- `.empty` (padding cell before day 1): dashed border, `opacity:.35`.
- `.today`: `2px solid var(--bk-navy)` + `background:var(--bk-navy-50)`.
- `.sel`: `2px solid var(--bk-navy)` + `background:var(--bk-navy-light)` + shadow `0 3px 12px rgba(27,42,85,.22)`.
- `.weekend`: subtle cream tint `#fbfaf6`.
- `.past` (via `cal-liquid-skin`/re-skin, `3535-3544`): flattened `background:#F4F2ED`, day-number and chips fade to `opacity:.55/.52`, restoring to full opacity on hover.
- Day number `.bkv2-cal-daynum` — `12px/600`; today/sel variants bump to `700` and navy color.
- Route/program chip inside a cell `.bkv2-cal-chip` — `background:#f5f3ef` (or `#F1F5F9` under BuildAxis skin), `border-left:3px solid <family-color>`, `border-radius:3px`, name truncates, pax count in `DM Mono` bold. `.foc` variant tints `#fff6e5`. `.empty` variant (open route, 0 pax) is dashed-left, faded name.
- Weather-cancelled chip: inline override `border-left-color:#A32D2D`, name+pax both `#A32D2D`, pax struck through (`allotment_v2.html:71107`).
- Day total badge `.bkv2-cal-daytot` — `DM Mono, 800, 15px`, pill `background:rgba(58,111,247,.14)` (brighter `.2` on today/selected).
- Lock badge `.bkv2-cal-lock` — small red pill `background:#FBEAE6;color:#C0392B`.

### 6.2 Sidebar/global "Calendar" page (`#view-calendar`, `renderCal`/`CAL2CSS`, `allotment_v2.html:7347-7478`)
Different, denser design — a two-pane "day hero + grid" layout distinct from the Booking tab:
- `.cal2-box` — single white card, `border-radius:20px`, split flex row: `.calx-side` (344px date/list rail) + `.calx-pane` (month grid).
- `.calx-day` — giant day-of-month numeral, `60px/800`, `color:#1E293B`.
- `.cal2-cell` — `border-radius:12px;padding:6px;background:#fff`; `.pad`/`.out` (adjacent-month) fade to `opacity:.45/.55`; `.past` cells fade rows to `opacity:.52`; `.today` → `inset 0 0 0 2px #67C1B9` (teal); `.sel` → `inset 0 0 0 2px #F98D68` (coral).
- Route chip inside cell `.cal2-rw` — colored 1px border, `.cal2-v` seat-count pill defaults green `#22C55E`, **`.full`** → red `#EF4444`, **`.wx`** (weather) → red text pill, **`.ch`** (charter) → purple `#8B5CF6`.
- Route legend chips `.cal2-rc` — white card with a 4px vertical color bar; `.off` (filtered out) fades to `.38`; `.dead` (route inactive) flattens to grey.
- Day drawer `.cal2-dw` — slide-in panel from the right, `400px` (92vw max), `box-shadow:-14px 0 40px rgba(0,0,0,.10)`, `transform:translateX(101%)→none`, `z-index:321` (must clear the topbar's z-index 300).
- **Reversible liquid-glass re-skin** (`cal-liquid-skin`, `allotment_v2.html:3547-3550`) adds `border-radius:22px !important` and a heavier layered shadow to `.cal-card`, with a lift-on-hover (`translateY(-2px)`), material-only (doesn't touch color).

### 6.3 Matrix-view "cell" (heat map) — see §3.2 above; same visual family as the calendar but numeric-density driven rather than chip-based.

---

## 7. Modals / drawers / full-screen panels

Booking v2 deliberately avoids classic centered modals for its main flows — it uses **full-page takeovers** and **anchored popovers** instead:

| UI | Mechanism | Key styling |
|---|---|---|
| New/Edit booking | Full-page swap of `#bkv2-host` content (`.bkv2-nb` shell) | See §1.3 |
| Booking detail | Same shell, read-only + action buttons | See §1.4 |
| Boat picker | `position:fixed` anchored popover next to the trigger, `288px` wide | §5, `allotment_v2.html:45627+` |
| Generic confirm/discard dialog | Centered overlay, `bkV2ConfirmModal` | §5, `allotment_v2.html:75052-75083` |
| Day drawer (Calendar page) | Right-edge slide-in panel `.cal2-dw` | §6.2 |
| Doc-Check date picker | Absolute popover under the date button, `252px` wide, `border-radius:14px` | `allotment_v2.html:75375-75387` |
| Re-confirm status picker | `rcStatusPop` — small anchored popover, pill buttons per `RC_STATES` | `allotment_v2.html:44541` |

There is no `.bkv2-modal`/`.bk-modal` generic overlay class family reused across the app for Booking — each interaction builds its own inline-styled overlay `div` (all use `position:fixed`, high `z-index` in the 100000s range for true modals, 200-600 for popovers).

---

## 8. Per-page notes

### 8.1 `#view-dashboard` (`renderDash`, `allotment_v2.html:6271-7043`)
Visually the most distinct page in the app — a "cream + Manrope + lime/forest" editorial dashboard, **not** the DM Sans/Mono system used elsewhere:
- Palette object `dx` (`allotment_v2.html:6273-6276`): `bg:#E8E3DA`, `card:#FFFFFF`, `ink:#1A1A1A`, `lime:#A6EB7E`/`limeBright:#8FE05F`, `forest:#0A6B3F`/`forestDark:#064A2A`, `coral:#F0792B`/`coralDeep:#8A2B0A`.
- **Reversible glass re-skin** `#dash-glass-skin` (`allotment_v2.html:3552-3600`) layers 4 radial gradients behind `#dash-wrap` (mint/sky/peach/lime blobs on `#FAFCF7`) and turns every literal white card into frosted glass (`background:rgba(255,255,255,.56);backdrop-filter:blur(17px) saturate(1.08)`).
- The green "Bookings overview" hero panel (`.dgx-bookings`) is a dark forest gradient `linear-gradient(158deg,#0F7C47,#0A5F3A,#08502F)` with inset glass mini-stat cards.
- Fleet Score card (`.dgx-fleet`) is dark frosted glass `linear-gradient(160deg,rgba(48,40,33,.86),rgba(26,20,15,.9))`.
- Live-bookings feed rows use `ti ti-bolt`/`ti ti-refresh` Tabler icon classes (**exception** to the "no Tabler webfont" rule elsewhere — verify at render time) with a pulsing green "live" dot (`animation:dashlvpulse 1.4s infinite`).
- Deep-link helpers `dashGoApprovals/dashGoBytrip/dashGoAccounting/dashGoCancels/dashOpenBooking` route straight into Booking-v2 tabs (`allotment_v2.html:6265-6270`).

### 8.2 `#view-calendar` — see §6.2. Page intro uses the plain `.page-hd` pattern (`h1` 20px/600, subtitle 12px muted) then hands off to `#cal-wrap` for `renderCal()`.

### 8.3 `#view-daily` (Daily Availability)
Standard `.card`-based two-column layout (`.da-layout` / `.da-left` / `.da-right`), a `.da-date-row` with `.cal-nav` chevron buttons flanking `.da-date-lbl`. No bespoke skin — inherits the base app card/table system (`allotment_v2.html:1267-1269` `.card`).

### 8.4 `#view-b2c` (`renderB2C`, `allotment_v2.html:68526+`)
KPI row reuses the generic `.sb-kpi` family (shared with Agent List) with color variants `k-amber`/`k-green`/`k-blue` tinting the value text. Channel/campaign cards `.b2c-card` (`allotment_v2.html:3310-3322`): white card, top accent bar `::before{height:3px;background:var(--sb-pink)}`, campaigns recolor that bar to `var(--coral)`. Icon chip `.b2c-card-icon` is a rounded 36px square, pink-tinted (campaign variant: coral-tinted).

### 8.5 `#view-bookingflow` (`renderBookingFlow`, `allotment_v2.html:43589+`)
Analytics/trends page, not a booking form despite the name — inline SVG charts (no chart library): a stacked bar chart (`barsSVG`, market-colored stacked bars + a 3-point moving-average line in `#12314b`) and a dual-line booked-vs-travelled chart (`dualSVG`, orange `#F2A33C` for travel-date pax vs blue `#1683C7` for booking-date pax, with a dashed "today" marker). Period toggle (`_bfMode`: day/week/month) drives bucket generation.

### 8.6 `#view-reconfirm` (`renderReconfirm`, `allotment_v2.html:44688+`)
Own scoped skin `#rc-skin` (`allotment_v2.html:44731`): `.rc-card` white rounded card `border-radius:12px`; `.rc-tab` view-switch pill (By agent / By trip), active `.on` → `background:#1683C7` (the pre-BuildAxis "ocean blue" brand accent, distinct from Booking's `#3A6FF7`). Agent-name chip color = the agent's own brand color (`_rcAgentColorOf`); after a re-confirm is sent, a colored ring appears around the chip — gold-ish ring for invoice/paid agents, purple ring for unpaid (`_rcSentRing`, `allotment_v2.html:44700`). Per-status colors are user-customizable (`rcColorPanel`), defaults in §4.4.

### 8.7 `#view-doccheck` (`renderDocCheck`, `allotment_v2.html:75924+`)
B2B-only document-verification worklist. Route-group header rows use a blue-grey band (`#EEF3F8`, `2px solid #d3deea` top rule) distinct from the sand/cream grouping used elsewhere in Booking. Print button is dark green `background:#163d2b;color:#eafbe0` ("🖨 พิมพ์ชุดเอกสาร A4"). OCR pre-check results (Tesseract.js) are cached on `bk.docCheck.pre` per CLAUDE.md §6 — no bespoke styling beyond the 4-state badge in §4.5.

---

## 9. Things that are genuinely unique to this slice

- **Two competing Booking skins stacked via CSS var overrides** (§0) rather than a single source of truth — always check which `<style id="...">` block wins before quoting a color as "the" Booking accent.
- **`--coral` is silently repurposed to blue** inside `#view-booking` only — any component elsewhere in the app that keys off `var(--coral)` will look orange; the same component inside Booking will look blue. Don't assume coral means coral here.
- **No shared modal system** — every Booking overlay is bespoke inline HTML/CSS; there is nothing named `.bkv2-modal` to reuse.
- **`#view-dashboard` is a completely separate visual language** (Manrope/cream/lime/forest) from the DM Sans/Mono + navy/blue system used by every other page in this slice — treat it as its own design system, not a Booking variant.
- Status-color coverage gap: `bkV2StatusLabel()`/`.bkv2-chip` do not define swatches for `cancelled_weather` or `pending_approval` — those two statuses are only ever shown via ad-hoc inline badges scattered through the By-trip and Approvals renderers (§4.1), not the shared chip component.
