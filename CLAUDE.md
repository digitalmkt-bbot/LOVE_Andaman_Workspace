# LOVE Andaman — allotment_v2

> Context file for Claude Cowork. Loaded automatically every session.
> Focus: allotment_v2 module only.

## 0. START HERE (read this first · new-chat orientation)

**What this is:** one giant single-file web app `allotment_v2/allotment_v2.html` (~4MB) for LOVE Andaman (Phuket marine tours). Runs on Railway. A **logged-in prod Chrome tab already exists** — use the Claude-in-Chrome tools to query live `SB_BOOKINGS` etc. to verify any data claim before asserting.

**How to start a new chat (do this, in order):**
1. **Do NOT dump the changelog back at the user or re-read the whole file.** The §-log below is reference only — skim for the relevant section when a task needs it.
2. **Greet in Thai and ask what to work on now.** The user (RM@loveandaman.com) speaks Thai; keep replies concise (their stated preference).
3. When given a task: find the relevant function with `grep`, read a small window, make a targeted `Edit`, then verify.

**Deploy workflow (CRITICAL — the sandbox CANNOT git-push):**
- Edit the file → extract the main `<script>` and run `node --check` to verify syntax → back up to `BACKUP/`.
- Commit + push ONLY through **GitHub Desktop via the computer-use tools**: bring GitHub Desktop to front → if on `main`, switch to branch **`backend-db-implementation`** (bring changes along) → type a Summary → Commit → **Push origin** → switch to `main` → Branch menu ▸ **Merge into Current Branch** ▸ pick `backend-db-implementation` ▸ Create a merge commit → **Push origin**.
- Verify the push landed: `git ls-remote origin refs/heads/main` must equal `git rev-parse main` (run via the bash tool).
- Prod auto-deploys from `main` (~1–2 min). `backend-db-implementation` = dev branch (Railway relational-backend work; see `HANDOFF_2026-07-04.md`).

**Pending (not yet done):** move the Booking top-tab bar onto the same row as the date stepper — user asked to see 3 mockups (A = merge tabs+date into one row · B = same but tabs live in the day-header · C = keep 2 rows, tighten). Awaiting the user's pick.

> Last updated: 2026-07-09 (§105 LK Inbox · Phase 1 (branch `lk-inbox`, NOT merged/deployed) — import love_kingdom (พี่ซัน's B2C system · schema `love_kingdom` in the SAME Postgres) bookings into the operation system as prefilled New-Booking drafts. Design: lk stays untouched (read-only pull); ops staff complete the 4 fields lk doesn't capture (pickup zone/area · guide language · nationality · Thai/foreign pax split per type) in the normal form → `bkV2CommitBooking` validation is the gatekeeper. Pieces: (1) `os-backend/scripts/add_lk_inbox_2026_07.js` (idempotent · ALREADY RUN on live DB): adds state key **`lk_product_map`** ({lkProductId→osRouteId} · key-value map table via the topJsonMap whitelist pattern → auto-covered by the REST index) + `GRANT SELECT ON love_kingdom.bookings/booking_items/customers TO allotment_app` + grants on the new table (grants are per-table in this DB, no default ACL). (2) `server.js` **`GET /api/lk/bookings`** (session-req · read-only · joins customers · only `day_trip`+`private_own` items · `details->>'pickupLocation'` surfaced · hotel-only bookings filtered out). (3) new OPERATIONS sidebar view **"LK Inbox"** (`data-view="lkinbox"` → `#lkinbox-host` → `renderLkInbox()`, module before `renderInsurance`): product→route mapping panel (one `<select>` per distinct lk product · `lkMapSet` persists read-modify-write) + booking cards + **นำเข้า → New Booking** (`lkImport`: `bkV2NewBooking()` then overrides lead/phone/email/nat (`_lkNatCode` name→code)/notes/`voucherRef='LK:<id>'` (=dedupe key, `lkFindImported`) + one trip per item — route from map, **Thai-first pax split heuristic** `_lkSplitPax` (lk has only age totals + th/fr totals, no cross matrix), `private_own`→`bookingMode:'charter'`). Imported cards show "✓ Imported · <bkId>" → opens the booking detail. Verified: `node --check` server + 8 script blocks · wiring 1/1/1 · E2E local server (401 unauth · 3 bookings w/ items · `SET ROLE allotment_app` can read lk + map table). Phase 2 ideas (not built): lk availability check, cancel write-back. §104 Per-entity sync · `op:'patch'` (per-FIELD record merge) — closes the last blob-write gap. Context: prod (Railway env `dev`, branch `backend-db-implementation`, `DATA_BACKEND=relational`) already saves per-entity via `/api/v1/_batch` (frontend `laDiffToOps` line ~72 translates the record diff into put/del/putall/meta ops); the legacy whole-blob `/api/save` (`relApplyAndSave` DELETE+INSERT all 103 tables) is only a FALLBACK (seed / unknown key / old server). Gap fixed: an EDITED record was sent as a full-record `put` → last-write-wins on the whole record (2 users editing different fields of the same booking = one lost). Now: (1) **server.js** `restApplyOp` gains `{op:'patch', r, id, body:{m,full}}` — `restLoad(table,id,client)` (new optional client arg → reads see earlier ops in the same txn) → assemble → `applyObj(cur, m)` per-field merge → re-put; record missing/not-object → `body.full` full-replace fallback; no full → error (client falls back to legacy). `_batch` op-shape validation + the two error→400 regexes updated. (2) **allotment_v2.html** `laDiffToOps` sends `patch` ops (m + full) instead of full `put` for `c.patch` entries (and no longer aborts to legacy when the record is missing client-side). (3) **visibility**: relational `/api/save` now `console.warn`s '[save] LEGACY whole-blob path · user · diff keys' → Railway logs reveal mapping drift. Verified: `node --check` server + extracted app script OK · E2E on a LOCAL server (PORT 3999) against the live DB using scratch records (`zz_test_*`, created→patched→deleted, residue 0): per-field merge preserved a simulated concurrent edit (patch total=150 kept the other user's seller='B') · missing-record full-fallback created · map-resource (nat_learn JSON value) patch merged · cleanup batch OK. Drift check: live blob (51 keys · 3.66MB) = 100% REST-index coverage + lossless round-trip. ⚠ Prod's version counter = **`allotment.app_state`** (role `allotment_app` has `search_path=allotment, public`; server.js queries `app_state`/`users`/`attachments` UNQUALIFIED) — `public.app_state` is dead on this DB; a local test server run as `postgres` role writes public (harmless, cleaned). Backups `server.js.bak_20260709_pre_patch_op` + `BACKUP/allotment_v2_20260709_pre_patch_op.html`. NOT yet committed/deployed. §102 Session · daily reset (per user "ให้ User เด้งออกทุกเช้าเพื่อโหลดข้อมูลสด") — `server.js` login token/cookie expiry changed from rolling `SESS_DAYS*864e5` (30 days) to the **next 03:00 ICT** so every user is logged out each pre-dawn and re-logs in each morning → fresh cloud blob on login. Added `nextDailyExpiry()` (helper after `session()`, `ICT_OFFSET_MS=7h`, `DAILY_RESET_HOUR=3`) computing next 03:00 Asia/Bangkok in UTC ms; login handler now `const EXP=nextDailyExpiry()` for both token `exp` and cookie `Max-Age=Math.max(60,(EXP-now)/1000)`. `SESS_DAYS` now unused (left declared). `node --check server.js` OK + math verified (next expiry 2026-07-09 03:00 ICT). ⚠ Only applies to NEW logins after deploy — existing cookies persist until they expire, UNLESS `SESSION_SECRET` env is unset (then every redeploy already invalidates all sessions). ⚠ Set `SESSION_SECRET` on Railway so re-logins are predictable (daily + on deploy), else tokens die every redeploy. Backup `server.js.bak_20260708_pre_daily_session`. §101 Dashboard "Seats available" widget · 5-tier inverted colors — the month seats-calendar on the Dashboard (~line 4471 `PAL` + line 4478 state logic + legend 4513) still used the OLD scheme (many free = green `Plenty free`, sold out = red `Full`). Flipped to match §99/§100 Calendar: `PAL` now `soldout/t5/t4/t3/t2/t1` = deep-green→red gradient (`#BCE595/#CFE9AC/#E8F5D8/#FAF0C8/#FBE1C6/#FBE9E9`), state picked by **% FULL** (`(cap-free)/cap*100`: `>=80 t5 · >=60 t4 · >=40 t3 · >=20 t2 · <20 t1`, `free<=0 → soldout` deepest green). Legend relabeled to 5 tiers "Full / Selling / Medium / Under-sold / Many free". `none`(closed)/`wx`(weather) palettes unchanged. `node --check` OK. Backup `BACKUP/allotment_v2_20260708_pre_dashcal_5tier.html`. §100 Calendar · removed the "Active Projects this month" ribbon — in `renderCal` the `projRibbon` (built ~line 6161 from `FL_PROJECTS`, the amber PRJ chips strip) was dropped from the compose line 6183 (`wrap.innerHTML = headerBar + kpiStrip + routeStrip + …`, was `+ projRibbon +`). Build block left intact (harmless unused var) so it can be re-added by putting `projRibbon +` back. `node --check` OK. Backup `BACKUP/allotment_v2_20260708_pre_remove_projribbon.html`. §99 Calendar color logic INVERTED (per user) — in `renderCal` the availability colors meant "many seats free = green, almost full = red". User wanted it flipped so GREEN = selling well (few seats free / sold out) and RED = under-sold (many free · team must be aware). `pct` in the cells = % FULL (sold). Changes: (1) `colorFor(pct)`/`bgFor(pct)` = **5-TIER gradient** (refined 2026-07-08 from the first 3-tier 66/33 cut, per user "ปรับ tier เพิ่มอีกนิด"): `pct>=80→FOREST/#CFE9AC deep green · >=60→#3B6D11/LIME_SOFT green · >=40→#8A6A0B/#FAF0C8 yellow · >=20→#B4600F/#FBE1C6 orange · <20→#A32D2D/#FBE9E9 red` (was inverted 3-tier; original pre-invert was `>=95 red · >=70 amber · else green`). (2) `isFull` (0 free = sold out) cells flipped from red→GREEN (text FOREST, bg #BCE595 deepest green to stand out above the >=80 tier) in BOTH the matrix cell (`else` branch) and the month-view chip. (3) per-route AVG strip `TIER` swapped: `high` (many free) → red palette 'Many free · aware', `low` (few free) → green 'Almost full · selling' (mid amber unchanged; tier is picked by free-count value so high-free routes now show red). (4) both legends (Matrix + Month) now show the 5 tiers: "Full / Selling / Medium / Under-sold / Many free" (green→red gradient swatches) + Closed + No trips unchanged. Weather-cancelled (red ⛈) + off-season (amber ⚠) + Closed/No-trips cells untouched. `colorFor`/`bgFor`/`TIER` are local to `renderCal` so nothing else is affected. `node --check` OK (renderCal block). Backup `BACKUP/allotment_v2_20260708_pre_calendar_color_invert.html`. §98 Favicon — the Chrome tab showed the default globe because the app `<head>` had NO `<link rel="icon">`. Built a square brand favicon from the logo emblem (heart/mountain mark auto-cropped from `assets/logo.png` bbox 516,177–932,496 → white knockout via darkness mask, centered on a rounded `#1683C7` square): `assets/favicon.ico` + `favicon-16/32/180.png`. Wired 4 links into `<head>` right after `<title>` (lines 319-322): icon 32/16 png + .ico fallback + apple-touch-icon 180. HTML-only (no JS · script-tag count 11 unchanged). ⚠ **Paths MUST be absolute `/allotment_v2/assets/...`** — the app is served at root `/` (server rewrites `/`→`/allotment_v2/allotment_v2.html` but the browser base stays `/`), so a relative `assets/favicon-32.png` resolves to `/assets/...` → 404 (verified live: `/assets/favicon-32.png`=404, `/allotment_v2/assets/favicon-32.png`=200). First deploy used relative paths → globe stayed; fixed to absolute. ⚠ Chrome caches favicons hard → close+reopen the tab after deploy (reload/Cmd+Shift+R often keeps the old icon). Backup `BACKUP/allotment_v2_20260707_pre_favicon.html`. §97 Booking Calendar · exclude cancelled from pax chips — the month-calendar pax numbers (`bkV2Aggregate`) looked inflated vs By-trip (e.g. 7 Jul showed 96 incl a phantom "Krabi 10" that was 5 CANCELLED bookings; 8 Jul 48 vs real 44). Root: `bkV2Aggregate` looped ALL `SB_BOOKINGS` with no status filter → counted cancelled/rejected pax (+ revenue + booking count). Fix: one guard at the top of the loop `if(['cancelled','cancelled_weather','rejected'].includes(bk.status)) return;` (matches By-trip + `getSeatsConsumed`). Seat-availability "ว่าง" numbers were already correct (separate calc). Verified live: incl-cancel agg reproduced the screenshot exactly (07=96/Krabi10, 08=48, 04=112) while excl-cancel = the real 84/44/107. `node --check` OK. Backup `BACKUP/allotment_v2_20260707_pre_calendar_exclude_cancelled.html`. §96 Agent detail · keep across auto-refresh — the cloud soft-refresh (`_laSoftRefresh`, poll/SSE on others' saves) re-rendered/reloaded the page while a user sat on an open Agent detail, dumping them back to the list ("ต้องเริ่มใหม่"). Root: `_laBusy()` gate didn't treat an open detail as busy, and the full-reload fallback (`_laReloadData` false → `location.reload()`) restored only the view via `_laRestoreView`, not `_agSelected` (which `_laSaveView` never saved). 3 fixes in the auto-refresh IIFE: (1) `_laBusy()` returns true when `_agSelected` is set (guarded `typeof`+try) → auto-refresh defers + shows the "โหลดเลย" banner instead of yanking; (2) `_laSaveView` stores `st.ag=_agSelected`; (3) `_laRestoreView` sets `_agSelected=st.ag` before the nav click when `view==='agents'` → detail reopens even after a hard reload. `node --check` OK. Backup `BACKUP/allotment_v2_20260707_pre_agentdetail_refreshkeep.html`. §95 Booking Flow — new OPERATIONS sidebar item **"Booking Flow"** (`data-view="bookingflow"` · `#view-bookingflow` → `#bookingflow-host` · nav dispatch `renderBookingFlow()` · added right after Booking). Analytics of INCOMING bookings (intake) — distinct from Demand (immigration arrivals). Reads `SB_BOOKINGS` (excl cancelled/rejected). State `_bfMode` (day/week/month · `bfSetMode` full re-render). Helpers inside: `bkDate(b)`=`bookingDate.slice(0,10)`||earliest trip date · `mkOf`=market via `pmMarket`+`sbGetMarket` · `slOf`=sales via `soldBy||agent.sales`+`sbGetSales` · `famOf`=`bkV2RouteFamily`+`getRoute` color · `paxOf`=`bkV2PaxAllTot`. Sections: **KPI×5** (new bookings+MoM · pax · avg lead time · top market · top sales — all for the current bucket) · **stacked intake bars** (per bucket · split by top-4 markets + อื่นๆ · 3-pt moving-avg trend line · SVG string) · **dual line** bookings-in(pax by bookingDate) vs travel(pax by trip date) over today-14..+15 with a วันนี้ marker → shows lead-time offset · **by-sales** hbars · **market mix** + **destination(family) mix** hbars · **travel-date calendar heatmap** (current month · pax departing/day · blue scale · today outlined) · **cohort heatmap** `cohortHTML()` (booking date rows × travel date cols · 14-day×28-day window from today-13 · cell=pax · today column outlined · answers "จองวันไหน→ไปเที่ยววันไหน") · **lead-time histogram** `leadHistSVG()` (days booking→travel · buckets same-day/1-2/3-7/8-14/15-30/30+ · % of all bookings · live prod: 76% book only 1-2 days ahead). Axis weekday labels (Mon/Tue) added on the intake bars (day mode) + dual-line; section headings converted to English. All SVG built as strings (innerHTML · no inline <script> · toggle re-renders). Scoped CSS under `#bookingflow-host .bfw-*`. Ocean theme. Verified `node --check` OK + live prod data check (897 non-cxl bookings · bookingDate 878 · market/family 897 · sales 818 resolve). Backup `BACKUP/allotment_v2_20260705_pre_booking_flow.html`. §94 Insurance blank-nationality root fix (at the booking source) — Insurance page showed named passengers with no nationality because it renders raw booking data and only the LEAD's nationality is normally captured; passengers #2+ were saved without one (and blank-NAME rows are dropped at save). Per user "มีชื่อต้องมีสัญชาติ" — 3 changes in `allotment_v2.html`: (1) **commit now requires nationality for every NAMED passenger** — in `bkV2CommitBooking` after the lead-nat guess, calls `bkV2SyncPassengers()` then for each `d.passengers[i]` with a name, auto-guesses via `bkV2GuessNationality`; any named pax still without a nat → added to `missHard` (hard block, lists "#N name"). UN-named passengers stay optional (filtered out at save · preserves fast lead+counts entry). (2) **continuous learning** — after validation passes, `natLearnRecord(lead)` + each named passenger feeds the `nat_learn` table every save (was one-time `natLearnBootstrap` only) → `bkV2GuessNationality` (learned→script→keyword hints→suffix) gets smarter over time. (3) **Insurance warns missing travelers** — `renderInsurance` computes per-booking expected head count (`bkV2PaxAllTot` of the matching-date trip) vs listed `insBkPax` rows; the shortfall = un-named travelers → new per-trip "missing name" stat + top "ยังไม่กรอกชื่อ" tile (amber `#A05A1A` when >0). Verified `node --check` OK. Backup `BACKUP/allotment_v2_20260705_pre_insurance_nat_require.html`. ⚠ Editing an OLD booking with un-nat'd named pax will now block until filled (intended · fix-at-source). §93 Transfer Fleet matrix · 3 fixes — (1) **vehicle order** the month-matrix/status/registry lists rendered in raw `SB_VEHICLES` array order (backend row order · looked unsorted e.g. Love2·Love3·Love5·Love1…). Added `_vehNameCmp` (natural numeric sort · Love1<Love2<…<Love9<Love10) applied in **`vehBuildGrouped`** to each ownership group + partner sub-groups → stable human order regardless of backend. (2) **sticky header** compacted `#veh-matrix-stickytop` (padding 10/8→6/5 · summary margin-bottom 12→6) + `_vehMatrixSummaryHTML` (title mb 8→4 · cards grid minmax 185→168, gap 8→6, mb 8→5 · card padding 8/12→6/10) so more matrix rows show below. (3) **auto-add junk** the two header "+ เพิ่มรถ" buttons called `vehAdd()` which **immediately pushed a blank vehicle** (name:'' → "(ไม่มีชื่อ)") on every click → accidental junk rows ("รถมั่ว"). Rewired both to `vehSetTab('registry');vehFormOpen()` (proper modal · name required in `vehFormSave`). `vehAdd()` now has no callers (kept for console). Existing blank rows: delete via ทะเบียน tab trash. Verified `node --check` OK. Backup `BACKUP/allotment_v2_20260705_pre_vehmatrix_sort_addfix.html`. §92 Van Job Orders · return-van ("ขากลับ") warning — the hero banner + status only counted OUTBOUND assignment (`unTot`), so a day where a booking still needed a RETURN van showed all-green "จัดครบแล้ว". Added `unRet`/`unRetList`/`unRetByRoute` computed in the `renderVanJobs` booking loop via **`bkV2RetInfo(b).alert`** (separate drop-off · NOT self-return · NOT confirmed "กลับคันเดิม" `sameVan` · no return van). Hero card is now 3-state: outbound-missing (red · unTot wins) → return-missing (**amber `#8A5A1C`** · "↩ ยังไม่จัดรถกลับ · N รถกลับ" + name→drop list) → clear (green). Added an amber "↩ ต้องจัดรถกลับ" bar (mirrors the black "◆ ต้องจัดรถ" bar) listing up to 4 `name → drop-off`, button → By trip date (Van Assign). Verified `node --check` OK. Backup `BACKUP/allotment_v2_20260705_pre_vanjob_return_warn.html`. §91 Sidebar · light-glass reskin + collapse rail — replaced the dark-blue `sidebar-glass-skin` block with a **light frosted-glass** sidebar (floating rounded card `top/left/bottom:14px` · `rgba(255,255,255,.56)` + `backdrop-filter:blur(26px)` · width 250 · `.main` margin-left 274) · nav-item dark slate + **active = solid blue pill `#1683C7`** · `ct-nav-badge` red. Injected (via a small `<script>` right after the style block, on DOMContentLoaded) a **profile header** — avatar initials + "Good day" + `LA_ME.name||username` + a collapse `‹›` toggle. **Collapse rail:** `body.sb-collapsed` + `.sidebar.sb-collapsed` → width 84 · `.main` margin-left 108 · labels hidden via `font-size:0` (no label-wrapping needed · svg fixed-size) · nav-section → thin divider line · badge repositioned to icon corner · profile stacks vertical. State persisted in `localStorage.sb_collapsed` (per-device · not the blob). App background kept WHITE per user (no colorful wallpaper → glass reads as a clean light panel). Verified live on prod (Chrome inject preview): computed geometry correct, both states render, nav clicks + badges intact. Backup `BACKUP/allotment_v2_20260705_pre_glass_sidebar.html`. §90 Rate-Type Bundle · per-route Seat/Charter scope — forced Longtail bundle (`routeBundles[rId].longtail`) leaked onto Charter trips (prep/badge showed "Longtail Join" · quote was already charter-safe). Added `bundle.applyTo` = `'seat'`(default) | `'charter'` | `'both'` + a 3-way "ใช้กับ" toggle in the Rate Type bundle editor (`rtSetBundleApplyTo`). Central gate **`_rtBundleAppliesTo(b, isCharter)`** (default seat) applied at every forced-bundle spot: `bkV2AddOnFlags`, By-trip manifest longtail badge, `bkV2TripSubtotal` (seat gated; **charter branch now adds a per-pax bundle surcharge when applyTo∈{charter,both} & mode=paid, rate-mode only**), New-Booking trip-row badge, `bundledRoutes` (add-on disable), `anyBundled` (add-on skip). Default `'seat'` = existing bundles auto-stop applying to charter (fixes the leak) with NO pricing change unless staff opt-in via the new toggle. Verified `node --check` OK + 8-case logic test. Backup `BACKUP/allotment_v2_20260705_pre_bundle_seatcharter.html`. §89 Insurance passenger review — new OPERATIONS sidebar item **"Insurance"** (`data-view="insurance"` · `#view-insurance` → `#insurance-host` · nav dispatch `renderInsurance()`). Per selected date, lists every passenger of every non-cancelled booking with a trip that day (grouped per trip/route, sorted by booking): **First / Last name** (auto-split from `booking.leadPax`/`passengers[].name` on first space) · **Age** (NOT in booking data → staff enters; blank = red "กรอก") · **Nationality** (from `leadNationality`/`passengers[].nationality` via `bkV2NatDDLabel`). All edits are OVERRIDES stored SEPARATELY in `localStorage.loveandaman_v2.insurance_overrides` keyed `bookingId::(lead|idx)` = `{firstName,lastName,age,nat,reviewed,at}` — **never touches `booking.passengers`**. Helpers: `insEnsure`/`insPersist` (read-modify-write) · `insOv`/`insHas`/`insEff` (override-vs-source) · `insSetField` (stores on input, no re-render → keeps focus, shows purple override dot) · `insToggleReviewed`/`insRevertRow` (re-render) · `insTripsForDate`/`insBkPax`/`insSplitName`/`insNatLabel` · `insDateShift`. Per-trip card shows pax/no-age/reviewed progress; top summary tiles; **`insPrint()`** opens an A4 print sheet (#·First·Last·Age·Nationality per trip). Verified `node --check` OK · wiring 1/1/1 · local escaper (module scope has no global escapeHTML). Backup `BACKUP/allotment_v2_20260704_pre_insurance.html`. §88 FOC Detail → own sidebar view — moved the FOC-detail report OUT of the Demand ⑥ Agents tab (`mdTabAgents`) into a dedicated SALES-group sidebar item **"FOC Detail"** (`data-view="focdetail"` · `#view-focdetail` → `#foc-host` · nav dispatch `renderFocDetail()`). New standalone `function renderFocDetail()` duplicates `mdTabAgents`' setup helpers (SALES/BK/esc/isCancel/paxOf/valOf/fK/pf/sName/FAM_ORDER/famHdr/famCol) + the `A` agent-aggregation, then runs the exact same FOC IIFE (KPI hero + Agent/Staff Top-5 + low-KPI card + per-agent×date×family table) and writes it into `#foc-host`. `mdTabAgents` no longer appends `focDetailHtml` (return ends at `</div>`). Verified: extracted app-script `node --check` OK · renderFocDetail self-contained (has `const A={}`, famCol, valOf, foc-host, the IIFE) · mdTabAgents no longer references focDetailHtml · nav wiring 1/1/1. Backup `BACKUP/allotment_v2_20260704_pre_foc_sidebar.html`. §88b FOC Detail full-width + table redesign — `#foc-host` wrapper `max-width:1240px`→`100%`; the detail table (`renderRec`/thead in the FOC IIFE inside `renderFocDetail`) rebuilt from a 13-col matrix to **4 cols · ONE `<tr>` per agent** (no rowspan): Agent block (name+approved/pending chip+bk tag · sale dot(s)+market pill) · **Trips · program** (per-date lines, program shown as colored `famCol` chip ONLY where FOC>0 — dropped the 5 empty-dot family columns) · FOC amber badge · **performance panel** (bordered 3-cell grid: KPI·FOC share `kpiCol(kp)` green≤8/amber≤20/red>20 with bar + big % · Paying big number · Value green tile). Helper `kpiCol` added before renderRec; `focSecHdr` colspan 13→4. Verified `node --check` OK. Backup `BACKUP/allotment_v2_20260704_pre_foc_table_redesign.html`. §83 Charter boat auto-assign — bug: a Charter booking carries the boat on `trip.charterBoatId` but `ops.boatId` could stay empty (auto/new bookings) → (a) the Boat-Assign "+ assign" picker (seat boats from `baDayBoats`, charter boats EXCLUDED §59) never lists the charter's own boat → can't assign · (b) Daily log `flBoatBookingsFor` keys off `ops.boatId` → charter not counted. FIX: `bkV2CharterBoatHeal(date)` mirrors `trip.charterBoatId`→`ops.boatId` for charter bookings missing it (idempotent · per-booking) · called at top of `bkV2RenderTab2` + `flRenderDR`. Seat-pool exclusion still reads charterBoat||ops so no seat customer can pick it; getSeatsConsumed excludes charter so no double-count. Verified on export (existing charter คุณยศวดี already had ops.boatId=b2 → heal 0). Backup `pre_charter_autoassign.html`. §82 Consumable requisition (เบิกของใช้/น้ำมัน) — new Fleet nav item `fl-consumables` → `renderConsumables()` · withdraw engine oil/filters from central inventory to top-up a boat's engine, SEPARATE from repair jobs. Data: `FL_CONSUMABLE_LOGS` (LS key `fleet_consumable_logs` · loaded in flLoad, saved in flSave) = `[{id,date,itemId,itemName,unit,qty,unitCost,cost,location,boatId,engineId,engineLabel,by,note}]`. Modal `flConsumeOpen` (item→loc/eng repopulate · live cost preview) · `flConsumeSubmit` deducts stock via `invRemoveAt` + pushes a `withdraw` history entry (tagged `consumeId`) + log · `flConsumeDelete` restores qty (`invAddAt`) + strips the history entry. Cost model = OPTION 3: two buckets shown separately + combined — per-boat table 🔧 ค่าซ่อม(MJ `flMaintCalcCost`) · 🛢️ ของใช้/น้ำมัน · 📊 Upkeep รวม; KPI cards + month stepper (`_flConsumeMonth`). NOT double-counted in repair cost (separate store). Verified withdraw/restore + cost math (8 GA × ฿934.58 = ฿7,477). Backup `pre_consumable_requisition.html`. §81 Duplicate-booking guard — `bkV2FindDuplicateBookings(d, excludeId)` flags an existing non-cancelled booking when ANY of: (A) same voucher/ref · (B) same lead name + a shared trip date+route · (C) same agentId + shared trip date + same total pax. Called in `bkV2CommitBooking` right after the hard-block validation → soft `confirm()` listing the matches (reasons shown) · user can proceed (warn, not block · per user). Edit excludes self via `_bkV2.editingId`. Verified on real data: re-entering EXC29968 caught all 3 reasons. Backup `dup_guard_allergy.html`. Pending offers: passive "อาจซ้ำ" badge in By-trip/All lists + live voucher inline check. Also §80b: removed the "Other dietary notes" free-text box from New Booking (kept `specialMeals.allergies` data for legacy display); §-longtail add-on note field (`addOns[].note` · shows in review + manifest longtail chip).
> Prev: 2026-06-29 (§80 Structured food allergies — New Booking "Allergies" free-text replaced by an add-allergy list `specialMeals.allergyList=[{name,qty}]` (qty = #people) + preset chips (Peanut/Shellfish/…) + a separate "Other dietary notes" textarea (still `specialMeals.allergies`, un-counted e.g. "no shellfish"). NEW helpers `bkV2AllergyCount(sm)` (Σ qty · legacy text-only = 1) + `bkV2AllergyText(sm)` (display "Peanut ×2 · …" + note). The "⚠ N allergy" prep count now sums PEOPLE (was: # bookings with any allergy note). Setters `bkV2AllergyAdd/AddPreset/Remove/SetQty` + `_bkV2EnsureSM`. Updated all read spots: By-trip prep/family/boat counts (`o.allerg+=bkV2AllergyCount`), manifest special-request cell, review panel, voucher ticket chip. Persisted on commit + edit-clone. Backup `pre_allergy_structured.html`.)
> Prev: 2026-06-28 (§79 Van-group "รถปนกัน" guard — TWO root causes of "จัดรถถูกแต่ใบงานผิด": (1) `bkV2VanGroupDisband` (non-split branch) deleted vanGroup+vanSeq but LEFT `ops.vanId`/`vanReturnId` set → a disbanded booking kept its old van (still shipped on that van's job order!) and carried it into the NEXT group → mixed-van group. FIX: disband now also nulls vanId+vanReturnId (split branch already did). (2) `bkV2VanGroupSelected` only filled van for EMPTY bookings → adding a booking that already carried a van kept its OLD van → 1 group ended with 2 vans → job order (keys off `ops.vanId`) shipped it on the wrong van. FIX: add-to-group now OVERWRITES vanId with the group's van (group = 1 van by design; return van stays per-booking). PREVENTION + DETECTION: new `bkV2VanGroupConflicts(date)` scans every group; surfaced as purple "รถปนกัน" warnings on the By-trip day bar, the group header (both modes), AND the Van Job Order sheet (so it can't print silently wrong) — NO auto-pick (per user: ห้ามเดา) · resolve by re-selecting the group van. §78 day "ยังจัดไม่ครบ" warning bar · §77 Restore (un-cancel) booking · §76 General (non-vessel) projects · §75 Pro Forma doc redesign · §74 Daily PFM Finexy redesign. Also: Van Job Order now self-heals grouped bookings' vanId on print/preview (`bkV2VanGroupHeal` in `vanJobsOrderInner`) + red "ยังไม่จัดรถ" banner when same-route bookings lack a van.)
> Prev: 2026-06-25 (§73 Return-leg & self-arrive fixes — (a) Drop-off area dropdown shows ALL zones in New Booking (`bkV2AreaDDOpts(kind)`; was filtered to pickup zone → No-Transfer self-arrive piers invisible) · (b) Van Job Order ② RETURN skips self-return bookings (`bkV2RetInfo().selfRet`) · (c) NEW `bk.pickupSelf` flag + "🚶 ขารับมาเอง" toggle — keeps rate PK, drops booking from ① OUTBOUND + unassigned count · (d) Return-van dropdown pool broadened to all zone vans (was matrix-route-only → couldn't pick cross-van return) · (e) `bkV2VanGroupHeal` no longer spreads `vanReturnId` across the group — return van is per-booking (heal fixes outbound van only) · §72 By-trip 3 cases (paste-group warn · self-return drop-off · longtail charter qty) · §71 FOC detail liquid-glass · §70 FOC detail moved to ⑥ Agents tab)
> Prev: 2026-06-23 (§69 Van Assign · block assigning a van that can't seat the group's pax — `bkV2VanGroupPax` + guard in `bkV2VanGroupSetVan` + disable over-cap vans in the group dropdown + block over-filling on add-to-group · §68 Gearbox service cycle (gear-oil) — `flGbServiceState`/`flGbMarkService`/`flGbSetInterval`, counted on the attached engine's hours, baseline-reset like the engine + retro reset button · §67 Per-asset maintenance cost = job cost ÷ same-type asset count (Engine/Gearbox/Propeller detail only · job/boat/project totals unchanged) · §66 Service-hour reset on close — single confirm + "↻ รีเซ็ตรอบเซอร์วิส" retro button for DONE service jobs · §65 Pickup Map vivid dot colors (`pmVivid`) · §64 Transfer Fleet matrix · group count in "สรุปการจัดรถ" (`_vehGroupsForDay`) · §63 Pickup Map value toggle + MoM + area drill-down + island capture · also delivered: OTA Year Marketing Plan Excel (Klook/Trip.com/Traveloka/GetYourGuide · 12-month targets + pricing-channel anti-undercut sheet) in the workspace root)
> Prev: 2026-06-21 (§49 Boat Assign · checkbox per row + bulk "จัดลงเรือ" action bar → assign many bookings to one boat at once · cap+2 guard applied incrementally, overflow rows skipped+kept ticked · §48 By-trip manifest · Boat Assign mode now clusters rows by assigned boat (like Van Assign clusters by group) + per-boat header row ("🚤 Boat · N booking · pax/cap" · over-cap red) + "⚠ ยังไม่จัดเรือ" header floating un-assigned rows to TOP · row tint lightened to _bkV2Soft 0.9 (lightest · accent bar carries the cue) and now applies in boatMode any time, not only 2+-boat trips · sort: unassigned→top, boats ordered by BOATS index, time within boat)
> Prev: 2026-06-20 PM (§43 Incident delete button + flDeleteIncident (warns if MJ linked) · §44 Spare-link invariant: setting gearbox/propeller status=Spare in Edit form force-detaches engineId/gearboxId · §45 ENGINE SWAP flow — Start-Job gear/prop question now fires for corrective too + "↔ สลับเครื่อง" path: gearbox+propeller stay on boat ("คาเรือ" onBoatId/onBoatPos) while engine swapped out; replacement engine adopts them & sheds its OWN gearbox; "คาเรือ·รอเครื่อง" WAIT display in gb/prop lists+detail · §46 gearbox→engine dropdown shows only on-boat engines without a gearbox; propeller→gearbox dropdown shows only installed gearboxes without a propeller · §47 By-trip manifest: color rows by boat when a trip has 2+ boats (works in Boat-Assign mode) + sticky boat-count strip · also: engine-status self-heal now reads fixing for any open-job engine regardless of boat setFixing · FOC reason required at approval · rolled back test jobs MJ-052/053/054 + INC-029/030/031 via console, removed the day's auto-mutating flLoad hooks)
> Prev: 2026-06-20 AM (§38 Demand ⑥ Agents tab: all agents · area MATRIX columns + per-area faint totals · full-width · moved Top-agents off ⑤ · §39 Agent Recent Bookings pagination 15/page · §40 over-allotment + discount → Pending approval (queue handles both) · §41 Fleet asset lists: scroll-jump fix (eng/gb/prop) + group-by-BOAT + position order Port→…→Std + Starboard→Std normalize + fixed-width pos badge + engine-status self-heal · §42 maint Awaiting-Invoice clears only when memos PAID + boat stuck-fixing self-heal · §37+ Voucher photo: assets/voucher override layered on hero + crop-to-hide-baked-text + brightness)
> Prev: 2026-06-19 (§34 unassigned-to-top+frame · §35 pickcell full + addon restack · §36 return-van jobs · §37 Voucher boarding-pass ticket) · 2026-06-18 (§27 hotel autocomplete · §28 calendar per-day total + program filter · §29 inventory +29 items + back-fill migration · §30 maint "+ Memo" + withdraw scroll-jump fix · §31 Extra Longtail เหมา(Private) · §32 Van Jobs unassigned-by-route · §33 sidebar gap) · 2026-06-17 (§23 UI chrome/glass · §24 Van Job revamp · §25 Transfer Fleet header · §26 cash-on-tour note/dietary clamp/vanSeq)

---

## 1. Company

**Operation LOVE Andaman** — Phuket-based marine tourism company.

**Routes:** Similan Islands, Surin Islands, Phi Phi, Phang Nga Bay, Whale Shark tours
**Fleet:** 15 vessels (current count, verified in DEFAULT_BOATS)

**Language:** Thai + English mixed is fine. **Use English/ASCII-safe text in `alert()`, `console.log()`, and any new hooks** (Thai encoding can break in some contexts).

---

## 2. Workspace Structure

```
LOVE_Andaman_Workspace/
├── CLAUDE.md                    ← this file
├── SYSTEM_MAP.md               ← AI-readable architecture map (modules, fns, data keys)
├── BACKLOG.md                  ← pending items / notes
└── allotment_v2/
    ├── allotment_v2.html        ← main file (~3MB / 46k lines)
    ├── start_server.command     ← double-click → starts local server (see 6.5)
    ├── BACKUP/                  ← timestamped copies before big edits
    └── data_exports/            ← JSON exports of localStorage
```
> Keep `SYSTEM_MAP.md` in sync when adding modules — it's the quick-orientation file.

---

## 3. Data Storage Model (IMPORTANT — read carefully)

This project uses a **hybrid data model**:

### 3.1 Primary: Hard-coded in HTML

Most data is **embedded directly in the HTML file** as JavaScript constants:

| Constant | Contains | Approx location |
|---|---|---|
| `DEFAULT_ROUTES` | All tour routes with prices, schedules | ~line 2700 |
| `DEFAULT_BOATS` | All 15 vessels (boats array) | ~line 2652 |
| `FL_DEFAULT_ENGINES` | Engine specs per vessel | ~line 3000+ |
| `FL_DEFAULT_GEARBOXES` | Gearbox inventory | ~line 3500+ |
| `FL_DEFAULT_PROPELLERS` | Propeller inventory | ~line 4000+ |
| `FL_DEFAULT_MAINTENANCE` | Maintenance jobs (MJ) | ~line 11522 |
| `FL_DEFAULT_INCIDENTS` | Incident records (INC) | ~line 5000+ |
| `FL_DEFAULT_INVENTORY` | Parts inventory | ~line 5200+ |
| `FL_DEFAULT_MEMOS` | Memos/orders (MO) | ~line 5400+ |

### 3.2 Secondary: LocalStorage

`localStorage['loveandaman_v2']` is **populated on first load** (seeded from DEFAULT_*) and used for runtime persistence:
- User edits through UI (Add/Edit/Delete)
- Status updates via log entries
- Operational changes (e.g., pier reassignment, repair logs)

Once seeded, LocalStorage is the **runtime source of truth** for the UI.

**Sales/Booking keys under `loveandaman_v2`** (read-modify-write · don't clobber):
`sb_rate_types` · `sb_pickup_zones` · `agent_artifacts` · **`sb_bookings`** (persisted by commit/save · **load added 2026-06-03: `if(Array.isArray(d.sb_bookings)) SB_BOOKINGS = d.sb_bookings` right after the seed array — previously written but never loaded → new bookings vanished on refresh**) · `sb_seat_locks` (§13.6) · **`sb_nationalities`** (custom nationalities · New Booking nat field is a typeable dropdown · merged list via `bkV2AllNats()`; built-in `BKV2_NATIONALITIES` ~72 + Other. **2026-06-05: adding is now MANUAL** — `bkV2NatDDBlur` no longer auto-creates on blur (reverts to saved); dropdown shows an explicit "+ Add ‹text› as new nationality" row → `bkV2NatDDAddNew` → `bkV2AddCustomNat` (rejects <2-letter names). One-time IIFE purges junk single-letter customs. See §15.5) · **`sb_markets`** + **`sb_sales`** (Team & Markets · persisted by `sbMarketsPersist()` / `sbSalesPersist()`, loaded on init if present — overrides the `SB_MARKETS` / `SB_SALES` seed · fixed 2026-06-03: edits were in-memory only → lost on refresh; now `tmSaveModal` + `tmDeleteSales` + `tmDeleteMarket` persist) · **`sb_addon_types`** (custom add-on types · persisted by `sbAddonTypesPersist()`, loaded on init · built-ins longtail/privateTransfer stay hardcoded) · **`sb_agents`** (full agent list · persisted by `sbAgentsPersist()`, loaded on init if present — overrides the `SB_AGENTS` seed; **load condition is `Array.isArray(d.sb_agents)` — accepts an empty array so a fully-cleared list stays cleared and does NOT revert to seed**). `agNew()` create-flow + section edits + `agDelete()` all call `sbAgentsPersist()`.

**Clear Agents (bulk · §clear-agents · 2026-06-03):** Agent List toolbar → red **"ล้างรายชื่อ"** button → `agClearOpen()` modal. Select-all / per-agent checkboxes · each row shows linked-data counts (booking · contract · seat lock) · **hard confirm: must type `ลบ` (or `DELETE`)** to enable the red "ลบถาวร (N)" button. `agClearExecute()` removes selected agents from `SB_AGENTS` + **cascade-deletes linked data**: bookings (`SB_BOOKINGS` where `agentId∈sel` · read-modify-write `sb_bookings`), contracts (`_CT_ARTIFACTS[id]` via `ctArtifactsPersist()`), agent-held seat locks (`SB_SEAT_LOCKS` `holderType==='agent' && holderId∈sel` via `sbSeatLocksPersist()`). Then `sbAgentsPersist()` + `renderAgents()`. Verified: partial clear cascades + persists across reload; clear-all → 0 agents survives reload (no seed revert). Backup: `BACKUP/allotment_v2_20260603_pre_clear_agents.html`.

### 3.3 Backup Strategy

| What | How | When |
|---|---|---|
| HTML file | `cp` → `BACKUP/allotment_v2_<YYYYMMDD>_<desc>.html` | Before every significant edit |
| LocalStorage | **💾 Backup button** in app header → downloads `backup_<ts>.json` | After each work session (then move file into `data_exports/`) |
| LocalStorage | Console script → `data_exports/<timestamp>.json` | Before bulk changes |

---

## 4. Data Schema Reference (VERIFIED — based on actual data inspection)

### 4.1 Boat object schema

Each boat in `DEFAULT_BOATS` (and LocalStorage `boats[]`) follows this schema:

```javascript
{
  "id": "b15",
  "name": "Rolanda",
  "type": "Speedboat",
  
  // === LOCATION FIELDS (multiple, different meanings) ===
  "pier": "panwa",                  // 📍 home pier (operational)
  "homeportCity": "ภูเก็ต",          // 🏛️ registration city (legal)
  "homeport": "ท่าการ พังงา",       // 🏛️ registration port name (legal)
  
  // === CAPACITY ===
  "cap": 38,                        // operational capacity (used for booking)
  "licensePax": 47,                 // license maximum
  "totalcap": 50,                   // total (pax + crew)
  "crew": 3,
  "engineCount": 3,
  
  // === SPECS ===
  "material": "ไฟเบอร์กลาส",
  "use": "บรรทุกคนโดยสาร (เร็ว)",
  "gt": 15.98, "nt": 10.86,
  "loa": 14.72, "beam": 3.28, "depth": 1.52,
  "bhp": 186.5,
  
  // === LEGAL ===
  "reg": "5951/0442/2",
  "callsign": "HSB7874",
  "owner": "บริษัท เลิฟ ไอแลนด์ จำกัด",
  "ownerAddr": "9/244 ถนนศักดิเดช ...",
  "docs": [
    { "name": "ใบอนุญาตใช้เรือ", "exp": "YYYY-MM-DD" },
    ...
  ],
  
  // === STATUS LOG (current status via last entry) ===
  "log": [
    {
      "id": "sl15" or "sl<timestamp>",
      "s": "available" | "fixing" | "unavailable",
      "from": "2026-04-01",
      "to": null | "2026-05-30",      // null = ongoing
      "loc": "อู่พี่เนต",                // optional: current location (off-pier)
      "note": "Maintenance Job MJ-019", // optional
      "reason": "dry_dock"              // optional: reason code
    }
  ]
}
```

### 4.2 Location fields disambiguation

| Field | Type | Meaning | When to use |
|---|---|---|---|
| `pier` | Operational, home | Home pier (where boat is normally based) | Schedule, booking, route assignment |
| `log[last].loc` | Operational, current | Current physical location (when off-pier) | Display when fixing/unavailable |
| `homeportCity` | Legal | Registered province | Documents, permits |
| `homeport` | Legal | Registered port name | Official certificates |

**Rules:**
- "เรือ X อยู่ท่าไหน?" (operational) → `pier`
- "เรือ X ตอนนี้อยู่ที่ไหนจริงๆ?" → check `log[last].loc` first, fallback to `pier`
- "เรือ X จดทะเบียนจังหวัดอะไร?" → `homeportCity`

### 4.3 Pier enum values (CRITICAL — verify before assigning)

**Currently used in data:**
- `"tublamu"` — Tub Lamu Pier (Phang Nga, main pier for Similan/Surin routes)
- `"panwa"` — Visit Panwa Pier (Phuket, main pier for Phi Phi routes)

**Planned for future (not yet in data):**
- `"ranong"` — Ranong Pier (planned for Surin season operations)

**When adding new pier value:** verify spelling matches UI grouping logic. UI labels are converted from enum (e.g., `"panwa"` → "Visit Panwa Pier").

**❌ Do NOT use:** `"visitpanwa"`, `"Tub Lamu"`, `"Visit Panwa"` — these will break UI grouping.

### 4.4 Status log

Status is tracked via `log` array (history). Current status = **last entry**.

**Status values (`s` field):**
- `"available"` — เรือพร้อมใช้งาน
- `"fixing"` — กำลังซ่อม (shows in "In Shop" filter)
- `"unavailable"` — ใช้งานไม่ได้ (long-term, e.g., dry dock)

**Optional fields in log entry:**
- `loc` — current physical location (free text, e.g., "อู่พี่เนต", "Thai Marine")
- `note` — descriptive note
- `reason` — reason code (e.g., "dry_dock")

### 4.5 UI grouping logic (observed behavior)

The Boat Status page groups boats into **3 tabs**:

| Tab | Logic |
|---|---|
| **Tub Lamu** | `pier === "tublamu"` AND last log `s !== "fixing"` |
| **Visit Panwa** | `pier === "panwa"` AND last log `s !== "fixing"` |
| **In Shop** | last log `s === "fixing"` (regardless of pier) |

Boats with `s === "unavailable"` may appear under their `pier` tab but flagged unavailable.

---

### 4.6 Rate Type schema (Sales/B2B side)

`SB_RATE_TYPES` (line ~26210) — reusable price packages bound to Agents (via `agent.rateTypeId`). Each Rate Type bundles seat rates + charter + add-ons + bundles.

```javascript
{
  id: 'rt001', code: 'DMC-RU', name: 'DMC Russia · Standard',
  color: '#185FA5', note: 'High-volume Russian DMC',
  active: true,                      // false = inactive (hidden in dropdown)
  validFrom: '2026-01-01',           // rate-type-level (rare · routeValidity preferred)
  validTo:   '2026-12-31',

  routes: ['r5','r6','r10'],         // routes this rate type covers

  // ─── Seat rates: per route × zone × pax-type ───
  seatRates: {
    r5: {
      PK:         {'adult-thai':1800,'child-thai':1250,'adult-fr':2400,'child-fr':1650},
      KL:         {'adult-thai':...},
      NoTransfer: {'adult-thai':...}
    }
  },

  // ─── routeValidity (source of truth for Active period) ───
  // Charter + Add-ons inherit from here · per-route start/end
  routeValidity: {
    r5: {from:'2026-01-01', to:'2026-12-31'},
    r6: {from:'2026-03-15', to:'2026-11-30'}
  },

  // ─── routeBundles (forced add-on baked into seat price) ───
  // mode 'free': longtail included, no extra charge (e.g. Whale Shark)
  // mode 'paid': bundled but surcharge added per pax (e.g. Early Krabi · +500A/+300C)
  routeBundles: {
    r10: { longtail: {mode:'free', adult:0,   child:0  } },
    r6:  { longtail: {mode:'paid', adult:500, child:300} }
  },

  // ─── Charter rates: starter + marginal ───
  charterRates: {
    r5: { speedboat: {starterPrice:54000, starterIncludes:4, extraPerPax:3500} }
  },

  // ─── Add-on services (optional per booking, NOT bundled) ───
  addOns: {
    // Longtail — 2 booking modes (Join per pax / Charter per boat) · PER-ROUTE pricing (Option A · 2026-06-13)
    // Use _rtNormalizeLongtail(ao.longtail) to read · _rtLongtailForRoute(rt,routeId) for one route's effective price.
    longtail: {
      applies: ['r5','rSurin'],      // routes that offer longtail as add-on
      byRoute: {                     // ← per-route price (Surin can differ from Phuket)
        r5:     {join:{adult:650,child:400}, charter:{price:4500,capacity:6}},
        rSurin: {join:{adult:800,child:500}, charter:{price:5500,capacity:6}}
      }
      // OLD flat shape {join,charter} (one price for all applies) still READ — `_rtNormalizeLongtail`
      // migrates it by spreading the flat price across every applies route into byRoute.
    },
    privateTransfer: {
      unit: 'per trip',
      r5: { PK: {sedan:1800, van:2400}, KL: {sedan:2800, van:3800} },
      r6: { ... }
    }
  }
}
```

**Inheritance flow (View detail panel)**:
```
§ 1 Seat rates           ← editable Start/End per route (routeValidity)
    ↓ inherit
§ 2 Charter rates        ← read-only · shows inherited dates
    ↓ inherit
§ 3.2 Private Transfer   ← read-only · shows inherited dates
```

**Longtail per-route pricing (Option A · DONE 2026-06-13).** `addOns.longtail` moved from one flat `{join,charter}` (one price for all `applies` routes) to a **per-route map** `byRoute:{ rId:{join:{adult,child}, charter:{price,capacity}} }`. `_rtNormalizeLongtail` returns `{applies, byRoute, join, charter}` (the flat `join/charter` = first route's price, kept for single-price readers + as fallback) and **migrates old flat data** by spreading the one price across every `applies` route. New helper **`_rtLongtailForRoute(rt, routeId)`** = that route's effective price (byRoute → flat fallback). Touch points updated: edit form (`_rtAddonEdit_longtail` → per-route table, inputs write `addOns.longtail.byRoute.<rId>.join/charter.*`, seeds a row per applies route), detail (`_rtAddonDetail_longtail` → per-route table · **cascades to Agent Pricing Matrix** via shared `rtBuildDetailBody`), contract (`_rtAddonContract_longtail`), booking add-on selector (per-route sub-label · "ราคาตามเส้นทาง" when prices differ), quote calc (`bkV2AddOnInfo` longtail-join/charter → per-trip × that route's price), `bkV2HasAnyAddOn`, and the def `init → {applies:[],byRoute:{}}`. Bundle longtail (`routeBundles`) is unchanged (still Join-only, free/paid). Verified with a node math test (mixed-route join total, old-flat migration, non-applies exclusion). Backup: `BACKUP/allotment_v2_20260613_pre_longtail_perroute.html`.

**Bundle behavior** (when implemented in booking flow):
- If `rt.routeBundles[rId]?.longtail` exists → Longtail Join is **forced** into the package
  - `mode:'free'` → no surcharge, invoice shows `(incl. Longtail Join)`
  - `mode:'paid'` → adds `adult×paxA + child×paxC` to seat total automatically
- Agent **cannot** opt out · Longtail Add-on (`addOns.longtail`) checkbox is disabled for this route
- Longtail Charter (เหมา) remains available as separate upgrade option

**Persistence**: `rtPersist()` writes `SB_RATE_TYPES` to `localStorage['loveandaman_v2'].sb_rate_types` using read-modify-write (preserves other keys).

**Shared detail renderer** (2026-06-03): `rtBuildDetailBody(rt)` is a pure fn (returns string) that builds the § 1 Seat / § 2 Charter / § 3 Add-on detail HTML. Used by **both** `rtRenderDetail(rtId)` (Rate Type page · wraps it with the admin header: Edit/Activate/Manage agents) **and** `agTabPrices(a)` (Agent → Pricing Matrix tab · embeds it below the Source chip, replacing the old custom matrix table). Single source of truth — edit the table once. Seat table tolerates "Not Offered" (`cell===null`) per zone: keeps the row, renders a `colspan=4` "No Offer" badge (all 3 zones always present → rowspan=3 stays aligned).

**Contract pricing fix** (2026-06-03): `ctDocRenderPricing()` (contract PDF · §38866) previously hardcoded `rowspan="3"` on the route-name cell while **skipping** Not-Offered zones (`if(!cell) return`) → misaligned table / lost route name when KL was Not-Offered. Fixed: compute `presentZones = ZONES.filter(z=>rr[z])`, dynamic `rowspan=presentZones.length`, attach route name to the first present zone (not hardcoded PK). Unlike `rtBuildDetailBody`, the contract table OMITS Not-Offered zones entirely (cleaner for the printed doc).

**Add-on Type Registry** (2026-06-03) — `RT_ADDON_DEFS` (defined just before `rtBuildDetailBody`) is the **single source of truth** for Rate Type add-on types. Each entry self-describes one type with hooks: `key`, `label{en,th}`, `detailPresent(rt)`, `detail(rt,subNo)`, `init(rt)`, `contract(rt,ctx)`, `edit(d)`, `summary(rt)`. Per-type code lives in `_rtAddonDetail_*` / `_rtAddonContract_*` / `_rtAddonEdit_*` functions referenced by the def. Seeded with `longtail` + `privateTransfer`.

  **All consumers loop the registry** (no hardcoded type names anymore):
  - `rtBuildDetailBody` § 3 → `RT_ADDON_DEFS.filter(d=>d.detailPresent(rt)).map((d,i)=>d.detail(rt,i+1))` (sub-numbers `3.1/3.2…` by position). Covers Rate Type page **and** Agent Pricing Matrix tab.
  - `ctDocRenderAddOns` (contract PDF) → loops `d.contract(rt,ctx)` · ctx `{T,fmtN,rName}`.
  - `rtModalRender` Add-on section → `RT_ADDON_DEFS.map(d=>d.edit(_rtDraft))`.
  - `rtToggleAddOn(key)` → `RT_ADDON_DEFS.find(d=>d.key===key).init(_rtDraft)`.
  - Rate-type preview teasers (2 spots) → `_rtAddonPreview(rt)` loops `d.summary(rt)`.

  **To add a NEW add-on type (code path):** push ONE object into `RT_ADDON_BUILTIN` with its hooks (+ write the `_rtAddon*_<key>` render fns) → it cascades automatically to the Rate Type page, Agent tab, edit modal toggle list, contract, and preview. No scattered edits. Verified behavior-preserving (detail+contract+edit-modal byte-identical to pre-refactor) and cascade-proven. Backup: `BACKUP/allotment_v2_20260603_pre_addon_registry.html`.

**Add-on types — UI-managed (data-driven)** (2026-06-03) — non-dev staff can add add-on types from the **Rate Types page → "ชนิด Add-on" button** (toolbar, next to New Rate Type) → modal `rtAddonTypesOpen()`. Built-in types (longtail, privateTransfer) shown locked; custom types created/deleted here.
  - **Data:** `SB_ADDON_TYPES` (localStorage key `sb_addon_types`, read-modify-write via `sbAddonTypesPersist()`). Each: `{key, label:{en,th}, model:'perPax'|'flat', unit, builtin:false}`. `key` auto-slugged from EN name (deduped).
  - **Registry assembly:** `RT_ADDON_DEFS` is now `let`, rebuilt by `rtRebuildAddonDefs()` = `[...RT_ADDON_BUILTIN, ...SB_ADDON_TYPES.map(_rtGenericDef)]`. Called on load + after every create/delete.
  - **Generic renderer** (`_rtAddonDetail_generic` / `_rtAddonEdit_generic` / `_rtAddonContract_generic` / `_rtAddonSummary_generic` / `_rtAddonInit_generic`) interprets `model`: `perPax`→`{applies:[],adult,child}`, `flat`→`{applies:[],price}`. Route applies-to picker reuses generic `rtToggleAddOnRoute` / `rtDraftSet`. Per-RT data still lives in `rt.addOns[key]`.
  - **Cascade:** a UI-created type instantly appears as a checkbox in every Rate Type's edit modal → shows in § 3 detail (Rate Type page + Agent tab), contract PDF, and preview. Verified: create→registry+persist+edit+detail+contract all picked it up; builtin render byte-identical (0 regression). `ctDocRenderAddOns` ctx gained `lang` (for custom-type bilingual labels). Models supported today: per-pax (adult/child) + flat. Backup: `BACKUP/allotment_v2_20260603_pre_addon_ui.html`.

---

## 5. Project Status

Coral-themed FinDash (`#ff6b47`). Working file: `allotment_v2.html`.

### 5.1 Completed Modules
- **P1: Agent Info** — agent management with contact, commission, rates
- **P2: Add-on Services** — additional services per booking
- **P3: Renewal** — banner, history bar, 4-step wizard, archived side panel
- **P4: Rate Type system** — sidebar+main+3-col view, Balance Sheet detail, per-route Start/End, Longtail Join/Charter modes, Private Transfer matrix, Bundle Longtail (Free/Paid)
- **P5: Contract Document** — wizard (sidebar sections + A4 preview), bilingual EN/TH, 5-6 page grouping, inline edit + Custom Clauses, PDF export via browser print, artifact storage with View/Edit/Reprint history
- **P7: Accounting** (2026-06-03 · **P1–P4 complete**) — `#view-accounting` · nav-item `accounting` · `renderAccounting()`. **P2:** printable A4 invoice + receipt (`acctOpenDoc`/`acctInvoiceDocHtml`/`acctReceiptDocHtml` · browser-print → PDF via `body.acct-printing` + `@page`) · combine multi-booking per invoice. **P3:** deposits (`SB_DEPOSITS` · `acctCreateDeposit`/`acctApplyDeposit` FIFO via type-`deposit` payment entries · `acctAgentDepositAvail`) · apply-deposit button in pay modal · partial payments · per-agent **Statement** (`acctStatementOpen` · invoices+payments+deposits+credit · opened from agent name link or credit bar). **P4:** money dashboard on the Accounting view (`acctDashboardHtml` · receivables aging buckets · 6-mo collection bars · top-outstanding agents). **VAT (2026-06-03):** per-agent `agent.vatMode` (`none`|`exclude`|`include`, set in agent edit form · saved with payType) flows into `acctCreateInvoice` → stores `netAmount`/`vatMode`/`vatRate`(0.07)/`vatAmount`/`total` (exclude = net+7%; include = back-out 7% from price; none = no VAT). Invoice doc shows Net / VAT 7% / Total. Credit still consumes the booking (net) price. **By-trip-date payment entry point (2026-06-03):** the manifest **Pay** column is a clickable chip (`bkV2PayChip`) → `bkV2RowPayAction(bkId)` modal → issue invoice/**Pro Forma** (`bkV2PayDoCreate`) + record payment (`bkV2PayDoRecord`) + view doc — all call the same `acctCreateInvoice`/`acctRecordPayment` (single source of truth; booking status + credit + dashboard stay in sync). Invoice doc title = "PRO FORMA INVOICE" when `agent.payType==='proforma'`. Original P1 below: Data: `SB_INVOICES`/`SB_PAYMENTS`/`SB_DEPOSITS` (LS `sb_invoices`/`sb_payments`/`sb_deposits` · persist fns). Invoices list + KPIs (outstanding/paid-month/credit-exposure/overdue) + New-invoice modal (pick agent → un-invoiced bookings) + Record-payment modal (partial supported) + Void. **Credit (derived, no double-ledger):** `agCreditState(agentId)` = limit − Σ(confirmed, credit-mode `payType==='invoice'`, non-cancelled, **unpaid** bookings). Consumed at confirm (status set), restored when the covering invoice is fully paid (`acctBookingPaid`). Shown as a Credit-used bar in the agent detail. Helpers: `acctCreateInvoice` / `acctRecordPayment` / `acctVoidInvoice` / `acctInvoiceBalance` / `acctInvoiceState`. Verified: confirm→used+8000, pay→used 0, invoice paid, persists. **Pending P2-P4:** invoice/receipt PDF + combine-multi (P2), deposits + partial UI + agent statement (P3), money dashboard (P4) — see BACKLOG.md. Backup: `BACKUP/allotment_v2_20260603_pre_accounting_p1.html`.
- **P6: Booking v2** (2026-06-02) — Tab 2 "By trip date" trip-header + zone manifest, BuildAxis re-skin (blue accent), review adjustments (discount %/฿ + extra + notes), charter Rate/Flexible price, **Seat Locks** tab (hold pool + draw in booking + KPI). See §13. **2026-06-05 additions** (§15): Reschedule (move date · fee on booking's own invoice · ghost+badge), Paste-group-list fast entry, manifest bundle-longtail + extra-charge chips, VAT-edit + manual-nationality fixes.
- **P8: Demand / Market Intelligence** (2026-06-04/05) — immigration `.xls` import → arrivals/departures analytics, penetration index, 6 tabs, white liquid-glass Overview (gauge/slider/Year-Month-Week chart, Top markets vs Net in-island). See §14.

### 5.2 Pending Modules (priority order)

1. **Booking flow** — core quote + Rate Type bundle/add-on wired (P6 ✓) · remaining: edit-mode lock-draw reconcile, multi-trip polish
2. **Peak Season** — pricing rules per date range
3. **Templates** — reusable booking templates

---

### 5.2.1 Ocean re-skin + soft-UI chrome (2026-06-03)
One reversible block `<style id="softui-ocean-skin">` appended right after the `bkv2-buildaxis-skin` block (before `</head>`). Does two things:
- **Accent recolor coral→Ocean blue** — re-declares the brand tokens at `:root` (later declaration wins): `--fd-coral`/`--aos-coral`/`--coral` family → `#1683C7` (soft `#E1F0FA`, deep `#0E6AA8`). All var-based coral usage flips to blue app-wide; the 2 hard-coded `#ff6b47` are var-fallbacks so they're covered. Logo blue is `#1683C7` (sampled from the LOVE Andaman logo).
- **Soft-UI (neumorphic) chrome** — `.topbar` + `.sidebar` → light `#E8EBF1` with dual-shadow extruded buttons / brand chip; `.nav-item.active` → inset "pressed" + ocean text; topbar buttons get soft shadows (Backup stays blue, Reset red via `[onclick*=]`). Inline nav colors overridden with `!important`. Revert the whole look = delete this one block.
- **Topbar date** — `#topbar-date` line switched `toLocaleDateString('th-TH'…)` → `'en-GB'` → "Wed, 3 Jun 2026".
- Note: the **main Dashboard module keeps its own green/amber `dx.*` palette** (independent of the coral tokens) — not recolored by this skin. Backup: `BACKUP/allotment_v2_20260603_pre_ocean_softui.html`.

### 5.3 Contract Document module (P5) — schema reference

**Wizard state** (in-memory `_ctDoc` during edit session):
```javascript
{
  agentId: 'a73',
  lang: 'en',              // 'en' | 'th' — toggle in header
  sections: { cover:true, parties:true, programs:true, ... },  // toggle states
  editMode: false,         // when true → contenteditable elements
  overrides: { 'cover.title': '...', 'payment.note': '...', 'cancel.body': '...' },
  customClauses: [{id, title, body}]
}
```

**Saved artifact** (after Export PDF — stored under `localStorage['loveandaman_v2'].agent_artifacts`):
```javascript
{
  // keyed by agentId
  a73: [
    {
      id: 'gc_1716903600000',
      version: 'v2025-1',
      generatedAt: '2026-05-28T10:30:00.000Z',
      lang: 'en',
      sections: {...},          // snapshot of toggle states
      overrides: {...},         // snapshot of user edits
      customClauses: [...],     // snapshot of custom clauses
      rateTypeRef: 'ST-0001',
      rateTypeName: 'Standard Tier 1',
      pageCount: 6
    }
    // newest first · capped at 20 per agent
  ]
}
```

**Section catalog** (`CT_DOC_SECTIONS`):
```
01 Cover · required          06 Payment Terms
02 Parties · required        07 Booking Channel
03 Programs in Contract      08 Cancellation Policy (off default)
04 Pricing · Seat + Charter  09 Custom Clauses (off default)
05 Add-on Services           10 Signature · required
```

**Page grouping** (`PAGE_GROUPS` in `ctDocRender`) — sections share pages to keep 5-6 pages total:
```
p1: [cover]
p2: [parties, programs]
p3: [pricing]
p4: [addons, payment]
p5: [booking, cancel, custom]
p6: [signature]
```

**Print flow** — `_ctDocPrintFlow()` detaches modal from `.app > main > #view-agents` to `<body>` direct child, adds `body.ct-doc-printing` class, then prints. `afterprint` event restores DOM/state. Required because `display:none` on ancestors cascades down — can't selectively un-hide nested elements.

**Print page sizing** — each `.ct-doc-page` is `min-height: calc(297mm - 20mm)` in print mode (A4 portrait minus 10mm top + 10mm bottom @page margins) so flex `justify-content:center` on Cover content works (otherwise page collapses to content height).

**Status chip** on agent header — derived from `ctArtifactsFor(agentId)`:
- No artifacts → no chip
- Latest artifact `.version === a.contractVersion` → green `✓ Contract · {date}`
- Latest artifact version mismatches → amber `⚠ Contract outdated · last {version}`

---

## 6. Critical Safety Rules

### 6.1 Backup First, Always

**Before any edit that touches:**
- `DEFAULT_*` / `FL_DEFAULT_*` constants
- `flLoad()` / `save()` functions
- Any localStorage logic
- More than ~50 lines at once

→ **Copy file to `BACKUP/allotment_v2_<YYYYMMDD>_<short-desc>.html` FIRST.**

### 6.2 Don't Break Existing Structure

- **DO NOT** rename existing fields
- **DO NOT** delete existing entries (mark inactive instead)
- **DO NOT** change `localStorage['loveandaman_v2']` schema
- **DO NOT** write `localStorage[LS_KEY]` by clobbering — always read-modify-write (parse existing → update only your keys → write back). `save()` (operations) and `flSave()` (fleet) **share this one key**
- **DO** add new fields as optional with sensible defaults
- **DO** bump `FLEET_VERSION` if structural change + migration logic in `flLoad()`

### 6.3 Verify Enum Values Before Setting

When assigning string values to schema fields (like `pier`, status `s`, etc.):

1. **List current values first**: `[...new Set(d.boats.map(b => b.field))]`
2. **Use existing value** unless adding new (then document in CLAUDE.md)
3. **Don't guess from UI labels** — UI may use different display strings

Example mistake to avoid:
```javascript
// WRONG (UI shows "Visit Panwa" but enum is "panwa")
boat.pier = "visitpanwa";  // ❌ UI grouping breaks
boat.pier = "Visit Panwa"; // ❌ same problem

// CORRECT
boat.pier = "panwa";       // ✅ matches enum
```

### 6.4 Runtime Safety Systems (preserve them)

| System | Location | Purpose |
|---|---|---|
| Auto-snapshot | `flLoad()` ~line 6051 | Saves LocalStorage backup before migration |
| `flListSnapshots()` | Console helper ~line 6010 | Lists snapshots |
| `flRestoreSnapshot(N)` | Console helper ~line 6030 | Restores snapshot |
| Defensive merge | First-time path ~line 6075 | Field-level merge, preserves user data |
| Version whitelist | `flLoad()` ~line 6077 | Accepts fleet_v2 → fleet_v34 |

Current versions:
- `FLEET_VERSION = 'fleet_v34'`
- `DATA_VERSION = '2026o'`
- `LS_KEY = 'loveandaman_v2'`

### 6.5 Browser Workflow — MUST run via localhost (NOT file://)

The app MUST be opened through a local web server, not by double-clicking the HTML.

1. Double-click `allotment_v2/start_server.command` → starts a local server (Ruby/Python, port 8765)
2. Open Chrome to: `http://localhost:8765/allotment_v2.html`
3. Keep the server's Terminal window open while using the app
4. Open the app in **ONE tab only** — multiple tabs/windows can overwrite each other's data

**Why not `file://`:** file:// origins are unreliable for localStorage persistence and block `fetch()` of local files (e.g. restoring from `data_exports/`). A `localhost` origin behaves like a normal website → localStorage persists correctly.

**Never test in Claude artifact preview** — isolated storage per version.

---

## 7. Visual System

### 7.1 Typography
- **Body:** DM Sans (Google Fonts CDN)
- **Numbers/data:** DM Mono (KPIs, tables, prices, dates)

### 7.2 Color
- **Primary:** Coral `#ff6b47`
- **Backgrounds:** White or very light (`#fafafa`, `#f5f5f5`)
- **Borders:** Hairline `1px solid rgba(0,0,0,0.08)`
- **No box-shadow** on cards (use border instead)

### 7.3 Layout
- Card-based, generous whitespace
- Section titles: muted color, lowercase or small-caps
- Charts: Chart.js or Canvas

---

## 8. Working with the Large File

`allotment_v2.html` is **~1.7MB / 26,094 lines**. Don't read the whole file.

**Patterns:**
1. **Locate first:** `grep -n "pattern"` for line numbers
2. **Read a window:** 30–50 lines around target
3. **Edit by section:** `str_replace`-style edits with unique surrounding context
4. **Verify after:** re-read changed section only

**For data updates:**
1. Find `DEFAULT_*` constant by grep
2. Read just that array/object
3. Add new entry following exact schema (see Section 4)
4. Don't reformat other entries

**For new modules:** Follow existing similar module pattern.

---

## 9. Communication Preferences

- Concise responses, no long preambles
- Show snippets when explaining code
- Ask before big refactors
- Always remind about backup before core data edits
- Brief progress updates on long tasks
- After edits, state diff (e.g., "added 3 entries to FL_DEFAULT_ENGINES at line 3045")
- When reporting boat data, **specify which field you're quoting** (pier vs homeportCity vs log.loc)
- **Verify enum values** before assigning unknown strings to schema fields

---

## 10. Known Issues & Workarounds

| Issue | Workaround |
|---|---|
| Thai text in `alert()`/`console.log` may break | Use English/ASCII in new hooks |
| `save()` clobbered fleet data — **FIXED 2026-05-25** | `save()` now read-modify-write; preserves `fleet_*` fields |
| file:// localStorage unreliable / data lost on reload | Run via localhost server — see Section 6.5 |
| Claude artifact preview loses LocalStorage between versions | Run via localhost (Section 6.5), not artifact preview |
| Large file fills context window | Read only relevant sections |
| Slow edits on large file | Use targeted `str_replace`, not full rewrites |
| Confusing `pier` vs `homeportCity` vs `log.loc` | See Section 4.2 |
| UI groups by `status` not `pier` for fixing boats | Section 4.5 explains grouping |

---

## 11. First Task Examples

**Read-only (safe):**
```
Read CLAUDE.md, then in allotment_v2.html:
1. Find FLEET_VERSION value
2. Count DEFAULT_BOATS entries
3. List unique pier values used
Use grep, don't read full file.
```

**Light recon:**
```
Find Agent Info module in allotment_v2.html.
Show me:
- HTML structure (modals, forms)
- Function names (search "agent")
- Data location (DEFAULT_* or localStorage?)
- Add/Edit/Delete flow

Explain only, no edits.
```

**Real work (with backup):**
```
1. Copy allotment_v2.html to BACKUP/allotment_v2_<today>_pre_charter_rate.html
2. Plan Charter Rate module following Agent Info pattern:
   - Data structure (new DEFAULT_CHARTER_RATES?)
   - UI (list + modal)
   - Save/load functions
3. Show plan, wait for confirmation before implementing
```

---

## 12. Zone / Region Expansion Strategy (DESIGN DOC)

> **Status:** Decision recorded · NOT implemented · refer here when adding new region/pier
> **Decision date:** 2026-06-01 · **Approach:** Option A (plan now, build later)

### 12.1 The problem

Currently 4 separate concepts all represent "where" but are stored independently:

| Concept | Domain | Values today | Source |
|---|---|---|---|
| **Pier** | Where boat docks | `tublamu` · `panwa` · (planned: `ranong`) | Hardcoded in `boat.pier` enum + `renderBoats()` UI grouping |
| **Rate Type zone** | Pricing tier for transfers | `PK` (Phuket) · `KL` (Khao Lak) · `NoTransfer` | Hardcoded in Rate Type modal · seat-rates matrix |
| **Booking pickup zone** | Where guest pickup happens | `PK` · `KL` · `NoTransfer` (per trip) | Hardcoded in Pickup section + Trip zone pills |
| **Pickup Setup zone** | Hotel/area config groupings | Managed via UI (add/edit/delete works) | localStorage `loveandaman_v2.sb_pickup_zones` |

**These overlap semantically but DON'T share data.** Adding "Ranong" today requires changes in ~5-6 places.

### 12.2 Checklist · adding a new zone/region today (manual workflow)

When a new zone (e.g. **Ranong** / **Krabi** / **Trang**) is added in the future, **follow this exact order**:

#### Step 1 · Pier (if new physical dock)
- [ ] Add enum value to `boat.pier` allowlist (search `pier:'tublamu'` to find pattern · ~line 3145+)
- [ ] Verify spelling (lowercase, no spaces, ASCII-safe)
- [ ] Update `renderBoats()` — `PIER_COL`, `PIER_LBL`, `PIER_NAME` objects (~line 4228-4230)
- [ ] Add pier filter button in Boat Status header (~line 5023)
- [ ] Add tab/grouping section if pier-based grouping is used (~line 5093-5102)
- [ ] Add pier color in BOP2_BOAT_PALETTE if needed (~line 6574)
- [ ] Update Calendar pier filter (~line 4140 in `PIER_COL`)
- [ ] Update Boat Op v2 pier filter buttons

#### Step 2 · Pickup Zone (if new pricing tier)
- [ ] ⚠ CORRECTION (2026-06-07): Pickup Setup has **only "+ Add Area"**, NOT "+ Add Zone". Zones are hardcoded `['PK','KL','NoTransfer']` (3 spots). Adding a real new zone still needs code (see §18 + the future-state below).
- [ ] Add area entries under the new zone (hotel pickup points)
- [ ] Set per-route pickup times via Pickup Setup matrix

#### Step 3 · Rate Type seat rates (pricing per zone)
- [ ] Edit `SB_RATE_TYPES` constants in HTML (~line 26210+) — add new zone key to `seatRates`
  - Example: `seatRates: { r5: { PK:{...}, KL:{...}, RN:{...} } }`
- [ ] Update Rate Type modal seat-rates form to render new column (Phase 4 modal)
- [ ] Update Booking form pickup zone pills (search `PK · Phuket`)
- [ ] Update `_rtNormalizeLongtail()` if new zone has longtail option
- [ ] Update validation in `flProjValidate` / Booking save logic

#### Step 4 · Booking flow
- [ ] Pickup section "Zone" tabs (~line ~28000-29000 search "pickup zone")
- [ ] Trip card zone pills (lock direction · trip card → pickup section)
- [ ] noRate detection for new zone (block booking if no rate set)

#### Step 5 · Verify cascading
- [ ] Open existing Rate Type → confirm new zone column shows up (may be empty)
- [ ] Open New Booking → confirm pill shows up + disabled if no rate
- [ ] Open Pickup Setup → confirm zone manageable
- [ ] Open Boat Status → confirm new pier groups boats correctly
- [ ] Run smoke test: create 1 boat with `pier='ranong'` · 1 booking for new zone

**Estimated effort:** 2-3 hours for an experienced person who knows the codebase. Most time spent on verifying nothing else broke.

### 12.3 Future-state design (single source of truth)

When LOVE Andaman expands to 3+ zones, refactor to centralized:

```javascript
// Single source of truth · stored in d.sb_zones (LS_KEY)
const SB_ZONES = [
  {id:'PK', name:'Phuket',   pier:'panwa',   color:'#0F6E56', active:true,  hasPickup:true,  hasRate:true},
  {id:'KL', name:'Khao Lak', pier:'tublamu', color:'#185FA5', active:true,  hasPickup:true,  hasRate:true},
  {id:'NT', name:'No Transfer', pier:null,   color:'#94A3B8', active:true,  hasPickup:false, hasRate:true},
  // Future:
  {id:'RN', name:'Ranong',   pier:'ranong',  color:'#BA7517', active:false, hasPickup:true,  hasRate:false},
  {id:'KB', name:'Krabi',    pier:null,      color:'#A05BC4', active:false, hasPickup:true,  hasRate:false},
];
```

**Cascade effects when adding via UI:**
```
SB_ZONES.push({id:'RN', active:true, ...})
  ├─ Boat Status → tab "Ranong" auto-appears (if pier='ranong')
  ├─ Pickup Setup → zone RN in list (config area+time)
  ├─ Rate Type matrix → column RN auto-appears (default "Not offered")
  ├─ Booking form → pill "RN · Ranong" auto-appears (disabled if no rate)
  └─ Calendar pier filter → option "Ranong" auto-appears
```

**Management UI:** Add "Zones" tab to Settings page · CRUD operations (Create/Edit/Toggle active/Delete-if-unused).

### 12.4 Decision rationale (Option A · plan now, build later)

**Why we're NOT refactoring now:**
1. **LOVE Andaman scale** — 15 boats · ~5-10 zones lifetime · refactor effort > value
2. **Working code shouldn't be touched** — current hardcoded approach works for today's data
3. **Premature abstraction risk** — over-engineering before knowing actual zone characteristics
4. **Pending real expansion** — Ranong planning is years out · waiting for actual need = better requirements

**When to revisit (trigger conditions):**
- About to add 2+ new zones in a single phase
- Business wants non-technical staff to add zones via UI
- More than 4 piers needed (current grouping logic gets unwieldy)
- Multi-currency or multi-language zones (Vietnam, Cambodia expansion)

**Workaround for occasional 1-zone additions:**
- Use checklist in §12.2 above · ~3 hours work
- Acceptable for ~1 zone/year cadence

### 12.5 Files most affected by zone changes (reference)

```
allotment_v2.html
├─ DEFAULT_BOATS (~line 3145)                  # boat.pier values
├─ renderBoats() PIER_COL/LBL/NAME (~4228)    # Boat Status grouping
├─ renderCal() PIER_COL (~4140)                # Calendar pier filter
├─ bop2RenderHeatmapRow() pier filter (~7000)  # Boat Op v2 filter
├─ SB_RATE_TYPES seatRates (~26210)            # Rate per zone matrix
├─ Rate Type modal seat-rates form (~28500)    # UI input
├─ Booking pickup section (~29000)             # Zone tabs in booking form
└─ Pickup Setup module (~17000)                # Zone config (already managed via UI)
```

---

## 13. Booking v2 module (P6) — 2026-06-02 session

> Booking module lives in `#view-booking` → `#bkv2-host`. Render entry `bkV2Render()`.
> Tabs (`_bkV2.tab`): `cal` (Calendar/Matrix views) · `bytrip` (Tab 2 manifest) · `all` (Linear list) · `locks` (Seat Locks).
> Render dispatch: `bkV2RenderTabBody()`. Topbar: `bkV2RenderTopbar()` (Option A underline tabs, **separate card** — `bkV2Render` outputs two `.bkv2` cards: `.bkv2-topcard` + `.bkv2-bodycard`).

### 13.1 BuildAxis re-skin (scoped, reversible)
- One block `<style id="bkv2-buildaxis-skin">` before `</head>` · scoped to `#view-booking`.
- Remaps CSS vars in scope: `--bk-navy` ramp → blue `#3A6FF7`, `--coral`→blue (for manifest), neutrals→cool gray, `--r/-sm` rounder, adds card shadows, font → Inter (`#view-booking *{font-family:inherit}`) + `tabular-nums`.
- **To revert the whole look:** delete that one style block. Doesn't touch render logic.
- Today vs Selected differ: Today = soft tint/ring · Selected = solid filled blue (Matrix `th.dh.sel` + Calendar `.bkv2-cal-cell.sel`).
- Matrix empty (open·available) cell → soft green `#E9F7EF`. Matrix day headers + empty cells are **clickable** (`bkV2SelectDay` / `bkV2SelectFamilyCell` / `bkV2SelectCell`).

### 13.2 Tab 2 "By trip date" — `bkV2RenderTab2()` (~line 41330+)
- **3-card relayout (2026-06-13):** per program-family the page now renders 3 separate cards instead of one bordered `.t2-trip` block. (1) **Family-header card** `.t2-famcard` — big family name + `1 running`/`N closed` pills; closed/off-season variants listed inside as red rows `.t2-closedline` (red dot + name + "not running"), grid `.t2-famclosed` (replaces the old full-width dashed `.t2-closedline` bars + `.t2-famhead`). (2) **Trip card** `.t2-tripcard` (white, fam-color left accent) = trip header (pax KPIs + boat chips) + `boatStrip` + `prepBar` only. (3) **List card** `.t2-listcard` = `vanStrip` + `rcStrip` + `lockBar` + zone manifest + ghost/cxl blocks. `.t2-trip` is now just a transparent wrapper (shadow/radius moved to the 3 inner cards in the liquid-skin block ~line 2135). Manifest row padding bumped 9px→13px for breathing room. Weather tint moved from `.t2-trip` to `.t2-trip-wx .t2-tripcard/.t2-listcard`. Backup: `BACKUP/allotment_v2_20260613_pre_bytrip_3card.html`.
- **Minimal trip card + collapsible per-boat panel (2026-06-13 · "Option B"):** Family-header card slimmed — closed variants are now small gray chips `.t2-closedchip` (right-aligned under `.t2-famclosed-wrap` + red "N not running" label), no red bars; famname 15px (no uppercase). Trip-header KPIs **hide zero buckets** (only รับ→**relabeled "รวม"** + non-zero AD/CHD/INF/FOC). **`boatStrip` rewritten** (`bkV2RenderTab2` ~line 46480): outer `if(baBoats.length||boatMode)`; **boatMode** keeps the rich per-boat KPI cards (unchanged); **normal view** = a native `<details class="t2-boatbox">` (no JS, default collapsed, scales to 10+ boats without overflow): header right shows `headBoats` = avatar-stack(3) + "N เรือ" chip (`.t2-boatcount`); `<summary>` = always-visible per-boat **mini count chips** `.t2-mchip` (avatar + name + `tot/cap`, over-cap = red `.t2-mchip-over`); expand reveals `.t2-bgrid` (2-col auto-fit) of per-boat **guide + special-meal** chips; footer `.t2-boatsum` = trip-level prep summary (replaces the standalone prepBar via `_prepInStrip`). Per-boat guide/food aggregated into `agg[boatId].lang/veg/vegan/halal/allerg` in the grp loop. New header var `let headBoats=boatChip` (overridden in normal branch). **Family-card boat grid (2026-06-13):** the family-header card is now itself a `<details class="t2-famcard">` — the **whole header row is the `<summary>`** (`.t2-famcard-hd`, click anywhere to fold/unfold; toggle is a chevron-only circle `.t2-famcaret` that rotates on `[open]`, no verbose label). Header gained `.t2-fam-tot` ("รวม X pax · N เรือ"). Expanded body `.t2-fambody` = **one card per running variant** in a `.t2-famvgrid` (`repeat(auto-fit,minmax(208px,1fr))` → 3 routes = 3 columns, wraps when many): each `.t2-vcard` has a colored top-strip header (`_vacc` = per-variant accent from `_FPAL[_vi]`) with name + dep time + pax/boat count, then `.t2-vbrow` boat rows (2-line: avatar+name+cap / `.t2-vbchips` guide+meal pills; over-cap = red `.t2-vbrow-over`); footer `.t2-boatsum` = guide+food totals across all variants. Aggregation loops `_famRunIds = routeIds.filter(family===_fid)` reading `groups[rid2]`. Per user, the per-variant trip-card boat panel is KEPT as well (intentional duplication: family = overview, variant = detail). **Group header row** (`_grpHeaderRow` !vanMode · read-only manifest) restyled "Option 2": solid van pill (group# badge + van name, colored by group) + **ทะเบียน / คนขับ / เบอร์โทร** (from `vehGet` `plate`/`driver`/`driverPhone`, phone is `tel:` link) + ราย/pax/time right-aligned; row bg `_bkV2Soft(c[0],0.92)` (very light). **`_bkV2Soft(hex, amt)`** gained optional 2nd arg (default 0.5) — lighten amount. Backup: `BACKUP/allotment_v2_20260613_pre_boat_collapse.html`.
- **Header** (`t2-hd`): big date (24px) + `‹ ›`/Today + **TOTAL PAX** (day total · AD·C·I·FOC) + day **lock bar** (🔒 N locked across M programs) + **per-program cards** (`t2-pc` · family name · pax · 🔒locked · trips · sorted by pax · click = `bkV2Tab2SetFamily` filter). All day aggregates from `rows` (whole day, ignore filters).
- Left sidebar rail: mini calendar (`_bkV2T2Cursor`, dots = trip days) + Previous/Upcoming lists.
- Main: date stepper + pier filter (`_bkV2T2Pier` all/tublamu/panwa) + **program-family dropdown** (`_bkV2T2Family` · `bkV2Tab2SetFamily` · options from `_BKV2_FAMILIES`) · `_bkV2.filterRoute` kept as secondary (calendar drill).
- **Grouped by program family** (main trip) → big UPPERCASE `t2-famhead` ("SIMILAN ISLANDS · 1 running · 4 closed") with variant trip cards (`t2-trip-variant`, indented) underneath · families ordered by earliest departure (`_famMinTime`).
- **Closed/off-season variants** of a shown family render as faint-red dashed lines (`t2-closedline` · "NOT RUNNING TODAY") under the family header (`!bkV2IsRouteOpenOn`).
- Per trip: **trip header** (รับ/AD/CHD/INF/FOC + `🔒 LOCK N` KPI + boat chip from `TRIPS[date]` or "+ Assign boat") + **Prep bar** + **lock bar** (`t2-lockbar` · per-holder detail · §13.6) + **zone groups** → full-column **manifest** (Voucher·Agency·Customer(lead + "+N" expand)·AD·CHD·INF·FOC·Time·Pickup·Room·Zone·Send back·**Add-on**·Special request·Pay·Total·**Voucher button**). Row no longer navigates — the trailing **Voucher** button (`t2-vcbtn`) opens `bkV2OpenDetail`. **17 columns** (Add-on column added 2026-06-03 between Send back & Special request → longtail/transfer badges from `bk.addOns` `longtail-join`/`longtail-charter` + trip `bundle`/`longtailManual`, built via `addonBadges[]`; head+body+expand `colspan="17"` must stay in sync).
- Routes with a seat-lock but **0 bookings** still appear (merged via `lockRouteIds` into `routeIds`) showing "No bookings yet · seats held by lock".
- Double-click a day in `bkV2RenderCalendar` cell → `bkV2OpenFiltered('',date)` jumps here.
- Helpers: `bkV2Tab2ActiveDate`, `bkV2Tab2DateShift`, `bkV2Tab2Boats`, `bkV2PayLabel`, `bkV2ZoneLabel`, `bkV2LocalYMD`.
- ⚠ **Timezone:** always build YYYY-MM-DD via `bkV2LocalYMD(dt)` — never `toISOString().slice(0,10)` (UTC shift breaks +07:00 date stepping).

### 13.3 New Booking schema additions (`bkV2NewBooking` / saved in `SB_BOOKINGS`)
```javascript
booking.adjustments: [           // review discount / extra · §13.4
  {kind:'discount'|'extra', mode:'amount'|'percent', value, label, note}
]
booking.priceBreakdown: { seat, addOn, focDiscount, discount, extra, total }
trip.charterPriceMode: 'rate'|'manual'   // §13.5
trip.charterPriceManual: Number          // when manual
trip.charterPriceNote: ''
trip.lockUse: 0                          // seats to draw from locks (form-only)
trip.seatSource: { locked:N, general:M } // saved · how seats were sourced
trip.lockDraws: [{lockId, qty}]          // saved · which locks drawn
```

### 13.4 Review adjustments — `bkV2CalcQuote()` + `bkV2RenderReviewPanel()`
- Discount (`%` of base = seat+addOn, or fixed ฿) and Extra charge, each with label + note · multiple rows.
- `grandTotal = seat + addOn − Σdiscount + Σextra` (FOC not charged, informational only).
- Handlers: `bkV2AddAdjustment(kind)` · `bkV2RemoveAdjustment(i)` · `bkV2SetAdjustment(i,field,val)`.
- (Legacy `bkV2RenderQuoteSection()` also updated but **unused** — form renders `bkV2RenderReviewPanel()`.)

### 13.5 Charter price — Rate or Flexible (`bkV2TripSubtotal` charter branch)
- `Rate` = `charterRates[route][boatType]`: starterPrice + extraPerPax×(pax−starterIncludes).
- `Flexible` = manual override (`charterPriceManual`) + note · subtotal returns `rateTotal` + `manualDelta` for the "differs from rate" hint.
- Handlers: `bkV2SetTripCharterPriceMode/Manual/Note` (manual seeds from current rate total).

### 13.6 Seat Locks (§3 feature · `SB_SEAT_LOCKS` in `d.sb_seat_locks`)
**Model:** pool hold · `scope: 'day'|'month'` · `holderType: 'agent'|'office'|'global'`.
```javascript
{id, scope:'day'|'month', routeId,
 date,                  // YYYY-MM-DD · scope==='day'
 monthFrom, monthTo,    // YYYY-MM range · scope==='month' (month kept = monthFrom for compat)
 boatId:null, holderType, holderId, qty, used, reason, expiry,
 status:'active'|'depleted'|'released'|'expired', createdAt, createdBy, log:[...]}
```
- `holderId` for an agent = agent id when the typed name matches `SB_AGENTS`, else the **free-text** name.
- Month scope is a **Start→End range** (`monthFrom`..`monthTo`) · drawable on any date inside the range.
**Helpers:** `bkV2LocksFor(route,date)` (day = exact · month = ym within monthFrom..monthTo) · `bkV2LocksForAgent` (own+office+global) · `bkV2LockRemaining` · `bkV2LockedTotal(route,date)` · `bkV2DayLockedTotal(date)` (all routes on a date · for Calendar) · `bkV2CreateLock({scope,routeId,date,monthFrom,monthTo,...})` · `bkV2DrawLock` · `bkV2ReleaseLock(id, qty?)` (omit qty = release all · partial reduces `qty`, lock stays active) · `bkV2LockExpireSweep` · `bkV2LockKpiByAgent`. Persist: `sbSeatLocksPersist()`.
**Tab "Seat Locks"** `bkV2RenderLocks()` (wrapped `.bkv2-locks` · **RED tone** `#C0392B`): KPI strip · per-holder performance table · create form (`bkV2LockFormFields()` shared) — Scope toggle · Route · Date | Start/End month · Holder · Agent (typeable `<input list=bkv2-lock-agents>`) · Seats · Expiry · Reason · per-trip availability bar (`cap − booked − locked`) · day vs month-range groups · Release → **custom modal** (`_bkV2ReleaseModal` · stepper + "All N") not `prompt()`.
**Lock from Calendar:** SelDay panel button `🔒 Lock seats` → `bkV2LockFromCalendar(routeId,date)` opens an **inline create modal** (`_bkV2LockModalOpen` · `bkV2RenderLockModal()` rendered in `bkV2Render`) — no tab switch. Calendar shows locked seats: day-cell badge `🔒 N` (`.bkv2-cal-lock`) + SelDay per-route `🔒 N locked` + day total.
**Draw in New Booking** (§3c, "ask before every time"): seat-mode banner shows `bkV2LocksForAgent` remaining + stepper (`bkV2SetTripLockUse`) → on `bkV2CommitBooking` a `confirm()` then draws **own agent → office → global** priority, writes `seatSource`/`lockDraws`. No pool double-count: locked seats move from `locked` bucket to `booked` on draw.
**Hard enforcement (locks reduce sellable pool):** `getAllotment()` computes `lockedSeats = bkV2LockedTotal(route,date)` and `seatsAvailable = availableCapacity − seatsConsumed − lockedSeats` (+ `fillPct` includes locked) → propagates to Boat Op, New Booking availability, SelDay. **Anti-overbook guard in `bkV2CommitBooking`** (two tiers): for each seat trip `need = pax − lockUse`; if `need > seatsAvailable` then compare to `physicalFree = seatsAvailable + lockedSeats` — `need ≤ physicalFree` ⇒ would eat LOCKED seats ⇒ **HARD BLOCK** (`alert`, no save · must draw a usable lock / add boat / release lock); `need > physicalFree` ⇒ true physical oversell ⇒ soft `confirm()` (dispatcher adds boat). Drawing from own/usable locks (`lockUse`) lowers `need`. **Net: a booking can never silently consume locked seats.**
**Calendar locked display:** `renderCal()` matrix cells show a `🔒N` marker + tooltip "N locked by sales" (both trip + no-trip cells) — the `🔒` lock count itself is NOT subtracted from the displayed free (locks shown as a separate marker).

**Calendar free = actual bookings (fixed 2026-06-03):** `_calTripsFor(ds,pier)` previously did `free = b.cap − op.booked` (ops/TRIPS counter only) → sales bookings (`SB_BOOKINGS`) never decremented the matrix. Now it computes per-route `getSeatsConsumed(routeId, ds)` (sums seat-mode v2 trips + legacy v1, excludes cancelled/rejected/charter) and allocates it across the route's seat boats (fill first→overflow), so `free = cap − bookedSeats`. Charter boats keep their `op.booked`. Verified: +7-pax booking drops route free by 7; cancelled booking ignored. Backup: `BACKUP/allotment_v2_20260603_pre_calmatrix_booking.html`. Booking-Calendar SelDay has per-route `🔒 Lock` buttons (prefill route into the inline modal) + per-route `🔒N` badges + day total.

### 13.8 Booking persistence + nav fixes (2026-06-03)
- **sb_bookings load** — added load IIFE after the `SB_BOOKINGS` seed array (see §3.2). Without it, commit wrote `sb_bookings` but init always reseeded → new bookings disappeared on refresh.
- **`agTabHist(a)` (Agent → Recent Bookings tab · ~38191)** — was filtering `b.channel===a.id` (wrong field) and reading legacy v1 fields → always empty. Fixed: filter `b.agentId===a.id`; render handles both v2 (`trips[]`, `leadPax`, `bkV2PaxAllTot`) and legacy v1 (`travelDate`/`programId`/`customerName`/`pax.adult`).
- **Dummy bookings removed (2026-06-03)** — the hardcoded `SB_BOOKINGS` seed (11 demo bookings `BK-26050001–006` + `BK-26050038–042`) was emptied to `[]`. A one-time idempotent cleanup right after the load IIFE strips those exact ids from persisted `sb_bookings` too (and re-persists only if any were removed), so demo data clears from existing localStorage while real bookings are kept. Backup: `BACKUP/allotment_v2_20260603_pre_remove_dummy_bookings.html`.
- **Post-commit nav** — `bkV2CommitBooking` (non-edit path) now lands on **By trip · date** at the booking's earliest trip date (`_bkV2.filterDate = firstDate`, `_bkV2.tab='bytrip'`, `_bkV2T2Cursor = firstDate.slice(0,7)`) instead of the All-bookings tab. Verified: new booking persists across reload (+1 survives), shows in agent Recent Bookings, lands on bytrip at the right date. Backup: `BACKUP/allotment_v2_20260603_pre_booking_persist_fixes.html`.

### 13.7 Backups this session (BACKUP/)
`pre_tab2_manifest` · `pre_buildaxis_skin` · `pre_review_adjustments` · `pre_seat_locks` (all 2026-06-02)

### 13.9 Day-of Extra + on-tour Upgrade · commission split + seller (2026-06-13)
Two manifest Add-on actions (icon-only buttons in the Add-on column · **`+`** = extra · **`⬆`** = upgrade · both hidden in van mode). Both modals are editable (✎ per row + ✕ delete · chips in the manifest are clickable to open the manager).
- **Extra** (`SB_EXTRAS` · `bkV2ExtraRender/Save/Preset/Recalc/EditLoad/Delete`): day-of cash sale. Fields service·qty·**ราคา/หน่วย (ขาย)**·**จ่ายบริษัท ฿**·**คอมมิชชั่น = total−toCompany** (auto, live `bkV2ExtraRecalc`)·**คนขาย (seller)**·collected. Stores `{total, toCompany, commission, seller, settle:'pending', method:'cash'}`. Presets `BKV2_EXTRA_PRESETS` (Longtail Join/spot, Private Transfer sedan/van, snorkel, etc.).
- **Upgrade** (`bk.upgrades[]` · `bkV2UpgradeRender/Save/Preset/Recalc/...`): on-tour upsell. Model per user — **กำหนดราคาขาย − จ่ายบริษัท = คอมมิชชั่น** (NOT pulled from Rate Type · selling price unknown to us, we just set sell + company-due, remainder = commission). Fields label·**sellPrice**·**toCompany**·**commission**(auto)·**seller**·collected·note. Presets `BKV2_UPGRADE_PRESETS` (Longtail Join→เหมา, Private upgrade, …). Manifest chip purple `⬆ {label} ฿{sell}` + ⚠ if not collected.
- **Seller** field on both = a typeable `<input list="bkv2-sellers">` datalist from `SB_SALES` names (or free-text guide name) → so **Travel Summary** can group commission/settlement per seller. Both records carry `settle:'pending'` for the Travel-Summary reconciliation (NOT built · see BACKLOG).
- ⚠ **`esc` is NOT global** in this app (defined locally per function). Any new top-level render fn that builds HTML with `esc(...)` MUST declare its own `const esc=...` or it throws silently on click (this bit both `bkV2ExtraRender` + `bkV2UpgradeRender` — fixed by adding local `esc`).
- **Manifest tweaks (2026-06-13):** all `table.t2-mtbl td` → `white-space:nowrap; vertical-align:middle` (one-line rows · Agency + Pickup `.t2-pickcell` get max-width + ellipsis to not overflow). Voucher cell shows `—` when `voucherRef` equals the lead name (staff typed the name in · heuristic). Van-mode **selection count** badge (`.bkv2-selcount`) = big solid **pax** number (not row count) + `· N ราย` muted + pulse animation `bkv2-selpop` on each tick. Backups: `pre_upgrade_feature`, `pre_longtail_perroute` (2026-06-13).

### 13.10 Add-on aggregates in By-trip-date (Longtail Join/Charter/Transfer counts · 2026-06-14)
Ops prep summary of add-ons per trip — "how many longtails / transfers to arrange". Two render spots in `bkV2RenderTab2`:
- **Trip header** — slim chip bar `.t2-addonbar` under `.t2-triphead` (before `boatStrip`): `Longtail Join · N คน` (blue) · `Longtail เหมา · N ลำ` (purple) · `Transfer · N คน` (green). Only shown when >0. Counts computed in the existing `grp.forEach` pax loop into `ltJoinPax`/`ltCharterBoats`/`ptPax`.
- **Family-card boat grid** (`.t2-vcard`/`.t2-vbrow` per-boat rows + family footer) — per-boat `o.ltJoin/ltChtr/pt` chips (text labels, no emoji per user) + family-total `_fLtJoin/_fLtChtr/_fPt`. Per-boat join attributed to `bk.ops.boatId`; unassigned bookings count in family total only (not per-boat — that's why per-boat sum can be < family total until boats are assigned).
- **Shared detection** `bkV2AddOnFlags(bk, routeId)` → `{join, charter, transfer}` (charter & join mutually exclusive · charter wins). Same logic as the manifest Add-on cell: `bk.addOns[]` types `longtail-join`/`longtail-charter`/`transfer-*` + materialised `trip.bundle`/`trip.longtailManual` + Rate-Type `routeBundles[route].longtail`. Trip-header loop also refactored to use it.
- **Day-of "+ extra" longtail IS counted** — `bkV2LongtailExtraPax(bkId, date)` sums `SB_EXTRAS` where `service` matches longtail (`Longtail Join`/`Longtail (spot)`/หางยาว · qty = people · scoped to trip date). Added to `ltJoinPax` (trip header) + `o.ltJoin`/`_fLtJoin` (family grid). Charter is not an extra preset. Verified: node tests (flags 5 cases + extra helper 4 cases) + `node --check`. Backup: `BACKUP/allotment_v2_20260614_pre_addon_trip_summary.html`.

---

## 14. Demand / Market Intelligence module (2026-06-04/05)

> Nav item `marketdata` → `#view-marketdata` → `renderMarketData()` → body `#md-body`. SheetJS (`XLSX` from cdnjs) parses immigration `.xls`.

**Data:** `SB_MARKET_STATS[YYYY-MM-DD] = {date, in:{thaiNat:count}, out:{...}, inTotal, outTotal, inAt, outAt}` · LS key `sb_market_stats` · persist `sbMarketStatsPersist()`. Ingest via `mdIngest(aoa,dir,grand,iso)` (global · used by importer + headless seeding). **`mdDirTot(d,dir)`** returns the official grand-total row (`รวม`) when present, else sums — use it everywhere for totals. `MD_NAT_TH2CODE` / `MD_CODE2EN` map Thai nat name ↔ 2-letter code.

**6 tabs** (`_mdTab` · `mdSetTab`): `overview` · `forecast` · `gap` (Market Gap · penetration **Index** = our-mix-share ÷ arrival-mix-share ×100; ≤70 = under-indexed opportunity · **2026-06-06: added a real `Capture` column = our pax ÷ arrivals** — the honest market share, small everywhere — because Index>100 is only *relative* weighting and was being misread as "we're strong in that market". Gap table now shows both Capture + Index; opp chips show capture %; the Overview "Top opportunities" card likewise shows `Ours` + real `Share` instead of the mix index. `_capFmt`/`_shFmt` show 1-decimal under 10%, `<0.1%` for tiny non-zero.) · `season` · `ops` · `sales`. Penetration "Our pax" needs `bk.leadNationality` — `mdBkCode(b)` resolves field→guess-from-name→passenger; `mdBackfillNat()` + "missing nationality" list + `bkV2CleanupNats()` in the Gap tab.

**⑤ Sales & Agents tab — real Sales-Team KPI dashboard (2026-06-07).** `mdTabSales` rewritten: pulls booking → agent → owner via `agent.sales` (SB_SALES s01..). Sections: **north-star 5** (Sales value + MoM · Pax · Collected % + AR · Cancel rate + no-show · Active agents N/total) · **Team leaderboard** (per-salesperson: Sales/Pax/Bk/Coll%/AR/Cancel%/Active/MoM, colored dot from `s.color`, red/green flags) · **Top agents** (by sales value · Agent/Owner/Market/Pax/Sales/Coll/Cancel) · **Sales-by-person bars**. Money from invoices (`acctBookingInvoice`/`acctInvoicePaid`/`acctInvoiceBalance`), cancel from `b.cancelCategory`/status, active = agent with a booking in last 30d (`bkDate` = bookingDate or earliest trip). MoM by `bookingDate` month. Backup: `BACKUP/allotment_v2_20260607_pre_sales_kpi.html`. **Added groups 7-9 (2026-06-07):** **Discounts & FOC** (gross · discount ฿+% · extra · FOC pax+% · from `priceBreakdown` + foc pax keys) · **Product mix** (pax by program family `bkV2RouteFamily` · by pier `getRoute().pier` · ฿ by channel from `agent.payType` · add-on attach rate from `b.addOns`) · **Market effectiveness** (pax by `agent.market` + top-nationality Capture % reusing `mdArrivalsByCode`/`mdOurMixByCode`). (Pending: conversion rate needs a quote stage · per-person targets/quota not stored yet.)

**Importer** (2026-06-05) — moved to a **liquid-glass button** top-right of the Demand header (`.md-import-glass` in `<style id="md-glass-skin">`), not a full-width dashed box. `mdImportFiles(files)`. Empty-state points to it.

**Glass skin** — `<style id="md-glass-skin">`: `#view-marketdata` light gradient bg + 3 pastel blur blobs (`::before` peach, `::after` mint, `.md-blob3` pink element inside the view). **`.md-gp` = white liquid-glass panel at 18% opacity** (`rgba(255,255,255,.18)` + `blur(16px)`), used by the Overview only. `.md-card`/`.md-kpi` (other tabs) stay higher opacity. `md-dark` theme exists but disabled.

### 14.1 Overview redesign — `mdTabOverview(days)` (white liquid-glass · 2026-06-05 · **full-width 3-zone relayout 2026-06-06**)
**Layout (2026-06-06):** Overview runs **full-width** (`renderMarketData` wraps `band+body` in `max-width:100%` when `_mdTab==='overview'`, else 1200px — other tabs unchanged). `mdTabOverview` returns a **3-column grid** (`grid-template-columns:1.25fr 0.85fr 1.9fr · align-items:start`) per user's drawn mockup:
- **Col 1** (flex stack): `[gauge | pace]` (2-up) → **Recent arrivals chart** → **Top opportunities**.
- **Col 2** (flex stack): **Top markets** → **Net in-island**.
- **Col 3:** big **Nationality leaderboard** (**top-50** · `sorted.slice(0,50)` · internal 2-col `1fr 1fr` = 25/25 · In·Out·Net flow) — the hero panel on the right, runs the full height of the left stack. Backup: `BACKUP/allotment_v2_20260606_pre_overview_layout.html`. (Evolved 06-06: 4-card row → full-width leaderboard-up → this 3-column hero-leaderboard layout.)
- **Gauge** = SVG dasharray arc, `curYTD / prevYearTotal` fraction, "2.45M YTD". **Slider** = latest-month / peak-month pace %.
- **Chart** `#mdOvChart` (viewBox `0 0 940 300`, `max-height:300px`) — interactive **Year / Month / Week** toggle + smooth Catmull-Rom curves + dashed crosshair + tooltip. Globals: `_mdOv` (state+configs), `mdOvDraw(mode)` · `mdOvMode(m)` · `mdOvInit()` (called by `renderMarketData` after innerHTML, since innerHTML doesn't run `<script>`) · `mdOvHover(e)` · `mdOvCrossHTML(idx)` · `_mdOvMonthly(days)` (daily→monthly by year) · `_mdOvFmt` (K/M). Year = monthly 2 years; Month = daily of latest month; Week = last 7 days. Default mode = whichever has most points. ⚠ Sparse data (1 month imported) → Year shows 1 dot — that's correct, not a bug.
- **Top markets** = cumulative arrivals per nat (avatar tiles, badge = latest-day arrivals). **Net in-island** = cumulative `in − out` per nat, same tile style for side-by-side compare: **cumulative total on the right badge (no `+` sign · `−` only for deficit)**, latest-day `+/−` under the country name. Backups: `pre_overview_glass`, `pre_white_balanced` (2026-06-04/05).

### 14.2 FOC detail — pivot table in ⑤ Sales & Agents tab (`mdTabSales` group 7b · 2026-06-14)
New card under "Discounts & FOC" (`focDetail`, inserted in the return between `disc7` and `mix8`). Per-agent FOC breakdown so staff can see who got free seats, on which trip/date, why, and whether it's worth it vs the agent's volume.
- **Layout (per user's drawn mockup):** flat table, **program-family columns** (Similan · Surin · Phi Phi · Krabi · Whale — same `FAM_ORDER`/`famHdr`/`famCol` as Top agents), **rows = travel date**, cell = FOC count for that family on that date (soft `famCol` badge · `·` when zero). Agent-level columns (**Agent · Sale · Market · Total FOC · Number cus · Sale value**) are **`rowspan`-merged** (shown once per agent, vertically centered). Column order: Agent · Sale · Market · **Date** · [5 families] · Total FOC · Reason · Number cus · Sale value.
- **`Number cus`/`Sale value` = performance EXCLUDING FOC:** `paidPax = A[agentId].pax − r.fc` (the `A` agg pax includes FOC); sale value is already net (FOC = ฿0). Footnote spells this out.
- **Sections Agent vs Staff (2026-06-14):** rows split into two banded sections via `isStaffRec(r)` = agent `code==='STAFF' || id==='a_staff'`. Header band rows (`focSecHdr`, `colspan=13`) "AGENT" / "STAFF" with per-section count + FOC sum. Real-agent bookings whose FOC reason is "Inspection" still sit under **Agent** (only the staff house-agent goes to **Staff**).
- **FOC reason now REQUIRED to approve (2026-06-20 PM):** the "—" reasons in the detail were genuinely empty (5/17 FOC bookings had no `focReason`/`focApproval.reason` — not a render bug; render reads both fields correctly). New Booking already enforces it (`bkV2SubmitBooking` line ~50098 blocks save when FOC & no `focReason`). The gap was the **FOC approval** (`bkV2FocApprove`) which approved even with an empty reason → now if `focApproval.reason||focReason` is empty it **prompts for a reason and blocks approval if still blank** (writes to both `focApproval.reason` + `focReason`). ⚠ Existing already-approved FOC with no reason stay "—" (can't re-approve) — backfill via editing the booking if needed.
- **Data build:** `focAg[agentKey] = {agentId, agentName, fc, bks{}, sps{}, byDate:{date:{total, fam:{fid:count}, reasons:{}, anyPending, allApproved}}}`. Reason from `bk.focApproval.reason||bk.focReason`; status chip approved/pending from `focApproval.status`. Render fn `renderRec(r,ai)` (zebra by agent index) + `focSecHdr`. Design: family-color badge pills, amber Total-FOC pill, left accent bar (blue=has sales / gold=none), header band `#FAF9F5`. Backup: `BACKUP/allotment_v2_20260614_pre_foc_detail.html`. ⚠ Pending follow-on noted in BACKLOG: **Cost-per-head & PFM** module (compare agent price vs route cost/head incl FOC+CXL).

---

## 15. Booking v2 additions (2026-06-05 session)

### 15.1 Reschedule (move date) — analogous to Cancel
- **Buttons:** Voucher detail topbar has **Reschedule** (blue · `bkV2DetailIcon('clock')`) next to Cancel (`canCancel` gate).
- **Flow:** `bkV2DetailReschedule` → `bkV2RescheduleModal(bookingId)` → `bkV2RescheduleConfirm` → `bkV2RescheduleBooking(bookingId, {fromDate,newDate,chargeType,chargeAmount,collect,reason})`. Toggle `bkV2RescheduleToggleAmt`.
- **Modal:** Move-from (dropdown if multiple trip dates, else fixed) → New date · fee radios **none/full/partial** · collection toggle (shown when fee>0) **invoice vs separate** · reason (required) · checkbox **"เปิดหน้าแก้ไขต่อ เพื่อปรับ pickup/รับส่ง"** → on confirm calls `bkV2EditBooking` (for self-arrival→transfer change cases).
- **Behaviour:** moves trips on `fromDate`→`newDate` (carries charter `TRIPS` lock); sets `bk.reschedule={fromDate,toDate,reason,chargeType,chargeAmount,collect,at,by}` + `bk.rebook={from,to,reason:'manual',at}`. **Trip continues — original price stands; fee is extra.**
- **Fee = line on the booking's OWN invoice** (NOT a separate invoice · per user). Stored as `bk.feeItems=[{type:'reschedule',label,amount,at}]`. `collect==='invoice'` → if booking already invoiced, top up that invoice (`subtotal/netAmount/total += charge` + push `lineItems`); else fee waits on `feeItems` and rides the invoice when created. `collect==='separate'` → recorded on `bk.reschedule` only, no invoice line.
- **Ghost + badge** (like weather): original-date manifest shows a faint "Rescheduled away · Moved → <newdate>" ghost row (route surfaced via `reschedFromRouteIds` even with 0 active bookings); new-date row shows `↩ Moved from MM-DD` badge. Generalised the weather ghost/badge code to also handle manual `bk.reschedule`/`bk.rebook.reason==='manual'`. History tag `Reschedule`. Backups: `pre_reschedule`, `pre_reschedule_ghost`.

### 15.2 Accounting — fee items on bookings
- `acctBookingBase(bk)` = price only; **`acctBookingTotal(bk)` = base + Σ`feeItems`** (so fees flow into invoice subtotal, credit, balance everywhere).
- `acctDocLineItems(inv)` — standalone fee invoice (`inv.feeType`) renders its own `lineItems`; otherwise emits **base row per booking + one row per `feeItems`** (labelled, e.g. "Reschedule fee"). Doc rows sum == invoice total. `acctCreateFeeInvoice(...,feeType)` gained optional 5th param (cancellation still default).

### 15.3 Big-group fast entry — "Paste group list"
- New-booking Guests section header (left-aligned, `margin-left:auto` button) → **📋 Paste group list** (`bkV2GroupPasteOpen`). Paste one name/line, optional `, NAT` after comma. `bkV2GroupPasteApply`: first = Lead, sets trip[0] `ad_fr`/`ad_th` from nat split, `bkV2SyncPassengers()`, fills passenger names+nationality in order. Names are optional for booking (only Lead required) — fastest path is just counts + Lead. `_bkV2GrpNat` resolves code/name/guess.

### 15.4 Manifest fixes (By-trip-date)
- **Bundle longtail badge** — manifest only checked `trip.bundle` (never materialised). Added fallback: resolve booking's Rate Type (`bk.rateTypeRef` or agent's `rateTypeId`) → if `rt.routeBundles[route].longtail` exists, show "Longtail (incl.)" (free) / "(bundle)" (paid). Render-time → shows for existing bookings too. (e.g. Whale Shark / Phi Phi / Maiton Sunset.)
- **Extra charge / discount chips** — review-level `bk.adjustments` (kind extra/discount) were baked into total but invisible. Now render `adjChips` in the Add-on cell: `Extra +฿X` (amber) / `Disc −฿X` (red); percent computed from `priceBreakdown.seat+addOn` (tooltip shows %). Backup: `pre_bundle_badge`.

### 15.5 Bug fixes
- **Agent VAT not loading on edit** — `agEditOpen('profile')` draft omitted `vatMode` → modal always showed "ไม่มี VAT" and **saving wiped the saved value**. Fixed: draft now includes `vatMode:a.vatMode||'none'`.
- **Nationality manual-add (no more auto-add)** — `bkV2NatDDBlur` no longer auto-creates a custom nat on blur (reverts to saved). Dropdown shows an explicit **"+ Add ‹text› as new nationality"** row (`bkV2NatDDAddNew`). `bkV2AddCustomNat` + cleanup reject <2-letter names. One-time IIFE purges junk single-letter customs (e.g. stray "Q") + clears them off bookings. Backup: `pre_nat_manual_add`.

### 15.6 Backups this session (2026-06-05)
`pre_nat_manual_add` · `pre_overview_glass` · `pre_reschedule` · `pre_reschedule_ghost` · `pre_bundle_badge`

---

## 16. Earlier Booking v2 work — now documented (2026-06-04/05, was undocumented)

> These shipped earlier in the session but weren't in CLAUDE.md until now. Companion docs: **`SYSTEM_MAP.md`** (AI-readable architecture map · ~207 lines) and **`BACKLOG.md`** (pending items) live in the workspace root.

### 16.1 Weather cancellation — 2-phase per-booking resolution
- **Mark a trip weather-closed:** `bkV2WeatherTagBookings(routeId,date)` tags every active booking on that route+date with `bk.weatherResolve={event:'routeId|date', status:'awaiting'}` + history tag `Weather`. Helpers: `bkV2WeatherMark`/`bkV2WeatherMarkConfirm`/`bkV2WeatherCancel`, panel `bkV2WeatherPanel(routeId,date)`.
- **Workflow states** (`weatherResolve.status`): `awaiting` → `notified` (`bkV2WeatherNotify` · agent told, awaiting customer) → `resolved`. **Outcomes** (`weatherResolve.outcome`, set by `bkV2WeatherResolveOne(bkId)`): `reschedule` (moves `t.date`→newDate, sets `bk.rebook` reason `weather`), `refund` (negative payment + void invoice + `bk.refund`), `credit` (`acctCreateDeposit` + void invoice), `cancel` (`status='cancelled_weather'`, no refund).
- **UI:** manifest gets a red **⛈ Manage** column when the trip is weather-closed (`bkV2WeatherInlineCell(bkId)` · mirrors the per-booking workflow inline). Calendar (Ops + Booking) show weather counts via `bkV2WeatherCountsFor(routeId,date)` → cancelled / rescheduled / pending pax. Trip header shows the weather summary instead of normal pax. English labels throughout. Faint-red tint over weather-closed blocks + ghost rows on the original date (§15.1 generalised this to manual reschedule too).

### 16.2 Booking History timeline (audit trail)
- `bkV2AddHistory(bk, kind, text, tag)` pushes `{at,kind,text,tag,by}` to `bk.history`. Rendered in the Voucher detail as a colored timeline; tag colors via `bkV2HistTagColor(tag)`. Tags: `Created · Edited · Confirmed · Invoice · Payment · Reschedule · Cancel · Refund · Credit · Notify · Weather · FOC · Extra`. Falls back to `bk.rebook` for bookings created before history logging.

### 16.3 By-trip-date Pay column + Cash-on-tour
- Pay cell = clickable chip `bkV2PayChip` color-coded by `agent.payType` (**Invoice / Pro Forma / COT**) → `bkV2RowPayAction(bkId)` modal (issue invoice/proforma + record payment + view doc · single source `acctCreateInvoice`/`acctRecordPayment`).
- **Cash on tour** shown in the Pay column as a cyan chip (from `bk.cashOnTour` or parsed from notes).

### 16.4 Required-field validation (`bkV2CommitBooking` · hard block + soft warn)
- **Hard block** (`missHard[]`, can't save): Agent / B2C channel · Trip (route+date) · Pax ≥ 1 · Lead passenger name · Rate Type · **Lead nationality** (auto-guesses from lead name via `bkV2GuessNationality`; blocks only if unguessable) · Guide language · **Hotel/pickup location when a pickup area is selected** (EXCEPT No-Transfer → becomes an optional note).
- **Soft warn** (allow save · ⚠ flag): missing pickup → ⚠ badge in manifest (`no pickup`).

### 16.4b Lead seat-type — Lead occupies a real seat (REWORKED 2026-06-10)
**Original (2026-06-08):** model treated Lead as Adult #1 (`additionalAd = totAd−1`). An all-FOC group (0 Adults · lead is a free guide) left the Lead uncounted, so a `confirm()` guard in `bkV2CommitBooking` *added* the lead as +1 FOC/Adult.

**Reworked 2026-06-10 (per user — "ถ้ามี 1 FOC รายชื่อก็ควรเป็น 1 เท่านั้น"):** the **+1 guard was removed**. `bkV2SyncPassengers` now gives the Lead a **real seat of its own type**: `leadType = totAd>0 ? 'AD' : totFoc>0 ? 'FOC' : totChd>0 ? 'CHD' : totInf>0 ? 'INF' : 'AD'` (stored on `d.leadType`). The extra-passenger list (#2+) subtracts 1 from the lead's bucket (`exAd/exChd/exInf/exFoc`), so **names list length == head count exactly** (an all-FOC group of N = N names = N heads, no empty extra Lead row, no double-count). The Lead row in the Guests table shows a small **type badge** (e.g. FOC amber) when `leadType!=='AD'`. Mixed groups (any adult) behave exactly as before (lead = Adult #1). Backup: `BACKUP/allotment_v2_20260610_pre_lead_foc_merge.html`.

### 16.5 Booking record fields (for audit + forecasting)
- `bk.bookingDate` (default today, editable) · `bk.submittedBy` / `bk.confirmedBy` (English labels · **no "RM" default**, no Thai) · `bk.marketSnapshot` (frozen market at booking time · used by Demand forecasting) · `bk.paymentSnapshot` (payType/method snapshot).

### 16.6 ⚠ Edit data-loss bug — boat assign / day-of records wiped on edit (FIXED 2026-06-14)
**Reported:** จัดเรือแล้ว → แก้ booking → save → เรือที่จัด "เด้งออก" (boat assignment gone). **Root cause:** `bkV2CommitBooking` rebuilds a fresh `newBk` object and writes `SB_BOOKINGS[idx] = newBk` — the edit-preserve block only carried `history`/`weatherResolve`/`rebook`/`invoiceId`/`paymentStatus`, **NOT `bk.ops`** → boat assign (`ops.boatId`), van group/van/return, reconfirm, final pickup time, upgrade flag all wiped every edit. **Fix:** the `if(editing){…}` preserve block now also carries over `editing.ops`, `editing.upgrades` (on-tour upsell · lives on `bk`), `editing.feeItems`, `editing.reschedule`, `editing.partialCancels`, `editing.cancellation`, `editing.cancelCategory`. (`SB_EXTRAS` is a separate store keyed by bookingId → was never affected.) ⚠ If an edit changes a trip's route/date the kept `ops.boatId` stays (boatId is per-booking, not per-leg) — better than wiping. Backup: `BACKUP/allotment_v2_20260614_pre_edit_ops_preserve.html`.

---

## 17. Maintenance Job — "+ All engines" single/split choice (2026-06-06)

> Fleet · Maintenance Job detail (`flRenderMaintDetail`) · the **"+ All engines"** button (`onclick=flMaintAutoAddEngines`, ~line 25199) shown for preventive/scheduled jobs.

**Problem reported:** opening an existing MJ (e.g. MJ-041 under project PRJ-013) and clicking "+ All engines" silently dumped all 4 engines into the one open job — no prompt. The single-vs-split choice (`fl-modal-job-choice` / `flChooseJobMode`) **only existed in the create-MJ-from-Incident flow** (`flSaveCreateJob`, fires when `inc.damagedAssets.length>1`). The "+ All engines" / "+ Add asset" buttons on an already-open job never offered it.

**Fix — new choice on "+ All engines"** (`flMaintAutoAddEngines` refactored ~line 25344):
- Computes `toAdd` = boat engines **not already** in `m.assets`. If `toAdd.length>=2` → opens **`fl-modal-eng-choice`** (mirrors the job-choice modal · orange icon); else adds the single engine directly.
- **รวมเข้างานนี้** (Recommended · `flChooseEngMode('single')`) → `flEngAddAllToJob(jobId)` = the original behaviour (all engines as affected assets of this one job).
- **แยก 1 งาน/เครื่อง** (`flChooseEngMode('split')`) → `flEngSplitIntoJobs(jobId)`: engine[0] stays in the open job (title gets ` — <serial · pos>` suffix), engines[1..] become **new cloned MJs** (next `MJ-NNN` via max-no, `flAssertUniqueNo`). Each clone inherits `boatId/type/detail/location/startDate/boatStatus/boatStatusReason/setFixing/incidentId` and **`parentProjectId`** (so they stay under the same project) + progress log `+ Split from MJ-xxx`; parent project gets a `+ Split engines → MJ-a, MJ-b…` log entry.
- New fns: `flEngAddAllToJob` · `flOpenEngChoiceModal` · `flChooseEngMode` · `flEngSplitIntoJobs`. New modal `#fl-modal-eng-choice` (`fl-ec-count` / `fl-ec-count-2` / `fl-ec-preview`). State var `window._flEngChoiceJobId`.

**Split an ALREADY-combined job — `flSplitExistingJob(jobId)`** (2026-06-06 · added after the above). The "+ All engines" modal only fires when there are engines *left to add*, so a job already holding all its engines (MJ-041) couldn't be split that way. New button **"⎘ แยกงานนี้"** renders in the Affected-assets toolbar (next to "+ Add asset") **only when the job has ≥2 engine assets** (`(m.assets||[]).filter(a=>a.engId).length>=2`). On click → `confirm()` → engine[0] **stays** on this job (title → `baseTitle — <serial · pos>`, prior ` — suffix` stripped via regex), **non-engine assets (gearbox/propeller/hull) stay on the first job**, and engines[1..] become new cloned MJs (same inheritance + `parentProjectId` as `flEngSplitIntoJobs`). No manual removal needed. Parent project logs `+ Split MJ-xxx → MJ-a, MJ-b…`.

**Untouched:** Incident create flow (`fl-modal-job-choice`), schema, "+ Add asset" button. No schema changes — new fns (`flEngAddAllToJob`/`flOpenEngChoiceModal`/`flChooseEngMode`/`flEngSplitIntoJobs`/`flSplitExistingJob`) + one modal + one toolbar button only. Backup (covers the whole 06-06 session): `BACKUP/allotment_v2_20260606_pre_engine_split_choice.html`.

**"ถอดเก็บ" — stash gearbox/propeller as Spare (2026-06-06).** Use case: when an engine is sent for repair, its gearbox + propeller are NOT repaired — they're physically removed and stored. So they shouldn't sit as repair-job assets. New button **"📦 ถอดเก็บ"** renders on **gearbox/propeller** asset rows (only `a.gbId||a.propId`, job not done) in `flRenderMaintDetail` → `flMaintStashOpen(jobId,idx)` opens modal `#fl-modal-stash` (storage-location dropdown from `FL_STASH_LOCS` · optional note) → `flMaintStashConfirm()`:
- sets the gearbox/propeller record `status='spare'` + `spareLocation=<key>` (mirrors the existing Spare concept in `flSaveGearbox`), **detaches** it (gearbox `engineId=null` / propeller `gearboxId=null`), pushes a `{type:'remove'}` entry to the part's `log` (records origin + destination).
- **removes the asset from the MJ** + logs `📦 ถอด<เกียร์/ใบจักร> … ไปเก็บที่ <loc>` on the job's `progressLog`.
- `boatId` kept (origin history). Location keys use the same `pier:`/`shop:` format as the gearbox/propeller edit forms. State var `window._flStash`. No schema changes. Backup: `BACKUP/allotment_v2_20260606_pre_stash_gearprop.html`.

**Start-time gear/prop question (2026-06-06).** Mirrors the Incident "where do the remaining assets go?" prompt, asked at the natural moment — when a **scheduled/preventive** engine job is **Started**. `flMaintStart(id)` is now a **guard**: for scheduled/preventive jobs it calls `_flMountedGearProp(m)` (finds gearboxes where `gb.engineId===engineAsset.engId && status!=='spare'`, plus propellers where `p.gearboxId===gb.id`, across all engine assets — note: these parts are NOT job assets, they're resolved from the relational links). If any exist → opens modal `#fl-modal-start-gear` and defers; else calls `_flMaintStartProceed(id)` (the original start logic, renamed). Modal choices: **คงเดิม** (`flStartGearChoice('keep')` → just proceed) / **📦 ถอดเก็บ** (`flStartGearChoice('stash')` → stash every listed part via shared `_flStashPartRecord()` at the chosen location, log on job, then proceed). Shared helper `_flStashPartRecord(rec,isGb,locKey,locLabel,srcNo,note)` is also used by the manual `flMaintStashConfirm`. ⚠ **Seeding bypass:** the MJ-019 deferred-start hook now calls `_flMaintStartProceed` (not `flMaintStart`) so seeding never pops the modal; INC-008 hook already replicates start inline. State var `window._flStartGear`. No schema changes.

---

## 18. Pickup Setup — Areas + per-area time schema + auto-inherit (2026-06-07)

> Nav `pickup-setup` → `renderPickupSetup()`. Data: `SB_PICKUP_AREAS` (`{id,name,zone,region,timeGroup}` · LS `sb_pickup_areas`) + time **profiles** `SB_PICKUP_TIME_PROFILES` (`{id,name,from,to,times}` · LS `sb_pickup_time_profiles`) + legacy flat `SB_PICKUP_TIMES[routeId][timeGroup]` (LS `sb_pickup_times`). Persist: `psuPersist()` (read-modify-write).

**Zones are hardcoded** `['PK','KL','NoTransfer']` — UI can add **Areas** (`+ Add Area` → `psuSaveArea`) but NOT zones. Adding a zone = code change (§12).

**Time schema is now PER-AREA, not per-time-group.** Current: `profile.times[routeId][areaId] = 'HH:MM-HH:MM'`. The **Time matrix tab columns are individual areas** (`tg.id = areaId`), and cells read `profTimes[routeId][areaId]` **directly** (no fallback in the editor). `timeGroup` is now just an organising label + a *resolver* fallback. Booking-time resolver `bkV2GetPickupTime(routeId,areaId,date)` order: profile per-area → profile per-timeGroup (legacy) → flat `SB_PICKUP_TIMES[routeId][timeGroup]`.

**Consequence + fix:** a newly added Area had blank matrix cells (the profile had no per-area entry yet) even when its `timeGroup` matched an existing cluster — i.e. picking a time group did NOT auto-fill. **Fixed 2026-06-07:** `psuSaveArea` now calls **`_psuInheritTimesForArea(area)`** after add/edit → for every profile × route, fills the new area's **empty** cells by copying from a **sibling area in the same `timeGroup`** (else legacy `SB_PICKUP_TIMES[route][timeGroup]`). Only fills empties (never overwrites) · runs on both add and edit (so re-saving an existing blank area like "Kathu" backfills it). Toast shows N cells filled. Backup: `BACKUP/allotment_v2_20260607_pre_area_time_inherit.html`.

---

## 19. Transfer Fleet route-matrix + Van grouping + Booking fixes (2026-06-11/12)

> Companion: `OPERATIONS_PIPELINE_DESIGN.md` (pipeline §1.3 Van Assign has the full grouping spec). Backups in `BACKUP/allotment_v2_20260611_*` and `_20260612_*`.

### 19.1 Transfer Fleet · month-matrix assigns a real ROUTE per day (2026-06-11)
Nav `vehicles` → `renderVehicles()` · tab `matrix` (ตารางเดือน). Each cell = one vehicle×day; **click = cycle through the real ROUTES open that day** (not grouped families · user: "แยกตามโปรแกรมจริง"), right-click = popup picker + status. Stored on `v.dayRoute[date]=routeId`.
- Helpers: `_vehRoute(rid)` · `_vehRouteZone(rid)` (panwa→PK, tublamu→KL) · `_vehRouteAbbr(rid)` (=route number) · `_vehRouteShort(rid)` · `_vehRoutesOpenOn(date)` · `_vehRouteDemand(routeId,date)` ({pax, pickup} from `SB_BOOKINGS` trips · pickup = pax with a transfer zone).
- `vehEffectiveZone(v,date)` checks `dayRoute → _vehRouteZone` FIRST (so Van Assign's `vanVehiclesForZone` auto-scopes by the day's program/zone).
- Cell colored by route color + route-number; Van-Assign jobs count moved to a corner badge. **Status (จากหน้าสถานะ via `vehStatusOn`) is the base layer** — available=✓ green, ซ่อม=🔧, หยุด=⛔; off/maintenance overrides route color. Popup shows status first (read-only + "จัดการช่วงสถานะ"), then route picker (disabled when off/maintenance).
- **Summary cards** above the matrix (`_vehMatrixSummaryHTML(day)`, container `#veh-matrix-summary`): per real program, **N คัน + ลค pax** demand for the selected day; programs with demand but **0 vans → red "ยังไม่จัดรถ"** flag. Click a day-header to change the summary day (`vehSumSelectDay` · `window._vehSumDay`).

### 19.2 Van Assign · MANUAL tick-to-group (2026-06-12 · auto-assign dropped per user)
In **By-trip-date → Van Assign mode**. Model: **`bk.ops.vanGroup`** (number, scoped per route+date+zone) = which group a booking is in; **a group can exist before a van is chosen** (van optional/later). Van column = a **✓ checkbox + group chip** (`bkV2VanCellHTML`).
- Flow: tick rows → **action bar** above the zone table (`เลือก N แถว · M pax → จับเป็นกรุ๊ปใหม่ / + กรุ๊ป N / ล้าง`, big count) → `bkV2VanGroupSelected(date,routeId,zone,'new'|gid)` bundles them. Rows then **cluster together** (sorted by group, then time) under a **group header row** (`_grpHeaderRow`).
- **Group header (van mode):** `กรุ๊ป N · pax/cap · van <select> (เลือกทีหลังได้) · ตั้งเวลาทั้งกรุ๊ป · รถกลับ <select> · ✓ Save · 🖨 Job order · ยกเลิกกรุ๊ป`. Van list scoped via **`vanVehiclesForRoute(date,routeId,zone)`** = vans whose `dayRoute===routeId` that day, else zone vans (fixes "showed all vans"). **Save** = `bkV2VanGroupSave()` (persist + re-sort by time).
- **Per-hotel pickup time:** Time column is an **editable input per booking** in van mode (`bkV2SetPickupFinal` · no re-render = keeps focus); group header has a **set-all** time. Sort within a group = by `pickupTimeFinal`/orig.
- **Return van per booking:** each grouped row has a `↩ รถกลับ` `<select>` (`bkV2AssignVanReturn` → `bk.ops.vanReturnId`); group header has a set-all `รถกลับ` too.
- **Lean columns in van mode:** hides Add-on / Pay / Total / Voucher (−4 cols). **`COLN`** (per-trip) drives ALL colspans: `(18 − (vanMode?4:0)) + (vanMode?1) + (rcMode?1) + (wxClosed?1)`.
- **Normal manifest shows the grouping too** (read-only · soft pastel): when bookings have `vanGroup`, rows cluster + shade with the group's light color (NO left-accent bar) under a slim read-only header (`🚐 กรุ๊ป N · ชื่อรถ · เวลา`). Ungrouped = "ยังไม่จัด". `_grouped = vanMode || _anyGroup`.
- Fns: `bkV2VanSelToggle/SelClear` · `_bkV2VanNextGroup` · `bkV2VanGroupSelected/SetVan/SetTime/SetReturn/Save/Disband`. Selection state `window._bkV2VanSel`. (`bkV2VanAutoAssign` left defined but unused.)
- **Split a big booking across vans (2026-06-13):** **✂ แยกคน** (`bkV2VanSplit`) → `bk.ops.vanSplits=[{pax,vanGroup,vanId,vanReturnId}]`; booking renders as **allocation rows** (selection key `bkId@i`), so 16=12+4 join different groups/vans. `bkV2VanUnsplit` merges back. Manifest builds an `alist` (one entry per allocation) — clustering/group-pax/Vans-strip/Van-Job all allocation-aware. **1 van = 1 group**: van used by another group is `disabled` in the group's picker. Pax cells for split rows collapse to a colspan-4 "N pax (แยก)".
- **Van Job Orders = sidebar page** (`renderVanJobs` · nav `vanjobs` under Transfer Fleet · `view-vanjobs`): date stepper + per-van card + พิมพ์ใบงาน (`bkV2VanJobOrder`, alloc-aware). Removed the inline Job-order buttons + the old slide-out panel from the manifest.
- ⚠ **Sticky header still glitchy** (TODO 2026-06-13 · see BACKLOG): `.t2-tblscroll` set to `overflow:auto;max-height:calc(100vh-210px)` + sticky `thead th` — freezes the column header but van-mode group headers/action-bar scroll oddly. To revisit.

### 19.3 Over-capacity → manager approval (2026-06-12)
**Capacity model (user clarified):** company `boat.cap` = the booking cap; **real seats = `boat.licensePax`** (registered). `getAllotment` now also returns `licenseCapacity` / `licenseAvailable`.
**Commit guard tiers** (`bkV2CommitBooking`): `need ≤ seatsAvailable` → book normally · would eat **LOCKED** seats → hard block · **over cap but ≤ license** → saved as **`status:'pending_approval'`** (NOT confirmed · still counts seats so nobody double-books) · **over license** → **hard block** ("add a boat").
**Approval queue:** new Booking tab **"รออนุมัติ"** (`bkV2RenderApprovals` · red count badge) lists pending cards (booking · เกิน cap N · per-trip need/over/real-seats-left) with **✓ อนุมัติ** (`bkV2ApproveBooking` · prompts manager name → status = `targetStatus`/confirmed) / **ไม่อนุมัติ** (`bkV2RejectBooking` → `rejected`) + recent history. Manifest shows a red **"รออนุมัติ"** badge by the lead name. Data: `bk.approval = {status, reason:'over_capacity', targetStatus, over:[{routeId,date,need,overBy,licFree}], totOver, requestedBy, approvedBy, approvedAt, note}`.

### 19.4 Booking passenger-count + FOC fixes (2026-06-12)
- **Multi-trip over-count fixed:** `bkV2SyncPassengers` summed pax across ALL trips → a 2nd trip inflated the names list (25AD+2FOC + a 2-pax leg → asked 29 instead of 27). Now sized to the **largest single trip** (guests are one group across a booking's trips). `bkV2BumpPax` re-syncs on any pax key (not just adults).
- **Lead can be FOC** (user: "ไม่บังคับให้มี AD · Lead เป็น FOC ได้"): new **`d.leadFoc`** flag + ☆/★ FOC toggle on the lead row (shown when the booking has FOC seats) → `bkV2ToggleLeadFoc`. `leadType` = `d.leadFoc ? 'FOC' : (adults?'AD':foc?'FOC':…)`. Head count unchanged either way. Saved on the booking (`leadType`/`leadFoc`). Stale flag auto-drops if FOC removed.
- **Paste group list FOC bug fixed:** `bkV2GroupPasteApply` set adults = N (all pasted) without subtracting pre-set FOC → total N+FOC ("เด้งเกิน"). Now **adults = N − FOC** (pasted N = the whole group · FOC is part of it), caps FOC to N. Verified: 27 names + 2 FOC → 25 AD + 2 FOC = 27.
- **Dietary capped at headcount:** veg+vegan+halal can't exceed the booking's pax (`_bkV2Headcount` = largest trip · `_bkV2MealRoom(key)`); `bkV2BumpSpecialMeal`/`ToggleMealOn`/`SetMealQty` clamp.

---

## 20. Boat Operation matrix — broken-boat alert · clickable date · look (2026-06-16)

> Nav `operation` → `#view-operation` → `renderOp()`. Month/Week heatmap = `bop2RenderHeatmapRow(route,dates)` (~line 8103). Cell click = `bop2SelectCell` → `bop2OpenCellPopover` (assign-boats popover, appended to `document.body`, `position:absolute`).

### 20.1 Broken-boat alert (assigned boat became unavailable → must reassign)
- **Cell state** in `bop2RenderHeatmapRow`: after computing `boats = bop2BoatsOnRouteDate(route,d)` (does NOT filter status), compute `usableBoats = boats.filter(getCurStatus(b,d).s==='available')`. If `boats.length>0 && usableBoats.length===0` → render a **🔧 "เปลี่ยนเรือ"** cell (amber stripes `#FBE3BE` + dashed `#BA7517` border) **regardless of pax** (even 0 pax — the schedule is invalid). Distinct from the red **"⚠ No boat"** cell (`seatsConsumed>0 && boats.length===0`). Both branches sit just before the normal heatmap palette block.
- **`bop2RouteDaysNeedingBoats`** (~line 7185) flags both: `reason:'boat_broken'` (assigned but all unusable · any pax) vs `reason:'no_boat'` (pax>0 & none assigned). Powers the **NEEDS ATTENTION** KPI tile (`needsBroken` count → "⚠ N เรือเสีย/ถอด") + `bop2ShowNeedsList`.
- **Legend** gained a "🔧 เปลี่ยนเรือ" chip. Ties in with §below dayAfter fix: a boat that ran in the morning then broke in the evening keeps that day available; the NEXT day's assignment of that boat flips to 🔧.

### 20.2 Clickable date-header (the reported "can't click dates in matrix" — FIXED)
The matrix **route×day cells** were always clickable (open assign popover), but the **day-number header row** (`.bo-day-h`, ~line 7994) had NO onclick → clicking a date there did nothing (user expected it to work like the side mini-calendar). Added **`bop2SelectDate(date)`** (just `_bop2.selDate=date; renderOp()` · no route popover) + `onclick="bop2SelectDate('${d}')"` + `cursor:pointer` + title on the header div. Verified live via Chrome: clicking header "19" → Selected 2026-06-19 + right Fleet panel "Fri Jun 19". (Closed `—` cells intentionally have no handler.)

### 20.3 Look — white bg + borders + liquid-glass skin
- `#view-operation` bg `#E8F4EE` → **`#fff`** (user wanted white). Added `border:1px solid rgba(0,0,0,.08)` to `.bo-tile` (KPI) + `.bo-card` (matrix + right Fleet panel) so white cards separate from white bg.
- **Route-name pills** (`.bo-cell-route` in `bop2RenderHeatmapRow`) lightened 50% toward white via new local `_bop2Lighten(hex,amt)` + a `border-left:3px solid route.color` accent + dark text (`contrastText(pillBg)`). Heatmap cell palette (green/yellow/red) kept full strength for readability.
- **Liquid glass** = reversible `<style id="bop-glass-skin">` block before `</head>` (after `dash-glass-skin`). White + faint gradient + 4 pastel blobs bg; `.bo-card` = translucent gradient (~30-46%) + `backdrop-filter:blur(26px) saturate(1.5)` + glow border + layered inset highlight; `.bo-tile` = blur + `::before` top sheen (pointer-events:none). Keeps existing KPI/cell colors. Delete the one block to revert. (backdrop-filter is fine — both matrix & calendar cards have it and both click OK.)

## 21. Sidebar nav regroup (2026-06-16)
Split the old crammed **"Sales & Booking"** (12 items) into three groups + folded dispatch into Operations. Nav block ~line 2403-2459. Pure HTML reorder — no logic/data touched (functions like `bkV2GoBoatAssign` still defined, just unlinked).
- **OPERATIONS** (green accent): Booking · Boat Operation · Transfer Fleet · ใบงานรถ (Van Jobs) · **Pickup time setup** (renamed from "Pickup Setup"). (order per user)
- **SALES** (pink): Agent List · Rate Types · B2C Channels · Staff & Welfare · Demand.
- **ACCOUNTING & FINANCE** (cyan `rgba(120,200,230,…)`): Accounting · Daily PFM.
- **Removed: Boat Assign** nav item (duplicated Boat Operation). **Removed duplicate Boat Status** from Operations — kept the one in Fleet Management → Today (`fl-boatstatus`, which maps to the same `boats` view anyway · `actualView=view==='fl-boatstatus'?'boats':view`).
- Overview / Fleet Management / Config groups unchanged.

## 22. Partial-cancel charge/waive split — Reduce pax (2026-06-16)
> `bkV2DetailPartial` → `bkV2PartialModal` → `bkV2PartialConfirm` → `bkV2PartialCancel`. Stores `bk.partialCancels[]`.

Handles "ลด N คน · ชาร์จ X · ไม่ชาร์จ Y" (book 6, cancel 2, charge 1 / waive 1). The money section is now a **charge vs waive split** (was a single none/refund radio):
- Modal: live **`bkV2PartialRecalc()`** (oninput on remove fields + the charge-count field) — totals removed, takes **เก็บเงิน(ชาร์จ) count**, auto-fills **ไม่เก็บ/คืนเงิน count = total−charged** + auto ฿ amounts from `window._bkpPerPax` (= `priceBreakdown.seat / Σ all-trip pax`, editable after).
- **Money model: refund = the WAIVED amount only** (`bkp-waive-amt`). The **charged** pax keep being billed = cancellation fee retained as revenue (seats still released — pax decremented for all removed). So `bk.total`/`priceBreakdown.total` drop by the waived amount only.
- Record adds `charged:{count,amount}` + `waived:{count,amount}` to the `partialCancels[]` entry (keeps `refundMode`/`refund` for back-compat). History + the By-trip manifest pc-badge tooltip show "charge N · waive M (refund ฿…)". For CXL/P&L reporting later.
- Verified: node math (mixed 6→charge1/waive1 → refund 1600, price 9600→8000; all-charged → refund 0; all-waived → refund 3200). Backup: `BACKUP/allotment_v2_20260616_pre_partial_charge_split.html`.

### Backups this session (2026-06-16)
`pre_partial_charge_split` · `pre_nav_regroup` · `pre_brokenboat_alert` (2026-06-14 · covers the broken-boat work).

---

## 23. UI chrome — topbar removed + glass skins (2026-06-17)
All reversible `<style id="…">` blocks before `</head>` (after `dash-glass-skin`). Delete a block to revert that piece.

- **`topbar-float-skin`** — removed the top bar (brand + bar bg). `:root{--topbar:0px}` (3 usages: `.topbar` height, `.app` margin-top, `.sidebar` top → content fills to top). `.topbar` → fixed top-right, transparent, `pointer-events:none` (`.topbar-right` re-enables) so it floats without blocking. `.topbar-brand`/`.topbar-sep` hidden. **Hide toggle:** added `<button class="topbar-toggle">` (3-dot) in the header + `toggleTopbarTools()` (toggles `.topbar.tools-open`) — controls hidden by default, click to reveal (toggle turns blue when open).
  - ⚠ **Sticky-header dependency:** the By-trip manifest sticky offset (`bkV2Render` rAF ~line 44302) used a hardcoded `TOP=52` (old bar height) → after removal the column-header stuck 52px too low (data row peeked above). **Fixed:** `const TOP=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--topbar'))||0` — auto-reads `--topbar` (0 now · reverts to 52 if bar restored). Powers `--t2-head-top` / `--t2-vangroup-top`.
- **`bop-glass-skin`** — Boat Operation liquid glass (white bg + 4 pastel blobs gradient · `.bo-card`/`.bo-tile` translucent + `backdrop-filter:blur` + glow border + `::before` sheen on tiles). Keeps existing KPI/cell colors.
- **`bkv2-nb-glass-skin`** — New Booking form glass. ⚠ **Form-body cards (`.bkv2-nb-sec`,`.bkv2-nb-card`) get translucent bg ONLY — NO `backdrop-filter`** (backdrop-filter creates a stacking context that traps the typeahead dropdowns = "ซ้อนกัน"). `backdrop-filter` kept only on `.bkv2-nb-topbar` + `.bkv2-review-sticky` (no dropdowns).
- **`sidebar-glass-skin`** — nav sidebar = glass-blue card (per user's reference design). `.sidebar` floats (top/left/bottom:14px · `border-radius:26px` · gradient `#2F80E8→#1654BA` + top sheen + glow border + drop shadow) · `.main{margin-left:250px}` to clear it. Nav items white, active = frosted white pill (`rgba(255,255,255,.20)` + glow + inset highlight). Agent badge (`.ct-nav-badge`) → white pill / blue text.

## 24. Van Job Orders — full revamp (2026-06-17)
> `renderVanJobs()` (#view-vanjobs) · print/preview via `vanJobsOrderInner(date,vanId)` + `vanJobsOrderCss(scoped)` (shared by the print popup `bkV2VanJobOrder` AND the inline right-panel preview).

- **List = real `<table>`** (was cards) · columns: รถ(colored cell) · ประเภท(ownership tag) · คนขับ · เบอร์โทร(tel:) · Booking(center) · เส้นทาง · โซน · actions. Aligned via real table. Header row shaded + row dividers.
- **Filters:** ownership segmented (ทั้งหมด / บริษัท+เช่า / รถร่วม · `_vanJobsOwner` · `vanJobsOwnerGroup`=partner-vs-company) + route dropdown (`_vanJobsRoute`) · `vanJobsOwnerTag` colors.
- **Fleet-Insights header** (`headerFull`): big "N คัน · M pax" + pills (compN บริษัท+เช่า / partN รถร่วม / unTot ยังไม่จัด) + meta · green hero (unTot→nav booking) + pink-border + กำกับไทย cards · route segment bar (% by van count) · black "◆ ต้องจัดรถ" bar. **Kept on click** (do NOT swap to a mini header — user wanted it persistent).
- **Per-hotel Thai pickup label** — `VANJOB_PICKUP_TH[pickupName]` (LS `vanjob_pickup_th` · `vanJobsPickupThPersist`). Editable in the row's **"✎ แก้ไข"** expand (per-van, lists the van's distinct pickups · `oninput=vanJobsSetPickupTh(this)` · NO re-render to keep focus). Shows under the hotel name in the job order (blue sub-line).
- **Special request override** — per booking `VANJOB_SREQ[bkId]` (LS `vanjob_sreq`). `vanJobsSreqAuto(b)` = **`b.notes` ONLY** (Notes/Special-Request field · per user · NOT guide/diet/allergy). `vanJobsSreqFinal` = override (incl. '' = deleted) else auto. Edited in the same "✎ แก้ไข" expand (per booking · `vanJobsBookingsFor` · ↺ auto resets). "some requests aren't van-related → editable/deletable."
- **Job order doc** (`vanJobsOrderInner`): VC column kept (no agent) · **Pax split AD/CHD/INF/FOC** (grouped header · split rows = colspan "N (แยก)") · big **Route + Date heading** (`.bighd`) · column order Pick-up → **Room → Zone** (Zone = English area) · **Special request column moved AFTER Bags** · **Total footer row** (รวม AD/CHD/INF/FOC + pax·booking) · fonts bumped (~13.5px) for readability.
- **Click row → right preview drawer** (`_vanJobsPreview` · `vanJobsOpenPreview`/`ClosePreview`): fixed right panel showing the live job order as a centered white **page** (`#vjo-page` width 1120 + `zoom`-to-fit via rAF so all columns show, no clip) on light-gray. Print button in drawer header. Table pushed left (`margin-right:850`). Row buttons/phone use `event.stopPropagation()`. Print button in the row = icon-only (`ti-printer`-style inline SVG, no Tabler in app).

## 25. Transfer Fleet — shared Fleet-Insights header (2026-06-17)
`renderVehicles()` — built one shared `vehHeader` (Fleet-Insights style) used by **all 4 tabs** (status/matrix/registry/daily), replacing the old per-tab headers (the simple h1+3-KPI for non-status, and the status tab's `headerBar`+`kpiStrip`). Header = zone chips (PK/KL) + "+ เพิ่มรถ" · big "N คัน active" + pills (พร้อม / ซ่อม-หยุด) + meta (own/rented/partner/seats) · green hero (รถซ่อม/หยุดวันนี้ → nav status) + pink-border (พร้อม %) + seats card · ownership segment bar · black "◆ แจ้งเตือน" when maintenance>0. Final wrapper now outputs `${vehHeader}${tabGroup}${body}` for all tabs; status `filterBar` lost its embedded `tabGroup` (now added once by wrapper). Metrics: `nActiveV`/`nMaintV` (via `vehStatusOn` today)/`nAvailV`/`nPKv`/`nKLv` at function scope.

## 26. Misc booking fixes (2026-06-17)
- **Cash-on-tour Note** — added a NOTE field in the cash-on-tour section (`cashOnTour.note`). Shows in the live Booking Review (`#bkv2-cot-rv-note`) + the booking-detail Payment card (📝). ⚠ `bkV2SetCashOnTour` re-rendered the whole form on every key except 'amount' → typing in Note lost focus / page jumped. **Fixed:** 'note' now also skips full re-render (updates the review live). Also fixed the detail card which read wrong shape (`.service`/`.notes`) → now currency/amount/handling + `.note` (back-compat `.notes`).
- **Dietary clamp visible** — veg/vegan/halal qty input (`bkV2SetMealQty`) clamped internally but didn't reflect → looked like you could exceed pax. Now takes the element, **snaps the displayed value back to max** (= `_bkV2MealRoom` = headcount − other diets) + sets `max` attr + tooltip. veg+vegan+halal ≤ booking pax.
- **Van Assign · pickup order (`vanSeq`)** — order pickups by the sequence rows are ticked (not just time). `bkV2VanSelToggle` stores tick-order number (was `true`). `bkV2VanGroupSelected` assigns `bk.ops.vanSeq` (or split.vanSeq) by tick order (appends after group's current max). `bkV2VanGroupSave` — if rows are ticked, re-assigns vanSeq by tick order per group (= "re-tick in order then Save reorders"). Manifest cluster sort + job-order sort: **vanSeq first (if set), else time**. **Manual order wins** (editing a time does NOT reshuffle). **"↻ เรียงตามเวลา"** button on the group header (van mode · shown only when group has vanSeq) → `bkV2VanGroupClearSeq` clears vanSeq → back to time sort. vanSeq lives on `ops` → survives edit-preserve.

### Backups this session (2026-06-17)
`pre_vanjob_revamp` · `pre_insight_headers`.

---

## 27. New Booking — hotel name autocomplete + dedupe + snap-on-save (2026-06-18)
Hotel / Pickup Location field in the New Booking form (`bkV2RenderNewBooking` pickup section ~line 44894).
- **Styled typeahead (not native datalist).** Replaced native `<datalist>` (can't be styled) with a custom dropdown reusing the Pickup-Area `.bkv2-nb-dd` classes — wrapped input+dd in `.bkv2-nb-ddwrap` (`position:relative`, no `backdrop-filter` so no dropdown-stacking issue). Each row = `HOTEL` badge + name. Fns: `bkV2HotelDDShow/Filter/Hide/Outside/Key/Pick` + state `_bkV2HotelDDActive/_bkV2HotelDDOn`. `oninput→bkV2HotelDDFilter` calls `bkV2SetBookingField('hotelName',…)` (which is in `_BKV2_NO_RENDER_KEYS` → no re-render → focus kept) then re-renders the dd only.
- **Source list `bkV2HotelNameList()`** = distinct hotel names from all `SB_BOOKINGS` (`b.hotelName` + `b.pickup`). **Skips No-Transfer bookings** (there the hotel field is a self-arrival NOTE, not a real hotel → don't suggest e.g. "Andakira Hotel Transfer By Aqua Travel"). **Dedupes by a NORMALIZED key** (`lowercase · parens→space · collapse spaces`) so spelling variants of one place collapse to ONE suggestion (e.g. "Katathani … Buri Lobby" vs "Katathani …  ( Buri Lobby )"); on collision keeps the cleaner spelling (no parens, then shorter). Buri Wing / Thani Wing / plain stay separate (different keys).
- **Snap-on-save (prevents future duplicates · the "option 1" fix).** New helper **`bkV2CanonicalHotel(name)`** tidies whitespace then, if the typed name matches an existing one by the same normalized key, returns the **existing canonical spelling** (else keeps the tidied new name). Called at the top of `bkV2CommitBooking` for `d.hotelName` + `d.dropoffHotelName`. So typos/spacing/parens snap to the existing entry → no new variant rows. (Non-destructive; old bookings' stored names untouched — both dedupe + snap operate on read/save, not a data migration.) Backup: `BACKUP/allotment_v2_20260618_pre_hotel_autocomplete.html`.

## 28. Booking Calendar — per-day total + multi-select program filter (2026-06-18)
`bkV2RenderCalendar` (~line 46099). Reversible CSS block `<style id="bkv2-cal-filter-skin">` before `</head>`.
- **Per-day total badge** — top-right of each cell (`.bkv2-cal-daytot` · DM Mono, 15px, soft-blue pill) = sum of pax across the visible (filtered) programs that day. Computed as `dayTotal = openFams.reduce(+agg.total)`. Placed in `.bkv2-cal-daynum` row (uses `margin-left:auto`; `.bkv2-cal-foc + .bkv2-cal-daytot` shifts it when the FOC dot is present).
- **Program filter (multi-select)** — pill bar above the weekday row (`.bkv2-cal-filter`): **All** + one pill per family. State `_bkV2.calFams` (array · empty = show all). `bkV2CalToggleFamily(id)` toggles membership · `bkV2CalAllFamilies()` clears. `calSel = calFams.length ? new Set : null`. Chips filtered via `.filter(o=>o.open && (!calSel||calSel.has(o.fam.id)))`; the day total reflects the filtered set. Selected pill fills with the family color (`--fc`). Backup: `BACKUP/allotment_v2_20260618_pre_cal_filter_daytotal.html`.

## 29. Inventory — +29 items from 2 supplier invoices + back-fill migration (2026-06-18)
Added to `FL_DEFAULT_INVENTORY` (~line 15939). All `qty:0` (quantities added later via memo), `category:'general'`, note = invoice no for traceability.
- **i96–i114 (19)** — ส.พานิช ภูเก็ต · **HO-IV26004083** · abrasives/glue/hardware/floor-mat (เกรียงโป๊ว, กาวยาง Dog, ไขปลาวาฬ, ใบขัด Coral/SUMO, ฝอยลวด, ไดโว่ REX, น็อต/แหวน, แผ่นยางปูพื้น).
- **i115–i124 (10)** — ส.พานิช อิเล็คทริค · **HO-IV26000676** · electrical (สวิทช์ไดโว่ Seaflo, เทป 3M, สาย VCT, เคเบิ้ลไท, KUS หน้าแปลน/เซ็นเซอร์ระดับน้ำ, หางปลา). Items 1/6/7 had generic code `SSSS000000000` on the invoice — kept as-is.
- ⚠ **Back-fill migration** (the important bit): `FL_DEFAULT_INVENTORY` only seeds when the persisted array is EMPTY, so items appended to the default list never reach users whose localStorage is already seeded. Added an **idempotent merge in `flLoad`** right after `FL_INVENTORY=d.fleet_inventory||[]` (~line 14967): for each default item whose `id` is missing in `FL_INVENTORY`, push a clone (`_invAdded` count · sets `d.fleet_inventory` in memory · persists on next save). Runs every load, only adds absent ids, never touches existing rows. **Use this same pattern for any future default-inventory additions.** Backups: `pre_inv_add_spanich`, `pre_inv_add_spanich_elec` (2026-06-18).

## 30. Maintenance — "+ Memo" (blank) + withdraw scroll-jump fix (2026-06-18)
- **"+ Memo" blank memo button** — `flMaintCreateMemo(id, blank)` gained a 2nd arg; `blank` → `_memoItems=[]` (manual entry, doesn't pull job parts). In `flRenderMaintDetailPink` the Linked-memos header now shows TWO pink buttons when the job has parts: **"+ Create memo from parts"** + **"+ Memo"** (`flMaintCreateMemo('id',true)`). Jobs with no parts keep the single "+ Create memo".
- **Withdraw "jump to top" bug (root-caused + fixed).** Reported: after **+ Withdraw** (and the × return), the page jumps to the MJ header. **Root cause (proven in DOM): not the data re-render** — re-rendering the mount alone leaves scroll unchanged; the jump is caused by **removing the focused +Withdraw button** (it lives inside the mount; replacing `innerHTML` destroys the focused element → browser scrolls). **Fix = surgical update, no full re-render:** extracted `_flMaintPartsInner(m)` (parts list + subtotal) and `_flMaintTimelineInner(m)` (progress timeline), used by both the full render AND a new **`flMaintRefreshParts(jobId)`** that updates ONLY `#maint-parts-list-<id>`, `#maint-timeline-body-<id>`, and the `#maint-parts-count-<id>` badge — leaving the withdraw form/button untouched (it blurs first only if focus sits inside a region being replaced, e.g. a × button). `flMaintAddPart`/`flMaintRemovePart` now call `flMaintRefreshParts` instead of `flRenderMaintDetail`. (An earlier `_flWithDetailScroll` blur+restore helper still exists but the callers use the surgical path now.) Backups: `pre_withdraw_surgical` (+ `pre_inv_add_*`) 2026-06-18.

## 31. Day-of Extra presets — Longtail consolidation (2026-06-18)
`BKV2_EXTRA_PRESETS` (~line 37949). Per user: "Longtail Charter" and "Private Longtail" are the SAME product (whole boat) → one name, counted together.
- **Removed** "Longtail (spot)" (was a dup of Longtail Join with a lower default price — price is editable anyway). **Renamed** the private/charter preset to **"Longtail เหมา (Private)"** (4500) so it reads the same as the "Longtail เหมา" prep chip.
- **Counting:** `bkV2LongtailExtraPax` now EXCLUDES `/เหมา|charter|private|ไพรเวท|ส่วนตัว/` from join-pax (a whole boat ≠ per-head join). New **`bkV2LongtailCharterExtraBoats(bkId,date)`** counts those as BOATS and is added to `ltCharterBoats` (trip-header prep summary) + `_fLtChtr`/`o.ltChtr` (family boat grid + per-boat) — so day-of เหมา shows in "Longtail เหมา · N ลำ" alongside the Rate-Type/add-on charter. Legacy saved "Longtail (spot)" rows still count as join (unchanged). Backup: `pre_extra_longtail_presets`.

## 32. Van Job Orders — unassigned pax broken down by route (2026-06-18)
`renderVanJobs` (~line 36511). The "ยังไม่จัด" counter (`unTot`) is a single number — a user saw "1 pax ยังไม่จัด" while 5 vans looked full (the stray pax was a DIFFERENT trip, route r12 = Whale Shark, not the Phi Phi vans). Added **`unByRoute{routeId→pax}`** (via `_addUn(rid,pax)` in the agg loop) + `unRouteLbl` = `"<route> N pax · …"` (sorted by pax desc, via `rName`). Shown in the green hero card (`🚩 …`) and the black "◆ ต้องจัดรถ" bar so staff see WHICH trip still needs a van. Backup: `pre_vanjob_unassigned_route`.

## 33. Sidebar gap tighten (2026-06-18)
In `sidebar-glass-skin` (§23): `.main{margin-left:250px}` → **`margin-left:236px; padding-left:14px`** (other paddings stay 22px). Sidebar right edge ≈234px; content now starts ≈250px (gap ~16px, was ~38px). Pure CSS, one line.

### Backups this session (2026-06-18)
`pre_hotel_autocomplete` · `pre_cal_filter_daytotal` · `pre_inv_add_spanich` · `pre_inv_add_spanich_elec` · `pre_withdraw_surgical` · `pre_extra_longtail_presets` · `pre_vanjob_unassigned_route`.


---

## 34. By-trip manifest — not-yet-assigned bookings float to top + frame (2026-06-19)
`bkV2RenderTab2` (~line 47350+). When van grouping has started in a zone section, a booking that isn't in a group yet (new booking arriving after grouping) should stand out.
- **`_hasGroups = alist.some(a=>a.g>0)`** — only triggers the behaviour when at least one group exists in that route+zone section (so a fully-ungrouped section before any assigning is NOT all-framed).
- **Sort:** ungrouped (g=0) → key **-1** (was 9999) so it sorts to the **TOP** instead of bottom. Group order otherwise unchanged.
- **Frame:** ungrouped rows get class **`t2-unassigned`** (when `_hasGroups`) → amber full-row frame (`#FFFBF0` bg + 2px `#E6A23C` border around the whole `<tr>` via first/last `<td>`). CSS in the `<style>` block near `.t2-addbtn`.
- **Header:** an amber **"⚠ ยังไม่ assign · N booking · M pax"** row (`_unassignedHdr`) is emitted before the ungrouped cluster (only when `_hasGroups`). Assembly loop: `if(o.g>0) _grpHeaderRow else if(_hasGroups) _unassignedHdr`. Backup: `BACKUP/allotment_v2_20260619_pre_unassigned_top.html`.

## 35. Manifest pickup full name + Add-on cell restack (2026-06-18/19)
- **Pickup shows full hotel name** — `.t2-pickcell` was `max-width:160px` + ellipsis. Now `max-width:230px; white-space:normal; overflow-wrap:anywhere` → wraps to 2 lines instead of truncating. Backup: `pre_pickcell_full`.
- **Add-on cell restacked** — was badges + `+`/`⬆` buttons all in one `.t2-rbwrap` row. Now `.t2-addoncell` (flex column): `.t2-addoncell-badges` (smaller badges · `.t2-rb` 9px) on top, `.t2-addoncell-acts` (the `+` extra / `⬆` upgrade buttons · `.t2-addbtn` 10px) **below**. Backup: `pre_addoncell_stack`.

## 36. RETURN-VAN job orders + manifest "รับ X · กลับ Y" (2026-06-19)
Return leg (`bk.ops.vanReturnId` / `vanSplits[].vanReturnId`) when **different** from the outbound van now produces its own job order. ("Option A" per user.)
- **Van Job Orders page (`renderVanJobs`):** new `aggRet` aggregation (return van, only when `vanReturnId && !==outbound`). `jobList = ids(out) + retIds(ret)` · each row carries `{vid,leg,key}` (key=`vid` or `vid|ret`). Return rows get a gold **"↩ ขากลับ"** badge + gold gradient. `_vanJobsPreview` now stores the **key** (parsed into `_pvVid`/`_pvLeg` for the preview drawer + print). Rail + expand keyed by `key` too.
- **`vanJobsBookingsFor(date, vid, leg)`** + **`vanJobsOrderInner(date, vid, leg)`** + **`bkV2VanJobOrder(date, vid, leg)`** all gained a `leg` arg. For `leg==='ret'`: collect rows where `vanReturnId===vid`, **reverse pickup/drop** (Pick-up = pier `Visit Panwa/Tub Lamu Pier`, Drop-off = hotel), blank the pick-up time (driver fills · return = boat-back time), header label "ขากลับ / RETURN".
- **Manifest read-only group header** (`_grpHeaderRow` !vanMode): when the group's return van differs from outbound → prefix "รับ" tag + a gold **"↩ กลับ ‹van name›"** chip after the van pill. Same van → unchanged (per user). `_retVid` = first member whose `vanReturnId !== vid`.
- Verified live (TAXI out / Love1 ret → return job row + reversed order + header pair). Test vanReturnId reverted after. Backup: `BACKUP/allotment_v2_20260619_pre_return_jobs.html`.

## 37. Voucher detail — boarding-pass ticket header (2026-06-19)
Voucher detail (`bkV2RenderBookingDetail` ~line 50791) now leads with a **ticket hero** (`bkV2VoucherTicket(bk, esc)` inserted between the topbar and the 2-col grid). Existing sections (Agent & Voucher, History, Trips & Pax, Guests, Pickup, Payment, action buttons) stay **below** ("ตั๋วบน รายละเอียดล่าง").
- **Left = route photo panel** (200px). Layered background: **`assets/voucher/<routeId>.jpg` ON TOP of `assets/hero/<routeId>.jpg`** (CSS `background-image:url(v),url(h)`) → a Voucher-specific photo can override **without** touching the shared hero image used by the Pickup-Setup marketing card. `background:${famColor}` is the ultimate fallback. `background-size:cover; background-position:center top` (shows the boat; a strong bottom dark gradient masks any text baked into the photo). White logo pill (`LOVE_LOGO_B64`) top-left + route-family name (white) bottom.
- **Right = ticket info (English):** "YOU'RE GOING ON" + **trip name** (big) · top-right **"VOUCHER · VC" + VC number** (big mono, family color · replaced the barcode) · color date band "‹full date› · Transfer ‹pickup time›" · grid: **Customer · Pax (N pax · 2A·1C…) · Pick-up (+ Room N) · Drop-off (same/diff) · Dietary & Special Requests** (veg/vegan/halal/lang/allergy chips + notes). **Removed: barcode, Total, Agent name** (per user).
- Route icon helper `_bkV2FamIcon(famId,color,size)` (inline SVG per family) still defined as a fallback but the panel now uses real photos.
- ⚠ `assets/hero/<id>.jpg` is **shared** (Pickup-Setup marketing card `pc-hero-bg` line ~34894 + Voucher) — that's why the per-route `assets/voucher/` override layer exists. Created empty `assets/voucher/` folder. (Whale Shark Sunset = route **r12**; drop `assets/voucher/r12.jpg` to set its voucher photo.) Backup: `BACKUP/allotment_v2_20260619_pre_voucher_ticket.html`.

### Backups this session (2026-06-19)
`pre_unassigned_top` · `pre_return_jobs` · `pre_pickcell_full` · `pre_addoncell_stack` · `pre_voucher_ticket`.

---

## 38. Demand · ⑥ Agents tab — all agents + pickup-area matrix (2026-06-20)
New tab `agents` (after ⑤ Sales) · `mdTabAgents(days)` · dispatch in `renderMarketData` (`tabs` array + `_mdTab==='agents'`). **Moved the "Top agents" table OFF the ⑤ Sales tab** (removed `taCard` from `mdTabSales` return).
- **All agents** that booked (no top-N slice) · sorted by sales value · cols: Agent · Owner · Market · [zone/area] · [program families] · Pax · Sales (+ Coll/Cancel when area-mode OFF).
- **Pickup-area MATRIX** (toggle `_mdAgZone` · `mdToggleAgZone()` · button top-right): when ON, columns become one per **pickup area** (Patong, Kata, Phuket Town, Panwa Pier, …) — `areaTot` ordered desc, **top 16 + Other**. Cell = pax of that agent at that area, colored by zone (PK blue / KL green / NT gray · `zClr`). Header shows the area name (`shortNm`) + a **faint total** (`_faint`, all-agents sum). When OFF → program-family columns + Coll/Cancel. Area resolved from `bk.pickupAreaId` (booking-level) via `areaInfo(k)` → `bkV2GetArea`; `_z<ZONE>` fallback key when no area set.
- **Full-width:** `_ovWide = _mdTab==='overview' || _mdTab==='agents'` (others stay 1200px).

## 39. Agent detail · Recent Bookings pagination (2026-06-20)
`agTabHist(a)` — was `slice(-15).reverse()` (only 15 newest, rest hidden). Now **paginated 15/page, newest first**: full list `filter(agentId).slice().reverse()`, `PER=15`, page `_agHistPage`. Nav row below the table (‹ 1 2 … N ›) via `agHistGo(aId,p)` (sets page + re-renders body). `agSwitchTab` resets `_agHistPage=0` when entering hist. Shows "N bookings · แสดง start–end". Backup: `pre_agent_hist_paging`.

## 40. New Booking · over-allotment + discount → Pending approval (2026-06-20)
`bkV2CommitBooking` + the **"รออนุมัติ" tab** (`bkV2RenderApprovals`). Two triggers now route a would-be-confirmed booking to `status:'pending_approval'`:
- **Over company allotment** (existing, message rewritten to Thai): `confirm('⚠ เกินจำนวนที่นั่งที่บริษัทกำหนด +N …')` → `_approvalReq={reason:'over_capacity',over,totOver}`. (Over the boat **license** = still a hard block.)
- **Discount** (NEW): after `bkV2CalcQuote()`, `_discAmt = quote.totalDiscount` (⚠ field is `totalDiscount`, not `discount`). If `status==='confirmed' && _discAmt>0` → `alert('⚠ บุคกิ้งนี้มีส่วนลด ฿X … ต้องให้ [เซลล์ที่ดูแล] ยืนยัน')` → merges into `_approvalReq` (reason gets `+discount`, carries `discount`/`saleName`). Sale name from `agent.sales → SB_SALES`.
- `newBk.approval` now also carries `discount` + `saleName`. The approval **card** shows a red "เกิน cap +N" chip and/or an amber "ส่วนลด ฿X · รอเซลล์ยืนยัน" chip (over-cap table only when `ap.over.length`). Approve/Reject prompts ask "เซลล์ที่ดูแล" (discount) or "ผจก." (capacity). Same approve flow → `status = targetStatus` (confirmed). Backup: `pre_discount_approval`.

## 41. Fleet asset lists (Engines/Gearboxes/Propellers) — scroll-jump + group-by-boat + status (2026-06-19/20)
All three list render fns: `flRenderEngList` / `flRenderGbList` / `flRenderPropList` (+ `flSelEng`/`flSelGb`/`flSelProp`).
- **Click scroll-jump FIXED.** `flSel*` was `flRender*List()` (full re-render → list scroll reset) **then `scrollIntoView({block:'nearest'})`** → the jump. Now: gave each list panel a stable id (`fl-eng/gb/prop-listpanel`), capture its `scrollTop`+`window.scrollY` before re-render, **restore after** (sync + rAF), blur active el, **removed scrollIntoView**. (Same root cause as the maint withdraw bug §30.)
- **Group by BOAT** (was by brand+model). Each boat = a header (name + `N eng/gb/prop` + brand-color dot · blue Honda / red Suzuki), sorted by boat name. Within a boat, **positions ordered Port → C.Port → Center → C.Std → Std** (`posIdx`→`flPosRank`). Spare/off-boat in a gray "Spare · ไม่อยู่เรือ" group last. Gearbox boat = via `engineId→engine.boatId`; propeller = via `gearboxId→gb→engine`.
- **Position label normalize.** Global `flPosLabel`/`flPosRank` + maps `FL_POS_CANON`/`FL_POS_RANK`: Suzuki **"Starboard" === "Std"** (same physical side) — displayed as "Std" in the badge + "boat · pos" line, and ranked = Std. So all boats/brands use one position set.
- **Fixed-width position badge** (`width:54px`, inline-flex center) so the serial-number column **aligns** across rows regardless of label length.
- **Engine-status self-heal (in `flLoad`, next to the boat self-heal §below).** An engine that is an asset of an **in-progress** MJ with `setFixing!==false` must read `'fixing'` (the boat is off-service for it) — was stuck `'ready'`. Conversely a `'fixing'` engine with no active fixing job → back to `'ready'`. Skips `broken`/`spare`. Idempotent each load. (Fixed Achilles/Aluminous1 engines showing ready while their boats were fixing.) Backups: `pre_eng_scrolljump`, `pre_asset_groupbyboat`.

## 42. Maintenance — Awaiting-Invoice filter + boat stuck-fixing self-heal (2026-06-19)
- **Awaiting Invoice tab** (`allAwaitingJobs` filter ~line 23786 + the `agSelectMaint` auto-tab hint ~17674): cleared a job from the tab as soon as **any memo existed** → a job with RECEIVED-but-unpaid memos fell into Archive though it still awaits the supplier bill. Now clears **only when all linked memos are `status==='paid'`** (RECEIVED ≠ invoice settled). So: awaitingInvoice + (no memo OR memo not all-paid) → stays in Awaiting Invoice. Generalised approval-queue title from "(เกิน Capacity)" → "รออนุมัติ".
- **Boat stuck-fixing self-heal (`flLoad`).** A DONE maintenance job must not leave its boat `fixing`/`unavailable`. If a boat's latest OPEN status log (`to:null`) is fixing/unavailable and its note references an MJ that is now **done**, and no in-progress MJ still forces fixing → close that log + append `available` ("Auto-restore · MJ-xxx done"). (Root cause: a close where `flMaintClose`'s boat-restore block was skipped → boat stayed fixing.) Backups: `pre_boat_selfheal`, `pre_discount_approval`.

## 37+. Voucher ticket photo refinements (2026-06-19)
Extends §37. Left route panel:
- **Per-route override layer:** `background-image:url('assets/voucher/<routeId>.jpg'), url('assets/hero/<routeId>.jpg')` — a clean Voucher photo (e.g. `assets/voucher/r12.jpg` for Whale Shark) shows on top; if missing, the shared hero shows underneath; if both missing, the family color. (⚠ `assets/hero/<id>.jpg` is shared with the Pickup-Setup marketing card AND has marketing **text baked into the image** — that's why the override layer exists. `assets/hero/original/<id>.jpg` is the full marketing card, not a clean source.)
- **Hide baked text on the hero layer:** the hero (text-baked) layer uses `background-size:auto 172%; background-position:center center` (zoom + center-crop → cuts the baked title/logo top+bottom). The clean voucher layer stays `cover`/`center top` (full photo).
- **Brightness:** photo layer is a separate absolute `<div>` with `filter:brightness(1.16) saturate(1.06)`; the dark gradient overlay lightened (bottom band kept for the white route-name legibility). All English labels (Customer/Pax/Pick-up/Drop-off/Transfer time/Dietary). Backup: `pre_voucher_ticket`.

### Backups (2026-06-19/20)
`pre_voucher_ticket` · `pre_boat_selfheal` · `pre_discount_approval` · `pre_agents_tab` · `pre_agent_hist_paging` · `pre_eng_scrolljump` · `pre_asset_groupbyboat`.

---

## 43. Incident — delete button (2026-06-20 PM)
Incident detail (`flRenderIncDetailPink` header strip) gained a red **"ลบ"** button next to Edit → **`flDeleteIncident(id)`**: `confirm()` (English text · ASCII-safe), removes the incident from `FL_INCIDENTS`, clears `_selIncId` if it pointed at it, `flSave()` + `flRenderIncident()`. If the incident has a linked MJ (`inc.maintId`), the confirm warns that the **job is NOT deleted** (incident only). Backup: `pre_delete_incident`.

## 44. Spare-link invariant in Edit forms (2026-06-20 PM)
A **SPARE** gearbox/propeller is on the shelf → must NOT stay linked. Previously setting status='spare' in the Edit form kept `engineId`/`gearboxId` → detail still showed the old "Linked engine" (the "เราถอดออกแล้ว ทำไมไม่หลุด" bug).
- `flSaveGearbox`: `if(status==='spare') engineId=null;` (force-detach).
- `flSaveProp`: `if(status==='spare') gearboxId=null;`.
These fire **only when the user explicitly sets Spare** (no auto-mutation on load). ⚠ An earlier attempt added an auto self-heal in `flLoad` (detach any spare part still linked) + an INC-030 dedupe hook — **both were REMOVED** the same session because auto-mutating fleet data on every load caused confusion (a legitimate "donor" link could be wrongly detached). Keep data fixes user-triggered. Backup: `pre_spare_detach`.

## 45. ENGINE SWAP flow — gearbox/propeller stay on boat, engine swaps alone (2026-06-20 PM)
**Physical model (the key idea):** the **engine** is the swappable unit; the **gearbox + propeller live at the boat's drive position** and by default STAY on the boat when the engine is swapped — the incoming engine bolts onto the existing gearbox. The old data model linked gearbox→engine (`gb.engineId`) only, so moving an engine "dragged" its gearbox+propeller along (the Rolanda→Hermetis donor confusion). This flow fixes that.

**New optional gearbox fields (backward-compatible):** `gb.onBoatId` + `gb.onBoatPos` — the "คาเรือ รอเครื่อง" pending state = gearbox mounted at a boat position **without** an engine (`engineId:null`). Invariant: `engineId` set → installed (boat via engine) · `engineId` null + `onBoatId` set → คาเรือ pending · both null → spare. Propeller needs NO new field (it stays on its gearbox via `gearboxId`, so it follows the gearbox automatically).

**Start-Job question** (`flMaintStart` · extends §17). Now fires for **ANY job type** (was scheduled/preventive only) whose engine asset has a mounted gearbox/propeller → modal `#fl-modal-start-gear` (stage 1 = `#fl-sg-stage1`, stage 2 = `#fl-sg-stage2`). Three choices:
- **↔ สลับเครื่อง (recommended)** → `flStartGearSwap()`: detach gearbox(es)+propeller from the outgoing engine → set `onBoatId/onBoatPos` (engineId=null · log "คาเรือ รอเครื่อง"); outgoing engine → `boatId=null, status='fixing'`; then `flStartSwapRenderPicker()` opens **stage 2** = a replacement-engine `<select id=fl-sg-neweng>` (candidates = engines not outgoing, not on this boat, not broken · spares first, donor engines tagged) → **ใส่เครื่องนี้** `flStartSwapInstall()` or **ยังไม่ใส่ตอนนี้** `flStartSwapSkip()`.
- **คงเดิม** (`flStartGearChoice('keep')`) — in-place service, nothing moves.
- **📦 ถอดไปสแปร์** (`flStartGearChoice('stash')`) — stash to spare (existing).

**`flStartSwapInstall()`** (the core fix): the replacement engine `eNew` — (1) **sheds its OWN gearbox/propeller** → they stay on `eNew`'s source boat as คาเรือ (`onBoatId=srcBoat/onBoatPos=srcPos`, or spare if eNew was a bare spare) — _the moving engine does NOT carry its drivetrain_; (2) install `eNew` at this boat/`next.pos` (status ready); (3) the **waiting gearbox** at that position (`onBoatId===boat && onBoatPos===pos && !engineId`) **adopts** `eNew` (`engineId=eNew.id`, clear onBoat fields) — propeller comes with it. Multi-engine jobs loop positions (`ctx.swaps[]`); `flStartSwapFinish()` → `flSave()` + `_flMaintStartProceed()`. New fns: `flStartGearSwap`/`flStartSwapRenderPicker`/`flStartSwapInstall`/`flStartSwapSkip`/`flStartSwapFinish`. State `window._flStartGear={jobId,parts,boatId,swap,swaps[]}`.

**Pending display:** gb list (`flRenderGbList`) — `_gbBoat`/`_gbPos` fall back to `onBoatId`/`onBoatPos`; row shows amber **WAIT** badge + "‹boat› ‹pos› · รอเครื่อง"; location filter `installed`=`engineId||onBoatId`, `spare`=`!engineId&&!onBoatId`; spareCount excludes pending. gb detail "Linked engine" → amber "คาเรือ · รอเครื่อง" panel when `onBoatId` set. Propeller list (`flRenderPropList`) `_prBoat`/`_prPos` + row `b` fall back to its gearbox's `onBoatId` so it groups under the boat too.

**Re-entry from an already-started job (2026-06-20 PM · added after the Start-only version):** the Start question only fires once, so a job started with **"คงเดิม"** had no way to pull/swap the engine later. Added a green **"↔ สลับเครื่อง"** button on each **engine** asset row in the job detail (`flRenderMaintDetailPink` Affected-assets · shown when `m.status==='inprogress' && a.engId`) → **`flMaintSwapEngine(jobId, idx)`**: builds the mounted gearbox/propeller list for THAT engine, sets `_flStartGear={...,reentry:true,onlyEngId:a.engId}`, opens the modal and calls `flStartGearSwap()` straight to the picker. `flStartGearSwap` honors `ctx.onlyEngId` (swaps just that one engine). `flStartSwapFinish` checks `ctx.reentry` → re-renders the job detail (`flRenderMaintDetail`) instead of re-running `_flMaintStartProceed` (job stays inprogress, no duplicate start). Verified live on the real in-progress MJ-052 (Hermetis Std · gearbox คาเรือ → donor Aluminous1 engine installed · gearbox adopted · job stayed inprogress · restored).

**Repair-location capture (2026-06-20 PM · added after the re-entry button):** "what determines where a pulled engine is repaired/stored" = the engine's **`spareLocation`** field (display fallback "Workshop"). Two gaps fixed: (1) the swap picker (stage 2 · `flStartSwapRenderPicker`) now has a **"เครื่องที่ถอด · ส่งซ่อม/เก็บที่"** dropdown `#fl-sg-engloc` (อู่ซ่อม/คลังกลาง/คลัง Tub Lamu/คลัง Visit Panwa, preselects the engine's current loc) → `flStartSwapInstall`/`flStartSwapSkip` write the outgoing engine's `spareLocation` + a `move` log; (2) the Edit-Engine form now **shows + saves the location row for Fixing too** (`flPickSt` shows `fl-eng-spare-loc-row` when `idx===3||(type==='eng'&&idx===1)`; `flSaveEngine` keeps `spareLocation` when `status==='spare'||'fixing'`; `flOpenAddEngineModal` preselects the saved value w/ legacy-option fallback; label → "สถานที่เก็บ / ส่งซ่อม"). Before this, the location only saved for Spare and a Fixing-save nulled it. Verified live (swap on MJ-052 → outgoing engine `spareLocation='คลัง Tub Lamu'` + fixing; edit form shows the row for a fixing engine).

**Editable on the Maintenance job too (2026-06-20 PM · per user "แก้ได้ที่หน้างานซ่อมด้วย"):** the MJ already had its own `m.location` (repair site, set at create-job). Added a **"📍 สถานที่ซ่อม / ส่งเครื่องไปที่"** editable row in the job detail (`flRenderMaintDetailPink` Boat-Status section · text input + datalist อู่ซ่อม/คลังกลาง/คลัง Tub Lamu/คลัง Visit Panwa + บันทึก) → **`flMaintSetRepairLoc(jobId)`**: sets `m.location` AND **syncs to every engine asset on the job that is off-boat/fixing** (`!e.boatId||status==='fixing'` → `e.spareLocation=val` + log) so you don't enter it twice. The swap picker's `#fl-sg-engloc` now prefills from `outEng.spareLocation||m.location||'อู่ซ่อม'`, and `flStartSwapInstall` writes the chosen location back to `m.location` too. Verified live (set "อู่ Thai Marine" on the job → m.location + the pulled engine's spareLocation both updated). `node --check` OK.

**Engine-status self-heal fix (2026-06-20 PM · the "ยังไม่ปิด Job ทำไมเป็น ready" bug):** §41's `_engActiveFix` required `m.setFixing!==false`, so an engine that's the asset of an in-progress job whose **boat** stays Available (setFixing:false · running on a replacement engine) was wrongly reverted from `fixing`→`ready` every load. Fix: **dropped the `setFixing` gate** — `setFixing`/`boatStatus` describe the BOAT, not the engine; the pulled engine is under repair regardless. Now any engine that is an asset of an `inprogress` MJ reads `fixing` (skips broken/spare). Verified live: 25005F-040036 (MJ-052 setFixing:false) + all open-job engines now correctly `fixing`.

**Verified live** (snapshot→run→restore, no real change): Artemis C.Port engine swapped for Okeanos donor engine → Artemis keeps its OWN gearbox+propeller (gearbox adopts Okeanos engine), Okeanos's gearbox stays behind on Okeanos (คาเรือ), old engine off-boat fixing. `node --check` OK. Backup: `pre_engine_swap_flow`.

## 46. Gearbox/Propeller link dropdowns — only valid targets (2026-06-20 PM)
- **Gearbox Edit · "ติดกับเครื่องยนต์" (`fl-gb-engine-sel`)** now lists **only engines mounted on a boat AND without a gearbox** (1 engine = 1 gearbox · a spare engine can't carry a gearbox) + always keeps the gearbox's own engine when editing. `_gbUsedEng = Set(other gearboxes' engineId)`; filter `!_gbUsedEng.has(e.id) && (e.boatId || current)`. (Live: 53 engines → 41 have a gearbox → 12 free → 9 on-boat shown, 3 spares hidden.)
- **Propeller Edit · "ติดกับเกียร์" (`fl-prop-gb-sel`)** now lists **only gearboxes installed on an engine AND without a propeller** (1 gearbox = 1 propeller) + keeps current. `_pUsedGb = Set(other propellers' gearboxId)`; filter `!_pUsedGb.has(g.id) && (g.engineId || current)`.
No backup taken (small UI-filter one-liners) · `node --check` OK.

## 47. By-trip manifest — color rows by boat (2+ boats) + sticky boat-count strip (2026-06-20 PM)
In `bkV2RenderTab2`, per route group compute `_routeBoatIds = distinct ops.boatId among non-cxl rows` + `_multiBoat = _routeBoatIds.length>=2` (before `zoneBlocks`). In the row build, when `_multiBoat && !vanMode && !_rgc(van group) && row has a boat`, the row gets `_boatRowStyle` = boat tint (`_bkV2Soft(bkV2BoatAvatarColor(bid),0.74)` — 0.9 was too near-white) + left accent bar (`box-shadow:inset 5px 0 0 <boatColor>`). Boat color = `bkV2BoatAvatarColor(boatId)` (same palette as the boat-cell avatar). Only ASSIGNED rows (`ops.boatId` set) color; unassigned rows stay plain (= ยังไม่จัด · doubles as a "what's left" cue). ⚠ **Must NOT gate on `!boatMode`** — the user assigns boats in **Boat Assign mode** (`boatAssignMode`), so that's exactly when the colors must show; the original `!boatMode` gate made it look like "nothing changed". Verified live in boatMode (21 Jun Phi Phi Bamboo → 11 rows, 2 colors #0F6E56/#534AB7).
- **Sticky boat-count strip (boatMode):** the rich per-boat count strip (`boatStrip` · per-boat `tot/cap` · "ที่ว่าง/เกิน" · "⚠ ยังไม่ assign N" · "✓ assigned ครบ") was moved out of `.t2-tripcard` (which has `overflow:hidden` → breaks sticky) into the top of `.t2-listcard`, wrapped in **`.t2-boatpin`** (`position:sticky;top:var(--topbar,0);z-index:46`) — so it pins while scrolling the manifest to watch "ใส่ครบไหม". Normal view keeps `boatStrip` (the collapsible `t2-boatbox`) in the tripcard as before. Assembly: tripcard `${boatMode?'':boatStrip}` · listcard `${boatMode?'<div class="t2-boatpin">'+boatStrip+'</div>':''}` before `vanStrip`. `node --check` OK · no backup (render + CSS only).

## 48. By-trip manifest — Boat Assign clusters rows by boat + lightest tint (2026-06-21)
Extends §47. In `bkV2RenderTab2` zoneBlocks, Boat Assign mode (`boatMode && !vanMode` → `_boatCluster`) now treats the assigned boat like Van Assign treats a group:
- **Cluster sort** (`alist.sort`): un-assigned rows (no `ops.boatId`) float to the **TOP** (what's left to assign), then rows group by boat ordered by **BOATS index** (`_boatIdx`), `_rowTime` within each boat. Mutually exclusive with the van sort (`if(_boatCluster){…} else if(_grouped){…}`) so pre-existing van groups don't double-sort in boat mode.
- **Per-boat header row** `_boatHdrRow(bid)` (mirrors the read-only van group header): avatar + `🚤 BoatName · N booking · pax/cap` (red "เกิน" when over `boat.cap`). `bid===''` → amber **"⚠ ยังไม่จัดเรือ · N ราย · pax"** header. Inserted in the assembly loop when `o.boat` changes (row objects now carry `boat:_rowBid`).
- **Row tint lightened + always-on in boatMode:** `_boatRowStyle` gate changed `_multiBoat` → `(boatMode || _multiBoat)` (so colors show the moment any boat is assigned, not only on 2+-boat trips), and `_bkV2Soft(c,0.74)` → **`0.9`** (lightest · fill barely visible · the `inset 5px` accent bar carries the boat cue). Normal manifest unchanged (still needs `_multiBoat`).
Helpers added (all in zoneBlocks scope): `_boatCluster` · `_boatId(a)` · `_boatIdx(bid)` · `_boatHdrRow(bid)`. Verified: `node --check` OK + node sort/header simulation (unassigned→top, boat clusters by fleet order, time within boat). Backup: `BACKUP/allotment_v2_20260621_pre_boatmode_cluster_color.html`.

**Follow-ups (2026-06-21, same session):**
- **Sticky boat strip offset fixed** — `.t2-boatpin` pinned at `top:var(--topbar,0)` (=0) so it floated to the very top & overlapped the day header (`.t2-hd`, also top:0). Changed to **`top:var(--t2-vangroup-top,52px)`** (= `TOP + dayHeaderHeight`, the SAME offset the Van strip `.bkv2-vanstrip` uses) → now pins cleanly **below** the day header just like Van Assign. (`--t2-vangroup-top` is always set in the `bkV2Render` rAF, line ~45072, regardless of mode.)
- **Boat-assign over-cap guard (`BA_CAP_TOL=2`)** — per user: "เกิน 2 ที่นั่งใส่ได้ แต่หลังจากนั้นบล็อค". `bkV2AssignBoat` now blocks (ASCII `alert`, no save) when assigning would push the boat's per-date pax **> cap + 2** (checks every trip date of the booking · `baAssignedPax(date,boatId)` minus self if already on it). `baAutoAssign` likewise: prefer a boat ≤cap, else least-loaded boat that stays **≤cap+2**, else leave unassigned (floats to top). Pre-existing over-cap assignments are NOT auto-removed.
- **Per-boat header cap = true day-total** — `_boatHdrRow` now flags `เกิน N` off **`baAssignedPax(date,bid)`** (boat's whole-day load across pickup zones), not just the zone's rows — fixes the "60/65 in this zone but really 70/65" mismatch. Shows "M booking · K โซนนี้ · TOTAL/cap pax" when the boat spans zones. `node --check` OK + guard math test (cap+2 allowed, cap+3 blocked, self-reassign no false block). No new backup (same session · pre-backup covers it).
- **Boat tint lighter + shows in Van Assign too** — row tint lightened `_bkV2Soft(c,0.9)` → **`0.95`** (after several "อ่อนลง/เข้มขึ้น" nudges · easy to tweak: the lone `0.95` literal in `_boatRowStyle`). `_boatRowStyle` gate `((boatMode||_multiBoat) && !vanMode …)` → **`((boatMode||_multiBoat||vanMode) && !_rgc && _rowBid)`** so the boat color also shows while arranging vans. Priority in `_rowStyle` reworked to **van-group color → van-selection highlight (`_selRow`) → boat-assign selection (`_bSelRow`) → boat tint**, so once a row joins a van group it uses the Van color, and ticking still shows a selection highlight. `node --check` OK.

## 50. By-trip manifest — Charter (เหมาลำ) bookings = own section at the TOP, full table (2026-06-21)
In `bkV2RenderTab2`, charter rows (`r.charter = t.bookingMode==='charter'`) are split into a **pseudo-zone `'__CHARTER__'`** (`zg` build: `zk=(r.charter&&!r.cxl)?'__CHARTER__':r.zone`), sorted FIRST via `_zord` (=-100), so they render **above the seat zones (Phuket etc.)**. Rendered through the **same `zoneBlocks` table machinery** → identical columns/details + **boat-assign works** (Boat column present, tick + bulk all there). The `__CHARTER__` block gets a purple **Charter card** wrapper (`border #C9BEEC`) + restyled header "🚤 เหมาลำ · CHARTER · N booking · M pax · ทั้งลำ · ระบุเรือตอนจอง". (First approach was a separate simplified card — replaced because the user wanted the full detail row + boat-assign.) Boat cell display now falls back to `r.charterBoatId` when `ops.boatId` is unset (shows the booked boat). **Voucher detail** (`bkV2VoucherTicket`): purple "🚤 CHARTER · เหมาลำ · ‹boat›" badge under the trip name when any trip `bookingMode==='charter'`. Trip pax aggregates still include charter; cancelled charter → `cxlBlock`. Backup: `BACKUP/allotment_v2_20260621_pre_charter_card.html`. `node --check` OK.

## 63. Pickup Map — value toggle + MoM + area drill-down + island capture (2026-06-23)
Built on §62. `pmapAgg` now aggregates per booking (not per trip) into `{pax,val}` per area & per market (`val`=`acctBookingTotal`), plus a **previous-period** pass (`_pmPrevAnchor`) for MoM and **island arrivals** for the period (`pmapArrivals` sums `mdDirTot(d,'in')` over `SB_MARKET_STATS`). State `_pmapMetric` (`pax|value`). Helpers `pmVal/pmCount/pmShowNum/pmFmtB` (pax mode = pax; value mode = ฿, dots scaled by `_PM.unit`=avg ฿/pax so total dot count ≈ pax). **#2 value toggle** (`pmapSetMetric` · toolbar คน/฿ segmented) → clusters, labels, legend, ranking all switch to ฿. **#3 MoM** (`pmapMoM(key)` vs previous period · ▲▼% in panel + ranked list). **#1 drill-down** (`pmapAreaDetail(key)` → top-5 hotels + top-5 agents + booking count, shown in the selected-area panel). **#5 island capture** (`cap = our pax ÷ island arrivals` · shown in toolbar with a tooltip that it's ISLAND-level not per-area — per-area arrivals don't exist, only nationality-level island data). Verified: `node --check` + node agg on backup (มิ.ย. 1190 pax · ฿2.32M · top-by-value Panwa Pier ฿449k · markets HPK ฿870k>RU ฿610k · May=no data→MoM null handled). Backups: `pickup_scatter_labels`, `pickup_map_v2`.

## 62. Pickup Map — upgraded to realistic full-screen Leaflet map + market filter + week/month/year (2026-06-23)
Replaced §61's static-SVG render with a **real interactive Leaflet map** (CARTO `light_all` tiles · loaded once via `pmapEnsureLeaflet` injecting leaflet@1.9.4 CSS+JS from cdnjs · network needed at runtime now). `renderPickupMap` builds the scaffold ONCE (`#pmap-bar` toolbar · `#pmap-map` 74vh map · floating `#pmap-panel`) and inits the map; subsequent calls only `pmapRefresh()` (re-agg + redraw + toolbar/panel) so the map isn't destroyed. **Dots** drawn on a `<canvas>` overlay (pointer-events:none, z 450) inside the map container, redrawn on `move/zoom/resize` via `map.latLngToContainerPoint(PHUKET_LL[area])` — pixel-fixed sunflower cluster per area (so cluster size is constant across zoom · `r=√shown·2.45`). **Area lat/long** baked in `PHUKET_LL` (26 areas · the old pixel `PHUKET_GEO` removed). Per-area **hit circleMarkers** (transparent, radius=cluster) handle click→`pmapSelect` + tooltip. **Market filter:** toolbar chips (`pmapSetMk` · click RU → only RU dots, clusters re-packed to that market's count · `pmapBuildDots` respects `_pmapMkFilter`). **Period:** `pmapSetMode('week'|'month'|'year')` + `pmapShift(±1)` on `_pmapAnchor` (default = latest trip date) · `pmapPeriod()` returns `{test,label}`. Detail panel = selected area's market split bars, else ranked list. State `_PM={map,canvas,hits,areas,mkTot,total,other}`. `node --check` OK. Backups: `pre_pickup_map`, `pre_pickup_map_leaflet`.

## 61. Pickup Map — dot-density of tourists per pickup area on a real Phuket outline (2026-06-23)
New sidebar view **"แผนที่จุดรับ"** (`data-view="pickupmap"` after Demand · `#view-pickupmap` / `#pickupmap-wrap` · dispatch `else if(view==='pickupmap') renderPickupMap()`). Shows **1 dot = 1 นทท**, coloured by market, clustered at each pickup area on a **real Phuket province outline**. **Geometry is baked static** (`PHUKET_GEO={W:620,H:700,path:"…",coords:{…}}`) — generated offline with `d3-geo geoMercator().fitExtent` + `topojson-client` from the datamaps `tha.topo.json` Phuket feature (path rounded to 1 dp ≈ 0.9KB), and pickup areas projected to pixel coords. No D3/topojson/network needed at runtime — plain SVG string. **Data:** per booking-trip in `_pmapMonth`, market = `marketSnapshot.market || sbGetAgent(agentId).market || b2c/unassigned` (colour `sbGetMarket().color`), area = `bkV2GetArea(pickupAreaId).name` → `pmNormArea` (strips "Visit "/"(self-arrive)"/"(beach)") → matched to `coords`; unmatched → "อื่น ๆ" list. Dots packed in a sunflower spiral within `r=√pax·2.45`; clusters de-overlapped with a JS spring+collision loop (anchor = real projected point · faint leader line when nudged). Click a cluster → right detail panel (market split bar + per-market pax/%); default panel = ranked area list. Month stepper `pmapMonthShift`. Verified: `node --check` + node agg on backup (มิ.ย. 2026 · 1190 pax · **98%→~100% mapped** after adding Layan/Naiyang/Ko Kaeo/Siray/Naiharn coords · markets ru/hpk/cpk/ota/ww/ap resolved). Backup: `BACKUP/allotment_v2_20260623_pre_pickup_map.html`.

## 60. Van Assign — booking added to a group inherits the van (no more ตกบุคกิ้ง) (2026-06-23)
**Bug:** adding a booking to an EXISTING van-group via `bkV2VanGroupSelected` set `ops.vanGroup` + `vanSeq` but NOT `ops.vanId` → the booking showed inside the group in By-trip (looked assigned) but had no van → Van Job Orders counted it as "ยังไม่จัดรถ" → risk of missing a customer pickup. **Fix (2 layers):** (1) **source** — `bkV2VanGroupSelected` now reads the group's existing van/return-van (via `_bkV2GrpApply`) into `_gVan`/`_gRet` and applies them to the rows it adds (split + non-split). (2) **safety net** — new **`bkV2VanGroupHeal(date)`** reconciles `vanGroup → vanId` for a date: per group key `date|route|zone|gid`, any member missing `vanId` inherits the group's van (+ `vanReturnId`). Called at the top of `renderVanJobs(date)` and `bkV2RenderTab2` (van mode) so every open of those pages auto-fixes stale data (idempotent · persists only when it heals · scoped per route+zone so it never borrows another route's van). Verified: `node --check` + node sim (group1 w/ veh05 heals the empty member to veh05+veh06; group2 with no van stays null; different-route group1 stays null). `node --check` OK.

## 59. Boat Assign — a Charter boat can't be picked for seat customers (2026-06-22)
New rule: a boat committed to a **Charter (เหมาลำ)** booking on a date is wholly taken → must NOT be selectable/assignable for seat-share pax that date. New helper **`baCharterBoatIds(date)`** = Set of boat ids from charter trips (`t.bookingMode==='charter'` → `t.charterBoatId || charter booking's ops.boatId`), read straight from `SB_BOOKINGS` so it works even if Boat-Op never flagged the boat. **`baDayBoats(date)`** (the base pool for every seat boat picker — per-row `baBoatCellHTML`, bulk action-bar `baBoatsForRoute`, `baAutoAssign`) now filters `!chSet.has(bid)`. Defensive guards added: `bkV2AssignBoat` (per-row) + `bkV2BoatAssignSelected` (bulk) alert+abort if the target boat is a charter boat on any of the booking's dates. Verified: `node --check` + node check on backup (22 Jun charter on b2 Artemis → `baCharterBoatIds` returns `{b2}` → Artemis excluded from seat pool that day). `node --check` OK.

## 58. Van Job Orders — per-date driver/phone override (partner vans · updatable before trip) (2026-06-22)
Partner vans (`v.ownership==='partner'`) change driver daily, so driver/phone can't be fixed on the vehicle. New per-date override `VANJOB_DRIVER[date+'::'+vanId]={driver,phone}` (LS `vanjob_driver` · `vanJobsDriverPersist`), resolver **`vanJobsDriverInfo(vanId,date)`** → `{driver,phone,override}` falling back to the vehicle's registry default when unset. Edit fns `vanJobsSetDriver(date,vanId,field,el)` (save-on-input · no re-render = keeps focus, like pickup-TH) + `vanJobsResetDriver` (clear→re-render). Surfaces: (1) **Van Job list** — `คนขับ`/`เบอร์โทร` columns + tel: link now use `_drv=vanJobsDriverInfo(vid,date)`; a 📌 shows when overridden. (2) **Expand panel (✎)** — new top section "🚐 คนขับวันนี้" with name+phone inputs (placeholder=registry default · เว้นว่าง=ใช้ default) + ↺ คืนค่าตั้งต้น; partner vans get a "รถร่วม · เปลี่ยนได้ทุกวัน" tag. (3) **Job order document** — center header driver/phone use `_drv` + a "📌 อัปเดตวันนี้" badge when overridden. (4) **Registry (renderVehicles)** — partner-van driver row tagged "ค่าตั้งต้น" + a hint that the real driver is set per-trip in the job order. (5) **By trip date · Van Assign group header** (`_grpHeaderRow` in `bkV2RenderTab2`) — when a group has a van, an inline 👤 driver + phone editor (placeholder=registry default · 📌 when set) writes the SAME `VANJOB_DRIVER[date::vanId]` store via `vanJobsSetDriver` → editing in the job order OR in By-trip both update the other (shared per-date key). Per-date keyed → tomorrow starts fresh; non-destructive to the vehicle default. (6) **Plate per-date for partner vans** (2026-06-22) — `vanJobsDriverInfo` now also resolves `plate` (`o.plate || v.plate`, + `plateOverride`); a **ทะเบียนรถ** input shows ONLY for `v.ownership==='partner'` in the ✎ panel + the van-mode group header (writes `VANJOB_DRIVER[...].plate`). Resolved plate flows to the job-order header + list-row plate (📌 when overridden). (7) **Read-only By-trip group header** (`!vanMode` branch of `_grpHeaderRow`) now reads driver/phone/plate via `vanJobsDriverInfo(vid,date)` instead of raw `v.driver/v.plate` — so the per-date driver (e.g. partner van with no registry default) actually SHOWS in the normal manifest. `node --check` OK.

## 57. Van Job Orders — ② RETURN lists EVERY passenger the van brings back (Option A · 2026-06-22)
Follow-up to §56: the return section only showed CROSS-van returns (`vanReturnId===vid && !==vanId`), so a van that took 6 pax out but returns them itself showed an empty/1-row ② → driver confusion ("who brings back the 6 I dropped?"). Now **`_collect(isRet=true)` uses `returnVan = vanReturnId || vanId`** (default = same outbound van) and matches `returnVan===vanId` → ② lists ALL bookings this van returns: its own outbound pax (tagged "· กลับคันเดิม", drop = their hotel) + any cross-van returns (tagged "· มาจากรถอื่น (ขาไป ‹van›)", e.g. Jaminah → ตลาดใหญ่). Row carries `outVid` (outbound van) for the tag. Bookings whose return is a DIFFERENT van are excluded from this van's ② (they sit in that van's ②) and keep the big "↩ ขากลับ โดย ‹van›" pill in ① here. Also: outbound Drop-off cell now shows **"→ ท่าเรือ"** instead of "same" (`dropCell` helper); return drop-off is bold. So every van's sheet has the SAME shape (① เช้ารับส่งท่า · ② เย็นรับกลับ) — consistent, no interpretation needed. (List badge "↩ ขากลับ N" still counts only cross-van via `aggRet` — the noteworthy exception flag.) Verified: `node --check` + node sim (veh06 ② shows its 3 outbound pax as กลับคันเดิม). Same backup as §56 (`pre_unified_vanjob`).

## 56. Van Job Orders — unified ONE-document-per-van (① ขาไป + ② ขากลับ sections) (2026-06-22)
Job orders were split into separate outbound and return documents (a van doing both appeared as two rows/docs → confusing). Now **one job order per van**, containing two sections with the SAME detail columns as before. `renderVanJobs`: `jobList` rebuilt as one descriptor per van (`{vid, key:vid, out:agg[vid]||null, ret:aggRet[vid]||null}`) via a union of `ids`+`retIds` (was `ids.map(out).concat(retIds.map(ret))` with `key=vid|ret`). List row shows the van once with a gold **"↩ ขากลับ N"** badge when it has return bookings (replaces the old `legBadge`); Booking count shows `outBk` (+`↩retBk` when both); return-only vans get the gold gradient. **`vanJobsOrderInner(date,vanId)`** refactored: `_collect(isRet)` + `_section(isRet)` build each leg's table (identical columns), assembled as `secHd① + table` then `secHd② + table` under one header/bighd; section headers are colored bars (green OUTBOUND / gold RETURN); cross-van returns render a **big gold pill "↩ ขากลับ โดย ‹van›"** in the outbound Drop-off cell (was tiny `return: X` text). `bkV2VanJobOrder(date,vanId)` + preview key are now per-van (`_vanJobsPreview=vid`, no `|ret`); `leg` arg kept but ignored. `vanJobsBookingsFor` unchanged (still per-leg, used by the expand panel + `_section`). Backup: `BACKUP/allotment_v2_20260622_pre_unified_vanjob.html`. `node --check` OK.

## 55. By-trip manifest — separate-drop-off return: alert + return-van display + job-order detail (2026-06-22)
A booking that returns to a DIFFERENT place than pickup (`bk.dropoffSame===false` with `dropoffHotelName`/`dropoffArea`, e.g. BK-26060455 · pickup Crest Resort · drop "ตลาดใหญ่") needs an explicit return-van decision. New helper **`bkV2RetInfo(bk)`** (next to `bkV2AssignVanReturn`) → `{sep, drop, retId, arranged, alert}` where `alert = sep && !arranged` (arranged = `ops.vanReturnId` set, or every `vanSplits[].vanReturnId` set). Three surfaces:
- **Manifest "Send back" cell** (`bkV2RenderTab2` ~48273) — now shows the drop-off location PLUS a chip: green `↩ ‹van name›` when a return van is arranged, or red `⚠ ยังไม่จัดรถกลับ` when not. (Was just the location text. The cell render at the `<td>` no longer re-wraps in `t2-sb` since `sendBack` is now full HTML.)
- **Trip-level alert** (`retAlertBar`, rendered after `addonBar`) — red strip `⚠ ส่งกลับคนละที่ · N booking ยังไม่จัดรถกลับ` when `_retAlertN=grp.filter(r=>!r.cxl && bkV2RetInfo(r.bk).alert).length > 0`.
- **Van job order** (`vanJobsOrderInner` ~37463) — return-leg Drop-off now uses the **separate location** (`_sepDrop=dropoffHotelName||dropoffArea`) instead of reversing to the pickup hotel (`isRet ? (_sepDrop||_hotel) : _sepDrop`); outbound Drop-off cell prefixes a gold **"↩ กลับ:"** when the drop-off differs so the driver sees it's the return destination. (Booking still needs a `vanReturnId` to appear in a return job order — the alert drives the dispatcher to set it in Van Assign.)
Verified: `node --check` + `bkV2RetInfo` on real data (BK-26060455 alert=true · after assigning a return van alert=false · same-drop-off booking sep=false). Backup: `BACKUP/allotment_v2_20260622_pre_return_dropoff_alert.html`.

## 54. Daily Log — "ออกแล้วเสียเย็น" boat counts on its breakdown day (2026-06-22)
`flRenderDR` zeroed any boat whose `getCurStatus(b,ds).s!=='available'` (`eff=0`, `noEntry`, "Fixing" badge) — so a boat that **ran the morning trip then went to repair in the evening** (status `fixing` from that date · MJ) showed PAX 0 + couldn't enter Daily Log, though it operated (e.g. Artemis b2 · 2026-06-13 · MJ-051 · ~49 pax on r10, engines already logged). **Fix (scoped to Daily Log only):** new `ranDespite = !avail && (hasLog || (binfo.pax>0 && cs.from===ds))` — `hasLog` = real saved Daily-Log data that day (fuel>0 / paxActual / any engine reading); the bookings branch requires today to be the **FIRST day of the downtime** (`cs.from===ds`, i.e. broke after the morning trip) so a long dry-docked boat with a stray assigned booking is NOT flipped. When `ranDespite`, `operated=true` → `eff` = actual/booked pax, `noEntry=false` (entry row shown), trips render normally **plus** an amber "ออกแล้ว · เข้าซ่อมเย็น/หยุดเย็น" chip (`ranChip`). KPI totals (PAX/trips/operating/fuel anomalies) now include the day. `boatPax[].ranDespite` carries the flag to `buildBoatRow` (`const ran`). Does NOT touch Boat-Op / booking availability (those still use `getCurStatus`). Fuel Intelligence already counted such days (its own ran-rule). Verified: `node --check` + sim (Artemis 06-13 ranDespite→eff 49 · Artemis 06-16 mid-downtime→0 · Tadeo dry-dock→0). Backup: `BACKUP/allotment_v2_20260622_pre_ranthenfix_dailylog.html`.

## 53. Fuel Intelligence page (view `fl-fuel` · under Fleet Insights · 2026-06-22)
New nav item **"Fuel · น้ำมัน"** right after `fl-insights` → `#view-fl-fuel` / `#fl-fuel-wrap` → **`renderFuelIntel()`** (dispatch `flView==='fuel'` in `nav()`). Fleet-Insight visual (big number + pink pills · **green hero** `#1C4A30` for ต้นทุน/pax + MoM trend · black anomaly card · pink-border missing card). Data: **`_fuelAgg(month)`** aggregates `FL_DAILY` for a calendar month (month stepper `_fuelMonth` + `fuelMonthShift`): fuel L + cost (`fuel × flFuelPrice(ds, boat.pier)`) by boat & by **program-family** (`bkV2RouteFamily`, fuel/cost allocated by pax share), pax via `flBoatBookingsFor`, **L/engine-hour** (per-boat run hours = max engine meter-delta via `flPrevMeter`), **missing-fuel days** (ran but `fuel<=0`), **anomalies** (boat-day fuel > boat-avg×1.3), **weekly cost trend**, **revenue per family** (`acctBookingTotal` / `t.subtotal` → **% รายได้**). **Budget** stored in `localStorage.loveandaman_v2.fleet_fuelbudget[YYYY-MM]` (read-modify-write · `_fuelBudgetGet`/`fuelSetBudget` · "+ ตั้งงบ" prompt) → projection (cost/elapsed×daysInMonth) vs budget. MoM compares cost/pax vs prev month. Sections: KPI row · แยกตามเรือ table · ประสิทธิภาพ L/hr bars (best green / worst red) · แยกตามโปรแกรม (L/pax·฿/pax·%รายได้) · weekly trend · "◆ ต้องตรวจสอบ" anomaly bar · missing-fuel grid. Warns "⚠ บางวันยังไม่ใส่ราคาน้ำมัน" when price missing (cost=0 those days). Verified: `node --check` + node agg on real backup (มิ.ย. = 19 trip-days · 6,162 L · ฿86,602 · 6 missing). Backup: `BACKUP/allotment_v2_20260622_pre_fuel_intel.html`.

## 52. Boat Op popover / Daily Log "0 pax" when bookings not boat-assigned — kept as-is (2026-06-22)
Symptom reported: a route-day with a boat assigned in Boat Op but **bookings not boat-assigned** (`bk.ops.boatId` empty · Whale Shark 2026-06-17 = 4 pax, 0 boat-assigned) shows **0** in the Boat-Op popover (`baAssignedPax`) and no input row in Daily Log (`noEntry = pax===0`). Briefly tried auto-allocating the route's pax to the assigned boat, but **reverted per user** — the 0 is CORRECT (a signal that the user hasn't assigned the bookings to the boat yet). Proper fix is workflow: By-trip-date → Boat Assign → assign the boat to those bookings → `ops.boatId` set → everything shows. Both `bop2OpenCellPopover` (per-boat = `baAssignedPax`) and `flRenderDR` (`noEntry = isNotAvail || pax===0`) left at the original rule.

## 51. Engine service — reset baseline on oil change (2026-06-21)
Was: "hours until service" = pure modulo (`ceil(curH/interval)*interval`) → it silently assumed service happened exactly every interval, never tracked an actual oil-change event. Now there's a **service baseline**: optional engine field **`lastServiceHours`** (+`lastServiceDate`). New helper **`flEngServiceState(e)`** (next to `flEngHours`, ~16545) is the single source: `base = lastServiceHours ?? baseHours ?? 0`, `next = base + interval`, `left = next − curH` (negative = overdue), `pct = (curH−base)/interval`. Engine-hours still come from `flEngHours` (latest Daily-Log reading per engine id). **`flEngMarkService(engId)`** = prompt for the hour reading at service (defaults to current) → sets `lastServiceHours`/`lastServiceDate` + pushes a `type:'service'` log entry + `flSave()` + re-render. Wired into: **Engine detail** (`flRenderEngDetailPink` hours card now uses `flEngServiceState` + shows "Last service: Xh · date → next at Yh" + green **"✓ บันทึกเซอร์วิส"** button) and the **Maintenance "Upcoming"** card (uses `_ss.left`, shows **OVERDUE** in red when negative). `flSaveEngine` uses `Object.assign` so the new fields survive edits (no schema migration needed · field is optional). Backup: `BACKUP/allotment_v2_20260621_pre_engine_service_reset.html`. Verified `node --check` + service-state math (svc@85h→next 185h, overdue case).

**Linked to Maintenance close (2026-06-21):** `flMaintServiceReset(m, outcome)` (next to `flEngMarkService`) is called inside **`flMaintClose`** (just before the final `flSave`). On closing a job with `outcome` success/limited that has engine assets AND looks like a service (`m.type==='scheduled'` OR title/detail matches `น้ำมัน|ถ่าย|เซอร์วิส|service|oil|svc`), it `confirm`s "Was this an engine service?" then `prompt`s the hour reading per engine (default = current `flEngHours`) → sets `lastServiceHours`/`lastServiceDate` + log entry per engine. Heuristic excludes non-oil preventive jobs (e.g. "เปลี่ยนไดโว่" → no prompt; "ถ่ายน้ำมันเครื่อง" → prompt). So oil change is done **through Maintenance** (job + parts) and the hour-reset happens **at close** — the standalone Engine-detail button stays as a shortcut/backfill. ASCII confirm/prompt text. `node --check` + heuristic test OK.

**Option ข — count hours run since attach (2026-06-21 · DONE · simplified per user).** First tried a manual `meterAtInstall` field — user rejected it as too complex. Final model: **no extra manual field**. The Daily-Log value is the engine's own hour-meter reading; the system just counts the **delta** since the engine attached to its current boat and adds it to `baseHours` (ชั่วโมงสะสมเดิม):
> **`flEngHours(id) = baseHours + (latestReading − firstReading)`** where both readings are scoped to `ds >= e.installDate` (the attach date · auto-set on swap · blank = count all log).
So e20 (base 4,727.3, readings 5,152→5,174.7) = 4,727.3 + (5,174.7 − 5,152) = **4,750.0h** · next service 4,827.3 · **77h left** (not overdue). Self-consistent: if `baseHours` is set to accumulated-hours it gives true hours; if set to the meter-at-start it returns the raw meter. `flEngServiceState` base stays `lastServiceHours ?? baseHours`. Touch points: edit-form field relabelled "มิเตอร์ตั้งต้น"→**"ชั่วโมงสะสมเดิม"** (only `baseHours`, no meter field) · `flEngHours` = `baseHours + (latest − first meter reading across ALL Daily-Log entries · skip ≤0)` · **engine detail** shows "สะสมเดิม Bh + วิ่ง Δh (มิเตอร์ first→last) = curHh". **No installDate / no swap-freeze** — the hour meter is physical on the engine and continuous (follows it across boats), so `base + (last − first)` is already swap-safe with no per-boat baseline. **`flPrevMeter`** (Daily-Log Δ) likewise skips ≤0 and does NOT fall back to `baseHours` (it's accumulated hours, not a meter → returns null = no Δ shown). ⚠ **Reverted (2026-06-22):** an earlier attempt added `meterAtInstall`, then `installDate`-scoping + a swap-freeze in `flStartSwapInstall` — both REMOVED because (a) installDate scoping silently dropped back-filled logs before the attach date ("เพิ่ม log วันที่ 15 แต่ไม่ถูกบวก"), and (b) `flPrevMeter`'s baseHours-fallback produced a negative Daily-Log Δ on Hermetis C.Port. Leftover `installDate` fields on engines are now just ignored. Backup: `BACKUP/allotment_v2_20260621_pre_meter_baseline.html`. Verified `node --check` + math (e6 base5102.1 + readings[0,5152..5174.7] = 5,124.8h · adding 15th=5180 → 5,130.1h). **Fix (same session):** `flEngHours` + the engine-detail loop now **skip Daily-Log readings `<=0`** — a `0` placeholder entry (logged when a trip is recorded but the meter wasn't read, e.g. e6 had `2026-05-25 = 0`) was being taken as the `first` reading → delta `5174.7−0` blew the hours to 10,276.8. With 0 skipped, e6 = 5,102.1 + (5,174.7−5,152) = **5,124.8h**. Also: engine edit-form **position dropdown** corrected to the real values **Port · C.Port · Center · C.Std · Std** (was Starboard/Centre/C.STBD/P1/P2/S1/S2 · missing C.Port) + `flOpenAddEngineModal` now **preselects** the engine's current `pos` (legacy fallback option if non-standard).

## 50.1 Trip-header summary redesigned — Availability | Total | Charter | Seat (2026-06-21)
Per user, the trip header KPI cells ("รวม/SEAT/เหมาลำ/AD/CHD/FOC/คงเหลือ" · confusing) were replaced by a single line **`.t2-availline`**: **Availability** `_seatLeft` (=`getAllotment().seatsAvailable` · open-boat seat pool − seat bookings − locks · "ไม่ต้องรอจัดเรือ") | **Total** `recv` `(ad+chd+inf+focFOC)` | **🚤 Charter** `_chtrPax` `(…)` | **Seat** `_seatPax` `(…)` (Charter+Seat only when `_chtrPax>0`) | **🔒 Lock** when any. Per-pax-type seat/charter split computed in the aggregate area (`_sAd.._cFoc`), helper `_bdStr(a,c,i,f)`. ⚠ **Availability depends on charter occupying its boat in Boat Op** — `getSeatsConsumed` excludes `bookingMode==='charter'` and `getAllotment` only subtracts a boat from the pool if Boat-Op TRIPS flags it `type==='charter'`/`charterBookingId`; if a charter booking doesn't reserve its boat there, the seat pool won't drop (shows e.g. 67 not 2). CSS: `.t2-asg`/`.t2-asg-l/-v/-bd/-div`. `node --check` OK.

## 49. Boat Assign — tick column + assign-all-at-once (2026-06-21)
Mirrors Van Assign's tick-to-group, but for boats. In `bkV2RenderTab2` Boat Assign mode (`boatMode`):
- **Checkbox in the Boat column** (per row · `bkV2BoatSelToggle(bkId)`) — ticked rows get a blue selection highlight (`_bSelRow` in `_rowStyle`, wins over the boat tint). Selection state = global `window._bkV2BoatSel{bkId:true}`.
- **Bulk action bar** `boatSelStrip` (rendered inside the sticky `.t2-boatpin`, below the boat-count strip · shows only when ≥1 row in this trip is ticked): big `N pax · M ราย` count + **"🚤 จัดลงเรือ: ‹select›"** (route boats via `baBoatsForRoute`, each option shows `load/cap · ว่าง/เกิน/เต็ม`) + **ล้างที่เลือก**. Picking a boat fires `bkV2BoatAssignSelected(date,routeId,boatId)`.
- **`bkV2BoatAssignSelected`** loops the ticked bookings that belong to this trip, assigns each to the boat **honoring the cap+`BA_CAP_TOL`(2) guard incrementally** (`baAssignedPax` re-reads after each mutation), removes assigned ids from the selection, and **skips + alerts** any that would overflow (keeps them ticked so you can pick another boat). Single `acctPersistBookings()` + one re-render.
- New fns near `bkV2AssignBoat`: `bkV2BoatSelToggle` · `bkV2BoatSelClear` · `bkV2BoatAssignSelected`. No COLN change (checkbox lives inside the existing Boat cell). Per-row `bkV2AssignBoat` (single assign) untouched. Verified: `node --check` OK + node bulk-guard sim (cap10+2: 3→ok 2→ok 4→skip). Backup: `BACKUP/allotment_v2_20260621_pre_boat_bulk_assign.html`.

**Bug fixes (2026-06-21, same session):**
- **Van Assign unassigned-row frame softened** — `.t2-unassigned` was a heavy amber **2px box** around the whole `<tr>` → changed to a faint cream fill `#FFFCF5` + thin `inset 4px` soft-amber accent bar (`#EAC489`), matching the Boat-Assign feel. CSS-only.
- **Disband → re-group → Sort "ไม่จัดเรียง" FIXED** — root cause: `bkV2VanGroupDisband` cleared `vanGroup` but **left `vanSeq`** on the booking, and the `alist` sort applied that stale manual pickup-order **even to ungrouped rows** → they froze in the old order, ignoring time and any clicked column Sort. Two fixes: (1) disband now `delete`s `vanSeq` (both split + non-split). (2) the van sort only honors `seq` **within a real group (`ka>0`)**; for ungrouped rows it now tiebreaks on the active **column Sort** (`_rowCmp` when `sortCol` set) else **pickup time**. Verified: `node --check` OK + node sort sim (3 ungrouped rows w/ stale seq → now order by time). No backup (covered by `pre_boat_bulk_assign`).
- **Van Assign unassigned cue → boat color** (per user "ใช้แค่กรอบที่คลุม + ดึงสีเรือมาใส่แทน") — `.t2-unassigned` dropped the cream `background !important` + amber accent bar → now just a **thin amber FRAME** (`1px #ECC78D` top/bottom + first/last-child left/right). With the fill override gone, the inline `_boatRowStyle` (boat tint, `_bkV2Soft 0.95`) shows through, so each ungrouped row displays its **boat color** inside the frame; boat-less rows stay white. CSS-only.
- **Show van per row in Boat Assign mode** (per user "เปิด Boat assign ไม่รู้ว่า booking อยู่รถคันไหน") — `_vanChipHtml` built in boatMode (`vehGet(ops.vanId).name`, or split parts `name ·pax`, or "กรุ๊ป N · ยังไม่เลือกรถ" dashed when grouped but no van) → **🚐 chip under the TIME cell** (moved there per user · was under the lead name), **colored per van** via the trip's `vanColor` map (PAL_BOAT palette · `_vanIdsRoute` now also collects split van ids) so Love1/Love2 differ. Only renders in `boatMode`.
- **Unassigned section always visible in Van mode + thicker frame** (per user "ยกเลิกแล้วไม่เด้งกลับไปข้างบน" + "เส้นขอบให้หนาขึ้น") — the "⚠ ยังไม่ assign" header now renders whenever `vanMode || _hasGroups` (was `_hasGroups` only) so after disbanding/cancelling, the ungrouped rows are clearly headed at the TOP (the sort already floats g=0 → top · verified by node sim). `.t2-unassigned` frame thickened `1px #ECC78D` → **`2px #E6A85C`**. (Note: disband already floats rows up — the missing piece was the header not showing once the last group was gone.) CSS + one-line assembly change.
- **Van group with no van picked → red frame** (per user) — `_grpVan{gid:true}` (any member has a vanId) computed next to `groupColor`. Group header (van mode): when `!vid` → light-red bg `#FCEDED` + red accent `#D64545` + red top/left/right border + "⚠ ยังไม่เลือกรถ" label. Member rows get class **`t2-novan`** (`vanMode && a.g>0 && !_grpVan[a.g]`) → red 2px frame (`#E05B5B`, no fill override so the group color stays). Clears to normal automatically once a van is chosen. CSS by `.t2-novan td` borders.
- **Van Jobs hero card red when incomplete** — `renderVanJobs` "ใบงานวันนี้" status card: bg `#1C4A30`→**`#8A1C1C`** + red glow ring when `unTot>0`, text → red-toned warning; stays green + bright-green text when all assigned.
- **Van dropdown = matrix-assigned vans ONLY** (per user "รถที่ไม่ได้ assign ในตารางเดือน เลือกได้") — `vanVehiclesForRoute(date,routeId,zone)` **dropped the zone-vans fallback** → returns only `v.dayRoute[date]===routeId` (vans put on this route in the Transfer-Fleet month matrix). Group-header van `<select>` shows a disabled hint "— ยังไม่มีรถจัดให้โปรแกรมนี้ (จัดในตารางเดือน) —" when empty; an already-assigned van not in the matrix is still kept as a selected option (no data loss). Affects the group-header pool + the per-row return-van pool (`bkV2VanCellHTML`). `node --check` OK.

## 64. Transfer Fleet matrix — group count in "สรุปการจัดรถ" (2026-06-23)
The month-matrix summary (`_vehMatrixSummaryHTML(day)`) showed only van COUNT per program ("N คัน"). Added **van-GROUP count** so staff see how many pickup groups are arranged after grouping. New helper **`_vehGroupsForDay(routeId,day)`** → `{total,withVan,woVan}` = distinct van groups on that route+date keyed `zone|vanGroup` (zone-scoped per §19.2 · honors `ops.vanSplits[]`, skips cancelled/charter, woVan = group with no `vanId` yet). Surfaces: (1) each route card right-column gains a purple sub-line "**N กรุ๊ป**" (+ red "· M ยังไม่มีรถ" when a group has no van). (2) header line "จัดแล้ว X คัน" → "… · **Y กรุ๊ป** (Z ยังไม่มีรถ)". Verified: `node --check` (3 blocks, 0 err) + node sim (zones separate, splits counted, cancelled ignored, van/no-van split). Backup: `BACKUP/allotment_v2_20260623_pre_matrix_groupcount.html`.

## 65. Pickup Map — vivid dot colors (2026-06-23)
Dots on the Leaflet pickup map looked muted on the pale CARTO tiles. Added **`pmVivid(hex)`** (next to `pmMktColor`) = hex→HSL, **saturation ×1.55 +0.12 floor**, lightness clamped to mid (>0.68→0.58, <0.34→0.43) so very pale/dark market colors still read, back to hex. **Greys pass through unchanged** (`if(s<0.08) return hex` — keeps ไม่ระบุ/Walk-in neutral instead of turning khaki). Used in `pmapBuildDots` dot color (`c:pmVivid(pmMktColor(mk))`); `pmapDraw` dot alpha .9→.95 + radius 1.8→2.0 for extra pop. Legend chips/list keep the original `pmMktColor` (brand swatches unchanged). `node --check` OK + transform test (red/blue/amber/purple noticeably brighter, pure grey untouched). Backup: `BACKUP/allotment_v2_20260623_pre_pmap_vivid.html`.

## 66. Service-hour reset on close — single confirm + retro button for DONE jobs (2026-06-23)
Reported: closed service job MJ-055 (Artemis · เปลี่ยนถ่ายน้ำมันเครื่อง · 4 engines) but the engine **service-hour baseline (`lastServiceHours`) was not reset** → next oil-change interval didn't restart. Diagnosis: the §51 `flMaintServiceReset(m,outcome)` hook IS wired in `flMaintClose` (line ~27184) and the job qualifies (title matches `น้ำมัน|ถ่าย` regex, outcome `success`), but the old flow was **confirm + a separate `prompt()` per engine (5 dialogs)** — easy to miss/cancel — and a job already DONE had **no way to retrigger**. Fixes: (1) **`flMaintServiceReset` rewritten to ONE confirm** that lists each engine + its current `flEngHours`, and on OK **auto-sets `lastServiceHours = current hours` for ALL engines** (no per-engine prompt; far less fragile). Custom hour entry still available via the engine-detail "✓ บันทึกเซอร์วิส" button. (2) New **`flMaintServiceResetManual(jobId)`** + a green **"↻ รีเซ็ตรอบเซอร์วิส"** button in the Affected-assets header of `flRenderMaintDetailPink`, shown when `m.status==='done'` AND the job has engine assets AND looks like a service (type scheduled OR title/detail regex) → lets staff reset retroactively on already-closed jobs (e.g. MJ-055). Calls the reset, `flSave()`, re-renders eng list + detail. ASCII confirm text. `node --check` OK (3 blocks, 0 err). Backup: `BACKUP/allotment_v2_20260623_pre_service_reset_fix.html`.

## 67. Per-asset maintenance cost = job cost ÷ same-type asset count (2026-06-23)
Reported: MJ-055 (Artemis · oil change · 4 engines · ฿8,464.64) showed the **full ฿8,464.64 on every engine** in Engine-detail lifetime/YTD/per-row cost (assets linked by `engId`, no division) → summing the 4 engines = ฿33,858 (4× overcount). The job is one service across 4 engines (8 GA oil / 4 filters / 4 washers shared) → fair = ~฿2,116/engine. Fix: new helper **`flMaintCostShare(m, kind)`** (next to `flMaintServiceReset`) = `flMaintCalcCost(m.id) ÷ (count of assets with engId|gbId|propId on the job, min 1)`. Applied ONLY on the three asset-detail pages: Engine (`flRenderEngDetail` lifetime/ytd/per-row), Gearbox, Propeller — each adds a scope `const _costKind='eng'|'gb'|'prop'` and the shared per-row line uses `flMaintCostShare(m,_costKind)`. **Job/boat/project/Fleet-Dashboard/maint-list totals UNCHANGED** (still `flMaintCalcCost`, counted once per job). So MJ-055 now reads ฿2,116.16 per engine (×4 = job total exactly). For a mixed job, each page divides by its own asset-type count (matches user's "÷ จำนวนเครื่อง" model; per-page consistent). Verified: `node --check` (3 blocks, 0 err) + node share sim (4-engine = 2116.16 ×4 = 8464.64 · mixed 2eng+1gb = 4232.32/eng). Backup: `BACKUP/allotment_v2_20260623_pre_cost_per_asset.html`.

## 68. Gearbox service cycle (gear-oil) — reset baseline like engine + cost already shared (2026-06-23)
User: "Gear ต้องมีรอบ Service เหมือนกัน · Cost ต้องแชร์ไหม". Decisions (AskUserQuestion): gear cycle counted from **the attached engine's hours**; engine-oil & gear-oil are done in **separate jobs** (so §67 per-type cost-share already correct — no cost change needed). Built (mirrors §51 engine cycle): **`flGbLifetimeHours(g)`** = prev-engine usage (remove logs) + current-engine hours since install · **`flGbServiceState(g)`** = countdown relative to last gear-oil (`g.lastServiceHours` in lifetime hours; **default base = current lifetime when never serviced** so it doesn't spam "overdue"; interval = `g.serviceInterval || GB_DEF_SVC_INTERVAL=200`, editable) → `{since,next,left,pct,overdue,defaulted}` · **`flGbMarkService(gbId)`** prompts lifetime-hours-at-service → sets `lastServiceHours`/`lastServiceDate` + log · **`flGbSetInterval(gbId,val)`**. Gearbox detail "Current cycle" card rebuilt → "รอบถ่ายน้ำมันเกียร์": hours-since-last-service big number + bar + "ถ่ายล่าสุด Xh → รอบหน้า Yh" + inline interval input + green **"✓ บันทึกถ่ายเกียร์"** button. Gearbox-list "Service due" KPI now uses `flGbServiceState().pct>=80` (was raw `curH/interval`). **`flMaintServiceReset` generalised to engine AND gearbox**: a closed service job resets baselines for its engine assets (engine hours) and/or gearbox assets (gearbox lifetime hours) · the retro "↻ รีเซ็ตรอบเซอร์วิส" button on DONE jobs now shows for gearbox service jobs too (`a.engId||a.gbId` + `เกียร์|gear` keywords). Verified: `node --check` (3 blocks, 0 err) + node sim (never-serviced=fresh not overdue · after service@5186 → 200h left). Backup: `BACKUP/allotment_v2_20260623_pre_gear_service.html`.

## 69. Van Assign — block assigning a van that can't seat the group's pax (2026-06-23)
User: "ถ้าจำนวนคนของกรุ๊ปเกินจำนวนที่นั่งในรถ ก็จัดรถลงไม่ได้". The group header already SHOWED over-cap in red (`over=cap&&gpax>cap`) but didn't block. Added a hard guard: new helper **`bkV2VanGroupPax(date,routeId,zone,gid)`** (split parts use `s.pax`, non-split use the matching trip's `bkV2PaxAllTot`). (1) **`bkV2VanGroupSetVan`** now checks `vehGet(vanId).capacity` vs group pax → if pax>cap, `alert` + re-render (reverts the dropdown), no assign. (2) Group-header van `<select>` options now **disable** any van where `gpax>v.capacity` (and shows "· N ที่นั่ง" + "· ที่นั่งไม่พอ"); the currently-selected van is never disabled (so a group that grew past cap still shows its van in red, prompting a split). (3) **`bkV2VanGroupSelected`** (adding ticked rows to an existing van-group) blocks + alerts when `existing + added pax > the group van's capacity` (prevents the inherit-on-add path from silently overfilling; user must make a new group / split / pick a bigger van). Verified: `node --check` (0 err) + guard sim (9→cap10 OK · 11→cap10 BLOCK · 11→cap14 OK). Backup: `BACKUP/allotment_v2_20260623_pre_van_capacity_block.html`.

## 70. Demand · FOC detail moved to ⑥ Agents tab + redesigned (2026-06-24)
Per user ("FOC detail ย้ายเป็นอีกคอลัมน์ ต่อจาก Agent · ปรับดีไซน์ใหม่ตามภาพ" — reference = clean Boat-Op matrix look). **Moved** the FOC-detail card OFF the ⑤ Sales tab (`mdTabSales` return no longer concatenates `focDetail`; the builder is left in place but unused) and **rebuilt it on the ⑥ Agents tab** (`mdTabAgents`) right after the All-agents table (`...</div>`+focDetailHtml). Self-contained IIFE re-aggregates `focAg` from `SB_BOOKINGS` (FOC pax by agent → travel date → program family · sale via `agent.sales`, reason via `focApproval.reason||focReason`, status chip) using mdTabAgents' own helpers (esc/isCancel/fK/pf/sName/SALES/A/FAM_ORDER/famHdr/famCol) + globals (sbGetAgent/bkV2PaxTot/bkV2RouteFamily). **Redesign**: added a KPI tile strip (dark-green hero **FOC pax** + Agent FOC / Staff FOC / Pending tiles · rounded soft cards matching the reference) above the table; table keeps the rowspan-merged Agent/Sale/Market/Total/Paying-cus/Sale-value layout with date rows × family columns, Agent/Staff section bands, soft family pills, amber Total-FOC pill, status chips; "Number cus" relabelled **"Paying cus"**. Pax/Sale value still EXCLUDE FOC (`paidPax=o.pax−r.fc`). Verified: `node --check` (3 blocks, 0 err) + grep (sales no longer has focDetail · agents return appends focDetailHtml · colspan 13 = 4+5 fam+4). Backup: `BACKUP/allotment_v2_20260624_pre_foc_move_redesign.html`.

## 71. FOC detail — liquid-glass (white) restyle (2026-06-25)
Applied the approved mockup to the real FOC-detail block in `mdTabAgents`. White frame (`#fafbfb`), **glass cards with glossy gradient-border edges** (two-background trick: `linear-gradient(#fff,#fff) padding-box, linear-gradient(140deg,…) border-box` + inset top highlight + soft drop shadow) — defined as `_GT` (white tiles + table card) and `_GH` (dark-green hero tile). KPI strip: green glossy hero (FOC pax) + 3 white glossy tiles (Agent/Staff/Pending · colored number + small color dot, no solid fill). **Font = Manrope** (added `;800` weight to the head Google-Fonts link · view wrapper sets `font-family:Manrope`), all numbers switched from `'DM Mono'` → `font-variant-numeric:tabular-nums`. Family/Total-FOC pills use rgba glass tints (`${col}1f`, amber `rgba(239,159,39,.2)`). Table sits inside a glass card (`overflow-x:auto;padding;${_GT}`). Verified `node --check` (3 blocks, 0 err) + grep (no DM Mono in block · glass + Manrope wrapper present). Backup: `BACKUP/allotment_v2_20260625_pre_foc_glass.html`.

## 72. By-trip-date — 3 cases (2026-06-25)
**Case 3 · Paste group list warns when names < specified pax** (`bkV2GroupPasteApply`): before, pasting fewer names than the trip's already-set pax silently shrank the head count to the pasted N. Now computes `_curTot=bkV2PaxAllTot(t.pax)`; if `_curTot>N` → `confirm`: OK = keep the specified count (fill only the N pasted names · rest blank), Cancel = resize to N (old behaviour). `_curTot<=N` unchanged (normal fast-entry).
**Case 2 · self-return drop-off (no return van needed)** (`bkV2RetInfo`): when a booking has a separate drop-off (`dropoffSame===false`) that is a **self-arrive / No-Transfer pier** (resolves `dropoffAreaId`/`dropoffArea` via `bkV2GetArea` → `zone==='NoTransfer'`, or name matches `self-arrive|กลับเอง`), set `selfRet=true` → `alert=false` (no "⚠ ยังไม่จัดรถกลับ"). Manifest Send-back cell shows a gray **"↩ ลูกค้ากลับเอง"** chip instead of the red alert. Recommended workflow for "customer returns on their own to a pier": set Drop-off = the `… (self-arrive)` pier → system won't ask for a return van.
**Case 1 · Longtail Charter >1 boat — DONE** (qty at booking): `d.addOns[]` already stored `{type,qty:1}`; added **`bkV2SetAddOnQty(type,n)`** + a **จำนวนลำ −/+ stepper** on the Longtail Charter add-on row (only when checked · `event.preventDefault/stopPropagation` so it doesn't toggle the checkbox label) · row price = `info.total × qty`. Wired qty through: **`bkV2CalcQuote`** (`+= info.total*(a.qty||1)`), **commit** (saves `qty` + `amount:info.total*q` + label ` × N ลำ` — previously dropped qty), **`bkV2AddOnFlags`** returns `charterQty` (sum of charter add-on qty), **prep counting** (§48530 `ltCharterBoats += _af.charterQty||1`) → the "Longtail เหมา · N ลำ" chip now reflects N boats. Verified node sim (qty2 → ฿9000 · 2 boats). Backup: `BACKUP/allotment_v2_20260625_pre_longtail_charter_qty.html`. Backup: `BACKUP/allotment_v2_20260625_post_bytrip_3cases.html`.

## 73. Return-leg & self-arrive transfer fixes (2026-06-25)
Set of fixes around "ขารับ/ขากลับ ไม่สมมาตร" (pickup and return handled by different parties) + a per-booking return-van bug. Backup: `BACKUP/allotment_v2_20260625_post_selfreturn_pickupself_vanreturn.html`.

**(a) Drop-off area dropdown shows ALL zones in New Booking.** `bkV2AreaDDOpts()` → **`bkV2AreaDDOpts(kind)`** (`bkV2AreaDDRender` passes `kind`). Pickup keeps the trip's pickup-zone filter (`_bkV2.newBooking.pickupZoneFilter`); **Drop-off (`kind==='dropoff'`) skips the filter → lists every zone** incl. the No-Transfer self-arrive piers (`nt-panwa-pier` / `nt-tublamu-pier`). Symptom fixed: an existing booking could have drop-off = "[No Transfer] Visit Panwa Pier (self-arrive)" but a NEW booking couldn't pick it (the shared dropdown was filtered to the PK pickup zone).

**(b) Van Job Order ② RETURN skips self-return bookings.** In `vanJobsOrderInner` `_collect(isRet)`: added `if(isRet && bkV2RetInfo(b).selfRet) return;` — a booking whose drop-off is a self-arrive pier (`bkV2RetInfo().selfRet`, §72) means the customer goes back on their own → no return van → it no longer appears in the ② ขากลับ section (and the "ขากลับ N คน" header count drops accordingly).

**(c) `bk.pickupSelf` — "ขารับ ลูกค้ามาเอง (self-arrive)" keeping rate PK.** The reverse case: pickup self-arrange, return by company, **charge full PK rate**. New booking-level flag `pickupSelf` (default `false`) + a purple checkbox **"🚶 ขารับ: ลูกค้ามาเองที่ท่าเรือ (self-arrive · เก็บเรทเต็ม)"** above the "Drop-off same as pickup" toggle → `bkV2TogglePickupSelf()` (re-renders). **Rate/zone unchanged** (flag is independent of pickup zone, so PK rate stands). Persisted in `bkV2CommitBooking` (`pickupSelf:!!d.pickupSelf`). Effects: `_collect(isRet)` adds `if(!isRet && b.pickupSelf) return;` (drops it from ① OUTBOUND — no pickup van); `renderVanJobs` agg loop gains `const _selfPick=!!b.pickupSelf;` wrapping the outbound `addVan`/`_addUn` in `if(!_selfPick){…}` (so it's NOT counted as "ยังไม่จัดรถ") while the return `aggRet` still fires (return van assignable normally). So: ขารับมาเอง+ขากลับส่ง → tick "ขารับมาเอง"; ขารับส่ง+ขากลับเอง → set Drop-off = a (self-arrive) pier.

**(d) Return-van dropdown pool broadened (cross-van return).** The "↩ รถกลับ" dropdowns were sourced from `vanVehiclesForRoute(date,routeId,zone)` = ONLY vans assigned to that route in the month matrix (§19.2, correct for OUTBOUND). For Whale Shark (few vans on the route) there was no OTHER van to pick → "กลับกับรถคันอื่นไม่ได้". Fixed: the **return** pool = route vans **+ all active vans in the same zone that day** (`vanVehiclesForZone(zone,date)`, route vans first). Applied in BOTH the per-row select (`bkV2VanCellHTML` — `pool` is return-only there) and the group-header (added a separate `_retPool` for `ropts` only; the OUTBOUND `opts` stays matrix-route-only). NoTransfer returns nothing (unchanged).

**(e) `bkV2VanGroupHeal` — return van is now PER-BOOKING (the "เปลี่ยน 1 → เปลี่ยนหมด" bug).** §60's heal (runs every render in van mode) collected the group's first non-empty `vanReturnId` and **filled it into every group member that was empty** → setting ONE booking's return van spread it to the whole group. Fix: heal now reconciles **`vanId` only** (the outbound-van "ตกบุคกิ้ง" safety net); the `e.ret`/`vanReturnId` propagation was removed. `vanReturnId` empty = "กลับคันเดิม" (returns on its own outbound van) — the correct per-booking default. Group-level set-all still available via the header `bkV2VanGroupSetReturn`. ⚠ Existing data where the old heal already spread one van across a group must be reset per-row once (won't re-spread now). Verified node sim: A=veh08 set → B/C/D stay empty (กลับคันเดิม), D's missing vanId still heals to the group van.

All verified: `node --check` (3 blocks, 0 err) + node sims (drop-off all-zones, `_collect` self-return/self-pickup skip on real backup data — Jaminah BK-26060455 drop-off "Phuket Town/pk-town" zone PK → selfRet=false → correctly STILL in veh08 cross-van return, proving §57 cross-van display was never broken; heal per-booking sim).

## 74. Daily PFM — Finexy redesign (2026-06-26)
`renderDailyPFM()` re-skinned to the approved Finexy mockup (green/lime fintech look) — **HTML/CSS only, all data logic untouched** (`pfmBookingsFor`/`pfmIssueInvoice`/`pfmRecordPayment`/`pfmApproveTravel`/`pfmHold` unchanged; same `totAmt`/`paidAmt`/`unpaidAmt`/`nUnpaid`/`nAlert`/`nApproved` tallies). Changes: (1) header = lime-on-green rounded icon chip + title + date stepper pill; (2) KPI row = a **deep-green hero card** `#163d2b` "Unpaid balance" (big &#3647; + "N of M ยังไม่ชำระ" + lime cutoff bar) `grid-row:span 2`, beside four rounded 16px white KPI cards (PFM bookings / Total value / Past-cutoff unpaid (red) / Approved to travel (green)); (3) new **Collected-today progress bar** = `paidAmt/totAmt` (`collPct`, green `#7ec24a` fill); (4) table restyled — checkbox column added (visual), uppercase muted `th` on `#fafbf9`, status as **colored dot + label** (was pill), action buttons → Finexy green `#163d2b` (`_gbtn`) / white outline (`_obtn`), `colspan` 9→10. Icons = inline SVG (`_ic`/`_P` — **no Tabler webfont in app**, per §24). Verified: node --check on the extracted section = SYNTAX OK. Backup: `BACKUP/allotment_v2_20260626_pre_pfm_finexy.html`.

**§74 follow-up (same day · "เหมือนเป๊ะ"):** upgraded to a full Finexy match — (a) hero card now a **green diagonal gradient** `linear-gradient(150deg,#2f8b4e,#1d5e36,#123c25)` with two mini-stat tiles (Collected ฿ / Approved); (b) **3-column top row** (gradient hero · 2×2 white KPI grid · chart card) on a `#f3f5f3` page bg with soft `box-shadow` cards (no borders) + 18px radius; (c) KPI cards = icon in an **outline circle** top-right + bold sans number; (d) new **"Collection · last 8 operation days" stacked bar chart** (Collected lime `#b6e84f` over Unpaid dark `#1d2b22`, Profit-and-Loss style) — inline SVG built in-fn from `pfmBookingsFor(ds)` looped over the 8 days ending at `_pfmDate` (`acctBookingInvoice`/`acctBookingTotal`/`acctInvoiceBalance` for paid/total); y-grid 0/½/max via `fmtK`, current day's x-label bolded; (e) table header restyled to Recent-Activities look (title + Search/Filter chips). Still HTML/CSS only — no PFM logic touched. node --check on the section = SYNTAX OK.

**§74 layout (2-row Finexy · same day):** restructured to match the reference exactly — **Row 1 = 3 columns** (gradient hero · 2×2 KPI grid · Collection chart card); **Row 2 = 2 columns** `grid-template-columns:0.82fr 1.9fr` — LEFT col (narrow) stacks the **Collection-progress** card + a new **Status-breakdown** card (Paid/Awaiting/Unpaid-past-cutoff/No-invoice/Approved/On-hold counts via `brow()` helper · counts recomputed in a cheap `list.forEach` before host render), RIGHT col (wide) = the Bookings table (wrapped in `overflow-x:auto`, `min-width:660px`). Still HTML/CSS only. node --check OK.

**§74 Finexy exact-match (v2 · same day · "ดูสี/การวางของแต่ละ card"):** re-mapped to mirror the reference 1:1. Row 1 = **white "Total PFM value" summary card** (big ฿total + ▲collected% + functional **Issue all** `pfmIssueAll()` lime-gradient pill + **Remind** `pfmRemindAll()` outline pill + 3 breakdown tiles Paid/Unpaid/Approved) · **2×2 KPI with the GREEN gradient card moved INTO the top-left cell** (Unpaid) + 3 white KPIs (Collected/Past-cutoff/PFM bookings) each with ▲/▼ trend line · **Collection chart**. Page bg lightened `#f3f5f3`→`#f6f7f5`; header icon-chip dropped (plain heading like ref). Chart bars now **lime `url(#pfmhl)` diagonal-hatch** (Profit/Loss look) over `#16241c` unpaid. New fns `pfmIssueAll` (issues PFM invoice via `acctCreateInvoice` for every bk with no invoice · confirm) + `pfmRemindAll` (logs `ops.pfm.remindedAt` + Notify history on unpaid bks). Still no change to per-booking pfm logic. node --check OK. Backup: `BACKUP/allotment_v2_20260626_pre_pfm_finexy_v2.html`.

**§74 period toggle + full booking list (same day):** added a **Year/Month/Week/Daily segmented toggle** (`_pfmMode` state · `pfmSetMode` · in the header next to the date stepper) that scopes the WHOLE page. New helpers `pfmPeriodRange(date,mode)` (day/week/month/year range of the anchor), `pfmBookingsForPeriod(date,mode)` (all proforma bookings with a trip in range, **sorted newest-first** by latest in-range trip date then bookingDate desc), `pfmChartBuckets(date,mode)` (8 days / 8 weeks / 8 months / 5 years · one booking→one bucket by earliest trip, fixes the old per-day double-count). `pfmSetDate` now steps by the active unit. renderDailyPFM uses `mode/range/list`; KPI tallies + chart + table all reflect the period; **per-booking cutoff/alert** (`now>pfmCutoff(booking's in-range trip)`) replaces the single-day `pastCutoff` so alerts work in any mode. Bookings card header shows count + (daily: cutoff line · else: range + "latest first"). `pfmIssueAll`/`pfmRemindAll` act on the period list. node --check OK.

**§74 default Month + per-day booking cards (same day):** `_pfmMode` default changed `daily`→**`month`**. Bookings list re-rendered as **one CARD per travel date** (newest date first): the row map now pushes each `<tr>` into `_byDate[date]` (+`_dateOrder`) instead of a flat join; `dayCardsHtml` renders a rounded card per date with a tinted header strip (weekday+date · N bookings · ฿total · paid/due · "⚠ N เลย cutoff" badge) over that day's table. Replaces the single Bookings table card. node --check OK.

**§74 working Search + Filter (same day):** the Bookings Search/Filter chips were decorative — now functional. New `_pfmSearch`/`_pfmFilter` state + global `pfmFilterRows()` that **live-filters the day-cards' rows without re-render** (keeps input focus): hides `tr[data-pfmrow]` whose text doesn't match the search (voucher/agent/route/sales · `data-pfmrow` lowercased) or whose `data-pfmst` status key (paid/awaiting/alert/noinv/approved/hold) doesn't match the filter `<select>`, and hides any day card (`[data-pfmcard]`) left with 0 visible rows. Search = real `<input id=pfm-search oninput>`, Filter = `<select id=pfm-filter onchange>` (All/Paid/Awaiting/Unpaid-past-cutoff/No-invoice/Approved/On-hold). renderDailyPFM re-applies the active filter to the fresh DOM at the end. node --check OK.

**§74 By-trip-date Pay chip reflects PFM steps (same day):** per user "จัดการที่ Daily PFM · By trip date อัปเดตสถานะตามขั้นตอน PFM". `bkV2PayChip` (By-trip-date manifest Pay column) now has a PFM branch for proforma agents / bookings with `ops.pfm`: shows the same step state as Daily PFM — **On hold** (red · `ops.pfm.decision==='hold'`) · **Extended** (green · `==='approved'`) · **Paid** · **⚠ เลย cutoff** (red · unpaid & past `pfmCutoff(earliest trip date)`) · **Awaiting** (invoice issued, unpaid) · **Pro Forma** (no invoice yet). Non-proforma path unchanged. Clicking still opens `bkV2RowPayAction` (issue/record); Extend/Hold are managed on Daily PFM. Single engine (`acctCreateInvoice`/`acctRecordPayment`) keeps both pages in sync. The Pro Forma document itself is `acctInvoiceDocHtml`/`acctOpenDoc` (title auto = "Pro Forma" when payType=proforma) — unchanged. node --check OK. Backup: `BACKUP/allotment_v2_20260626_pre_paychip_pfm_status.html`.

## 75. Pro Forma / Invoice document — full template redesign (2026-06-26)
`acctInvoiceDocHtml(inv)` rebuilt to match the company's real Pro Forma layout (the attached sample) — replaces the old minimal "Bill to + lines + totals" doc. Now renders: **(Original)** tag + logo (`LOVE_LOGO_B64`) + big periwinkle title **"Pro Forma-Invoice"** (`Invoice` when not proforma) · **Seller** block (hardcoded company: เลิฟ ไอแลนด์ · tax 0825554000447 · tel/email) + contact-icon column + shaded **Doc box** (Doc No=inv.number · Issue/Accept/Due dates dd/mm/yyyy · Ref) · **Customer** block (from `agent.companyInfo` legalName/address/taxId · Dear) + **Contact Person** (Reservation LoveAndaman) · **line table with Quantity · Price · Discount · VAT% · Pre-VAT** columns (qty=pax, price=base/qty, Pre-VAT=net via `linePre()` honoring `vatMode` include/exclude) · **Summary** (VAT 7% Amount=netAmount · VAT Amount · Total in **English words** via new `_acctBahtText()`) + shaded Total box + WHT/Payment Amount · **Payment** (KBANK bank constants) · **Remark** · **Certified** footer = faux-QR (`_acctFauxQR()` deterministic SVG, no lib) + Created by / Stamp (logo) / Received by (dashed sig). No longer uses `_acctDocShell` (self-contained). `acctReceiptDocHtml` + `acctOpenDoc` (open/print) unchanged → opens via "ดูเอกสาร" / By-trip-date / Daily PFM. Two new module helpers `_acctBahtText` + `_acctFauxQR` added before the fn. node --check OK. Backup: `BACKUP/allotment_v2_20260626_pre_proforma_doc_redesign.html`.

**§75 follow-up (same day):** removed the faux-QR from the Certified footer (now 3 columns: Created by · Stamp · Received by) and switched the doc logo (header + Stamp) from `LOVE_LOGO_B64` to the real file **`assets/logo.png`**. `_acctFauxQR` left defined but unused. node --check OK.

**§75 layout balance (same day):** rebalanced `acctInvoiceDocHtml` proportions — Seller & Customer rows now a clean **2-column grid** (left party info `flex:1`, right box `width:236px;flex:none`) so the Doc box and Contact Person align in one right column; the seller phone/email moved **inline under the Seller block** (dropped the separate middle icon column + the empty web row). Items table wrapped in a **`min-height:190px`** area so short invoices don't leave an awkward floating gap before Summary (replaced the `margin-top:46px` hack with `18px`). Even section spacing. node --check OK. Backup: `BACKUP/allotment_v2_20260626_pre_invoice_balance.html`.

## 76. Project — allow non-vessel (General) projects (2026-06-26)
Projects previously **required a boat** (`flProjSaveModal` hard-blocked `if(!boatId)`). Added a **General · non-vessel** option so staff can create projects unrelated to a boat (office/marketing/systems/etc). Changes in `allotment_v2.html`: (1) New-Project modal boat `<select>` (`flProjOpenModal`) now seeds `<option value="">— Select boat —</option><option value="__none__">⚙ General · ไม่เกี่ยวกับเรือ</option>` + boats; label "Boat *" → "Boat (or General)"; subtitle mentions General; type `<select>` gained `<option value="general">📋 General · งานทั่วไป</option>`. (2) `flProjSaveModal` reads `boatSelVal`; `boatId = (boatSelVal==='__none__')?null:boatSelVal`; validation now requires a *choice* (`if(!boatSelVal)`) not a boat; project id = `proj_${yr}_${boatId||'gen'}_${seq}`. (3) Edit path preselects `p.boatId||'__none__'`. (4) Display: `flProjBoatName(p)` + detail `boatName` + header type-label return **"General · ไม่เกี่ยวกับเรือ" / "General"** when `!p.boatId`. (5) Dashboard `projActiveBoats` filters out null boatIds so a General project isn't counted as a boat. General projects (boatId null) naturally don't appear on any boat's detail page. node --check OK (flProjBoatName/flProjOpenModal/flProjSaveModal/flRenderProjects regions). Backup: `BACKUP/allotment_v2_20260626_pre_general_project.html`.

**§76 Gantt symbol for General projects (same day):** the Gantt boat-row for a non-vessel project (boatId null → grouped under key "null", no boat found) showed a gray **"?"** avatar + name "?". `flProjRenderGantt` now detects `isGen=!boat` → renders the **clipboard icon** (`flProjIcon('clipboard')`, matches the 📋 used for Type "General") in a slate `#64748B` circle, name **"General"**, meta `N project(s) · ไม่เกี่ยวกับเรือ`. Header counts split: "N boats · M general" + the left "Boat" badge counts real boats only (excludes general groups). List/Timeline already showed "General · ไม่เกี่ยวกับเรือ" via `flProjBoatName`. node --check OK.

**§76 General row shows Vendor/Location (same day):** the Gantt General row subtitle now displays the project's **Vendor / Location** text instead of the static "ไม่เกี่ยวกับเรือ" — `_genVends` = distinct non-empty `p.vendor` across the general group; meta = `N project(s) · <vendor(s) joined by ·>`, falling back to "· ไม่เกี่ยวกับเรือ" when no vendor entered. Truncates via existing ellipsis. node --check OK.

## 77. Booking — Restore (un-cancel) a wrongly-cancelled booking (2026-06-26)
Cancelling a booking (`bkV2CancelBooking`) only sets `status='cancelled'` (data kept) but there was **no in-UI undo** — a mis-cancel could only be fixed via console. Added **`bkV2RestoreBooking(bookingId)`**: confirms, reverts `status='confirmed'`, deletes `cancellation`/`cancelCategory`/`cancelReason`/`cancelledAt`/`weatherResolve`, **voids any cancellation-fee invoice** (`SB_INVOICES` where `feeType==='cancellation'` & contains the booking, via `acctVoidInvoice`), and **re-locks the charter boat** in `TRIPS` for each charter trip whose boat/day slot is still free (skips + warns for days now taken by another booking · `blocked` count). Writes history (`Restored · ยกเลิกการยกเลิก`), `acctPersistBookings()` + persists `trips`. ⚠ The booking's ORIGINAL invoice stays voided (can't un-void) — alert tells the user to re-issue via the Pay action. Two entry points: (1) **Voucher detail topbar** — green "↻ กู้คืน (Restore)" button shown when `['cancelled','cancelled_weather','rejected'].includes(bk.status)`; (2) **By-trip-date manifest cancelled block** (`cxlBlock`) — green "↻ กู้คืน" button next to View on each cancelled row. node --check OK (bkV2RestoreBooking + bkV2RenderTab2 + bkV2RenderBookingDetail). Backup: `BACKUP/allotment_v2_20260626_pre_restore_booking.html`.

## 78. By-trip-date — day-level "not fully arranged" warning bar (2026-06-26)
Per user "เตือนถ้าวันนั้นจัดเรือ/จัดรถไม่ครบ ตรงจุดที่เห็นง่ายที่สุด". Added a prominent red warning bar in the **By-trip-date day header** (`bkV2RenderTab2`, after the lock bar inside `.t2-hd`). Computed over `SB_BOOKINGS` for the active `date` (non-cancelled): **`_unBoatN/_unBoatPax`** = bookings with no boat (`!(ops.boatId) && !trip.charterBoatId`); **`_unVanN/_unVanPax`** = bookings needing transfer (`!pickupSelf && zone∉{NoTransfer,NT}`) with no van (`!ops.vanId` and not all `vanSplits` have a van). Bar (`.t2-hd-warn`) shows only when there's a gap; two clickable red chips: "🚤 ยังไม่จัดเรือ N · X pax" → `if(!_bkV2.boatAssignMode)bkV2ToggleBoatMode()`, "🚐 ยังไม่จัดรถ M · Y pax" → `if(!_bkV2.vanAssignMode)bkV2ToggleVanMode()`. Days fully arranged show no bar (no clutter). CSS added near `.t2-hd-lockbar`. node --check OK (bkV2RenderTab2 48605..). Backup: `BACKUP/allotment_v2_20260626_pre_unassigned_daywarn.html`.

**§78 follow-up (same day):** (a) the day warning bar now **breaks down per route** — `_unBoatR`/`_unVanR` accumulate unassigned PAX by `dts[0].routeId`; two sub-lines render under the chips: "🚤 เรือ: <route> N · …" and "🚐 รถ: <route> N · …" (route name via `bkV2RouteShort`/`getRoute`, sorted desc, `.t2-hd-warnrt` full-width). (b) the manifest **"↩ กลับคันเดิม" return button now requires Van mode** — both `bkV2SetReturnSameVan` onclicks gated with `if(!_bkV2.vanAssignMode){bkV2ToggleVanMode();return;}` so the first click in the normal manifest just **enters Van Assign mode** (button shows amber "↩ กลับคันเดิม (เปิด Van)" + hint title when not in van mode); once in Van mode it performs the actual same-van toggle. node --check OK.

**§78 compact warning (same day · per user "สั้น กระชับ ไม่กินพื้นที่"):** the day warning bar slimmed to a single inline line — `display:inline-flex` (no full-width stretch), smaller padding/font. Per-route breakdown sub-lines (`.t2-hd-warnrt`) removed from the layout; the route detail now lives in each chip's **tooltip** (`title`, plain-text `_unBrkTxt`). Chips shortened to "🚤 เรือ N" / "🚐 รถ M" (N/M = booking count); hover shows "ยังไม่จัด… N booking · X pax — <route N · …> · คลิกเข้าโหมด…". node --check OK.

**§78 trip names on the bar (same day · "ต้องเขียนบอกทริปด้วย"):** the compact warning chips now **write the trip name inline** — `_unBoatR`/`_unVanR` keyed by program-family name (`bkV2RouteFamily(id).name`, fallback short/route name) accumulating unassigned pax; chip = "🚤 เรือ · <Trip> N · <Trip> N" / "🚐 รถ · …" (N = pax still unassigned per trip, `_brkHtml`). Still one inline line (wraps only if many trips); pax total + click-hint stay in the tooltip. node --check OK.

## 84. Document Check — Pre-Check (OCR auto-compare) (2026-07-03)
The Doc Check drawer (`_docCheckDrawer`) now runs an **automatic OCR Pre-Check**: reads the attached image with **Tesseract.js** (lazy-loaded from jsdelivr `tesseract.js@5`, one shared `eng` worker) then fuzzy-matches each of the 6 checklist fields (`DOCCHK_ITEMS` route/date/lead/pax/voucher/payment) against the system booking, **auto-ticks high-confidence matches**, and shows evidence — user still does the final ✅/⚠. Attachments are images/PDF stored server-side (`/api/attach/<id>`, no text) so OCR is required; **images only** (PDF → "ตรวจมือ").
- **Engine** (`docCheckRunPre(bkId)`): OCRs every image attachment (sequential, reused worker), stores result on **`bk.docCheck.pre = {at, lang:'eng', autoTick, results:{k:{s,ev,detail}}, summary:{match,maybe,mismatch,none}, text}`** (cached · never re-OCRs on reopen). Loader `_docOcrEnsureLib` + `_docOcrGetWorker` (`window._docOcrWorker/_docOcrWorkerP/_docOcrLibP`), progress via worker logger → `_docPre.prog` + throttled re-render (`_docPreThrottleRender`, 380ms). Auto-triggered once on drawer open when a booking has image attachments & no cached pre (setTimeout 120ms; `_docPre.running[id]` guards re-entry). Manual "⚡ Pre-Check" button + "🔄 ตรวจใหม่" re-run + "ลองใหม่" on error.
- **Matcher** `_docPreCheckMatch(b, ocrText)` → per-field `{s:'match'|'maybe'|'mismatch'|'none', ev, detail}`: voucher = alnum-normalized substring (full → match, last-8 tail → maybe); date = generate candidates per trip date (ISO · "4 july 2026" · "july 4" · dd/mm/yyyy · mm/dd/yyyy · …) substring on normalized OCR; lead = token-based (all name tokens present → match, some → maybe · order-independent); pax = parse doc "N adults/children/infants" (sum) or "N pax/persons/คน/ท่าน" → compare to the trip's `bkV2PaxAllTot` (equal → match, differ → **mismatch** with detail); route = keyword score (route-name words minus stopwords, matched against normalized + de-spaced OCR so "speed boat"→"speedboat"; ≥0.5 → match, >0 → maybe); payment = agent payType keywords (invoice/credit · proforma · cash-on-tour). 
- **UI**: `preBar` (progress spinner `@keyframes docspin` / summary "ตรง N · อาจตรง N · ไม่ตรง N · ไม่พบ N" / run button) above the checklist; each checklist row shows a colored **status chip** (green ตรง / amber อาจตรง / red ไม่ตรง / gray ไม่พบ) + **evidence snippet** ("...doc quote..." or "เอกสาร X · ระบบ Y"). Mismatch rows framed red. Auto-tick only sets matched items `true` (never unticks manual ticks) and **only when `laCanEditArea('operations')`** (view-only users get suggestions, no write/persist).
- Needs network at runtime for the OCR lib/lang (fine on Railway; localhost offline → graceful error). English-only OCR (agent vouchers are ~English/numeric); tha/kor can be added later. Verified: extracted app script `node --check` OK + node matcher unit test on the real Hanatour example (voucher/date/lead/pax/route all match; pax mismatch case flagged doc4 vs sys5). Backup: `BACKUP/allotment_v2_20260703_pre_doccheck_precheck_ocr.html`.

**§84 follow-up · scroll-keep on refresh (2026-07-03):** reading the Doc Check drawer then a re-render (cloud soft-refresh, filter, tick, OCR-done) bounced the page/drawer to the top. Fixes: (1) **`renderDocCheck` now preserves scroll** — captures `main`/window scroll + the two drawer panels' `scrollTop` (new ids **`dc-panel-left`** / **`dc-panel-docs`**) before `host.innerHTML`, restores after (sync + rAF via `_restoreScroll`). Same pattern as §30/§41 scroll-jump fixes. (2) **OCR progress is now surgical** — `preBar` factored into self-contained **`_docPreBarHTML(b,bkId)`** wrapped in `<div id="dc-prebar">`; `_docPreThrottleRender` updates ONLY that element during OCR (no full re-render → no document-image reflow → scroll stays put). (3) **auto-refresh treats the open drawer as busy** — `_laBusy()` gains `if(document.getElementById('dc-panel-docs')) return true;` so the cloud soft-refresh defers while a detail is open (the "🔄 มีข้อมูลใหม่ · โหลดเลย" banner still lets the user pull manually; it catches up on close/idle). `node --check` OK + matcher unit test still passes. Backup: `BACKUP/allotment_v2_20260703_pre_doccheck_scrollkeep.html`.

## 85. Seat Locks — parent + sub-group locks (Option A · 2026-07-03)
Wholesaler scenario: "Club Wyndham locks 20 · with sub-groups A=2, B=5, C=3 under it." Model chosen = **parent + real child locks** (each sub-group is a full lock, managed separately), day-scope. A/B/C are **free-text sub-group names** under one holder (not separate agents); **staff pick the sub-group at booking time**.
- **Data:** a child lock = a normal `SB_SEAT_LOCKS` entry with `parentId` + `subName` (e.g. 'A'), copying the parent's `scope/routeId/date/holderType/holderId`, own `qty/used/expiry/status/log`. Parent `qty` (20) is the umbrella cap; `Σ children.qty ≤ parent.qty`; unallocated = parent.qty − Σ children.qty.
- **Helpers (near `bkV2LockRemaining`):** `bkV2LockChildren(id)` · `bkV2LockAllocated(p)` · `bkV2LockUnalloc(p)` · `bkV2LockUsedTotal(l)` (parent.used + Σ children.used) · `bkV2LockHeldRemaining(l)` (qty − usedTotal) · `bkV2LockUnallocDrawable(p)` (unalloc − parent.used) · `bkV2LockDrawable(l)` (child→rem · parent→unallocDrawable) · **`bkV2LockPoolHold(l)`** = the sellable-pool reduction, counted at the **parent/standalone level ONLY** (child → 0 · avoids double-count).
- **Pool math (no double count):** `bkV2LockedTotal` / `bkV2DayLockedExact` / `bkV2DayLockedTotal` now sum `bkV2LockPoolHold` (children contribute 0; parent held = qty − usedTotal). So the whole 20 reduces the pool regardless of internal split; a sub-draw moves held→booked (held drops, consumed rises, net available unchanged — same balance as flat locks).
- **Draw cap:** `bkV2DrawLock` caps by `bkV2LockDrawable` — a parent can only draw its **unallocated** remainder (can't eat seats sitting in sub-groups). `bkV2ReleaseLock`: child release returns seats to the PARENT (still held off pool · 20 stays); parent release returns unallocated seats to the PUBLIC pool; parent qty floored at `max(used, allocatedToChildren)`.
- **Seat Locks tab:** `bkV2RenderLocks` — top-level locks only; a parent shows an `UMBRELLA · N ย่อย` tag, `usedTotal/qty · heldRem left`, an allocation line (`แบ่งย่อย X · ยังไม่จัด Y`), a **+ กรุ๊ปย่อย** button (only when unalloc>0 → `bkV2SubOpen` modal `_bkV2SubModal` → `bkV2CreateSubLock` with cap validation), Release (parent = unallocated only). Child rows render indented (↳ subName) with their own Release. KPI + per-holder breakdown skip children for qty/count (add children's `used` to the holder).
- **Booking draw (staff picks sub):** `bkV2DrawSources(route,date,agent)` expands each parent into its sub-groups (A/B/C, remaining>0) + a `· ยังไม่จัด` parent-unalloc source; standalone locks appear directly. New Booking seat-lock banner renders **one stepper per source** (`bkV2SetTripLockDraw(idx,lockId,qty)` → `t.lockDrawSel={lockId:qty}` · total capped at pax). Commit draws exactly the picked sources (`bkV2DrawLock` per lockId); fallback to priority-draw of `seatSource.locked` when nothing explicitly picked (legacy bookings). `t.lockUse` kept synced (= Σ lockDrawSel) so the anti-overbook guard + seatSource still work. `lockDrawSel` saved on the trip + seeded in the new-trip template + charter → `{}`.
- **`bkV2LocksForAgent` excludes children** (`!l.parentId`) so the draw UI handles parents via `bkV2DrawSources`. Verified: extracted app-block `node --check` OK + node unit tests (18 assertions: sub-create + cap block, pool-hold no-double-count = 20, 4 draw sources, parent draw capped at unalloc, standalone unaffected; + 8 release assertions: child-release→parent, parent-release→pool, floored at allocation). Backup: `BACKUP/allotment_v2_20260703_pre_sublock_parentchild.html`.

**§85 follow-up · manage locks from By-trip-date (2026-07-03):** seat locks (incl. sub-groups) can now be created/split/released **inline on the By-trip-date manifest** — no need to switch to the Seat Locks tab. (1) The release + sub-group modals were extracted from `bkV2RenderLocks` into a shared **`bkV2LockOverlays()`** rendered GLOBALLY by `bkV2Render` (`…${bkV2RenderLockModal()}${bkV2LockOverlays()}`), so `bkV2SubOpen`/`bkV2LockReleaseConfirm`/the create modal work from any tab. (2) The per-trip **`lockBar`** in `bkV2RenderTab2` was rebuilt: counts parents only via `bkV2LockPoolHold` (fixes the old double-count with children), renders each parent chip with `N ย่อย` + indented sub-chips (each with a `×` quick-release) + **"+ ย่อย"** (`bkV2SubOpen`, shown when unalloc>0) + **"ปล่อย"** (`bkV2LockReleaseConfirm`), and the bar now ALWAYS shows (even with 0 locks) with a green **"🔒 ล็อคที่นั่ง"** create button (`bkV2LockFromCalendar(rid,date)` → the inline create modal) + **"ทั้งหมด →"** (jump to the Seat Locks tab). `node --check` OK. No backup (UI-only refactor · covered by `pre_sublock_parentchild`).

## 86. Seat Locks — month locks use a rolling per-trip release (fixes the "long-term lock disappeared" bug) (2026-07-03)
Root cause of RSVN02's vanished long-term hold: the OLD `bkV2LockExpireSweep` expired a lock whenever `l.expiry < today` **regardless of the month range** — and the create form (`bkV2LockCreateSubmit`) reset only `qty`/`reason`, so a **stale `expiry`** from a prior day-lock carried onto a new month lock → the sweep silently flipped the whole month range to `expired`.
- **New model (per user):** a month lock's seats for a SPECIFIC trip date auto-release at **HH:MM · N days before that travel date** (rolling cutoff), so seats free up per-departure while the lock stays active for later dates — no single global expiry. Fields on the lock: **`releaseDaysBefore`** (int · default 1) + **`releaseTime`** (HH:MM · default 18:00).
- **Helpers:** `bkV2LockReleaseCutoff(l, tripDate)` → the cutoff `Date` (or null if no rule) = `(tripDate − releaseDaysBefore days)` at `releaseTime`; `bkV2LockReleasedForDate(l, tripDate)` = `Date.now() >= cutoff`; `bkV2LockCutoffLabel(l)` → "ปล่อย N วันก่อน HH:MM". `bkV2LocksFor` + `bkV2DayLockedExact/Total` now skip a lock for a date once `bkV2LockReleasedForDate` is true (seats return to that trip's pool; lock unchanged for other dates).
- **Sweep rewritten:** month locks now expire ONLY when the whole range has passed (`ymNow > monthTo`); day locks keep the `expiry` behavior. Plus a **heal**: any month lock stuck `status:'expired'` while `ymNow <= monthTo` is reactivated on load (recovers RSVN02's + any similarly-killed long-term hold · a manually released lock is `'released'`, not `'expired'`, so it's untouched).
- **Form:** month scope now shows "ปล่อยคืน [N] วันก่อนเดินทาง เวลา [HH:MM]" instead of the raw Expiry date (day scope keeps Expiry). `bkV2CreateLock` stores the fields; month locks are created with `expiry:''`. `bkV2LockCreateSubmit` now also resets `expiry` after every create (kills the stale-carry). `bkV2CreateSubLock` inherits the parent's `releaseDaysBefore`/`releaseTime`. Cutoff label shown in the Seat Locks tab row + the By-trip-date lock chip (green pill).
- Verified: extracted app-block `node --check` OK + node unit tests (11 assertions: far trip holds / imminent trip auto-released / pool 10→0 across the cutoff / lock stays active / heal reactivates in-range expired month lock / ended-range expires / day-lock hard-expiry unchanged / no-rule never releases). Backup: `BACKUP/allotment_v2_20260703_pre_rolling_release.html`.

**§86 follow-up · lock manage popup (2026-07-03):** in the By-trip-date lock bar, the inline "+ ย่อย" / "ปล่อย" buttons (and the sub-chip × quick-release) were replaced by a **click-the-name → popup**. The lock chip is now a button (`.t2-lockchip-btn` · ▾ affordance · `onclick=bkV2LockManageOpen(id)`); the popup (`_bkV2LockManageId`, rendered in `bkV2LockOverlays`) shows Held/Used/Total, allocation (แบ่งย่อย/ยังไม่จัด), cutoff label, the sub-group list (each with its own ปล่อย), and action buttons **+ เพิ่มกรุ๊ปย่อย** (`bkV2SubOpen`) / **ปล่อย (ยังไม่จัด)** (`bkV2LockReleaseConfirm`) / **ดูทั้งหมด →** (Seat Locks tab). The sub-group + release modals still stack above it (z 9999 > 9998) and return to the popup on close. `node --check` OK.

## 87. Booking — don't-forget-to-use-lock reminders (2026-07-03)
Users kept booking from the general pool while the agent had seat locks held (locks never converted, pool double-consumed). Two nudges, no hard block:
- **Loud banner the moment pax is entered** — in the New Booking trip card, the seat-lock draw banner (`bkV2RenderNewBooking` ~§Seat-lock draw banner) now flips to an **amber ⚠ alert** (`undrawn = pax>0 && drawnTot===0`): "อย่าลืมใช้ seat lock · มี N ที่ว่าง" + a one-click **"⚡ ใช้ lock ก่อน (ดึง min(rem,pax))"** button → `bkV2AutoDrawLocks(idx)` fills `t.lockDrawSel` from `bkV2DrawSources` up to pax (children first, then parent-unalloc). The per-source steppers stay below for manual sub-pick. Once anything is drawn it reverts to the calm blue confirmation state.
- **Save-time confirm safety-net** — `bkV2CommitBooking` (right after the existing "Draw N locked seats?" confirm): for each seat trip with pax>0 that drew 0 from locks while `bkV2DrawSources` still has remaining>0, collect the trip; if any, one `confirm('⚠ เอเจนต์นี้มี seat lock ที่ยังไม่ได้ใช้: … จะจองจาก pool ทั่วไปโดยไม่ใช้ lock ใช่ไหม?')` — Cancel aborts the save so staff can go back and draw. Soft (can proceed) since sometimes not using the lock is legitimate.
- `node --check` OK. No new data fields (reuses `t.lockDrawSel`). Covered by the seat-lock backups.

**§By-trip-date tweak (2026-07-03):** the "↩ Moved from MM-DD · weather" reschedule badge was moved out of the lead-name cell into the **Special request** column as its own line (`_movedBadge` const · shown in both normal + van modes · empty-state check updated). `node --check` OK.
