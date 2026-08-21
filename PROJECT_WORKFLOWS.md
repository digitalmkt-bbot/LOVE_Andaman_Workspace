# LOVE Andaman — Project Workflows

This document describes the current business and technical workflows of `allotment_v2`.

> **Current architecture:** Postgres (`operation_schemas.*`) is the durable source of truth. The browser keeps a working copy in RAM. Some older text in `README.md` and `SYSTEM_MAP.md` still describes `localStorage` as the durable store; that is no longer correct.

## 1. Main business workflow

The main workflow follows a tour from setup, through sale and operation, to financial and daily reporting:

```text
Master setup
  → Publish operating capacity
  → Create/import booking
  → Validate, price and confirm
  → Collect/track payment
  → Prepare boat and transfer assignments
  → Re-confirm and prepare documents
  → Van check-in
  → Pier check-in
  → Travel Summary
  → Accounting and Daily Report
```

The central business record is a **Booking**. A trip is identified primarily by:

```text
Route × Travel date × Boat
```

The Program module defines the route, Boat Operation supplies capacity, Booking sells seats, Operations moves the guests, and Accounting tracks the money.

---

## 2. Workflow steps

### Step 1 — Configure master data

This is prerequisite setup rather than a task repeated for every booking.

1. **Programs / routes**
   - Define route, operating season, pier and departure details.
   - A route must be operating on the selected date before a normal booking can be confirmed.
2. **Boat and fleet setup**
   - Register boats, capacities, legal seat limits and current status.
   - Maintain transfer vehicles and their capacities/zones.
3. **Pickup setup**
   - Configure pickup zones, areas, hotels/points and route pickup times.
4. **Rate Types and add-ons**
   - Configure seat, charter and add-on prices by route and zone.
   - Define validity periods and route bundles.
5. **Agent or B2C channel**
   - Bind each B2B agent to a Rate Type.
   - Set payment terms, VAT mode, credit limit, sales owner and contract programs.

**Output:** the system knows what can be sold, to whom, at what price, and with which pickup/financial terms.

### Step 2 — Publish operating capacity

In **Boat Operation**:

1. Select a travel date.
2. Assign available boats to routes.
3. Mark each boat run as a normal seat trip or charter.
4. Review available capacity after bookings and seat locks.
5. If weather prevents operation, mark the relevant Route × Date as weather-cancelled.

Sellable seats are derived as:

```text
Available boat capacity − confirmed seat consumption − locked seats
```

Charter boats are excluded from the general seat pool.

**Output:** Booking can calculate live availability for each Route × Date.

### Step 3 — Create or import a booking

Bookings can originate from:

- a B2B agent;
- a B2C/OTA channel;
- direct or walk-in entry;
- staff/welfare entry.

The booking form normally captures:

1. Agent or channel and applicable Rate Type.
2. Route, date and booking mode (`seat` or `charter`).
3. Passenger counts, names and nationalities.
4. Lead passenger and contact details.
5. Pickup zone, area, hotel, pickup point and transfer requirements.
6. Add-ons, discounts, extras and adjustments.
7. Voucher/reference and payment information.

The quote is calculated from the bound Rate Type, including seat/charter rates, bundles and add-ons. B2C or manual-price records can use an externally supplied price.

### Step 4 — Validate and commit the booking

Before saving, the application performs these checks:

1. **Required data** — source, trip, pax, lead name, nationality, rate and operational details.
2. **Route availability** — rejects a normal booking on a non-operating date.
3. **Duplicate warning** — checks voucher/reference and lead name + trip/date.
4. **Agent contract warning** — warns if the route is outside the agent’s configured programs.
5. **Seat-lock handling** — confirms the seats to draw and prevents silent use of another held pool.
6. **Capacity checks**:
   - within company booking cap → may confirm;
   - above company cap but within licensed seats → saved as `pending_approval`;
   - above the boat’s licensed seats → hard blocked;
   - consuming locked seats without a valid draw → hard blocked.
7. **Commercial approval** — discounts and other controlled conditions can route the booking to approval.
8. **Audit history** — creation, edits and later actions are appended to `history[]`.

Typical status path:

```text
Quote/draft → Confirmed
            ↘ Pending approval → Approved/Confirmed
                               ↘ Rejected
Confirmed → Cancelled / Weather-cancelled / Rescheduled
```

**Output:** a priced booking with capacity consumption, lock draws, customer details and an audit trail.

### Step 5 — Accounting and payment

After booking confirmation:

1. Create an invoice or pro-forma invoice according to the agent’s payment type.
2. Apply VAT according to the agent’s VAT mode.
3. Record full or partial payments.
4. Apply deposits where applicable.
5. Track outstanding balance and receivables.
6. For invoice-credit agents, the confirmed unpaid booking consumes credit.
7. Fully paying the covering invoice, or cancelling the booking, releases that credit exposure.

For **pro-forma (PFM)** bookings, the Daily PFM workflow is:

1. Review bookings travelling on the selected date.
2. Issue the PFM if needed.
3. Record payment.
4. At the day-before 18:00 cutoff, identify unpaid bookings.
5. A responsible user chooses **Approve travel** or **Hold**.

### Step 6 — Pre-operation preparation

Use the Booking **By-trip-date** view as the operational manifest.

#### 6.1 Boat assignment

1. Turn on Boat Assign mode.
2. Assign each seat booking to a boat already scheduled in Boat Operation.
3. Review pax versus boat capacity.
4. Use auto-assignment if appropriate, then review it.
5. Record an approved/emergency upgrade when a booking moves to another boat/route.

Assignment is saved under the booking’s operational state (`ops.boatId`).

#### 6.2 Van assignment

1. Turn on Van Assign mode.
2. Split oversized bookings into allocations when required.
3. Manually select booking/allocation rows and create van groups.
4. Assign one vehicle to each group; one group represents one outbound van.
5. Set final pickup times, including hotel-level overrides.
6. Assign a different return van when required.
7. Review self-arrival and self-return records, which are excluded from the relevant job order.
8. Print the Van Job Order from the dedicated Van Jobs page.

The system does not guess a vehicle. Conflicting/mixed assignments should be surfaced for a dispatcher to resolve.

#### 6.3 Re-confirmation and document readiness

1. Re-confirm the final pickup details with the agent/customer.
2. Record the method/status and timestamp.
3. Check required booking documents in Document Check.
4. Prepare insurance, manifests and operational documents.
5. Resolve missing or warning-marked booking information before travel.

### Step 7 — Operation day

#### 7.1 Van check-in

1. Open the selected operation date.
2. Work from the van/group assignments.
3. Record actual passengers and check-in events.
4. Record no-shows, cancellations or exceptions.
5. Pass the resulting expected count to Pier Check-in.

#### 7.2 Pier check-in

1. Receive the count from Van Check-in.
2. Handle guests who arrive directly at the pier.
3. Verify guests and booking proof.
4. Record final actual pax and operational exceptions.
5. Collect or record applicable on-site/COT money and supporting evidence.
6. Confirm boat/wristband details and produce crew-facing boat documents as required.

Operational check-ins are stored in the booking’s date-aware `ops` state so booking identity and pricing are not overwritten.

### Step 8 — Travel Summary and Daily Report

In **Travel Summary**:

1. Select the operation date and, optionally, route/VAT filters.
2. Review booked pax, actual travelled pax, no-shows and cancellations.
3. Review Van and Pier Check-in events.
4. For each exception, explicitly decide the result; the system suggests but does not decide for the user.
5. Record charge amount, postponement/reschedule or another resolution, with user and timestamp.
6. Reconcile on-site money and unresolved evidence/slips.

In **Daily Report**:

1. Review the day’s overview, passenger, boat, van and financial sections.
2. Print or export the report to PDF.
3. Compose/copy/download an email report for management or operations recipients.

**Output:** the final operational and financial view of what actually happened that day.

---

## 3. Exception workflows

### 3.1 Manager approval

```text
Booking exceeds company cap or has a controlled commercial condition
  → Save as pending approval
  → Manager reviews
  → Approve and confirm, or reject
```

A booking cannot override the vessel’s licensed passenger limit.

### 3.2 Weather cancellation

```text
Boat Operation marks Route × Date cancelled
  → Affected bookings become “awaiting weather resolution”
  → Notify agent/customer
  → Resolve each booking as:
       reschedule | refund | account credit | weather cancellation
  → Release cancelled seats and update accounting/history
```

### 3.3 Normal cancellation or reschedule

1. Select the booking and reason/category.
2. Record full or partial cancellation, or move the travel date.
3. Recalculate/release seat consumption as applicable.
4. Update invoice, refund, credit or deposit treatment.
5. Preserve the event in booking history.

### 3.4 Fleet disruption

1. Boat status changes to fixing/unavailable, or an incident/maintenance job is opened.
2. Boat Operation reviews affected runs.
3. Reassign a vessel or adjust capacity.
4. Re-check booking approvals, boat assignments and manifests.
5. Use emergency upgrade/reassignment only as an explicit user action.

---

## 4. Technical data workflow

### 4.1 Application startup

```text
Browser opens the app
  → GET /api/me authenticates the session and loads permissions
  → GET /api/load assembles current relational data from Postgres
  → Full working state is placed in browser RAM
  → UI modules load their arrays/maps from that RAM state
```

If cloud load fails in production, the UI blocks editing and retries. Localhost may degrade to the old local-only path when no API exists, but that is not the production architecture.

### 4.2 Save workflow

```text
User changes a record
  → Existing module persist helper updates the shared in-RAM state
  → Auto-save waits approximately 1 second
  → Client diffs current state against the loaded BASE snapshot
  → laDiffToOps converts the diff into record-level REST operations
  → POST /api/v1/_batch sends all operations in one transaction
  → Server writes operation_schemas tables
  → app_state.version increments
  → Other clients are notified and refresh when safe
```

If a state key is missing from the REST mapping, the client falls back to legacy `POST /api/save`. This is a compatibility path and should be treated as mapping drift, not the normal workflow.

### 4.3 Concurrency and safety

- IDs are generated to be safe across multiple users/tabs.
- Field-level patches allow concurrent edits to different fields of the same record.
- A transaction applies each batch atomically.
- Version checks detect when another user has saved newer data.
- The client does not refresh over an open form, active input, modal or unsaved local edit.
- Empty/unusable state is never sent as a save.
- Server shrink guards block suspicious mass deletion/data loss.
- Pending changes are flushed on page close/reload when possible.
- Business records are not persisted to real browser `localStorage`; only small UI/version preferences are.

---

## 5. Supporting workflows

These workflows support the main booking-to-operation pipeline:

- **Fleet management:** boat status → incidents/maintenance → parts/assets → service hours/costs → return to available status.
- **Transfer fleet:** vehicle registry → daily route assignment → van groups → job orders → utilization view.
- **Sales management:** agent setup → Rate Type/contract → booking history → renewal/additional services.
- **Demand/market intelligence:** booking date + travel date + frozen market snapshot → lead-time and market analysis.
- **Document workflow:** booking documents/attachments → pre-check → insurance/manifest/voucher outputs.
- **Fuel/consumables:** operational requisition and fuel records → fleet/accounting analysis.

## 6. Short version

The shortest useful description of the project’s main workflow is:

1. Configure routes, rates, agents, pickup points, boats and vans.
2. Schedule boats to create capacity.
3. Enter or import a booking.
4. Validate availability, locks, legal capacity, price and approval rules.
5. Confirm and invoice/collect payment.
6. Assign boat and van; finalize pickup and re-confirm.
7. Check guests into the van and then at the pier.
8. Record who actually travelled and resolve no-shows/cancellations/charges.
9. Produce accounting and daily operational reports.
10. Persist each change transactionally to Postgres and refresh other users safely.
