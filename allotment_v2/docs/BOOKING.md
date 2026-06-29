# Booking

> Module: Sales & Booking · `nav-item data-view="booking"` → `view-booking`
> Source: `allotment_v2.html` · Last updated: 2026-05-29

---

## 1. Purpose

Single hub for all guest bookings (B2B agent + B2C direct + walk-in).

For each booking we manage:
- Lead pax + contact
- Multi-trip itinerary (a booking can include several routes across several dates)
- Pax composition split by **AD · CHD · INF · FOC** × Thai/Foreign
- Pickup zone (PK · KL · NT)
- Add-ons + forced bundles
- Payment terms (auto-inherited from agent's Contract)
- FOC approval workflow
- Status timeline

Phase 1 (the list page) is built. Phases 2-3 (New Booking wizard + Detail/FOC approval) are pending.

---

## 2. Data location

| Constant | Line | Contains |
|---|---|---|
| `SB_BOOKINGS` | ~27188 | All bookings (mixed v1 legacy + v2 native) |

LocalStorage: `localStorage['loveandaman_v2'].sb_bookings` (when persistence is wired in Phase 2).

---

## 3. Schemas

Two schemas coexist for backward compat. `schemaVer === 2` marks the new shape.

### 3.1 v1 legacy

Pre-Rate-Type bookings. Kept readable so old reports still work.

```javascript
{
  id: 'BK-26050001',
  dateCreated: '2026-05-09',
  travelDate: '2026-05-11',
  customerName: 'Sergei Volkov',
  nationality: 'Russian',
  channel: 'a01',                  // agentId for B2B · b2c channelId for B2C
  channelType: 'b2b',              // 'b2b' | 'b2c'
  programId: 'r5',                 // single route
  pax: {adult:2, child:0, infant:0},
  paxType: 'fr',                   // 'thai' | 'fr' · controls which seatRate column
  transfer: 'PK',                  // pickup zone
  payment: 'invoice',
  total: 0,                        // auto-calc via sbCalcBookingTotal()
  status: 'confirmed',             // 'confirmed' | 'pending'
  note: ''
}
```

### 3.2 v2 native

Multi-trip + FOC + contract-bound payment + zone-aware.

```javascript
{
  id: 'BK-26050042',
  schemaVer: 2,
  createdAt: '2026-05-29',
  createdBy: 'RM',

  agentId: 'a01',                  // → SB_AGENTS · null for B2C
  rateTypeRef: 'rt001',            // captured at booking time (locked snapshot)
  b2cChannel: null,                // 'c02' etc. when agentId === null

  leadPax: 'Pratishruti Murali Meera',
  leadPhone: '+66 98 765 4321',
  pickup: 'Thavorn Beach Village',
  pickupTime: '08:10–08:20',

  trips: [
    {
      routeId: 'r10',
      date: '2026-05-30',
      pax: { ad:2, chd:0, inf:0, foc:0 },
      bundle: { type:'longtail', mode:'free' },      // captured if rt.routeBundles[rId]
      subtotal: 4800
    },
    {
      routeId: 'r5',
      date: '2026-06-02',
      pax: { ad:12, chd:3, inf:1, foc:2 },
      subtotal: 33750
    }
  ],

  addOns: [
    { type:'transfer', label:'Sedan PK transfer', amount:1800 },
    { type:'longtail', label:'Longtail Join',     amount:4200 }
  ],

  focApproval: {                   // only present if any trip has foc > 0
    count: 2,
    reason: 'VIP family returning · comp for Apr schedule change',
    status: 'pending',             // 'pending' | 'approved' | 'rejected'
    requestedAt: '2026-05-29T14:24:00Z',
    requestedBy: 'RM',
    approvedAt: null,
    approvedBy: null,
    rejectReason: null
  },

  paymentSnapshot: {               // captured from agent.contract § 06 at booking time
    method: 'credit',              // 'credit' | 'prepaid'
    netDays: 30,
    source: 'contract',            // 'contract' | 'b2c' | 'override'
    contractVersion: 'v2026-1',
    section: '§ 06'
  },

  priceBreakdown: {
    seat: 38550,
    addOn: 6000,
    focDiscount: -4800,
    total: 39750
  },

  status: 'pending_foc',           // see §3.3
  total: 39750,
  note: 'VIP family'
}
```

### 3.3 Status values

| Status | Meaning |
|---|---|
| `quote` | Draft · not yet submitted |
| `pending_foc` | Submitted with FOC > 0 · awaiting approval |
| `confirmed` | Locked + invoiced/credited · normal flow |
| `rejected` | FOC approval rejected |
| `cancelled` | Manually cancelled |
| `completed` | Travel date passed · post-trip |

---

## 4. UI structure

### 4.1 Page layout (Phase 1 · 3-tab)

```
┌─ Tab strip [Calendar · By trip+date · All bookings] ─────────┐
│  + View toggle [Calendar | Matrix] (only in Tab 1)           │
│  + Month nav · Today                                         │
│  + Live meta (pax · booking count)                           │
│  + New booking button                                        │
├──────────────────────────────────────────────────────────────┤
│  Tab body:                                                   │
│   • Tab 1 Calendar — 7×5 month grid · pax + top routes mini  │
│   • Tab 1 Matrix   — routes × 30 days heatmap                │
│   • Tab 1 detail panel (shared) — AD·CHD·INF·FOC + PK·KL·NT  │
│   • Tab 2 By trip+date — filtered list (from Tab 1 click)    │
│   • Tab 3 All bookings — KPI · filter pills · Linear table   │
├──────────────────────────────────────────────────────────────┤
│  Footer hints (M switch · keyboard shortcuts)                │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Visual tokens

Matches Calendar sidebar page:
- Body: **DM Sans**
- Numbers/IDs: **DM Mono**
- Primary: `--ink` `#1a2332`
- Accent: `--ocean` `#1a6a8a` · `--ocean-mid` `#2196be`
- Page bg: `--sand` `#f5f2ed`
- Card bg: `--white`
- Border: `rgba(26,35,50,.09)` (very subtle)

Intensity scale (heatmap):
- `lo` plain white
- `mid` `#e9f5ec`
- `hi` `#5dcaa5`
- `peak` `#0f6e56`
- `foc` `#faeeda` (cell containing pending FOC)

---

## 5. Key functions (Phase 1)

### 5.1 Entry + shell

| Function | Line | Purpose |
|---|---|---|
| `renderBooking()` | ~32430 | Sidebar nav entry · calls `bkV2Render()` |
| `bkV2Render()` | ~32987 | Renders shell + delegates to active tab |
| `bkV2RenderList()` | ~32993 | Backward-compat alias |
| `bkV2RenderTopbar()` | ~32995 | Tabs · view toggle · month nav · new button |
| `bkV2RenderTabBody()` | ~33046 | Routes to renderer based on `_bkV2.tab` |

### 5.2 Tab 1 · Calendar

| Function | Line | Purpose |
|---|---|---|
| `bkV2RenderCalendar()` | ~33057 | 7×5 grid · color intensity · top-routes mini |
| `bkV2DayIntensity(total)` | ~32899 | Calendar cell intensity bucket |

### 5.3 Tab 1 · Matrix

| Function | Line | Purpose |
|---|---|---|
| `bkV2RenderMatrix()` | ~33112 | routes × 30 days heatmap |
| `bkV2CellIntensity(total)` | ~32892 | Matrix cell intensity bucket |

### 5.4 Tab 1 · Detail panel (shared)

| Function | Line | Purpose |
|---|---|---|
| `bkV2RenderDetailPanel()` | ~33172 | Bottom strip · adapts to selection (whole-day or single cell) |
| `bkV2RenderFooterHints(mode)` | ~33249 | Legend + keyboard hints |

### 5.5 Tab 2 · By trip+date

| Function | Line | Purpose |
|---|---|---|
| `bkV2RenderTab2()` | ~33263 | Filtered list from Tab 1 drill-down · clearable chips |

### 5.6 Tab 3 · All bookings

| Function | Line | Purpose |
|---|---|---|
| `bkV2RenderTab3()` | ~33317 | KPI · filter pills · search · Linear-style table |

### 5.7 Helpers

| Function | Line | Purpose |
|---|---|---|
| `bkV2Norm(bk)` | ~32919 | Normalize v1/v2 to common shape for list rendering |
| `bkV2Aggregate()` | ~32837 | Aggregate all bookings into `byDate[YYYY-MM-DD]` with pax/zone/route breakdown |
| `bkV2Routes()` | (in section) | Live list of routes from SB_RATE_TYPES + bookings → ROUTES lookup |
| `bkV2Route(id)` / `bkV2RouteShort(id)` | (in section) | Lookup |
| `bkV2ShortenRouteName(name)` | (in section) | Auto-shorten verbose route names |
| `bkV2InferZone(bk)` | ~32829 | Pickup string → PK / KL / NT |
| `bkV2DateKey(d)` | ~33388 | Date → `YYYY-MM-DD` |
| `bkV2FmtTHB(n)` / `bkV2FmtDate(d)` / `bkV2StatusLabel(st)` | ~32979-32985 | Formatters |

### 5.8 Event handlers

| Function | Line | Purpose |
|---|---|---|
| `bkV2SwitchTab(t)` / `bkV2SwitchView(v)` | ~33393-33394 | Tab/view change |
| `bkV2NavMonth(delta)` / `bkV2Today()` | ~33395-33400 | Month navigation |
| `bkV2SelectDay(date)` / `bkV2SelectCell(date, routeId)` | ~33401-33402 | Cell selection (calendar/matrix) |
| `bkV2OpenFiltered(routeId, date)` | ~33403 | Drill from Tab 1 → Tab 2 with filter |
| `bkV2ClearFilter(which)` | ~33409 | Clear filter chips on Tab 2 |
| `bkV2SetFilter(k)` / `bkV2SetSearch(v)` | ~33414-33415 | Tab 3 controls |
| `bkV2NewBooking()` / `bkV2OpenDetail(id)` | ~33421-33422 | **Placeholders · Phase 2/3 will replace** |

---

## 6. State

```javascript
const _bkV2 = {
  tab: 'cal',           // 'cal' | 'bytrip' | 'all'
  view: 'cal',          // 'cal' | 'mx' · only when tab === 'cal'
  cursor: new Date(),   // 1st of currently viewed month
  selected: null,       // { date:'YYYY-MM-DD', routeId?:'r5' }
  filterRoute: null,    // for Tab 2
  filterDate: null,     // for Tab 2
  search: '',           // for Tab 3
  statusFilter: 'all'   // for Tab 3
};
```

---

## 7. Related modules

```
Agent ──agentId────→ Booking
                       ├──rateTypeRef──→ Rate Type (pricing source)
                       ├──paymentSnapshot──→ Contract § 06 (terms · locked snapshot)
                       └──trips[].routeId──→ ROUTES (programs)
```

- **Agent List** → `docs/AGENT_LIST.md`
- **Rate Type** → `docs/RATE_TYPE.md`
- **Contract Document** § 06 Payment Terms → CLAUDE.md §5.3

---

## 8. Workflow (planned end-to-end)

```
New Booking (Phase 2)
  └─ Pick agent → captures rateTypeId · paymentSnapshot from contract
  └─ Add trips (route + date + pax AD·CHD·INF·FOC)
  └─ Pick zone → PK / KL / NT (affects transfer add-on availability)
  └─ Bundle auto-applies if rt.routeBundles[rId] exists (FREE or PAID)
  └─ Optional add-ons (longtail · transfer)
  └─ Review quote breakdown
       ├─ FOC > 0 → require reason · status = pending_foc · Submit
       └─ FOC = 0 → Confirm directly → status = confirmed

Booking Detail (Phase 3)
  └─ FOC approval card (if pending_foc)
       ├─ Approve → status = confirmed · tour confirmation unlocks
       └─ Reject  → status = rejected · notify
  └─ Edit · Cancel · Print voucher · Print invoice
  └─ Status timeline
```

---

## 9. Aggregation logic (Tab 1)

`bkV2Aggregate()` returns:

```javascript
{
  byDate: {
    '2026-06-15': {
      total: 60,
      ad: 42, chd: 13, inf: 3, foc: 2,
      pk: 48, kl: 8, nt: 4,
      hasFocPending: true,
      revenue: 126200,
      bookings: ['BK-26050042', 'BK-26050041'],
      routes: {
        r5:  { total:18, ad:12, chd:3, inf:1, foc:2, pk:14, kl:4, nt:0, hasFocPending:true },
        r10: { total:20, ad:16, chd:3, inf:1, foc:0, pk:16, kl:4, nt:0, hasFocPending:false },
        ...
      }
    }
  }
}
```

- v1 bookings contribute via `programId` + `travelDate` + legacy `pax{adult,child,infant}`
- v2 bookings contribute one entry per `trips[]`
- Zone derived from pickup string (KL/NT/PK fallback)

---

## 10. Gotchas

| Issue | Workaround |
|---|---|
| v1 + v2 schemas mix in same array | Always check `bk.schemaVer === 2` before reading new fields |
| `bkV2Norm()` flattens v2 multi-trip into one summary row | Open Detail for full trip breakdown |
| `bkV2Routes()` recomputes from live SB_RATE_TYPES every call | If many bookings · cache on render (currently fast enough) |
| Selecting whole-day cell vs cell-in-matrix produces different detail | Calendar = per-route rows · Matrix = single cell breakdown |
| Routes list driven by Rate Types · new route won't appear until added to a rate type or used in a booking | This is intentional · keeps matrix relevant |
| Phase 2 not built → `+ New booking` shows alert | Coming soon |
| Phase 3 not built → clicking row shows alert | Coming soon |

---

## 11. First task examples

**Read-only:**
> Count bookings per route in June 2026 · sort by total

**Light edit:**
> Add a `salesPersonId` field to v2 booking · seed in 2 entries · expose in Tab 3 table

**Bigger work (Phase 2 kickoff):**
> Build New Booking wizard following Linear single-page design · Agent picker + multi-trip table + AD/CHD/INF/FOC pax steppers + auto bundle + add-ons + payment auto-from-contract panel + FOC reason field
