# LOVE Andaman — Operations Pipeline (Pre-Op → Operation Day) · DESIGN DOC

> Status: **DESIGN / not built** · drafted 2026-06-10 from RM's walkthrough.
> Scope: everything that happens **after** bookings are entered, up to the boat leaving + final summary.
> This is the master plan — build order + open decisions are at the bottom.

---

## 0. Where this sits

```
Bookings entered (DONE) ─► PRE-OPERATION DAY ─► OPERATION DAY ─► Traveling Summary (FREEZE)
                            │ Daily PFM track    │ Van Check-in
                            │ Boat Assign        │ Pier Check-in + wristband + Job Order
                            │ Van Assign + JobOrd │ boat leaves
                            │ Re-Confirmation     │
```

Reuses what already exists: `SB_BOOKINGS` · pickup areas/time profiles (§18) · accounting invoices/payments · pay types (invoice/**proforma**/cot) · cancellation + no-show + partial-cancel + reschedule · seat locks · weather resolution (§16.1) · Boat Op (`TRIPS[date]`, boat assignment).

A booking grows an **operational sub-state** as it moves down the pipeline (proposed field `bk.ops`):
```js
bk.ops = {
  boatId: null,            // Boat Assign
  upgrade: null,           // {fromRoute,toRoute/boat, reason, by, at, charge}
  vanId: null,             // Van Assign (outbound)
  vanReturnId: null,       // return van (may differ)
  pickupTimeFinal: '',     // confirmed pickup time (from Van Assign)
  reconfirm: {status:'pending'|'done', via:'list'|'phone', at, by},
  vanCheckin: {status, actualPax:{...}, noShow:N, at, by},
  pierCheckin: {status, actualPax:{...}, wristband:true, cotCollected:0, at, by},
};
```
Each stage only writes its own slice — never clobbers booking pricing/identity.

---

## 1. PRE-OPERATION DAY

### 1.1 Daily PFM (Pro-Forma) tracker  ← ✅ BUILT 2026-06-10
**Goal:** make sure proforma (PFM) bookings are paid before the cutoff, and escalate the ones that aren't.

**Shipped:** new nav **"Daily PFM"** (`#view-dailypfm` · `renderDailyPFM()`). Date stepper (default = tomorrow). Lists every non-cancelled booking on that date whose agent `payType==='proforma'`, with VC ref · agent · salesperson (`soldBy`||`agent.sales`) · route · pax · total · **balance** · status chip · actions. Cutoff = **18:00 the day before** (`pfmCutoff`); after cutoff & unpaid → row turns red + "⚠ UNPAID · past cutoff". Actions: **Issue PFM** (`pfmIssueInvoice`→`acctCreateInvoice` due 0) · **Record payment** (`pfmRecordPayment`→`acctRecordPayment`) · **Approve travel** / **Hold** (`pfmApproveTravel`/`pfmHold` → `bk.ops.pfm={decision,by,at}` + history). KPIs: PFM count · total value · unpaid · past-cutoff-unpaid · approved. Backup: `BACKUP/allotment_v2_20260610_pre_daily_pfm.html`.
**Scheduled 18:00 push:** scheduled task `daily-pfm-cutoff-1800` (cron `0 18 * * *`) reads the newest `data_exports/*.json`, finds unpaid pro-forma bookings travelling tomorrow, and reports them grouped by salesperson. ⚠ Reads the latest **manual export** — agent can't see live browser localStorage, so the user should hit 💾 Backup before relying on it (task warns if the export is >24h old).

- New view **"Daily PFM"** (own nav item or a tab under Accounting/Booking) filtered to a **selected operation date**.
- Lists every booking on that date whose `agent.payType==='proforma'` (PFM). Columns: VC ref · agent · salesperson · pax · amount · invoice status · payment status · **cutoff countdown**.
- Can **issue the proforma invoice** right here (reuse `acctCreateInvoice` · title "PRO FORMA INVOICE") and **track payment** (`acctRecordPayment`).
- **Cutoff = 18:00 the day before travel.** Before 18:00 → normal "awaiting". **After 18:00 & unpaid → ALERT state**: row turns red + an alert is raised **to that booking's salesperson** (`agent.sales` / `bk.soldBy`) asking: *"Approve travel anyway? (unpaid)"*.
- Salesperson action: **Approve to travel** (overrides, logs who approved + when) or **Hold/Cancel**. Stored on `bk.ops.pfm = {alertedAt, decision:'approved'|'hold', by, at}`.
- KPI strip: PFM total · paid · unpaid · past-cutoff-unpaid · approved-anyway.

> Implementation note: the 18:00 cutoff + alert is time-based — surfaced when the page is opened (compare now vs cutoff). A scheduled task could also push a daily 18:00 digest of unpaid PFMs to the salesperson.

### 1.2 Boat Assign  ← ✅ BUILT 2026-06-10
**Goal:** decide **which booking rides which boat** for a route on a date. The *available boats* for a route+date already come from Boat Op (`TRIPS[date]`).

**Shipped:** new nav **"Boat Assign"** (`#view-boatassign` · `renderBoatAssign()`). Date stepper. Per route running that date: boat capacity cards (assigned pax / cap + fill bar) + a table of seat bookings each with a **boat `<select>`** (`bkV2AssignBoat` → `bk.ops.boatId`). Unassigned rows highlighted + per-route counter. **Auto-assign** button (`baAutoAssign`, fill-first by capacity, keeps existing). **Upgrade** per booking (`bkV2BoatUpgrade`): prompt reason + optional charge → `bk.ops.upgrade={reason,charge,by,at}` + history; once upgraded the boat dropdown **unlocks to ALL boats that day** (cross-route emergency move). Boats come from `TRIPS[date]` (assign them in Boat Operation first; charters excluded). Helpers: `baDayBoats/baBoatsForRoute/baSeatBookingsForRoute/baAssignedPax`. Backup: `BACKUP/allotment_v2_20260610_pre_boat_assign.html`.
> Note: the emergency upgrade at Pier Check-in (the second entry point mentioned below) comes with the Check-in module later.

**Moved into By-trip-date (2026-06-10, per RM):** Boat Assign now lives as a **"Boat Assign mode" toggle inside the By-trip-date manifest** (single manifest, no duplicate screen). `_bkV2.boatAssignMode` + `bkV2ToggleBoatMode()`; the header has a **🚤 Boat Assign** toggle. When ON, the manifest gains a **Boat column** (per-row `<select>` via `baBoatCellHTML` → `bkV2AssignBoat`) + an **auto** button in that column header (`baAutoAssign`) + the ⤴ upgrade button per row. Colspans updated to `17+(boatMode?1)+(wxClosed?1)`. The old standalone **Boat Assign** nav item now calls `bkV2GoBoatAssign()` → jumps to Booking ▸ By-trip-date with the mode on (the separate `#view-boatassign`/`renderBoatAssign` page is left in code but no longer the entry point). Backup: `BACKUP/allotment_v2_20260610_pre_boat_assign.html`.

- Per route+date: show the assigned boat(s) + their capacity, and the list of bookings. Drag/assign each booking to a boat (`bk.ops.boatId`). Multiple boats on one route → split the manifest across them.
- Live fill bar per boat (assigned pax vs capacity).
- **Upgrade (emergency)** — see §3 answer below. The upgrade action lives **here (primary)** and is also allowed at Pier Check-in for last-minute cases.

### 1.3 Van Assign  ← ✅ BUILT 2026-06-10
**Goal:** decide **which booking is carried by which van**, set the real pickup time, and print the **Van Job Order**.

**Shipped:** **"Van Assign" mode toggle** in the By-trip-date header (green · mutually exclusive with Boat Assign). When ON, the manifest gains a **Van column**: per-row vehicle `<select>` (zone-aware — `vanVehiclesForZone` filters by `zoneBase` PK/KL; NoTransfer rows show "self-arrive") via `bkV2AssignVan`→`bk.ops.vanId`, plus an editable **pickup-time input** (`bkV2SetPickupFinal`→`bk.ops.pickupTimeFinal`, defaults blank/overridable). Per-vehicle **Van summary strip** under the trip header (distinct color per van · pax/cap · "ยังไม่จัดรถ" + "self-arrive" tallies) each with a **🖨 Job order** button. **Van Job Order** (`bkV2VanJobOrder(date,vanId)`) opens a print window: bilingual EN/TH A4-landscape sheet — #, voucher+agent, lead name, pax, pickup time, pickup location, room, route, drop-off (if changed) + return-van note, luggage. Return-van field (`bk.ops.vanReturnId`) supported in the data + shown on the job order. Colspan updated to `18+(vanMode?1)+(wxClosed?1)`. Backup: `BACKUP/allotment_v2_20260610_pre_van_assign.html`. Reads `SB_VEHICLES` (§1.5). Once vans are assigned, the Transfer Fleet "Daily" tab (§1.5) populates.

- Scope by zone (already split **Phuket / Khao Lak / No-Transfer**). No-Transfer = self-arrive (no van).
- Each booking → assign a **vehicle** (`bk.ops.vanId`) from the **Transfer fleet** (§1.5).
- **Pickup time**: pre-filled from the pickup-area time profile (§18) but the dispatcher can **override per booking** (`bk.ops.pickupTimeFinal`). "use existing time or a new time, dispatcher's call."
- **Return van may differ** → separate `bk.ops.vanReturnId`.
- Output **Van Job Order** (per vehicle), **bilingual TH + EN**, covering: VC ref (from agent) · guest name · pax count · **assigned pickup time** · pickup location · room number · drop-off (if changed) · luggage flag · note that the **return leg may use a different van**. Print → PDF (browser print, like contract/invoice).

**Grouping — MANUAL tick-to-group (reworked 2026-06-12, per user · auto-assign dropped).** Model: **van = group**, but a group can exist before a van is chosen (van optional/later). Data: `bk.ops.vanGroup` (number, scoped per route+date+zone) marks which group a booking is in; `bk.ops.vanId` set on all members when a van is picked for the group. Flow in Van Assign mode: the **Van column is now a ✓ checkbox + group chip** (`bkV2VanCellHTML` → `bkV2VanSelToggle`). Tick rows → a **group action bar** appears above the zone table (`เลือก N แถว · M pax → จับเป็นกรุ๊ปใหม่ / + กรุ๊ป N / ล้างที่เลือก`) → `bkV2VanGroupSelected(date,routeId,zone,'new'|gid)` bundles them. Rows then **cluster together** (sorted by group, ungrouped last) under a **group header row** (`_grpHeaderRow`): `กรุ๊ป N · pax/cap · van <select> (เลือกทีหลังได้) · group pickup-time input · Job order · ยกเลิกกรุ๊ป`. Rows are faint-shaded by group color (`box-shadow:inset 4px 0` + soft bg). Fns: `bkV2VanSelToggle/SelClear` · `_bkV2VanNextGroup` · `bkV2VanGroupSelected` · `bkV2VanGroupSetVan` (sets vanId on members) · `bkV2VanGroupSetTime` (one pickup time for the whole group → `pickupTimeFinal`) · `bkV2VanGroupDisband`. Selection state `window._bkV2VanSel`. (`bkV2VanAutoAssign` left defined but unused.) Backup: `BACKUP/allotment_v2_20260612_pre_van_grouping.html`.

**Grouping refinements (2026-06-12 b):**
- **Van list scoped to the program** — group header van `<select>` uses `vanVehiclesForRoute(date,routeId,zone)` = vans assigned to THIS program that day (matrix `dayRoute===routeId`), falling back to zone vans only if none assigned (fixes "showed all vans").
- **Per-hotel pickup time** — in van mode the **Time column is an editable input per booking** (`bkV2SetPickupFinal`, no re-render = keeps focus), since each hotel can differ. The group header keeps a **set-all** time field (`bkV2VanGroupSetTime`).
- **Sort by time within a group** — `list` sorted by (group, then pickupTimeFinal/orig) so each van-load is time-ordered.
- **Row shows its van** — the group chip in the ✓-column reads `กรุ๊ป N · <van name>` once a van is set; ungrouped = "ยังไม่จัด" (so newly-added bookings surface as ungrouped → regroup).
- **Lean van-assign columns** — vanMode hides Add-on / Pay / Total / Voucher (−4 cols). `COLN` (per-trip) drives all colspans: `(18 − (vanMode?4:0)) + (vanMode?1) + (rcMode?1) + (wxClosed?1)`.
- **Return van** — group header has a **รถกลับ** `<select>` (`bkV2VanGroupSetReturn` → `bk.ops.vanReturnId`, default "เหมือนเดิม") for when the group returns on a different van. (Independent return-grouping — different bookings returning together — not yet built; per-group return van covers the common case.)

**Split a large booking across vans + Van Job page (2026-06-13).** A booking bigger than one van splits via **✂ แยกคน** (`bkV2VanSplit`) → `bk.ops.vanSplits=[{pax,vanGroup,vanId,vanReturnId}]`; the booking renders as multiple **allocation rows** (each its own checkbox key `bkId@i` + group chip), so 16 = 12 + 4 can join different groups/vans independently. `bkV2VanUnsplit` merges back. All counters are allocation-aware (group header, Vans strip, Van Job page/print). **1 van = 1 group** enforced: a van used by another group is `disabled` in the group's van picker. Van Job Orders moved to a dedicated **sidebar page** (`renderVanJobs` · nav `vanjobs` under Transfer Fleet) — date stepper + per-van print; removed from the manifest.

**Large-group flow (mockup'd · user-approved):** 1) Van Assign · 2) ✂ แยกคน (16→12+4) · 3) ติ๊ก → จับเป็นกรุ๊ปใหม่ (1 กลุ่ม=1 คัน) · 4) เลือกรถให้กรุ๊ป (กันรถซ้ำ) · 5) เวลา+รถกลับ → Save · 6) พิมพ์ใบงานรถ (sidebar). Split only when a group can't fit one van; otherwise just tick-group existing separate bookings.

### 1.4 Re-Confirmation  ← new step
**Goal:** confirm the **actual pickup times** (output of Van Assign) back with each agent.

- Some agents send a **list**, some **call in**. Per booking: mark `reconfirm.status = done` (with via=list/phone, who, when).
- Status roll-up per trip/agent: "12 of 15 re-confirmed". A booking isn't fully "ready for op day" until re-confirmed.

### 1.5 Transfer Fleet registry  ← ✅ BUILT 2026-06-10
Analogous to the boat fleet. Needed for Van Assign + job orders.

**Shipped:** new nav **"Transfer Fleet"** (`#view-vehicles` · `renderVehicles()`). `SB_VEHICLES` (LS `sb_vehicles` · `sbVehiclesPersist`) seeded with own + partner vehicles. **Registry tab** = inline-edit table (name · plate · type sedan/van/minibus/bus · capacity · ownership own/รถร่วม + partnerName · zoneBase PK/KL · active · delete) + add. **Daily tab** = date stepper + per-vehicle cards showing fill bar + assigned jobs (`vehJobsFor` reads `bk.ops.vanId` + pickup time) — **empty until Van Assign (§1.3) writes assignments** (shows "รอ Van Assign"). Helpers: `vehGet/vehName/vehAdd/vehSetField/vehDelete/vehJobsFor`. Backup: `BACKUP/allotment_v2_20260610_pre_transfer_fleet.html`.
```js
SB_VEHICLES = [{
  id, name, plate, type:'sedan'|'van'|'minibus'|'bus',
  capacity, ownership:'own'|'partner', partnerName:'',
  zoneBase:'PK'|'KL', active:true, note
}]  // LS key sb_vehicles · sbVehiclesPersist()
```
- **Own vehicles vs partner (รถร่วม)** flagged via `ownership`.
- **Per-vehicle daily view** ("what is this van doing today"): pick a date → each own vehicle shows its assigned jobs (bookings, pickup times, route). Helps dispatch see utilization + gaps.

---

## 2. OPERATION DAY

### 2.1 Van Check-in
- Check guests onto the van per the Van Assign list. Record **actual pax** vs booked → shows **reduced / No-show** (e.g. booked 2, came 1 → "actual 1 · No show 1").
- **NOT a charge decision** — purely a count update. The "No show N" indicator (already built in the By-trip manifest) is fed/[confirmed] here too. `bk.ops.vanCheckin = {actualPax, noShow, at, by}`.

### 2.2 Pier Check-in
- At the pier: verify guest + **collect booking proof**, collect **COT** money if any, hand out the **wristband** (confirms which boat).
- May **re-adjust the actual travelling count** (second screening).
- After check-in → print the **boat Job Order** for that vessel: the list of guests on that boat + all operational detail, **agent name removed + money detail removed** (crew-facing).
- When all checked in → **boat leaves**.

### 2.3 Traveling Summary (per route) — the 100% final record
- Press **"Summarize"** per route → a complete, correct snapshot: all guests actually travelled, cancellations / reschedules / **charges** (how much charged), and **money collected grouped by payment type** (invoice / proforma / COT …).
- Press **Confirm Traveling Summary** → page **FREEZES** (read-only). 
- To edit after freeze → **request edit-approval from a higher Role** (needs a lightweight role/permission concept + an approval action). Edits after approval are logged.

---

## 3. ANSWERS to RM's open questions

**Q1 · Boat upgrade — which stage?**
Recommend: the upgrade action lives primarily in **Boat Assign** (§1.2) — that's where boat↔booking lives, so moving a guest to a better route/boat is natural there. ALSO expose an **emergency upgrade at Pier Check-in** for last-minute cases. Model: `bk.ops.upgrade = {fromRoute, toRouteOrBoat, reason, charge:0|amount, by, at}` + a history tag. Usually goodwill (฿0); allow an optional charge. Capacity is re-checked on the target boat.

**Q2 · Transfer fleet registry — build it?**
**Yes.** Van Assign + job orders need a real vehicle list, and you have **own + partner (รถร่วม)** vehicles to distinguish. Build `SB_VEHICLES` (§1.5) + a **per-vehicle daily schedule** window. Small module, mirrors the boat fleet pattern.

**Q3 · Mid-operation incidents (storm / boat returns / boat breakdown-swap)?**
Recommend an **"Operation Incident"** action available on the live op view + Traveling Summary:
- **Boat swap (เรือเสีย):** bulk-reassign all guests from boat A → boat B (`bk.ops.boatId` updated en masse), log an incident record, bookings/prices untouched. Ties into the existing Fleet incident/maintenance log.
- **Storm / boat turned back (เรือตีกลับ):** mark the trip **aborted**, then per-booking **resolution reusing the Weather 2-phase flow (§16.1)**: refund / credit / reschedule / no-charge. (Weather resolution already does exactly this — extend it to a generic "operation incident" trigger, not only pre-trip weather.)
- Because Traveling Summary is the frozen final record, an incident after Confirm must go through the **edit-approval** flow (§2.3) to re-open + record the outcome.

---

## 4. Suggested BUILD ORDER (each ships independently)

1. **Transfer Fleet registry** (`SB_VEHICLES` + daily view) — foundation for Van Assign. Small, no dependencies.
2. **Boat Assign** (booking→boat, fill bars, upgrade action) — uses existing Boat Op data.
3. **Van Assign** (booking→vehicle, time override) + **Van Job Order** (bilingual PDF).
4. **Daily PFM tracker** (invoice + payment + 18:00 cutoff + salesperson alert/approve).
5. **Re-Confirmation** (per-booking confirm status).
6. **Van Check-in** + **Pier Check-in** (+ wristband, COT collect, boat Job Order).
7. **Traveling Summary** (per-route final + freeze + role-based edit approval).
8. **Operation Incident** (boat swap / storm abort → reuse weather resolution).

Roles/permissions (needed by #7) — decide scope: a simple `RM` vs `staff` flag, or a fuller role list. Parked until #7.

---

## 5. Open decisions to confirm before building
- **Build order** — start with Transfer Fleet + Boat Assign, or jump to Daily PFM first (most time-sensitive operationally)?
- **PFM alert delivery** — in-app only, or also a scheduled 18:00 push/notification to the salesperson?
- **Roles** — how many roles for the Traveling-Summary edit-approval? (e.g. Staff / Supervisor / Manager)
- **Van Job Order languages** — TH+EN confirmed; any third (RU/CN) ever needed?
- **Boat upgrade charge** — always goodwill (฿0) or sometimes charged? (affects the form)
