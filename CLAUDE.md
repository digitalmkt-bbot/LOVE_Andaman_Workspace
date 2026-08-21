# LOVE Andaman — ops platform

> Cowork context file, loaded every session.
> Per-feature history lives in **CHANGELOG.md** (not auto-loaded) — grep it when a task needs the
> detail behind a specific change.

## 0. START HERE (new-chat orientation)

**Two systems, both real right now:**

1. **The monolith** — `allotment_v2/allotment_v2.html`, one file, ~83k lines. This is what staff use
   today at `rsvn.loveandaman.com`. It owns booking, fleet, boat ops, vans, accounting, sales.
2. **The platform** — `platform/`, a pnpm monorepo (Fastify API + React SPA) that replaces it
   domain by domain. Phase 0 is complete; booking is Phase 1. See §2.

Until the cutover the monolith is production. Treat it as live software, not legacy.

**Starting a new chat:**
1. Do NOT dump the changelog back at the user or re-read the whole file.
2. On a task: `grep -n` for the relevant function → read a 30–50 line window → targeted edit → verify.
3. Check which system the task belongs to before touching anything — a booking change may belong in
   `platform/`, not the monolith.

**Companion docs:** `allotment_v2/docs/rewrite/` (README = plan of record, TASKS = the work) ·
`allotment_v2/docs/design/` (the visual system, 7 docs) · `allotment_v2/docs/workflows/` (per-domain
behaviour, 8 docs) · `SYSTEM_MAP.md` (architecture; some store notes are stale — this file wins) ·
`CHANGELOG.md` (full §-history).

---

## 1. Branches and deploy (read before pushing anything)

**`lk-inbox` IS production.** Railway auto-deploys it (~1–2 min), so **`git push origin lk-inbox` is
a release** — staff see it minutes later and its migrations run against the live database on the way.
Every push is shipping, not saving. (True since 2026-08-12; older notes saying otherwise are obsolete.)

| Branch | Role |
|---|---|
| `lk-inbox` | Production. Ships on push. Cut sprint branches from here. |
| `main` | Sprint-end merge target. Currently ~141 commits behind `lk-inbox` — being reconciled. Nothing deploys from it. |
| `refactor/booking-v2-migration` | Sprint branch cut from `lk-inbox`, merges into `main`. |
| `agent/LAM-*` | One per ticket. Safe to push directly. |
| `backend-db-implementation` | **Dead.** ~680 commits behind. Ignore it and `HANDOFF_2026-07-04.md`'s branch instructions. |

- **Plain git from the sandbox works** — auth is configured. GitHub Desktop / computer-use is NOT needed.
- **Always `git fetch` and fast-forward before working.** Other sessions push to `lk-inbox` constantly;
  a rejected push usually means someone already shipped what you were about to write. Read their commit
  first — a pier-check-in permission fix was once written twice this way, and the upstream one was better.
- Work in a worktree, one per ticket, under `D:/projects/wt-*`. Never edit in the main checkout.

**Cloudflare:** Rocket Loader must stay **off**. It defers inline scripts, which kills every inline
`onclick` in the monolith and looks exactly like a permissions bug.

**Verifying what is actually live** — don't guess from branch names, query the prod DB.
`OPS_DATABASE_URL` is in the B2C repo's `.env` (`D:/projects/Loveandaman-Kingdom/.env`); the URL in
`db/rt.cjs` is dead. App tables are in schema `operation_schemas`; **`schema_migrations` is in schema
`allotment`** (the boot runner creates it unqualified, so it lands in the connection's default schema).
`SELECT name, applied_at FROM allotment.schema_migrations ORDER BY applied_at` is the fastest honest
answer to "what is prod running" — each row is a deploy that happened.

---

## 2. The rewrite

**Plan of record:** `allotment_v2/docs/rewrite/README.md`. Decisions D1–D5 there are binding.
**The work:** `allotment_v2/docs/rewrite/TASKS.md`, one self-contained task per ticket.

Strangler-fig, booking first. The API becomes the only thing that talks to Postgres; four consumer
classes (ops app, B2C, ERP, agent portal) all go through it. Phases run 0–8; Phase 8 deletes the
monolith. Phases 2–8 are named but not yet specified.

```
platform/
  apps/api        Fastify 5 + TS — the only thing that talks to Postgres
  apps/ops-web    Vite + React + TS — replaces the monolith's screens
  packages/contracts  zod schemas + inferred types + OpenAPI. Bottom of the dep graph.
  packages/db         migrations, typed query layer
  packages/pricing    pure pricing functions, no DB access
```

**Phase 0 is done** (P0-00, P0-01, P0-02, P0-03, P0-05) — Phase 1 is unblocked. Still open and
**unscheduled but gating**: `P0-08` (cross-schema ownership) gates `BK-01`; `P0-09` (orphan triage)
gates every foreign key.

**The database is bigger than the old docs said.** P0-01 measured it: 4 schemas, 184 tables, 56,832
rows — not 1 schema / ~103 tables. `love_kingdom` (39 tables) is a **live second writer** used by B2C.
Baseline dumps and the full report are in `db/baseline/`.

**There are TWO migration runners. Do not confuse them:**

| | Monolith | Platform |
|---|---|---|
| Runs | at server boot, on every deploy | `pnpm --filter @la/db run migrate up` |
| Files | `db/migrations/*.sql` | `platform/packages/db/migrations/NNNN_name.sql` |
| Ledger | `schema_migrations` (schema `allotment`) | `platform_migrations` |
| Checksum | sha1 | sha256, line-ending normalised |
| Advisory lock | `4820261` | `8150237` |

Monolith migrations **apply to prod the moment the push lands**. A `field_mapping.json` entry whose
migration file is missing takes `/api/load` down entirely — ship the mapping and the migration in the
same push.

---

## 3. Company

**LOVE Andaman** — Phuket marine tourism. Routes: Similan, Surin, Phi Phi, Phang Nga Bay, Whale Shark.
Fleet ~16 vessels (verify in `DEFAULT_BOATS`).

**Language:** Thai + English UI is fine, but use **English/ASCII in `alert()`, `console.log()` and any
new hooks** — Thai encoding breaks in some contexts.

---

## 4. Monolith data storage (read carefully)

**Source of truth = Postgres `operation_schemas.*`, `DATA_BACKEND=relational`.** The single-file client
keeps a working copy **in RAM** (`_mem`, shimmed over `localStorage.getItem/setItem` for the
`loveandaman_v2` key only). A reload re-loads from `/api/load`. Never write the state blob to real
localStorage — it exceeds the ~5 MB quota and Safari dies with `QuotaExceededError`.

**Writes:** in-memory record-level diff → `laDiffToOps` → one transactional `POST /api/v1/_batch`.
Mapping drift (a key the REST index doesn't know) falls back to legacy `/api/save`. Optimistic
concurrency via `app_state.version`. An empty or unusable blob must never be saved — it wipes the DB.

**localStorage is for tiny UI/cache keys only.** Allowed: `loveandaman_v2__v`, sidebar prefs
(`sb_collapsed`, `la_sbcolor_*`, `la_sbacc_*`, `la_pogrp`), `sessionStorage.la_view`. Do not add new
localStorage writes for business records.

**The in-memory blob still uses old key names** (`sb_bookings`, `sb_agents`, `boats`, …) — client cache
shapes, not the store. Persist helpers (`save()`, `flSave()`, `rtPersist()`, `sbAgentsPersist()`) are
read-modify-write on that RAM object. Never clobber sibling keys.

**Load conditions matter.** `sb_bookings`, `sb_agents` etc. must load with `Array.isArray(...)` — an
empty array stays empty and must not revert to seed. A key persisted in SQL but never loaded = data
vanishes on refresh.

**Seeds:** `DEFAULT_*` / `SB_*` / `FL_*` fill empty first-run arrays only. Items appended to a default
list never reach already-seeded rows — add an idempotent merge in `flLoad` (push missing ids only).

`FLEET_VERSION='fleet_v34'` · `DATA_VERSION='2026o'` · `LS_KEY='loveandaman_v2'` (RAM key, not a disk
store). Bump `FLEET_VERSION` + add a migration in `flLoad()` for structural fleet changes.

---

## 5. Schema reference (monolith, verified)

### 5.1 Boat (`DEFAULT_BOATS` / `boats[]` · SQL `boats`)
`id`, `name`, `type`; location `pier` (home/operational), `homeportCity`/`homeport` (legal
registration); capacity `cap` (booking cap), `licensePax` (real seats), `totalcap`, `crew`,
`engineCount`; specs `material/gt/nt/loa/beam/depth/bhp`; legal `reg/callsign/owner/ownerAddr/docs[]`;
and a **status `log[]`** whose LAST entry is current: `{s:'available'|'fixing'|'unavailable', from,
to(null=ongoing), loc?, note?, reason?}`.

**Location disambiguation:** "อยู่ท่าไหน" (operational) → `pier`; "ตอนนี้อยู่ที่ไหนจริง" →
`log[last].loc` else `pier`; "จดทะเบียนจังหวัดอะไร" → `homeportCity`. Say which field you used.

**Pier enum (exact):** `tublamu` (Tub Lamu — Similan/Surin), `panwa` (Visit Panwa — Phi Phi). Planned:
`ranong`. ❌ Never `visitpanwa` / `"Tub Lamu"` / `"Visit Panwa"`. Before assigning any enum string, list
current values first: `[...new Set(d.boats.map(b=>b.field))]`.

**Boat Status UI groups by (pier + status):** Tub Lamu = `pier==='tublamu' && last.s!=='fixing'`;
Visit Panwa = `pier==='panwa' && last.s!=='fixing'`; In Shop = `last.s==='fixing'` (any pier).

**Engine/gearbox/propeller positions:** `Port · C.Port · Center · C.Std · Std` (Suzuki "Starboard" ≡
"Std"). Normalize via `flPosLabel`/`flPosRank`. 1 engine = 1 gearbox = 1 propeller; a `spare` part must
be detached (`engineId`/`gearboxId` nulled).

### 5.2 Rate Type (`SB_RATE_TYPES`, grep ~26210)
Reusable price packages bound to agents via `agent.rateTypeId`. `{id, code, name, active, routes[],
seatRates{route:{zone:{paxType:price}}}, routeValidity{route:{from,to}} (source of truth for active
period), routeBundles{route:{longtail:{mode:'free'|'paid',adult,child}}}, charterRates{route:{boatType:
{starterPrice,starterIncludes,extraPerPax}}}, addOns{...}}`. Zones: `PK`, `KL`, `NoTransfer`.

- **Longtail is per-route** (`byRoute`); read via `_rtNormalizeLongtail` / `_rtLongtailForRoute`.
- **Add-on types are data-driven:** `RT_ADDON_DEFS` (rebuilt by `rtRebuildAddonDefs`) is the single
  source of truth. Adding a code-level type = push into `RT_ADDON_BUILTIN` + write
  `_rtAddon{Detail,Edit,Contract,Summary,Init}_<key>`; it cascades everywhere.
- **Persist** with `rtPersist()`. Shared renderer `rtBuildDetailBody(rt)` feeds both the Rate Type page
  and the Agent Pricing tab.

### 5.3 Zone/region expansion
Piers, rate-type zones, pickup zones and pickup-setup areas are 4 overlapping "where" concepts stored
separately; a real new zone touches ~5–6 places. Decision (2026-06-01, Option A): don't refactor to a
central `SB_ZONES` until 2+ zones land at once or non-technical staff need zone CRUD. Until then follow
the manual checklist — CHANGELOG §12 / `SYSTEM_MAP.md`. (Pickup Setup adds **Areas** only; zones are
hardcoded `['PK','KL','NoTransfer']`.)

### 5.4 Booking (`SB_BOOKINGS`)
`id`, `schemaVer`, `agentId`, `channel`, `leadPax`, `leadNationality`, `leadPhone`, `leadEmail`,
`hotelName`, `pickupAreaId`, `status`, `bookingDate`, `voucherRef`, `trips[]`, `passengers[]`,
`addOns[]`, `adjustments[]`, `priceBreakdown{seat,addOn,focDiscount,discount,extra,total}`,
`paymentSnapshot`, `marketSnapshot`, `history[]`, `ops{boatId,vanId,vanGroup,vanSeq,vanReturnId,
vanSplits[],pfm{}}`.

- Cancelled statuses excluded from every aggregate: `['cancelled','cancelled_weather','rejected']`.
- `trip`: `{routeId, date, bookingMode:'seat'|'charter', pax:{ad_fr,ad_th,chd_fr,chd_th,inf_fr,inf_th,
  foc}, charterBoatId?, charterPriceMode?, lockDrawSel{}, seatSource{locked,general}}`.
- **Edit preserve:** `bkV2CommitBooking` rebuilds a fresh object — the `if(editing)` block MUST carry
  over `ops`, `upgrades`, `feeItems`, `reschedule`, `partialCancels`, `cancellation`, `cancelCategory`,
  `history`, `weatherResolve`, `rebook`, `invoiceId`, `paymentStatus`. Miss one = wiped on every edit.
- Two id formats exist in live data: v2 `BK-YYMMNNNN-XXXX` (local time, MAX sequence) and legacy v1
  `BK-YYMMDD-NNN-XXXX` (`toISOString()`, count sequence). Don't assume one shape.

### 5.5 Agent (`SB_AGENTS`)
`id`, `name`, `code`, `companyInfo{legalName,taxId,address}`, `contact{name,phone,email}`,
`rateTypeId`, `market`, `sales`, `payType` (`invoice`/`proforma`/`cash`), `vatMode`
(`none`/`exclude`/`include`), `creditLimit`, `contractVersion`. Persisted by `sbAgentsPersist()`.
Load condition `Array.isArray(d.sb_agents)` — an empty array keeps the list cleared.

---

## 6. Safety rules

- **Back up first** for any edit touching `DEFAULT_*`/`FL_DEFAULT_*`, `flLoad()`/`save()`/`flSave()`,
  the `_mem`/`/api` persist path, mapper/REST index, or >~50 lines.
- **Don't break structure:** don't rename/delete existing fields (mark inactive instead), don't change
  the `loveandaman_v2` in-memory shape or `operation_schemas` mapping without a migration, always
  read-modify-write the RAM blob. Add new fields as optional with defaults. **A new persisted field
  also needs a mapper/REST-index entry or it is dropped on the next SQL round-trip.**
- **Verify enum values** before assigning unknown strings.
- **Keep data fixes user-triggered.** Don't add auto-mutations to `flLoad` that could rewrite
  legitimate data. Existing self-heals (engine status, boat stuck-fixing, charter-boat mirror,
  van-group `vanId`) are deliberately idempotent and targeted — match that bar or don't add one.
- **Preserve runtime safety systems:** `flLoad()` auto-snapshot + `flListSnapshots()`/
  `flRestoreSnapshot(N)`, defensive field-level merge, version whitelist.
- **Browser must run via localhost, not `file://`.** `file://` breaks `/api` (fetch + auth). ONE tab
  only. Never test in an artifact preview (isolated storage, no backend).

---

## 7. Working with the file · look & feel · comms

- The monolith is huge — never read it whole. `grep -n` to locate → read 30–50 lines → targeted
  `str_replace` with unique surrounding context → re-read only the changed section. Verify with
  `node --check` on the extracted `<script>`.
- **Visual system is documented** in `allotment_v2/docs/design/` — start with `00-DESIGN-PRINCIPLES.md`.
  Short version: DM Sans body, **DM Mono for every figure**, Ocean blue `#1683C7` accent applied via
  reversible `<style id="…-skin">` blocks, hairline borders, three radii (6/10/14), tint+dot status
  pills, density over decoration. The app hosts ~15 distinct per-view palettes — match the page you're
  in, not a global default. Icons are inline SVG; there is no Tabler webfont.
- **Comms:** concise, show snippets, ask before big refactors, remind about backups before core-data
  edits, state the diff after edits (e.g. "added 3 entries to `FL_DEFAULT_ENGINES` at line 3045").

---

## 8. Gotchas (these bite repeatedly)

**JS / render**
- **`esc` / `escapeHTML` is NOT global** — declared locally per function. A new top-level render fn
  using `esc(...)` must declare its own or it throws silently on click.
- **Timezone:** build `YYYY-MM-DD` with `bkV2LocalYMD(dt)`, never `toISOString().slice(0,10)` (UTC
  shift breaks +07:00 date stepping).
- **Scroll-jump on re-render:** replacing a mount's `innerHTML` while the focused element lives inside
  it scrolls to top. Fix = surgical update of the changed sub-region, or capture/restore `scrollTop`
  and blur first.
- **`backdrop-filter` creates a stacking context** that traps typeahead dropdowns. Keep it off form
  cards containing dropdowns.
- **Sticky-header offsets** read CSS vars `--topbar` / `--t2-vangroup-top` — never hardcode `52`.

**Booking**
- **Cancelled statuses** excluded from every pax/revenue/count aggregate.
- **Capacity:** `boat.cap` = booking cap; `boat.licensePax` = real seats. Over cap →
  `status:'pending_approval'`; over licence → hard block. Boat-assign tolerance `cap+2` (`BA_CAP_TOL`).

**Seat locks**
- Locks reduce the sellable pool (`getAllotment` subtracts `lockedSeats`). Would-eat-locked-seats →
  **hard block**; true physical oversell → soft confirm. A booking can never silently consume locked seats.
- Parent/sub-group: `bkV2LockPoolHold` counts the hold at parent/standalone level only (child → 0).
  Month locks use rolling per-trip release, not a global expiry.

**Vans / boats**
- **Van group = one outbound van by design; return van is per-booking.** Disband must null both
  `vanId` and `vanReturnId`; `bkV2VanGroupHeal` reconciles `vanId` only. Never auto-pick a van
  (ห้ามเดา) — surface "รถปนกัน" conflicts instead.
- **Charter boats are excluded from the seat pool** (`baCharterBoatIds`, `getSeatsConsumed`);
  `bkV2CharterBoatHeal` mirrors `trip.charterBoatId`→`ops.boatId`.
- Per-date driver/phone/plate overrides live in `VANJOB_DRIVER[date::vanId]`; `bk.pickupSelf` and
  `bkV2RetInfo().selfRet` drop a booking from van job orders without changing the rate.

**Fleet**
- **Engine hours = `baseHours + (latest − first Daily-Log reading)`, skipping readings ≤ 0** (a `0`
  placeholder blows the total up). Service cycle counts down vs `lastServiceHours`; reset at job close
  (`flMaintServiceReset`).
- **Per-asset maintenance cost** = job cost ÷ same-type assets on the job (`flMaintCostShare`), applied
  ONLY on Engine/Gearbox/Propeller detail pages.
- **Engine swap:** the engine is the swappable unit; gearbox + propeller stay at the boat's drive
  position and the incoming engine adopts them.

**Docs / assets**
- `assets/hero/<routeId>.jpg` is **shared** (Voucher + Pickup-Setup card) with marketing text baked in
  — hence the per-route `assets/voucher/<routeId>.jpg` override layer rendered on top.
- Doc-Check OCR (Tesseract.js, English) needs network at runtime; images only. Cached on
  `bk.docCheck.pre`.

---

## 9. Module map

Booking v2 (`#view-booking`→`bkV2Render`) · Agent Info · Add-on Services · Rate Types · Contract
Document · Accounting · Demand/Market Intelligence · Daily PFM · Pickup Map · Insurance · FOC Detail ·
Booking Flow · Consumables · Fuel Intelligence.

Fleet: Boat Operation (`renderOp`), Transfer Fleet (`renderVehicles`), Van Job Orders
(`renderVanJobs`), Pickup Setup (`renderPickupSetup`), Maintenance/Incidents/Engines/Gearboxes/
Propellers/Projects.

Sidebar groups: OPERATIONS · SALES · ACCOUNTING & FINANCE · Fleet Management · Overview · Config.

*Full per-feature history (§13–§87) is in **CHANGELOG.md** — grep it for the reasoning behind any
specific behaviour.*
