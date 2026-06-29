# Rate Type

> Module: Sales & Booking · `nav-item data-view="rate-types"` → `view-rate-types`
> Source: `allotment_v2.html` · Last updated: 2026-05-29

---

## 1. Purpose

A **Rate Type** is a reusable price package that bundles together everything an agent needs to sell tours:
- Seat rates per route × zone × pax-type
- Charter rates (starter + extra pax)
- Add-on services (longtail join/charter · private transfer)
- Forced bundles (e.g. Whale Shark includes longtail free)
- Validity periods (per route Start/End)

Multiple agents can bind to the same Rate Type (e.g. all Russian DMCs share `rt001 DMC-RU`). When you change a price, every agent on that rate type gets the new price automatically.

This is the **single source of truth for B2B pricing**. Booking flow (in progress) reads from here.

---

## 2. Data location

| Constant | Line | Contains |
|---|---|---|
| `SB_RATE_TYPES` | ~27121 | All rate type objects |

LocalStorage key: `localStorage['loveandaman_v2'].sb_rate_types` · written by `rtPersist()` (~28941) using read-modify-write per CLAUDE.md §6.2.

---

## 3. Schema

See **CLAUDE.md §4.6** for the canonical schema reference. Summary:

```javascript
{
  id: 'rt001', code: 'DMC-RU', name: 'DMC Russia · Standard',
  color: '#185FA5', note: 'High-volume Russian DMC',
  active: true,
  validFrom: '2026-01-01', validTo: '2026-12-31',     // rate-type-level fallback

  routes: ['r5','r6','r10'],                           // routes covered

  // Seat rates per route × zone × pax-type
  seatRates: {
    r5: {
      PK:         {'adult-thai':1800,'child-thai':1250,'adult-fr':2400,'child-fr':1650},
      KL:         {...},
      NoTransfer: {...}
    }
  },

  // PER-ROUTE Active period (SOURCE OF TRUTH · charter + addOns inherit)
  routeValidity: {
    r5: {from:'2026-01-01', to:'2026-12-31'},
    r6: {from:'2026-03-15', to:'2026-11-30'}
  },

  // Forced bundle baked into seat price
  routeBundles: {
    r10: { longtail: {mode:'free', adult:0,   child:0  } },   // bundled · no surcharge
    r6:  { longtail: {mode:'paid', adult:500, child:300} }    // bundled · with surcharge
  },

  // Charter rates · starter + marginal
  charterRates: {
    r5: { speedboat: {starterPrice:54000, starterIncludes:4, extraPerPax:3500} }
  },

  // Optional add-ons (NOT bundled · per booking)
  addOns: {
    longtail: {
      applies: ['r5','r6'],
      join:    {adult:650, child:400},          // per pax
      charter: {price:4500, capacity:6}         // per boat
    },
    privateTransfer: {
      unit: 'per trip',
      r5: { PK: {sedan:1800, van:2400}, KL: {sedan:2800, van:3800} }
    }
  }
}
```

### 3.1 Inheritance flow

```
§1 Seat rates           ← editable Start/End per route (routeValidity = SOT)
    ↓ inherit
§2 Charter rates        ← read-only · displays inherited dates
    ↓ inherit
§3.2 Private Transfer   ← read-only · displays inherited dates
```

### 3.2 Bundle behavior

When `routeBundles[rId]?.longtail` exists for a booking's route:
- Longtail Join is **forced** into the package
- `mode:'free'` → no surcharge · invoice shows `(incl. Longtail Join)`
- `mode:'paid'` → adds `adult×paxA + child×paxC` to seat total automatically
- Agent **cannot** opt out · the Add-on checkbox is disabled for that route
- Longtail Charter (เหมา) remains available as separate upgrade

---

## 4. UI structure

### 4.1 Page layout

```
┌─ Sidebar (rate type cards · color-coded · active/inactive) ─┐
├─ Main (toolbar · view toggle · current selection) ──────────┤
├─ Detail panel (Balance Sheet view) ─────────────────────────┤
│  §1 Seat rates per route (editable Start/End)               │
│  §2 Charter rates (starter + extra)                         │
│  §3.1 Bundle Longtail (Free / Paid mode)                    │
│  §3.2 Private Transfer (matrix per route × zone)            │
│  §3.3 Longtail Add-on (Join/Charter modes)                  │
│  §4 Agents bound to this rate type                          │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 3-col view (Agents column)

Toggle to show Agents column on right (320px) listing every agent bound to the selected rate type · sortable · filter by market.

---

## 5. Key functions

### 5.1 Render

| Function | Line | Purpose |
|---|---|---|
| `renderRateTypes()` | (search) | Main entry |
| `rtRenderList()` / `rtRenderCards()` | ~27616 | Sidebar cards |
| `rtRenderDetail(rtId)` | ~27679 | Balance Sheet view |
| `rtRenderAgentColumn(rtId)` | ~27492 | 3-col right panel |
| `rtSelectCard(rtId)` | ~27440 | Click handler |
| `rtSetViewMode(mode)` | ~27454 | 'detail' vs 'agents' (3-col) |
| `rtApplyViewMode()` | ~27464 | Layout adjustment |
| `rtSetAgentMktFilter(mkt)` | ~27487 | Filter pills in 3rd column |

### 5.2 Create / edit modal

| Function | Line | Purpose |
|---|---|---|
| `rtOpenNew()` / `rtOpenEdit(rtId)` | ~28200-28209 | Open modal |
| `rtModalClose()` | ~28228 | Close + persist |
| `rtDraftSet(path, value)` | ~28233 | Update draft (path = dot notation) |
| `rtDraftToggleRoute(rId)` | ~28270 | Add/remove route from rate type |
| `rtToggleActive(rtId, ev)` | ~27603 | Active/inactive toggle |
| `rtCopyFromRT(srcId)` | ~28454 | Clone existing rate type |

### 5.3 Charter + Transfer

| Function | Line | Purpose |
|---|---|---|
| `rtAddCharterRow()` | ~28289 | Add charter rate row |
| `rtRemoveCharterRow(rId, boatType)` | ~28380 | Remove |
| `rtChangeCharterRoute(oldRid, boatType, newRid)` | ~28388 | Edit route |
| `rtChangeCharterBoatType(rId, oldBt, newBt)` | ~28399 | Edit boat type |
| `rtAddTransferRow()` / `rtAddTransferRoute()` | ~28297-28309 | Add transfer matrix entry |
| `rtRemoveTransferRoute(rId)` / `rtRemoveTransferRow(rId, zone)` | ~28323-28351 | Remove |
| `rtChangeTransferRoute*` / `rtChangeTransferZone` | ~28330-28371 | Edit |

### 5.4 Bundle Longtail

| Function | Line | Purpose |
|---|---|---|
| `rtToggleBundleLongtail(rId, enabled)` | ~28246 | Enable/disable bundle on a route |
| `rtSetBundleMode(rId, mode)` | ~28260 | Switch Free / Paid |

### 5.5 Add-ons

| Function | Line | Purpose |
|---|---|---|
| `rtToggleAddOn(key, enabled)` | ~28425 | Master switch for add-on type |
| `rtToggleAddOnRoute(addOnKey, rId)` | ~28445 | Enable/disable add-on per route |

### 5.6 Agent picker (bulk-bind)

| Function | Line | Purpose |
|---|---|---|
| `rtOpenAgentPicker(rtId)` | ~28033 | Open multi-select modal |
| `rtAgentPickerToggle(agentId)` | ~28048 | Toggle one |
| `rtAgentPickerToggleGroup(market, agentIds)` | ~28054 | Toggle all in market |
| `rtAgentPickerSearch(q)` | ~28062 | Filter |
| `rtAgentPickerApply()` | ~28064 | Apply selection · update `agent.rateTypeId` for each |
| `rtUnbindAgent(agentId, rtId, ev)` | ~28179 | Quick unbind |

### 5.7 Helpers

| Function | Line | Purpose |
|---|---|---|
| `_rtNormalizeLongtail(ao.longtail)` | (search) | Handles old/new longtail shape · always use this in readers |
| `rtPersist()` | ~28941 | Read-modify-write to localStorage |
| `getAgentsUsingRateType(rtId)` | ~27155 | List bound agents |

---

## 6. Related modules

```
ROUTES ────→ Rate Type ──routes──→ Programs in Contract (Agent · Info tab)
                │
                ├──seatRates──→ Booking pricing
                ├──routeBundles──→ forced bundle in Booking
                ├──addOns──→ optional add-ons in Booking
                ├──charterRates──→ private charter quote
                ↓
              Agent ──rateTypeId──→ binding
```

- **Agent List** → `docs/AGENT_LIST.md`
- **Booking** → `docs/BOOKING.md` (consumes everything here)
- **Contract Document** § 04 Pricing reads from here · CLAUDE.md §5.3

---

## 7. State globals

| Var | Line | Purpose |
|---|---|---|
| `_rtSelected` | ~27420 | Currently selected rate type id |
| `_rtViewMode` | ~27421 | 'detail' (2-col) or 'agents' (3-col) |
| `_rtAgentMktFilter` | ~27422 | Filter pill in 3rd column |
| `_rtAgentPickerRtId` / `_rtAgentPickerSelected` / `_rtAgentPickerQuery` | ~28029-28031 | Picker modal state |
| `_rtDraft` / `_rtDraftIsNew` | ~28193-28194 | Edit modal draft |

---

## 8. Common patterns

### 8.1 Adding a new add-on type

1. Add definition in `addOns` of any rate type · update seed entries
2. Extend `rtToggleAddOn` switch
3. Add UI section in `rtRenderDetail`
4. Add Booking flow consumer when wiring Phase 2

### 8.2 Adding a route to a rate type

1. Open Rate Type · click "+ Add route"
2. Pick from route picker (filters out routes already covered)
3. `rtDraftToggleRoute(rId)` adds to `routes[]` + creates empty `seatRates[rId]` skeleton
4. Fill rates → Save → `rtPersist()`

### 8.3 Changing per-route validity

1. Edit Start/End on the §1 Seat rates row for that route
2. Updates `routeValidity[rId]` (the SOT)
3. §2 Charter + §3.2 Transfer immediately display the inherited dates

---

## 9. Gotchas

| Issue | Workaround |
|---|---|
| `validFrom/validTo` at rate-type level conflicts with `routeValidity` | Always prefer `routeValidity[rId]` · root-level is legacy fallback |
| Bundle Longtail mode change doesn't recompute existing booking quotes | Quotes are captured at booking time · re-issue if needed |
| Charter `extraPerPax` is per-pax over `starterIncludes` | NOT per-pax · check before computing |
| Private Transfer matrix can have route without zones | Treat as "no transfer available" |
| Agent's `programs[]` field is legacy display · prefer `rt.routes` | Booking flow reads from `rt.routes` |

---

## 10. First task examples

**Read-only:**
> List rate types that include r12 (Whale Shark) · group by active/inactive

**Light edit:**
> Add a new rate type "DMC-JP · Premium" with seat rates for r5 + r6

**Bigger work:**
> Add a `cancellationPolicy` field to Rate Type (days before · refund %) · expose in edit modal · render in §5 of Contract Document
