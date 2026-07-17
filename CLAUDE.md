# LOVE Andaman — allotment_v2

> Cowork context file, loaded every session. Focus: the `allotment_v2` module.
> Per-feature history lives in **CHANGELOG.md** (not auto-loaded) — grep it when a task needs the detail behind a specific change.

## 0. START HERE (new-chat orientation)

**What this is:** one giant single-file web app `allotment_v2/allotment_v2.html` (~4MB / ~46k lines) for LOVE Andaman (Phuket marine tours). Runs on Railway. A logged-in prod Chrome tab already exists — use the Claude-in-Chrome tools to query live `SB_BOOKINGS` etc. to verify any data claim before asserting.

**Starting a new chat:**
1. Do NOT dump the changelog back at the user or re-read the whole file.
2. Greet in Thai and ask what to work on. The user (RM@loveandaman.com) keep replies concise.
3. On a task: `grep` for the relevant function → read a small window → targeted `Edit` → verify.

**Deploy workflow (CRITICAL — the sandbox CANNOT git-push):**
- Edit → extract the main `<script>` and run `node --check` → back up to `BACKUP/`.
- Commit + push ONLY through **GitHub Desktop via computer-use tools**: front GitHub Desktop → if on `main`, switch to branch **`backend-db-implementation`** (bring changes) → Summary → Commit → **Push origin** → switch to `main` → Branch ▸ **Merge into Current Branch** ▸ `backend-db-implementation` ▸ merge commit → **Push origin**.
- Verify: `git ls-remote origin refs/heads/main` must equal `git rev-parse main`.
- Prod auto-deploys from `main` (~1–2 min). `backend-db-implementation` = dev branch (relational-backend work; see `HANDOFF_2026-07-04.md`).

**Pending (not done):** move the Booking top-tab bar onto the same row as the date stepper — user wants 3 mockups (A merge tabs+date · B tabs in day-header · C keep 2 rows, tighten). Awaiting their pick.

**Companion docs in the workspace:** `SYSTEM_MAP.md` (AI-readable architecture map — keep in sync when adding modules), `BACKLOG.md` (pending items), `OPERATIONS_PIPELINE_DESIGN.md` (van-assign/grouping spec), `CHANGELOG.md` (full §-history).

---

## 1. Company & workspace

**LOVE Andaman** — Phuket marine tourism. Routes: Similan, Surin, Phi Phi, Phang Nga Bay, Whale Shark. Fleet ~15 vessels (verify in `DEFAULT_BOATS`).

**Language:** Thai + English UI is fine, but use **English/ASCII in `alert()`, `console.log()`, and any new hooks** (Thai encoding breaks in some contexts).

```
LOVE_Andaman_Workspace/
├── CLAUDE.md · SYSTEM_MAP.md · BACKLOG.md · CHANGELOG.md
└── allotment_v2/
    ├── allotment_v2.html      ← main file
    ├── start_server.command   ← local server (§4)
    ├── BACKUP/                ← timestamped pre-edit copies
    └── data_exports/          ← localStorage JSON exports
```

---

## 2. Data storage model (read carefully)

**Backend = Postgres via `server.js` (`DATA_BACKEND=relational`, ~103 tables).** The single-file client keeps a working copy in **localStorage `loveandaman_v2` (`LS_KEY`)** — seeded from HTML default constants on first run, refreshed from the cloud blob on login — and syncs every change to Postgres through a REST API. localStorage is the in-browser working store; Postgres is the durable source of truth.

**Sync mechanics:**
- **Primary write = per-entity `/api/v1/_batch`.** The frontend `laDiffToOps` translates a record diff into ops (`put` / `del` / `putall` / `meta` / `patch`).
- **`patch` op = per-FIELD merge** (server `restApplyOp` → `restLoad` → `applyObj` → re-put). This is what prevents last-write-wins clobber when two users edit different fields of the same record. Missing/non-object record → `body.full` full-replace fallback.
- **Fallback = whole-blob `/api/save`** (`relApplyAndSave`, DELETE+INSERT all tables) — used only for seed / unknown key / old server. It `console.warn`s `[save] LEGACY whole-blob path` so mapping drift shows in Railway logs.
- **Daily session reset:** login token/cookie expire at the next **03:00 ICT**, so every user is logged out pre-dawn and reloads a fresh cloud blob each morning.

**Seeding — there is no separate seed script.** The `DEFAULT_*` constants baked into `allotment_v2.html` ARE the seed:
- Fleet/config data (boats, engines, routes, inventory…) → hardcoded in `DEFAULT_*` → seeded into localStorage on first load → pushed to Postgres on first save.
- Sales/booking data (agents, rate types, bookings…) → starts empty, grows through real usage.
- For local dev: see options below.

| Local dev scenario | How |
|---|---|
| Fresh DB (no data) | Run `db/migrations/002_add_operation_schemas.sql` → open app with `DATA_BACKEND=blob` → login → DEFAULT_* seeds localStorage → save pushes to Postgres |
| With snapshot | Restore a dump via `pg_restore` → `DATA_BACKEND=relational` → login loads all data into localStorage |
| Live prod data | Point `DATABASE_URL` at the Railway DB ⚠ writes affect prod |

The dump is NOT just for manual inspection — with `DATA_BACKEND=relational` the server calls `relLoad()` on every login, reading all 103 relational tables and assembling the full blob for the client.

Key default constants (grep for line): `DEFAULT_ROUTES`, `DEFAULT_BOATS`, `FL_DEFAULT_ENGINES`, `FL_DEFAULT_GEARBOXES`, `FL_DEFAULT_PROPELLERS`, `FL_DEFAULT_MAINTENANCE`, `FL_DEFAULT_INCIDENTS`, `FL_DEFAULT_INVENTORY`, `FL_DEFAULT_MEMOS`.

The blob's sub-keys (each maps to relational table(s) on the backend): Sales/Booking — `sb_rate_types`, `sb_pickup_zones`, `sb_pickup_areas`, `sb_pickup_time_profiles`, `agent_artifacts`, `sb_bookings`, `sb_seat_locks`, `sb_nationalities`, `sb_markets`, `sb_sales`, `sb_addon_types`, `sb_agents`, `sb_market_stats`, `sb_invoices`, `sb_payments`, `sb_deposits`; Fleet — `fleet_inventory`, `fleet_consumable_logs`, `fleet_fuelbudget`, `vanjob_*` (`vanjob_pickup_th`, `vanjob_sreq`, `vanjob_driver`). The blob is shared by `save()` (operations) AND `flSave()` (fleet) — **always read-modify-write** (parse → update only your keys → write back); never clobber.

⚠ **Version counter is `allotment.app_state`.** Role `allotment_app` has `search_path=allotment, public`; `server.js` queries `app_state`/`users`/`attachments` UNQUALIFIED. `public.app_state` is DEAD on prod. A local test server run as the `postgres` role writes `public` instead (harmless, but clean up).

⚠ **Set `SESSION_SECRET` on Railway** so re-logins are predictable (daily + on deploy). If unset, every redeploy invalidates all sessions. Session/expiry changes only affect NEW logins.

⚠ **Load conditions matter.** `sb_bookings`, `sb_agents`, etc. must be loaded with `Array.isArray(...)` (accepts an empty array so a deliberately-cleared list stays cleared and doesn't revert to seed). A key that's persisted but never loaded = data vanishes on refresh (this bit `sb_bookings` historically).

**Back-fill migration pattern (important):** `FL_DEFAULT_*` only seeds when the persisted array is empty, so items *appended* to a default list never reach already-seeded rows. When adding to a default list, also add an **idempotent merge in `flLoad`** that pushes only the missing ids. Reuse this pattern for every future default-list addition.

**Backups:** HTML → `cp` to `BACKUP/allotment_v2_<YYYYMMDD>_<desc>.html` before any significant edit; server → `server.js.bak_<YYYYMMDD>_<desc>`. Prefer local-server E2E against the live DB using scratch records (`zz_test_*`, create→patch→delete, verify residue 0) over touching real data. In-app data → the header **💾 Backup** button into `data_exports/`.

`FLEET_VERSION='fleet_v34'` · `DATA_VERSION='2026o'` · `LS_KEY='loveandaman_v2'`. Bump `FLEET_VERSION` + add migration in `flLoad()` for structural fleet changes (version whitelist accepts `fleet_v2`→`fleet_v34`).

---

## 3. Schema reference (verified)

### 3.1 Boat (`DEFAULT_BOATS` / localStorage `boats[]`)
Key fields: `id`, `name`, `type`; location `pier` (home, operational), `homeportCity`/`homeport` (legal registration); capacity `cap` (booking cap), `licensePax` (real registered seats), `totalcap`, `crew`, `engineCount`; specs `material/gt/nt/loa/beam/depth/bhp`; legal `reg/callsign/owner/ownerAddr/docs[]`; and a **status `log[]`** whose LAST entry is the current status: `{s:'available'|'fixing'|'unavailable', from, to(null=ongoing), loc?, note?, reason?}`.

**Location disambiguation:** "อยู่ท่าไหน" (operational) → `pier`; "ตอนนี้อยู่ที่ไหนจริง" → `log[last].loc` else `pier`; "จดทะเบียนจังหวัดอะไร" → `homeportCity`. When quoting boat data, say which field you're using.

**Pier enum (exact — don't guess from UI labels):** `tublamu` (Tub Lamu, Similan/Surin), `panwa` (Visit Panwa, Phi Phi). Planned: `ranong`. ❌ Never `visitpanwa` / `"Tub Lamu"` / `"Visit Panwa"` — breaks UI grouping. Before assigning any enum string, list current values first: `[...new Set(d.boats.map(b=>b.field))]`.

**Boat Status UI groups into 3 tabs by (pier + status):** Tub Lamu = `pier==='tublamu' && last.s!=='fixing'`; Visit Panwa = `pier==='panwa' && last.s!=='fixing'`; In Shop = `last.s==='fixing'` (any pier).

**Engine/gearbox/propeller positions:** `Port · C.Port · Center · C.Std · Std` (Suzuki "Starboard" ≡ "Std"). Normalize via `flPosLabel`/`flPosRank`. Link invariants: 1 engine = 1 gearbox = 1 propeller; a `spare` part must be detached (`engineId`/`gearboxId` nulled).

### 3.2 Rate Type (`SB_RATE_TYPES` — Sales/B2B, grep ~line 26210)
Reusable price packages bound to agents via `agent.rateTypeId`. Shape: `{id, code, name, active, routes[], seatRates{route:{zone:{paxType:price}}}, routeValidity{route:{from,to}} (source of truth for active period), routeBundles{route:{longtail:{mode:'free'|'paid',adult,child}}} (forced add-on baked into seat price), charterRates{route:{boatType:{starterPrice,starterIncludes,extraPerPax}}}, addOns{longtail:{applies[],byRoute{route:{join:{adult,child},charter:{price,capacity}}}}, privateTransfer{...}}}`. Zones: `PK` (Phuket), `KL` (Khao Lak), `NoTransfer`.

- **Longtail is per-route** (`byRoute`); read via `_rtNormalizeLongtail` / `_rtLongtailForRoute(rt,routeId)` (migrates old flat shape).
- **Add-on types are data-driven:** `RT_ADDON_DEFS` (rebuilt by `rtRebuildAddonDefs` = `RT_ADDON_BUILTIN` + UI-created `SB_ADDON_TYPES`) is the single source of truth. To add a code-level type: push one object into `RT_ADDON_BUILTIN` + write its `_rtAddon{Detail,Edit,Contract,Summary,Init}_<key>` fns → it cascades to the Rate Type page, Agent Pricing tab, edit modal, contract PDF, and preview.
- **Persist** with `rtPersist()` (read-modify-write). Shared detail renderer `rtBuildDetailBody(rt)` feeds both the Rate Type page and the Agent Pricing Matrix tab.

### 3.3 Zone/region expansion
Piers, rate-type zones, pickup zones, and pickup-setup areas are 4 overlapping "where" concepts stored separately; adding a real new zone touches ~5–6 places. Decision (2026-06-01, Option A): don't refactor to a central `SB_ZONES` until 2+ zones land at once or non-technical staff need UI zone CRUD. Until then follow the manual checklist — see CHANGELOG §12 / `SYSTEM_MAP.md`. (Pickup Setup UI adds **Areas** only, not zones; zones are hardcoded `['PK','KL','NoTransfer']`.)

### 3.4 Booking (`SB_BOOKINGS`)
Key fields: `id`, `schemaVer`, `agentId`, `channel`, `leadPax`, `leadNationality`, `leadPhone`, `leadEmail`, `hotelName`, `pickupAreaId`, `status` (`confirmed`/`pending_approval`/`cancelled`/`cancelled_weather`/`rejected`), `bookingDate`, `voucherRef`, `trips[]`, `passengers[]`, `addOns[]`, `adjustments[]`, `priceBreakdown{seat,addOn,focDiscount,discount,extra,total}`, `paymentSnapshot`, `marketSnapshot`, `history[]`, `ops{boatId,vanId,vanGroup,vanSeq,vanReturnId,vanSplits[],pfm{}}`.

- Cancelled statuses excluded from every aggregate: `['cancelled','cancelled_weather','rejected']`.
- `trip` shape: `{routeId, date, bookingMode:'seat'|'charter', pax:{ad_fr,ad_th,chd_fr,chd_th,inf_fr,inf_th,foc}, charterBoatId?, charterPriceMode?, lockDrawSel{}, seatSource{locked,general}}`.
- Edit preserve: `bkV2CommitBooking` rebuilds a fresh object — the `if(editing)` block MUST carry over `ops`, `upgrades`, `feeItems`, `reschedule`, `partialCancels`, `cancellation`, `cancelCategory`, `history`, `weatherResolve`, `rebook`, `invoiceId`, `paymentStatus`. Miss one = that data wiped on every edit.

### 3.5 Agent (`SB_AGENTS`)
Key fields: `id`, `name`, `code`, `companyInfo{legalName,taxId,address}`, `contact{name,phone,email}`, `rateTypeId`, `market`, `sales` (links to `SB_SALES` id), `payType` (`invoice`/`proforma`/`cash`), `vatMode` (`none`/`exclude`/`include`), `creditLimit`, `contractVersion`. Persisted by `sbAgentsPersist()`. Load condition `Array.isArray(d.sb_agents)` — an empty array keeps the list cleared (does NOT revert to seed).

---

## 4. Safety rules

- **Back up first** for any edit touching `DEFAULT_*`/`FL_DEFAULT_*`, `flLoad()`/`save()`/`flSave()`, any localStorage logic, or >~50 lines.
- **Don't break structure:** don't rename/delete existing fields (mark inactive instead), don't change the `loveandaman_v2` schema, always read-modify-write `LS_KEY`. Add new fields as optional with defaults.
- **Verify enum values** before assigning unknown strings (see pier example above).
- **Keep data fixes user-triggered.** Don't add new auto-mutations to `flLoad` that could wrongly rewrite legitimate data (an over-eager spare-detach / dedupe self-heal was removed for this reason). The existing self-heals (engine status, boat stuck-fixing, charter-boat mirror, van-group `vanId`) are deliberately idempotent and targeted — match that bar or don't add one.
- **Preserve runtime safety systems:** `flLoad()` auto-snapshot + `flListSnapshots()`/`flRestoreSnapshot(N)`, defensive field-level merge, version whitelist.
- **Browser must run via localhost, not `file://`.** Double-click `start_server.command` → open `http://localhost:8765/allotment_v2.html`, ONE tab only. `file://` breaks localStorage persistence and local `fetch()`. Never test in the Claude artifact preview (isolated storage).

---

## 5. Working with the file, look & feel, comms

- File is huge — never read it whole. `grep -n` to locate → read a 30–50 line window → targeted `str_replace` with unique surrounding context → re-read only the changed section. Verify with `node --check` on the extracted `<script>`.
- **Visual system:** DM Sans body / DM Mono for numbers; brand accent recolored coral→**Ocean blue `#1683C7`** via the reversible `<style id="softui-ocean-skin">` block. Most re-skins are single reversible `<style id="...-skin">` blocks before `</head>` — delete the block to revert. **No Tabler webfont in the app** — icons are inline SVG.
- **Comms:** concise, show snippets, ask before big refactors, remind about backups before core-data edits, state the diff after edits (e.g. "added 3 entries to `FL_DEFAULT_ENGINES` at line 3045").

---

## 6. Gotchas & recurring patterns (distilled from the §-history)

These bite repeatedly. Read the relevant one before touching that area; full context is in CHANGELOG.md.

**JS / render**
- **`esc` / `escapeHTML` is NOT global** — it's declared locally per function. Any new top-level render fn that builds HTML with `esc(...)` must declare its own `const esc=...` or it throws silently on click.
- **Timezone:** build `YYYY-MM-DD` with `bkV2LocalYMD(dt)`, never `toISOString().slice(0,10)` (UTC shift breaks +07:00 date stepping).
- **Scroll-jump on re-render:** replacing a mount's `innerHTML` while the focused element (a button/input) lives inside it makes the browser scroll to top. Fix = **surgical update** of just the changed sub-region (extract an inner-render fn, update only `#...-list`/`#...-body`/count badge), or capture+restore `scrollTop`/`window.scrollY` and blur first. Hit in withdraw parts, fleet asset lists, doc-check.
- **`backdrop-filter` creates a stacking context** that traps typeahead dropdowns ("ซ้อนกัน"). Keep it off form-body cards that contain dropdowns; use a translucent bg only there.
- **Sticky-header offsets** read CSS vars `--topbar` / `--t2-vangroup-top` (auto-computed in the `bkV2Render` rAF) — never hardcode `52`.

**Booking / edit**
- **Edit-preserve block in `bkV2CommitBooking`:** editing rebuilds a fresh `newBk`, so the `if(editing){...}` block must carry over `ops` (boat/van assignment!), `upgrades`, `feeItems`, `reschedule`, `partialCancels`, `cancellation`, `cancelCategory` — plus `history`/`weatherResolve`/`rebook`/`invoiceId`/`paymentStatus`. Miss one and that data is wiped on every edit. (`SB_EXTRAS` is a separate store, unaffected.)
- **Cancelled statuses** are excluded from every pax/revenue/count aggregate: `['cancelled','cancelled_weather','rejected']`.
- **Capacity model:** `boat.cap` = booking cap; `boat.licensePax` = real seats. Over cap → `status:'pending_approval'` (approval queue); over license → hard block. Boat-assign tolerance = `cap+2` (`BA_CAP_TOL`).

**Seat locks**
- Locks reduce the sellable pool (`getAllotment` subtracts `lockedSeats`). Anti-overbook guard in `bkV2CommitBooking`: would-eat-locked-seats → **hard block**; true physical oversell → soft confirm. A booking can never silently consume locked seats.
- Parent/sub-group locks: `bkV2LockPoolHold` counts the hold at parent/standalone level only (child → 0) to avoid double-counting. Month locks use a rolling per-trip release (`releaseDaysBefore`/`releaseTime`), not a single global expiry — don't let a stale `expiry` carry onto a month lock.

**Vans / boats**
- **Van group = one outbound van by design; return van is per-booking.** Disband must null both `vanId` and `vanReturnId`; `bkV2VanGroupHeal` reconciles `vanId` only and must NOT spread `vanReturnId` across a group. Never auto-pick a van (`ห้ามเดา`) — detect and surface "รถปนกัน" conflicts instead.
- **Charter boats are excluded from the seat pool.** `baCharterBoatIds(date)` / `baDayBoats(date)` filter them out; `getSeatsConsumed` excludes `bookingMode==='charter'`; `bkV2CharterBoatHeal` mirrors `trip.charterBoatId`→`ops.boatId`. Availability only drops if the charter reserves its boat in Boat-Op `TRIPS`.
- Van/return job orders + per-date partner driver/phone/plate overrides live in `VANJOB_DRIVER[date::vanId]`; self-arrive pickup (`bk.pickupSelf`) and self-return drop-off (`bkV2RetInfo().selfRet`) drop a booking from the van job orders without changing the rate.

**Fleet**
- **Engine hours = `baseHours + (latest − first Daily-Log meter reading)`, skipping readings ≤ 0** (a `0` placeholder entry otherwise blows the total up). Service cycle = countdown vs `lastServiceHours`; reset it at maintenance-job close (`flMaintServiceReset`) or via the engine/gearbox detail button.
- **Per-asset maintenance cost** = job cost ÷ count of same-type assets on the job (`flMaintCostShare`), applied ONLY on the Engine/Gearbox/Propeller detail pages. Job / boat / project / dashboard totals still count each job once.
- **Engine swap:** the engine is the swappable unit; gearbox + propeller stay at the boat's drive position (`onBoatId`/`onBoatPos`, "คาเรือ · รอเครื่อง") and the incoming engine adopts them. Repair/store location = the engine's `spareLocation` (syncs with the MJ's `m.location`).

**Docs / assets**
- `assets/hero/<routeId>.jpg` is **shared** (Voucher ticket + Pickup-Setup marketing card) and has marketing text baked in — that's why a per-route `assets/voucher/<routeId>.jpg` override layer exists (rendered on top).
- Doc-Check Pre-Check OCR (Tesseract.js, English) needs network at runtime; images only (PDF → manual). Results cached on `bk.docCheck.pre`; auto-tick only when the user can edit `operations`.

---

## 7. Module map (where things live)

Completed: Agent Info · Add-on Services · Renewal · Rate Types · Contract Document (P5) · Booking v2 (P6: `#view-booking`→`bkV2Render`, tabs cal/bytrip/all/locks/approvals) · Accounting (P7: invoices/payments/deposits/VAT/statements) · Demand/Market Intelligence (P8: `renderMarketData`, immigration `.xls` import, 6 tabs) · Daily PFM (Finexy skin) · Pickup Map (Leaflet) · Insurance · FOC Detail · Booking Flow · Consumable requisition · Fuel Intelligence.

Fleet: Boat Operation (`renderOp`), Transfer Fleet (`renderVehicles`), Van Job Orders (`renderVanJobs`), Pickup Setup (`renderPickupSetup`), Maintenance/Incidents/Engines/Gearboxes/Propellers/Projects.

Sidebar groups: OPERATIONS (Booking · Boat Operation · Transfer Fleet · Van Jobs · Pickup time setup) · SALES (Agent List · Rate Types · B2C · Staff & Welfare · Demand · FOC Detail · Insurance · Booking Flow · Pickup Map) · ACCOUNTING & FINANCE (Accounting · Daily PFM) · Fleet Management · Overview · Config.

*Full per-feature history (§13–§87) is in **CHANGELOG.md** — grep it for the reasoning behind any specific behavior.*
