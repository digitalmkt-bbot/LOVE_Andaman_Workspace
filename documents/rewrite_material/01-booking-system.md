# 01 · Booking System — rebuild specification

> **Framework-neutral.** PostgreSQL 18 DDL, REST resource tables, JSON payload shapes, invariants
> and language-agnostic pseudocode. No framework code appears anywhere in this document by design:
> the implementer will use FastAPI, but nothing here should have to change if that decision changes.
>
> Written against commit `094dde1` on `refactor/booking-v2-migration`, verified against the
> production schema baseline captured 2026-08-20 (`db/baseline/`). Where a doc and the running code
> disagreed, the code won and the disagreement is recorded.
>
> Currency **Thai Baht (฿)** · Timezone **Asia/Bangkok (UTC+07:00)** · UI **Thai + English**.

---

## 0. How to read this document

**What this is.** A complete, buildable description of one domain — the booking system of a Phuket
marine day-tour operator — expressed as a relational schema, a REST surface, and a set of business
rules with their reasons. It is written for a developer who has never seen the existing system. Every
rule is stated here in full. Citations of the form `allotment_v2.html:76491` are **provenance only**:
they say where the rule was read from, not something you must go and open.

**What this is not.** It is not a port guide, not an API client manual, and not a description of the
existing code's structure. The existing system is one 83,000-line HTML file with all business logic in
browser JavaScript and a JSON-blob persistence layer. None of that shape survives. Where the current
behaviour is a bug rather than a rule, this document says so explicitly and specifies the correct
behaviour instead — see §12, which is a list of things you must **not** reproduce.

**Reading order.** §1–§3 are the domain. §4 (seat inventory) and §5 (pricing) are the two hard parts
and carry the most detail. §6 is every mutation. §9–§11 are what you build. §12–§13 are the traps.
§14–§15 tell you how to prove it works and in what order to do it.

**One paragraph: what a booking is in this business.**
A booking is one customer group, sold by one seller (a B2B travel agent, the company's own B2C
website, or a walk-in counter), travelling on one or more **trips**. A trip is a *(route, date)* pair
— "Similan on 2026-08-05" — carrying its own passenger mix and its own sales mode: either **seat**
(the group buys N seats on a boat shared with other groups) or **charter** (the group buys the whole
boat). The booking also carries hotel pickup details, add-on services, the money (frozen at the moment
of commit, never recomputed afterwards), an approval trail, and a container of operational
assignments — which boat, which van — that the boat-operations and van-dispatch parts of the business
write into and read back out. The booking is the unit that consumes seat inventory, the unit that is
invoiced, and the unit that appears on a boat's manifest on the morning of departure.

---

## 1. The business, in plain language

### 1.1 What the company sells

LOVE Andaman operates marine day tours out of Phuket and Phang Nga, southern Thailand. A customer
buys a seat on a speedboat or catamaran that leaves a pier early in the morning, visits islands, and
returns the same evening. Some products are overnight (an island stay with a return leg on a later
date). The fleet is roughly **16 vessels**.

**Routes** (the products). Each route has an id, a name, a home **pier**, and a season/operating
calendar that says which days it runs. The commercially important ones:

| Route | Pier | Note |
|---|---|---|
| Similan Islands | Tub Lamu (`tublamu`) | National park; closed in the monsoon season |
| Surin Islands | Tub Lamu | Same seasonal closure |
| Phi Phi Islands | Visit Panwa (`panwa`) | Year-round |
| Phang Nga Bay | Visit Panwa | Year-round |
| Whale Shark | Tub Lamu | Often sold with a bundled longtail-boat transfer |

The pier enum is exactly `tublamu` and `panwa` today, with `ranong` also present in the running code.
Never invent a pier string; the values are lowercase ids, not display names.

**Two sales modes per trip.**

- **Seat** — the group buys N seats out of the pooled capacity of whichever boats are deployed on
  that route that day. This is the normal case and it is what makes seat inventory hard.
- **Charter** — the group buys an entire boat for the day. A chartered boat leaves the seat pool
  entirely: its capacity is not sellable to anyone else, and the charter booking's own passengers do
  **not** consume seats, because they are not competing for any.

### 1.2 Who books

| Channel | Who they are | How they reach the system |
|---|---|---|
| **B2B agent** | A travel company that resells: destination management companies (DMCs), online travel agencies, hotel tour desks, street counters. This is the bulk of the business. | Staff enter the booking on the agent's behalf, from an email or voucher. An agent portal is planned. |
| **B2C website** | The company's own consumer website (a separate application whose data lives in the `love_kingdom` schema). | Writes its own bookings; they are copied into the ops system with an id prefixed `b2c_`. |
| **Walk-in** | A customer at the counter. | Booked against a house agent `WALKIN`, priced manually. |
| **Staff** | Company staff travelling on welfare or inspection trips. | Booked against a house agent `STAFF`; welfare prices from the rate card, inspection is a manual ฿0. |

Three **house agents** exist and behave like real agents in every aggregate: `a_walkin` (code
`WALKIN`), `a_staff` (code `STAFF`), `a_b2c` (name "Love Andaman", VAT mode `include`).

### 1.3 Why the price differs per agent

There is no single price list. Every agent is bound to exactly one **rate type** — a reusable price
package — through `agent.rate_type_id`. Many agents share one rate type (all Russian DMCs on one
card, for example), so changing a price on the card moves every agent bound to it.

A rate type prices a seat by **route × zone × passenger type**:

- **Zone** is where the customer is picked up from, because the transfer to the pier is baked into
  the seat price. `PK` = Phuket area, `KL` = Khao Lak area, `NoTransfer` = the customer makes their
  own way to the pier. Khao Lak is closer to Tub Lamu than Phuket is, so the same seat costs a
  different amount depending on where the van has to collect from — that is the entire reason zones
  exist.
- **Passenger type** splits by age band **and nationality**: adult/child/infant × foreign/Thai. Thai
  nationals pay a different (usually lower) price for the same seat — normal practice for Thai
  national-park tourism, where park entry fees are themselves dual-tier. Infants pay ฿0 but occupy a
  seat for safety-capacity purposes. **FOC** (free of charge) passengers pay ฿0 by agreement and also
  occupy real seats.

On top of seats a rate type carries: **charter rates** (a starter price that includes N passengers
plus a marginal per-passenger rate above that, per route per boat type), **forced bundles** (e.g.
"Whale Shark always includes the longtail-boat transfer"), and **optional add-ons** (longtail join,
longtail charter, private transfer).

### 1.4 How the customer gets to the boat

Most customers are collected from their hotel by **van** at 05:30–06:30 and driven to the pier. The
booking therefore carries a hotel name, a room number, and a **pickup area** (a named place such as
"Patong"), and the pickup area determines the zone, which determines the price. A booking can also be
**self-arrive** (`pickup_self`), in which case there is no van and normally no transfer charge.

Vans are assigned per day, grouped and sequenced. The return leg may use the same van or a different
one, or the customer may make their own way back. All of that lives in the **ops** container on the
booking (§7) and is owned operationally by the fleet/dispatch side of the business, not by sales.

### 1.5 How the money works

- **Pay type** per agent: `invoice` (credit — invoiced after travel, net N days), `proforma` (pay
  before travel), and counter/cash variants. Credit agents have a `credit_limit`, and exposure is the
  sum of confirmed, unpaid, credit-mode bookings.
- **VAT mode** per agent: `none`, `exclude` (7% added on top), `include` (7% already inside the
  price). Thai VAT is 7%.
- **The price is frozen.** When a booking is committed, the computed breakdown is written onto the
  booking and never recomputed. Changing a rate card tomorrow does not re-price yesterday's booking.
  Accounting reads the frozen number. §5.9 specifies exactly when a recalculation is allowed.

### 1.6 Seat locks — the commercial idea

A large agent negotiates a **seat allocation**: "hold me 20 seats on Similan every Saturday through
the high season". Those seats are removed from the general sellable pool and only that agent may take
them. If the agent has not used them by a cut-off (typically N days before departure at a given
time), the seats are **released** back into the general pool for that departure only, while the
allocation stays alive for later departures. Allocations can be split into named sub-groups (an
agent's sub-brands or sub-agents). This is §4 and it is the subtlest part of the system.

---

## 2. Core domain model

### 2.1 Entity narrative

A **Booking** is the aggregate root. It belongs to at most one **Agent** (null means the B2C
channel), and records the **Rate Type** that priced it. It has one or more **Booking Trips**; each
trip names a **Route**, a service date, a pickup zone, a sales mode, and its own passenger counts
broken out by type. It has zero or more named **Passengers** (the lead passenger is passenger #1 and
occupies a real seat of their own type), zero or more **Add-ons**, zero or more **Adjustments**
(discounts and extra charges), and exactly one frozen **Price Breakdown**.

Operational assignment lives in **Booking Ops**, keyed by *service date* — a multi-day booking has one
ops row per travel day. Everything that ever happened to the booking is appended to **Booking
History**. Cancellation, partial cancellation, rescheduling, weather resolution, capacity/discount
approval and FOC approval each have their own record.

Seat inventory is not owned by the booking. A **Seat Lock** belongs to a holder (an agent, the office,
or "global") and covers a route over a date scope. When a booking takes seats out of a lock, that
produces a **Booking Trip Lock Draw** row — and those rows, not any counter, are the truth about how
much of a lock is used.

```
                                 ┌──────────────┐
                       ┌────────►│    Agent     │◄──────┐
                       │         └──────┬───────┘       │
                       │                │ rate_type_id  │ holder_id
                       │                ▼               │
                       │         ┌──────────────┐  ┌────┴─────────┐
                       │         │  Rate Type   │  │  Seat Lock   │──┐ parent_id
                       │         └──────┬───────┘  └────┬─────────┘◄─┘
                       │  agent_id      │ seat rates    │
                  ┌────┴─────────┐      │ charter rates │
                  │   BOOKING    │◄─────┘ add-ons       │
                  └────┬─────────┘                      │
       ┌───────┬───────┼────────┬─────────┬─────────┐   │
       ▼       ▼       ▼        ▼         ▼         ▼   │
   ┌───────┐┌──────┐┌───────┐┌────────┐┌──────┐┌────────┴──┐
   │ Trip  ││ Pax  ││ Addon ││ Adjust ││ Ops  ││  History  │
   │ (1..n)││(0..n)││ (0..n)││ (0..n) ││(0..n)││   (0..n)  │
   └───┬───┘└──────┘└───────┘└────────┘└──┬───┘└───────────┘
       │  route_id → Route                │ boat_id → Boat
       │  booking_trip_pax per pax type   │ van_id  → Vehicle
       │                                  └─ read by boat-ops + van dispatch (§7)
       └─► Lock Draw ─► Seat Lock
   ┌─────────────────────────────────────────────────────────┐
   │ one-to-one / one-to-many satellites:                    │
   │ price_breakdown · cancellation · partial_cancel ·       │
   │ reschedule · approval · foc_approval · weather_resolve ·│
   │ alt_pickup · attachment · b2c_link · fee_item · upgrade │
   └─────────────────────────────────────────────────────────┘
```

### 2.2 Booking — every field

Legend for **Writer**: `sales` = reservation staff through the booking form · `mgr` = manager
approval action · `ops` = boat/van dispatch · `acct` = accounting · `sys` = server-generated ·
`b2c` = the consumer website's sync.

| Field | Type | Null? | Meaning | Writer |
|---|---|---|---|---|
| `id` | uuid | no | Surrogate primary key. New in this design. | sys |
| `code` | text | no | Human booking reference, unique. `BK-YYMMNNNN-XXXX`. §2.5. | sys |
| `schema_version` | smallint | no | `2` = native. `1` = legacy, read-only. §2.5. | sys |
| `status` | enum | no | §3. One of 8 values. | sales/mgr/sys |
| `agent_id` | uuid | yes | The selling agent. **Null means B2C.** | sales |
| `b2c_channel` | text | yes | Which consumer channel, when `agent_id` is null. | b2c |
| `rate_type_id` | uuid | yes | The rate card used to price this booking. A snapshot of `agent.rate_type_id` at booking time — it does not follow the agent if the agent is later rebound. Required unless `price_mode='manual'`. | sales |
| `sold_by` | text | yes | Salesperson credited. | sales |
| `voucher_ref` | text | yes | The agent's own reference. Used for duplicate detection. | sales |
| `booking_date` | date | no | The commercial booking date. **Editable** (staff correct it when entering a backlog). | sales |
| `booked_at` | timestamptz | no | When the record was actually created. **Frozen**, never editable. Drives lead-time analytics. | sys |
| `created_at` / `created_by` | timestamptz / text | no | Audit. | sys |
| `updated_at` / `updated_by` | timestamptz / text | yes | Audit. | sys |
| `lead_pax` | text | no | Lead passenger name. Required. | sales |
| `lead_nationality` | text | no | Required. Guessed from the name; staff may override. | sales |
| `lead_type` | enum `AD/CHD/INF` | no | The lead occupies a real seat of this type. | sales |
| `lead_foc` | boolean | no | The lead's seat is one of the FOC seats. | sales |
| `lead_phone` / `lead_email` | text | yes | Contact. | sales |
| `hotel_name` | text | yes | Required when a pickup area is set and the zone is not `NoTransfer`. | sales |
| `room_number` | text | yes | | sales |
| `pickup_area_id` | uuid | yes | FK to pickup area. Determines the zone, which determines the price. | sales |
| `pickup_zone` | enum `PK/KL/NoTransfer` | no | Denormalised from the area for pricing. | sales |
| `pickup_self` | boolean | no | Customer arrives at the pier unaided; no van. | sales |
| `dropoff_same` | boolean | no | Return to the same place. | sales |
| `dropoff_area_id` / `dropoff_hotel_name` | uuid / text | yes | Used when `dropoff_same` is false. | sales |
| `guide_en` / `guide_ru` / `guide_zh` | boolean | no | Guide languages required. At least one (or `guide_other`) is required for non-B2C bookings. | sales |
| `guide_other` | text | yes | Free-text language. | sales |
| `special_meals_veg` / `_vegan` / `_halal` | integer | no, default 0 | Counts. | sales |
| `special_meals_allergy_note` | text | yes | | sales |
| `large_luggage` | integer | no, default 0 | Pieces of oversized luggage (affects van loading). | sales |
| `cash_on_tour_amount` | numeric(12,2) | yes | Cash the guide must collect on the day. | sales |
| `cash_on_tour_currency` / `_handling` / `_note` | text | yes | | sales |
| `price_mode` | enum `rate/manual` | no | `manual` bypasses the pricing engine (walk-in, B2C). | sales |
| `manual_total` | numeric(12,2) | yes | The typed total when `price_mode='manual'`. | sales |
| `total` | numeric(12,2) | no | Denormalised copy of `price_breakdown.total`. Accounting's entry point. | sys |
| `purpose` | enum `sale/staff_welfare/staff_inspection` | no, default `sale` | | sales |
| `staff_id` / `staff_purpose` | uuid / text | yes | Required when `purpose` is a staff purpose. | sales |
| `payment_method` | enum `credit/prepaid` | no | Snapshot of the agent's pay type at booking time. | sys |
| `payment_net_days` | integer | no | Snapshot of the agent's credit days. | sys |
| `payment_source` | enum `contract/b2c/override` | no | Where the terms came from. | sys |
| `payment_contract_version` | text | yes | Snapshot of the agent's contract version. | sys |
| `payment_status` | enum `unpaid/invoiced/partial/paid` | no, default `unpaid` | | acct |
| `invoice_id` | uuid | yes | The invoice this booking is on. | acct |
| `market_snapshot_market` / `_sub` / `_agent_id` / `_at` | text / date | yes | The agent's market at booking time. **Frozen at create, never re-derived on edit** — analytics depend on the market as it was when the sale happened. | sys |
| `incomplete` | text[] | no, default `{}` | Soft-missing flags surfaced as ⚠ on the manifest: `pickup`, `guide-lang`, `route-closed`. Not blocking. | sys |
| `notes` | text | yes | Free-text operational notes. | sales |
| `version` | integer | no, default 1 | Optimistic-concurrency token, incremented on every write. §10.4. | sys |

Fields deliberately **not** carried into the new model, with reasons, are listed in §9.10.

### 2.3 Booking Trip — every field

| Field | Type | Null? | Meaning |
|---|---|---|---|
| `id` | uuid | no | PK |
| `booking_id` | uuid | no | FK, cascade delete |
| `trip_index` | smallint | no | Position in the booking. `(booking_id, trip_index)` unique. |
| `route_id` | uuid | no | FK to route |
| `service_date` | date | no | Local Asia/Bangkok calendar date of travel |
| `zone` | enum `PK/KL/NoTransfer` | yes | Pricing zone for this trip. Null ⇒ the trip cannot be priced. |
| `booking_mode` | enum `seat/charter` | no | |
| `charter_boat_id` | uuid | yes | Required when `booking_mode='charter'`. FK to boat. |
| `charter_price_mode` | enum `rate/manual` | no, default `rate` | |
| `charter_price_manual` | numeric(12,2) | yes | Overrides the rate card when mode is `manual`. |
| `charter_price_note` | text | yes | Why the manual price. |
| `charter_displacement_ack` | boolean | no, default false | Staff acknowledged that chartering this boat displaces existing seat bookings. |
| `pickup_time` | text | yes | Planned pickup window, e.g. `06:00-06:15`. Must be empty on an overnight return leg. |
| `ovn` | enum `return/self` | yes | Overnight: `return` = we bring them back, `self` = one-way. Null = not overnight. |
| `ovn_return_date` | date | yes | |
| `ovn_charge` | numeric(12,2) | yes | The overnight surcharge, billed on the **outbound** trip. |
| `ovn_leg` | boolean | no, default false | This trip *is* the return leg. Prices at ฿0. |
| `ovn_of_trip_id` | uuid | yes | The outbound trip this leg belongs to. |
| `subtotal` | numeric(12,2) | no | Frozen per-trip price at commit. |
| `legacy_pax_shape` | boolean | no, default false | Set on migrated v1 rows whose pax could not be split by nationality. |

**Passenger counts** are not columns on the trip. They are rows in `booking_trip_pax`:
`(booking_trip_id, pax_type, qty)` where `pax_type` is one of seven values —
`ad_fr`, `ad_th`, `chd_fr`, `chd_th`, `inf_fr`, `inf_th`, `foc`. This replaces a JSON object with 12
possible keys, five of which (`ad`, `chd`, `inf`, `foc_fr`, `foc_th`) are legacy shapes the old code
tolerated. §9.3 explains the normalisation.

> **Trap carried forward.** In the old shape a bare `ad` (no nationality suffix) is priced at the
> **foreigner** rate. On migration a legacy `ad: 3` becomes `ad_fr: 3` and the row is flagged
> `legacy_pax_shape` so the assumption is visible rather than silent.

### 2.4 The satellites

| Entity | Cardinality | Contents |
|---|---|---|
| `booking_passenger` | 0..n | `name`, `nationality`, `pax_type`, `is_foc`, `is_lead`, `position`. The list is sized to the **largest single trip**, not the sum of trips — a two-day booking for 4 people has 4 passengers, not 8. Rows with no name are dropped at commit. |
| `booking_addon` | 0..n | `addon_type` (§5.6), `label`, `unit_amount`, `qty`, `amount` (frozen), `note`. |
| `booking_adjustment` | 0..n | `kind` (`discount` \| `extra`), `mode` (`amount` \| `percent`), `value`, `label`, `note`. |
| `booking_price_breakdown` | 1..1 | `seat`, `addon`, `foc_discount` (**negative**), `discount` (**negative**), `extra`, `total`. §5.8. |
| `booking_ops` | 0..n | Keyed `(booking_id, service_date)`. §7. |
| `booking_history` | 0..n | Append-only: `at`, `kind`, `title`, `body`, `actor`, `tag`. |
| `booking_alt_pickup` | 0..n | Sub-groups of the party collected from a different place: `who`, `qty`, `area_id`, `zone`, `place`, plus a per-pax-type breakdown. Drives van splitting. |
| `booking_attachment` | 0..n | Uploaded documents (agent vouchers, passport scans). Binary lives outside the row. |
| `booking_fee_item` | 0..n | Post-hoc charges (reschedule fee, other). Added to the **invoice** total, not to `price_breakdown.total`. |
| `booking_upgrade` | 0..n | Day-of upgrades (a bigger boat, a better seat) recorded by ops. |
| `booking_cancellation` | 0..1 | §6.3 |
| `booking_partial_cancel` | 0..n | §6.5 |
| `booking_reschedule` | 0..n (latest wins) | §6.6 |
| `booking_approval` | 0..1 | §6.10 |
| `booking_foc_approval` | 0..1 | §6.9 |
| `booking_weather_resolve` | 0..1 | §6.7 |
| `booking_b2c_link` | 0..1 | §8.2 |
| `booking_trip_lock_draw` | 0..n per trip | §4 |

### 2.5 Booking identifiers — both formats found in live data

Two formats exist across the 2,870 production booking rows and both must be readable:

| Format | Shape | Example | How the sequence was made |
|---|---|---|---|
| **v2 (current)** | `BK-YYMMNNNN-XXXX` | `BK-26080001-K3QM` | `YYMM` from **local** time; `NNNN` = `MAX(existing sequence for this YYMM) + 1`; `XXXX` = 4 random base-36 characters upper-cased. |
| **v1 (legacy)** | `BK-YYMMDD-NNN-XXXX` | `BK-260805-014-8ZQR` | Date from a UTC timestamp — off by one day before 07:00 local; `NNN` = **count** of that day's bookings, so numbers are reused after a cancellation. |
| **B2C-sourced** | `b2c_<lkId>[_<n>]` | `b2c_BK-001_4` | Not generated here; see §8.2. |

**Why the random suffix is not decoration.** The sequence alone is not unique across concurrent
writers: two clients computing the same `MAX` produce the same code, and a record-level merge keyed on
the code silently overwrites one booking with the other. That has happened in production. Keep the
suffix.

**What the new system does about the two formats.**

1. `code` is a `text` column with a `UNIQUE` constraint. It stores whatever format the row has — v1
   codes are preserved byte-for-byte on migration.
2. New codes are **always** the v2 format, generated server-side inside the creating transaction.
3. The sequence comes from a real database sequence per `YYMM` (§9.2), not from a `MAX(...)+1` scan,
   so concurrency is the database's problem, not the application's. The random suffix is retained
   anyway: it is free, and it keeps codes unguessable, which matters once the agent portal exists.
4. `schema_version = 1` rows migrate into the same tables (a v1 booking becomes one booking with one
   trip) and are **read-only**: the API rejects any mutation on them with `409 LEGACY_READ_ONLY`,
   exactly as the current UI refuses to open them for editing. They still count for inventory,
   reporting and money.
5. **Nothing may parse meaning out of a code.** The date in a v1 code is wrong (UTC) and the sequence
   in both formats has gaps. Use `booked_at` and `booking_date` for dates.

---

## 3. Booking lifecycle / state machine

### 3.1 The eight statuses

There are exactly eight. In the production database they are free text with no constraint — the new
schema makes them a real enum or a `CHECK`.

| Status | Thai label | Meaning | Holds seats? | On aggregates? | Invoiceable? |
|---|---|---|---|---|---|
| `quote` | ใบเสนอราคา | A saved draft. Not sold yet. | **Yes** | Yes | No |
| `pending_foc` | รออนุมัติ FOC | Contains free-of-charge passengers; a manager must approve the giveaway. | **Yes** | Yes | No |
| `pending_approval` | รออนุมัติ | Held for manager sign-off. Reason matters — see §3.4. | **Conditional** | Yes, but shown separately | No |
| `confirmed` | ยืนยันแล้ว | Sold. The normal live state. | **Yes** | Yes | Yes |
| `cancelled` | ยกเลิก | Cancelled by customer, agent or operator. | No | **Excluded** | Fee invoice only |
| `cancelled_weather` | ยกเลิก (อากาศ) | Cancelled because the trip did not sail. Distinct because it is nobody's fault and drives refund/credit policy. | No | **Excluded** | Refund/credit only |
| `rejected` | ไม่อนุมัติ | A manager refused the FOC or the over-capacity/discount request. | No | **Excluded** | No |
| `completed` | เสร็จสิ้น | Travel finished and closed. | No | Historical | Already invoiced |

> **The cancelled-status rule, stated once and applied everywhere.**
> `cancelled`, `cancelled_weather` and `rejected` are excluded from **every** passenger count, every
> revenue figure, every seat-consumption calculation, every duplicate check, every lock-usage
> calculation and every manifest. There is no aggregate anywhere in the system that includes them.
> Any new query that touches bookings must apply this filter; §9.9 gives a view that applies it once
> so downstream code cannot forget.

> ⚠ **`completed` is currently unreachable.** Verified against the code: no booking path ever sets
> `status = 'completed'`. It exists in the type, is guarded against (edit and cancel both refuse a
> `completed` booking), and has a display label — but nothing writes it. See Open Question **OQ-1**.
> The recommendation is to implement it as a scheduled close after the last service date, because
> several downstream rules ("cannot edit a completed booking") already assume it exists.

### 3.2 Transition table

Every legal transition. Anything not listed is illegal and must return `409 ILLEGAL_TRANSITION`.

| # | From | To | Trigger | Actor | Side effects |
|---|---|---|---|---|---|
| T1 | — | `quote` | Save draft | sales | Draw lock seats; freeze price; write history. No invoice. |
| T2 | — | `confirmed` | Submit, all guards pass, no FOC, no discount | sales | Draw locks; freeze price; hold charter boat; write history; stamp `confirmed_by/at`. |
| T3 | — | `pending_foc` | Submit with any FOC passenger | sales | As T2, plus create `foc_approval` with status `pending` and a mandatory reason. |
| T4 | — | `pending_approval` | Submit over company cap (within licence), **or** discount > 0 on a confirm, **or** a B2C hold, **or** a closed-day sale | sales / b2c | As T2, plus create `approval` with `reason` and `target_status`. Seat holding depends on the reason (§3.4). |
| T5 | `quote` | `confirmed` / `pending_foc` / `pending_approval` | Re-submit through the same guard gauntlet | sales | Return old lock draws, take new ones (§4.8). Re-freeze the price. |
| T6 | `confirmed` | `quote` | Save-as-draft on a sold booking | sales | Requires an explicit confirmation; writes a history line. Invoice is untouched — this does not un-invoice anything. |
| T7 | `pending_foc` | `confirmed` | FOC approved | mgr | `foc_approval.status='approved'`, stamp approver + time. Reason is **mandatory**; approval is refused without one. |
| T8 | `pending_foc` | `rejected` | FOC rejected | mgr | `foc_approval.status='rejected'` + reason. Release lock draws and charter hold (it is now a cancelled-class status). |
| T9 | `pending_approval` | `confirmed` (or `approval.target_status`) | Approve | mgr | Approver name **mandatory**. Recompute and show the seats-after-approval impact before committing. Over-licence rows require a second confirmation. |
| T10 | `pending_approval` | `rejected` | Reject | mgr | Release lock draws and charter hold. |
| T11 | `quote` / `pending_*` / `confirmed` | `cancelled` | Cancel with a reason category | sales / mgr | §6.3: void invoice, optionally raise a cancellation-fee invoice, return **all** lock draws, release charter hold. |
| T12 | any non-cancelled with a matching trip | `cancelled_weather` | Weather resolution with outcome `refund`, `credit` or `cancel` | ops / sales | §6.7. Return lock draws, release charter hold, void invoice, create refund or credit. |
| T13 | `cancelled` / `cancelled_weather` / `rejected` | `confirmed` | Restore | sales / mgr | §6.4: re-draw lock seats (may come back short — report the shortfall, do not hide it), re-take the charter hold only where the boat/day is still free, void any cancellation-fee invoice. |
| T14 | `confirmed` | `completed` | Last service date has passed and the day is closed | sys | See OQ-1. No seat or money effect. |

Transitions **not** allowed, and why:

- `cancelled → cancelled`, `completed → anything`, `rejected → cancelled`: nothing to do; return 409.
- `cancelled_weather → cancelled`: a weather cancellation is a different commercial event and must not
  be laundered into a customer cancellation. Restore first (T13), then cancel (T11), so the history
  shows both steps.
- Direct `quote → cancelled_weather`: weather only touches bookings tagged by a weather event.

```
                        ┌────────── T6 (explicit confirm) ──────────┐
                        ▼                                            │
   ┌──────────┐   T5   ┌───────────────┐  T7   ┌───────────┐         │
   │  quote   │──────► │ pending_foc   │─────► │ confirmed │─────────┘
   └────┬─────┘        └──────┬────────┘       └─────┬─────┘
        │ T1 create           │ T8                   │ T14
        │                     ▼                      ▼
        │              ┌──────────┐            ┌───────────┐
        │              │ rejected │            │ completed │
        │              └────┬─────┘            └───────────┘
        │  T4               │ T13
        ▼                   │
   ┌──────────────────┐  T9 │      ┌────────────────────┐
   │ pending_approval │─────┼─────►│     cancelled      │◄── T11 from quote /
   └────────┬─────────┘     │      └─────────┬──────────┘    pending_* / confirmed
            │ T10           │                │ T13
            ▼               │                ▼
        rejected ───────────┘        ┌────────────────────┐
                                     │ cancelled_weather  │◄── T12
                                     └────────────────────┘
```

### 3.3 Side effects by category

For every transition, the four things that can move:

| Category | What moves |
|---|---|
| **Seat inventory** | Entering a cancelled-class status (`cancelled`, `cancelled_weather`, `rejected`) releases the trip's seats **and** returns its lock draws. Leaving one (restore) re-takes both, best-effort, with an explicit shortfall report. |
| **Charter hold** | A charter trip reserves a whole boat for a route+date. Committing takes the hold, cancelling releases it, rescheduling moves it, editing releases the old hold before taking the new one. |
| **Money** | Cancel voids the invoice and may raise a cancellation-fee invoice. Weather refund creates a negative payment; weather credit creates a deposit. Restore voids the cancellation-fee invoice. Reschedule may add a fee item and top up the existing invoice. **Every one of these must be in the same transaction as the status change** — see §12 bug B-07. |
| **Audit** | Every transition appends exactly one `booking_history` row in the same transaction, with the actor, the reason and the machine-readable `kind`. There is no transition without a history row. |

### 3.4 `pending_approval` and the seat-holding rule

This is the single least obvious rule in the state machine and it changes availability across the
whole system.

> A `pending_approval` booking holds seats **unless** it was held for **over-capacity**.

The reason: an over-capacity hold, by definition, asks for seats that do not physically exist yet. If
those seats were counted as consumed, `seats_available` would go negative and would suppress sales
that are genuinely possible. Every other hold reason — discount awaiting a salesperson's sign-off, a
B2C sync hold, a sale on a closed day — is asking for seats that *do* exist, so those seats are
reserved while the approval is pending.

Machine rule:

```
holds_seats(booking) :=
    booking.status != 'pending_approval'
    OR NOT (approval.over_rows_count > 0 OR approval.total_over > 0)
```

`approval.total_over` is the number of seats the booking exceeds the company cap by, summed across
trips. `over_rows_count` is how many *(route, date)* pairs are over. Either being non-zero marks the
hold as an over-capacity hold.

### 3.5 The approval record

| Field | Type | Meaning |
|---|---|---|
| `status` | `pending` / `approved` / `rejected` | |
| `reason` | text | `over_capacity`, `discount`, `over_capacity+discount`, `b2c_hold`, `closed_day` |
| `target_status` | booking status | What to become on approval. Defaults to `confirmed`. |
| `total_over` | integer | Sum of `over_by` across all over-capacity rows. |
| `discount_amount` | numeric(12,2) | ⚠ Not persisted today — see §12 bug B-09. |
| `sales_name` | text | The salesperson who must sign off a discount. ⚠ Not persisted today. |
| `requested_by` / `requested_at` | text / timestamptz | |
| `approved_by` / `approved_at` | text / timestamptz | Approver name is **mandatory** on approve. |
| `note` | text | |
| child `booking_approval_over` | 0..n | Per over-capacity trip: `route_id`, `service_date`, `route_name`, `need`, `cap_free`, `over_by`, `licence_free`. |

**Impact preview.** Before an approve is committed, the API must be able to answer "what does
availability look like *after* this approval?" — recompute availability for each affected
*(route, date)* **excluding this booking's own seats**, and return the numbers. If any row is over the
licensed seat count, the approve requires a second, explicit confirmation flag in the request body
(`acknowledge_over_licence: true`), because approving it puts more people on a boat than the boat is
registered to carry.

**Synthesised approvals.** A booking can arrive at `pending_approval` from an external writer (a B2C
hold) with no approval record at all. The API must create a `pending` approval record on demand,
inferring the reason, rather than presenting a queue row whose buttons do nothing. That was a real
bug; the fix is to make the approval record mandatory at write time — `status='pending_approval'`
without an approval row must be rejected with `422`.

---

## 4. Seat inventory and allotment

This is the hardest part of the system and the part that must never be wrong. Read all of it.

### 4.1 What a seat pool is

There is no per-boat seat map. Inventory exists at the level of **(route, service date)** and is
created by *deployment*: each morning's schedule assigns boats to routes for a date. The pool for
Similan on 2026-08-05 is the sum of the capacities of the boats deployed on Similan that day, minus
the boats on that route that are chartered.

Deployment lives outside booking — it is the boat-operations domain's data — but booking reads it.
The contract booking needs is:

```
deployed_boats(route_id, service_date) -> [ { boat_id, capacity, is_charter, charter_booking_id } ]
```

`capacity` is the **effective** capacity for that boat on that date: the boat's normal booking cap,
overridden by a per-day capacity override if one exists, and clamped so it never exceeds the boat's
licensed passenger count.

If no boat is deployed, there is no pool: `has_allotment = false` and nothing is sellable. That is a
different state from "sold out" and the UI must be able to tell them apart.

### 4.2 `cap` versus `licence_pax` — two capacities, both real

Every boat carries two numbers and they mean different things.

| | `cap` (commercial booking cap) | `licence_pax` (legal seat count) |
|---|---|---|
| What it is | The number of seats the company chooses to sell on that boat | The number of passengers the vessel is **registered** to carry |
| Who sets it | Commercial management | The marine authority, on the vessel's certificate |
| Why lower | Comfort, service quality, luggage, crew working space, a deliberate buffer for walk-ups and no-shows | — |
| Exceeding it | Possible with **manager approval**; the booking is parked at `pending_approval` | **Never**. Hard block, no override, for anybody, including an administrator |

`cap` is a business decision that a manager may overrule. `licence_pax` is a legal and safety limit
that no role in the system may overrule. That is why both exist and why the guard has two tiers.

When a boat has no `licence_pax` recorded, fall back to `cap` — never treat a missing licence figure
as unlimited.

### 4.3 The availability calculation

This is the exact algorithm, ported from the running code. Every consumer of availability must get
its answer from this one place.

```
FUNCTION availability(route_id, service_date, exclude_booking_id = NULL):

  deployed := deployed_boats(route_id, service_date)
  IF deployed is empty:
      RETURN { has_allotment: false, state: 'not_deployed', ...all zeros }

  total_capacity   := 0    # Σ cap over all deployed boats
  charter_capacity := 0    # Σ cap over chartered boats
  licence_total    := 0    # Σ licence_pax over all deployed boats
  charter_licence  := 0    # Σ licence_pax over chartered boats

  FOR each boat IN deployed:
      lp := boat.licence_pax IF boat.licence_pax > 0 ELSE boat.capacity
      total_capacity += boat.capacity
      licence_total  += lp
      IF boat.is_charter:
          charter_capacity += boat.capacity
          charter_licence  += lp

  # Chartered boats leave the seat pool entirely.
  available_capacity := total_capacity   - charter_capacity
  licence_capacity   := licence_total    - charter_licence

  seats_consumed := seats_consumed(route_id, service_date, exclude_booking_id)   # 4.4
  locked_seats   := locked_total(route_id, service_date)                         # 4.7

  seats_available   := MAX(0, available_capacity - seats_consumed - locked_seats)
  licence_available := MAX(0, licence_capacity   - seats_consumed)

  fill_pct := available_capacity > 0
              ? ROUND((seats_consumed + locked_seats) / available_capacity * 100)
              : 0

  state := available_capacity <= 0 AND charter_capacity > 0 ? 'all_chartered'
         : seats_available <= 0                             ? 'full'
         : fill_pct >= 80                                   ? 'tight'
         :                                                    'open'

  RETURN { has_allotment: true, total_capacity, charter_capacity,
           available_capacity, licence_capacity, seats_consumed, locked_seats,
           seats_available, licence_available, fill_pct, state,
           deployed_boats: deployed }
```

Points that are easy to get wrong:

- `licence_available` subtracts **only** `seats_consumed`, not `locked_seats`. Locked seats are a
  commercial reservation, not a physical constraint — a locked seat is still a real seat that exists
  on the boat. This asymmetry is deliberate and load-bearing for the guard tiering in §4.9.
- `seats_available` clamps at 0. Never surface a negative number; use `state` to say why it is zero.
- `exclude_booking_id` exists so a booking never blocks itself when it is being edited (§4.9).

### 4.4 Seats consumed

```
FUNCTION seats_consumed(route_id, service_date, exclude_booking_id):
  total := 0
  FOR each booking b:
      IF b.id = exclude_booking_id:                       CONTINUE
      IF b.status IN ('cancelled','cancelled_weather','rejected'): CONTINUE
      IF NOT holds_seats(b):                              CONTINUE     # §3.4
      FOR each trip t IN b.trips WHERE t.route_id = route_id
                                   AND t.service_date = service_date:
          IF t.booking_mode = 'charter':                  CONTINUE     # §4.5
          seat := SUM(t.pax[*])          # all seven pax types, infants and FOC included
          seat := MAX(0, seat - checkin_losses(b, service_date))
          total += seat
  RETURN total
```

Three sub-rules, each with its reason:

1. **Infants and FOC passengers consume seats.** They pay ฿0 but they physically occupy a place and
   they must appear on the manifest and the insurance list. Never price them and never omit them from
   capacity.
2. **Check-in losses are subtracted.** On the morning of travel, the pier records no-shows and on-site
   cancellations. Those people are not aboard, so their seats become sellable again for that
   departure. `checkin_losses(booking, date)` is owned by the pier/check-in domain and returns a head
   count. Booking consumes it read-only.
3. **`holds_seats`** applies the `pending_approval` rule from §3.4.

### 4.5 Charter trips and the seat pool

Two independent things happen when a trip is `charter`:

1. **The trip's passengers consume no seats.** They are not competing for the shared pool; they have
   bought the whole boat. `seats_consumed` skips them.
2. **The boat leaves the pool.** Its capacity is subtracted from `available_capacity`, so nobody else
   can be sold onto it.

The second only takes effect if the charter hold is actually recorded against the boat for that date.
That is the `charter_boat_id` on the trip plus a deployment record marking the boat as chartered. A
booking that has picked a charter boat but has not yet committed (`status='quote'`) does not hold the
boat.

**Split charters.** A large charter group can be spread over two hulls. The second hull must also
leave the pool. Derive chartered hulls from the **bookings** (`charter_boat_id` plus any recorded
boat split), not only from the deployment flag — a split charter historically flagged only its first
hull, and the second hull was resold as seats.

**Displacement.** Choosing to charter a boat that already carries seat bookings displaces those
customers. The API must return the list of affected bookings and require an explicit
`charter_displacement_ack: true` before it will accept the write. It does not move those bookings
automatically; a human decides.

### 4.6 Seat locks — the data model and the commercial rules

A **seat lock** is an agreement that N seats on a route are reserved for a holder.

| Field | Type | Meaning |
|---|---|---|
| `id` | uuid | |
| `route_id` | uuid | The lock is always route-specific. |
| `scope` | `day` / `bulk` / `month` | How its date coverage is expressed. |
| `lock_date` | date | Used when `scope='day'`: exactly this date. |
| `date_from` / `date_to` | date | Used when `scope='bulk'`: an inclusive range. |
| `month_from` / `month_to` | text `YYYY-MM` | Used when `scope='month'`: expands to the 1st of `month_from` through the last day of `month_to`. |
| `dow` | smallint[] | Days of week the lock covers (0=Sunday). Empty means every day. |
| `holder_type` | `agent` / `office` / `global` | Who may draw from it. |
| `holder_id` | uuid | The agent, when `holder_type='agent'`. |
| `parent_id` | uuid | Self-reference. A lock with a parent is a **sub-group**. |
| `sub_name` | text | The sub-group's label. |
| `qty` | integer | Seats held **per departure**, not in total. |
| `release_days_before` | integer | Rolling release: N days before each departure. |
| `release_time` | time | The time of day on that day. |
| `status` | `active` / `depleted` / `expired` | |
| `reason`, `created_at`, `created_by` | | |
| child `seat_lock_log` | | Append-only audit of create / draw / return / release / expire. |

**Who may draw.** A booking for agent A may draw from: locks held by agent A, locks held by `office`,
and locks held by `global`. It may never draw from another agent's lock.

**Parent and sub-group.** A parent lock of 20 seats may be carved into sub-groups (e.g. "Bangkok
desk" 8, "Phuket desk" 6), leaving 6 unallocated on the parent. The rules:

- A **child contributes 0** to the pool reduction. Only parent and standalone locks reduce the
  sellable pool. Counting children as well would double-count the parent's seats and silently remove
  them from sale twice. This is invariant **I-04** in §11.
- A booking draws from a *source*, and the sources for a parent-with-children are: each child (up to
  the child's own remaining), plus the parent's **unallocated remainder** (parent `qty` minus the sum
  of children's `qty`, minus what the parent itself has already drawn).
- A parent may not draw more than its unallocated remainder — its allocated seats belong to the
  children.

**Rolling release, not a global expiry.** This is the rule most often got wrong.

```
release_cutoff(lock, trip_date) :=
    NULL if lock has neither release_days_before nor release_time
    else (trip_date − release_days_before days) at release_time, in Asia/Bangkok

released_for(lock, trip_date) := now() >= release_cutoff(lock, trip_date)
```

A lock that is released **for one trip date** stops holding seats for that departure only. It remains
`active` and continues to hold seats for every later date in its range. A `bulk`/`month` lock must
never carry a single global `expiry` — it expires only when its **whole range** has passed. A range
lock that was wrongly marked `expired` while its range is still open must be reactivated.

**Per-departure quota.** `qty` is per departure. A 20-seat bulk lock covering 30 Saturdays holds 20
seats on each of those 30 Saturdays, not 20 seats in total. Usage is therefore counted per
*(lock, trip_date)*.

> ⚠ **Verified schema gap.** The production `sb_seat_locks` table has **no columns** for `date_from`,
> `date_to`, `dow`, or the per-date used counter. `bulk`-scope locks therefore lose their range on
> every round-trip through the database, and per-departure usage is not persisted at all. See §12
> bug **B-10** and Open Question **OQ-2** — this must be checked against live data before migration,
> because it changes what the current numbers mean.

### 4.7 The pool reduction — what `locked_seats` actually is

```
FUNCTION locks_for(route_id, trip_date):
    RETURN every lock L where
        L.route_id = route_id
        AND L.status = 'active'
        AND date_covered(L, trip_date)          # by scope: exact day / range / month range
        AND (L.dow is empty OR dow_of(trip_date) IN L.dow)
        AND NOT released_for(L, trip_date)

FUNCTION drawn(lock, trip_date):
    # THE SOURCE OF TRUTH: sum of live lock-draw rows. Never a stored counter.
    RETURN SUM(d.qty)
           FROM booking_trip_lock_draw d
           JOIN booking_trip t ON t.id = d.booking_trip_id
           JOIN booking b      ON b.id = t.booking_id
           WHERE d.seat_lock_id = lock.id
             AND t.service_date = trip_date
             AND b.status NOT IN ('cancelled','cancelled_weather','rejected')

FUNCTION family_drawn(lock, trip_date):
    RETURN drawn(lock, trip_date) + Σ drawn(child, trip_date) for each child of lock

FUNCTION pool_hold(lock, trip_date):
    IF lock.parent_id IS NOT NULL: RETURN 0          # children live inside the parent
    RETURN MAX(0, lock.qty - family_drawn(lock, trip_date))

FUNCTION locked_total(route_id, trip_date):
    RETURN Σ pool_hold(L, trip_date) for each L IN locks_for(route_id, trip_date)
```

The key insight: **a lock reduces the pool only by what is still unused.** Drawing a seat from a lock
moves it from `locked` to `consumed`; the two are never double-counted. When a lock is fully drawn its
pool hold is 0 and the seats appear as `seats_consumed` instead.

### 4.8 Drawing and returning

Per trip the booking records `seat_source = { locked: N, general: M }` where `N + M` equals the trip's
passenger total, plus the concrete draw rows that produced `N`.

**Drawing at commit:**

1. If the staff member picked explicit sources (a map of `lock_id → qty`), draw exactly those,
   clamped to each source's remaining and to the trip's passenger total.
2. If they picked nothing but asked for `locked: N`, fill greedily by holder priority
   **`agent` → `office` → `global`**, so an agent burns their own allocation before eating the
   office's.
3. Write one `booking_trip_lock_draw` row per source actually drawn.
4. Set `seat_source.locked` from what was **actually drawn**, not from what was requested. Requesting
   6 and getting 4 must leave `locked=4, general=pax−4`.

**Returning.** `return_all_draws(booking)` deletes every draw row belonging to the booking's trips.
Because `drawn()` is derived, deleting the rows *is* the return; there is no counter to decrement.

**When each happens:**

| Event | Action |
|---|---|
| Create | Draw. |
| **Edit** | **Return everything first, then draw again.** Without this, editing a booking ten times counted its lock usage ten times. |
| Cancel / reject | Return. |
| Restore | Re-draw from the recorded draws; take whatever is still available and **report the shortfall** in the response and in history. Do not silently give back less. |
| Partial cancel | Return the draws for the removed passengers, proportionally. ⚠ Today it does not — §12 bug **B-02**. |

**Unused-lock reminder.** If a booking's agent has drawable lock seats on a trip's *(route, date)* and
the booking draws none, the API returns an advisory warning (not a block) listing the unused capacity.
Selling from the general pool while the agent's own allocation sits idle is usually a mistake.

### 4.9 The guard hierarchy — four tiers, in this exact order

Run per seat-mode trip. `need` is the number of **general** seats required after the booking's own
lock draws:

```
pax        := SUM(trip.pax[*])
need       := pax − MIN(lock_draw_total(trip), pax)
a          := availability(trip.route_id, trip.service_date, exclude = this booking's id)
old_need   := 0
IF editing:
    prev := the same booking's previous trip for this (route, date), seat mode
    IF prev exists: old_need := prev.pax_total − MIN(prev.lock_draw_total, prev.pax_total)

IF need <= a.seats_available:            → FITS, no guard fires
IF need <= old_need:                     → FITS (edit did not increase demand)

physical_free := a.seats_available + a.locked_seats     # cap − consumed, ignoring locks
licence_free  := a.licence_available

IF need <= physical_free:                → LOCK_VIOLATION   (hard block)
ELSE IF need <= licence_free:            → OVER_CAP         (approval)
ELSE:                                    → LICENCE_BLOCK    (hard block)
```

| Tier | Condition in words | Result | Override? |
|---|---|---|---|
| **Fits** | Enough general seats | Save at the requested status | — |
| **Lock violation** | Not enough general seats, but there would be if you counted somebody else's locked seats | **Hard block, HTTP 409 `LOCK_VIOLATION`** | **None.** Not for staff, not for an administrator. The remedy is to draw the lock, add a boat, or release the lock. |
| **Over cap** | Over the company booking cap, still within the licensed seats | Save as `pending_approval` with `approval.reason='over_capacity'` | Manager approval |
| **Licence block** | Over the licensed seats — the boat physically/legally cannot carry them | **Hard block, HTTP 409 `LICENCE_BLOCK`** | **None.** Add a boat first. |

**Why "edit only guards an increase".** Changing a hotel name on a booking that already sits on a
now-full day must still save. The booking legitimately holds the seats it already has. Only a genuine
increase in `need` is guarded, and availability is always computed with the booking's own seats
excluded so it can never block itself.

**Discount tier.** Independently of capacity, a save at `confirmed` with a total discount > ฿0 is
forced to `pending_approval` with reason `discount`, because the salesperson responsible for the
agent must sign the discount off. If both fire, the reason becomes `over_capacity+discount`.

### 4.10 The relational replacement

Three structural changes replace the whole class of drift bugs.

**(a) `used` becomes a derived view.** There is no `used` column and no `used_by` map. Delete them.
The repair utilities that exist today to reconcile the counter against reality
(`bkV2LockAudit`, `bkV2LockCoverage`, `bkV2LockFixUsed`, `bkV2LockFixTree`) are **not ported** —
there is nothing left to repair.

```sql
-- One row per (lock, departure date) that a live booking actually drew from.
CREATE VIEW v_seat_lock_drawn AS
SELECT d.seat_lock_id,
       t.service_date,
       SUM(d.qty)::int AS drawn
FROM   booking_trip_lock_draw d
JOIN   booking_trip t ON t.id = d.booking_trip_id
JOIN   booking      b ON b.id = t.booking_id
WHERE  b.status NOT IN ('cancelled','cancelled_weather','rejected')
GROUP  BY d.seat_lock_id, t.service_date;

-- Family roll-up: a parent absorbs its children's draws.
CREATE VIEW v_seat_lock_family_drawn AS
SELECT COALESCE(l.parent_id, l.id) AS root_lock_id,
       v.service_date,
       SUM(v.drawn)::int           AS drawn
FROM   v_seat_lock_drawn v
JOIN   seat_lock l ON l.id = v.seat_lock_id
GROUP  BY 1, 2;

-- The pool reduction for one lock on one departure date.
-- Only roots (parent_id IS NULL) contribute; children return 0 by construction.
CREATE VIEW v_seat_lock_hold AS
SELECT l.id                AS seat_lock_id,
       l.route_id,
       d.service_date,
       GREATEST(0, l.qty - COALESCE(f.drawn, 0))::int AS hold
FROM   seat_lock l
CROSS  JOIN LATERAL seat_lock_dates(l) AS d(service_date)   -- 4.10(b)
LEFT   JOIN v_seat_lock_family_drawn f
       ON  f.root_lock_id = l.id
       AND f.service_date = d.service_date
WHERE  l.parent_id IS NULL
  AND  l.status = 'active'
  AND  NOT seat_lock_released_for(l, d.service_date);       -- 4.10(b)

-- What availability subtracts.
CREATE VIEW v_route_day_locked AS
SELECT route_id, service_date, SUM(hold)::int AS locked_seats
FROM   v_seat_lock_hold
GROUP  BY route_id, service_date;
```

**(b) Two small immutable functions carry the date logic.**

```sql
-- Expand a lock into the departure dates it covers, honouring scope and day-of-week.
CREATE FUNCTION seat_lock_dates(l seat_lock)
RETURNS TABLE (service_date date)
LANGUAGE sql IMMUTABLE AS $$
  SELECT g::date
  FROM generate_series(
         CASE l.scope WHEN 'day'   THEN l.lock_date
                      WHEN 'bulk'  THEN l.date_from
                      WHEN 'month' THEN (l.month_from || '-01')::date END,
         CASE l.scope WHEN 'day'   THEN l.lock_date
                      WHEN 'bulk'  THEN l.date_to
                      WHEN 'month' THEN (date_trunc('month',(l.month_to||'-01')::date)
                                         + interval '1 month - 1 day')::date END,
         interval '1 day') g
  WHERE l.dow IS NULL
     OR cardinality(l.dow) = 0
     OR EXTRACT(dow FROM g)::smallint = ANY (l.dow);
$$;

-- Has this lock already released its seats for this specific departure?
CREATE FUNCTION seat_lock_released_for(l seat_lock, d date)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN l.release_days_before IS NULL AND l.release_time IS NULL THEN false
    ELSE (now() AT TIME ZONE 'Asia/Bangkok')
         >= ((d - COALESCE(l.release_days_before,0)) + COALESCE(l.release_time,'00:00'::time))
  END;
$$;
```

`seat_lock_released_for` is `STABLE`, not `IMMUTABLE`, because it reads the clock — it therefore
cannot be indexed. For a long date horizon, materialise `v_route_day_locked` per query window rather
than scanning every lock; §9.8 gives the indexes.

**(c) Overselling becomes impossible with four concurrent writers.**

Browser-side guards are decoration once B2C, the ERP and an agent portal can write. The check and the
insert must be atomic. Use an explicit per-departure serialisation row:

```sql
CREATE TABLE route_day_inventory (
  route_id      uuid NOT NULL REFERENCES route(id),
  service_date  date NOT NULL,
  version       bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (route_id, service_date)
);
```

Every write path that changes seat demand for a *(route, date)* follows this shape:

```
BEGIN;
  -- 1. Serialise every writer for these departures. Lock in a deterministic order
  --    (route_id, service_date) so two multi-trip bookings can never deadlock.
  INSERT INTO route_day_inventory (route_id, service_date)
       VALUES (...each affected pair...)
  ON CONFLICT DO NOTHING;

  SELECT 1 FROM route_day_inventory
   WHERE (route_id, service_date) IN (...)
   ORDER BY route_id, service_date
     FOR UPDATE;

  -- 2. Now recompute availability. Nothing can change underneath it.
  --    Run the §4.9 tiering. Reject or downgrade to pending_approval here.

  -- 3. Write booking, trips, pax, draws, price breakdown, history.
  --    Lock draws are inserted inside the same transaction, so the derived
  --    `drawn` view is consistent the instant the transaction commits.

  UPDATE route_day_inventory SET version = version + 1 WHERE (route_id, service_date) IN (...);
COMMIT;
```

Why a lock row rather than `SERIALIZABLE`: the availability calculation reads a wide set of rows
(every booking on that route+date, every lock), so `SERIALIZABLE` would produce frequent
serialisation failures and force a retry loop under normal load. A single narrow row per departure is
cheap, deterministic, and makes the contention visible.

Complementary database-level defences:

- `CHECK (qty >= 0)` on every pax and draw quantity.
- `UNIQUE (booking_trip_id, seat_lock_id)` on draws, so a booking can never hold two rows against the
  same lock for the same trip.
- A `CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED` on `booking_trip_lock_draw` asserting that
  after every statement, `family_drawn(lock, date) <= lock.qty`. This is the backstop that catches a
  code path that forgot to take the row lock.

**Acceptance for this section:** N parallel create requests against a departure with N−1 free seats
must produce exactly N−1 successes and one clean `409`. Run it 100 times. Anything else means step 1
was skipped somewhere.

---

## 5. Pricing

Everything needed to reimplement the price of a booking without guessing.

### 5.1 Rate types — what they are

A **rate type** is a reusable price package. An agent is bound to exactly one through
`agent.rate_type_id`; many agents share one card. The booking records which card priced it
(`booking.rate_type_id`) as a snapshot — rebinding the agent tomorrow does not re-price yesterday's
bookings.

| Field | Type | Meaning |
|---|---|---|
| `id`, `code`, `name`, `note`, `colour` | | `code` is auto-generated as `SALESOWNER-RATENAME`, uniquified with `-2`, `-3`… |
| `owner_sales_id` | uuid, nullable | Which salesperson owns the card. Null = shared across the team. |
| `active` | boolean | Inactive cards cannot be **newly assigned** and are hidden from the public availability API, but they still price bookings already bound to them. |
| `valid_from` / `valid_to` | date | Card-level fallback validity. **Display only** — see the warning below. |
| `nationality_scope` | `both` / `thai` / `fr` | Which nationality columns are shown. Presentation only; it does not change any calculation. |
| child `rate_type_route` | | The routes this card covers. |
| child `rate_type_seat_rate` | | route × zone × pax type → price. §5.2 |
| child `rate_type_route_validity` | | route → `{from, to}`. **The source of truth for a route's active period.** §5.3 |
| child `rate_type_route_bundle` | | route → forced longtail bundle. §5.4 |
| child `rate_type_charter_rate` | | route × boat type → `{starter_price, starter_includes, extra_per_pax}`. §5.5 |
| child `rate_type_addon` | | Optional add-on pricing. §5.6 |
| child `rate_type_price_tier` | | `sell` / `min_sell` layers. **Never used for money** — printed on the contract PDF only. |

> ⚠ **Validity dates never gate a price.** Neither `valid_from`/`valid_to` nor `route_validity` is
> consulted when a trip is priced. An expired rate type still prices a booking. Only `active = false`
> removes a card from *pickers* and from the public availability endpoint. This is current behaviour
> and it is intentional (staff need to price a late-entered backlog against the card that was in force
> when the sale happened), but it is surprising. Preserve it, and state it in the API docs. Open
> Question **OQ-4** asks whether it should become a warning.

> ⚠ **`price_tier.sell` and `.min_sell` compute nothing.** They exist so the printed agent contract
> can show a recommended selling price and a floor. Do not wire them into any calculation.

### 5.2 Seat rates

Shape: **route → zone → pax type → price in whole ฿**.

**Zones** — exactly three, and they are a closed set:

| Zone | Meaning |
|---|---|
| `PK` | Phuket-area pickup. The transfer to the pier is inside the seat price. |
| `KL` | Khao Lak-area pickup. Different transfer distance, therefore a different price. |
| `NoTransfer` | No transfer; the customer reaches the pier themselves. |

**Pax types on the rate card** — four priced cells per zone:

| Cell | Applies to booking pax types |
|---|---|
| `adult_fr` | `ad_fr` (and a legacy bare `ad`) |
| `child_fr` | `chd_fr` (and a legacy bare `chd`) |
| `adult_thai` | `ad_th` |
| `child_thai` | `chd_th` |

Infants (`inf_fr`, `inf_th`) and FOC (`foc`) have **no priced cell**: they are always ฿0 in the seat
total, and always counted for capacity. (The production child table does carry `*_infant_*` columns,
but nothing reads them — see §9.10.)

**The fr/th split.** `fr` = foreigner, `th` = Thai national. Thai nationals pay a lower price for the
same seat because Thai national-park entry fees are themselves dual-tier and because the domestic
market is priced separately. A single booking routinely mixes both — a Thai guide accompanying five
Europeans — so the split is per passenger, not per booking.

**Two ways a zone can have no price, and they mean different things:**

| Stored value | Meaning | Displayed as |
|---|---|---|
| `NULL` row (explicitly marked) | **No offer.** The company deliberately does not sell this route from this zone on this card. | "No Offer" |
| No row at all | **Not set.** Nobody has filled it in yet. | "Not Set" |

Both are treated as *no rate* by the engine, and both must produce an explicit `no_rate` result with
a reason, never a silent ฿0. A third case behaves the same way: if **both** adult rates in a zone are
0, treat it as no-rate with reason `both adult rates are 0`. A ฿0 adult seat is not a real product.

### 5.3 `route_validity` — the active period

`rate_type_route_validity[route] = { from, to }` is the **source of truth** for when a route is
sellable on this card. Charter rates and add-on rates inherit it — they have no dates of their own and
display the inherited pair read-only.

It drives: the Active/Upcoming/Expired chip in the UI, the route picker when building an agent's
programme list, and the printed contract. It does **not** gate pricing (see the warning in §5.1).

The card-level `valid_from`/`valid_to` is a legacy fallback used only when a route has no
`route_validity` entry. Prefer the per-route pair everywhere.

### 5.4 Longtail bundles — forced, and per route

Some routes (Whale Shark is the canonical case) include a longtail-boat transfer as part of the
package. The customer cannot decline it.

```
rate_type_route_bundle[route].longtail = {
    mode:     'free' | 'paid',
    adult:    ฿ per adult,      # 0 when mode = 'free'
    child:    ฿ per child,      # 0 when mode = 'free'
    apply_to: 'seat' | 'charter' | 'both'      # default 'seat'
}
```

- `mode = 'free'` — no surcharge. The invoice shows "(incl. Longtail Join)".
- `mode = 'paid'` — adds `adult × Σadults + child × Σchildren` to the trip subtotal automatically.
  Adults and children are summed **across nationalities** (fr + th + legacy) for the bundle.
- The agent cannot opt out; the corresponding optional add-on checkbox is disabled for that route.
- `apply_to` defaults to `'seat'`. A bundle created before this field existed therefore does **not**
  apply to charter trips. Preserve that default on migration.

`applies_to(bundle, is_charter)` = `bundle.apply_to = 'both'` OR
(`is_charter` ? `apply_to='charter'` : `apply_to='seat'`).

> ⚠ **A paid bundle suppresses the optional `longtail-join` add-on for the whole booking**, not per
> trip. A two-route booking where only one route bundles will drop the join charge on the other route
> too. This is a real revenue leak on mixed bookings — see §12 bug **B-06**; the rewrite makes the
> suppression per trip.

### 5.5 Charter rates

```
rate_type_charter_rate[route][boat_type] = {
    starter_price:   ฿ for the boat with the first N passengers included,
    starter_includes: N,
    extra_per_pax:   ฿ for each passenger above N
}
```

`boat_type` is the lower-cased boat type string (`speedboat`, `catamaran`). If there is no row for the
chosen boat's type on that route, the result is `total = 0` plus an explicit error
`no_charter_rate` — never a silent zero.

> **`extra_per_pax` is charged only on passengers above `starter_includes`, not on every passenger.**
> This has been misread before. 6 passengers with `starter_includes = 4` pays for 2 extras.

The passenger count used is **all** passengers on the trip — adults, children, infants and FOC —
because the boat carries all of them.

A charter trip may override the card entirely: `charter_price_mode = 'manual'` uses
`charter_price_manual`. The engine still computes the rate-card figure and returns the difference so
the UI can show "differs from rate by ฿X" and so audit can see the concession.

### 5.6 The add-on system — data-driven by design

Add-ons are optional extras attached to a booking: a longtail-boat join, a whole longtail boat, a
private car or van transfer.

**Why it is data-driven.** Non-technical sales staff need to add a new sellable extra (a photographer,
a fin rental, a lunch upgrade) without a developer. In the current system a registry of add-on
definitions is assembled at runtime from built-in definitions plus a user-editable list, and every
consumer — the rate card editor, the rate card detail page, the agent pricing tab, the printed
contract, the card preview — iterates that registry. Adding an entry cascades to all of them
automatically.

**The gap the current design has, which the rewrite must close.** The registry covers *display and
storage*, not *pricing*. A staff-created add-on type appears everywhere and prints on the contract but
**cannot price a booking** — the booking pricing engine has a hard-coded branch per known type and no
branch for custom ones. So the no-code path produces an add-on that is always ฿0.

**The relational equivalent, which keeps adding a type a data change:**

```sql
CREATE TABLE addon_type (
  id            uuid PRIMARY KEY,
  key           text NOT NULL UNIQUE,        -- storage key, <= 24 chars, slug
  label_en      text NOT NULL,
  label_th      text NOT NULL,
  pricing_model text NOT NULL                -- 'per_pax' | 'flat' | 'per_route_flat' | 'matrix'
                CHECK (pricing_model IN ('per_pax','flat','per_route_flat','matrix')),
  unit          text,                        -- display unit, e.g. 'per trip', 'per boat'
  route_scoped  boolean NOT NULL DEFAULT true,
  is_builtin    boolean NOT NULL DEFAULT false,
  active        boolean NOT NULL DEFAULT true,
  matrix_axes   text[]                       -- for 'matrix', e.g. '{zone,vehicle}'
);
```

Prices live in one generic table rather than a shape per type:

```sql
CREATE TABLE rate_type_addon_price (
  id            uuid PRIMARY KEY,
  rate_type_id  uuid NOT NULL REFERENCES rate_type(id) ON DELETE CASCADE,
  addon_type_id uuid NOT NULL REFERENCES addon_type(id),
  route_id      uuid     REFERENCES route(id),   -- NULL = applies to every covered route
  axis_1        text,                            -- e.g. zone     ('PK'|'KL'|'NoTransfer')
  axis_2        text,                            -- e.g. vehicle  ('sedan'|'van')
  adult_price   numeric(12,2),                   -- per_pax
  child_price   numeric(12,2),                   -- per_pax
  flat_price    numeric(12,2),                   -- flat / per_route_flat / matrix
  capacity      integer,                         -- e.g. longtail charter seats per boat
  UNIQUE (rate_type_id, addon_type_id, route_id, axis_1, axis_2)
);
```

The four pricing models are the only code the engine needs:

| `pricing_model` | Amount for one booking add-on line |
|---|---|
| `per_pax` | Σ over applicable trips of `adult_price × trip adults + child_price × trip children` |
| `flat` | `flat_price` once for the booking |
| `per_route_flat` | `flat_price` once **per applicable trip route** (this is longtail charter: one boat per route) |
| `matrix` | `flat_price` from the row matching `(route_id, axis_1, axis_2)` |

Mapping the two existing built-ins onto this:

| Today | `key` | `pricing_model` | Rows |
|---|---|---|---|
| Longtail join | `longtail_join` | `per_pax` | one per route, `adult_price`/`child_price` |
| Longtail charter | `longtail_charter` | `per_route_flat` | one per route, `flat_price` + `capacity` |
| Private transfer | `private_transfer` | `matrix` | one per (route, zone, vehicle), `flat_price` |

**Adding a type after this change** is: one `addon_type` row, N `rate_type_addon_price` rows. No
code. That is the requirement, and it is what the current design falls short of.

A booking add-on line stores `addon_type_id`, the resolved `label`, `qty`, the `unit_amount` and the
frozen `amount`. `qty > 1` is meaningful only for `per_route_flat` (N longtail boats).

### 5.7 FOC, discounts, extras, adjustments

**FOC (free of charge).** Passengers the company gives away, usually to an agent as an incentive
(one free place per fifteen paying). They are a passenger bucket, `pax_type = 'foc'`.

- They pay ฿0 and occupy a real seat in every capacity calculation.
- The **forgone revenue** is recorded as `price_breakdown.foc_discount`, stored **negative**:
  `foc_discount = −( adult_fr_rate × foc_fr_count + adult_thai_rate × foc_th_count )`, priced at each
  trip's own (possibly promotional) rate. FOC is always valued at the **adult** rate regardless of who
  actually travels free.
- FOC needs a reason and manager approval (§6.9). It is a giveaway and the business wants it visible.

**Adjustments** are free-form lines on the booking:

| `kind` | `mode` | Effect |
|---|---|---|
| `discount` | `amount` | Subtract `round(value)` |
| `discount` | `percent` | Subtract `round(base × value / 100)` where `base = seat_total + addon_total` |
| `extra` | `amount` | Add `round(value)` |

Adjustments with `value <= 0` are ignored. Extra charges are always absolute amounts; a percentage
extra is not a supported shape.

**OVN charge.** The overnight surcharge on a trip is added to the `extra` bucket. The return leg
itself prices ฿0 — the money is on the outbound trip so it is not billed twice, while the return leg
still reserves its seats.

### 5.8 The calculation, in order, with rounding rules

**Rounding rule.** Every `round()` below is **half-up to whole baht** (0.5 rounds away from zero).
The current implementation uses JavaScript's `Math.round`, which is half-up for positive numbers. Do
not use a language's default banker's rounding — in Python that is `decimal.ROUND_HALF_UP`, in SQL it
is `round(numeric)` which is already half-up. Intermediate seat and add-on sums are exact products of
integers and need no rounding; rounding appears only at percentage discounts and at manual amounts.

```
FUNCTION quote(booking):

  # ── Manual short-circuit ───────────────────────────────────────────
  IF booking.price_mode = 'manual':
      grand := MAX(0, booking.manual_total)
      IF booking is B2C-sourced:
          addon_total := Σ over booking.addons of addon.amount      # as sent by the source
          seat_total  := MAX(0, grand − addon_total)
          per_trip    := each trip's subtotal as sent by the source
      ELSE:
          seat_total := grand ; addon_total := 0 ; per_trip := []
      RETURN { seat: seat_total, addon: addon_total, foc_discount: 0,
               discount: 0, extra: 0, total: grand }

  # ── 1. Per-trip subtotal ───────────────────────────────────────────
  seat_total := 0
  FOR each trip t:
      rt := rate_type_for_trip(t)                 # §5.10 promo overlay
      t.subtotal := trip_subtotal(t, rt)          # below
      seat_total += t.subtotal

  # ── 2. FOC forgone revenue ─────────────────────────────────────────
  foc_discount := 0
  FOR each trip t WHERE t.zone IS NOT NULL:
      rt := rate_type_for_trip(t)
      cell := rt.seat_rate[t.route_id][t.zone]
      foc_discount += cell.adult_fr   × t.pax.foc_fr_or_legacy_foc
                    + cell.adult_thai × t.pax.foc_th

  # ── 3. Add-ons ─────────────────────────────────────────────────────
  addon_total := 0
  FOR each addon line a:
      IF a.type = 'longtail_join' AND trip is covered by a paid bundle: CONTINUE   # see note
      addon_total += addon_amount(a, booking) × MAX(1, a.qty)

  # ── 4. Adjustments ─────────────────────────────────────────────────
  base := seat_total + addon_total
  discount_total := 0 ; extra_total := 0
  FOR each adjustment adj WHERE adj.value > 0:
      IF adj.kind = 'discount':
          discount_total += (adj.mode = 'percent')
                            ? round(base × adj.value / 100)
                            : round(adj.value)
      ELSE:
          extra_total += round(adj.value)

  # ── 5. Overnight surcharges ────────────────────────────────────────
  FOR each trip t WHERE t.ovn IS NOT NULL:
      extra_total += MAX(0, t.ovn_charge)

  # ── 6. Grand total ─────────────────────────────────────────────────
  grand := MAX(0, base − discount_total + extra_total)

  RETURN { seat: seat_total, addon: addon_total,
           foc_discount: −foc_discount,      # stored NEGATIVE
           discount:     −discount_total,    # stored NEGATIVE
           extra:         extra_total,
           total:         grand }
```

```
FUNCTION trip_subtotal(t, rt):

  IF rt IS NULL OR t.route_id IS NULL:  RETURN 0
  IF t.ovn_leg:                         RETURN 0     # return leg: seats held, not charged

  IF t.booking_mode = 'charter':
      IF t.charter_boat_id IS NULL:     RETURN 0
      bt := lower(boat(t.charter_boat_id).type)
      cr := rt.charter_rate[t.route_id][bt]
      IF cr IS NULL:                    RETURN 0 with error 'no_charter_rate'
      tot_pax := Σ t.pax[*]                                   # ALL types, incl. inf + foc
      extras  := MAX(0, tot_pax − cr.starter_includes)
      bundle  := 0
      b := rt.route_bundle[t.route_id].longtail
      IF b AND b.mode = 'paid' AND applies_to(b, is_charter := true):
          bundle := b.adult × adults(t) + b.child × children(t)
      rate_total := cr.starter_price + extras × cr.extra_per_pax + bundle
      RETURN (t.charter_price_mode = 'manual')
             ? round(t.charter_price_manual)
             : rate_total

  # ── Seat mode ──
  IF t.zone IS NULL:                    RETURN 0
  cell := rt.seat_rate[t.route_id][t.zone]
  IF cell IS NULL:                      RETURN 0 with no_rate 'zone not offered on this route'
  IF cell.adult_fr = 0 AND cell.adult_thai = 0:
                                        RETURN 0 with no_rate 'both adult rates are 0'

  seat_fr := cell.adult_fr   × (t.pax.ad_fr  OR legacy t.pax.ad)
           + cell.child_fr   × (t.pax.chd_fr OR legacy t.pax.chd)
  seat_th := cell.adult_thai × t.pax.ad_th
           + cell.child_thai × t.pax.chd_th

  bundle := 0
  b := rt.route_bundle[t.route_id].longtail
  IF b AND b.mode = 'paid' AND applies_to(b, is_charter := false):
      bundle := b.adult × adults(t) + b.child × children(t)

  RETURN seat_fr + seat_th + bundle
```

where `adults(t)` = `ad_fr + ad_th + legacy ad`, `children(t)` = `chd_fr + chd_th + legacy chd`.

> **Note on step 3 (bundle suppression).** The rule as written above is the **corrected** one: a paid
> bundle suppresses the `longtail_join` add-on only for the trips it covers. Today the suppression is
> booking-wide. §12 bug **B-06**.

> **Note on add-on pricing and promotions.** Today add-ons are priced from the agent's **base** rate
> card while seats and FOC use the per-trip promotional card, so a promotion that changes longtail
> prices has no effect. The rewrite prices add-ons from the same per-trip resolved card as seats.
> §12 bug **B-11**.

### 5.9 Price freeze semantics — the three-owner problem

Pricing is **produced** by the rate-type domain, **frozen** by booking, and **consumed** by
accounting. Three owners for one number is where inconsistency lives. The rule set below is the whole
contract.

**What is frozen, and where.**

| Frozen value | Stored on | Written when |
|---|---|---|
| `booking_trip.subtotal` | trip | Every commit |
| `booking_addon.unit_amount`, `.amount` | add-on line | Every commit |
| `booking_price_breakdown.{seat,addon,foc_discount,discount,extra,total}` | breakdown | Every commit |
| `booking.total` | booking | Every commit (mirror of `breakdown.total`) |
| `booking.rate_type_id` | booking | First commit; carried on edit |
| `booking.payment_*` (method, net days, source, contract version) | booking | First commit; carried on edit |
| `booking.market_snapshot_*` | booking | **Create only** — never re-derived |

**When the price IS recalculated:**

1. `POST /bookings` — create.
2. `POST /bookings/:id/commit` or any `PATCH` that touches a **pricing input**. The pricing inputs are
   exactly: `agent_id`, `rate_type_id`, `price_mode`, `manual_total`, any trip's `route_id`,
   `service_date`, `zone`, `booking_mode`, `charter_boat_id`, `charter_price_mode`,
   `charter_price_manual`, `ovn_charge`, any `booking_trip_pax` row, any `booking_addon` row, any
   `booking_adjustment` row.
3. `POST /bookings/:id/partial-cancel` — recompute from the reduced passenger counts (§6.5).
4. `POST /bookings/:id/quote-preview` — a **read-only** endpoint that returns a fresh calculation
   without writing anything, for the form to display while the user types.

**When the price is NOT recalculated — read the frozen snapshot:**

- Any `GET`. A booking detail response returns the stored breakdown, never a recomputation.
- Any `PATCH` that touches only non-pricing fields (hotel, phone, notes, guide language, pickup time,
  passenger names). Those must leave every frozen number byte-identical.
- Invoicing, statements, credit exposure, revenue reports, the FOC report, the manifest.
- Restore, reschedule, weather resolution, approval, FOC approval. **None of these re-price.** A
  reschedule may add a `fee_item`, which changes the invoice total but not `price_breakdown.total`.
- A rate card being edited. Changing a price never retro-prices an existing booking.

**Invariant.** For any booking, `booking.total = booking_price_breakdown.total` and
`booking_price_breakdown.seat = Σ booking_trip.subtotal`. Enforce with a check at write time and
assert it in the migration report (§14).

**Fee items are outside the breakdown, deliberately.**
`invoice_total(booking) = booking.total + Σ booking_fee_item.amount`. A reschedule fee is a charge
against the customer, not a change to the price of the tour they bought; keeping it separate means the
tour's own price stays comparable across reports.

### 5.10 Promotional overlay

An agent can have time-boxed **promo contracts** that override the base card for specific routes and
travel dates.

```
FUNCTION rate_type_for_trip(booking, trip):
    base := booking.rate_type_id
    IF booking.agent_id IS NULL: RETURN base
    candidates := promo contracts WHERE agent_id = booking.agent_id
                    AND kind = 'promo'
                    AND status NOT IN ('void','cancelled','expired')
                    AND (active_from IS NULL OR trip.service_date >= active_from)
                    AND (active_to   IS NULL OR trip.service_date <= active_to)
                    AND EXISTS a programme period P WHERE
                            P.route_id = trip.route_id
                        AND (P.travel_from IS NULL OR trip.service_date >= P.travel_from)
                        AND (P.travel_to   IS NULL OR trip.service_date <= P.travel_to)
    IF none: RETURN base
    ORDER BY priority DESC, active_from DESC ; take the first
    IF chosen = base: RETURN base
    IF the chosen card prices neither seats nor charter for this route: RETURN base   # defensive
    RETURN chosen
```

Two facts to carry over: the resolver keys on **travel date**, never on booking date (the
`book_from`/`book_to` fields on a programme period are written but never enforced), and no promo
contracts exist in production today, so this is currently a pass-through. Build it anyway — it is
already in the data model and it will be used.

### 5.11 VAT and payment terms

VAT is applied at **invoice** time, from the agent's `vat_mode`, not at booking time. Thai VAT is 7%.

| `vat_mode` | Given a booking subtotal `S` |
|---|---|
| `exclude` | `net = S` · `vat = round(S × 0.07)` · `total = net + vat` |
| `include` | `total = S` · `net = round(S / 1.07)` · `vat = S − net` |
| `none` | `net = S` · `vat = 0` · `total = S` |

`include` derives `vat` by subtraction rather than by its own rounding, so `net + vat = total` always
holds exactly.

**Pay types** (`agent.pay_type`) map onto the booking's frozen payment snapshot:

| `pay_type` | `payment_method` | Meaning |
|---|---|---|
| `invoice` | `credit` | Invoiced after travel, due `credit_days` later. Counts against the agent's credit limit. |
| `proforma` | `prepaid` | A proforma invoice is issued and must be settled before travel. |
| `cash` / counter variants | `prepaid` | Paid at the counter. |

Credit exposure = Σ `invoice_total` over the agent's bookings that are confirmed, not cancelled, not
draft, and unpaid. `available = credit_limit − used`. Booking stores no ledger; exposure is always
derived.

---

## 6. Mutation flows

Every flow below is **one database transaction**. If any step fails the whole thing rolls back,
including the money side. That is a change from today, where accounting calls are wrapped in
try/catch and only log a warning — see §12 bug **B-07**.

Every flow appends exactly one `booking_history` row.

### 6.1 Create

**Trigger.** `POST /v1/bookings`.
**Actor.** Staff with the `operations` permission; a B2C service token; an agent token (restricted).

**Preconditions — the guard gauntlet, in this order.** Each returns a structured error and stops.

| # | Guard | Kind | Rule |
|---|---|---|---|
| 1 | Permission | 403 | Caller may write bookings. |
| 2 | Hotel canonicalisation | advisory | Normalise the hotel name against known hotels; warn on a near-duplicate. |
| 3 | Staff purpose | 422 | If the agent is the `STAFF` house agent, `staff_id` is required; warn if the welfare quota is exceeded. |
| 4 | Required fields | 422 | `agent_id` **or** `b2c_channel`; ≥1 trip with route and date; total pax ≥ 1; `lead_pax`; `rate_type_id` unless `price_mode='manual'`; `lead_nationality`; a nationality for **every named** passenger; at least one guide language; `hotel_name` when a pickup area is set and the zone is not `NoTransfer`; a pickup point when `status != 'quote'`; the route must be operating on that date. |
| 5 | Contract programme whitelist | confirm | The trip's route must be in the agent's contracted programme list. Selling outside it needs an explicit `acknowledge_off_contract: true`. |
| 6 | Duplicate detection | confirm | Same `voucher_ref`, or same lead name sharing a route+date with a live booking. Needs `acknowledge_duplicate: true`. |
| 7 | Self-arrive consistency | confirm | `pickup_self` set but a hotel also given (or the reverse). |
| 8 | Soft-missing flags | — | Anything missing but not blocking is recorded in `incomplete[]`. |
| 9 | Lock-draw confirmation | confirm | Drawing locked seats is an explicit act; confirm the sources. |
| 10 | Unused-agent-lock reminder | advisory | The agent has drawable lock seats on this trip and is not using them. |
| 11 | **Anti-overbook tiering** | §4.9 | `LOCK_VIOLATION` / `LICENCE_BLOCK` are hard 409s. Over cap → `pending_approval`. |
| 12 | Discount routing | — | Discount > 0 on a `confirmed` save → `pending_approval`, reason `discount`. |

**B2C exemption.** A booking arriving from the B2C channel is exempt from guards 4 (guide language)
and 4 (route-closed) as *hard* blocks; those degrade to `incomplete[]` flags. It is not exempt from
guard 11 — the capacity guards apply to every writer without exception.

**Steps.**

1. Take the `route_day_inventory` locks for every affected *(route, date)* (§4.10c).
2. Run the gauntlet. On a hard block, roll back and return 409 with the offending rows.
3. Generate `code`. Insert `booking`, `booking_trip`, `booking_trip_pax`, `booking_passenger`
   (dropping unnamed rows), `booking_addon`, `booking_adjustment`, `booking_alt_pickup`.
4. Compute the quote (§5.8) and insert `booking_price_breakdown`; mirror `total` onto the booking.
5. Insert `booking_trip_lock_draw` rows; set each trip's `seat_source` from what was actually drawn.
6. If any trip is charter and status is not `quote`, take the charter hold on the boat for that date.
7. If an approval was required, insert `booking_approval` (+ `booking_approval_over` rows) and set
   `status = 'pending_approval'`.
8. If any trip has FOC passengers, insert `booking_foc_approval` with a mandatory reason. Status
   becomes `pending_foc` unless the save status is already `confirmed`, in which case the FOC
   approval is recorded as `approved` immediately.
9. Insert `booking_history`.
10. Bump `route_day_inventory.version` for each affected departure. Commit.

**Inventory effect.** Seats consumed; lock seats moved from held to drawn.
**Money effect.** None yet — no invoice is raised at create.
**Audit.** One history row, `kind='create'`.

**Current bug to not reproduce.** `created_at` and `booking_date` are stamped from a UTC timestamp
truncated to 10 characters. Before 07:00 Bangkok time that is **yesterday**. Store `booking_date` as
a `DATE` and derive "today" explicitly in `Asia/Bangkok`. §12 bug **B-03**.

### 6.2 Edit

**Trigger.** `PATCH /v1/bookings/:id` (named fields), or `POST /v1/bookings/:id/commit` after a
form-level edit.
**Preconditions.** Booking is not `schema_version = 1` (409 `LEGACY_READ_ONLY`). Editing a
`cancelled`/`completed`/`rejected` booking requires an explicit acknowledgement. The caller's
`If-Match` version must match (§10.4).

**Steps.**

1. Lock the affected departures — **both** the old and the new *(route, date)* pairs if any trip
   date moved.
2. Return **all** existing lock draws for the booking, then re-draw. Returning first is what stops an
   edit from counting the same lock usage again.
3. Run the gauntlet, but the capacity guard fires only on a genuine **increase** (§4.9), and
   availability is computed with this booking excluded.
4. Update only the named columns. Recompute the price **only** if a pricing input changed (§5.9).
5. Two deliberate un-preserves:
   - **The travel date changed** → clear that day's operational assignment: boat, van, van group, van
     sequence, van splits, final pickup time, and the per-day ops rows for the old date. A charter
     trip keeps its boat. Write a history line saying the assignment was cleared and why.
   - **Pickup became self-arrive or `NoTransfer`**, and no alternate pickup still needs a van → clear
     the **outbound** van only. Keep `van_return_id`: the customer may still need a lift back.
6. If FOC was already approved, re-submitting does **not** downgrade to `pending_foc`; it returns to
   `confirmed`.
7. History row, `kind='edit'`, listing the changed fields.

> **The point of the whole rewrite is here.** In the current system the booking object is rebuilt from
> the form on every save, so fourteen fields have to be hand-copied in an `if (editing)` block or they
> are destroyed — losing one silently wiped every boat and van assignment in production. With named
> column updates this class of bug cannot exist. Write the test: `PATCH { lead_phone }` on a booking
> with a boat and van assigned must leave every `booking_ops` row byte-identical.

**Advisory edit lock.** The current system stamps a 5-minute advisory lock so two staff do not edit
the same booking simultaneously; last write still wins. Replace it with real optimistic concurrency
(§10.4) and, optionally, a soft "someone else is editing" presence signal. Do not port the TTL lock as
a correctness mechanism — it never was one.

### 6.3 Cancel (full)

**Trigger.** `POST /v1/bookings/:id/cancel`.
**Preconditions.** Status not already `cancelled`, `cancelled_weather`, `rejected` or `completed`.
A **reason category** is required; a note is required when the category is `other`; a partial charge
amount must be > 0 when the charge mode is `partial`.

**Reason catalogue** (fixed, 8 entries; `group` drives reporting, `default_charge` pre-selects the
charge mode):

| code | English | Thai | group | default charge |
|---|---|---|---|---|
| `customer_cancel` | Customer cancelled / changed plan | ลูกค้ายกเลิกเอง / เปลี่ยนแผน | customer | full |
| `no_show` | No-show | ไม่มาตามนัด | customer | full |
| `sick` | Sick / health | ป่วย / เหตุสุขภาพ | customer | none |
| `flight_visa` | Flight / visa / documents | ไฟลท์ / วีซ่า / เอกสาร | customer | full |
| `agent_error` | Agent error / double booking | เอเย่นต์จองผิด / จองซ้ำ | customer | none |
| `operator` | Operator (boat down / trip off) | ฝั่งเรา (เรือเสีย / ทริปไม่ออก) | operator | none |
| `force_majeure` | Force majeure | เหตุสุดวิสัย | operator | none |
| `other` | Other | อื่นๆ (ระบุใน note) | other | none |

Charge modes: `none` (no cancellation fee), `full` (charge the whole booking total), `partial`
(charge a stated amount). The agent's contracted cancellation policy is shown to the operator but is
not enforced automatically.

**Steps.** Set `status='cancelled'` and `cancelled_at`. Insert `booking_cancellation`
(`category`, `category_label`, `group`, `note`, `charge_type`, `charge_amount`, `at`, `by`). Void the
existing invoice. If `charge_amount > 0`, raise a cancellation-fee invoice. Delete every lock draw for
the booking. Release every charter hold the booking held. History row.

**Inventory effect.** All seats and all lock draws released.
**Money effect.** Invoice voided; optional fee invoice raised.

**Current bug to not reproduce.** The accounting calls are wrapped in try/catch and only warn — a
failed invoice void leaves the booking cancelled with a live invoice. In the rewrite the void is in
the same transaction and its failure rolls the cancellation back. §12 bug **B-07**.

### 6.4 Restore (un-cancel)

**Trigger.** `POST /v1/bookings/:id/restore`.
**Preconditions.** Status is `cancelled`, `cancelled_weather` or `rejected`.

**Steps.** Void any cancellation-fee invoice. Set `status='confirmed'`; delete the
`booking_cancellation` and `booking_weather_resolve` records. **Re-draw** the original lock seats from
the recorded draws — someone may have taken them meanwhile, so the re-draw is best-effort and any
shortfall is returned in the response and written to history, never hidden. Re-apply charter holds
only where the boat is still free on that date; report the ones that are now blocked.

**Note.** Restore deliberately does **not** re-run the capacity gauntlet as a hard block. The booking
existed; refusing to restore it because the day has since filled would strand a customer with no
record. Instead it restores and reports the resulting over-capacity so a human can act.

### 6.5 Partial cancel ("reduce pax")

**Trigger.** `POST /v1/bookings/:id/partial-cancel`.
**Preconditions.** Status not `cancelled`, `cancelled_weather`, `rejected` or `completed`. At least
one passenger removed. A reason category is required; a note when `other`. Each removal is clamped to
the current count for that pax type on that trip.

**Steps.**

1. Decrement `booking_trip_pax` for the named pax types on the named trip. Seats free automatically
   because `seats_consumed` reads live counts.
2. **Return the lock draws for the removed passengers, proportionally.**
3. **Recompute the price** from the reduced counts and write a new `booking_price_breakdown`.
4. **Adjust the invoice**: if the booking is invoiced, issue a credit note or amend the open invoice
   for the refunded amount.
5. Insert `booking_partial_cancel`: `service_date`, `trip_id`, the per-pax-type removals, `count`,
   `category`, `category_label`, `group`, `note`, `refund_mode`, `refund_amount`,
   `charged_count`/`charged_amount`, `waived_count`/`waived_amount`, `at`, `by`.
6. History row.

> **Steps 2, 3 and 4 do not happen today.** The current implementation decrements the counts, reduces
> the stored total by the refund figure, and stops: the seat-lock draws leak and the invoice is never
> touched. This is §12 bugs **B-02** and **B-12**. It is also why the stored total can disagree with
> the sum of trip subtotals — see the parity note in §14.

> ⚠ **Storage gap found in production.** `sb_bookings__partialcancels` has columns for only two of
> the twelve pax keys (`paxremoved_ad_fr`, `paxremoved_foc_th`). Removing children or Thai adults
> loses the detail on the next round-trip. The new model stores removals as child rows, one per pax
> type. §12 bug **B-13**.

### 6.6 Reschedule (move a trip to another date)

**Trigger.** `POST /v1/bookings/:id/reschedule`.
**Preconditions.** Status not cancelled-class or `completed`; the booking has at least one dated trip;
a new date that differs from the old one; a **required** free-text reason. Fee mode `none`/`full`/
`partial`, and fee collection `invoice` (add a line to this booking's invoice) or `separate` (record
only).

**Steps.**

1. Lock **both** the old and the new departures.
2. **Validate the new date** — the route must be operating, and the trip must fit availability at the
   new date under the §4.9 tiering. *This validation does not exist today*: a reschedule can currently
   land on a closed day or an over-full trip and only a later edit would notice. §12 bug **B-04**.
3. Move every trip whose `service_date` equals the source date to the target date. Carry any charter
   hold with it.
4. **Clear the day's operational assignment**: boat (unless charter), outbound van, return van, van
   group, van sequence, van splits, final pickup time, and both check-in records — for the booking
   and for every per-trip ops row on that date.
5. Return and re-draw lock seats for the moved trips (the old date's locks are not the new date's).
6. Write `booking_reschedule` (`from_date`, `to_date`, `reason`, `charge_type`, `charge_amount`,
   `collect`, `at`, `by`).
7. If a fee is collected on this invoice, insert a `booking_fee_item` **and** top up the existing
   invoice's subtotal, net, VAT, total and line items in the same transaction.
8. History row.

**Money effect.** Optional fee item; `booking.total` is unchanged (§5.9).

### 6.7 Weather cancellation and per-booking resolution

The **decision** that a route did not sail is made in boat operations. Booking owns the resolution.

```
Boat-ops marks (route, date) weather-closed
        │
        ▼
weather_closure row created  ──►  tag every affected booking
        │                          (non-cancelled, seat-mode trip on that route+date;
        │                           CHARTER TRIPS ARE EXCLUDED — a charter is resolved
        │                           commercially with the customer, not en masse)
        ▼
booking_weather_resolve = { event: '<route_id>|<date>', status: 'awaiting' }
        │
        ▼  notify the agent
     status = 'notified'
        │
        ▼  choose one outcome
 ┌────────────┬──────────────┬──────────────┬──────────────┐
 │ reschedule │   refund     │    credit    │    cancel    │
 ├────────────┼──────────────┼──────────────┼──────────────┤
 │ move the   │ negative     │ create a     │ void the     │
 │ trip date  │ payment row  │ deposit for  │ invoice      │
 │ (status    │ + void the   │ future use   │              │
 │ unchanged) │ invoice      │ + void       │              │
 └────────────┴──────────────┴──────────────┴──────────────┘
        │              │              │              │
        └──────────────┴──────────────┴──────────────┘
                       ▼
      status = 'resolved', outcome recorded
      non-reschedule outcomes ⇒ booking.status = 'cancelled_weather'
```

**Steps for the `reschedule` outcome** — and this is the one that is wrong today:

1. Lock both departures. Validate the new date exactly as §6.6 step 2.
2. Move the trip date.
3. **Clear the old day's operational assignment** — boat, vans, van group, van sequence, splits, final
   pickup time, and both check-in records.
4. Return and re-draw lock seats.
5. `weather_resolve.status='resolved'`, `outcome='reschedule'`, `new_date`, `resolved_at`.
6. History row.

> **Step 3 is missing today.** A weather-rescheduled booking keeps the *old* day's boat and van, so it
> appears on the wrong manifest and the wrong van job order. Every other date-change path clears the
> assignment. §12 bug **B-01**.

### 6.8 Rebook

`booking_rebook` is a light record (`from_date`, `to_date`, `reason`, `at`) written by both the manual
reschedule and the weather reschedule so that "this booking moved" is answerable without parsing
history. It carries no money and no inventory effect of its own; it is a denormalised marker. Keep it,
or fold it into `booking_history` with `kind='rebook'` — either is acceptable, but pick one and be
consistent.

### 6.9 FOC approval

**Trigger.** Any trip with FOC passengers. Submitting requires a free-text `foc_reason` and commits at
`status='pending_foc'`.

`booking_foc_approval` = `{ count, reason, status, requested_at, requested_by, approved_at,
approved_by, reject_reason }`. `status` is `approved` immediately when the save status is already
`confirmed`, otherwise `pending`.

- **Approve** — `POST /v1/bookings/:id/foc-approve`. The reason is **mandatory**: an approve with no
  reason on record is refused with `422`. Sets `foc_approval.status='approved'`, stamps approver and
  time, sets `booking.status='confirmed'`, writes history.
- **Reject** — `POST /v1/bookings/:id/foc-reject`. Requires a reject reason. Sets
  `booking.status='rejected'`, which is a cancelled-class status, so lock draws are returned and any
  charter hold released.

**Consistency repair.** The current system runs a boot-time reconcile for bookings whose FOC was
approved but whose status got stuck at `pending_foc`/`quote`. In the rewrite that state is impossible
because both writes are in one transaction — do not port the reconcile, but **do** add a migration-time
check that reports any such rows before they are carried across.

**Money effect.** None. FOC is already priced at ฿0 with the forgone revenue recorded negatively in
`price_breakdown.foc_discount` (§5.7).

### 6.10 Approval (over-capacity, discount, external hold)

**Trigger.** `POST /v1/bookings/:id/approve` or `/reject`.
**Preconditions.** `status='pending_approval'`; an approval record exists; the approver's name is
supplied (mandatory).

**Approve steps.** Recompute the seats-after-approval impact for each affected departure, excluding
this booking's own seats. If any row is over the licensed seat count, require
`acknowledge_over_licence: true` in the body. Then set `approval.status='approved'`, stamp approver
and time, set `booking.status = approval.target_status` (default `confirmed`), stamp `confirmed_by`
and `confirmed_at`, write history.

**Reject steps.** `approval.status='rejected'`, `booking.status='rejected'`, return lock draws,
release charter holds, write history.

**Important inventory consequence.** Approving an over-capacity hold changes what
`holds_seats(booking)` returns from false to true, so the same booking suddenly consumes seats. That
is correct — the manager has just decided those seats exist — but it means availability for that
departure drops by the booking's full pax count at the moment of approval. The impact preview exists
so nobody is surprised by it.

### 6.11 Summary of inventory and money effects

| Flow | Seats | Lock draws | Charter hold | Invoice | Price recomputed |
|---|---|---|---|---|---|
| Create | +consume | draw | take | — | **yes** |
| Edit (pricing input) | re-evaluate increase | return + redraw | release + retake | — | **yes** |
| Edit (other field) | — | — | — | — | no |
| Cancel | release | return all | release | void (+ fee invoice) | no |
| Restore | re-consume | re-draw, report shortfall | retake where free | void fee invoice | no |
| Partial cancel | reduce | **return proportionally** | — | **credit / amend** | **yes** |
| Reschedule | move | return + redraw | move | + fee item, top up | no |
| Weather · reschedule | move | return + redraw | move | — | no |
| Weather · refund | release | return all | release | void + negative payment | no |
| Weather · credit | release | return all | release | void + deposit | no |
| Weather · cancel | release | return all | release | void | no |
| FOC approve | — | — | — | — | no |
| FOC reject | release | return all | release | — | no |
| Approve | may **start** consuming (over-cap) | — | — | — | no |
| Reject | release | return all | release | — | no |

---

## 7. The `ops` seam

### 7.1 What it is and why it is risky

The booking **owns** a container of operational assignment data, but it is boat operations and van
dispatch that read and write it. Booking itself only ever *clears* it. During a phased migration
where booking moves first and fleet stays behind, this container is the only two-way data flow across
the boundary — which makes it the riskiest part of the whole migration.

### 7.2 The model change: keyed by service date

Today the container is split by position: day 1 of a booking lives on `booking.ops`, and day 2 onwards
lives on `trip.ops`. Reading `booking.ops` on a multi-day booking silently gives you day 1's boat and
van — which is exactly how an overnight's return leg once showed the outbound boat, the outbound van
and a hotel pickup for someone coming back from an island.

**The new model has one table keyed by date and no special case:**

```sql
CREATE TABLE booking_ops (
  booking_id        uuid NOT NULL REFERENCES booking(id) ON DELETE CASCADE,
  service_date      date NOT NULL,

  -- boat operations owns these
  boat_id           uuid REFERENCES boat(id),
  boat_splits       jsonb,          -- [{boat_id, pax, ...}] when a group rides two hulls
  upgrade           jsonb,          -- {reason, charge, by, at}
  van_checkin       jsonb,          -- {status, at, by, note}
  pier_checkin      jsonb,
  pier_note         jsonb,          -- {text, at, by}
  reconfirm         jsonb,          -- {status, via, at, by}
  pfm               jsonb,          -- pre-departure fuel/manifest data

  -- van dispatch owns these
  van_id            uuid REFERENCES vehicle(id),
  van_return_id     uuid REFERENCES vehicle(id),
  return_same_van   boolean,
  van_group         integer,
  van_seq           integer,
  van_splits        jsonb,          -- one entry per alternate pickup point
  pickup_time_final text,

  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        text,
  PRIMARY KEY (booking_id, service_date)
);
```

Every travel day gets a row, including day 1. There is no "first day is special" rule to forget.

The `jsonb` columns are deliberate: their contents belong to domains not being migrated in this phase
(check-in, pier, fuel). Modelling them relationally now would force decisions those domains have not
made. They are opaque to booking. When boat operations and vans migrate, they become real tables.

> ⚠ **`pfm` is not persisted today.** There is no column for it anywhere in the production schema,
> although it is documented as part of the ops container. Either it is dead, or a feature is silently
> losing data. See Open Question **OQ-3**.

### 7.3 The contract

**Who writes what:**

| Field group | Owner | Booking's involvement |
|---|---|---|
| `boat_id`, `boat_splits`, `upgrade`, `van_checkin`, `pier_checkin`, `pier_note`, `reconfirm`, `pfm` | boat operations / pier | Booking only **clears** them on a date change, and derives `boat_id` for a charter trip. |
| `van_id`, `van_return_id`, `return_same_van`, `van_group`, `van_seq`, `van_splits`, `pickup_time_final` | van dispatch | Booking only **clears** them, and builds `van_splits` from the booking's alternate pickup points. |

**When booking writes into ops** — these three cases and no others:

1. **A trip's date changed** during an edit → clear the old date's row entirely (charter keeps its
   boat).
2. **Pickup became self-arrive or `NoTransfer`** and no alternate pickup still needs a van → clear the
   **outbound** van fields only. `van_return_id` survives.
3. **Alternate pickups changed** → rebuild `van_splits` so each alternate pickup point can ride its
   own van.

Plus one derived mirror: for a `charter` trip, `ops.boat_id` mirrors `trip.charter_boat_id` so the
charter booking appears on its own boat in every manifest that keys off `ops.boat_id`. Make this a
generated value or a trigger, not a periodic repair job.

**Capacity tolerance on assignment.** Assigning a boat allows the day's assigned passengers to exceed
the boat's `cap` by a small tolerance (currently **2**) before warning. This is a dispatch-side rule,
not a sales rule — it exists because the morning's real head count differs from the booked count. It
must not be confused with the §4.9 tiering.

**The return-leg question.** Dispatch needs one derived answer per booking per date: *is the return
leg handled?* Expose it as a computed object rather than making every consumer re-derive it:

```
return_info(booking, service_date) -> {
    separate_dropoff: bool,      # dropoff differs from pickup
    dropoff_area:     string,
    return_van_id:    uuid|null,
    arranged:         bool,      # a return van exists or the same van is reused
    self_return:      bool,      # customer makes their own way back
    same_van:         bool,
    alert:            string|null  # e.g. 'no return van and not self-return'
}
```

### 7.4 API surface for the seam

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/bookings/:id/ops` | All ops rows for the booking. |
| `GET` | `/v1/bookings/:id/ops/:date` | One day's row. |
| `PATCH` | `/v1/bookings/:id/ops/:date` | Named fields only. Requires the `fleet` or `operations` permission. Never touches sales fields. |
| `GET` | `/v1/manifest?date=&route_id=` | The by-trip-date operational view in **one** round trip: per booking — pax by type, boat, van, van group/sequence, pickup area and time, flags, check-in state. No N+1. |

**During the strangler phase**, the legacy monolith keeps boat and van assignment. It reads bookings
and writes ops through a thin adapter that calls exactly these four endpoints. The adapter has one
job, is not extended, and is deleted when boat operations and vans migrate. Write its deletion
criteria into the code as a comment.

**Acceptance for the seam.** With bookings served by the new API, a full operational day still works
end to end through the adapter: assign boat → assign van → form a van group → produce a job order →
pier check-in. Rehearse it against a production clone.

---

## 8. Channels and external writers

### 8.1 The four writers

| Consumer | Principal | May do | May **not** do |
|---|---|---|---|
| **Ops app** (staff) | User session, area permissions `operations` / `sales` / `accounting` / `fleet` | Everything their areas allow | Override a `LOCK_VIOLATION` or `LICENCE_BLOCK` |
| **B2C website** | Service token | Read availability; create a booking; read its own bookings | Approve, cancel-with-charge, override a price, draw another agent's locks |
| **ERP / accounting** | Service token | Read bookings and pricing; write ledger entries | Create or mutate a booking |
| **Agent portal** | Per-agent token | Read and create **only** where `booking.agent_id = token.agent_id` | See any other agent's data; approve anything |

**Row scoping must be enforced in the query, not by filtering after the fetch.** An agent token asking
for another agent's booking gets **404**, not 403 — do not leak the existence of the record.

### 8.2 The B2C link — a string prefix that already leaks

The consumer website is a separate application with its own database schema (`love_kingdom`, 39
tables, well modelled: 39/39 tables have a primary key and 24 have foreign keys). Its bookings are
copied into the ops system with an id built by convention:

```
ops booking id  =  'b2c_' + <love_kingdom booking id> + optional '_' + <n>
```

One consumer booking fans out into several ops rows (`b2c_BK-001`, `b2c_BK-001_1`, `b2c_BK-001_4`)
because a single web order can contain several tour items. **Nothing validates this convention.**

Measured on 2026-08-20:

| Measurement | Count |
|---|---|
| Ops rows with a `b2c_` prefix | 144 |
| Distinct base ids after stripping prefix and `_N` | 133 |
| `love_kingdom.bookings` rows | 112 |
| Ops rows whose base matches a consumer booking | 122 |
| Ops rows matching a consumer id **exactly** | 3 |
| **Ops `b2c_` rows with no consumer parent** | **22** |
| Consumer bookings never synced to ops | 1 |
| `attachments` rows pointing at a booking that does not exist | 118 |

**What the new system does.**

1. **Replace the convention with a real table.**

```sql
CREATE TABLE booking_b2c_link (
  booking_id        uuid PRIMARY KEY REFERENCES booking(id) ON DELETE CASCADE,
  lk_booking_id     text NOT NULL,          -- love_kingdom.bookings.id
  lk_item_index     integer,                -- which line item of the web order
  linked_at         timestamptz NOT NULL DEFAULT now(),
  link_state        text NOT NULL           -- 'linked' | 'orphan' | 'manual'
                    CHECK (link_state IN ('linked','orphan','manual')),
  UNIQUE (lk_booking_id, lk_item_index)
);
```

   A cross-schema foreign key to `love_kingdom.bookings(id)` is legal in PostgreSQL and is the right
   tool. Add it **after** orphan triage — adding a constraint to data that already violates it simply
   fails.

2. **Keep the two booking entities distinct.** `love_kingdom.bookings` is hotel-package oriented
   (booking items, hotels, room types); the ops booking is tour-operations oriented. They are not the
   same entity and merging them is a later phase. Join them through the link table.

3. **Carry the 22 orphans across, flagged `link_state='orphan'`.** Do not delete them. An orphan is
   evidence of a real process gap — a sync that half-ran, a web order deleted after fan-out — and
   somebody needs to see it before it disappears. The same applies to the 118 orphaned attachments.

4. **Ownership split.** Some fields on a `b2c_` booking are owned by the consumer site and are
   overwritten on every sync; some are owned by ops. When ops edits an owned-by-B2C field, record the
   field name in an override list so the next sync skips it. Model that explicitly:

```sql
CREATE TABLE booking_b2c_field_override (
  booking_id uuid NOT NULL REFERENCES booking(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  overridden_at timestamptz NOT NULL DEFAULT now(),
  overridden_by text,
  PRIMARY KEY (booking_id, field_name)
);
```

   Trips, passenger counts, add-ons and money on a `b2c_` booking are **always** re-copied from the
   source on save and are **never** re-priced locally — the consumer site sold at its own price, and
   re-pricing would create a discrepancy with what the customer actually paid.

5. **Direction of authority, written down.** Which side wins on conflict must be recorded per field
   before Phase 1 ships. It is not currently written down anywhere — Open Question **OQ-5**.

### 8.3 Attachments live in a third schema

Booking attachments are 3,038 rows in a **different schema** (`allotment.attachments`), keyed by a
`booking_id` text column with no foreign key, of which 118 already point at nothing. The binary lives
in a `bytea` column.

The rewrite gives `booking_attachment` a real FK to `booking(id)`, cross-schema at first (physically
moving the table can wait), and applies the orphan disposition before adding the constraint. Note for
whoever migrates data: **a booking copied without its attachment rows shows broken document previews**
— they are not in the same store and must be copied deliberately.

### 8.4 Walk-in and staff

Both are ordinary bookings against a house agent, with two behaviours worth stating:

- **WALKIN** keeps `price_mode='manual'` — the counter negotiates and types a total.
- **STAFF** forces the pricing mode by purpose: `staff_welfare` prices from the rate card (so the
  welfare benefit is measurable), `staff_inspection` forces a manual ฿0. `staff_id` is required.

---

## 9. Target relational schema

PostgreSQL 18. All DDL below is written for a schema named `booking` (adjust to house style); tables
in other domains that booking references — `agent`, `route`, `boat`, `vehicle`, `pickup_area`,
`rate_type` — are shown only where booking constrains them.

### 9.1 Conventions and design decisions

| Decision | Why, in one line |
|---|---|
| `uuid` surrogate PKs everywhere, business codes as separate unique columns | The current schema keys everything on human text ids, which makes renaming impossible and joins slow. |
| Money as `numeric(12,2)`, never float | Production stores money as `bigint` whole baht today; `numeric` allows satang without a migration later and never drifts. |
| Dates as `date`, timestamps as `timestamptz` | The current schema stores dates as `text`, which is why the timezone bug (§12 B-03) was invisible. |
| Real `CHECK` or enum on every status-like column | Production has **no enum types anywhere** and every status column is free text; the 8-value booking status set is a convention, not a constraint. |
| Child rows instead of JSON objects, except where the owning domain has not migrated | Empty is zero rows, which removes a whole bug class (§13). |
| `ON DELETE CASCADE` from booking to its children; `ON DELETE RESTRICT` to reference data | A booking is an aggregate; a route is not. |
| Append-only history, never updated | Audit that can be rewritten is not audit. |
| Derived views for anything that was a counter | §4.10. |

### 9.2 Enumerations and the code sequence

```sql
CREATE TYPE booking.status AS ENUM (
  'quote','pending_foc','pending_approval','confirmed',
  'cancelled','cancelled_weather','rejected','completed');

CREATE TYPE booking.mode        AS ENUM ('seat','charter');
CREATE TYPE booking.zone        AS ENUM ('PK','KL','NoTransfer');
CREATE TYPE booking.pax_type    AS ENUM ('ad_fr','ad_th','chd_fr','chd_th','inf_fr','inf_th','foc');
CREATE TYPE booking.lead_type   AS ENUM ('AD','CHD','INF');
CREATE TYPE booking.price_mode  AS ENUM ('rate','manual');
CREATE TYPE booking.pay_method  AS ENUM ('credit','prepaid');
CREATE TYPE booking.pay_status  AS ENUM ('unpaid','invoiced','partial','paid');
CREATE TYPE booking.purpose     AS ENUM ('sale','staff_welfare','staff_inspection');
CREATE TYPE booking.lock_scope  AS ENUM ('day','bulk','month');
CREATE TYPE booking.lock_holder AS ENUM ('agent','office','global');
CREATE TYPE booking.lock_status AS ENUM ('active','depleted','expired');
CREATE TYPE booking.adj_kind    AS ENUM ('discount','extra');
CREATE TYPE booking.adj_mode    AS ENUM ('amount','percent');
CREATE TYPE booking.approval_state AS ENUM ('pending','approved','rejected');

-- Human booking code. One sequence per YYMM, created lazily inside the write transaction.
CREATE TABLE booking.code_sequence (
  period    char(4) PRIMARY KEY,          -- 'YYMM'
  next_seq  integer NOT NULL DEFAULT 1
);

CREATE FUNCTION booking.next_code(p_period char(4)) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  INSERT INTO booking.code_sequence(period) VALUES (p_period)
    ON CONFLICT (period) DO NOTHING;
  UPDATE booking.code_sequence SET next_seq = next_seq + 1
   WHERE period = p_period RETURNING next_seq - 1 INTO n;
  RETURN 'BK-' || p_period || lpad(n::text, 4, '0') || '-' ||
         upper(substr(md5(gen_random_uuid()::text), 1, 4));
END $$;
```

`p_period` is computed by the caller as `to_char(now() AT TIME ZONE 'Asia/Bangkok','YYMM')` — never
from UTC.

### 9.3 The booking aggregate

```sql
CREATE TABLE booking.booking (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                      text NOT NULL UNIQUE,
  schema_version            smallint NOT NULL DEFAULT 2 CHECK (schema_version IN (1,2)),
  status                    booking.status NOT NULL,

  agent_id                  uuid REFERENCES agent(id) ON DELETE RESTRICT,
  b2c_channel               text,
  rate_type_id              uuid REFERENCES rate_type(id) ON DELETE RESTRICT,
  sold_by                   text,
  voucher_ref               text,

  booking_date              date NOT NULL,
  booked_at                 timestamptz NOT NULL DEFAULT now(),

  lead_pax                  text NOT NULL,
  lead_nationality          text,
  lead_type                 booking.lead_type NOT NULL DEFAULT 'AD',
  lead_foc                  boolean NOT NULL DEFAULT false,
  lead_phone                text,
  lead_email                text,

  hotel_name                text,
  room_number               text,
  pickup_area_id            uuid REFERENCES pickup_area(id) ON DELETE RESTRICT,
  pickup_zone               booking.zone NOT NULL DEFAULT 'PK',
  pickup_self               boolean NOT NULL DEFAULT false,
  dropoff_same              boolean NOT NULL DEFAULT true,
  dropoff_area_id           uuid REFERENCES pickup_area(id) ON DELETE RESTRICT,
  dropoff_hotel_name        text,

  guide_en                  boolean NOT NULL DEFAULT false,
  guide_ru                  boolean NOT NULL DEFAULT false,
  guide_zh                  boolean NOT NULL DEFAULT false,
  guide_other               text,

  special_meals_veg         integer NOT NULL DEFAULT 0 CHECK (special_meals_veg   >= 0),
  special_meals_vegan       integer NOT NULL DEFAULT 0 CHECK (special_meals_vegan >= 0),
  special_meals_halal       integer NOT NULL DEFAULT 0 CHECK (special_meals_halal >= 0),
  special_meals_allergy_note text,
  large_luggage             integer NOT NULL DEFAULT 0 CHECK (large_luggage >= 0),

  cash_on_tour_amount       numeric(12,2) CHECK (cash_on_tour_amount >= 0),
  cash_on_tour_currency     text,
  cash_on_tour_handling     text,
  cash_on_tour_note         text,

  price_mode                booking.price_mode NOT NULL DEFAULT 'rate',
  manual_total              numeric(12,2) CHECK (manual_total >= 0),
  total                     numeric(12,2) NOT NULL DEFAULT 0,

  purpose                   booking.purpose NOT NULL DEFAULT 'sale',
  staff_id                  uuid REFERENCES staff(id),
  staff_purpose             text,

  payment_method            booking.pay_method NOT NULL DEFAULT 'prepaid',
  payment_net_days          integer NOT NULL DEFAULT 0 CHECK (payment_net_days >= 0),
  payment_source            text NOT NULL DEFAULT 'contract'
                            CHECK (payment_source IN ('contract','b2c','override')),
  payment_contract_version  text,
  payment_status            booking.pay_status NOT NULL DEFAULT 'unpaid',
  invoice_id                uuid REFERENCES invoice(id) ON DELETE SET NULL,

  market_snapshot_market    text,
  market_snapshot_sub       text,
  market_snapshot_agent_id  uuid,
  market_snapshot_at        date,

  incomplete                text[] NOT NULL DEFAULT '{}',
  notes                     text,

  cancelled_at              timestamptz,
  confirmed_by              text,
  confirmed_at              timestamptz,

  version                   integer NOT NULL DEFAULT 1,
  created_at                timestamptz NOT NULL DEFAULT now(),
  created_by                text NOT NULL,
  updated_at                timestamptz,
  updated_by                text,

  -- A booking has a seller: an agent, or a B2C channel. Never neither.
  CONSTRAINT booking_has_seller CHECK (agent_id IS NOT NULL OR b2c_channel IS NOT NULL),
  -- Rate-priced bookings must name the card that priced them.
  CONSTRAINT booking_rate_needs_card
      CHECK (price_mode = 'manual' OR rate_type_id IS NOT NULL),
  CONSTRAINT booking_manual_needs_total
      CHECK (price_mode = 'rate' OR manual_total IS NOT NULL),
  CONSTRAINT booking_staff_needs_id
      CHECK (purpose = 'sale' OR staff_id IS NOT NULL)
);

-- One live booking per agent voucher reference. Cancelled-class rows do not collide.
CREATE UNIQUE INDEX booking_voucher_live_uq
  ON booking.booking (agent_id, voucher_ref)
  WHERE voucher_ref IS NOT NULL AND voucher_ref <> ''
    AND status NOT IN ('cancelled','cancelled_weather','rejected');
```

```sql
CREATE TABLE booking.booking_trip (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id               uuid NOT NULL REFERENCES booking.booking(id) ON DELETE CASCADE,
  trip_index               smallint NOT NULL CHECK (trip_index >= 0),
  route_id                 uuid NOT NULL REFERENCES route(id) ON DELETE RESTRICT,
  service_date             date NOT NULL,
  zone                     booking.zone,
  booking_mode             booking.mode NOT NULL DEFAULT 'seat',

  charter_boat_id          uuid REFERENCES boat(id) ON DELETE RESTRICT,
  charter_price_mode       booking.price_mode NOT NULL DEFAULT 'rate',
  charter_price_manual     numeric(12,2) CHECK (charter_price_manual >= 0),
  charter_price_note       text,
  charter_displacement_ack boolean NOT NULL DEFAULT false,

  pickup_time              text,
  ovn                      text CHECK (ovn IN ('return','self')),
  ovn_return_date          date,
  ovn_charge               numeric(12,2) CHECK (ovn_charge >= 0),
  ovn_leg                  boolean NOT NULL DEFAULT false,
  ovn_of_trip_id           uuid REFERENCES booking.booking_trip(id) ON DELETE SET NULL,

  subtotal                 numeric(12,2) NOT NULL DEFAULT 0,
  legacy_pax_shape         boolean NOT NULL DEFAULT false,

  UNIQUE (booking_id, trip_index),
  -- A charter trip must name its boat. This is the constraint that stops a
  -- half-configured charter from silently consuming zero seats and zero boats.
  CONSTRAINT trip_charter_needs_boat
      CHECK (booking_mode <> 'charter' OR charter_boat_id IS NOT NULL),
  CONSTRAINT trip_manual_charter_needs_price
      CHECK (charter_price_mode = 'rate' OR charter_price_manual IS NOT NULL),
  -- An overnight return leg is never itself an overnight outbound.
  CONSTRAINT trip_ovn_leg_has_no_ovn CHECK (NOT ovn_leg OR ovn IS NULL),
  -- A return leg must not carry a hotel pickup time; the guest is on an island.
  CONSTRAINT trip_ovn_leg_no_pickup  CHECK (NOT ovn_leg OR pickup_time IS NULL)
);

CREATE TABLE booking.booking_trip_pax (
  booking_trip_id uuid NOT NULL REFERENCES booking.booking_trip(id) ON DELETE CASCADE,
  pax_type        booking.pax_type NOT NULL,
  qty             integer NOT NULL CHECK (qty >= 0),
  PRIMARY KEY (booking_trip_id, pax_type)
);

CREATE TABLE booking.booking_passenger (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      uuid NOT NULL REFERENCES booking.booking(id) ON DELETE CASCADE,
  position        smallint NOT NULL CHECK (position >= 1),
  name            text NOT NULL CHECK (btrim(name) <> ''),   -- unnamed rows are not stored
  nationality     text,
  pax_type        booking.lead_type NOT NULL DEFAULT 'AD',
  is_foc          boolean NOT NULL DEFAULT false,
  is_lead         boolean NOT NULL DEFAULT false,
  UNIQUE (booking_id, position)
);
CREATE UNIQUE INDEX booking_one_lead_uq
  ON booking.booking_passenger (booking_id) WHERE is_lead;
```

```sql
CREATE TABLE booking.booking_addon (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid NOT NULL REFERENCES booking.booking(id) ON DELETE CASCADE,
  addon_type_id uuid NOT NULL REFERENCES addon_type(id) ON DELETE RESTRICT,
  route_id      uuid REFERENCES route(id),      -- for route-scoped add-ons
  axis_1        text,                           -- zone, when the type is a matrix
  axis_2        text,                           -- vehicle, when the type is a matrix
  label         text NOT NULL,                  -- resolved at commit, frozen
  unit_amount   numeric(12,2) NOT NULL DEFAULT 0,
  qty           integer NOT NULL DEFAULT 1 CHECK (qty >= 1),
  amount        numeric(12,2) NOT NULL DEFAULT 0,   -- frozen line total
  note          text
);

CREATE TABLE booking.booking_adjustment (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE CASCADE,
  kind       booking.adj_kind NOT NULL,
  mode       booking.adj_mode NOT NULL DEFAULT 'amount',
  value      numeric(12,2) NOT NULL CHECK (value >= 0),
  label      text,
  note       text,
  -- An extra charge is always an absolute amount; a percentage extra is not a product.
  CONSTRAINT adj_extra_is_amount CHECK (kind = 'discount' OR mode = 'amount')
);

CREATE TABLE booking.booking_price_breakdown (
  booking_id   uuid PRIMARY KEY REFERENCES booking.booking(id) ON DELETE CASCADE,
  seat         numeric(12,2) NOT NULL DEFAULT 0 CHECK (seat  >= 0),
  addon        numeric(12,2) NOT NULL DEFAULT 0 CHECK (addon >= 0),
  foc_discount numeric(12,2) NOT NULL DEFAULT 0 CHECK (foc_discount <= 0),  -- NEGATIVE
  discount     numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount     <= 0),  -- NEGATIVE
  extra        numeric(12,2) NOT NULL DEFAULT 0 CHECK (extra >= 0),
  total        numeric(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  computed_at  timestamptz NOT NULL DEFAULT now()
);
```

`foc_discount` and `discount` keep their negative sign, as today. That sign is relied on by
accounting; flipping it would be a silent doubling of every discount.

```sql
CREATE TABLE booking.booking_fee_item (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE CASCADE,
  fee_type   text NOT NULL,          -- 'reschedule' | 'cancellation' | 'other'
  label      text NOT NULL,
  amount     numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

CREATE TABLE booking.booking_alt_pickup (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES booking.booking(id) ON DELETE CASCADE,
  who         text,
  qty         integer NOT NULL DEFAULT 0 CHECK (qty >= 0),
  area_id     uuid REFERENCES pickup_area(id),
  zone        booking.zone,
  place       text
);
CREATE TABLE booking.booking_alt_pickup_pax (
  alt_pickup_id uuid NOT NULL REFERENCES booking.booking_alt_pickup(id) ON DELETE CASCADE,
  pax_type      booking.pax_type NOT NULL,
  qty           integer NOT NULL CHECK (qty >= 0),
  PRIMARY KEY (alt_pickup_id, pax_type)
);

CREATE TABLE booking.booking_history (
  id         bigserial PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE CASCADE,
  at         timestamptz NOT NULL DEFAULT now(),
  kind       text NOT NULL,      -- create | edit | cancel | restore | partial_cancel |
                                 -- reschedule | weather | approve | reject | foc_approve |
                                 -- foc_reject | ops | note | rebook
  title      text,
  body       text,
  tag        text,               -- display colour bucket
  actor      text NOT NULL
);
CREATE INDEX booking_history_bk_at ON booking.booking_history (booking_id, at DESC);
```

Append-only: grant `INSERT` and `SELECT` only. No `UPDATE`, no `DELETE` except by cascade.

### 9.4 Mutation records

```sql
CREATE TABLE booking.booking_cancellation (
  booking_id      uuid PRIMARY KEY REFERENCES booking.booking(id) ON DELETE CASCADE,
  category        text NOT NULL,     -- one of the 8 reason codes, §6.3
  category_label  text NOT NULL,
  reason_group    text NOT NULL CHECK (reason_group IN ('customer','operator','other')),
  note            text,
  charge_type     text NOT NULL CHECK (charge_type IN ('none','full','partial')),
  charge_amount   numeric(12,2) NOT NULL DEFAULT 0 CHECK (charge_amount >= 0),
  fee_invoice_id  uuid REFERENCES invoice(id),
  at              timestamptz NOT NULL DEFAULT now(),
  by_user         text NOT NULL,
  CONSTRAINT cancel_note_when_other CHECK (category <> 'other' OR btrim(coalesce(note,'')) <> ''),
  CONSTRAINT cancel_partial_needs_amount
      CHECK (charge_type <> 'partial' OR charge_amount > 0)
);

CREATE TABLE booking.booking_partial_cancel (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      uuid NOT NULL REFERENCES booking.booking(id) ON DELETE CASCADE,
  booking_trip_id uuid NOT NULL REFERENCES booking.booking_trip(id) ON DELETE CASCADE,
  service_date    date NOT NULL,
  pax_count       integer NOT NULL CHECK (pax_count > 0),
  category        text NOT NULL,
  category_label  text NOT NULL,
  reason_group    text NOT NULL,
  note            text,
  refund_mode     text NOT NULL CHECK (refund_mode IN ('none','full','partial')),
  refund_amount   numeric(12,2) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
  charged_count   integer NOT NULL DEFAULT 0 CHECK (charged_count >= 0),
  charged_amount  numeric(12,2) NOT NULL DEFAULT 0,
  waived_count    integer NOT NULL DEFAULT 0 CHECK (waived_count >= 0),
  waived_amount   numeric(12,2) NOT NULL DEFAULT 0,
  credit_note_id  uuid REFERENCES credit_note(id),
  at              timestamptz NOT NULL DEFAULT now(),
  by_user         text NOT NULL
);
-- One row per pax type removed: fixes the production schema that had columns for
-- only 2 of the 12 pax keys and silently dropped the rest.
CREATE TABLE booking.booking_partial_cancel_pax (
  partial_cancel_id uuid NOT NULL
      REFERENCES booking.booking_partial_cancel(id) ON DELETE CASCADE,
  pax_type          booking.pax_type NOT NULL,
  qty               integer NOT NULL CHECK (qty > 0),
  PRIMARY KEY (partial_cancel_id, pax_type)
);

CREATE TABLE booking.booking_reschedule (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     uuid NOT NULL REFERENCES booking.booking(id) ON DELETE CASCADE,
  from_date      date NOT NULL,
  to_date        date NOT NULL CHECK (to_date <> from_date),
  reason         text NOT NULL CHECK (btrim(reason) <> ''),
  charge_type    text NOT NULL CHECK (charge_type IN ('none','full','partial')),
  charge_amount  numeric(12,2) NOT NULL DEFAULT 0 CHECK (charge_amount >= 0),
  collect        text NOT NULL CHECK (collect IN ('invoice','separate')),
  source         text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','weather')),
  at             timestamptz NOT NULL DEFAULT now(),
  by_user        text NOT NULL
);

CREATE TABLE booking.booking_approval (
  booking_id      uuid PRIMARY KEY REFERENCES booking.booking(id) ON DELETE CASCADE,
  state           booking.approval_state NOT NULL DEFAULT 'pending',
  reason          text NOT NULL,          -- over_capacity | discount |
                                          -- over_capacity+discount | b2c_hold | closed_day
  target_status   booking.status NOT NULL DEFAULT 'confirmed',
  total_over      integer NOT NULL DEFAULT 0 CHECK (total_over >= 0),
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,   -- was dropped by the old schema
  sales_name      text,                                -- was dropped by the old schema
  requested_by    text NOT NULL,
  requested_at    timestamptz NOT NULL DEFAULT now(),
  approved_by     text,
  approved_at     timestamptz,
  note            text,
  CONSTRAINT approval_decided_has_actor
      CHECK (state = 'pending' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);

CREATE TABLE booking.booking_approval_over (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   uuid NOT NULL REFERENCES booking.booking_approval(booking_id) ON DELETE CASCADE,
  route_id     uuid NOT NULL REFERENCES route(id),
  service_date date NOT NULL,
  route_name   text NOT NULL,
  need         integer NOT NULL,
  cap_free     integer NOT NULL,
  over_by      integer NOT NULL CHECK (over_by > 0),
  licence_free integer NOT NULL
);

CREATE TABLE booking.booking_foc_approval (
  booking_id    uuid PRIMARY KEY REFERENCES booking.booking(id) ON DELETE CASCADE,
  foc_count     integer NOT NULL CHECK (foc_count > 0),
  reason        text NOT NULL CHECK (btrim(reason) <> ''),   -- mandatory, always
  state         booking.approval_state NOT NULL DEFAULT 'pending',
  requested_by  text NOT NULL,
  requested_at  timestamptz NOT NULL DEFAULT now(),
  approved_by   text,
  approved_at   timestamptz,
  reject_reason text
);

CREATE TABLE booking.booking_weather_resolve (
  booking_id   uuid PRIMARY KEY REFERENCES booking.booking(id) ON DELETE CASCADE,
  route_id     uuid NOT NULL REFERENCES route(id),
  event_date   date NOT NULL,
  state        text NOT NULL CHECK (state IN ('awaiting','notified','resolved')),
  outcome      text CHECK (outcome IN ('reschedule','refund','credit','cancel')),
  new_date     date,
  notified_at  timestamptz,
  resolved_at  timestamptz,
  resolved_by  text,
  CONSTRAINT weather_resolved_has_outcome
      CHECK (state <> 'resolved' OR outcome IS NOT NULL)
);

CREATE TABLE booking.booking_upgrade (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   uuid NOT NULL REFERENCES booking.booking(id) ON DELETE CASCADE,
  service_date date NOT NULL,
  from_boat_id uuid REFERENCES boat(id),
  to_boat_id   uuid REFERENCES boat(id),
  reason       text NOT NULL,
  charge       numeric(12,2) NOT NULL DEFAULT 0,
  at           timestamptz NOT NULL DEFAULT now(),
  by_user      text NOT NULL
);
```

### 9.5 Seat locks

```sql
CREATE TABLE booking.seat_lock (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id            uuid NOT NULL REFERENCES route(id) ON DELETE RESTRICT,
  scope               booking.lock_scope NOT NULL,

  lock_date           date,                     -- scope = 'day'
  date_from           date,                     -- scope = 'bulk'
  date_to             date,
  month_from          char(7),                  -- scope = 'month', 'YYYY-MM'
  month_to            char(7),
  dow                 smallint[] NOT NULL DEFAULT '{}',   -- 0..6, empty = every day

  holder_type         booking.lock_holder NOT NULL,
  holder_agent_id     uuid REFERENCES agent(id) ON DELETE RESTRICT,
  parent_id           uuid REFERENCES booking.seat_lock(id) ON DELETE RESTRICT,
  sub_name            text,

  qty                 integer NOT NULL CHECK (qty >= 0),   -- seats PER DEPARTURE
  release_days_before integer CHECK (release_days_before >= 0),
  release_time        time,

  status              booking.lock_status NOT NULL DEFAULT 'active',
  reason              text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          text NOT NULL,

  CONSTRAINT lock_agent_holder CHECK (holder_type <> 'agent' OR holder_agent_id IS NOT NULL),
  CONSTRAINT lock_scope_dates CHECK (
       (scope = 'day'   AND lock_date IS NOT NULL)
    OR (scope = 'bulk'  AND date_from IS NOT NULL AND date_to IS NOT NULL AND date_to >= date_from)
    OR (scope = 'month' AND month_from IS NOT NULL AND month_to IS NOT NULL AND month_to >= month_from)),
  -- A sub-group is one level deep. No grandchildren: the pool maths assumes two levels.
  CONSTRAINT lock_no_grandchildren CHECK (parent_id IS NULL OR sub_name IS NOT NULL)
);
CREATE INDEX seat_lock_route_active ON booking.seat_lock (route_id, status)
  WHERE parent_id IS NULL;
CREATE INDEX seat_lock_parent ON booking.seat_lock (parent_id) WHERE parent_id IS NOT NULL;

-- Enforce single-level nesting: a lock whose parent itself has a parent is illegal.
CREATE FUNCTION booking.seat_lock_depth_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM booking.seat_lock p
                  WHERE p.id = NEW.parent_id AND p.parent_id IS NOT NULL) THEN
    RAISE EXCEPTION 'seat_lock nesting is limited to one level';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER seat_lock_depth BEFORE INSERT OR UPDATE ON booking.seat_lock
  FOR EACH ROW EXECUTE FUNCTION booking.seat_lock_depth_guard();

-- Children may not over-allocate the parent.
CREATE FUNCTION booking.seat_lock_alloc_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_qty int; child_sum int;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  SELECT qty INTO parent_qty FROM booking.seat_lock WHERE id = NEW.parent_id;
  SELECT COALESCE(SUM(qty),0) INTO child_sum FROM booking.seat_lock
   WHERE parent_id = NEW.parent_id AND id <> NEW.id;
  IF child_sum + NEW.qty > parent_qty THEN
    RAISE EXCEPTION 'sub-groups (%) would exceed the parent lock qty (%)',
                    child_sum + NEW.qty, parent_qty;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER seat_lock_alloc BEFORE INSERT OR UPDATE ON booking.seat_lock
  FOR EACH ROW EXECUTE FUNCTION booking.seat_lock_alloc_guard();

CREATE TABLE booking.booking_trip_lock_draw (
  booking_trip_id uuid NOT NULL REFERENCES booking.booking_trip(id) ON DELETE CASCADE,
  seat_lock_id    uuid NOT NULL REFERENCES booking.seat_lock(id)   ON DELETE RESTRICT,
  qty             integer NOT NULL CHECK (qty > 0),
  drawn_at        timestamptz NOT NULL DEFAULT now(),
  drawn_by        text NOT NULL,
  PRIMARY KEY (booking_trip_id, seat_lock_id)
);
CREATE INDEX lock_draw_by_lock ON booking.booking_trip_lock_draw (seat_lock_id);

CREATE TABLE booking.seat_lock_log (
  id           bigserial PRIMARY KEY,
  seat_lock_id uuid NOT NULL REFERENCES booking.seat_lock(id) ON DELETE CASCADE,
  at           timestamptz NOT NULL DEFAULT now(),
  event        text NOT NULL,     -- create | draw | return | add_seats | release | expire | reactivate
  qty          integer,
  booking_id   uuid REFERENCES booking.booking(id) ON DELETE SET NULL,
  service_date date,
  note         text,
  by_user      text NOT NULL
);
```

`booking_trip_lock_draw` is the **single source of truth** for lock usage. There is no `used` column
anywhere. Note `ON DELETE RESTRICT` on `seat_lock_id`: a lock with live draws cannot be deleted, only
released.

### 9.6 The ops seam

See §7.2 for the `booking_ops` DDL. Two additions here:

```sql
CREATE INDEX booking_ops_by_date_boat ON booking.booking_ops (service_date, boat_id);
CREATE INDEX booking_ops_by_date_van  ON booking.booking_ops (service_date, van_id);
```

Both are hot: the daily manifest and the van job order are keyed exactly this way.

### 9.7 B2C, attachments, and the departure lock row

```sql
-- §8.2
CREATE TABLE booking.booking_b2c_link ( ... as shown in §8.2 ... );
CREATE TABLE booking.booking_b2c_field_override ( ... as shown in §8.2 ... );

-- The attachment table currently orphaned in schema `allotment`: 3,038 rows,
-- 118 of them pointing at a booking that does not exist.
CREATE TABLE booking.booking_attachment (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid REFERENCES booking.booking(id) ON DELETE CASCADE,
  legacy_booking_ref text,          -- what the old text column said, kept for the orphans
  filename    text NOT NULL,
  mime        text NOT NULL,
  size_bytes  integer NOT NULL CHECK (size_bytes >= 0),
  storage_key text NOT NULL,        -- object-store key; the bytes do NOT live in this row
  uploaded_by text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attachment_linked_or_flagged
      CHECK (booking_id IS NOT NULL OR legacy_booking_ref IS NOT NULL)
);
CREATE INDEX booking_attachment_bk ON booking.booking_attachment (booking_id);

-- §4.10(c) — the per-departure serialisation row.
CREATE TABLE booking.route_day_inventory (
  route_id     uuid NOT NULL REFERENCES route(id) ON DELETE RESTRICT,
  service_date date NOT NULL,
  version      bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (route_id, service_date)
);
```

Moving the attachment bytes out of the row and into object storage is a deliberate change: a 6 MB
`bytea` column on a table joined by every booking read makes every read expensive, and it is why a
whole-database copy currently drops attachments.

### 9.8 Indexes that matter

```sql
CREATE INDEX booking_status_date   ON booking.booking (status, booking_date DESC);
CREATE INDEX booking_agent         ON booking.booking (agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX booking_invoice       ON booking.booking (invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX booking_lead_trgm     ON booking.booking USING gin (lead_pax gin_trgm_ops);

-- The hottest query in the system: everything on one route, one day.
CREATE INDEX trip_route_date       ON booking.booking_trip (route_id, service_date);
CREATE INDEX trip_date             ON booking.booking_trip (service_date);
CREATE INDEX trip_booking          ON booking.booking_trip (booking_id);
CREATE INDEX trip_charter_boat     ON booking.booking_trip (charter_boat_id, service_date)
  WHERE booking_mode = 'charter';
```

`booking_lead_trgm` requires `pg_trgm`; it backs the duplicate-detection lookup on lead name, which is
a fuzzy match today.

### 9.9 Derived views

```sql
-- Apply the cancelled-status exclusion ONCE so no downstream query can forget it.
CREATE VIEW booking.v_live_booking AS
SELECT * FROM booking.booking
WHERE status NOT IN ('cancelled','cancelled_weather','rejected');

-- Does a pending_approval booking hold seats? §3.4
CREATE VIEW booking.v_booking_holds_seats AS
SELECT b.id AS booking_id,
       (b.status <> 'pending_approval'
        OR NOT COALESCE(a.total_over > 0
                        OR EXISTS (SELECT 1 FROM booking.booking_approval_over o
                                    WHERE o.booking_id = b.id), false)) AS holds_seats
FROM booking.booking b
LEFT JOIN booking.booking_approval a ON a.booking_id = b.id;

-- Seats consumed per (route, date). Charter trips excluded. Check-in losses subtracted.
CREATE VIEW booking.v_seats_consumed AS
SELECT t.route_id,
       t.service_date,
       GREATEST(0, SUM(p.qty) - COALESCE(MAX(l.lost_total), 0))::int AS seats_consumed
FROM booking.booking_trip t
JOIN booking.v_live_booking      b ON b.id = t.booking_id
JOIN booking.v_booking_holds_seats h ON h.booking_id = b.id AND h.holds_seats
JOIN booking.booking_trip_pax    p ON p.booking_trip_id = t.id
LEFT JOIN checkin_loss           l ON l.booking_id = b.id AND l.service_date = t.service_date
WHERE t.booking_mode = 'seat'
GROUP BY t.route_id, t.service_date;

-- The whole availability answer, one row per (route, date) that has a deployment.
CREATE VIEW booking.v_route_day_availability AS
WITH deploy AS (
  SELECT d.route_id, d.service_date, d.boat_id,
         d.effective_cap                                            AS cap,
         COALESCE(NULLIF(bo.licence_pax,0), d.effective_cap)         AS licence,
         d.is_charter
  FROM   boat_deployment d
  JOIN   boat bo ON bo.id = d.boat_id
),
cap AS (
  SELECT route_id, service_date,
         SUM(cap)                                        AS total_capacity,
         SUM(cap)     FILTER (WHERE is_charter)          AS charter_capacity,
         SUM(licence)                                    AS licence_total,
         SUM(licence) FILTER (WHERE is_charter)          AS charter_licence
  FROM deploy GROUP BY 1,2
)
SELECT c.route_id, c.service_date,
       c.total_capacity,
       COALESCE(c.charter_capacity,0)                             AS charter_capacity,
       c.total_capacity - COALESCE(c.charter_capacity,0)          AS available_capacity,
       c.licence_total  - COALESCE(c.charter_licence,0)           AS licence_capacity,
       COALESCE(s.seats_consumed,0)                               AS seats_consumed,
       COALESCE(k.locked_seats,0)                                 AS locked_seats,
       GREATEST(0, c.total_capacity - COALESCE(c.charter_capacity,0)
                   - COALESCE(s.seats_consumed,0)
                   - COALESCE(k.locked_seats,0))                  AS seats_available,
       GREATEST(0, c.licence_total - COALESCE(c.charter_licence,0)
                   - COALESCE(s.seats_consumed,0))                AS licence_available
FROM cap c
LEFT JOIN booking.v_seats_consumed  s USING (route_id, service_date)
LEFT JOIN booking.v_route_day_locked k USING (route_id, service_date);
```

> ⚠ **A view named `v_seat_availability` already exists in production and has drifted from the repo
> migration in both directions.** Build any view definition from `pg_get_viewdef` against the live
> database, never from a repo `.sql` file, and **supersede** the old view with a new, differently
> named one rather than editing it in place. The captured production definition (in
> `db/baseline/inventory.json`) does *not* implement the `pending_approval` seat-holding rule and does
> *not* subtract check-in losses, so it disagrees with the application. Reconcile before trusting it.

### 9.10 Old blob key → new table

The current system persists one JSON blob whose top-level keys map to tables. Booking's slice:

| Old blob key / field | New table | Note |
|---|---|---|
| `sb_bookings[]` | `booking` | |
| `sb_bookings[].trips[]` | `booking_trip` | |
| `trips[].pax{}` (12 keys) | `booking_trip_pax` (7 types) | Legacy `ad`/`chd`/`inf` → `*_fr`, flagged. |
| `trips[].seatSource{locked,general}` | derived from `booking_trip_lock_draw` | Not stored. |
| `trips[].lockDrawSel{}` | *(dropped)* | UI draft state; never durable data. |
| `trips[].lockDraws[]` | `booking_trip_lock_draw` | |
| `trips[].ops{}` (day 2+) | `booking_ops` | Merged with `bk.ops` (day 1). |
| `sb_bookings[].passengers[]` | `booking_passenger` | |
| `sb_bookings[].addOns[]` | `booking_addon` | |
| `sb_bookings[].adjustments[]` | `booking_adjustment` | |
| `sb_bookings[].priceBreakdown{}` | `booking_price_breakdown` | Signs preserved. |
| `sb_bookings[].ops{}` (day 1) | `booking_ops` | |
| `sb_bookings[].history[]` | `booking_history` | |
| `sb_bookings[].cancellation{}` + `cancelCategory` + `cancelReason` | `booking_cancellation` | The two flat mirrors are dropped. |
| `sb_bookings[].partialCancels[]` | `booking_partial_cancel` + `_pax` | Fixes the 2-of-12 pax column loss. |
| `sb_bookings[].reschedule{}` + `rebook{}` | `booking_reschedule` | `rebook` folds in with `source`. |
| `sb_bookings[].approval{}` + `approval.over[]` | `booking_approval` + `booking_approval_over` | Adds the two dropped columns. |
| `sb_bookings[].focApproval{}` | `booking_foc_approval` | |
| `sb_bookings[].weatherResolve{}` | `booking_weather_resolve` | |
| `sb_bookings[].feeItems[]` | `booking_fee_item` | |
| `sb_bookings[].upgrades[]` | `booking_upgrade` | |
| `sb_bookings[].altPickups[]` | `booking_alt_pickup` + `_pax` | |
| `sb_bookings[].attachments[]` | `booking_attachment` | Bytes move to object storage. |
| `sb_bookings[].b2cOverride[]` | `booking_b2c_field_override` | |
| `sb_bookings[].incomplete[]` | `booking.incomplete text[]` | |
| `sb_bookings[].editLock{}` | *(dropped)* | Replaced by real optimistic concurrency. |
| `sb_seat_locks[]` | `seat_lock` | `used` / `usedBy` **deleted**; now derived. |
| `sb_seat_locks[].log[]` | `seat_lock_log` | |
| `sb_agents[]` | `agent` | Reference data; not owned by booking. |
| `sb_rate_types[]` + 6 child keys | `rate_type` + children | Reference data. |
| `sb_weather[]` | `weather_closure` | Owned by boat operations. |
| `trips` (the boat-deployment map) | `boat_deployment` | Owned by boat operations. **Note:** the current table hard-codes one column set per boat (`b1_route`, `b2_route`, …) and silently dropped boats 8, 14 and 15. Model it as rows. |
| `sb_invoices` / `sb_payments` / `sb_deposits` | accounting tables | Not owned by booking. |
| `sb_extras` | `booking_extra` (accounting) | Deliberately a separate store, unaffected by booking edits. |

**Deliberately dropped, with reasons:**

| Dropped | Reason |
|---|---|
| `trips[].lockUse` | A UI mirror of the sum of `lockDrawSel`; not persisted today either. Derive it. |
| `bk.pickup` (v1 string) | v1-only; the only thing that reads it is a broken zone inference (§12 B-05). |
| `bk.code` as a separate field from `bk.id` | They are the same value today. One column: `code`. |
| `priceTiers.sell` / `.minSell` | Print-only; nothing computes from them. Keep them on the rate card, not the booking. |
| `rate_type_seat_rate.*_infant_*` | Columns exist in production but no code reads them; infants are always ฿0. Migrate them into an `archived_rates` JSON column if anyone objects, but do not wire them in. |
| `DATA_VERSION` / `FLEET_VERSION` markers | Client cache-versioning artefacts with no meaning in a relational store. |

---

## 10. REST API surface

### 10.1 Conventions

- Base path `/v1`. JSON in, JSON out, UTF-8. All dates are `YYYY-MM-DD` **local Asia/Bangkok**; all
  timestamps are RFC 3339 with an explicit offset.
- Money is a JSON number of baht with at most two decimals. Never a string, never satang-as-integer.
- **One error envelope for every failure:**

```json
{ "error": { "code": "LOCK_VIOLATION",
             "message": "This booking would take locked seats.",
             "details": [ { "route_id": "…", "service_date": "2026-08-05",
                            "need": 12, "seats_available": 4, "locked_seats": 9 } ],
             "request_id": "01J9…" } }
```

  `code` is a stable machine token; `message` is human text that may be localised; `details` is
  always an array; `request_id` appears in every log line for the request.
- Pagination is cursor-based: `?limit=50&cursor=<opaque>`, response
  `{ "data": [...], "next_cursor": "…"|null, "total_estimate": 1234 }`. Offsets are not offered —
  the busiest lists change under the reader.
- Every list endpoint applies the caller's row scope in SQL (§8.1).

### 10.2 Endpoint table

**Reads**

| Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|
| GET | `/v1/bookings` | List / filter | staff read, agent (own rows) | Filters: `date_from`, `date_to` (service date), `route_id`, `agent_id`, `status[]`, `channel`, `q` (code / voucher / lead name), `include_cancelled` (default false). Paginated. |
| GET | `/v1/bookings/{id}` | Full aggregate | staff read, agent (own) | Returns trips, pax, passengers, add-ons, adjustments, breakdown, ops, approvals, history. `id` accepts the uuid **or** the `code`. |
| GET | `/v1/bookings/{id}/history` | Audit trail | staff read | Paginated, newest first. |
| GET | `/v1/bookings/{id}/ops` · `/ops/{date}` | Operational assignment | staff read, fleet | §7.4 |
| GET | `/v1/manifest` | By-trip-date operational view | staff read, fleet | `?date=&route_id=`. One round trip, bounded query count. |
| GET | `/v1/availability` | Seat availability | staff read, B2C, agent | `?route_id=&date_from=&date_to=`. §10.6 |
| GET | `/v1/seat-locks` | List locks | staff read, agent (own) | `?route_id=&date_from=&date_to=&holder_type=&holder_agent_id=` |
| GET | `/v1/seat-locks/{id}` | One lock + its sub-groups, hold and draws | staff read | |
| GET | `/v1/seat-locks/{id}/claims` | Which live bookings drew from this lock | staff read | Derived from draw rows. |
| GET | `/v1/bookings/{id}/quote-preview` | Recompute the price without saving | staff read | Accepts a draft body; returns a breakdown. Writes nothing. |
| GET | `/v1/cancel-reasons` | The 8-entry reason catalogue | any session | Static reference. |

**Writes**

| Method | Path | Purpose | Auth | Transaction |
|---|---|---|---|---|
| POST | `/v1/bookings` | Create | staff `operations`, B2C, agent | Departure locks → gauntlet → insert all children → price → draws → charter hold → history |
| PATCH | `/v1/bookings/{id}` | Update named fields | staff `operations` | Departure locks **if** a trip date/route/pax changed → increase-only guard → update → re-price only if a pricing input changed → history |
| POST | `/v1/bookings/{id}/cancel` | Full cancel | staff `operations` | Status + cancellation + invoice void + fee invoice + return draws + release charter + history |
| POST | `/v1/bookings/{id}/restore` | Un-cancel | staff `operations` | Void fee invoice + re-draw (report shortfall) + retake charter where free + history |
| POST | `/v1/bookings/{id}/partial-cancel` | Reduce pax | staff `operations` | Reduce pax + return draws + **re-price** + credit note + record + history |
| POST | `/v1/bookings/{id}/reschedule` | Move trips to a new date | staff `operations` | Both departures locked + validate new date + move + clear ops + redraw + fee item + invoice top-up + history |
| POST | `/v1/bookings/{id}/weather-resolve` | Resolve a weather event | staff `operations` | Per outcome, §6.7 |
| POST | `/v1/bookings/{id}/approve` · `/reject` | Manager decision | staff `operations` + approver role | Status + approval + (on reject) release + history |
| POST | `/v1/bookings/{id}/foc-approve` · `/foc-reject` | FOC decision | staff `operations` + approver role | Status + foc_approval + (on reject) release + history |
| PATCH | `/v1/bookings/{id}/ops/{date}` | Operational assignment | staff `fleet` or `operations` | Ops row only. Never touches sales fields or money. |
| POST | `/v1/bookings/{id}/attachments` | Upload a document | staff `operations` | Multipart; stores bytes in object storage, row in `booking_attachment`. |
| DELETE | `/v1/bookings/{id}/attachments/{aid}` | Remove a document | staff `operations` | |
| POST | `/v1/seat-locks` | Create a lock | staff `operations` | |
| POST | `/v1/seat-locks/{id}/sub-groups` | Carve a sub-group | staff `operations` | Allocation guard (§9.5) |
| PATCH | `/v1/seat-locks/{id}` | Adjust qty / release rule | staff `operations` | Qty may not drop below the peak already drawn on any departure. |
| POST | `/v1/seat-locks/{id}/release` | Release the lock early | staff `operations` | Sets `status`; live draws are untouched. |

**Permission mapping.** `operations` is the booking-write area. `fleet` is the ops-row write area.
`accounting` may read bookings and write ledger. `sales` may read and manage agents and rate cards.
An agent token is restricted to `GET /v1/bookings` (own), `GET /v1/bookings/{id}` (own),
`GET /v1/availability`, and `POST /v1/bookings` (own agent id, forced server-side). The B2C token may
`GET /v1/availability` and `POST /v1/bookings`; it may **not** approve, cancel with a charge, or set a
price override.

### 10.3 Idempotency

Every `POST` that creates or changes state accepts an `Idempotency-Key` header (client-generated
UUID). It is **required** for `POST /v1/bookings` from the B2C and agent tokens, and optional but
honoured for staff.

```sql
CREATE TABLE booking.idempotency_key (
  key           text PRIMARY KEY,
  principal     text NOT NULL,
  endpoint      text NOT NULL,
  request_hash  text NOT NULL,          -- sha256 of the canonicalised body
  response_code integer,
  response_body jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

Semantics: insert the key inside the same transaction as the write. A replay with the same key and
the same `request_hash` returns the stored response verbatim with `Idempotency-Replayed: true`. A
replay with the same key and a *different* hash returns `409 IDEMPOTENCY_KEY_REUSE`. Rows expire
after 24 hours.

This matters most for `POST /v1/bookings`: a network timeout on the consumer website must not create
two bookings for one web order — which is exactly the shape that produced the `_1`/`_4` fan-out
confusion in §8.2.

### 10.4 Optimistic concurrency

The current system has a single global version counter on the whole dataset, which is advisory only:
being behind never blocks a write. Replace it with **per-row versioning**.

- Every `GET` of a booking returns `ETag: "<booking.version>"`.
- Every `PATCH` and every state-changing `POST` **must** send `If-Match: "<version>"`.
  - Missing header → `428 PRECONDITION_REQUIRED`.
  - Stale version → `412 PRECONDITION_FAILED` with the current version in `details`, so the client can
    refetch and merge.
- The write does `UPDATE booking SET …, version = version + 1 WHERE id = $1 AND version = $2`; zero
  rows affected means somebody else won, and the transaction rolls back.
- `booking_ops` carries its own `updated_at`; ops writes use `If-Unmodified-Since` rather than the
  booking version, so a dispatcher assigning a van does not conflict with a salesperson editing a
  phone number.

Row-level versioning plus the departure lock of §4.10(c) is the whole concurrency story. There is no
global counter and no whole-dataset diff.

### 10.5 Representative payloads

**Create a booking**

```
POST /v1/bookings
Idempotency-Key: 6f1c…
```

```json
{
  "status": "confirmed",
  "agent_id": "0f2a…",
  "voucher_ref": "AGT-12345",
  "booking_date": "2026-08-01",
  "lead_pax": "Jane Smith",
  "lead_nationality": "British",
  "lead_type": "AD",
  "lead_phone": "+66 81 000 0000",
  "hotel_name": "Example Resort",
  "room_number": "1204",
  "pickup_area_id": "aa11…",
  "pickup_self": false,
  "dropoff_same": true,
  "guides": { "en": true, "ru": false, "zh": false, "other": null },
  "price_mode": "rate",
  "trips": [
    {
      "trip_index": 0,
      "route_id": "r-similan",
      "service_date": "2026-08-05",
      "zone": "PK",
      "booking_mode": "seat",
      "pickup_time": "06:00-06:15",
      "pax": { "ad_fr": 2, "chd_fr": 1, "foc": 0 },
      "lock_draws": [ { "seat_lock_id": "lk-77…", "qty": 2 } ]
    }
  ],
  "passengers": [
    { "position": 1, "name": "Jane Smith", "nationality": "British", "pax_type": "AD", "is_lead": true },
    { "position": 2, "name": "John Smith", "nationality": "British", "pax_type": "AD" },
    { "position": 3, "name": "Amy Smith",  "nationality": "British", "pax_type": "CHD" }
  ],
  "addons": [
    { "addon_type_key": "longtail_join", "route_id": "r-similan", "qty": 1 }
  ],
  "adjustments": [],
  "acknowledge_duplicate": false,
  "acknowledge_off_contract": false
}
```

`201 Created`, `Location: /v1/bookings/BK-26080001-K3QM`, `ETag: "1"`:

```json
{
  "id": "9c7e…",
  "code": "BK-26080001-K3QM",
  "status": "confirmed",
  "version": 1,
  "price_breakdown": {
    "seat": 7800.00, "addon": 1700.00, "foc_discount": 0.00,
    "discount": 0.00, "extra": 0.00, "total": 9500.00
  },
  "total": 9500.00,
  "trips": [
    { "id": "t1…", "trip_index": 0, "route_id": "r-similan", "service_date": "2026-08-05",
      "zone": "PK", "booking_mode": "seat", "subtotal": 7800.00,
      "seat_source": { "locked": 2, "general": 1 },
      "lock_draws": [ { "seat_lock_id": "lk-77…", "qty": 2 }] }
  ],
  "warnings": [
    { "code": "UNUSED_AGENT_LOCK",
      "message": "This agent has 6 unused locked seats on r-similan 2026-08-05." }
  ]
}
```

`warnings[]` is advisory and never blocks. Anything blocking is an `error`.

**A hard block**

`409 Conflict`:

```json
{ "error": {
    "code": "LOCK_VIOLATION",
    "message": "This booking would take seats locked for another holder.",
    "details": [
      { "route_id": "r-similan", "route_name": "Similan Islands",
        "service_date": "2026-08-05",
        "need": 12, "seats_available": 4, "locked_seats": 9,
        "remedy": ["draw_lock", "add_boat", "release_lock"] }
    ],
    "request_id": "01J9…" } }
```

**An approval downgrade** — the write succeeds, at a different status:

`201 Created`:

```json
{ "code": "BK-26080002-P4TL", "status": "pending_approval", "version": 1,
  "approval": { "state": "pending", "reason": "over_capacity", "target_status": "confirmed",
                "total_over": 3,
                "over": [ { "route_id": "r-similan", "service_date": "2026-08-05",
                            "need": 15, "cap_free": 12, "over_by": 3, "licence_free": 18 } ] },
  "notice": "Saved as pending approval: 3 seats over the company cap, within the licensed seats." }
```

**Partial cancel**

```
POST /v1/bookings/9c7e…/partial-cancel
If-Match: "4"
```

```json
{ "booking_trip_id": "t1…",
  "pax_removed": { "ad_fr": 1, "chd_fr": 1 },
  "category": "sick",
  "note": "Two guests unwell",
  "refund_mode": "partial",
  "charged": { "count": 1, "amount": 1200.00 },
  "waived":  { "count": 1, "amount": 1300.00 } }
```

`200 OK`:

```json
{ "version": 5,
  "price_breakdown": { "seat": 5300.00, "addon": 1700.00, "foc_discount": 0.00,
                       "discount": 0.00, "extra": 0.00, "total": 7000.00 },
  "lock_draws_returned": [ { "seat_lock_id": "lk-77…", "qty": 1 } ],
  "credit_note_id": "cn-31…",
  "partial_cancel_id": "pc-9…" }
```

**Availability**

`GET /v1/availability?route_id=r-similan&date_from=2026-08-05&date_to=2026-08-06`

```json
{ "data": [
  { "route_id": "r-similan", "service_date": "2026-08-05",
    "has_allotment": true, "state": "tight",
    "total_capacity": 96, "charter_capacity": 30,
    "available_capacity": 66, "licence_capacity": 74,
    "seats_consumed": 48, "locked_seats": 9,
    "seats_available": 9, "licence_available": 26, "fill_pct": 86,
    "boats": [ { "boat_id": "b3", "capacity": 33, "is_charter": false },
               { "boat_id": "b7", "capacity": 33, "is_charter": false },
               { "boat_id": "b9", "capacity": 30, "is_charter": true } ] },
  { "route_id": "r-similan", "service_date": "2026-08-06",
    "has_allotment": false, "state": "not_deployed",
    "total_capacity": 0, "seats_available": 0 } ] }
```

### 10.6 The availability contract, stated as a promise

`seats_available` **is the answer**. Do not re-derive it, and do not add your own adjustments on top
of it. It already accounts for:

- per-day capacity overrides, clamped to the boat's licensed passenger count;
- chartered boats removed from the pool;
- agent seat locks subtracted, net of what has already been drawn;
- `pending_approval` bookings counted or not counted per §3.4;
- check-in losses added back;
- closed days forced to zero.

`state` explains a zero: `open` · `tight` · `full` · `all_chartered` · `not_deployed` · `closed`.

For **external** consumers (B2C, agent portal) the endpoint deliberately does **not** expose the two
tiers that staff can reach — drawing an agent's locks, and over-cap-within-licence with manager
approval. An external consumer sees only what it may sell without a human decision.

### 10.7 Error codes

| HTTP | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Malformed body; `details` lists field paths. |
| 401 | `UNAUTHENTICATED` | No or invalid credential. |
| 403 | `FORBIDDEN` | Authenticated but the principal may not do this. |
| 404 | `NOT_FOUND` | Missing, **or** out of the caller's row scope. |
| 409 | `LOCK_VIOLATION` | §4.9. No override exists. |
| 409 | `LICENCE_BLOCK` | §4.9. No override exists. |
| 409 | `ILLEGAL_TRANSITION` | Not in the §3.2 table. |
| 409 | `LEGACY_READ_ONLY` | `schema_version = 1`. |
| 409 | `IDEMPOTENCY_KEY_REUSE` | Same key, different body. |
| 412 | `VERSION_CONFLICT` | `If-Match` stale; `details.current_version`. |
| 422 | `MISSING_REQUIRED` | Business-required field absent (guard 4). |
| 422 | `CONFIRMATION_REQUIRED` | A `confirm`-class guard fired; `details.acknowledgement` names the flag to set. |
| 422 | `NO_RATE` | The rate card does not price this trip; `details.reason`. |
| 429 | `RATE_LIMITED` | |
| 503 | `DEPENDENCY_UNAVAILABLE` | The database or object store is unreachable. |

`CONFIRMATION_REQUIRED` is the mechanism for every "are you sure?" in the current UI. The server names
the acknowledgement flag; the client shows a dialogue and retries with that flag set. This keeps the
decision on the server and stops a client from skipping a confirmation by not implementing it.

---

## 11. Invariants that must move from the browser to the server

Today the anti-overbook guard, the seat-lock block, the licence-capacity block and the approval
routing all live in browser JavaScript. With four writers — staff app, consumer website, ERP, agent
portal — **browser guards are decoration**: any of the other three would happily oversell a boat.

Each row below states the invariant, where it lives today, and where it must live. "API transaction"
means inside the write transaction with the departure lock held; "DB constraint" means the database
refuses it regardless of which code path asked.

| # | Invariant | Today | Must live in |
|---|---|---|---|
| **I-01** | A booking can never consume seats reserved by somebody else's lock. | Browser `alert()` in the save path | **API transaction** (§4.9) + deferred constraint trigger asserting `family_drawn ≤ qty` |
| **I-02** | A booking can never exceed a boat's licensed passenger count. | Browser `alert()` | **API transaction**. No override exists for any principal. |
| **I-03** | Over the company cap but within licence ⇒ `pending_approval`, never `confirmed`. | Browser `confirm()` | **API transaction** — status is decided server-side; the client cannot ask for `confirmed` and get it. |
| **I-04** | A child seat lock contributes 0 to the pool; only parent/standalone locks hold seats. | Browser pool function | **DB view** (`v_seat_lock_hold` filters `parent_id IS NULL`) — structurally impossible to get wrong. |
| **I-05** | Lock usage equals the sum of live draw rows. | A stored counter plus four repair functions | **DB view** (`v_seat_lock_drawn`). The counter is deleted. |
| **I-06** | Sub-group quantities never exceed the parent's quantity. | Not enforced anywhere | **DB trigger** (§9.5) |
| **I-07** | Cancelled-class statuses are excluded from every aggregate. | Repeated by hand in ~8 places; a new aggregate must remember | **DB view** `v_live_booking`, used by every aggregate |
| **I-08** | A `pending_approval` booking held for over-capacity does not hold seats; every other reason does. | Browser predicate | **DB view** `v_booking_holds_seats`, consumed by `v_seats_consumed` |
| **I-09** | Charter trips consume no seats, and a chartered boat leaves the pool. | Browser filters, plus a periodic repair that mirrors `charter_boat_id` onto `ops.boat_id` | **DB view** for consumption; **trigger** for the ops mirror (not a repair job) |
| **I-10** | Two concurrent creates cannot oversell the last seat. | Not enforced at all — nothing serialises writers | **API transaction** with the `route_day_inventory` row lock (§4.10c) |
| **I-11** | Editing one field never destroys another. | 14 fields hand-copied in an `if (editing)` block | **Schema** — named-column `UPDATE`s. The class of bug disappears. |
| **I-12** | Every state change writes exactly one history row. | Called by hand at each site; easy to omit | **API transaction**, plus a test that asserts every mutation endpoint produces a history row |
| **I-13** | Money changes and status changes commit together. | Accounting is `try/catch`ed and only warns | **API transaction** — a failed invoice void rolls the cancellation back |
| **I-14** | An approval decision records who decided. | Browser prompt, not enforced | **DB constraint** `approval_decided_has_actor` |
| **I-15** | FOC approval requires a reason. | Browser prompt | **DB constraint** `reason` `NOT NULL` + non-empty check |
| **I-16** | A charter trip names its boat. | Not enforced; a half-configured charter consumed nothing | **DB constraint** `trip_charter_needs_boat` |
| **I-17** | An overnight return leg has no pickup time and prices ฿0. | A self-heal function run on every render | **DB constraint** for the pickup time; **pricing rule** for the ฿0 |
| **I-18** | A rate-priced booking names the rate card that priced it. | Browser required-field check | **DB constraint** `booking_rate_needs_card` |
| **I-19** | Only one live booking per agent voucher reference. | A confirm dialogue, overridable | **Partial unique index**, plus an explicit `acknowledge_duplicate` path that changes the voucher rather than duplicating it |
| **I-20** | An agent principal can only see and create its own bookings. | Does not exist — there is no agent portal yet | **Query layer**, enforced in SQL, returning 404 not 403 |
| **I-21** | Dates are Asia/Bangkok calendar dates. | `toISOString().slice(0,10)` in several places — UTC | **DB `date` type** + a single server-side "today" helper |
| **I-22** | Availability has exactly one implementation. | Two: the browser function and a drifted database view that disagrees with it | **One view**, `v_route_day_availability`, consumed by everything including the public endpoint |

**Rule for reviewers:** any pull request that adds a business rule to the client and not to the API is
rejected. Client-side checks exist for affordance — disabling a button, showing an inline hint — and
must never be the enforcement. A test that removes the client hint and asserts the API still refuses
the write is the cheapest way to keep this honest.

---

## 12. Known bugs — do NOT reproduce these

Every row is a defect confirmed by reading the running code or the production schema. Name each
regression test after the bug id.

| id | Bug | Current behaviour | Consequence | Required behaviour in the rewrite |
|---|---|---|---|---|
| **B-01** | Weather reschedule keeps stale ops | Resolving a weather event with outcome `reschedule` moves the trip date but does **not** clear boat, van, van group, van sequence, final pickup time or either check-in record. Every other date-change path clears them. | The booking appears on the **old** day's boat manifest and van job order. Guests are collected for a trip that has moved. | The weather reschedule runs the same ops-clearing routine as a manual reschedule (§6.7 step 3). One shared code path for "a trip's date changed", used by all three callers. |
| **B-02** | Partial cancel leaks seat locks | Reducing passengers decrements the counts and reduces the stored total. It never returns the seat-lock draws. | The lock stays marked as used for passengers who no longer exist; the agent loses allocation they still own, and availability is understated for everyone. | Return the draws proportionally to the removed passengers, in the same transaction (§6.5 step 2). |
| **B-03** | UTC date truncation | `created_at` and `booking_date` are produced by truncating a UTC timestamp to ten characters. Bangkok is UTC+07:00. | Any booking created between 00:00 and 07:00 local is stamped with **yesterday's** date. This shifts daily revenue reports, lead-time analytics and the monthly booking-code sequence. | Store `booking_date` as a `DATE`. Compute "today" as `now() AT TIME ZONE 'Asia/Bangkok'` in exactly one helper. Never truncate a UTC string. |
| **B-04** | Reschedule does not validate the new date | The target date is checked only for "not empty" and "different". Route seasons and availability are not consulted. | A reschedule can land on a day the route does not run, or on a departure that is already full. Nothing notices until somebody opens and re-saves the booking. | Run the route-open check and the §4.9 tiering against the new date, inside the same transaction, with both departures locked. |
| **B-05** | Calendar zone split is meaningless | The calendar's per-zone passenger split reads a legacy string field that the current booking form never writes. | Every current booking falls through to `PK`. The zone breakdown on the calendar is wrong for essentially the whole dataset, and has been for as long as the v2 form has existed. | Take the zone from `booking_trip.zone`, which is the field that actually prices the trip. Delete the legacy inference entirely. |
| **B-06** | Bundle suppression is booking-wide | A paid longtail bundle on **any** trip suppresses the optional `longtail_join` add-on for the **whole** booking. | On a two-route booking where only one route bundles, the join charge is dropped on the other route as well. Direct revenue loss on mixed bookings. | Suppress the add-on only for the trips whose route carries the bundle (§5.8 step 3). |
| **B-07** | Money is not transactional with status | Cancel calls the invoice void inside a `try/catch` that only logs a warning. | A failed void leaves a cancelled booking with a live invoice. The customer is billed for a trip that was cancelled. | Every money side effect commits in the same transaction as the status change; a failure rolls the whole thing back (I-13). |
| **B-08** | Invoice void does not reverse payments | Voiding an invoice marks it void but leaves its payment rows in place. | Payments remain attached to a void document. Agent statements and credit exposure are wrong. | Voiding reverses or explicitly re-links every payment row, in the same transaction, and records the reversal. |
| **B-09** | Approval discount and salesperson are dropped | The production `sb_bookings` table has columns for the approval status, reason, target status and over-count — but **none** for `approval.discount` or `approval.saleName`. | A discount-hold approval loses the discount amount and the name of the salesperson who must sign it off on the next database round-trip. The approval queue cannot show what it is approving. | `booking_approval.discount_amount` and `.sales_name` are real columns (§9.4). |
| **B-10** | Bulk-lock ranges and per-departure usage are not persisted | The production `sb_seat_locks` table has no `date_from`, `date_to`, `dow` or per-date used counter, although the application reads all four. | A `bulk`-scope lock loses its date range on the next round-trip and then matches no departure at all, so it silently stops holding seats. Per-departure usage resets, so a range lock re-holds its full quantity. **Verify against live data before migrating** — see OQ-2. | All four are real columns; usage is derived from draw rows keyed by `(lock, service_date)`. |
| **B-11** | Add-ons ignore the promotional rate | Seats and FOC are priced from the per-trip promotional rate card; add-ons are priced from the agent's base card. | A promotion that changes longtail prices has no effect. Harmless today only because no promotions exist in production. | Price add-ons from the same resolved per-trip card as seats. |
| **B-12** | Partial cancel never touches the invoice | The refund is applied as a plain reduction of the stored total. No credit note, no invoice amendment. | The booking total and the invoice disagree permanently. Accounting reconciles by hand. | Issue a credit note or amend the open invoice in the same transaction (§6.5 step 4). |
| **B-13** | Partial-cancel pax detail is truncated to 2 of 12 keys | The production child table has columns for `paxremoved_ad_fr` and `paxremoved_foc_th` only. | Removing children, Thai adults or infants records the count but not which type. The refund cannot be audited. | One child row per pax type (§9.4). |
| **B-14** | Status labels are incomplete | Two of the eight statuses have no display label and render as the raw enum string. | Staff see `pending_approval` and `cancelled_weather` untranslated in a bilingual UI. | Every status has an English and a Thai label, served from one place (§3.1). |
| **B-15** | `completed` is unreachable | No code path ever sets it, although it is guarded against and has a label. | The lifecycle has a dead state, and "cannot edit a completed booking" never fires. | Implement it, or remove it from the enum. See OQ-1. |
| **B-16** | Contract renewal is never persisted | Activating a contract renewal mutates the agent in memory and returns without saving. | A renewal is lost on the next reload. The agent silently keeps the old contract version, which is then snapshotted onto every subsequent booking. | Not a booking-domain fix, but booking consumes `contract_version` — treat any agent whose contract version looks stale as suspect during migration. |
| **B-17** | The add-on services master list is never persisted | The catalogue behind the agent-level add-on pricing screen is held in memory only; every edit is lost on reload. | Agent-level add-on pricing points at a list that resets to three seeded rows. | Persist it. Booking does not read it today, but the contract PDF does, and it is a data-loss bug on the same aggregate. |
| **B-18** | `ops.pfm` has no storage | The pre-departure data container is documented as part of the ops object; no column for it exists anywhere in production. | Either the feature is dead or it is silently losing data on every save. | Resolve before migration — see OQ-3. If live, it becomes a real column; if dead, delete the field from the model. |
| **B-19** | Availability has two disagreeing implementations | The application computes availability in the browser; a production database view computes it differently — it omits the `pending_approval` seat-holding rule and does not subtract check-in losses. | The public availability endpoint and the staff screen can disagree about the same departure. | One implementation, one view (I-22). Reconcile the two before cutover and document every difference found. |
| **B-20** | Deployment is stored as fixed per-boat columns | The boat-deployment table hard-codes one column set per boat (`b1_route`, `b2_route`, …). Boats 8, 14 and 15 had no columns. | Those boats' assignments silently vanished on every save. Adding a boat requires a schema change. | Rows, not columns: `boat_deployment(route_id, service_date, boat_id, …)`. |

---

## 13. Structural bug classes the rewrite deletes for free

These are not individual defects; they are shapes of defect that the current architecture makes
possible and the relational model makes impossible. They justify the schema work and they must not be
re-introduced by a "convenient" shortcut.

| Class | Why it exists today | Why it cannot exist after |
|---|---|---|
| **Edit-preserve** | Saving rebuilds the booking object from the form, so any field not manually copied in an `if (editing)` block is destroyed. Fourteen fields must be hand-copied; losing one silently wiped every boat and van assignment in production. | A `PATCH` updates named columns. Untouched columns are untouched. There is no rebuild step to forget a field in. |
| **Lock-counter drift** | Lock usage is a stored counter incremented on draw. Nothing decremented it on edit or cancel until late, so the counter drifted from reality and four repair functions exist to reconcile it. | Usage is a view over draw rows. The counter does not exist, so it cannot drift, and the repair functions are deleted rather than ported. |
| **Empty-array ambiguity** | Empty arrays are dropped by the storage layer, so the form crashes on `undefined.forEach` and needs a re-hydration hack on every load. A cleared list is indistinguishable from a list that was never set — which is also why three reference lists silently revert to seed data when cleared. | Child tables. Zero rows is a legitimate, unambiguous state that needs no sentinel and no re-hydration. |
| **Four-place field registration** | A new persisted field must be registered in the persist helper, in **both** client load paths, in the field mapper and in the model file, and a column must exist. Miss any one and the field saves with no error and is gone on the next load. Three different root causes produce that one symptom. | One migration adds the column; one schema definition validates it. There is no mapper and no second load path. |
| **Whole-blob read-modify-write** | Every save re-serialises the entire ~6 MB dataset through four different write paths, each of which must remember not to clobber sibling keys. One that forgets erases another module's data. | Per-row writes inside a transaction. A booking write touches booking rows and nothing else. |
| **Availability implemented twice** | The browser computes it, and a database view computes it for the public endpoint. They have drifted. | One view; every consumer, internal and external, reads it. |
| **Repair-on-render self-heals** | Several idempotent "healing" functions run on every render to fix data the write path got wrong — mirroring charter boats onto ops, resetting overnight legs, reconciling van groups. Each is a write during a read. | Constraints and triggers at write time. If the data cannot be written wrong, nothing needs healing on read. |
| **Permission gates that silently no-op** | Persist helpers return early for a read-only user, so their edits stay in memory and vanish on reload without any error. One helper is gated on a different permission area than the function it calls, so an accounting user's booking write silently disappears. | Authorisation is checked at the API boundary and returns 403. A write either happens or fails loudly. |

---

## 14. Acceptance criteria and test plan

### 14.1 Definition of done, per work package

1. Migrations are forward-only, checksummed and re-runnable; `migrate status` is clean.
2. The change is covered by a test that **fails without it**.
3. Anything replacing existing behaviour has a **parity test** against the fixture corpus (§14.3),
   or a written, deliberate deviation.
4. Type check, lint and the full test suite pass in CI against a throwaway PostgreSQL instance built
   from the baseline plus all migrations.
5. The OpenAPI document is regenerated and committed when the surface changes.
6. This document is updated in the same pull request when a rule changes.

### 14.2 Checkable acceptance statements

**Schema and constraints**

- A1. Inserting a booking with `booking_mode='charter'` and `charter_boat_id IS NULL` fails.
- A2. Inserting a sub-group whose quantities exceed the parent's quantity fails.
- A3. Inserting a seat lock whose parent already has a parent fails.
- A4. `booking_price_breakdown.discount > 0` fails (the sign convention is enforced).
- A5. Two live bookings for the same agent with the same non-empty `voucher_ref` cannot coexist;
      a cancelled one does not block a new one.
- A6. Every status value in the enum has an English and a Thai label, asserted by a test that
      iterates the enum.

**Availability**

- A7. For every *(route, date)* in the fixture corpus, `v_route_day_availability` returns the same
      `seats_available`, `seats_consumed`, `locked_seats` and `licence_available` as the existing
      implementation. Every difference is explained in writing, not adjusted away.
- A8. A `pending_approval` booking held for over-capacity does **not** appear in `seats_consumed`;
      one held for discount **does**.
- A9. A charter trip's passengers never appear in `seats_consumed`, and its boat's capacity never
      appears in `available_capacity`.
- A10. A month lock with a rolling release stops holding seats for a departure once the cut-off has
      passed, and still holds seats for the next departure in its range.
- A11. A parent lock with two sub-groups reduces the pool by the parent's quantity exactly once.

**Locks**

- A12. `SUM(booking_trip_lock_draw.qty)` for live bookings equals the derived `drawn` for every lock
      and every departure — **by construction**, so this test should be impossible to fail. If it
      ever fails, a stored counter has been re-introduced.
- A13. Editing a booking ten times leaves the lock's derived usage identical to editing it once.
- A14. Restoring a cancelled booking whose lock seats were taken meanwhile returns a shortfall in the
      response body and writes it to history.

**Concurrency**

- A15. N parallel `POST /v1/bookings` against a departure with N−1 free seats produce exactly N−1
      successes and one clean `409`. Run 100 iterations.
- A16. Two concurrent `PATCH`es with the same `If-Match` produce one success and one `412`.
- A17. A replayed `Idempotency-Key` with an identical body returns the original response and creates
      no second booking; with a different body it returns `409`.
- A18. Two multi-trip bookings covering the same two departures in opposite order do not deadlock
      (the departure locks are taken in a deterministic order).

**Mutations**

- A19. `PATCH { lead_phone }` on a booking with a boat and van assigned leaves every `booking_ops`
      row byte-identical, and leaves the price breakdown byte-identical.
- A20. Cancel with a forced invoice-void failure leaves the booking `confirmed` and the invoice live —
      nothing is half-applied.
- A21. Partial cancel returns lock draws, re-prices, and produces a credit note.
- A22. Weather reschedule clears the old day's `booking_ops` row.
- A23. Reschedule onto a closed day is refused.
- A24. Every mutation endpoint produces exactly one `booking_history` row. A test iterates the
      endpoint list and asserts it.
- A25. A `LOCK_VIOLATION` cannot be overridden by any principal, including an administrator token.

**Pricing**

- A26. For every fixture booking, the recomputed breakdown matches the stored breakdown to the
      satang. A mismatch is investigated, not tolerated — it means either the port is wrong or the
      stored value was already wrong.
- A27. Infants and FOC passengers contribute ฿0 to `seat` and are counted in capacity.
- A28. Charter `extra_per_pax` is charged only above `starter_includes`.
- A29. An overnight return leg prices ฿0 and its outbound trip carries the `ovn_charge` in `extra`.
- A30. A paid bundle on route A does not suppress the join add-on on route B (B-06).
- A31. `booking.total = booking_price_breakdown.total` and
       `booking_price_breakdown.seat = Σ booking_trip.subtotal` for every row.

**Authorisation**

- A32. An agent token requesting another agent's booking gets `404`, not `403`.
- A33. A B2C token calling `/approve` gets `403`.
- A34. A staff user without the `operations` area cannot `PATCH` a booking.
- A35. Removing a client-side hint never changes what the API accepts.

### 14.3 Parity testing against real data

The fixture corpus is the **oracle**. Without it, "the new API behaves like the old system" is an
unverifiable claim.

Export an anonymised slice of production — scrub names, phone numbers, e-mail addresses and passport
numbers; keep structure, dates, money and ids intact. The set **must** contain at least one of each:

- a multi-trip booking; a charter trip; an overnight pair (outbound plus return leg);
- a booking drawing from a parent lock, from a sub-group lock, and from a month lock with a rolling
  release;
- every one of the eight statuses, including `completed` if any row has it (see OQ-1);
- a `pending_approval` held for over-capacity (does **not** hold seats) and one held for a discount
  (**does**);
- a partially-cancelled booking; a rescheduled booking; a weather-resolved booking of each outcome;
- a B2C-sourced booking with a non-empty field-override list, and one of the 22 parentless `b2c_`
  bookings;
- a legacy `schema_version = 1` booking;
- a booking with a boat, a van and a van group assigned;
- a booking whose stored total does **not** equal the sum of its trip subtotals (partial cancels have
  produced these — see B-12; they are the interesting ones).

Ship a `MANIFEST` mapping each fixture to the rule it exercises, and a coverage script that fails the
build if any status or any listed shape is unrepresented.

**Parity procedure.** For each fixture: run the new pricing engine over its inputs and compare against
the stored breakdown (A26); run the new availability view over its *(route, date)* pairs and compare
against the existing implementation (A7). Record every difference in a table with a verdict:
`new_is_correct` (the old value was a bug — cite the bug id), `old_is_correct` (fix the port), or
`deliberate_deviation` (cite the reason). **A deviation with no verdict blocks the cutover.**

### 14.4 Migration verification

The data migration must emit a report containing:

- booking row count in = out;
- `SUM(total)` and `SUM(price_breakdown.total)` matching to the satang, before and after;
- count by status matching;
- passenger-count totals per *(route, date)* matching, which is what proves inventory did not shift;
- lock draw totals per *(lock, date)* matching the previously stored counters — **with the drift
  explicitly listed**, because the counters are known to be wrong (B-10, I-05);
- every booking that failed to migrate, with the reason. **Failing loudly beats dropping silently.**

The migration is idempotent and re-runnable, and is rehearsed against a production clone rather than
against fixtures.

---

## Appendix A · Open questions and contradictions to resolve

These do not block writing code, but several block shipping it. Each names who can answer it.

| id | Question | Why it matters | Suggested answer |
|---|---|---|---|
| **OQ-1** | Should `completed` exist? No booking code path sets it, yet it is in the type, has a display label, and three guards refuse to act on a `completed` booking. | The lifecycle currently has a dead state and the "cannot edit a completed booking" rule never fires. | **Implement it**: a scheduled job closes bookings whose last service date has passed and whose invoice is settled. The guards already assume it. Decide with operations. |
| **OQ-2** | Are there live `bulk`-scope seat locks in production, and do any have a date range? The table has no `date_from`/`date_to`/`dow`/per-date-usage columns, so those values cannot survive a round-trip (B-10). | If bulk locks are in use, their inventory effect is currently wrong and the migration will carry the wrong numbers across. If they are not, the feature is dead and the migration is trivial. | Query the live database: `SELECT scope, count(*), count(date) FROM sb_seat_locks GROUP BY scope`. Answer before `BK-02`. |
| **OQ-3** | Is `ops.pfm` live? It is documented as part of the ops container and no column for it exists anywhere in the production schema. | Either a feature is silently losing data on every save, or the field is dead and should be deleted from the model. | Ask boat operations whether the pre-departure fuel/manifest screen retains data across a reload. |
| **OQ-4** | Should rate-card validity dates gate pricing? Today neither the card-level nor the per-route validity is consulted when a trip is priced — an expired card still prices a booking. | It is deliberate (late-entered backlogs must price against the card in force at the time of sale) but surprising, and it means nobody notices an expired card. | Keep the behaviour, add a **warning** in the create/quote response when the trip date falls outside the resolved card's route validity. |
| **OQ-5** | Which side wins on conflict for a `b2c_` booking, per field? The ownership split is encoded implicitly in a field map and an override list, and is not written down. | `BK-06`-equivalent work cannot state which writer wins, and the fan-out into `_1`/`_4` rows has no documented trigger. | Produce a per-field ownership table with the consumer-website owner before the write API ships. |
| **OQ-6** | Money precision: production stores every money column as `bigint` whole baht. Do any real prices carry satang? | If not, `numeric(12,2)` is future-proofing and the "match to the satang" acceptance test is trivially satisfied. If some do, the current data has already been truncated and the migration must record it. | Check `SELECT count(*) FROM sb_bookings WHERE total <> round(total)` on the live data (it will be 0 given the column type) and confirm with accounting whether satang are ever quoted. |
| **OQ-7** | What is the disposition of the 22 parentless `b2c_` bookings and the 118 orphaned attachments? | A foreign key cannot be added to data that already violates it, and deleting production rows to make a constraint pass destroys evidence of a real process gap. | Carry both across flagged (`link_state='orphan'`, `legacy_booking_ref` populated), add the constraints as `NOT VALID` first, then validate after triage. |
| **OQ-8** | Is there a staging PostgreSQL instance, or only production? | The data migration and the cutover rehearsal both need a production clone. | Provision one before the migration work package starts. |
| **OQ-9** | Who owns `boat_deployment` during the strangle? Booking reads it for every availability calculation, but boat operations writes it and is not migrating in this phase. | Availability is the most-consulted number in the system and it depends on a table owned by the other side of the seam. | Expose deployment read-only through the same API from day one, even though its write path stays in the legacy system. Availability must not read the legacy store directly. |
| **OQ-10** | Does the reason catalogue for cancellations need a per-agent policy engine? Today the agent's contracted cancellation policy is displayed but never enforced; the operator picks the charge by hand. | Automating it would change money outcomes; leaving it manual keeps a known, accepted amount of judgement in the process. | Leave it manual in this phase. Record the policy text on the response so the operator sees it, and log which policy was displayed. |

**Contradictions found between documents and code** (the code won in every case):

| Claim | Source | Reality |
|---|---|---|
| "Booking v2 has three tabs" | An in-code comment and an older spec | There are six. |
| "`getAllotment` matches the production availability view" | Implied by both existing | They disagree: the view omits the `pending_approval` holding rule and check-in losses (B-19). |
| "`used` is the source of truth for lock usage" | Older documentation | The draw rows are; the counter is explicitly described in-code as untrustworthy. |
| "The schema has ~103 tables in one schema" | Several documents | 184 tables across four schemas, 56,832 rows, measured 2026-08-20. |
| "Attachments are part of the booking record" | Implied by the field name | They live in a different schema with no foreign key, and 118 are already orphaned. |
| "`ranong` is a planned pier" | Project instructions | The running code has first-class support for it. |

---

## 15. Suggested build order

Sixteen work packages. Each is small enough to be one pull request, each has an explicit done
condition, and each names what it depends on. `[serial]` must not run concurrently with anything
touching the same tables; `[parallel-safe]` can be fanned out.

### Foundation

**WP-01 · Migration tooling and a CI database** `[parallel-safe]`
Forward-only, checksummed migration runner with `up`, `status`, `new`. No automatic down migrations in
production. CI spins a throwaway PostgreSQL 18, applies the captured production baseline, then every
migration, then runs the suite against it.
*Done when:* CI goes empty database → migrated → tests green, and a tampered migration checksum fails
the run.
*Depends on:* —

**WP-02 · Characterisation fixtures** `[parallel-safe]`
The anonymised production slice of §14.3, plus the manifest and the coverage script.
*Done when:* every status and every listed shape has at least one fixture and the coverage script
fails the build when one is missing.
*Depends on:* —
*Note:* under-investing here is the single biggest risk in the plan. Every parity claim rests on it.

**WP-03 · Cross-schema ownership and the B2C contract** `[serial]`
Record, per table across all four schemas: owning system, live or dead, and whether any other schema
references it. Write the per-field ownership split for `b2c_` bookings (OQ-5) and the fan-out trigger.
Decide and record that the consumer-website booking and the ops booking stay **distinct entities
joined by a link table**.
*Done when:* every table has an owner and a live/dead verdict; the B2C contract is specific enough
that the write API can state which writer wins per field.
*Depends on:* —

**WP-04 · API skeleton and cross-cutting concerns** `[serial]`
Configuration validated at boot with fail-fast. Structured logging with a request id on every line.
The single error envelope of §10.1. Request and response validation from one shared schema source.
OpenAPI 3.1 generated from that source and served. Liveness and readiness probes. A CORS allow-list
with one origin per consumer class.
*Done when:* a request failing validation returns the standard envelope with a `request_id` that
appears in the logs, and the OpenAPI document renders.
*Depends on:* —

**WP-05 · Authentication and authorisation for four consumer classes** `[serial]`
Staff sessions with the four permission areas (`operations`, `sales`, `accounting`, `fleet`); service
tokens for the consumer website and the ERP; per-agent tokens with **row scoping enforced in SQL**.
*Done when:* A32, A33 and A34 pass.
*Depends on:* WP-04

**WP-06 · Rate types, read-only** `[parallel-safe]`
The minimum slice of the pricing domain that booking needs: `rate_type` plus seat rates, route
validity, route bundles, charter rates and the generic add-on price table of §5.6. Migrate from the
existing store, normalising the several historical longtail shapes at migration time so the old flat
shape never reaches the new schema. `GET /v1/rate-types` and `GET /v1/rate-types/{id}`.
*Done when:* for every fixture booking, the rate card it references resolves and returns seat rates
matching what the existing system read.
*Depends on:* WP-01

### The booking core

**WP-07 · The booking aggregate schema** `[serial]`
Every table in §9.3, §9.4, §9.6 and §9.7, with all constraints and indexes. An entity-relationship
diagram and a field-by-field mapping document covering **every** field in §2, including the ones
deliberately dropped and why.
*Done when:* the migration applies to the baseline; the mapping accounts for 100% of the fields in
§2; A1–A6 pass; a peer has signed it off.
*Depends on:* WP-01, WP-03

**WP-08 · Seat lock schema and the derived views** `[serial]`
§9.5 plus the four views and two functions of §4.10.
*Done when:* A11, A12 and A13 pass and no stored usage counter exists anywhere in the schema.
*Depends on:* WP-07

**WP-09 · Availability as a view and a service** `[serial]`
`v_seats_consumed`, `v_booking_holds_seats`, `v_route_day_availability`, and the single service
function every consumer calls. Build the definition from the live database, not from a repository
file, and supersede the existing production view rather than editing it.
*Done when:* A7, A8, A9 and A10 pass, and every difference from the existing implementation is
written down with a verdict.
*Depends on:* WP-07, WP-08, WP-02

**WP-10 · Pricing as pure functions** `[parallel-safe]`
The §5.8 algorithm as a standalone module with **no database access** — the caller supplies the rate
data. Seat, charter, bundle, add-on, FOC, adjustments, overnight, and the promotional overlay. The
write path calls it and freezes the result.
*Done when:* A26 through A31 pass. Note that A26 will surface bookings whose stored total already
disagrees with a recomputation (B-12); each must get a verdict, not a tolerance.
*Depends on:* WP-06

**WP-11 · The guard gauntlet, server-side** `[serial]` ⚠ **highest risk**
Every guard in §6.1 as an API-side check inside one transaction, with the departure locks of
§4.10(c), the §4.9 tiering, the edit-increase-only rule, and the B2C exemptions.
*Done when:* one table-driven test per guard passes against the fixtures; A15, A18 and A25 pass; and
no guard exists only in a client.
*Depends on:* WP-07, WP-08, WP-09, WP-10

**WP-12 · The read API** `[parallel-safe]`
List and filter with cursor pagination, the full aggregate, history, availability, seat locks, and the
manifest endpoint that returns everything the operational day view needs in one round trip.
*Done when:* the manifest request for the busiest fixture date issues a bounded number of queries
(assert it — no N+1), and agent row scoping passes.
*Depends on:* WP-07, WP-09, WP-05

**WP-13 · The write API** `[serial]`
Create, patch, and the eight action endpoints of §10.2. Idempotency keys, per-row optimistic
concurrency, and a history row per mutation.
*Done when:* A19, A16, A17, A24 pass, and cancel with a forced invoice-void failure rolls back
(A20).
*Depends on:* WP-11

**WP-14 · Lock draw and return as transactional operations** `[serial]`
Draw on create; return-then-redraw on edit; return on cancel and reject; redraw with an explicit
shortfall report on restore; proportional return on partial cancel. Holder priority
`agent → office → global` when no explicit source is picked.
*Done when:* A13, A14 and A21 pass and the "edit ten times, counted ten times" regression is
structurally impossible.
*Depends on:* WP-08, WP-13

**WP-15 · Fix the documented bugs** `[parallel-safe]`
One test per bug id in §12, each named after the bug and each failing against a deliberate
re-introduction of the old behaviour. B-01 through B-06 and B-11 through B-14 are in scope for this
phase; B-07, B-08, B-12 land with WP-13's transaction work; B-16, B-17 and B-20 belong to other
domains and are recorded, not fixed here.
*Done when:* every in-scope bug has a red-then-green test.
*Depends on:* WP-13

### Integration and cutover

**WP-16 · Data migration** `[serial]`
Backfill every table from the current production tables. Normalise the dual passenger shape into
`booking_trip_pax`. Collapse the day-1/day-2+ operational split into date-keyed `booking_ops` rows.
Empty arrays become zero child rows. Populate `booking_b2c_link` from the prefix convention and carry
the parentless rows across flagged. Attach the third-schema attachments through the new foreign key,
carrying their orphans flagged.
*Done when:* the §14.4 report shows zero unexplained losses; the run is idempotent; it has been
rehearsed against a production clone, not just fixtures.
*Depends on:* WP-07, WP-08, WP-02, WP-03

**WP-17 · Orphan triage** `[serial]`
A read-only scanner over **every** unenforced reference column, not only the three known sets, emitting
column, target, orphan count and sample values. A disposition per set — backfill, relink, soft-delete,
or accept and leave the column nullable with no constraint. Land the dispositions as a migration that
runs **before** the constraint-adding migration.
*Done when:* every reference column has a recorded disposition and the constraint migrations succeed
on a production clone. **Do not delete production rows to make a constraint pass.**
*Depends on:* WP-03
*Note:* only about eight reference paths gate this phase (agent, rate type, route, charter boat,
boat/van, pickup area, attachment→booking, b2c link). The rest belong to fleet, accounting and pier
and get constraints in their own phases. Run the full scan early anyway — it gates nothing and it
tells you what is quietly broken.

**WP-18 · The strangler bridge** `[serial]` ⚠ **riskiest integration**
Boat operations and vans stay in the legacy system and they read the ops container. Disable the legacy
booking screen and link out to the new one; implement a read-through adapter for the manifest and ops
reads; route the legacy system's ops writes through `PATCH /v1/bookings/{id}/ops/{date}`.
*Done when:* a full operational day works end to end through the adapter on a production clone —
assign boat, assign van, form a van group, produce a job order, pier check-in — and the adapter's
deletion criteria are written into the code.
*Depends on:* WP-13, WP-03

**WP-19 · Cutover and rollback** `[serial]`
A runbook covering the freeze window, the final migration run, the reconciliation check (counts and
money), the traffic switch, smoke tests, and a **rollback inside fifteen minutes** including how to
replay writes the new system accepted.
*Done when:* the full dry run is timed on a production clone and the rollback has been rehearsed at
least once and works.
*Depends on:* everything above

### Dependency graph

```
WP-01 ─┬─► WP-06 ──────────────► WP-10 ─┐
       ├─► WP-07 ─┬─► WP-08 ─┬─► WP-09 ─┼─► WP-11 ─► WP-13 ─┬─► WP-14
       │          │          │          │                    ├─► WP-15
       │          │          └──────────┘                    │
       │          └─► WP-12 ◄── WP-05 ◄── WP-04              │
WP-02 ─┴─► (oracle for WP-09, WP-10, WP-11, WP-16)           │
WP-03 ─┬─► WP-17 ─► WP-16 ◄──────────────────────────────────┘
       └─► WP-18 ◄─ WP-13
                       └────────────► WP-19
```

Critical path: **WP-01 → WP-07 → WP-08 → WP-09 → WP-11 → WP-13 → WP-19.** WP-04, WP-05, WP-06,
WP-10 and WP-12 can run alongside it. WP-02 must finish before WP-09 starts or the parity tests have
no oracle.

**One deliberate sequencing trade-off.** Deferring the data migration (WP-16) until after the schema
and API are built means production data does not fit the model until late. That risk is carried
entirely by WP-02: the fixtures must be a real anonymised production slice covering the awkward
shapes, not hand-written examples. Under-invest there and this trade turns bad.

---

## 16. Glossary

| Term | Meaning |
|---|---|
| **Add-on** | An optional extra sold alongside the seat: a longtail join, a whole longtail boat, a private transfer. Priced by the rate card, frozen onto the booking at commit. |
| **Agent** | A B2B buyer — a destination management company, an online travel agency, a hotel desk, a street counter. Bound to exactly one rate type. |
| **Allotment** | The seat pool for one *(route, date)*: how many seats exist, how many are consumed, how many are locked, how many are sellable. |
| **B2C** | The company's own consumer website, a separate application with its own database schema, that also writes bookings. |
| **Booking code** | The human reference, `BK-YYMMNNNN-XXXX`. Unique. Nothing may parse meaning out of it. |
| **Bulk lock** | A seat lock whose scope is a date range plus an optional set of weekdays. |
| **Cap** | A boat's **commercial** booking cap. Lower than the licensed count on purpose. A manager may approve exceeding it. |
| **Charter** | A trip where the group buys the whole boat. Consumes no seats; removes the boat from the pool. |
| **Charter hold** | The reservation of a boat for a date created when a charter booking commits. |
| **Check-in loss** | A passenger recorded at the pier as a no-show or an on-site cancellation. Their seat becomes sellable again for that departure. |
| **Departure** | One *(route, service date)* pair. The unit of inventory and the unit of the write lock. |
| **DMC** | Destination Management Company — a local operator that packages tours for foreign wholesalers. |
| **Draw** | Taking seats out of a seat lock for a booking. Recorded as a row, never as a counter. |
| **FOC** | Free of charge. A passenger who travels free by agreement. Occupies a real seat; the forgone revenue is recorded negatively. |
| **fr / th** | Foreigner / Thai national. The nationality split on every priced passenger type. |
| **House agent** | An internal pseudo-agent used to book non-agent business: `WALKIN`, `STAFF`, `B2C`. |
| **KL** | Khao Lak. A pickup zone. |
| **Lead pax** | The named person the booking is under. Occupies a real seat and is passenger #1. |
| **Licence pax** | A vessel's **registered** passenger capacity. A legal limit; no role may exceed it. |
| **Longtail** | เรือหางยาว — a traditional long-tail boat, sold as a joining fee per passenger or as a whole-boat charter. |
| **Manifest** | The operational list for a departure: who is aboard, on which boat, in which van. |
| **Month lock** | A seat lock scoped to one or more calendar months. Expires only when its whole range has passed. |
| **NoTransfer** | The pickup zone meaning the customer reaches the pier unaided; no transfer is priced in. |
| **Ops** | The container of operational assignment on a booking — boat, van, van group, check-ins — owned by boat operations and van dispatch, keyed by service date. |
| **OVN** | Overnight. A trip with an island stay and a return leg on a later date. The return leg holds seats but prices ฿0. |
| **Pax** | Passengers. Also used for a passenger-type bucket, e.g. `ad_fr`. |
| **PFM** | Pre-departure fuel and manifest data recorded by boat operations. Storage status unresolved — see OQ-3. |
| **Pier** | The departure point. `tublamu` (Tub Lamu, for Similan and Surin), `panwa` (Visit Panwa, for Phi Phi and Phang Nga), `ranong`. |
| **PK** | Phuket. A pickup zone. |
| **Pickup area** | A named collection point, e.g. "Patong". Determines the zone, which determines the price. |
| **Price breakdown** | The frozen six-part price: seat, add-on, FOC discount (negative), discount (negative), extra, total. |
| **Promo contract** | A time-boxed override binding an agent to a different rate card for specific routes and travel dates. |
| **Rate type** | A reusable price package. Seat rates by route × zone × pax type, charter rates, bundles, add-ons. Many agents share one. |
| **Rolling release** | A seat lock's per-departure cut-off: N days before that departure, at a stated time, its unused seats return to the general pool for that departure only. |
| **Route** | The product — Similan, Surin, Phi Phi, Phang Nga Bay, Whale Shark. Has a home pier and an operating calendar. |
| **Seat lock** | An agreement reserving N seats per departure on a route for a holder. Also called a seat allocation. |
| **Seat source** | Per trip, how the seats were obtained: `locked` (drawn from a lock) plus `general` (from the open pool). |
| **Service date** | The date of travel for one trip. Always an Asia/Bangkok calendar date. |
| **Sub-group** | A named child of a parent seat lock. Contributes 0 to the pool; only the parent holds seats. |
| **Van group** | A set of bookings sharing one outbound van, with a sequence for pickup order. |
| **Voucher ref** | The agent's own booking reference. Used for duplicate detection; unique among live bookings per agent. |
| **Zone** | `PK`, `KL` or `NoTransfer`. Where the customer is collected from, and therefore which seat price applies. |
| **ยกเลิก** | Cancelled. |
| **รออนุมัติ** | Pending approval. |
| **เหมาลำ** | Whole-boat charter. |
| **หางยาว** | Longtail boat. |
| **ห้ามเดา** | "Do not guess" — a standing instruction in this codebase: never auto-assign a van or a boat; surface the conflict for a human instead. |
| **รถปนกัน** | "Mixed vans" — the conflict raised when bookings that should share a van have been split across different ones. |
| **ที่นั่ง** | Seat. |
| **เรือ** | Boat. |

---

*Written against commit `094dde1` on `refactor/booking-v2-migration`, verified against the production
schema baseline of 2026-08-20 (PostgreSQL 18.4, four schemas, 184 tables, 56,832 rows). Where an older
document contradicted the running code, the code won and the contradiction is recorded in Appendix A.*
