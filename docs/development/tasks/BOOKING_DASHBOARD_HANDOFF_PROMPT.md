# Prompt: rebuild the LOVE Andaman Booking Dashboard

> Send this to the other project. It is written to be pasted as-is.
> Everything in it was verified against the live production database on 2026-09-08.

---

## What you are building

A **read-only Booking Dashboard** for LOVE Andaman (Phuket marine day-tours), functionally
identical to the one our staff use today at `rsvn.loveandaman.com`. You will read our production
Postgres directly. You are **not** rebuilding the booking *editor* — no writes, no booking
creation, no cancellation flow. Display and aggregation only.

The existing page is one screen with **six tabs**:

| Tab | Label in UI | Shows |
|---|---|---|
| `cal` | Calendar | Month grid of trips. Has a second view toggle: calendar (`cal`) vs matrix (`mx`) |
| `bytrip` | By trip · date | **The big one — see the dedicated section below. Do not build from this row.** |
| `all` | All bookings | Flat filterable/searchable list of every booking |
| `locks` | Seat Locks | Allotment held by agents, reducing the sellable pool |
| `approvals` | รออนุมัติ | Bookings in `pending_approval`, with a red count badge when > 0 |
| `cancel` | Cancellations | Cancelled / weather-cancelled / rejected bookings |

Thai labels in the UI are intentional — staff are Thai. Keep them.

---

## Data source

Postgres, schema **`operation_schemas`**. A read-only connection string will be sent separately —
do not commit it. Current scale:

```
bookings 3,637 · trips 3,641 · passengers 3,098 · agents 790 · routes 14 · boats 20
```

Small enough to query directly; you do not need a caching layer or a warehouse.

### Core tables

`sb_bookings` is the parent. Children join on `sb_bookings_id` and carry an `idx` (array position)
and a `row_pk`:

```
sb_bookings                  -- 1 row per booking
sb_bookings__trips           -- 1+ rows: the actual dated trips  <- most dashboard queries start here
sb_bookings__passengers      -- passenger manifest
sb_bookings__addons          -- add-on services sold
sb_bookings__adjustments     -- price adjustments
sb_bookings__feeitems        -- fee line items
sb_bookings__upgrades        -- upgrades
sb_bookings__partialcancels  -- partially cancelled pax
sb_bookings__history         -- audit trail
sb_bookings__over            -- over-capacity records
```

Supporting: `sb_agents` (790 rows, join `sb_bookings.agentid`), `routes` (14), `boats` (20),
`sb_rate_types`, `sb_seat_locks`, `sb_markets`, `sb_sales`.

Column names are **all lowercase, no underscores between words** — camelCase in our app becomes
`leadpax`, `voucherref`, `bookingdate`, `pickupareaid`. Nested objects are flattened with `_`:
`pricebreakdown_total`, `paymentsnapshot_method`, `cancellation_reason`, `ops_boatid`.

Note `schemaver` on `sb_bookings` — older rows may lack newer fields. Code defensively.

---

## Business rules you MUST implement

These are not preferences. Miss one and your numbers will be quietly wrong — the dashboard will
look fine and report the wrong figures, which is worse than crashing.

### 1. Cancelled statuses are excluded from every aggregate

Exclude `cancelled`, `cancelled_weather`, `rejected` from **every** pax count, seat count, revenue
figure and occupancy calculation. They remain visible only on the Cancellations tab.

Live status distribution (verified on prod):

```
confirmed 3353 · cancelled 243 · cancelled_weather 24 · rejected 9 · quote 7 · pending_foc 1
```

⚠️ **`quote` and `pending_foc` are real and are not in our own written docs.** A `quote` is not a
confirmed sale — do not count it as revenue or as a consumed seat. Treat any status you do not
recognise as non-confirmed rather than defaulting it into the confirmed bucket. `pending_approval`
currently has 0 rows but is a valid status (it is what the approvals tab is for) — do not assume
it is dead.

### 2. `ops_*` lives on BOTH tables — the booking-level one is authoritative

`ops_boatid`, `ops_vanid`, `ops_vangroup`, `ops_vanseq`, `ops_vanreturnid`, `ops_pickuptimefinal`
and friends exist as columns on **both** `sb_bookings` and `sb_bookings__trips`. They are not
mirrors. Verified counts of non-empty values:

```
sb_bookings.ops_boatid  3048   |   sb_bookings__trips.ops_boatid   4
sb_bookings.ops_vanid   2463   |   sb_bookings__trips.ops_vanid    3
```

**Read boat/van assignment from `sb_bookings`.** The trip-level columns are vestigial; joining
through trips and reading `t.ops_boatid` will silently return almost nothing.

### 3. The pax model is split by age AND nationality

On `sb_bookings__trips`, pax are counted in separate columns — `_fr` = foreigner, `_th` = Thai
(different pricing and different government reporting):

```
pax_ad_fr  pax_chd_fr  pax_inf_fr  pax_foc_fr
pax_ad_th  pax_chd_th  pax_inf_th  pax_foc_th
```

`ad` = adult, `chd` = child, `inf` = infant, `foc` = free-of-charge. Total pax = sum of all of
them. There are also legacy `pax_ad` and `pax_foc` columns — treat them as fallback for old rows
only, never add them on top of the split columns or you will double-count.

### 4. Charter bookings are excluded from the seat pool

`sb_bookings__trips.bookingmode` is `'seat'` or `'charter'`. A charter books the whole boat, so it
must **not** consume seats in availability/occupancy maths. Charter trips carry `charterboatid`.

### 5. Seat locks reduce the sellable pool

Allotment held by agents (`sb_seat_locks`) is subtracted from available seats. Available =
capacity − seats consumed − locked seats. Locks are not bookings and must not appear as sales.

### 6. Capacity has two different numbers

On `boats`: `cap` is the **booking cap**, `licensepax` is the **real registered seat count**.
Over `cap` → the booking goes to `pending_approval`. Over `licensepax` → hard block. Boat-assign
tolerance is `cap + 2`.

### 7. Timezone is Asia/Bangkok (UTC+07:00)

`date` and `bookingdate` are stored as plain `YYYY-MM-DD` **text**, not timestamps. Build date
strings from local date parts:

```js
`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
```

**Never `toISOString().slice(0,10)`** — it shifts to UTC and puts trips on the wrong day. This has
bitten us repeatedly.

### 8. Pier is a strict enum

`tublamu` (Similan/Surin), `panwa` (Phi Phi), `ranong` (Myanmar day trips). Never `visitpanwa`,
never the display strings `"Tub Lamu"` / `"Visit Panwa"` — those break grouping. Display labels
map from the enum, not the other way round.

---

## The `bytrip` tab — "By trip · date" — in detail

**Reference screenshot: `booking-bytrip-reference.jpg` (shipped with this prompt). Match it.**

This is not a table on a page. It is a dense operations console — the screen a dispatcher keeps
open all day. It is ~2,200 lines in our codebase, more than the other five tabs combined. Budget
accordingly.

Layout, top to bottom:

### 1. Date stepper (top-left)
Big day number + weekday + month (`8` / `Tuesday` / `SEPTEMBER 2026`), with `‹` `›` arrows and a
`TODAY` button. This tab is always scoped to **exactly one date**.

### 2. A row of four summary panels, above the manifest

- **Programmes** — the route filter and the day's roll-up. Segmented chips `All · Panwa · Tub Lamu
  · Ranong`, then one row per programme running that day with its pax and a `1 running` badge, e.g.
  `Phi Phi Bamboo 56` / `Speedboat 09:00 · Visit Panwa` `92/55` `13 free`. Header shows
  `2 ROUTES`, right-aligned `38 bookings · 85 pax`.
- **Boats running** — `2 BOATS · 2 TRIPS`. Per trip: name, departure time, pier, `29/38`, `9 free`,
  the assigned boat and its load (`Oceanus 29/38`), and a `PREP` chip strip of prep counts
  (`RU · 29`, `RN · 20`, `CH · 7`, `⚠ 3 allergy`, `Longtail join · 21`).
- **Van / Boat / Re-confirm** — three small status cards, each either a green ✓ (`all assigned`) or
  an amber count (`not confirmed 1`). These are the dispatcher's "is today ready" lights.
- **Seat lock** — locks held on this day, or `No seat lock on this day`.
- **Notice** — amber panel of the day's warnings and check-in events, as coloured chips.

Plus a search box: `Search · voucher · name · phone · hotel`.

### 3. Per-trip sections
Each trip gets a header — coloured dot, trip name, departure time, pier, `1 boat`, `29/38`,
`9 free` — then a sub-header per pickup zone (`Phuket · 12 bookings · 29 pax`).

### 4. Rows are CLUSTERED BY VAN GROUP, not listed flat
This is the single most visible thing your build is likely missing. Within a trip, bookings are
grouped into van groups, each introduced by its own coloured header bar:

```
[1] Love8  🚐 Oceanus 12  ทะเบียน 30-2318  คนขับ …  📞 083-343-4538  5 ราย · 13 pax · 05:30
```

Group index, a coloured group pill, van name, plate, driver, phone, counts, pickup time. Then that
group's booking rows. Each group gets its **own colour**. Ungrouped bookings sort last. In Boat
Assign mode the clustering switches to cluster by assigned **boat** instead.

### 5. The manifest table — exact columns, in this order

```
VOUCHER | AGENCY | CUSTOMER (LEAD) | AD | CHD | INF | FOC | TIME | PICKUP | ROOM |
ZONE | SEND BACK | ADD-ON | SPECIAL REQUEST | PAY | TOTAL | (blank) | 🚤 BOAT
```

- **The first three columns are frozen** (horizontally sticky) at offsets `0`, `112px`, `254px`.
  The header row is sticky vertically. The table scrolls horizontally under them.
- `AGENCY` is a **solid colour-filled cell**, one colour per agent — not plain text. This is a
  major part of the visual identity; a dispatcher recognises an agency by colour.
- `CUSTOMER (LEAD)` is a **highlighted chip** (yellow/lime) with small status badges beneath
  (`✓ ยืนยัน`, `+1`), not plain text.
- `AD / CHD / INF / FOC` are four separate narrow numeric columns.
- `TIME` shows the pickup time with a smaller time-range sub-line beneath it.
- `SPECIAL REQUEST` holds coloured chips (`RU` red, `✓ Moved from 09-08` blue).
- `PAY` renders an `Invoice` button; `TOTAL` is right-aligned mono (`฿10,000`).
- `BOAT` is a circular avatar (initials, per-boat colour) plus the boat name.

Header style: `9.5px`, weight `800`, UPPERCASE, `letter-spacing .05em`, ink `#4A3C3C`, background
`#EDE6E6`, with an `inset 0 -2px 0 #C4B2B2` underline. Rows are ~11px and very tight — this screen
deliberately trades whitespace for information density.

Clicking the **Agency** or **Zone** header sorts by that column.

### 6. Four modes that change the table's columns
The same table re-renders with different columns depending on the active mode. This is not a
detail — half the tab's purpose lives in these:

| Mode | Effect on columns |
|---|---|
| Van Assign | **Adds** a `✓ กลุ่ม` tick column (ink `#0C6B47` on `#DCF0E7`) and **removes** `ADD-ON`, `PAY`, `TOTAL` |
| Boat Assign | `BOAT` header highlights (ink `#12518F` on `#E2EEFA`) and gains an `auto` button; rows cluster by boat; a bulk action bar appears when rows are ticked |
| Re-confirm | **Adds** a `✅ Re-confirm` column (ink `#7A4A00` on `#FAEBD2`) with an `all` button |
| Weather closed | **Adds** a `⚠ Manage` column (ink `#A32D2D` on `#FBE8E4`) |

### 7. Blocks below the manifest, in order
Seat locks held on this trip · rescheduled-away bookings as **faint ghost rows** kept on their
original date · cancelled bookings in their own block (recorded, never counted in totals) · a
per-boat load strip · a van summary strip with job-order buttons · a re-confirm roll-up strip.

### 8. Left sidebar
Mini month calendar with a dot on every date that has trips, plus `Previous` and `Upcoming` trip
lists (`none` when empty).

---

## Look and feel

- **Type:** DM Sans for body, **DM Mono for all numbers** (counts, prices, dates). The monospace
  numerals are load-bearing — columns of figures must align.
- **Accent:** Ocean blue `#1683C7`. Alert/over-capacity red `#A32D2D`.
- **Density:** staff scan this all day on desktop. Prefer compact tables over cards; the count
  badge on the approvals tab turns red only when non-zero.
- Icons are inline SVG — no icon webfont.

---

## Deliverable and constraints

- **Read-only.** Do not write, update or delete anything in `operation_schemas`. Our monolith owns
  those tables and has invariants your service cannot see.
- Use your own stack — you are not required to match ours (we are vanilla ES5-era JS in one global
  scope; do not copy that).
- State your assumptions where this spec is silent rather than guessing at business meaning.

## Questions worth asking us before you start

1. Which tabs do you actually need? The Calendar and By-trip tabs are the most complex by far; if
   you only need All-bookings + Cancellations this is a much smaller job.
2. Do you need live data or is a nightly read replica acceptable?
3. Do you need per-user permission scoping, or is your whole audience trusted to see all bookings?