# Booking Calendar — how it works (API calls · functions · queries)

> Reference for rebuilding the `allotment_v2` Booking **Calendar** tab on another page.
> Verified against the source on 2026-09-18 (`lk-inbox`). Line numbers are current as of that
> commit — if they drift, grep the function name (every citation carries one).
>
> Companion doc: `BOOKING_DASHBOARD_HANDOFF_PROMPT.md` (spec for rebuilding the whole
> 6-tab dashboard in another project, verified against prod 2026-09-08).

**TL;DR — the booking calendar makes zero API calls of its own.** It is a pure client-side render
over one in-memory blob fetched once at boot. "All the related API calls" = one call, `GET /api/load`.

---

## 1. Data pipeline (the only API involved)

```
GET /api/load   ->  server.js:2810
                    |- relSyncB2CShared()            (pull new B2C bookings first)
                    |- cache check on app_state.version
                    `- buildLoadCache() -> relLoad()   server.js:180
                         |- SELECT * FROM <each of ~133 tables>   (parallel)
                         `- osRepo.assembleBlob(data)   os-backend/src/mapping/os_repo.js:267
                    ->  ~16 MB JSON blob (sb_bookings alone ~11 MB)
```

Client side (`allotment_v2/js/01-auth-sync.js:99`): sync XHR at boot, blob goes into **RAM**
(`_mem`), not localStorage — the blob blew the ~5 MB quota, so `Storage.prototype` is shimmed to
route `LS_KEY` reads/writes to memory (`01-auth-sync.js:70-84`).

Globals hydrated off that blob:

| Global | Where | Blob key |
|---|---|---|
| `SB_BOOKINGS` | `js/08-app.js:2385-2387` | `sb_bookings` |
| `SB_SEAT_LOCKS` | `js/08-app.js:2554` | `sb_seat_locks` |
| `ROUTES` / `BOATS` / `TRIPS` | `js/04-data-core.js:305-307` via `loadData()` | `routes`, `boats`, `trips` |

**Live updates:** SSE `/api/events` + a 10 s poll of `/api/version` (`01-auth-sync.js:449,479`).
On a version bump it re-fetches `/api/load`, calls `window._laReloadData()` (`08-app.js:2388`) to
re-point the globals, then `window._laRerender()` (`08-app.js:2505`) which just calls
`bookingV2Render()` again. That is the entire "live" story — there is no per-view endpoint.

**Writes** go out via `POST /api/v1/_batch` (per-entity), falling back to `POST /api/save`
(whole-blob diff) — `01-auth-sync.js:293-307`. The calendar itself never writes except the
seat-lock button.

---

## 2. Render call graph (all in `allotment_v2/js/08-app.js` unless noted)

```
nav -> view 'booking' -> bookingV2Render()                  :42009
  `- #bkv2-host.innerHTML = topbar + tab body
     |- bookingV2RenderTopbar()                             :43639   tabs · month < > · Today · cal/mx toggle
     |   `- bookingV2TopbarMeta()                           :43672   "N pax · M bookings" for the month
     `- bookingV2RenderTabBody()                            :43706
         `- tab==='cal' && view==='cal'
            -> bookingV2RenderCalendar()                    :43927   <- THE CALENDAR
                |- bookingV2Aggregate()                     :41822   <- the whole data core
                |- bookingV2Families()                      :41661   visible program families this month
                |   `- bookingV2RouteFamily()               :41643   route.familyId, name-guess fallback :41634
                |   `- bookingV2RouteActiveInMonth()        :41758
                |- bookingV2FamilyRoutes(famId)             :41669   family -> its route variants
                |- bookingV2IsFamilyOpenOn(famId, date)     :41677
                |   `- bookingV2IsRouteOpenOn(routeId,date) :41731
                |        `- getDayStatus(route,date)   04-data-core.js:7577  <- seasons/overrides
                |- bookingV2FamilyAggregate(famId,date,agg) :41681   pax per family per day
                |- bookingV2IsWeatherClosed(routeId,date)   :32017   SB_WEATHER_CLOSURES
                |- bookingV2DayLockedExact(date)            :2958    lock badge
                |- bookingV2RenderStats()                   :44060   4 KPI cards above the grid
                |- bookingV2RenderRouteAvgs()               :44123   per-route average strip
                |- bookingV2RenderSelDay()                  :44239   right-hand "Selected Day" panel
                `- bookingV2RenderFooterHints('cal')        :44716
```

Mount point: `allotment_v2/allotment_v2.html:877-879` — `#view-booking > #bkv2-host`.
View switch: `08-app.js:2520` (`if(v==='booking') bookingV2Render()`).

### Sibling views worth cribbing from

- **Matrix view** (same tab, `view:'mx'`): `bookingV2RenderMatrix()` :44451, heat colours via
  `bookingV2Mix` :41888 / `bookingV2MxHeat` :41897.
- **Date-picker popup** (different component, same `bkv2-cal-*` class prefix):
  `bookingV2CalOpen` :48884 / `bookingV2CalRender` :48935.
- **Mini month calendar** in the By-trip sidebar: inline in `bookingV2RenderTab2`, driven by
  `_bkV2T2Cursor` / `bookingV2Tab2MonthShift` :44823 / `bookingV2Tab2PickDay` :44822.

---

## 3. The aggregation core — `bookingV2Aggregate()` (`08-app.js:41822`)

This is the function you would actually reimplement. Everything else is chrome.

```js
{ byDate: {
    '2026-09-18': {
      total, ad, chd, inf, foc,        // pax
      pk, kl, nt,                      // by pickup zone
      hasFocPending, revenue,
      bookings: [bkId, ...],
      routes: { r5: { total, ad, chd, inf, foc, pk, kl, nt, hasFocPending } }
    }
} }
```

Rules baked into it — all load-bearing:

1. **Skip `cancelled` / `cancelled_weather` / `rejected`** — :41848.
2. **Pax = legacy + `_fr` + `_th`** (`addPax`, :41838): `ad` + `ad_fr` + `ad_th`, same for
   chd/inf/foc. Never add the legacy column on top as a separate bucket — double-count.
3. **v2 vs v1 split**: `schemaVer===2` iterates `bk.trips[]` (one row per dated trip); legacy rows
   use `bk.travelDate` + `bk.programId` + `{adult,child,infant}`.
4. **Zone** comes from `bookingV2InferZone(bk)` :41813 — a *string sniff* on `bk.pickup`
   ("khao lak" -> KL, "pier"/"walk-in"/"no transfer" -> NT, else PK). Not from `pickupZone`.
5. **Revenue**: single-trip booking uses `bk.total` (adjustment-inclusive), multi-trip uses
   `trip.subtotal` — :41861.
6. **Land/marine split**: `_bkV2CityTourOnly` (:41571) + `laIsLandRoute()`
   (`04-data-core.js:66`) make the same code serve two pages symmetrically. Drop it if the new
   page does not need City Tour / Transfer.

Perf note: it is O(all bookings) and is called ~5x per render (calendar + stats + topbar meta +
selday + family aggregates). 3.6k bookings so nobody noticed — **memoize it in a new build**.

---

## 4. Open / closed · capacity · locks

### Is a day open?

`getDayStatus(route, dateStr)` — `04-data-core.js:7577`:

```
route.overrides[date]             -> wins outright
route.seasons.find(from<=d<=to)   -> its .type
no match but route has >=1 'open' season -> 'closed'   (off-season)
no seasons at all -> null -> caller assumes open
```

### Capacity / availability

`getAllotment(routeId, date)` — `04-data-core.js:7830`. Not used by the month grid itself (only by
By-trip and the Selected Day panel), but any richer calendar wants it:

```
assignedBoats     = getAssignedBoatsForRouteDate()   <- from TRIPS[date][boatId], NOT bookings
availableCapacity = sum(cap) - sum(charter cap)
seatsConsumed     = getSeatsConsumed()   04-data-core.js:7730   <- excludes charter, cancelled, no-show
lockedSeats       = bookingV2LockedTotal()    08-app.js:2692
seatsAvailable    = availableCapacity - seatsConsumed - lockedSeats
```

Land routes have no boats -> falls back to `route.dailyCap` (:7841).
`boat.cap` = booking cap; `boat.licensePax` = real registered seats (hard block).

### Locks

- `bookingV2DayLockedExact(date)` :2958 — exact-date locks only, used for the calendar cell badge.
- `bookingV2DayLockedTotal(date)` :2962 — also counts month/bulk pools covering that date.
- `bookingV2LockPoolHold(l,date)` :2691 — returns 0 for child locks so parent/sub never double-count.
- `bookingV2LockedTotal(routeId,date)` :2692 — per route+date.

---

## 5. State and event handlers

`const _bkV2 = {...}` — `08-app.js:41573`. Calendar-relevant fields:

| Field | Meaning |
|---|---|
| `tab` | `'cal'` / `'bytrip'` / `'all'` / `'locks'` / `'approvals'` / `'cancel'` |
| `view` | `'cal'` / `'mx'` (only when `tab==='cal'`) |
| `cursor` | a `Date` — the visible month |
| `selected` | `{ date:'YYYY-MM-DD', routeId?, familyId? }` |
| `calFams[]` | program filter (multi-select; empty = show all) |
| `panelHid` | collapse the Selected Day panel |
| `avgMode` | `'week'` / `'day'` / `'total'` for the per-route average cards |

Every handler is the same shape — mutate `_bkV2`, call `bookingV2Render()`:

| Handler | Line |
|---|---|
| `bookingV2SwitchTab(t)` / `bookingV2SwitchView(v)` | :47735 / :47736 |
| `bookingV2NavMonth(±1)` / `bookingV2Today()` | :47737 / :47742 |
| `bookingV2SelectDay(date)` — single click a cell | :47743 |
| `bookingV2OpenFiltered(routeId, date)` — dbl-click -> By-trip tab | :47746 |
| `bookingV2CalToggleFamily(id)` / `bookingV2CalAllFamilies()` | :44028 / :44035 |
| `bookingV2TogglePanel()` | :44442 |
| `bookingV2RenderKeep()` — re-render preserving scroll | :7380 -> `bookingV2KeepScroll` :7367 |

Date keys: **`bookingV2DateKey(d)` :47730** and **`bookingV2LocalYMD(dt)` :44778** — identical, both built
from local date parts. Never `toISOString().slice(0,10)` (UTC shift puts trips on the wrong day).

---

## 6. CSS

`allotment_v2/css/01-base.css:1886-1938`, all scoped `#view-booking .bkv2-cal-*`:

- `.bkv2-cal-wdrow` / `.bkv2-cal-wd` — weekday header row
- `.bkv2-cal-grid` — `display:grid; grid-template-columns:repeat(7,1fr); gap:4px`
- `.bkv2-cal-cell` — `min-height:118px`, modifiers `.empty .today .sel .weekend .past`
- `.bkv2-cal-daynum`, `.bkv2-cal-foc`, `.bkv2-cal-daytot`, `.bkv2-cal-lock`
- `.bkv2-cal-chip` + `-name` + `-pax`, modifiers `.foc` (amber) `.empty` (dashed border-left)
- `.bkv2-cal-more` — the "+N more" overflow line
- `.bkv2-cal-filter` / `.bkv2-cal-fpill` — the Programs filter pills

**Warning:** `.bkv2-cal-grid` and `.bkv2-cal-day` are **defined twice** — again at
`01-base.css:2128-2145` for the date-picker popup. Same class prefix, different component. If you
copy the block, rename the prefix or you will inherit the popup's `padding:0 4px` / `gap:2px`.

---

## 7. If the new page is server-side instead

Schema `operation_schemas`. Column names are all lowercase with no underscores between words
(`leadpax`, `voucherref`, `bookingdate`); nested objects flatten with `_`
(`pricebreakdown_total`, `ops_boatid`).

A month of calendar cells:

```sql
SELECT t.date,
       t.routeid,
       r.name, r.color, r.familyid,
       COUNT(DISTINCT b.id)                                   AS bookings,
       SUM(COALESCE(t.pax_ad,0)+COALESCE(t.pax_ad_fr,0)+COALESCE(t.pax_ad_th,0)
         + COALESCE(t.pax_chd_fr,0)+COALESCE(t.pax_chd_th,0)
         + COALESCE(t.pax_inf_fr,0)+COALESCE(t.pax_inf_th,0)
         + COALESCE(t.pax_foc,0)+COALESCE(t.pax_foc_fr,0)+COALESCE(t.pax_foc_th,0)) AS pax
FROM operation_schemas.sb_bookings__trips t
JOIN operation_schemas.sb_bookings b ON b.id = t.sb_bookings_id
LEFT JOIN operation_schemas.routes  r ON r.id = t.routeid
WHERE t.date BETWEEN $1 AND $2
  AND b.status NOT IN ('cancelled','cancelled_weather','rejected')
GROUP BY t.date, t.routeid, r.name, r.color, r.familyid
ORDER BY t.date, r.sort;
```

The lock badge:

```sql
SELECT date, routeid, SUM(qty - COALESCE(used,0)) AS held
FROM operation_schemas.sb_seat_locks
WHERE status='active' AND parentid IS NULL
  AND scope NOT IN ('bulk','month')
  AND date BETWEEN $1 AND $2
GROUP BY date, routeid;
```

`scope IN ('bulk','month')` locks span ranges — `monthfrom`/`monthto` plus a day-of-week filter;
mirror `bookingV2LockRange` / `bookingV2LockDowOk` if you need them.

Open/closed per day: `routes__seasons` (`type`, `from`, `to`) plus route overrides, evaluated
exactly like `getDayStatus` above.

Relevant child tables (join on `sb_bookings_id`, each carries `idx` = array position and `row_pk`):
`sb_bookings__trips`, `__passengers`, `__addons`, `__adjustments`, `__feeitems`, `__upgrades`,
`__partialcancels`, `__history`, `__over`.

⚠️ `ops_*` columns exist on **both** `sb_bookings` and `sb_bookings__trips`. The booking-level one
is authoritative (3048 non-empty vs 4). Read boat/van assignment from `sb_bookings`.

---

## 8. Traps when cloning this

- **`esc` / `escapeHTML` is not global** — each render fn declares its own local `const esc=...`.
  A new top-level fn that uses `esc(...)` without declaring one throws silently on click.
- **`bookingV2Aggregate()` runs ~5x per render.** Cache it in a new build.
- **The month grid is Sunday-first**, built from `new Date(y, m, 1).getDay()`. No date library.
- **`familyId` is the source of truth**; `bookingV2RouteFamilyGuess` :41634 is legacy name-pattern
  fallback. Families are hardcoded in `_BKV2_FAMILIES` :41604 — a new family needs a deploy.
- **Pier enum is strict**: `tublamu` / `panwa` / `ranong`. Never `visitpanwa` or display strings.
- **Do not add `defer` / `async` / `type="module"`** to the script tags, and do not reorder them —
  ~2,500 inline `onclick=` handlers depend on load order. See `allotment_v2/js/README.md`.
- **Cancelled statuses** (`cancelled`, `cancelled_weather`, `rejected`) are excluded from every
  aggregate. `quote` and `pending_foc` are also real, non-confirmed statuses — treat any
  unrecognised status as non-confirmed rather than defaulting it into the confirmed bucket.

---

## 9. Two ways to build the second calendar

**A. Same app, new page (cheapest).** Write a `bookingV2XxxRenderCalendar()` that calls the exact same
helpers — `bookingV2Aggregate`, `bookingV2Families`, `bookingV2FamilyAggregate`, `bookingV2IsFamilyOpenOn`,
`bookingV2DayLockedExact` — with its own state object and its own CSS class prefix. Zero new API
surface; it reads the blob that is already in memory. Precedent exists: `_bkV2CityTourOnly`
already forks this same code into a second page (marine vs land).

**B. Separate app / project.** Use the SQL in §7 and reimplement the six rules in §3.
`BOOKING_DASHBOARD_HANDOFF_PROMPT.md` is the fuller spec for that path, including the business
rules that silently corrupt the numbers if missed.
