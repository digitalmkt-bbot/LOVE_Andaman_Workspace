# LOVE Andaman — allotment_v2 · branch `main`

> Context file, loaded every session. This file describes the production `main` branch only. `lk-inbox` (the monolith that serves staff at `rsvn.loveandaman.com`) has its own CLAUDE.md — nothing about `lk-inbox`'s deploy, database or `server.js` applies here.

## 0. What main is

**The staff app moving onto [`operation_backend`](https://github.com/TheTaTha5/operation_backend).** There is **no `server.js`** here (deleted 2026-10-12). Railway runs `static-server.js`: static files + `GET /health`, nothing else. All data goes from the browser straight to operation-backend. **Any `/api/*` call still in `allotment_v2/js/` is a 404** — rewire it to operation-backend, never revive a legacy endpoint.

- **End goal:** the frontend is a display client. Data and business rules belong on operation-backend; judge a change by how much browser logic it lets us delete.
- **Production frontend:** `loveandamanworkspace-pano-frontend-production.up.railway.app`. Railway auto-deploys `main`, so **`git push origin main` is a production release** — staff see it minutes later. Treat every push as shipping: `git fetch` first, `node --check` + tests, bump `?v=`, then verify `git ls-remote origin refs/heads/main` equals `git rev-parse HEAD`.
- **operation-backend:** code at `D:/projects/operation-backend`, deployed at `operationbackend-production.up.railway.app`. The client's base URL is `LA_CFG.opsBackend` (default that URL, `01-auth-sync.js`).
- **Cutover to-do list:** `D:/projects/operation-backend/docs/readiness-2026-10-12-en.md`.

**Does the server have endpoint X? Grep, don't trust docs.** `grep -rn "'/v1/…\|'/operations/…" D:/projects/operation-backend/src/routes/*.ts` on `main` is the only answer. Plans and handoff notes have been wrong about this before (a plan marked van jobs "BLOCKED" while `/operations/van-jobs` was already on `main`). If a documented route 404s on Railway, the deploy may be stale — see the infra note below — not unimplemented.

**Known infra gotcha (2026-09-15/16):** the `operation_backend` Postgres service on Railway (project `ERP_LOVEANDAMAN`, "Main Postgres Database") picked up `operation_backend`'s own `railway.json` (`preDeployCommand: node dist/migrate.js`) and crash-looped, silently blocking every operation-backend deploy. Railway Config-as-Code has no per-service scoping; the fix was disconnecting that service's config-as-code path in the dashboard. If `operationbackend-production` looks stuck on an old build, check this first.

**DB changes:** this frontend has no database of its own. Schema changes go in operation-backend's `migrations/`. The `lk-inbox` DB freeze (until 2026-10-15) does not cover operation-backend, but its hook (`tools/db-freeze.mjs` via `.claude/settings.json`) still trips on DDL text in Bash/Edit — that is a false positive here. `db/` and `os-backend/` in this tree belong to `lk-inbox` and nothing here uses them.

## 1. How the client talks to operation-backend

- **Login:** `POST /v1/login` `{username,password}` → bearer token in `sessionStorage` (`la_ops_token`). `window.laOpsFetch(path, opts)` attaches it and sends the user back to login on 401.
- **`allotment_v2/js/ops/*.js`** — one adapter per area (catalogue, agents, rate types, contracts, pickup, fleet, money, PFM, park, vans, day actions, reconfirm, bookings, availability, dashboard, changes, …), loaded after `js/booking/*.js` and before `11-router.js`. Each **wraps the legacy global function** by name: `wrap('bookingV2Foo', fn)` replaces `window.bookingV2Foo`, falls back to the original only when `laOps.enabled()` is false. The `onclick=` handlers keep calling the same names.
- **`ops/00-ops-core.js` = `window.laOps`**, the shared plumbing:
  - `get/post/patch/del/call` — JSON in/out; a refusal throws `LaOpsError` with the server's `{statusCode, message, code}`.
  - `bookingWrite` — booking writes send `If-Match: "<opsVersion>"`; a `409 stale_version` reloads that booking. Day-of writes (trip-ops, check-in, van groups/stops, doc check, reconfirm) do **not** use it.
  - `queue(fn)` — one write at a time, in order. Never call `queue()` from inside a queued fn (deadlock).
  - `runBatch(ops)` — several calls as a unit, best-effort undo on failure.
  - `fail(title, e)` — the server's message as a red toast.
- **Server first:** a write the server refuses must not stay on screen. Ask the server, then change local state; bulk writers snapshot → run → restore on refusal.
- **`409` with a `*_anyway` code** = legacy's "do it anyway" dialog: show it, resend with the flag. Pattern: `ops/10-ops-catalogue.js` (`close_anyway`).
- **Use the server's own computed views** (`/operations/van-jobs`, `/van-board`, `/v1/quote`, …) instead of rebuilding them in the browser.
- **Not wired yet** (still local-only or still calling `/api/*`): see the readiness doc. Check `js/ops/` before assuming either way.

## 2. The frontend files

`allotment_v2/allotment_v2.html` (markup) plus classic `<script src>` files in load order: `js/01..11-*.js` (~80k lines; `08-app.js` alone ~47k), `js/booking/` (~650 one-function files lifted out of `08-app.js`), `js/ops/`. **One global scope, ~2,500 inline `onclick=` handlers calling functions by name.** Read `allotment_v2/js/README.md` before touching script tags: `defer`, `async`, `type="module"` or reordering breaks every handler. `js/10-embed.js` must stay the first script in `<head>`. Cloudflare **Rocket Loader must stay off** (same breakage, looks like a permissions bug).

```
LOVE_Andaman_Workspace/
├── static-server.js           ← the Railway service: files + /health, no API
├── railway.json · package.json · .railwayignore
├── allotment_v2/
│   ├── allotment_v2.html
│   ├── js/01..11-*.js         ← legacy app code, global scope
│   ├── js/booking/            ← bookingV2* functions, one per file
│   ├── js/ops/                ← operation-backend adapters (§1)
│   ├── css/01-base.css · 02-skins.css (14 re-skin layers)
│   ├── docs/workflows/        ← per-domain legacy behaviour docs (see ARCHITECTURE.md)
│   └── assets/
├── b2c-map.js · b2c-changelog.js  ← legacy B2C import rules, kept as reference for porting
├── test/unit/                 ← `node --test test/unit/` (ops-* adapter tests)
├── test/ui/                   ← Playwright UI tests (`npm run test:ops`, …)
└── tools/                     ← js-split-linemap, build-assets, …
```

**Local dev:** `npm start` (`static-server.js`) or `allotment_v2/start_server.command`, then point it at an operation-backend. Never open via `file://`, never test in the Claude artifact preview.

**After editing:** `node --check` each touched file; bump the `?v=` cache-bust on any changed js/css (`static-server.js` caches them for a year as `immutable`).

**Language:** Thai + English UI is fine, but use **English/ASCII in `alert()`, `console.log()` and new hooks**.

---

## 3. Browser object shapes

The browser still holds data in these shapes (adapters map them to and from the server's). Server-side shapes: read operation-backend's `src/routes/openapi.ts` / route handlers.

### 3.1 Boat (`DEFAULT_BOATS` / `boats[]`)
Key fields: `id`, `name`, `type`; `pier` (home, operational), `homeportCity`/`homeport` (legal registration); `cap` (booking cap), `licensePax` (real registered seats), `totalcap`, `crew`, `engineCount`; specs `material/gt/nt/loa/beam/depth/bhp`; legal `reg/callsign/owner/ownerAddr/docs[]`; status `log[]` whose LAST entry is current: `{s:'available'|'fixing'|'unavailable', from, to(null=ongoing), loc?, note?, reason?}`.

**Location:** "อยู่ท่าไหน" → `pier`; "ตอนนี้อยู่ที่ไหนจริง" → `log[last].loc` else `pier`; "จดทะเบียนจังหวัดอะไร" → `homeportCity`. Say which field you used.

**Pier enum (exact):** `tublamu` (Similan/Surin), `panwa` (Phi Phi), `ranong` (Myanmar day trips, Grand Andaman Pier). ❌ Never `visitpanwa` / `"Tub Lamu"` / `"Visit Panwa"`. List current values before assigning any enum string.

**Engine/gearbox/propeller positions:** `Port · C.Port · Center · C.Std · Std` (Suzuki "Starboard" ≡ "Std"); normalize via `flPosLabel`/`flPosRank`. 1 engine = 1 gearbox = 1 propeller; a `spare` part is detached (`engineId`/`gearboxId` null).

### 3.2 Rate Type (`SB_RATE_TYPES`)
`{id, code, name, active, routes[], seatRates{route:{zone:{paxType:price}}}, routeValidity{route:{from,to}}, routeBundles{route:{longtail:{mode:'free'|'paid',adult,child}}}, charterRates{route:{boatType:{starterPrice,starterIncludes,extraPerPax}}}, addOns{longtail:{applies[],byRoute{…}}, privateTransfer{…}}}`. Zones: `PK`, `KL`, `NoTransfer` (server also accepts `RN`). Longtail is per-route (`_rtLongtailForRoute`). Add-on types are data-driven: `RT_ADDON_DEFS` = `RT_ADDON_BUILTIN` + `SB_ADDON_TYPES`.

### 3.3 Booking (`SB_BOOKINGS`)
Key fields: `id`, `opsId` (server id), `opsVersion`, `agentId`, `channel`, `leadPax`, `leadNationality`, `leadPhone`, `leadEmail`, `hotelName`, `pickupAreaId`, `status` (`confirmed`/`pending_approval`/`cancelled`/`cancelled_weather`/`rejected`), `bookingDate`, `voucherRef`, `trips[]`, `passengers[]`, `addOns[]`, `adjustments[]`, `priceBreakdown{…}`, `paymentSnapshot`, `history[]`, `ops{boatId,vanId,vanGroup,vanSeq,vanReturnId,vanSplits[],pfm{}}`.
- `trip`: `{routeId, date, bookingMode:'seat'|'charter', pax:{ad_fr,ad_th,chd_fr,chd_th,inf_fr,inf_th,foc}, charterBoatId?, lockDrawSel{}, seatSource{locked,general}}`.
- Cancelled statuses are excluded from every aggregate: `['cancelled','cancelled_weather','rejected']`.
- `bookingV2CommitBooking` rebuilds a fresh object on edit — its `if(editing)` block must carry over `ops`, `opsId`, `opsVersion`, `upgrades`, `feeItems`, `reschedule`, `partialCancels`, `cancellation`, `cancelCategory`, `history`, `weatherResolve`, `rebook`, `invoiceId`, `paymentStatus`.

### 3.4 Agent (`SB_AGENTS`)
`id`, `name`, `code`, `companyInfo{legalName,taxId,address}`, `contact{name,phone,email}`, `rateTypeId`, `market`, `sales` (→ `SB_SALES`), `payType` (`invoice`/`proforma`/`cash`), `vatMode` (`none`/`exclude`/`include`), `creditLimit`, `contractVersion`.

---

## 4. Working with the files

- Never read a big file whole: `grep -rn` over `allotment_v2/js/` → read a 30–50 line window → targeted edit → `node --check`.
- Line citations from before 2026-08-27 (`bookingV2InferZone:69054`, …) point into the pre-split HTML: `node tools/js-split-linemap.mjs 69054`, or grep the function name.
- **Visual system:** DM Sans / DM Mono for numbers; accent Ocean blue `#1683C7` (`softui-ocean-skin`). Each skin in `css/02-skins.css` sits behind a `/* ==== <id> ==== */` marker — delete the section to revert it. Icons are inline SVG, no Tabler webfont.
- **Comms:** concise, show snippets, state the diff after edits.

## 5. Gotchas

**JS / render**
- `esc` / `escapeHTML` is **not global** — declare a local `const esc=…` in any new render fn.
- Build `YYYY-MM-DD` with `bookingV2LocalYMD(dt)`, never `toISOString().slice(0,10)` (+07:00 shift).
- Replacing a mount's `innerHTML` while focus is inside it scrolls to top — update only the changed sub-region, or save/restore scroll and blur first.
- `backdrop-filter` makes a stacking context that traps typeahead dropdowns — keep it off form cards with dropdowns.
- Sticky offsets read `--topbar` / `--t2-vangroup-top` — never hardcode `52`.

**Legacy business rules still in the browser** (being ported to the server — check `todo/legacy-browser-rules.md` in operation-backend before re-implementing one client-side)
- Capacity: `boat.cap` = booking cap, `boat.licensePax` = real seats. Over cap → `pending_approval`; over licence → hard block. Boat-assign tolerance `cap+2` (`BA_CAP_TOL`).
- Seat locks reduce the sellable pool; a booking may never silently consume locked seats. Sub-group holds count at parent level only (`bookingV2LockPoolHold`). Month locks release per trip (`releaseDaysBefore`/`releaseTime`).
- Van group = one outbound van; return van is per booking/part. Never auto-pick a van (`ห้ามเดา`) — surface "รถปนกัน" conflicts instead.
- Charter boats are out of the seat pool (`baCharterBoatIds`, `getSeatsConsumed` skips `bookingMode==='charter'`).
- Self-arrive pickup (`bk.pickupSelf`) and self-return (`bookingV2RetInfo().selfRet`) drop a booking from van job orders without changing the rate.
- Engine hours = `baseHours + (latest − first Daily-Log reading)`, skipping readings ≤ 0. Per-asset maintenance cost = job cost ÷ same-type assets on the job, only on asset detail pages.
- `assets/hero/<routeId>.jpg` is shared (voucher + pickup card); `assets/voucher/<routeId>.jpg` overrides it on the voucher.

## 6. Module map

Booking v2 (`#view-booking` → `bookingV2Render`, tabs cal/bytrip/all/locks/approvals) · Agent Info · Rate Types · Contracts · Add-on Services · Accounting (invoices/payments/deposits/VAT/statements) · Demand/Market (`renderMarketData`) · Daily PFM · Pickup Map · Insurance · FOC Detail · Booking Flow.

Fleet: Boat Operation (`renderOp`), Transfer Fleet (`renderVehicles`), Van Job Orders / ใบงานรถ (`renderVanJobs`), Pickup Setup (`renderPickupSetup`), Maintenance / Incidents / Engines / Gearboxes / Propellers / Projects.

Per-domain legacy behaviour: `allotment_v2/docs/workflows/` (map in `ARCHITECTURE.md`). These describe how the legacy browser behaves, not how operation-backend works.
