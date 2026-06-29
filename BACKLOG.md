# LOVE Andaman — Feature Backlog

> Pending features parked for later · scope is documented here so context isn't lost
> Last updated: 2026-06-12

---

## ✅ FIXED (2026-06-13) — Sticky header / scroll เพี้ยนใน Van Assign

**สาเหตุที่แท้จริง:** รอบ 06-12 ตั้ง `.t2-tblscroll{overflow:auto;max-height:calc(100vh-210px)}` → สร้าง **scroll container ซ้อน** (nested scroll) ทั้งที่จริงๆ แอป scroll ที่ **window** (topbar/sidebar เป็น `position:fixed`, `.main` ไม่มี overflow) → หัวเลย "ตรึงไม่จริง"/เลื่อนเหลื่อม.

**แก้แล้ว:** `.t2-tblscroll{overflow:visible}` (เอา nested scroll ออก) + `table.t2-mtbl th{position:sticky;top:var(--topbar,52px);z-index:30;background:#fff}` → หัวคอลัมน์ตรึงเทียบ **window** ใต้ topbar (52px) เลื่อนทั้งหน้าได้ปกติ ไม่มี scroll ซ้อน. ตรวจแล้วไม่มี ancestor `overflow:hidden` คั่น (`.bkv2-bodycard` override เป็น visible ที่ ~บรรทัด 46484). Backup: `BACKUP/allotment_v2_20260613_pre_sticky_fix.html`.

**✅ ปิดเรื่องแล้ว (2026-06-13) — Van Assign sticky stack ลงตัว (user: "แบบนี้แหละ เยี่ยมมาก"):**
โครงตรึงเป็นชั้นจากบนลงล่าง: **แถบวันที่ (t2-hd, top:52, z45) → Van strip + Grouping (container เดียว 2 แถว 96px, sticky, z40) → หัวคอลัมน์ (z35) → แถว (z0)**. แถว Grouping โผล่ตั้งแต่เข้า van mode (hint → ปุ่มจับกลุ่มเมื่อติ๊ก). 
**กุญแจกันทับ 2 อย่าง:** (1) `.t2-tblscroll{position:relative;z-index:0}` → แถวอยู่ stacking layer ต่ำกว่าแถบตรึงทั้งหมด วาดทับไม่ได้; (2) offset วัด `.t2-hd` height ด้วย JS แล้วเซ็ต `--t2-vangroup-top`/`--t2-head-top` เป็น **ค่า px ตรงๆ** (เลี่ยง calc-ซ้อน-var ที่เคย resolve ไม่ได้ → fallback ชนกัน). Backups วันนั้น: `pre_sticky_fix` · `pre_sticky_stack` · `pre_revert_vanstrip_sticky` · `pre_vanstrip_combined`.

**ประวัติ (อ้างอิง) — Van Assign action bar:** แถบจับกลุ่ม (`groupBar`) เปลี่ยนเป็น **floating bar ตรึงล่างจอ** (`position:fixed;left:var(--sidebar);right:0;bottom:0;z-index:90`) โผล่เฉพาะตอนมี selection ในโซนนั้น (เหมือน Gmail multi-select) → ติ๊กแถวยาวแค่ไหนก็กด "จับเป็นกรุ๊ปใหม่ / + กรุ๊ป N" ได้ตลอด ไม่ชนหัวคอลัมน์ที่ตรึงบน. บอกโซนในแถบด้วย (`เลือก N แถว (Phuket) · M pax`). van mode เพิ่ม `padding-bottom:88px` ให้ bodycard กันแถวสุดท้ายถูกบัง. ⚠ fixed อิง viewport — ถ้ามี ancestor ใส่ `transform/filter` จะเพี้ยน (ตอนนี้ไม่มี).

**Optional follow-up (ยังไม่ทำ):** ตรึง trip header/van strip/zhead ด้วย — ต้อง sticky หลายชั้น. ตอนนี้ตรึงหัวคอลัมน์ (บน) + action bar (ล่าง) ครบพอใช้งานแล้ว. ⚠ Trade-off `overflow-x:auto` ถูกเอาออก → จอแคบมากๆ ตารางอาจล้นแนวนอน (จอ ops กว้างพอ ไม่กระทบ).

---

## ⏸ Reschedule — "On Hold · awaiting customer decision" (design noted 2026-06-10 · NOT built)

**Use case:** customer asks to postpone but **can't give a new date yet** — waiting for them to decide. Outcome may be **reschedule (new date)** OR **cancel**. Today the Reschedule flow (§15.1) *requires* a date, and Cancel is final — there's no in-between holding state.

**Proposed model** (mirrors the Weather 2-phase resolution §16.1, but customer-initiated):
- New holding state **`bk.hold = {reason:'reschedule_pending', status:'awaiting'|'notified', requestedAt, deadline?, note, by}`** + history tag.
- Booking shows an **"On Hold · awaiting customer"** badge + a new **On Hold filter/KPI** in All-bookings (so staff see how many are waiting).
- **Resolve** button → choose one of two, routing into the EXISTING flows:
  - **Set new date** → `bkV2RescheduleBooking(...)` (fee on own invoice, ghost+badge as today)
  - **Cancel** → existing cancel flow (reason category + refund/no-refund)
- Clears `bk.hold` on resolve; logs the outcome.

**Open decision — seat handling while waiting (asked, user deferred):**
1. Release the seat back to the pool now (frees inventory; risk: slot may be gone when they pick a date).
2. Hold via a **Seat Lock** (§13.6) for that agent/customer (keeps priority, frees the booking; safest) — *leaning this way*.
3. Keep the booking occupying the original date's seat until resolved (safe slot, but blocks inventory on a date they probably won't use).

**Deadline:** optional — could set a "respond by" date that flags overdue holds. Also deferred.

Revisit when the user is ready to build.

---

## ✅ Agent Activity Log (audit trail · DONE 2026-06-10)

Per-agent audit trail so changes can be tracked back. Data: **`agent.activity[]`** = `{at, by, kind, text}` (capped 200 · persisted via `sbAgentsPersist`). Helper **`agLog(agentId, kind, text)`**. Logged automatically from `agEditSave` (diffs before→after per section) + `agCreateSubmit` + contract export:
- **rate** — rate type switched on the agent (old name → new name) ← the key one
- **credit/profile** — payType · credit limit · credit days · VAT mode · credit balance changes
- **company** — name · market · sub-market changes · **sales** — salesperson change · **programs** — route count change · **note** · **contract** — contract generated (version + lang) · **created**

UI: new **Activity tab** in the agent detail (`agTabActivity`) · colored timeline, newest-first, badge count on the tab. Backup: `BACKUP/allotment_v2_20260610_pre_agent_activity.html`.

**Not yet logged (parked):** editing the *prices inside a Rate Type* (the rt object itself) has no version/price-change history — only the agent's binding change is logged. If needed, add an `rt.history[]` on `rtSaveDraft` capturing a price-diff snapshot per rate type. Workaround today: **Clone** the rate type (keeps the old one intact) instead of editing prices in place.

---

## 🛟 Safety Equipment Module — Phase 2

**Status:** Parked · use Hull/Other workaround for now

**Motivation:** Track safety equipment (bilge pump, life jackets, fire ext, EPIRB, etc.) as first-class assets — currently they're squeezed into the Hull/Other free-text field of incidents

**Scope (5 sub-phases):**

| Phase | Work | Effort |
|---|---|---|
| **2a** | Data model `FL_SAFETY` + seed for 15 boats (~6 items each = 90 entries) | M |
| **2b** | Safety tab in Company Asset + asset list view | M |
| **2c** | INC modal integration — asset dropdown includes safety items | S |
| **2d** | Expiry/PM dashboard alerts (X items expiring in 90 days) | S |
| **2e** | Bulk add + boat creation defaults (auto-add standard safety set when creating new boat) | S |

**Data model proposal:**
```js
FL_SAFETY = [
  {
    id:'sf001', boatId:'b10',
    category:'bilge_pump',     // enum: bilge_pump | life_jacket | fire_ext | epirb | flare | vhf | first_aid | anchor | nav_light
    name:'Bilge pump · aft engine room',
    brand:'Rule', model:'1500 GPH', serial:'BP-001',
    qty:1,                      // for life jackets: 50, etc.
    installDate:'2024-06-01',
    expiryDate:null,            // for items with expiry: flare, EPIRB battery
    nextPM:'2026-06-01',        // next inspection / refill date
    lastInspect:'2025-12-01',
    status:'active',            // active | expired | replaced | missing
    location:'Engine room aft',
    note:'12V · auto float + manual switch',
    log:[
      {date:'2024-06-01', type:'install', desc:'Initial install'},
      {date:'2025-12-01', type:'inspect', desc:'Annual test · 1500 L/hr · ok'}
    ]
  }
]
```

**Equipment types + tracking specifics:**

| Equipment | Track | Regulatory |
|---|---|---|
| Bilge pump | install, hours, last test | กรมเจ้าท่า required |
| Life jacket | qty (≥ license pax), expiry, condition | required, 6-month check |
| Fire extinguisher | type (DCP/CO2), capacity, expiry, pressure check | required, refill 5 yrs |
| EPIRB / SART | battery expiry, registration, HRU expiry | required offshore |
| Flare / Pyrotechnic | expiry (3 yrs), qty | required |
| VHF radio | model, license, MMSI, battery | required |
| First aid kit | item expiry, last refill | recommended |
| Anchor + chain | weight, chain length, last inspection | required |
| Navigation lights | bulbs, last test, spare bulbs onboard | required |

**Workaround until built:**
- Use INC `Hull / Other` free-text field
- Example: `"Bilge pump · ห้องเครื่องหลัง · Rule 1500 GPH · SN: BP-001"`
- Or in MJ title: `"เปลี่ยน Bilge pump aft · Rule 1500 GPH"`
- Searchable but unstructured — no expiry alerts, no PM rotation

---

## 🧾 ACCOUNTING MODULE (parked 2026-06-03) — absorbs the Payment-status + Credit notes below

**Status:** Design agreed · scope = **Full** · phased build · decisions locked

**Decisions locked (in chat):**
- Credit: **deduct at booking confirm · restore at payment received** (receivables stay real).
- Features wanted: **Deposit · Partial payment · combine multiple bookings per invoice · printable receipt/PDF.**
- VAT/tax: not now (can add later).

**Data model (localStorage · read-modify-write like other SB_*):**
- `SB_INVOICES` — `{id, number, agentId, bookingIds:[], lineItems:[], subtotal, depositApplied, total, issuedAt, dueAt, status:'draft|issued|partial|paid|void', payments:[paymentId]}`
- `SB_PAYMENTS` — `{id, invoiceId|null, agentId, amount, method:'transfer|cash|card', date, ref, type:'payment|deposit|refund'}`
- `SB_DEPOSITS` — held prepayment per agent/booking, applied to invoices.
- Booking gains `paymentStatus` + invoice link.
- Agent credit: `creditUsed` derived from confirmed-but-unpaid bookings; `agCreditAvailable(id)=limit−used`.

**Money flow:**
```
confirm booking (credit agent) → creditUsed += total
  → issue invoice (rอชำระ)  → customer pays → record Payment → invoice Paid → credit restored
deposit: received → held → applied to invoice (reduces due)
weather-cancel: void invoice / refund → credit restored
```

**Phased build:**
- **P1 · Core ledger + credit link** — SB_INVOICES/PAYMENTS/DEPOSITS, booking paymentStatus, credit consume/restore, Accounting nav + invoices list + record-payment. (money flow works, no PDF)
- **P2 · Invoice/receipt docs + PDF + combine multi-booking** (reuse Contract print infra)
- **P3 · Deposits + partial payments + per-agent statement**
- **P4 · Money dashboard** — receivables · overdue · exposure · collected

**Section UI:** Accounting → Dashboard · Invoices · Payments/Receipts · Agent statement.

---

## 💳 Payment status workflow — Invoice vs Prepaid (parked 2026-06-03 · now part of Accounting P1)

**Status:** Parked · design agreed in chat

**Concept:** collapse payment to 2 modes + add a per-booking payment *status* lifecycle.
- **Invoice (credit)** — agent billed later (net days). Status: `unpaid → invoiced → paid`.
- **Prepaid** — must collect before travel; issue invoice/proforma to collect → status `awaiting_payment` → on payment (incl. cash) → `paid`/`complete`.
- COT (cash on tour) → `awaiting_payment` until collected on the day → `complete`.

**Data model proposal:** `booking.paymentStatus: 'awaiting_payment'|'invoiced'|'paid'|'complete'|'refunded'` + `paidAt`, `paidAmount`, `paymentMethod`. Show as a colored chip in the Pay column + a filter.

---

## 🏦 Agent credit — deduct on booking + restore (parked 2026-06-03)

**Status:** Parked · needs 2 decisions before build (see below)

**Question raised:** when bookings start, should the agent's credit be drawn down, and when is it returned?

**Recommendation:**
- **Consume** credit at **booking confirm** (status `confirmed`): `creditUsed += bookingTotal` (or net). Block / warn if `creditUsed + total > creditLimit`.
- **Restore** credit when: (a) **payment received** (invoice paid → frees the credit), (b) booking **cancelled/rejected/weather-cancelled** → full return, (c) optional monthly cycle reset.
- **Prepaid** agents: no credit consumption (paid upfront).
- Show running `available = limit − used` on Agent card + a warning when low/over.

**Decisions needed:** (1) consume at *confirm* vs at *invoice issue*? (2) restore at *payment received* vs *trip completed*?

**Data model:** `agent.creditUsed` (derived from open bookings) · `booking.creditHold` amount · helper `agCreditAvailable(agentId)`.

---

## 🌧️ Weather / route cancellation — ✅ DONE 2026-06-03

**Status:** Built · all 4 outcomes · verified. **Decision comes from ops** (Boat Operation cell popover → `bkV2WeatherMark` → note popup → `bkV2WeatherMarkConfirm` records closure in `SB_WEATHER_CLOSURES`/`sb_weather` + tags affected bookings · status change shows that day in Boat Op heatmap as `⛈ CANCEL` red tint). **Resolution happens in By-trip-date** — the cancelled trip shows a faint-red wash over the whole block (`.t2-trip-wx`) + a prominent alert banner with the note + "เริ่มแก้ by booking" button → opens `bkV2WeatherPanel`.

**2-phase per-booking workflow (2026-06-03):** the panel is now a **status tracker**, not a one-shot apply. Each affected booking carries `bk.weatherResolve = {event:'routeId|date', status:'awaiting'|'notified'|'resolved', notifiedAt, outcome, newDate, resolvedAt}`.
- **Phase 1 · แจ้ง agent** (`bkV2WeatherNotify`) — staff notifies the agent; status `awaiting → notified` (+ timestamp). Agent then talks to the customer offline.
- **Phase 2 · ดำเนินการ** (`bkV2WeatherResolveOne`) — once the agent replies, pick the per-booking outcome: **reschedule** (move `trip.date` + `rebook` log · booking stays `confirmed`) · **refund** (`cancelled_weather` + negative refund payment + void invoice) · **เก็บเครดิต** (paid → `acctCreateDeposit` + void invoice) · **ยกเลิก** (void unpaid invoice). status → `resolved`.
- Panel header shows progress counts (รอแจ้ง / แจ้งแล้ว-รอตอบ / จัดการแล้ว). Resolved bookings stay listed (✓ outcome) so the board is auditable. Bookings tagged via `bkV2WeatherTagBookings` on closure + panel-open (excludes charter). `getSeatsConsumed` excludes `cancelled_weather` → seats auto-released. Backups: `pre_weather_cancel`, `pre_weather_note`, `pre_wx_workflow` (all 20260603).

<details><summary>original design</summary>

**Status:** Parked · design agreed in chat · likely next big feature

**Need:** when a trip can't run (weather), cancel the whole route+date and cascade to all its bookings — operationally distinct from "no trips scheduled".

**Proposed flow — one "Cancel trip (weather)" action** (from By trip · date trip header / Boat Operation):
1. Mark route+date **closed · reason: weather** (own reason code, not the same as off-season program-closed).
2. Bulk-update affected bookings → status `cancelled_weather` (or `rebook_pending`).
3. **Release** their seats + seat-locks back to the pool, and **restore agent credit**.
4. Set payment → `refund_due` (prepaid) or void invoice (credit) — no penalty (operator's call, not no-show).
5. Output an **action list** for ops: contact each agent to **reschedule** (move trip to new date) or **refund**.

**Distinguish:** weather-cancel (operator fault → refund/reschedule, no penalty) vs customer no-show/cancel (may carry penalty per contract cancellation policy).

**Data model:** `TRIPS`/day-status reason `'weather'`; `booking.status='cancelled_weather'`, `booking.rebookOf`/`rebookedTo` links for reschedules.
</details>

---

## 📋 Small / quick (parked 2026-06-03)

- **By trip · date — sort by Zone:** manifest already *groups* by zone (zoneBlocks, ordered by `bkV2ZoneOrder`). If "sort" means ordering rows within a zone (e.g., by pickup time) or a flat zone-sorted list instead of grouped — confirm preference, then small change in `bkV2RenderTab2`.

---

## ✅/⏸ Booking required-field validation (parked 2026-06-04)

**Status:** Parked · design agreed · **decision on which fields = pending** (user will pick later)
**Trigger:** booking BK-26060015 (Traveloka/OTA) saved with **no pickup** (hotel/area/time blank). Confirmed NOT a bug — every other field saved fine; the form only hard-requires Agent (`if(!d.agentId) alert...` in `bkV2CommitBooking`). Pickup was simply never entered (typical OTA: hotel unknown at booking time).

**Two enforcement levels to mix:**
- **Hard block** — incomplete = can't save (`alert` + `return` in `bkV2CommitBooking`, like the existing agent check).
- **Soft warn + flag** — `confirm("ยังไม่ครบ · บันทึกต่อไหม?")`; if saved, set an "incomplete" flag → show ⚠ badge on the manifest row (reuse the pattern of `agIncompleteFields`/the agent ⚠ badge) so dispatch can chase it.

**Recommended tiering (to confirm per field):**

| Field | Recommend | Why |
|---|---|---|
| Agent | Hard (already) | needed for price/credit |
| Route + date (per trip) | Hard | no trip without it |
| Pax (≥1) | Hard | must have people |
| Lead pax name | Hard | who is travelling |
| Rate Type | Hard | drives the quote |
| **Pickup (hotel/area + time)** | **Soft warn + ⚠ flag** | OTA often unknown at booking |
| Phone / Email | Warn or optional | usually optional (≥1 nice to have) |
| Voucher ref / Room / Note | Optional | supplementary |

**Where to build:** `bkV2CommitBooking` (~line 44954) — add a validation block after the existing agent check; collect missing-required → block; collect missing-soft → `confirm` + tag `bk.incomplete=[...]`. Manifest row (`bkV2RenderTab2`) → render a ⚠ chip when `bk.incomplete?.length`.

**Next step:** user picks which fields are Hard vs Soft (answered "note it, come back later").

**✅ DONE (2026-06-04): No-Transfer exception for Hotel/Pickup location.**
When zone = No Transfer (`NoTransfer`/`NT`) the Hotel/Pickup field is no longer required — label flips to **"Note · optional · self-arrival"** with an optional-note placeholder, and the `bkV2CommitBooking` hard-block (`Hotel / pickup location`) is skipped (detected via area.zone / `pickupZoneFilter` / trip zone = No Transfer). Other zones (PK/KL) still hard-require the hotel. Form flag `_pickIsNT`. Backup: `BACKUP/allotment_v2_20260604_pre_notransfer_pickup.html`.

---

## 🔧 Gearbox/Propeller — "เอากลับมาติดตั้ง" (re-install spare) + stash UI polish (parked 2026-06-06)

**Status:** Parked · idea noted · the "ถอดเก็บ" (stash → Spare) side is DONE (see CLAUDE.md §17)

**Motivation:** Now that engines go to repair and their gearbox/propeller get stashed as Spare (`status='spare'` + `spareLocation`, detached via `engineId`/`gearboxId = null`), we need the reverse path for when the repair is finished — put a stored spare (or the original) back onto an engine. Today re-install is only doable via the gearbox/propeller edit form (set status back to ready/active + pick engine), no one-click flow.

**Scope (ideas to confirm later):**
- **Re-install action** — button on a Spare gearbox/propeller (Asset list, or the boat/engine view) → pick target engine (gearbox) / gearbox (propeller) → set `status` back to `ready`/`active`, set `engineId`/`gearboxId`, clear `spareLocation`, push an `{type:'install'}` log entry. Optionally re-add it as an asset of the relevant open MJ.
- **"ถอดเก็บแล้ว" badge** — show on the MJ manifest / engine job + maybe Boat Status, so dispatch can see which boats have parts pulled & stored (and where).
- **Reverse from job close** — when an engine MJ is closed, optionally prompt "ติดเกียร์/ใบจักรกลับ?" (re-install the parts that were stashed at start, at `flMaintStart`).

**Data model:** no new fields needed — reuse `status` (`ready`/`active` ↔ `spare`), `spareLocation`, `engineId`/`gearboxId`, and the part `log[]` (`type:'install'|'remove'`). Could add `bk`-style origin tracking if we want to remember "which engine it came off" beyond the log text.

**Workaround until built:** use the gearbox/propeller **edit form** — set status Ready/Active + select the engine/gearbox to re-attach (clears spare). The stash log already records origin + destination.

---

## ❌ Cancellation — categorized reasons + partial + stats (2026-06-07)

**Phase 1 · Categorized reason — ✅ DONE (2026-06-07).** Cancel modal (`bkV2CancelModal`) now has a **Reason dropdown** (`#bkc-cat`) from `BKV2_CANCEL_REASONS` (stable `code` + Thai label + `group:customer|operator|other` + `def` charge suggestion). Picking a reason auto-sets the suggested charge radio (`bkV2CancelPickReason`, user can override). Note textarea is now optional (required only for `other`). Stored on `bk.cancellation = {category, categoryLabel, group, note, reason, chargeType, chargeAmount, at, by}` + `bk.cancelCategory`. Reasons: `customer_cancel · no_show · sick · flight_visa · agent_error` (customer) · `operator · force_majeure` (operator) · `other`. Weather stays its own flow (`cancelled_weather`). Backup: `BACKUP/allotment_v2_20260607_pre_cancel_reasons.html`.

**Phase 2 · Partial cancellation — ✅ DONE (2026-06-07).** **"− Reduce pax" button** in voucher detail (`bkV2DetailPartial` · gated by `canCancel`). Modal `bkV2PartialModal(bookingId,tripIdx)`: trip picker (multi-trip) → remove count per **present pax key** (`BKV2_PAX_KEYS` = ad/chd/inf/foc × base/_fr/_th) → reason (shared `BKV2_CANCEL_REASONS`) + note (required for `other`) + price-reduction/refund ฿. `bkV2PartialConfirm` → `bkV2PartialCancel(id,tripIdx,{removed,totalRem,category,note,refundMode,refund})`: decrements `trip.pax[k]` (seats auto-released via `getSeatsConsumed`), reduces `bk.priceBreakdown.total`+`bk.total` by refund, pushes `bk.partialCancels[]={date,tripIdx,paxRemoved,count,category,categoryLabel,group,note,refundMode,refund,at,by}`, history tag `Cancel`, persists `sb_bookings`. Booking stays `confirmed`. **Money is an explicit radio (`bkp-money`): `none` = ไม่คืนเงิน (เก็บราคาเดิม · refund 0) · `refund` = คืนเงิน/ลดราคา (amount required)** → stored as `refundMode`. ⚠ Does NOT auto-recompute the full seat quote (price stored, not live). ⚠ If already invoiced, invoice not auto-adjusted (manual). **Folded into the Phase-3 report (2026-06-07):** report aggregates `partialCancels` into Pax cancelled (full vs partial sub), By reason/Fault/Month/Agent, and no-show; KPI "Cancellations" shows full count + "+N partial".

**Phase 3 · Cancellation report — ✅ DONE (2026-06-07).** New **"Cancellations" tab** in Booking module (`_bkV2.tab==='cancel'` · `bkV2RenderCancelReport()` · wired in `bkV2RenderTopbar`/`bkV2RenderTabBody`/`bkV2TopbarMeta`). KPIs: cancellations + rate, pax cancelled, **no-show rate**, fees collected. Sections: By reason (bars + customer/operator/other tag + count·pax·fee), Fault side split bar, Top cancelling agents, By month bars. `cancelled_weather` auto-counts as category `weather` (operator). Reads `bk.cancelCategory`/`bk.cancellation`. Empty state when none. Backup: `BACKUP/allotment_v2_20260607_pre_cancel_report.html`.

---

## 🎟️ FOC booking status — confirm/approve flow + edit-revert bug (parked 2026-06-08 · fix tomorrow)

**Trigger:** Aqua Travel & Threeland Asia bookings that have FOC pax — user pressed Confirm but status stayed Quote/Pending, not Confirmed.

**Root cause (by design + a bug):**
- `bkV2SubmitBooking` (~46485): if `quote.totalFoc > 0` → commits as **`pending_foc`** (awaiting approval), NOT `confirmed`. Free seats must be approved first. Only **`bkV2FocApprove`** (~47073) sets `bk.status='confirmed'` (via the FOC Approval panel · Approve button). So FOC bookings sit in Pending FOC until someone clicks Approve.
- Quote vs Pending FOC: `bkV2SaveQuote` saves as `quote` (grey); Submit saves as `pending_foc` (amber) / `confirmed`. `bkV2Norm` maps `status==='pending'`→display `quote`.
- ⚠ **Edit-revert bug:** editing an already-FOC-approved (confirmed) booking and re-Submitting re-runs `hasFoc?'pending_foc':'confirmed'` → **downgrades it back to Pending FOC** (loses confirmed). Matches BK-26060116 (FOC approved 14:06 → Edited 16:43 → shows Quote).

**✅ FIXED (2026-06-09):** (a) **Edit no longer reverts** — in `bkV2CommitBooking` edit path, after preserving `focApproval`, if `focApproval.status==='approved'` and the recomputed status is `pending_foc`, force `status='confirmed'` (+stamp confirmedAt). (b) **One-time reconcile** added right after the `sb_bookings` load IIFE (~34137): any booking with `focApproval.status==='approved'` but status stuck in `pending_foc`/`pending`/`quote` → set `confirmed` + persist (fixes Aqua/Threeland already stuck). Backup: `BACKUP/allotment_v2_20260609_pre_foc_status_fix.html`.

**Still optional (not done):**
3. **Quick Approve** action in All-bookings list / calendar to clear Pending FOC in bulk.
4. Make Pending-FOC more discoverable (flag/badge in lists + "127 vs 112" gap shown inline).

---

## 🧑‍💼 Non-agent booking purposes — direct sale · staff welfare · staff inspection (2026-06-09)

**Concept:** add a `bk.purpose` dimension + `bk.soldBy` so bookings that aren't normal agent sales are handled right (who gets sales credit · pricing · counts as revenue? · consumes a sellable seat? · reporting bucket). Reuse the existing FOC mechanic (free seat + ฿0 + counts in pax) with a category tag.

**✅ Phase 1 — Walk-in / direct sale (DONE 2026-06-09):** (a) `bk.soldBy` (salesId) + "Sold by" select in New Booking form (Agent & Voucher row · blank = derive from `agent.sales`). KPI `ownerOf` in `mdTabSales` = `soldBy || agent.sales` → credit the chosen salesperson. (b) **Pricing mode toggle `bk.priceMode` `rate`|`manual`** + `bk.manualTotal` (Agent & Voucher row). Manual = free-style: type a Total ฿, no Rate Type required, no NO-RATE block. Implemented via short-circuit in `bkV2CalcQuote` (returns manualTotal as grand total → total/invoice/KPI all derive correctly) + `bkV2NoRateTrips` early-return + `canContinue` allows manual + suppress per-trip NO-RATE warning in manual. Carries on edit. (c) **Conditional UX (2026-06-09):** `isWalkin = agent.code==='WALKIN'`. Real agent → Pricing locked to Rate type (toggle hidden) + Sold-by hidden (credit via `agent.sales`) + on agent-change force `priceMode='rate'` & clear `soldBy`. Walk-in house agent → Sold-by select + Rate/Manual toggle shown. (d) Seeded house agent **a_walkin** "Walk-in / Direct (B2C)" (RT-COUNTER · COT) + dedicated **`walkin` market** "Walk-in / Direct" (one-time IIFEs after sb_agents/sb_markets load · idempotent). Backups: `pre_soldby`, `pre_manual_price` (20260609). ⚠ **Still needed:** the form still requires an agent — create a **"Walk-in / Direct" house agent** (bind RT-COUNTER · COT) so there's something to pick (or use a50 Patong / hotel counters meanwhile). Not yet seeded.

**✅ Phase 2 — Staff welfare (DONE 2026-06-10):** **Staff registry + yearly per-seat quota** — new nav **"Staff & Welfare"** (`renderStaff` · `#view-staff`) · `SB_STAFF` (LS `sb_staff` · `{id,code,name,dept,active,quota:{YYYY:seats}}`) · inline-edit name/dept/quota, add/delete, year stepper, KPIs (quota/used/remaining). Quota = **free seats per employee per year** (policy-adjustable). **Booking flow:** house agent **a_staff "Staff / Welfare"** + market `staff`. Pick it → form shows **Staff member picker + live "quota left N seats (year)"** badge + default **manual price** (FOC free / staff rate over). Save stores `bk.purpose='staff_welfare'` + `bk.staffId`. **Quota auto-derived** = `staffWelfareUsed` counts **FOC pax** of that staff's bookings per year (paid over-quota Adult pax don't count). **Guard** in `bkV2CommitBooking`: require staffId + warn (confirm) when FOC seats exceed remaining quota (excludes the edited booking). **Phase 3 — Inspection (DONE 2026-06-10):** the staff form now has a **Purpose** picker (Welfare/Inspection). `bk.staffPurpose` = `'welfare'`|`'inspection'`; `bk.purpose` = `staff_welfare`|`staff_inspection`. Inspection = **no quota**: quota badge + over-quota guard skipped, and `staffWelfareUsed` now excludes `staffPurpose==='inspection'`/`purpose==='staff_inspection'` bookings so inspection FOC pax don't eat the welfare counter. Backup: `BACKUP/allotment_v2_20260610_pre_staff_welfare.html`. **Trips report (DONE 2026-06-10):** Staff & Welfare page now has a **Roster / Trips report** tab toggle (`_staffTab` · `staffSetTab`). Trips tab (`staffTripsReport(yr)` + `staffTripsFor(yr)`) = per-year KPIs (Welfare FOC seats · over-quota paid · Inspection heads · total trips) + a table of every staff trip (date · staff · welfare/inspection badge · route · free/paid/total heads · booking ref), sorted by date. **Staff rate type (DONE 2026-06-10):** over-quota seats now price from a real, managed Rate Type **`rt_staff` "Staff Welfare"** (code RT-STAFF · purple · routes r3/r5/r6/r10/r11/r12 · seat rates **seeded at 50% of Counter rt003**, editable in the Rate Types page like any other). Agent **a_staff bound to `rt_staff`** (seed + migration that flips an existing a_staff from rt003→rt_staff and persists). Staff bookings now default to **priceMode='rate'** so: in-quota seats = FOC (free, deduct quota), over-quota seats = enter as Adult/Child → charged at Staff Welfare rate automatically (Manual still available via the Pricing toggle as fallback). Form hint added under the staff picker explaining use-quota (FOC) vs pay (Adult/Child). Backup: `BACKUP/allotment_v2_20260610_pre_staff_ratetype.html`. **Staff module now feature-complete** (registry + quota + welfare/inspection + guard + trips report + rate type). **Fixes 2026-06-10 (pre_staff_ratetype era):** (1) rt_staff was missing for existing data because a saved `sb_rate_types` in localStorage overrides the seed array → added `_RT_STAFF_SEED` snapshot + `_rtEnsureStaff()` IIFE that re-injects rt_staff on load if absent + persists (kills the false "No Rate Type bound" warning on the staff agent). (2) **Inspection = always ฿0** — selecting Purpose=Inspection (or staff agent while inspection) forces `priceMode='manual', manualTotal=0` so it never charges even if Adult pax are entered; Welfare → `priceMode='rate'` (Staff Welfare rate).

**⏸ Phase 3 — Staff inspection (on-duty):** `purpose='staff_inspection'` · ฿0 always (ops cost, NOT welfare) · requires a purpose/reason note (what they inspect) · does NOT touch welfare quota or sales KPIs · **still counts a seat in the manifest** (they're on the boat — prevents oversell). Report under "Staff trips".

**New data when building 2-3:** staff registry, welfare quota ledger (per employee/year), staff rate type, `bk.purpose` + `bk.staffId`, and a "Staff trips" report (welfare vs inspection). Manifest/KPIs must split: sale vs welfare vs inspection.

---

## 💰 COT collection reminder at check-in (noted 2026-06-13 · NOT built)

**Status:** Idea parked · depends on the unbuilt **Check-in module** (pipeline)

**Question from user:** "ทุกเคสที่มี COT ตอนเช็คอิน จะมีเตือนให้เก็บเงินไหม?" → today **No**. There is no check-in flow yet, so nothing actively prompts staff to collect Cash-on-Tour.

**What exists today (passive only):**
- Pay column chip `bkV2CotChip` (cyan "COT ฿X") from `bk.cashOnTour` (or a "cash on tour …" note line).
- Voucher/booking detail shows "💰 Collect cash on tour" + amount + handling (`deduct` from invoice / keep `separate`).
- Nothing tracks whether it was actually collected, and no reminder surfaces it at the moment of boarding/check-in.

**Proposed (build inside the Check-in module):**
- Per-trip check-in list flags every COT booking prominently (e.g. yellow "ต้องเก็บ ฿X" badge) so the guide/counter can't miss it.
- A **"เก็บแล้ว" tick** per booking → records a real payment via `acctRecordPayment` (method `cash`), stamps `bk.cashOnTour.collectedAt`/`collectedBy`, flips the chip green → ties COT into accounting + prevents "forgot to collect".
- Trip-level summary: total COT to collect vs collected (so a trip can't close with uncollected cash).
- Handle `handling:'deduct'` (reduce the agent invoice) vs `'separate'` (standalone cash receipt) correctly when recording.

**Interim option (before Check-in module):** show a per-trip "COT to collect: ฿X (N bookings)" summary in By-trip-date so dispatch sees the day's cash exposure.

**Data:** reuse `bk.cashOnTour` (+ add `collectedAt`/`collectedBy`/`collected:true`). No new store needed; payment goes through existing `acctRecordPayment`.

---

## ⬆️ On-tour Upgrade feature (longtail etc.) + settle at Travel Summary (noted 2026-06-13 · NOT built)

**Trigger (user scenario):** a route already **includes a longtail** (bundled). The salesperson **upsells an upgrade** on the day and asks the guide to **collect extra cash (COT)**. Example: upgrade list price **2000**; customer **pays 1300 extra**; the **700 difference** = value of the already-included longtail, which gets **credited against the agent bill** — but **NOT immediately**. The deduct-vs-keep-separate decision is made later in the **Travel Summary** settlement step.

**✅ Part 1 — Upgrade RECORD (DONE 2026-06-13):** `bk.upgrades[]` + manage modal (`bkV2UpgradeOpen`/`Render`/`Save`/`EditLoad`/`Delete` · presets `BKV2_UPGRADE_PRESETS` w/ Longtail Private 2000·credit 700 · handling `BKV2_UPG_HANDLING` pending/deduct/separate). Manifest Add-on column got a "⬆ upgrade" button + purple chips (`upgradeChips` · shows paid amount + ⚠ when not collected · click = edit). Captures label · listPrice · baseValue(credit from package) · paidAmount(auto=list−base, editable) · handling · collected · note. Persists via `acctPersistBookings`. **Settlement of the diff still happens at Travel Summary (Part 2, not built).** Backup: `BACKUP/allotment_v2_20260613_pre_upgrade_feature.html`.

**What's needed (2 parts):**

**1. Upgrade record on the booking** (esp. longtail, but generic):
- New `bk.upgrades = [{id, item:'longtail'|'boat'|'seat'|..., label, listPrice, paidAmount, paidMethod:'cash'|'transfer', baseValue (the included/credited portion · e.g. 700), net (= paidAmount), handling:'deduct'|'separate'|'pending', collected:bool, collectedAt, by, note}]`.
- Captures: **จ่ายเท่าไหร่ (paidAmount=1300) · เน็ต/มูลค่าเต็ม (listPrice=2000) · ส่วนต่าง (baseValue=700 from included longtail)**.
- Surfaces in the manifest Add-on column + voucher detail; the **collected cash (1300)** flows like a COT/day-of extra; the **700 difference** is parked as `handling:'pending'` until reconciled.
- Distinct from the day-of `+ extra` (which is plain cash sale) — an upgrade also tracks the credited/base portion + bill impact.

**2. Settlement happens in Travel Summary (pending module):**
- Travel Summary = the **final per-trip reconciliation**: review CXL charges, no-shows, cash collected (COT + upgrades + extras), then decide **per amount → deduct from agent bill OR keep separate**.
- The 700 upgrade difference + any COT marked `deduct` resolve **here** (not at booking time) → then it actually adjusts the agent invoice (discount line) or is recorded as separate cash.

**Related gap to fix when building:** today `bk.cashOnTour.handling='deduct'` is **display-only** — it shows "Deduct from invoice" but never reduces the invoice in `acctCreateInvoice`/`acctBookingTotal`. Travel Summary should be where `deduct` amounts (COT + upgrade diff) actually post to the invoice (via a discount adjustment / credit line through `acctRecordPayment` / `priceBreakdown`).

**Interim workaround (today):** record the 1300 via `+ extra` ("Longtail upgrade", cash); for the 700, add a Review **discount adjustment −700** only once you've decided it reduces the bill (else leave it as a note until Travel Summary exists).

---

## 🛶 Add-on aggregates in the By-trip-date summary (noted 2026-06-13 · NOT built)

**Where:** the family-card boat grid + the per-variant trip card (`bkV2RenderTab2` · the `.t2-vcard`/`.t2-vbrow` per-boat rows + the `agg[boatId]` aggregation that today only sums pax + guide langs + special meals).

**Want:** alongside "เรือกี่ลำ · กี่คน · ไกด์อะไร · อาหารอะไร", also show **add-on counts per trip/boat**, e.g.:
- **Longtail Join** — how many pax took it (sum pax of bookings with `bk.addOns` type `longtail-join`, or bundle longtail).
- **Longtail Charter (เหมา)** — how many boats (count bookings/allocations with type `longtail-charter`).
- (extendable) Private transfer counts, day-of extras / upgrades that need prep, etc.

**Data sources:** `bk.addOns[]` (`{type}` = `longtail-join` · `longtail-charter` · `transfer-…`), forced bundle via `rt.routeBundles[route].longtail`, plus on-tour `SB_EXTRAS` / `bk.upgrades[]` (longtail upsell). Reuse `_rtNormalizeLongtail` / `_rtLongtailForRoute` if pricing needed (display is just counts).

**Build outline:** in the `grp2.forEach` aggregation (family grid) and the per-variant `agg` loop, add counters `ltJoinPax`, `ltCharterBoats`, etc. per boat (and per variant), then render small chips in the boat row / variant footer like the guide/food chips (`.t2-dchip`). Keep it a count summary (no money) so ops can prep longtails/charters.

**Why:** dispatch needs to know how many longtail seats / charter boats to arrange per trip — currently add-ons are only visible per-booking in the manifest Add-on column, not summarized at the trip/boat level.

---

## 📊 Cost-per-head & PFM (price-vs-cost) module — monthly P&L input + per-agent margin (noted 2026-06-14 · NOT built)

**Status:** Idea parked · noted from chat · build later

**Concept (จากผู้ใช้):** ทุกสิ้นเดือน **P&L** จะออกมาพร้อม **ต้นทุนต่อหัว (cost per head) ของแต่ละเส้นทาง**. ต้องการ **Section สำหรับอัพเดท/ใส่ตัวเลขต้นทุน** เข้ามาในระบบ แล้วเอามา **เปรียบเทียบกับราคาที่แต่ละเอเจ้นส่งมาในเดือนนั้นๆ** เพื่อดู **PFM (profit margin / performance)** ว่าราคาขายอยู่ **เหนือต้นทุนมากแค่ไหน**. การคำนวณต้อง **รวม FOC, CXL (cancellations) และทุกอย่างที่เกี่ยวข้อง** (ที่นั่งฟรี + ยกเลิก + ส่วนลด/extra) ลงไปด้วย — เพราะ FOC/CXL ทำให้ "ต้นทุนจริงต่อหัวที่ขายได้" สูงขึ้น (เฉลี่ยต้นทุนไปบนหัวที่จ่ายเงินจริง).

**Motivation:** วันนี้ดูได้แค่ยอดขาย/pax/FOC แยกกัน (Sales tab + FOC detail) แต่ **ไม่รู้กำไรจริง** เพราะไม่มีต้นทุนต่อหัวในระบบ → ตัดสินใจเรื่องราคา/โปรโมชัน/ปล่อย FOC ให้เอเจ้นไหนได้ไม่เต็มที่.

**Scope (phased · ร่าง):**
- **P1 · Cost input section** — หน้า/แท็บใส่ **ต้นทุนต่อหัวต่อเส้นทางต่อเดือน** `SB_ROUTE_COSTS[YYYY-MM][routeId] = {costPerHead, note, source:'pl'|'manual', enteredAt, enteredBy}` (LS key `sb_route_costs` · read-modify-write · persist fn). อาจแยกประเภทต้นทุน (น้ำมัน/อาหาร/อุทยาน/ลูกเรือ/คงที่) แล้วรวมเป็น cost/head หรือใส่ยอดรวมก็ได้.
- **P2 · PFM compare** — ต่อเอเจ้น (หรือต่อ rate type) ต่อเดือน: ดึง **ราคาขายเฉลี่ยต่อหัว** ที่เอเจ้นส่งมา (จาก bookings เดือนนั้น) เทียบกับ cost/head → margin ฿ + %. ต้อง **เฉลี่ยต้นทุนบนหัวที่จ่ายเงินจริงเท่านั้น** (paying pax) ขณะที่หัวทั้งหมด (รวม FOC) กินต้นทุน → effective cost/paid-head = `cost/head × totalHeads(รวม FOC) ÷ payingHeads`. รวมผลของ CXL (ที่นั่งที่จองแล้วยกเลิก · มี/ไม่มีค่าปรับ) + discount/extra/commission ด้วย.
- **P3 · Margin dashboard** — ตาราง/บาร์: เอเจ้นไหน margin ดี/บาง, เส้นทางไหนกำไรดี, เดือนต่อเดือน. ธงเตือนเมื่อ **ราคาขาย ≤ ต้นทุน** (ขาดทุน) หรือ margin บางกว่าเกณฑ์.

**Data model (ร่าง):**
```js
SB_ROUTE_COSTS = {
  '2026-06': {
    r10: { costPerHead: 850, breakdown:{fuel:0,park:0,food:0,crew:0,fixed:0}, note:'from June P&L', source:'pl', enteredAt:'...', enteredBy:'RM' }
  }
}
// PFM per agent/month (derived, not stored):
//   paidPax, totalPax(incl FOC), cxlPax, sellTotal, avgSellPerPaid = sellTotal/paidPax
//   effCostPerPaid = costPerHead * totalPax / paidPax   (FOC dilutes)
//   marginPerPaid = avgSellPerPaid − effCostPerPaid ;  marginPct = margin/avgSell
```

**ของที่มีอยู่แล้วใช้ต่อได้:** ราคาขาย/pax/FOC ต่อเอเจ้น (mdTabSales `A`/`focAg`), discount/extra (`priceBreakdown`), CXL (`cancelCategory`/`partialCancels` + cancel report), invoices/payments (accounting). **ที่ยังขาด = ต้นทุนต่อหัว** (ต้องมี input section นี้).

**Workaround จนกว่าจะสร้าง:** ทำใน Excel นอกระบบ — export ยอดขาย/pax/FOC ต่อเอเจ้นจาก Sales tab แล้วเทียบ cost/head จาก P&L มือ.

---

## (placeholder for next backlog items)

When new features get parked, add them here following the same pattern:
- Status
- Motivation
- Scope (phased if large)
- Data model proposal (if applicable)
- Workaround until built
