# LAM-77 — intentional exceptions found during characterization

LAM-77's acceptance criteria ask this pass to "identify any intentional
exceptions before modular extraction." The items below are real
inconsistencies this pass found in `allotment_v2/allotment_v2.html` while
writing the characterization tests. **None of them are fixed here** — LAM-77
is characterize-only. Each is backed by an executable/source-scan assertion in
this directory so a future refactor can see, at a glance, whether it changed
this specific behavior on purpose or by accident.

---

## 1. Three different "is this booking closed?" status lists exist side by side

**Where:** `allotment_v2/allotment_v2.html`, asserted in
`cancelled-status-aggregates.test.mjs`.

CLAUDE.md documents a single global invariant: cancelled statuses excluded
from every aggregate are `['cancelled','cancelled_weather','rejected']`. That
list is indeed the majority pattern (≥10 call sites across seat-pool math,
Boat Operation, and manifest rendering). But two other lists exist:

- `bkV2DetailCancel`, `bkV2EditBooking`'s "already X, edit anyway?" prompt, and
  the Booking-detail `canCancel` computation all use
  `['cancelled','completed','rejected']` — this **omits `cancelled_weather`**
  and **adds `completed`** (a status the other list never mentions).
- The very next line in the same function, `canEdit`, uses only
  `['cancelled','rejected']` — two items, missing both `cancelled_weather`
  *and* `completed`.

**Observable effect:** on the Booking detail screen, a `cancelled_weather`
booking is treated as "still cancellable" (`canCancel` sees it as open, since
its 3-item list doesn't include `cancelled_weather`) *and* as "still editable"
(`canEdit`'s 2-item list also doesn't include it) — while a `completed`
booking is "not cancellable" but *is* editable, and a `rejected` booking is
neither. These three yes/no flags, computed a few lines apart in the same
function, do not agree with each other or with the seat-math definition of
"closed."

**Suggested follow-up:** decide the one correct definition of "closed" per UI
action (cancel vs edit vs seat-pool) and either unify the three lists or
document explicitly why they must differ. Track as a follow-up ticket before
any modular extraction of the booking-detail screen.

---

## 2. `bkPendHoldsSeat` only gates the seat-pool math, not the boat-assignment pax counts

**Where:** `getSeatsConsumed` (gated) vs `baAssignedPax` / `baAssignedBookings`
/ `getBookingsForRouteDate` (not gated). Asserted in
`cancelled-status-aggregates.test.mjs`.

An over-capacity `pending_approval` booking (one where a manager hasn't
approved the overage yet) is defined by `bkPendHoldsSeat` as *not yet holding
a real seat* — correctly, since the seat doesn't exist until approved. That
rule is consulted in exactly one place that matters functionally:
`getSeatsConsumed`, which feeds `getAllotment`'s sellable-pool math. It is
**not** consulted by `baAssignedPax` / `baAssignedBookings` (Boat Operation's
"how many pax are on this boat today" figures) or by
`getBookingsForRouteDate` (the seat-mode displacement list).

**Observable effect:** the same over-capacity pending booking shows as 0 seats
consumed in the trip's sellable-pool figure, but full headcount in Boat
Operation's per-boat pax counter and in the displacement modal's list — two
different numbers, both technically correct for what each screen answers, but
easy to misread as a bug when comparing them side by side.

**Suggested follow-up:** either extend `bkPendHoldsSeat` gating to the
Boat-Op pax counters too, or add a short comment at each of those three call
sites explaining why they deliberately don't gate it (matching the
already-documented pattern at `getSeatsConsumed`'s call site).

---

## 3. The anti-overbook guard silently skips a route/date with no boat assigned at all

**Where:** the tiered guard inside `bkV2CommitBooking`
(`allotment_v2.html`, search `Anti-overbook guard (tiered)`). Asserted in
`seat-locks.test.mjs`.

`if(!al || !al.hasAllotment) return;` — a trip on a route/date that has no
boat in Boat Operation yet skips every tier of the guard (lock-violation
block, over-cap approval, license block) and saves straight through,
regardless of pax count. This is explicitly commented in the source as
intentional (no allotment = nothing to check against yet), and this pass
agrees it reads as intentional, not accidental — but it means a booking can be
saved as `confirmed` for a route/date where Boat Operation later assigns a
boat too small for it, with no automatic re-check at assignment time. Flagged
here for visibility, not as a defect.

---

## 4. `save(area)` bypasses its own edit-guard entirely when called with no `area`

**Where:** `function save(area){ if(area && ... !laCanEditArea(area)) return; ... }`.
Asserted in `booking-persistence.test.mjs`.

Every internal/seed/migration call site that calls `save()` with no argument
skips the permission check by construction (`area &&` short-circuits). This
matches the source's own comment ("call ที่เป็น user แก้ ส่ง area มา ... call
ภายใน (seed · migration · โหลด) เรียก save() เปล่า → ไม่ถูก guard") — it is
already documented as intentional in the source itself. Restated here as a
verified behavior (not a new finding) because it is easy to assume from the
function's name alone that `save()` is always guarded.
