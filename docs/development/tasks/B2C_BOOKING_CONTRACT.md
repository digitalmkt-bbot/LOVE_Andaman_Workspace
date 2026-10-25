# B2C → Ops booking contract

**Audience:** the B2C / CS booking team.
**Purpose:** what ops (rsvn.loveandaman.com) reads from a B2C booking line, who owns which field, how CS should edit bookings, and what extra data ops wants.
**Status:** 2026-09-30. Sections 1–4 describe how the importer behaves today. Section 5 lists proposed additions that ops will not read until the importer is updated.

---

## 1. How a B2C line becomes an ops booking

Ops pulls B2C `booking_items` in the background (b2c-sync). The unit of import is **one line, not one order**.

- Each line with `type IN ('day_trip','private_own','transfer','third_party')` becomes **its own ops booking** with the id `b2c_<booking_id>_<line_no>`.
- A line that disappears from an order is **cancelled** in ops (the order must still be present in the sync).
- Only lines whose source data changed are re-imported.

## 2. Charter vs. seat

| B2C `booking_mode` | Ops `trip.bookingMode` | Meaning in ops |
|---|---|---|
| `trip` | `seat` | Shared day trip. Uses up seats in the route's seat pool. |
| `private_charter` | `charter` | Whole boat. Kept out of the seat pool, and ops assigns the boat. |

Ops does not read `booking_mode` directly today. It works out charter from `type === 'private_own'`, or from a `PR-…` product/route id. For both values above this gives the same answer, so there is nothing to change. Keep `booking_mode` consistent with `type` anyway: if the two ever disagree, ops follows `type`.

## 3. Who owns what

### 3.1 B2C owns these fields. Edit them in B2C; ops is overwritten on every sync.

| Area | Fields |
|---|---|
| Lead guest | name, phone, email, nationality |
| Product | travel date, route/program, pax (adult/child/infant/FOC, Thai/foreign), charter vs. seat |
| Pickup / drop-off | `details.pickupZone` (`PK` \| `KL` \| `RN` \| `NoTransfer`, exact casing), `details.pickupLocation` (area name from the zone's dropdown), `details.noTransfer`, `details.dropoffSame`, drop-off location |
| Money | subtotal, discounts, payment type, paid, deposit, balance. **Ops can never override these.** |
| Notes | special request, remark |
| Status | see 3.3 |

Ops does not read `details.pickupHotel` at all. Ops dispatches by **area** (`pickupLocation`), so that field must be one of the dropdown values and not a typed address.

### 3.2 Ops owns these. B2C must not try to set them; they survive every sync.

- The actual boat running the trip (B2C only sends a boat **category**, e.g. `PB-001`)
- Van assignment, van groups, splits, pickup time
- Pier and van check-in results, no-shows
- Ops' manual correction of the pickup/drop-off area match
- Ops-side approval

### 3.3 Status

- **Cancelling in B2C always reaches ops.** Set the line or order to cancelled, or remove the line.
- **Un-cancelling in B2C cannot revive a booking that ops cancelled.** Ask ops.
- Once ops has approved a booking, a B2C status change will not move it back to pending.

## 4. How CS should change a booking

**Rule: CS makes every customer-facing change in B2C.** Changes made on the ops side to the fields in 3.1 are overwritten at the next sync. The ops page embedded for CS is read-only by design.

| Change | Do this | Why |
|---|---|---|
| Guest details, pax, pickup, notes, price | Edit the line in B2C | Flows through automatically |
| Travel date | Edit in B2C, **then tell ops to re-check the boat** | Ops keeps the boat and van already assigned to that line, and nothing checks that the boat is free on the new date |
| Seat ↔ charter (`trip` ↔ `private_charter`) | **Cancel the line and add a new one** with the other product. Do not edit it in place. | Different product, price, and boat logic. An in-place edit carries the seat line's assignment into a charter. |
| Cancel one line of a multi-line order | Cancel or remove that line only | The other lines are unaffected |
| Cancel the whole order | Cancel in B2C | Every line is cancelled in ops |

### ⚠ Never renumber `line_no` on an existing order

`line_no` is part of the ops booking id. If a line's number changes (for example, line 2 becomes line 1 after line 1 is deleted), ops sees the **old booking cancelled and a brand-new one created**. Every assignment and check-in on it is lost. When a line is removed, leave the remaining numbers as they are, even if that leaves gaps.

✅ **Done by B2C (2026-09-30):** `line_no` now keeps its gaps and is never renumbered.

## 5. Additional data in `details`

Put new data in `details` (jsonb). Ops already receives the whole object, so a new key only needs an importer change on our side. A new top-level column needs more work. **Tell ops before shipping any new key.** Until the importer reads a key, ops ignores it.

| Key | Status | Type | When B2C sends it | What ops does |
|---|---|---|---|---|
| `details.opsRouteId` | ✅ **Ops already reads it.** Day trips send it; B2C was asked 2026-09-30 to send it on **private lines too** | string, an **ops** route id (`r5`, `r10`, …), not `PR-…` | Every line, including `private_own`. Backfill existing private lines. | Sets the trip's route. Without it a private line only resolves if its `PR-` id is in ops' hardcoded map (`PR-001`…`PR-004`); anything else arrives with **no route** and shows as "undefined" in By trip. |
| `details.prevTravelDate` | ✅ **B2C sends it** (2026-09-30) · ⏳ ops importer not reading it yet | `YYYY-MM-DD` | Whenever a line's travel date changes. Holds the date it moved **from**. | Will flag the booking for a boat/van re-check instead of silently keeping the old assignment. Until then, CS still tells ops about date changes by hand. |
| `details.opsBoatId` | Proposed | string, an **ops** boat id (ask ops for the list; **not** `PB-…`) | Charter lines only, when CS already knows the exact vessel | Pre-assigns the boat. Ops can still override it. |
| `details.pickupAreaId` | Proposed (see 5a, Q2) | string, an ops `sb_pickup_areas.id` | Every line with a pickup | Matches the pickup area by id instead of by name |

Anything else CS needs to tell ops should go in the same `details` object. Agree the key name with ops first.

## 5a. Questions from B2C, and ops' answers

### Q1. Does a 0-pax line count as cancelled?

**No. Cancel a line explicitly: set its status to cancelled, or remove it from the order.** Both of those already cancel the line in ops.

Ops will not work out a cancellation from the pax count. Today the importer has no special case for 0 pax: the line arrives as a booking with no passengers and keeps whatever status B2C sent. So a 0-pax line left as `confirmed` stays live in ops. It shows up on the day's lists with nobody on it, and any boat or van already assigned to it stays assigned. A pax count can also pass through 0 in the middle of an edit, and ops should not cancel a booking because of that.

### Q2. Should the pickup-area list live on the server so both sides use the same one?

**Yes. Make the ops list the single source, and have B2C send the area id.**

- **Master list:** ops' `sb_pickup_areas` (`id`, `name`, `zone` `PK`/`KL`, `region`, `timeGroup`). Ops dispatches vans and sets pickup times by these areas, and staff maintain them in Pickup Setup. So B2C should read this list, not keep its own copy.
- **What B2C sends:** `details.pickupAreaId` (the ops id), plus `pickupLocation` (the name) as it does today.
- **What ops does:** matches on the id first. It falls back to today's name matching only for older rows that have no id.

**Why the name matching isn't enough:** today ops normalises the name and looks for an exact match inside the line's zone. Failing that, it tries a substring match, and that only counts if exactly **one** area matches. So any rename, typo, or area that exists on one side only leaves the booking with no pickup area until someone fixes it by hand.

**Still to agree:** how B2C reads the list (a read-only ops endpoint, or reading the table directly), and how often it refreshes its dropdown.

## 6. Checklist for the B2C team

- [ ] `booking_mode` is only `trip` or `private_charter`, and agrees with `type`
- [x] `line_no` is never renumbered on an existing order (gaps allowed, done 2026-09-30)
- [x] `details.prevTravelDate` is set on every travel-date change (done 2026-09-30)
- [ ] `pickupLocation` comes from the dropdown (area name), not free text
- [ ] `pickupZone` uses the exact literals `PK` / `KL` / `RN` / `NoTransfer`
- [ ] Seat ↔ charter changes are cancel + new line, never an in-place edit
- [ ] A line is cancelled by status or removal, never by setting pax to 0 (Q1)
- [ ] Date changes are followed by a message to ops (until the ops importer reads `prevTravelDate`)
- [ ] Pickup dropdown fed from the ops area list, and `details.pickupAreaId` sent (Q2, once agreed)
- [ ] New `details` keys are agreed with ops before they ship

## 7. Keys added by B2C 2026-10-23 (ops importer reads them from mapper v36)

| Key | Meaning | Ops behaviour |
|---|---|---|
| `details.dropoffZone` / `dropoffLocation` / `dropoffHotel` | Return leg as a dropdown **area name** + hotel. Written only when set. `dropoffLocation` is the copied "Hotel · Area" text when `dropoffSame:true`. | `dropoffSame:true` mirrors pickup. Otherwise area matched by name in `dropoffZone` (zone-free fallback) → `dropoffAreaId`/`dropoffArea`; `dropoffHotel` → `dropoffHotelName`. Rows without `dropoffZone`/`dropoffHotel` use the old free-text path. |
| `details.travellerUids` | uids on this line, `'lead'` = main customer; absent = everyone | `passengers` on that line filtered to those uids (uid read from `bookings.passengers[]` by position). Lead is never filtered. |
| `passengers[].uid` / `.lineNos` | stable id per person / server-computed lines | `uid` used; `lineNos` ignored (derivable). |
| `details.pickupAreaId` / `dropoffAreaId` | Not sent yet — B2C is waiting for our `sb_pickup_areas` id table. | Name matching until then. |

The "Travellers per trip — …" note is API-only and is not read.
