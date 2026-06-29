# Agent List

> Module: Sales & Booking · `nav-item data-view="agents"` → `view-agents`
> Source: `allotment_v2.html` · Last updated: 2026-05-29

---

## 1. Purpose

Master directory of all B2B agents (DMCs, online platforms, walk-in shops) that sell LOVE Andaman tours.

For each agent we manage:
- Contact + tax info
- Market (Russia, China, EU, etc.) + Sales owner
- **Rate Type binding** (which price package this agent uses)
- **Contract** (generated document · TAT-required)
- Recent bookings
- Generated contract history

---

## 2. Data location

### 2.1 In-HTML constants (seed)

| Constant | Line | Contains |
|---|---|---|
| `SB_MARKETS` | ~26793 | Markets (ru, cn, eu, jp, kr, etc.) with flag + color |
| `SB_SALES` | ~26816 | Sales people (avatars + names) |
| `SB_AGENTS` | ~26827 | All agents |
| `SB_AGENT_PRICES` | ~27076 | Per-agent legacy pricing matrix (mostly replaced by Rate Type) |

### 2.2 LocalStorage

`localStorage['loveandaman_v2'].sb_agents` is the runtime source of truth · seeded from `SB_AGENTS` on first load · updated via UI edits.

`agent_artifacts` key stores generated contract artifacts per agent.

---

## 3. Agent schema

```javascript
{
  id: 'a01',
  code: 'BIBLIO',
  name: 'Biblio Globus',
  market: 'ru',                    // → SB_MARKETS lookup
  sub: 'DMC',                      // tier (DMC · Wholesale · Online · etc.)
  sales: 's01',                    // → SB_SALES lookup
  payType: 'invoice',              // legacy · prefer paymentSnapshot at booking
  creditDays: 30,
  creditLimit: 500000,
  contact: 'Ivan K.',
  email: 'ops@biblioglobus.ru',
  phone: '+7 495 xxx',
  note: 'High-volume Russian DMC',
  programs: ['r5','r12','r10'],    // routeIds this agent sells (auto-derived from rateType.routes if rateTypeId set)
  rateTypeId: 'rt001',             // → SB_RATE_TYPES binding · primary source of pricing
  contractVersion: 'v2026-1',      // version label · matched against generated artifacts
  contractStart: '2026-01-01',     // contract effective date
  active: true                     // false = hidden in dropdowns
}
```

### 3.1 Contract version matching

Status chip on the agent header derives from `ctArtifactsFor(agentId)`:

| Condition | Chip |
|---|---|
| No artifacts | (no chip) |
| Latest artifact `.version === a.contractVersion` | 🟢 `✓ Contract · {date}` |
| Latest artifact version ≠ `a.contractVersion` | 🟡 `⚠ Contract outdated · last {version}` |

---

## 4. UI structure

### 4.1 Page layout (FinDash · Agent List style)

```
┌─ KPI strip (4 cards: Total · Active · Markets · Avg credit) ─┐
├─ Filter bar (market pills · sales pills · search) ──────────┤
├─ Sidebar (320px) ───┬─ Detail panel ─────────────────────────┤
│  Agent cards list   │  Selected agent tabs:                  │
│  (sorted by mkt)    │   • Info                               │
│                     │   • Pricing                            │
│                     │   • Programs in Contract               │
│                     │   • Recent Bookings                    │
│                     │   • Generated Contracts                │
└─────────────────────┴────────────────────────────────────────┘
```

### 4.2 Tabs in detail panel

| Tab | Function | Line |
|---|---|---|
| Info | `agTabInfo(a)` | ~29964 |
| Pricing | `agTabPrices(a)` | ~30323 |
| Programs in Contract | (rendered inside Info / Edit) | — |
| Recent Bookings | `agTabHist(a)` | ~31236 |
| Generated Contracts | `agTabContracts(a)` | ~31173 |

---

## 5. Key functions

### 5.1 List + selection

| Function | Line | Purpose |
|---|---|---|
| `renderAgents()` | ~27407 | Main entry · called from `nav()` |
| `agRenderFilters()` | ~29007 | Market + sales filter pills |
| `agRenderList()` | ~29102 | Sidebar agent cards |
| `agSelect(aId)` | ~29223 | Click handler · selects agent · re-renders detail |
| `agSetMktFilter()` / `agSetSalesFilter()` / `agClearFilters()` | ~29162-29176 | Filter state |

### 5.2 Edit modal

| Function | Line | Purpose |
|---|---|---|
| `agEditOpen(section, agentId)` | ~29234 | Opens modal · `section` selects which fields focused |
| `agEditClose()` | ~29257 | Close + persist |
| `agEditSetField(key, val)` | ~29264 | Update draft |
| `agEditRender()` | ~29273 | Render modal body |
| `agEditBuildRateTypePicker()` | ~29519 | Rate Type dropdown |
| `agEditBuildRTPreview(rt)` | ~29600 | Preview prices from selected rate type |

### 5.3 Contract Document

| Function | Line | Purpose |
|---|---|---|
| `ctDocOpen(agentId)` | ~31294 | Open contract wizard |
| `ctArtifactsFor(agentId)` | ~31395 | Return stored artifacts for agent |
| `ctDocSaveField(key, el)` | ~31486 | Save inline-edited field |

See **CLAUDE.md §5.3** for full Contract Document schema.

---

## 6. Related modules

```
Agent ──rateTypeId──→ Rate Type ──routes──→ ROUTES
  │                       │
  │                       └──routeValidity──→ Programs in Contract
  │
  ├──contractVersion──→ Contract Artifact (per agent)
  │
  └──referenced by────→ Bookings (agentId in v2 booking)
```

- **Rate Type** → `docs/RATE_TYPE.md`
- **Booking** → `docs/BOOKING.md`
- **Contract Document** → CLAUDE.md §5.3

---

## 7. Common patterns

### 7.1 Adding a field to agent schema

1. Add field to `SB_AGENTS` seed entries (line ~26827) with default value
2. Add field to edit modal in `agEditRender()` (~29273)
3. Update `agEditSetField()` if special handling needed
4. Update `agTabInfo()` display if field should appear there
5. **DO NOT** rename existing fields · add new only · per CLAUDE.md §6.2

### 7.2 Adding a new tab

1. Add tab pill in detail header (search for `agSwitchTab` callsites)
2. Write `agTabX(a)` function returning HTML
3. Wire into the tab switcher (e.g. line ~29964 area)

### 7.3 Rate Type binding workflow

1. Open agent → Edit
2. Pick Rate Type from picker (`agEditBuildRateTypePicker()`)
3. Modal shows preview (`agEditBuildRTPreview()`) · seat rates · validity
4. Save → agent.rateTypeId updated
5. Programs in Contract auto-inherits coverage from `rt.routes`

---

## 8. Gotchas

| Issue | Workaround |
|---|---|
| Agent without `rateTypeId` → pricing falls back to legacy `SB_AGENT_PRICES` | Migrate when convenient; legacy kept for backward compat |
| Renaming markets/sales breaks lookups | Only add new entries · mark old inactive |
| Contract version mismatch chip = amber | Re-generate contract document · saves new artifact |
| Agent `programs[]` vs `rateType.routes[]` overlap | `programs` is legacy display · prefer reading from `rateType.routes` |
| Visible counts in matrices use `SB_AGENT_PRICES`, not Rate Type | Wire pricing to Rate Type if matrix used in new flows |

---

## 9. First task examples

**Read-only:**
> List all DMC agents with credit > ฿300K · group by market

**Light edit:**
> Add `whatsapp` field to agent schema · seed in 3 entries · expose in edit modal

**Bigger work:**
> Add "Inactivate agent" action with confirmation · marks `active:false` instead of delete
