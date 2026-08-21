# 02 · Fleet & Boat Assignment — rebuild specification

> **Audience:** the developer who will rebuild this domain from scratch on PostgreSQL 18 behind a REST API.
> **Written against:** commit `094dde1` on `refactor/booking-v2-migration`, verified against the live monolith source on 2026-08-22.
> **Framework-neutral by instruction.** DDL, endpoint tables, JSON shapes and language-agnostic pseudocode only. The reference implementation will be FastAPI + PostgreSQL, but nothing in this document may depend on that.
> **Currency** ฿ (THB). **Timezone** Asia/Bangkok, UTC+07:00, no DST. **UI** bilingual Thai/English.

---

## 0. Your assignment

### What you are building

A **fleet and dispatch service** for a Phuket marine day-tour operator: the system of record for

1. **hulls** — 15 company vessels plus ad-hoc chartered hulls, their legal papers, their operating pier, and their availability over time;
2. **drivetrain assets** — engines, gearboxes and propellers, where each one is physically mounted, how many hours it has run, and when it is next due for service;
3. **maintenance** — incidents, maintenance jobs, long-running drydock/overhaul projects, parts withdrawal, purchase memos, and the money attached to all of it;
4. **daily operating logs** — fuel litres, ฿/L, and engine meter readings per boat per day;
5. **boat assignment** — deciding which vessel carries which guests on a given route and date;
6. **pier operations** — crewing, equipment issue/return, duty roster, marine licences, guest check-in, and the day-close documents;
7. **transfer vans** — the road fleet that collects guests from hotels, the grouping of bookings into vans, the printed driver job orders, and the morning van check-in.

### Why it is being rebuilt

All of the above currently lives inside **one 83,651-line HTML file** (`allotment_v2/allotment_v2.html`) that keeps the entire application state as a single ~6 MB JSON blob in browser RAM, diffs it, and pushes it to Postgres through a generic mapper. That architecture has produced a specific, repeating class of failure:

- **Business rules live in the browser.** Capacity guards, drivetrain link invariants, pier enum checks and conflict detection are all client-side JavaScript. There are already four writers against this database (the ops app, the B2C website, an ERP/accounting consumer, and a partner portal). Browser-side guards are decoration when three of the four writers are not that browser.
- **A new persisted field must be registered in four separate places** (client global, persist helper, *both* load paths, and the server mapper) or it silently disappears on the next round-trip. The symptom is always "I filled it in, it saved, I refreshed, it's gone."
- **Open-ended keyed data is stored as fixed columns.** The `trips` table hardcodes `b1_route`, `b2_route`, … one set of columns per boat. Boats `b8`, `b14` and `b15` were missing from those columns from the start, so any schedule that used *Tadeo*, *Juliet* or *Rolanda* was silently discarded on sync. Adding a boat today requires editing `server.js` by hand.
- **Derived state is stored, and repaired by "self-heal" passes on load.** Boat status, van group membership and charter-hull mirroring are all reconciled by idempotent sweep functions that run on every page load, because the model allows them to drift in the first place.
- **Whole-blob read-modify-write.** Every save re-serialises the entire application state. Concurrency control is a single optimistic version counter across everything.

### What already exists

| | State on 2026-08-22 |
|---|---|
| The monolith | **Live production** at `rsvn.loveandaman.com`. Staff use it every day. It is not legacy — treat it as live software. |
| The platform (API + SPA) | **Planned and specified, not yet built.** No `platform/` directory exists on any branch. |
| Rewrite progress | Only the schema baseline task (`P0-01`) is done; its output is in `db/baseline/`. |
| Booking rewrite | Not started. Booking migrates **first** under the strangler-fig plan; fleet keeps living in the monolith for at least one more phase. |

The production database has **four schemas, 184 tables, 56,832 rows**. `operation_schemas` (133 tables) is the ops app. `love_kingdom` (39 tables) is a **live second writer** used by the B2C site. `allotment` holds 3,038 booking attachments. There are **no PostgreSQL enum types anywhere** — every status column is free text. **126 columns look like foreign keys but have no constraint behind them**, and orphan rows already exist.

### What "same business logic, better foundation" means here

**Parity of business logic is the point of this document.** Every operational rule that exists today appears below with the reason it exists. Staff have already been burned by each of these rules being wrong once; do not re-derive them from first principles.

What changes is *where* the rules live:

| Today | In the rebuild |
|---|---|
| A rule enforced by a browser `alert()` | An API-side transactional check, or a DB constraint |
| Derived state stored and repaired by a self-heal sweep | A view, or a constraint that prevents the drift |
| A composite string key like `2026-08-20::v3` | A real composite primary key `(service_date, van_id)` |
| Fixed per-entity columns (`b1_route`, `b2_route`, …) | One row per entity per day |
| A free-text status column | A lookup table plus a foreign key |
| A blob key that silently drops unmapped fields | A migration and a typed column |

Where current behaviour is a **bug**, this document says so explicitly and specifies the correct behaviour instead. Those are collected in §13. Do not reproduce them.

### Non-negotiables

1. **ห้ามเดา — "never guess."** The system surfaces conflicts for a human to resolve. It never silently picks a boat or a van. This is a deliberate product decision by the ops team, restated in §5.6 and §7.9 with its reasoning. Automatic assignment exists only behind an explicit button the dispatcher presses.
2. **Three capacity numbers, three behaviours.** `cap` (commercial booking cap), `cap + tolerance` (assignment ceiling), `licence_pax` (legal ceiling). They are not interchangeable. §5.5.
3. **The pier enum is `tublamu` | `panwa` | `ranong`.** Never `visitpanwa`, never the display strings "Tub Lamu" / "Visit Panwa". Enforce it with a lookup table and a foreign key so the error class stops existing. §2.4.
4. **1 engine = 1 gearbox = 1 propeller** at a drive position, and a spare must be detached. Enforce with constraints, not with a nightly sweep. §3.3.
5. **Engine meter readings ≤ 0 are placeholders, not data.** Reject them at write time. §3.5.
6. **Cancelled bookings never count.** The three cancelled statuses `cancelled`, `cancelled_weather`, `rejected` are excluded from every pax, revenue, load and capacity aggregate, everywhere, without exception.
7. **All dates are Asia/Bangkok local dates.** A service date is a calendar date in `+07:00`, not a UTC instant. Never derive a `YYYY-MM-DD` by truncating a UTC timestamp — that shifts the date backwards for everything before 07:00 local.
8. **Money is `numeric`, never floating point.** Fuel litres and engine hours are `numeric(10,1)`.
9. Keep Thai operational vocabulary in the UI where staff already use it, and gloss it in English everywhere it appears in an API contract or a log line. English/ASCII only in error messages, log output and audit notes.

---

## 1. The business

### 1.1 What the company sells

**LOVE Andaman** runs marine day-tours out of Phuket and Phang Nga. A guest buys a **seat on a boat** for a specific **route** on a specific **date**, and — almost always — a **road transfer** that collects them from their hotel in the morning and returns them in the afternoon.

Routes run from two operating piers:

| Pier code | Display name | Thai | Routes |
|---|---|---|---|
| `tublamu` | Tub Lamu | ท่าทับละมุ | Similan Islands (5 programmes), Surin Islands |
| `panwa` | Visit Panwa | ท่าวิสิษฐ์พันวา | Phi Phi + Bamboo (4 programmes), Krabi + Phang Nga Bay, Whale Shark / Phi Phi / Maiton Sunset |
| `ranong` | Ranong | ระนอง | none yet — see §1.3 |

Similan and Surin close for the monsoon: the seeded route seasons are open 15 Oct → 15 May and closed 16 May → 14 Oct. Phi Phi and Phang Nga programmes run year-round.

> **Naming trap.** `panwa` is displayed as **"Phuket"** in the sidebar, **"Visit Panwa"** in most tables, and **"ท่าวิสิษฐ์พันวา"** in the boat-operation popover. Three labels, one value. Store the value; render the label from the lookup table.

### 1.2 The fleet

15 company hulls are seeded, plus chartered hulls registered ad hoc through a "+ เรือเช่า" (*add rental boat*) action. CLAUDE.md says "~16 vessels"; the seed list has 15 and the colour palette has 16 slots. Verify against production before quoting a number to anyone.

| Id | Name | Type | Pier | `cap` | `licence_pax` | Crew | `total_cap` |
|---|---|---|---|---:|---:|---:|---:|
| `b1` | Aluminous1 | Catamaran | tublamu | 64 | 75 | 5 | 80 |
| `b2` | Artemis | Speedboat | tublamu | 65 | 75 | 5 | 80 |
| `b3` | Okeanos | Speedboat | tublamu | 56 | 75 | 4 | 79 |
| `b4` | Irena | Speedboat | tublamu | 56 | 70 | 5 | 75 |
| `b5` | Andaman Ryder | Speedboat | tublamu | 56 | 70 | 5 | 75 |
| `b6` | Zeus | Speedboat | tublamu | 40 | 47 | 3 | 50 |
| `b7` | Verona | Speedboat | tublamu | 34 | 45 | 3 | 48 |
| `b8` | Tadeo | Speedboat | tublamu | 38 | 47 | 3 | 50 |
| `b9` | Romeo | Speedboat | tublamu | 34 | 45 | 3 | 48 |
| `b10` | Aluminous2 | Catamaran | panwa | 44 | 75 | 5 | 80 |
| `b11` | Achilles | Speedboat | panwa | 65 | 75 | 5 | 80 |
| `b12` | Hermetis | Speedboat | panwa | 65 | 75 | 5 | 80 |
| `b13` | Oceanus | Speedboat | panwa | 38 | 45 | 3 | 48 |
| `b14` | Juliet | Speedboat | panwa | 34 | 45 | 3 | 48 |
| `b15` | Rolanda | Speedboat | panwa | 38 | 47 | 3 | 50 |

`total_cap = licence_pax + crew` in every seeded row — it is the total persons the vessel may legally carry, guests plus crew.

### 1.3 Ranong: what is actually true

CLAUDE.md describes `ranong` as "planned." **That is stale, and the code disagrees.** Verified in the monolith source:

- `ranong` is a **first-class value of the pier enum**. It appears in permission areas (`po-ranong`, `poj-ranong`, `pol-ranong`, `poa-ranong`), the navigation tree, four fully-rendered pier-office views with their own DOM mount points, the pier colour/label/name tables, the fleet calendar's pier list, dashboard KPI counters, the Daily Fleet Log's third section, the Boat Status page's third group, and the inventory warehouse list (`คลัง Ranong`).
- The pier resolver maps a status location containing `ranong`, `grand andaman` or `se la va` to `ranong`, deliberately, so that Grand Andaman Pier does not fall through to the `tublamu` default.
- **No seeded boat and no seeded route uses `pier = 'ranong'`.** It is a fully-wired, currently-empty third pier.

**Build all three piers as first-class rows in a lookup table from day one.** A fourth pier must be one `INSERT` and nothing else.

### 1.4 The daily operational rhythm

This is what makes everything below legible. A trip date `D` runs like this.

| When | Step | What happens |
|---|---|---|
| D−30 … D−1 | **Deploy the fleet** | For each route × date, ops picks which hulls run it. Only hulls that are `available` that day and whose pier matches the route's pier are offered. |
| any | **Weather cancel** | A route × date can be closed; every affected booking is tagged for sales to resolve. |
| D−3 … D−1 | **Document check** | Agent vouchers verified against attachments, optionally OCR-assisted. |
| D−2 … D−1 | **Assign bookings to boats** | Per route, each seat booking is dropped onto one of that route's deployed hulls. |
| D−1 | **Re-confirm** | Every agent's pickup list is confirmed by phone/WhatsApp; a per-agent sheet is printed. |
| D−1 | **Crew the boats** | Captain / assistant / crew / island staff per hull, wristband colour, per-boat notes, licence check. |
| D−1 | **Assign guides** | Government guide job order (มัคคุเทศก์) issued per hull. |
| D−1 evening | **Daily Report** | Pre-departure management summary (pax, boats, vans, finance) plus an emailable HTML version. |
| D morning | **Van check-in** | At the hotels: actual pax vs booked, no-show reasons. |
| D morning | **Pier check-in** | Three stages per booking: ถึงท่า (arrived) → เคลียร์ (cleared) → ขึ้นเรือ (boarded). Money collected, extras sold, meals and allergies recorded. |
| D morning | **Kitchen order** | Meals per hull, counted on heads that will actually travel, not booked heads. |
| D morning | **Guide job sheet** | Crew-facing manifest, one A4 landscape page per hull. |
| D morning | **Equipment issue** | Towels, masks, fins issued per hull. |
| D | **Departure** | There is no explicit "departed" flag. The boarding timestamp on every row is the de-facto signal. |
| D afternoon | **Equipment close-out** | What came back, what is dirty / to repair / lost (+ fine). |
| D evening | **Travel Summary** | Day-close: who actually travelled, penalty decisions for no-shows and on-site cancels, cash collected by method, Cash-on-Tour settlement, full manifest. |
| D evening | **Daily Fleet Log** | Fuel litres, ฿/L and engine meter readings per hull, locked per pier when saved. |
| monthly | **Duty roster** | Derived from the boat job sheets over a 26→25 cycle, hand-overridable per cell. |
| rolling | **Marine licences** | Captain/engineer certificates, expiry warnings, per-boat coverage check. |

The **trip-day pipeline** from a guest's point of view:

```
hotel pickup -> van (grouped, sequenced) -> pier -> check-in (arrive / clear / board)
             -> boat -> trip -> back to pier -> return van (per booking) -> drop-off
```

Two roles own two halves of that pipeline and they must not be conflated:

- **Sales and Booking** decide *how many people* go out, and at what price.
- **Fleet and Dispatch** decide *which hulls are physically able to go out*, which hull carries whom, which van collects whom, and what it costs to keep the hulls running.

### 1.5 Who uses this system

| Role | Where | What they do here |
|---|---|---|
| Ops / dispatch office (Phuket HQ) | Boat Operation, Fleet Calendar, Boat Assign, Van Assign | Deploy hulls to route×date; assign bookings to hulls; group bookings into vans; weather-cancel |
| Fleet / pier supervisor (Tub Lamu, Visit Panwa) | Daily Fleet Log, Incidents, Maintenance, Inventory, Projects | Record fuel and meter readings; open incidents; run maintenance jobs; move engines; withdraw parts |
| Pier staff | The four per-pier office pages, pier check-in | Crew the hulls, issue equipment, keep the roster and licences, check guests in, collect money, close the day |
| Sales-ops / admin | Doc-Check, Re-confirm, Daily Report | Verify agent paperwork, confirm pickup times, publish the pre-departure report |
| Drivers | Printed / PNG van job orders | Drive the route the job order lists |
| Accounting | Cost Analytics, Fuel Intelligence, trip P&L | Read fleet cost and fuel numbers |

Permission areas today: `operations`, `pier`, `fleet`, `sales`, `accounting`, `config`, `overview`. `pier` was split out of `operations` later, so the pier permission check **deliberately falls back to `operations`** for accounts created before the split. Preserve that fallback in the rebuild's authorization layer or you will lock out existing pier accounts on day one.

> **Read-only mode is currently a lie.** In the monolith, a view-only fleet user still mutates the in-memory objects; only the persist call is skipped, with no feedback. In the rebuild, authorization is checked at the API boundary and a refused write returns `403` with a message the UI must surface. Never let a user type into a control whose write will be silently dropped.
---

## 2. Boats

A boat is a hull. It has an identity, a legal registration, three different capacity numbers, a set of physical specifications, and a **history of availability over time**.

### 2.1 Every field

Types below are the target PostgreSQL types, not the current JavaScript ones.

| Field | Type | Null? | Meaning | Written by |
|---|---|---|---|---|
| `id` | `text` PK | no | Stable identifier. Today `b1`…`b15` plus generated ids for chartered hulls. Keep the existing ids on migration — they are referenced by ~2,873 booking-trip rows, the `trips` table, maintenance jobs, incidents, engines, pier job sheets and equipment ledgers. | registry create |
| `name` | `text` | no | Display name, e.g. `Aluminous1`. Unique within active boats. | registry |
| `type` | `text` FK → `boat_type` | no | `Speedboat` \| `Catamaran` today. Lookup table, not free text. | registry |
| `ownership` | `text` FK → `boat_ownership` | no | `company` \| `charter`. Chartered hulls are excluded from almost every fleet aggregate. Today the check is `ownership !== 'charter'`. | registry |
| **Location** | | | | |
| `pier_code` | `text` FK → `pier` | no | **Operational home pier** — which pier this hull normally works from. One of `tublamu`, `panwa`, `ranong`. | registry, pier assignment |
| `homeport_city` | `text` | yes | **Legal registration province** (e.g. `ภูเก็ต`). This is what appears on the vessel's papers. Unrelated to `pier_code`. | registry |
| `homeport` | `text` | yes | Legal home port as written on the registration (e.g. `ท่าการ พังงา`). Free text from the certificate. | registry |
| **Capacity — three different numbers** | | | | |
| `cap` | `integer` | no | **Booking cap.** How many seats the company chooses to sell on this hull. Commercial, adjustable. | registry, per-day override |
| `licence_pax` | `integer` | yes | **Registered passenger seats** — the legal maximum from the vessel licence. Hard ceiling. Fallback when null: `cap`. | registry |
| `total_cap` | `integer` | yes | Total persons on board including crew = `licence_pax + crew`. Informational; used on legal paperwork. | registry |
| `crew` | `integer` | yes | Registered crew complement. | registry |
| `engine_count` | `integer` | no | Number of drive positions. Drives the position vocabulary (§3.1). | registry |
| **Specifications** | | | | |
| `material` | `text` | yes | Hull material, e.g. `อลูมิเนียม` (aluminium), fibreglass. | registry |
| `gt` | `numeric(8,2)` | yes | **Gross tonnage.** Load-bearing: marine licence coverage is checked against it. | registry |
| `nt` | `numeric(8,2)` | yes | Net tonnage. | registry |
| `loa` | `numeric(6,2)` | yes | Length overall, metres. | registry |
| `beam` | `numeric(6,2)` | yes | Beam (width), metres. | registry |
| `depth` | `numeric(6,2)` | yes | Moulded depth, metres. | registry |
| `draft` | `numeric(6,2)` | yes | Draft, metres. | registry |
| `lbp` | `numeric(6,2)` | yes | Length between perpendiculars, metres. | registry |
| `dwt` | `numeric(8,2)` | yes | Deadweight tonnage. Almost always null for these hulls. | registry |
| `bhp` | `numeric(8,2)` | yes | **Total brake horsepower.** Load-bearing: engineer licence coverage is checked against it. | registry |
| `year_built` | `integer` | yes | Build year. | registry |
| **Legal** | | | | |
| `reg_no` | `text` | yes | Registration number, e.g. `6051/0271/4`. | registry |
| `callsign` | `text` | yes | Radio call sign. | registry |
| `imo` | `text` | yes | IMO number. Empty for coastal vessels. | registry |
| `owner_name` | `text` | yes | Registered owner legal name. | registry |
| `owner_address` | `text` | yes | Registered owner address. | registry |
| **Lifecycle** | | | | |
| `retired` | `boolean` | no, default false | Retired hulls are filtered out of nearly every aggregate. Never delete a boat row — retire it. | retire action |
| `retired_at` | `date` | yes | | retire action |
| `retired_reason` | `text` | yes | | retire action |
| `colour` | `text` | yes | Stable per-boat identity colour used across every screen. | registry |

Child collections:

| Collection | Shape | Notes |
|---|---|---|
| `boat_document` | `{doc_type, expires_on, renew_status, file_ref}` | Vessel licence (ใบอนุญาตใช้เรือ), survey certificate (ใบสำคัญรับรองการตรวจเรือ), park permits (e.g. ใบอนุญาต สิมิลัน). Expiry drives warnings. |
| `boat_status_period` | see §2.2 | The availability history. |
| `boat_pier_assignment` | `{type, from_pier, to_pier, start_date, end_date, reason, cost, status}` | A temporary or permanent move to another pier. |
| `boat_repair_history` | denormalised summary rows appended when a maintenance job closes | Kept for the boat detail page; derivable from `maintenance_job`, but currently stored. See §4.2. |

> **Do not rename or delete any of these fields on migration.** Mark unused ones inactive instead. Several are read by the B2C availability API and by accounting.

### 2.2 The status log: append-only log as current state

Today a boat's availability lives in an **append-only array of interval entries**, and the *current* status is derived by scanning it:

```
log[] = [{ id, s, from, to, loc?, note?, reason?, projectId? }, ...]

  s      'available' | 'fixing' | 'unavailable' | 'retired'
  from   inclusive start date (YYYY-MM-DD, Asia/Bangkok)
  to     inclusive end date, or NULL = still ongoing
  loc    free-text physical location while in this state
  note   free-text; often carries a maintenance-job number like "MJ-014"
  reason free-text or a code such as 'dry_dock'
```

**Resolution rule as implemented today**, for a query date `D`:

```
sort entries by (from DESC, insertion_order DESC)
return the first entry where from <= D AND (to IS NULL OR to >= D)
if none matches, default to { s: 'available' }
```

The `insertion_order DESC` tiebreak is not decoration — it is a **bug fix**. Two entries with the same `from` used to be resolved by array order, so "start fixing today, then change your mind and set Available today" still read as *Fixing*. The later-recorded entry must win on a tie.

Entries never overlap: when a new entry is written, an auto-close step truncates or splits any earlier entry that would overlap it.

**Why the pattern exists.** Ops needs to answer three different questions from the same data: *what is this boat doing right now*, *what was it doing on 15 October*, and *show me the timeline*. A single mutable `status` column answers only the first. Keep the interval model.

#### Relational replacement

```
boat_status_period(
  id, boat_id, status_code, valid_from date, valid_to date NULL,
  location_text, note, reason_code, project_id, recorded_at timestamptz, recorded_by
)
```

with an **exclusion constraint** so overlaps are impossible rather than merely discouraged:

```sql
EXCLUDE USING gist (
  boat_id WITH =,
  daterange(valid_from, COALESCE(valid_to, 'infinity'::date), '[]') WITH &&
)
```

and a derived view:

```sql
CREATE VIEW v_boat_status_on AS ...   -- status of every boat on a given date
CREATE VIEW v_boat_current_status AS  -- convenience: v_boat_status_on for CURRENT_DATE at +07
```

**Killing the "last entry wins" race.** With the exclusion constraint there is no tie to break: two periods with the same `valid_from` on the same boat cannot both exist. The write path becomes an explicit transactional operation, not an append:

```
BEGIN
  SELECT ... FROM boat_status_period WHERE boat_id = :b FOR UPDATE;   -- serialise writers on this boat
  -- truncate/split any period overlapping [new.valid_from, new.valid_to]
  UPDATE boat_status_period SET valid_to = :new_from - 1 day
    WHERE boat_id = :b AND valid_from < :new_from
      AND (valid_to IS NULL OR valid_to >= :new_from);
  DELETE FROM boat_status_period
    WHERE boat_id = :b AND valid_from >= :new_from
      AND (:new_to IS NULL OR valid_from <= :new_to);
  INSERT INTO boat_status_period (...) VALUES (...);
COMMIT
```

Two concurrent status changes now serialise on the row lock; the second one sees the first one's period and truncates against it. The exclusion constraint is the backstop: if the logic is ever wrong, the transaction aborts instead of producing a boat with two simultaneous statuses.

> **Open question OQ-1.** The status log currently carries a `retired` value in `s` *and* there is a separate `retired` boolean on the boat. Confirm with ops whether retirement should remain dual-encoded (a period plus a flag) or whether the flag should be derived from an open `retired` period. The spec below keeps both, because unretire writes an `available` period and clears the flag, and analytics filter on the flag.

### 2.3 Location disambiguation — three questions, three fields

Staff ask three different questions in Thai and today they resolve to three different fields. Getting this wrong produces confidently-wrong answers.

| Thai question | English | Field | Notes |
|---|---|---|---|
| อยู่ท่าไหน | *Which pier does it operate from?* | `boat.pier_code` | The commercial/operational home pier. This is what filters the boat picker when deploying to a route. |
| ตอนนี้อยู่ที่ไหนจริง | *Where is it physically right now?* | current `boat_status_period.location_text`, else fall back to `boat.pier_code` | The hull may be at a shop, at another pier, or on a delivery run. |
| จดทะเบียนจังหวัดอะไร | *Which province is it registered in?* | `boat.homeport_city` (and `homeport` for the port name) | Pure paperwork. Never used for dispatch. |

There is a **fourth, derived** answer that dispatch actually uses — the *effective pier on a date*. Today's resolver, in priority order:

1. If the boat has an `inprogress` maintenance job **with a non-empty location** *and* the boat's status on that date is not `available` → the effective pier is the pseudo-pier **`shop`**.
2. Else, if an active pier-assignment row covers that date → its `to_pier`.
3. Else, keyword-match the status period's `location_text`: `panwa` → `panwa`; `ranong` / `grand andaman` / `se la va` → `ranong`; `tub` / `tublamu` / `tab lamu` → `tublamu`.
4. Else, `boat.pier_code`; if that is empty, `tublamu`.

Step 3 is a **string-matching hack** and must not survive the rewrite. Replace it: `boat_status_period` gets a nullable `location_pier_code` FK alongside the free-text `location_text`, so the pier is stored, not guessed. Keep `location_text` for the human-readable detail ("Grand Andaman Pier", "อู่ Honda Phuket").

Step 1 depends on a date, and there was a real bug here: opening the calendar for 15 October read the *status* for that date but the *pier* for today, so a boat could vanish from both the available and unavailable lists. **Every pier resolution must take the query date.** No caller may use "today" implicitly.

#### How the API exposes all three unambiguously

`GET /fleet/boats/{id}` returns them as separate, named fields — never one collapsed "location":

```json
{
  "id": "b3",
  "name": "Okeanos",
  "operating_pier": { "code": "tublamu", "label_en": "Tub Lamu", "label_th": "ท่าทับละมุ" },
  "registration": { "homeport_city": "ภูเก็ต", "homeport": "ท่าการ พังงา", "reg_no": "6051/0271/4" },
  "physical_location": {
    "as_of": "2026-08-22",
    "pier_code": "shop",
    "text": "อู่ Honda Phuket",
    "source": "maintenance_job",
    "source_ref": "MJ-014"
  }
}
```

`physical_location.source` is one of `maintenance_job` | `pier_assignment` | `status_period` | `home_pier`, so a caller can always tell *why* it got that answer. Every response that reports a location must carry its `source`.

### 2.4 The pier enum, and making the error class impossible

**Exact values:** `tublamu`, `panwa`, `ranong`. Plus one **derived pseudo-value `shop`** that is never stored — it is only ever produced by the effective-pier resolver.

Forbidden, and each has been written by mistake at least once: `visitpanwa`, `"Visit Panwa"`, `"Tub Lamu"`, `"tab lamu"`, `Phuket`.

**Make it structural:**

```sql
CREATE TABLE pier (
  code          text PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9_]{1,23}$'),
  label_en      text NOT NULL,
  label_th      text NOT NULL,
  label_short   text NOT NULL,            -- 'TL' | 'VP' | 'RN'
  long_name_th  text,                     -- 'ท่าวิสิษฐ์พันวา'
  display_group text,                     -- sidebar grouping: 'Phuket' for panwa
  colour        text,
  sort_order    integer NOT NULL,
  active        boolean NOT NULL DEFAULT true
);
INSERT INTO pier VALUES
  ('tublamu','Tub Lamu','ท่าทับละมุ','TL','ท่าเรือทับละมุ','Tub Lamu','#185FA5',1,true),
  ('panwa',  'Visit Panwa','ท่าวิสิษฐ์พันวา','VP','ท่าวิสิษฐ์พันวา','Phuket','#0F6E56',2,true),
  ('ranong', 'Ranong','ระนอง','RN','ท่าเรือระนอง','Ranong','#BA7517',3,true);
```

Every column that names a pier is `text REFERENCES pier(code)`. No `CHECK (pier IN (...))` lists scattered across tables, no free text. Adding a fourth pier is one `INSERT`; a typo is a foreign-key violation at write time, not a boat that quietly disappears from a list.

The API accepts and returns `code` only. Labels are resolved server-side for print documents and returned as a nested object (see §2.3) so no client ever hardcodes a display string.

### 2.5 Boat Status UI grouping

The Boat Status screen groups hulls into sections. **CLAUDE.md documents this incorrectly** — it says the groups are `pier + last.s === 'fixing'`. The code actually groups by the *derived effective pier*, which returns `shop` only for an `inprogress` maintenance job that has a non-empty location **and** leaves the boat non-available.

**Specify the corrected rule**, in fixed section order:

| Section | Membership rule (for query date `D`) |
|---|---|
| **Tub Lamu** | `effective_pier(boat, D) = 'tublamu'` |
| **Visit Panwa** | `effective_pier(boat, D) = 'panwa'` |
| **Ranong** | `effective_pier(boat, D) = 'ranong'` |
| **🔧 In Shop** | `effective_pier(boat, D) = 'shop'` |
| **Charter** | `ownership = 'charter'` — rendered as its own block below the company list |

Consequences to preserve:

- **"In Shop" cuts across piers.** A hull in the shop leaves its pier group entirely; it does not appear twice.
- **A `fixing` boat with no maintenance-job location stays in its pier group**, showing a `FIXING` status pill. Being under repair is not the same as being *away*. Staff rely on this: a boat being fixed on the pier is still on the pier.
- Status (`available` / `fixing` / `unavailable`) is shown as a per-row pill, **not** as a grouping tier.
- Retired hulls are excluded from all sections.

The API exposes this directly so no client re-implements it:

```
GET /fleet/boats?as_of=2026-08-22&group_by=effective_pier
→ { "groups": [ { "pier_code": "tublamu", "label_en": "Tub Lamu", "boats": [...] },
                { "pier_code": "shop", "label_en": "In Shop", "boats": [...] } ] }
```

---

## 3. Drivetrain: engines, gearboxes, propellers

The drivetrain is a three-link chain, mounted at a **drive position** on a hull:

```
boat  --(drive position)-->  engine  -->  gearbox  -->  propeller
```

Ownership of the link is by pointer, not by boat: the gearbox points at the engine, the propeller points at the gearbox. That is deliberate and must be preserved, because when an engine comes off the boat the gearbox does **not** follow it (§3.4).

### 3.1 Drive positions — exact, and ordered

The canonical vocabulary, in physical order from port to starboard:

| Position | Rank | Meaning |
|---|---:|---|
| `Port` | 0 | Outer port |
| `C.Port` | 1 | Centre-port (inner port) |
| `Center` | 2 | Centre |
| `C.Std` | 3 | Centre-starboard (inner starboard) |
| `Std` | 4 | Outer starboard |

**Suzuki calls the outer starboard position "Starboard".** Honda calls it "Std". They are the same physical position. The monolith normalises `Starboard`, `Stbd` and `Starb` all to `Std`, and gives all of them rank 4. An unrecognised label gets rank 98 so it sorts last rather than being dropped.

The positions actually offered depend on `engine_count`:

| `engine_count` | Positions offered |
|---:|---|
| 1 | `Center` |
| 2 | `Port`, `Std` |
| 3 | `Port`, `Center`, `Std` |
| 4 | `Port`, `C.Port`, `C.Std`, `Std` |
| 5+ | `Port`, `C.Port`, `Center`, `C.Std`, `Std` |

Note that a **4-engine boat has no `Center`** — the two inner positions are `C.Port` and `C.Std`.

> **Trap in the current code, do not copy it.** One modal's position `<select>` is hardcoded in HTML with a *different* vocabulary — `Port / Starboard / Centre / C.STBD / P1 / P2 / S1 / S2` — and is overwritten at runtime by the correct list. Reading the static markup as the enum will give you the wrong values.

#### Relational equivalent

An **ordered lookup table**, not a string:

```sql
CREATE TABLE drive_position (
  code       text PRIMARY KEY,     -- 'Port' | 'C.Port' | 'Center' | 'C.Std' | 'Std'
  label_en   text NOT NULL,
  sort_rank  smallint NOT NULL UNIQUE
);
CREATE TABLE drive_position_alias (
  alias      text PRIMARY KEY,     -- 'Starboard', 'Stbd', 'Starb'
  code       text NOT NULL REFERENCES drive_position(code)
);
```

Ingest normalises through `drive_position_alias` at the API boundary; only canonical codes are ever stored. Sorting is `ORDER BY dp.sort_rank`, never alphabetical (alphabetical puts `C.Port` before `Center` before `Port` — visually scrambled).

A boat's usable positions are derived, not stored:

```sql
CREATE VIEW v_boat_drive_position AS
  SELECT b.id AS boat_id, dp.code, dp.sort_rank
  FROM boat b JOIN drive_position dp ON dp.code = ANY (
    CASE b.engine_count
      WHEN 1 THEN ARRAY['Center']
      WHEN 2 THEN ARRAY['Port','Std']
      WHEN 3 THEN ARRAY['Port','Center','Std']
      WHEN 4 THEN ARRAY['Port','C.Port','C.Std','Std']
      ELSE        ARRAY['Port','C.Port','Center','C.Std','Std']
    END);
```

### 3.2 Asset fields

**Engine**

| Field | Type | Meaning |
|---|---|---|
| `id` | `text` PK | |
| `brand`, `model`, `serial` | `text` | `serial` is the field staff quote. Unique among non-retired engines. |
| `hp` | `numeric` | Rated horsepower. |
| `boat_id` | `text` FK, null | Null = detached (spare or in the shop). |
| `position_code` | `text` FK → `drive_position`, null | Must be null exactly when `boat_id` is null. |
| `status_code` | `text` FK → `asset_status` | `ready` \| `fixing` \| `broken` \| `spare` \| `limited` \| `retired`. |
| `base_hours` | `numeric(10,1)` | Accumulated hours **before** this system started logging meters. |
| `service_interval` | `numeric(10,1)` | Hours between services. `0` = no cycle. |
| `last_service_hours` | `numeric(10,1)`, null | Engine hours at the last recorded service. Null = never serviced. |
| `last_service_date` | `date`, null | |
| `spare_location_code` | `text` FK → `storage_location`, null | Non-null ⇒ this asset is a spare. See §3.3. |
| `retired` | `boolean` | |

**Gearbox**

Same identity fields plus:

| Field | Meaning |
|---|---|
| `engine_id` | FK to the engine it is bolted to. Null = detached. |
| `boat_id` | Denormalised convenience today; **derive it** from `engine.boat_id` in the rebuild. |
| `on_boat_id`, `on_boat_position_code` | "คาเรือ รอเครื่อง" — *left on the boat, waiting for an engine*. Set during an engine swap when the gearbox stays at the drive position while its engine is pulled. **This is not a spare** and must never be swept into the spare pool. |
| `install_hours` | Engine hours at the moment this gearbox was installed; the baseline for its own lifetime calculation. |
| `shaft_length`, `model_suffix` | Compatibility attributes. Nothing enforces compatibility today (§3.4). |
| `service_interval` | Defaults to 200 h when unset. |
| `last_service_hours` | Null ⇒ the service state assumes *now*, so a never-serviced gearbox does not immediately show as overdue. |

**Propeller**

| Field | Meaning |
|---|---|
| `gearbox_id` | FK to the gearbox it is fitted to. Null = detached. |
| `diameter`, `pitch`, `size`, `blades`, `material`, `rotation`, `hub_size`, `cupping` | Physical spec. `size` is what quick-swap compatibility is matched on today. |
| `cost` | Purchase cost. |
| `position_code` | Mirrors the drive position. Derivable from `gearbox → engine → position`; store it only if the reporting cost of the join is proven. |
| `install_hours` | Engine hours at fitting. |
| `status_code` | `active` is the "in service" value for propellers (not `ready`). Normalise this in the rebuild: use one `asset_status` vocabulary for all three asset types and map the legacy `active` → `ready` on migration. |

Every asset also carries a `*_log[]` history of `{date, type, description, hours, ref}` entries: `install`, `remove`, `detach`, `move`, `service`, `service-start`, `quickfix`. These become rows in `asset_event`.

### 3.3 The 1:1:1 invariant, and "a spare must be detached"

**The rule.** At any drive position on any boat there is at most one engine; each engine carries at most one gearbox; each gearbox carries at most one propeller. A **spare** is a detached part: its link pointers are null and it has a storage location.

Today "spare" is signalled two ways — `status = 'spare'` (legacy marker) and, canonically, **`spare_location` being truthy**. The canonical stash routine sets `status = 'spare'` **and** `spare_location` **and** nulls `engine_id` / `gearbox_id` together. Any code that sets only one of the three produces a part that is simultaneously mounted and in the warehouse.

**Specify it as constraints.** Stop encoding this in a status string; derive `is_spare`.

```sql
-- one engine per (boat, drive position)
ALTER TABLE engine ADD CONSTRAINT engine_one_per_position
  EXCLUDE (boat_id WITH =, position_code WITH =) WHERE (boat_id IS NOT NULL AND retired = false);

-- boat and position travel together
ALTER TABLE engine ADD CONSTRAINT engine_mount_coherent
  CHECK ((boat_id IS NULL) = (position_code IS NULL));

-- a mounted engine is not in a warehouse; a detached engine must be somewhere
ALTER TABLE engine ADD CONSTRAINT engine_spare_detached
  CHECK ((boat_id IS NULL) OR (spare_location_code IS NULL));

-- one gearbox per engine
ALTER TABLE gearbox ADD CONSTRAINT gearbox_one_per_engine
  UNIQUE (engine_id);                       -- NULLs are distinct in Postgres: many detached gearboxes are fine

ALTER TABLE gearbox ADD CONSTRAINT gearbox_spare_detached
  CHECK ((engine_id IS NULL) OR (spare_location_code IS NULL));

-- 'waiting on the boat' is a third state: no engine, but parked at a position
ALTER TABLE gearbox ADD CONSTRAINT gearbox_waiting_coherent
  CHECK ((on_boat_id IS NULL) = (on_boat_position_code IS NULL));
ALTER TABLE gearbox ADD CONSTRAINT gearbox_waiting_xor_mounted
  CHECK (NOT (engine_id IS NOT NULL AND on_boat_id IS NOT NULL));
ALTER TABLE gearbox ADD CONSTRAINT gearbox_waiting_not_spare
  CHECK (NOT (on_boat_id IS NOT NULL AND spare_location_code IS NOT NULL));

-- at most one gearbox waiting at a given drive position
ALTER TABLE gearbox ADD CONSTRAINT gearbox_one_waiting_per_position
  EXCLUDE (on_boat_id WITH =, on_boat_position_code WITH =) WHERE (on_boat_id IS NOT NULL);

-- one propeller per gearbox
ALTER TABLE propeller ADD CONSTRAINT propeller_one_per_gearbox UNIQUE (gearbox_id);
ALTER TABLE propeller ADD CONSTRAINT propeller_spare_detached
  CHECK ((gearbox_id IS NULL) OR (spare_location_code IS NULL));
```

`is_spare` is then a generated column or a view expression: `spare_location_code IS NOT NULL`. **Never test `status = 'spare'`** in new code.

So an asset is in exactly one of four states, and the constraints make the invalid combinations unrepresentable:

| State | engine/gearbox link | `on_boat_*` | `spare_location_code` |
|---|---|---|---|
| Mounted | set | null | null |
| Waiting on the boat (gearbox only, "คาเรือ") | null | set | null |
| Spare in storage | null | null | set |
| In a shop for repair | null | null | set (a `shop:*` location) |

### 3.4 Engine swap — get this exactly right

**The engine is the swappable unit. The gearbox and the propeller stay at the boat's drive position, and the incoming engine adopts them.**

This is counter-intuitive and it is the single most commonly mis-implemented rule in this domain. The gearbox is matched to the *boat's* drivetrain geometry (shaft length, suffix, propeller size), not to the engine block. Pulling the engine and taking its gearbox with it would leave the boat unable to accept a replacement.

#### Ordered transaction

Trigger: a maintenance job on an engine is started (or an already-started job's engine row is swapped). All steps are **one transaction**; either the whole swap lands or none of it does.

**Before**

```
boat b4  position Std
  engine   E-OLD   boat_id=b4  position=Std   status=ready
  gearbox  G-12    engine_id=E-OLD            status=ready
  propeller P-30   gearbox_id=G-12            status=active

spare pool
  engine   E-NEW   boat_id=NULL  spare_location='pier:central'  status=spare
  gearbox  G-40    engine_id=E-NEW                              (came off its old boat with it)
  propeller P-55   gearbox_id=G-40
```

**Steps**

1. **Detach the outgoing engine's gearbox — it stays on the boat.**
   For every gearbox with `engine_id = E-OLD`: set `on_boat_id = b4`, `on_boat_position_code = 'Std'`, `engine_id = NULL`. Append an asset event `detach` with note "คาเรือ รอเครื่อง" (*left on the boat, waiting for an engine*).
   The propeller `P-30` is untouched — it points at the gearbox, and the gearbox has not moved.
2. **Pull the outgoing engine.** `E-OLD`: `boat_id = NULL`, `position_code = NULL`, `status = fixing`. Append event `remove`.
3. **Queue the swap slot.** Record `{position: 'Std', old_engine: 'E-OLD', filled: false}` so the operator is prompted to fill it.
4. **Choose where the pulled engine goes.** Set `E-OLD.spare_location_code` to the chosen storage location and append a `move` event. Sync the maintenance job's `location` to the same place so the boat's effective pier resolves to `shop` correctly (§2.3).
5. **Pick the incoming engine.** Candidate set = every engine that is *not* in the outgoing set, *not* already on this boat, and whose status is not `broken`. Sort spares first. There is no compatibility check today (§3.4 note below).
6. **The incoming engine sheds its own gearbox and propeller.**
   - If `E-NEW` came off another boat, its gearbox `G-40` stays at *that* boat's position: `on_boat_id = <source boat>`, `on_boat_position_code = <source position>`, `engine_id = NULL`.
   - If `E-NEW` came from the spare pool, `G-40` becomes a spare: `engine_id = NULL`, `spare_location_code = <E-NEW's old location>`.
   - `P-55` follows `G-40` implicitly — it still points at the gearbox.
7. **Install the incoming engine.** `E-NEW`: `boat_id = b4`, `position_code = 'Std'`, `spare_location_code = NULL`, `status = spare → ready`. Append event `install`.
8. **The waiting gearbox adopts the new engine.** The gearbox with `on_boat_id = b4 AND on_boat_position_code = 'Std'` (that is `G-12`): `engine_id = E-NEW`, `on_boat_id = NULL`, `on_boat_position_code = NULL`, `status = spare → ready`. The propeller `P-30` follows implicitly.
9. Positions the operator chooses not to fill are marked `skipped`. The job then starts normally.

**After**

```
boat b4  position Std
  engine   E-NEW   boat_id=b4  position=Std   status=ready
  gearbox  G-12    engine_id=E-NEW            status=ready     <-- unchanged gearbox, new engine
  propeller P-30   gearbox_id=G-12            status=active    <-- never touched

storage
  engine   E-OLD   spare_location='shop:honda-phuket'  status=fixing
  gearbox  G-40    spare_location='pier:central'  (or on_boat_* at its source boat)
  propeller P-55   gearbox_id=G-40
```

**Hours are deliberately NOT reset or frozen.** The meter is physically bolted to the engine and travels with it. Engine hours are computed across all boats the engine has ever been on. See §3.5.

> **Two different swap semantics exist today, and only one is right.** The maintenance-job swap above carries the `on_boat_*` handling. A second path — "Assign / Replace engine" from the boat detail page — does **not**: it detects a position clash, offers to bump the occupant to a spare location, and moves the engine without touching the gearbox or propeller at all. That leaves a gearbox pointing at an engine that is no longer on the boat. **In the rebuild there is exactly one swap operation**, the transactional one above, and the boat-detail "replace" action calls it. §13.

> **Nothing enforces mechanical compatibility today.** The picker excludes broken engines and engines already on this boat, and that is the whole guard. Shaft length and gearbox suffix are recorded but never checked. **Specify a warning, not a block:** the swap response returns `warnings[]` when `gearbox.shaft_length` or `model_suffix` does not match the incoming engine's expected values, and the operator must acknowledge. Ops explicitly does not want a hard block here — they occasionally run a deliberate mismatch to keep a boat in service.

**Failure mode to accept, not to sweep.** A gearbox left with `on_boat_id` set and no follow-up install is an orphan "คาเรือ" part. Nothing cleans these up automatically, **and nothing should** — it represents a real physical situation (a boat waiting for an engine). Surface it in a report; never auto-resolve it.

### 3.5 Engine hours

**Formula**

```
engine_hours(E) = E.base_hours + (latest_reading − first_reading)
```

where `latest_reading` and `first_reading` are drawn from all daily-log meter readings for engine `E`, across every boat it has ever been mounted on, **skipping any reading ≤ 0**.

If there are no valid readings at all, the result is `E.base_hours`.

**Why `base_hours` exists.** The engines were in service long before this system. `base_hours` is the meter total carried forward at go-live; the daily log then measures the *delta* since logging began.

**Why readings ≤ 0 are skipped.** Staff type `0` into the meter cell as a placeholder meaning "not recorded". If a `0` counted as the latest reading, hours would go massively negative; if it counted as the first reading, hours would jump by the entire meter value. Both have happened.

#### Worked examples

**Case A — normal.** `base_hours = 1200.0`

| Date | Reading |
|---|---:|
| 2026-08-01 | 3410.5 |
| 2026-08-03 | 3418.2 |

`hours = 1200.0 + (3418.2 − 3410.5) = 1207.7`

**Case B — zero placeholder in the middle.** `base_hours = 1200.0`

| Date | Reading | Used? |
|---|---:|---|
| 2026-08-01 | 3410.5 | yes — first |
| 2026-08-02 | 0 | **skipped** |
| 2026-08-03 | 3418.2 | yes — latest |

`hours = 1200.0 + (3418.2 − 3410.5) = 1207.7` — identical to Case A, which is the point.

Had the `0` been treated as data:
- as the latest reading: `1200.0 + (0 − 3410.5) = −2210.5`
- as the first reading: `1200.0 + (3418.2 − 0) = 4618.2`

Both are visibly absurd, and both shipped before the skip rule was added.

**Case C — engine swapped mid-window.** `base_hours = 1200.0`. Readings 2026-08-01 `3410.5` on boat `b4`; 2026-08-10 `3455.0` on boat `b7` after a swap.
`hours = 1200.0 + (3455.0 − 3410.5) = 1244.5`. The hours follow the engine, not the boat. **Do not scope the calculation to the days the engine sat on a given hull.**

**Case D — no readings.** `hours = base_hours = 1200.0`.

#### Derived view

```sql
CREATE VIEW v_engine_hours AS
SELECT e.id AS engine_id,
       e.base_hours
         + COALESCE(MAX(r.reading) FILTER (WHERE r.reading > 0), 0)
         - COALESCE(MIN(r.reading) FILTER (WHERE r.reading > 0), 0) AS hours
FROM engine e
LEFT JOIN daily_log_reading r ON r.engine_id = e.id AND r.reading > 0
GROUP BY e.id, e.base_hours;
```

> **Careful:** `MAX(reading)` is not identical to "the reading on the latest date" if a meter is ever entered out of order or replaced. The current implementation takes the reading on the chronologically latest date, and the reading on the chronologically earliest date. Use window functions (`first_value` / `last_value` over `ORDER BY service_date`) to match that exactly, and add the `reading > 0` filter. `MAX`/`MIN` are shown above only for brevity; **implement the date-ordered version** so a replaced meter behaves the same way it does today.

#### Validation constraint at write time

Nonsense readings are rejected before they enter, so the skip rule becomes a safety net rather than the primary defence:

```sql
ALTER TABLE daily_log_reading ADD CONSTRAINT reading_positive CHECK (reading > 0);
```

and an API-level check: a reading that is **lower than the same engine's previous reading** is refused with `409 METER_REGRESSION` unless the request carries `"meter_replaced": true`, in which case a `meter_reset` event is recorded and the hours calculation restarts its baseline from that reading.

> **Open question OQ-2.** Meter replacement is not modelled today at all — an engine that gets a new meter would compute nonsense hours forever. Confirm with the fleet supervisor whether this has happened and how it was handled. The `meter_replaced` flag above is a proposal, not observed behaviour.

Empty cells are stored as **`NULL`, not `0`**. `NULL` means "not recorded"; there is no valid meaning for a zero reading.

### 3.6 Service cycles

**Engine service countdown** — relative to the last recorded service, **not** a modulo of total hours:

```
cur      = engine_hours(E)
base     = COALESCE(E.last_service_hours, E.base_hours, 0)
interval = E.service_interval                    -- 0 ⇒ no cycle; return a null-cycle object
since    = max(0, cur − base)
next     = base + interval
left     = next − cur                            -- negative ⇒ overdue
pct      = clamp(since / interval * 100, 0, 100)
overdue  = left < 0
```

Reset happens two ways: an operator logs a service manually (prompted for the hour reading, defaulting to current hours), or a maintenance job closes and the system **offers** a baseline reset.

**The service reset offer at job close.** It fires only when the close outcome is `success` or `limited`, and only when the job looks like a service: `type = 'scheduled'`, or the title/detail matches `น้ำมัน|ถ่าย|เซอร์วิส|service|oil|svc|เกียร์|gear`. It lists every engine and gearbox on the job with its current hours and asks for confirmation. **It is an offer, not an automatic action** — this is the "keep data fixes user-triggered" rule in practice. In the rebuild it becomes an explicit `POST /fleet/maintenance-jobs/{id}/close` field `reset_service_baselines: boolean`, defaulting to `false`, with the UI pre-ticking it when the heuristic matches.

**Gearbox lifetime and service**

```
cur_on_this_engine = engine_hours(attached engine) − gearbox.base_hours     -- 0 if detached
previously_used    = Σ (asset_event WHERE type='remove').used_hours
lifetime           = previously_used + cur_on_this_engine
interval           = COALESCE(gearbox.service_interval, 200)
base               = COALESCE(gearbox.last_service_hours, lifetime)
```

The `COALESCE(last_service_hours, lifetime)` fallback means a **never-serviced gearbox assumes it was serviced "now"**, so the fleet does not light up entirely red on the first day. Keep this.

> **Inconsistency to fix, not to port.** One card in the current UI (the assign-engine info panel) still computes the next service as `ceil(cur_hours / interval) * interval` — the old modulo formula — while everything else uses the countdown above. The two disagree whenever a service was logged off-cycle. **Implement only the countdown.**

---

## 4. Maintenance, incidents, projects

The money-and-downtime half of the domain. Four record families and two cost buckets.

```
INCIDENT (INC-nnn)  --0..n-->  MAINTENANCE JOB (MJ-nnn)  --0..n-->  PURCHASE MEMO (MO-nnn)
                                        |                                  |
                                        +--> job assets (engine/gearbox/propeller/hull)
                                        +--> parts withdrawn from inventory
                                        +--> boat status period (downtime)
PROJECT (PRJ-nnn)   --0..n-->  MAINTENANCE JOB (as children)
CONSUMABLE REQUISITION -- separate cost bucket, never part of a job
```

### 4.1 Incidents

An incident (`INC-nnn`) records that something broke. It is raised by the pier or fleet supervisor.

| Field | Meaning |
|---|---|
| `no` | Human number `INC-nnn`. Numbering is **`max(existing numeric suffix) + 1`, never `count + 1`** — deletions must not cause collisions. A uniqueness assertion throws on a duplicate. |
| `boat_id`, `occurred_on`, `occurred_at_time` | |
| `title`, `detail`, `remark` | |
| `damaged_asset[]` | `{asset_type, asset_id, label}` where `asset_type ∈ engine | gearbox | propeller | hull`. Hull damage is entered as free text and split on commas. |
| `priority` | 1–5 integer. |
| `severity` | **Derived** from priority: `>= 4 → critical`, `>= 3 → major`, else `minor`. Store it derived or compute it in a view; do not let the two drift. |
| `status` | `open` \| `resolved` \| `closed`. |
| `quick_fix` | If ticked at creation, the incident goes straight to `resolved` with a `resolvedDate`, a `quickfix` event is appended to each damaged asset, and **no maintenance job is created**. |
| `maintenance_job_id`, `related_maintenance_job_id[]` | The job(s) created from it. |
| `progress_log[]` | Append-only notes. |

**Auto-close.** When every maintenance job linked to an incident reaches `done` and the outcome is not `cancelled`, the incident is closed automatically with a timestamp. That is the one legitimate cascade here.

> **Bug in the current dashboard, do not copy.** The dashboard's severity split counts only `major` and `minor`, so `critical` incidents fall out of that particular chart entirely. Count all three.

**Quick-swap of a damaged gearbox or propeller.** From the incident, an operator can swap the damaged part for a pier-local spare in one action:

- Candidate spares must have a storage location, must **not** be at a `shop:*` location, and are restricted to **the boat's own pier or the boat itself**. Cross-pier spares are deliberately invisible — you cannot fit a part that is 90 km away this morning.
- Compatibility is checked **brand-only for gearboxes** (a model mismatch shows a ⚠ badge, it does not block) and **size-only for propellers**.
- The swap moves the spare into the damaged part's slot (sets `engine_id`/`gearbox_id`, clears `spare_location_code`), sets the incoming gearbox's `base_hours` to the engine's current hours (or the propeller's `install_hours`), and pushes the damaged part to `fixing`/`damaged` with a storage location.
- `used_hours` on the removed part is computed from its last `install` event.
- If the swapped gearbox had a propeller attached, the operator is asked what happens to it: keep / return to stock / send for repair.

> **Bug to fix.** The pier restriction reads the boat's **home** `pier` field, not its effective pier on the date. A boat temporarily working out of another pier is offered its home pier's spares — the wrong ones. Use the effective pier (§2.3) with the incident date.

### 4.2 Maintenance jobs

A maintenance job (`MJ-nnn`) is a unit of work on one boat.

**Fields**

| Field | Meaning |
|---|---|
| `no` | `MJ-nnn`, `max + 1` numbering as above. |
| `boat_id` | Required. |
| `job_type` | `corrective` \| `preventive` \| `scheduled`. |
| `title`, `detail` | Required title. |
| `location` | Where the work is done. **Load-bearing**: a non-empty location on an `inprogress` job is one of the two conditions that puts the boat in the derived `shop` pier (§2.3). |
| `status` | `pending` → `inprogress` → `done`, plus `on_hold`. |
| `start_date`, `end_date` | |
| `incident_id` | Optional parent incident. |
| `parent_project_id` | Optional parent project. |
| `boat_status_target` | `available` \| `fixing` \| `unavailable` — what this job does to the boat while it runs. |
| `boat_status_reason` | **Required when `boat_status_target = 'unavailable'`.** |
| `asset[]` | `{asset_type, asset_id}` rows — the engines / gearboxes / propellers / hull this job touches. |
| `part[]` | Parts withdrawn from inventory. |
| `cost` | Computed; see §4.4. |
| `progress_log[]` | |
| `outcome`, `close_note`, `awaiting_invoice` | Set at close. |

> **Two coexisting boat-status fields.** The current record has both `boatStatus` (new: `available|fixing|unavailable`) and `setFixing` (legacy boolean), and both are still read everywhere as `boatStatus || (setFixing === false ? 'available' : 'fixing')`. **Collapse to one column on migration** using exactly that expression, and drop `setFixing`.

**Create**

- Boat and title are required. Creating a second job on a boat that already has an open one prompts for confirmation (it does not block).
- If the job is created from an incident with **two or more damaged assets**, the operator is asked: one job, or split into one job per asset? Split mode pre-computes the base number once and increments per asset, links the first job back to the incident and records all of them in `related_maintenance_job_id[]`.
- Preventive/scheduled jobs with no incident take their assets from checkboxes; each asset's status mirrors the chosen boat status (`available` → `ready`, otherwise `fixing`).

**Start**

- `target_status = boat_status_target` (after the collapse above).
- **If the boat already ran that day, the downtime starts tomorrow.** "Ran that day" means there is a deployed trip for that boat on that date, or a confirmed booking assigned to it. This exists so the day still counts as an operated day in fuel and P&L reporting. Preserve it exactly.
- Asset statuses cascade to `fixing` **only when** `target_status = 'fixing'`, but **every** asset gets a `service-start` event regardless.
- If any engine on the job carries a mounted gearbox or propeller, the operator is asked: keep it on / stash it as a spare / swap the engine (§3.4).
- A `boat_status_period` is written for the downtime.

**Withdraw parts**

- Requires a part **and** a warehouse. Blocked if the warehouse's on-hand quantity is below the requested quantity.
- Deducts stock, appends an inventory history row of type `withdraw` tagged with the job id, and merges into the job's part list by `(inventory_item, warehouse, date, late_flag)`.
- **Withdrawing after the job is closed is allowed** but flagged `late = true` with `late_by_days`, and tagged in the log "ลงย้อนหลังหลังปิดงาน" (*recorded retroactively after the job closed*). Parts genuinely arrive after the paperwork.
- Reversal returns stock to the **same** warehouse it came from.

**Close** — `POST .../close` with an outcome. The cascade:

| Outcome | Engine | Gearbox | Propeller | Boat |
|---|---|---|---|---|
| `success` | `ready` | `ready` | `active`/`ready` | `available` |
| `limited` | `limited` | `limited` | `limited` | `available` |
| `rework` | `fixing` | `fixing` | `fixing` | `fixing` |
| `decommission` | `broken` + `retired` | `broken` | `broken` | `available` |
| `cancelled` | unchanged (`fixing` → `ready`) | same | same (→ `active`) | `available` |

Rules that must survive:

1. **If the job's target status was `available`, closing it must not touch the boat status at all.** A job that never took the boat out of service must not "return" it to service.
2. **If other `inprogress` jobs remain on the boat, carry over the strictest of their statuses** (`unavailable` > `fixing` > `available`) instead of returning the boat to service. Closing one job must not free a boat that is still under another.
3. A repair-history row is appended to the boat with the job's cost, assets and dates.
4. `decommission` on an engine also detaches its gearbox (`engine_id = NULL`) and logs on the attached propeller. The gearbox and propeller are **not** marked broken — retiring the engine does not condemn the drivetrain.
5. Closing a gearbox with `success`/`limited` records `gearbox.install_hours = engine_hours(linked engine)` so its next lifetime window starts from there.
6. Auto-close the linked incident when all of its jobs are done and the outcome is not `cancelled`.
7. Then offer the service-baseline reset (§3.6).

> **Bug: `end_date` is always set to today.** Closing a job back-dated is impossible through the UI; the seed migrations patch it by hand. **Specify `closed_on` as a request field defaulting to today, validated `>= start_date`.**

> **Deletion does not return parts to stock.** Deleting a job removes it outright and withdrawn parts stay withdrawn. In the rebuild, **deletion is not offered**: a job is `cancelled`, which returns nothing automatically but leaves an auditable record. Hard delete, if implemented at all, must be an admin operation that reverses every part withdrawal in the same transaction.

### 4.3 Projects

A project (`PRJ-nnn`) is a long job — drydock (ขึ้นคาน), overhaul — that owns child maintenance jobs.

| Field | Meaning |
|---|---|
| `no`, `name`, `boat_id`, `project_type`, `vendor` | |
| `plan_from`, `plan_to`, `original_plan_to` | `original_plan_to` is the baseline kept for slip reporting. |
| `actual_from`, `actual_to` | |
| `status` | `planned` → `inprogress` → `on_hold` ⇄ `inprogress` → `completed`; plus `cancelled` → `planned` (reopen). |
| `phase` | Per-type phase list. |
| `planned_budget`, `notes` | |
| `hold_reason`, `hold_since`, `cancel_reason`, `cancelled_on` | Hold and cancel both **require** a non-empty reason. |
| `plan[]`, `docs[]`, `photos[]`, `vendor_visits[]` | |

Lifecycle effects on the boat:

- **Start** → boat status period `unavailable` with `reason = 'dry_dock' | 'overhaul'` carrying the `project_id`.
- **Cancel** → offers to unlink open child jobs, closes the project's boat status period, writes an `available` period.
- **Complete** → sets `actual_to`, closes the boat status period, writes an `available` period.

Status transitions are gated (start only from `planned`, hold only from `inprogress`, and so on). Keep that as a state machine in the API.

**Project health score** (0–100, used for the RAG chip):

```
score = 100
      − min(40, (budget_pct − 100) × 1.5)        when over budget
      − 5                                        when budget_pct is 80–100
      − min(35, days_late × 2)
      − 15   when > 80% of the schedule has elapsed and > 50% of child jobs are still open
      − 10   while on_hold
buckets: < 40 CRITICAL · < 70 AT RISK · else ON TRACK
```

Open-ended projects (`plan_to` null) get no schedule penalty.

> **Serious bug — do not port.** Completing a project **cascade-closes every open child job by setting `status = 'done'` directly**, bypassing the close cascade entirely: no outcome, no asset status restore, no repair-history row, no incident auto-close, no service-baseline prompt. Child assets are left stuck in `fixing`. **In the rebuild, project completion must call the same close operation as a manual close, once per child job, in the same transaction, with an explicit outcome supplied by the operator** (default `success`), or refuse to complete while open children remain. §13.

### 4.4 Cost

Three cost concepts. Keep them apart.

**Job cost**

```
memo_cost  = Σ memo.amount   for memos linked to this job with status ∈ {approved, received, paid}
parts_cost = Σ part.qty × part.unit_cost
             EXCLUDING parts whose normalised name already appears in a 'parts'-type memo of this job
job_cost   = parts_cost + memo_cost
```

The exclusion prevents double-counting: a part bought on a memo and then withdrawn from stock would otherwise be charged twice — once at purchase, once at withdrawal. **The match is by normalised name**, which means renaming a part breaks it. Flag this as a known weakness; in the rebuild, link the memo item to the inventory item by id and match on the id, falling back to the normalised name only for legacy rows.

**Per-asset maintenance cost share** — `flMaintCostShare`

```
share(job, asset_kind) = job_cost / max(1, count of job assets whose id key matches asset_kind)

  asset_kind 'gearbox'   → count assets with a gearbox id
  asset_kind 'propeller' → count assets with a propeller id
  otherwise              → count assets with an engine id
```

**Applied ONLY on the Engine / Gearbox / Propeller detail pages.** Not on the boat page, not on job totals, not on project totals, not on the dashboard.

**Why.** A single ฿36,000 oil-change job that covers all four engines on a catamaran should show as roughly ฿9,000 against each engine when you are looking at *that engine's* cost history — otherwise every engine appears to have cost ฿36,000 and the fleet looks four times more expensive than it is. But the *job* cost ฿36,000 once, and the *boat* spent ฿36,000 once. Applying the share to a total would under-count by a factor of four; showing the full job cost on each asset page over-counts by the same factor. Two different questions, two different numbers.

Specify it as a view, so the rule has exactly one implementation:

```sql
CREATE VIEW v_maintenance_job_asset_cost AS
SELECT ja.maintenance_job_id, ja.asset_type, ja.asset_id,
       jc.job_cost / GREATEST(1, COUNT(*) OVER (
         PARTITION BY ja.maintenance_job_id, ja.asset_type)) AS asset_share
FROM maintenance_job_asset ja
JOIN v_maintenance_job_cost jc ON jc.maintenance_job_id = ja.maintenance_job_id;
```

The asset-detail endpoint reads `v_maintenance_job_asset_cost`; every total endpoint reads `v_maintenance_job_cost`. **No endpoint may read both and add them.**

**Cost analytics aggregation.** The reporting pool is jobs with status `done | inprogress | on_hold` (cancelled excluded), time-filtered on `COALESCE(end_date, start_date)`. Each job's cost is split evenly across its assets and bucketed by asset category (`hull | engine | gearbox | propeller | other | memo`); a job touching several assets of one category counts as **one job** in the counter but its money is still divided per piece. Standalone memos with a boat but no job are charged to that boat — but only the share that never entered stock (items without an inventory-item link), so parts are not counted twice; the remainder falls into a central-cost bucket.

### 4.5 Purchase memos

Memos (`MO-nnn`) are how money enters a job. Only memos in `approved | received | paid` count towards cost.

| Memo kind | Chain |
|---|---|
| parts / mixed | `created → pending_approval → approved → ordered → received → paid` |
| labour-only | `created → pending_approval → approved → paid` (skips ordered/received) |
| no parts items | jumps straight to `paid` |

- The `approved` step requires an approver name.
- The `received` step receives all parts items into **one** warehouse guessed from the boat's pier, and **creates missing inventory items automatically**.

### 4.6 Consumables (เบิกของใช้ / น้ำมัน)

A consumable requisition is deliberately **separate** from repair jobs: it deducts stock and books cost in its **own** bucket, so that "Upkeep รวม" (*total upkeep*) = maintenance-job cost + consumables cost, with no overlap.

- Fields: item, warehouse, quantity, boat (**required**), optional engine, by, note.
- Cost = `qty × item.unit_cost`.
- **Negative stock is reachable by design** — if the requested quantity exceeds on-hand, the operator confirms and the withdrawal proceeds. The physical shelf is the truth; the system catches up.
- Reversal returns quantity to the same warehouse and removes the matching inventory-history row.
- Requisition cost is **not** included in job cost or cost analytics. Only the consumables page and the per-boat upkeep number see it.

### 4.7 Daily logs — the reading source

The Daily Fleet Log is where the numbers that feed engine hours and fuel intelligence come from.

**Page model.** Pick a date; boats are grouped into pier sections (`tublamu` / `panwa` / `ranong`) by their **effective** pier on that date. Only company boats that have at least one engine appear: `ownership <> 'charter' AND NOT retired AND EXISTS (engine on this boat)`.

**Per boat per day:**

| Field | Source | Notes |
|---|---|---|
| PAX | **Read-only, derived from bookings** | Heads assigned to that boat that day, from non-cancelled bookings. A legacy manual-override field still exists in the data but no input writes to it any more. |
| Fuel litres | operator input | `NULL` = not recorded. |
| ฿/L price | operator input | An empty or non-numeric price **deletes the key** rather than storing `0`. |
| Engine meter reading, per engine | operator input | Each cell shows the delta versus the previous valid reading. |

**Locking.** Save is **per (date, pier)**. Saving locks that pier's section for that date and the rows become read-only ("บันทึกแล้ว" — *saved*) until an explicit Edit. Moving a boat to another pier after locking leaves its row governed by the *new* pier's lock flag — a real edge case worth an explicit test.

**Guards and behaviours to preserve:**

- A boat marked `fixing`/`unavailable` that nonetheless ran that day keeps its entry cells and gets an "ออกแล้ว · เข้าซ่อมเย็น" (*went out, into the shop this evening*) chip. A boat that is unavailable *and* did not run gets no input cells at all.
- Fuel-price resolution has **two modes** and they are deliberately different:
  - **Strict** (used by the Daily Log and the fuel aggregation): the price for that exact boat on that exact date, or nothing. Missing price ⇒ cost counts as ฿0 plus a `price_missing` flag, so the gap is visible.
  - **Lenient** (used by trip P&L and accounting): boat → pier → a sibling boat at the same pier → up to 30 days back, and it reports **provenance** so the reader knows how far the fallback reached. A fallback constant of ฿32/L exists as a last resort.
  Implement both. Do not "simplify" the strict one — the visible ฿0 is what makes staff go and enter the price.
- A boat-day counts as *operated* only if it actually ran: pax > 0, or routes present, or fuel > 0. "ไม่ออก = ไม่นับ ไม่ใช่ 0" — *didn't go out means not counted, not counted as zero.* This distinction (null vs zero) runs through every fuel metric.
- Run hours per boat-day = **max** over that boat's engines of `(today's reading − previous valid reading)`. Max, not sum — it approximates elapsed running time, since the engines run concurrently.
- Fuel is attributed to route families **pro-rata by pax share** when a boat ran more than one programme.
- Anomaly detection: a day whose fuel exceeds 1.3 × that boat's monthly average, only when there are at least 3 fuelled days. The Daily Log has a cruder inline check: L/PAX > 20.
- Weekly buckets are `ceil(day_of_month / 7)` → W1…W5. Metrics are `L/hr` (null when there are no run hours), `L/day`, `L/pax` (null when there are no pax), `฿`. **Null ≠ 0 by design** in every one of these.

> **Bug: the month fuel budget bypasses the fleet persistence path entirely** and is written straight to browser storage. In the rebuild it is a normal table.

---

## 5. Boat assignment — the operational core

Be exhaustive here. This is the part that goes wrong at 06:00 with guests standing on a pier.

### 5.1 What boat assignment is

Given a **route** and a **date** on which N bookings exist, decide **which vessel carries which guests**.

It happens in two distinct steps, by two different people, and conflating them is the most common design mistake:

1. **Deploy** (D−30 … D−1, ops office). For a route × date, choose which hulls will run it at all. This creates the seat pool.
2. **Assign** (D−2 … D−1, ops office). For each booking on that route × date, choose which of the deployed hulls carries it.

Step 1 is a fleet decision. Step 2 is a load-balancing decision. A boat cannot be assigned in step 2 unless it was deployed in step 1.

#### The deployment record

Today this is `TRIPS[date][boatId] = {route, type, booked, charterBookingId?}` — a date-keyed, boat-keyed map, persisted to a table with **hardcoded per-boat columns**. That structure is the single worst artefact in this domain and §9.2 kills it.

The relational replacement is one row per (date, boat):

```
trip_boat_deployment(service_date, boat_id, route_id, deployment_type, charter_booking_id)
PRIMARY KEY (service_date, boat_id)
```

A boat can serve **one route per date**. (Vans can serve two programmes a day; boats cannot.)

#### Deploying a boat — the guards

| Guard | Rule | Why |
|---|---|---|
| **Past days are frozen** | Any date earlier than today is hard-blocked: "วันที่ … ผ่านมาแล้ว · แก้เรือที่ deploy ไม่ได้" (*that date has already passed; deployed boats cannot be changed*). | Closed days have already fed the Daily Report, Travel Summary and trip P&L. Editing them silently changes published numbers. |
| **Status must be available** | Only boats whose status on that date is `available` are offered. | |
| **Pier must match the route** | A boat whose **effective pier on that date** differs from the route's pier is moved into the unavailable list **with a reason** (e.g. "ท่าทับละมุ", "อยู่ที่อู่ · Honda Phuket"). It is **never silently dropped**. | A boat that vanishes with no explanation is indistinguishable from a bug. Staff must see *why* they cannot use it. |
| **Chartered hulls are locked** | A boat carrying a charter booking cannot be re-routed or unassigned: "Boat is chartered · cannot reassign". | |
| **Re-routing a boat with bookings on it prompts** | The confirm lists how many bookings and pax are affected. The bookings are **not** moved; they get flagged ⚠ "จัดเรือใหม่" (*re-assign the boat*) on the assignment screens. | Moving people automatically would silently overload another hull. |

**Scan results the deploy screen must surface** (these are what turn the heat-map red):

- `no_boat` — pax exist on a route × date with no hull deployed at all.
- `boat_broken` — a hull was deployed and then marked `fixing`/`unavailable`. **The day is flagged even with 0 pax**, because the schedule is now invalid.
- `weather_closed` — the route × date is weather-cancelled. Note that today's Boat Operation screen does **not** compensate for this (the boats stay deployed); the fleet calendar does, listing the route under a weather bucket and treating its hulls as spare. **Specify consistent behaviour: a weather-closed route × date returns its hulls to the spare pool in every view.** §13.

### 5.2 The seat pool

For a route × date:

```
total_capacity     = Σ effective_cap(boat, date)   over deployed boats on this route
charter_capacity   = Σ cap of the chartered subset
available_capacity = total_capacity − charter_capacity
seats_consumed     = seats_consumed(route, date)
locked_seats       = seat locks held for this route × date        (booking domain, doc 01)
seats_available    = max(0, available_capacity − seats_consumed − locked_seats)
licence_capacity   = Σ COALESCE(licence_pax, cap)  over the same boats
licence_available  = max(0, licence_capacity − seats_consumed)
state              = all-chartered | full | tight (fill ≥ 80%) | open | no-allotment
```

`effective_cap(boat, date)` is the **per-day cap override** if one exists, otherwise `boat.cap`. Every capacity read goes through it — **never read `boat.cap` directly**. The override is clamped to `licence_pax` on write, so an override can never exceed the legal ceiling.

#### `seats_consumed` — exact definition

```
seats_consumed(route, date, exclude_booking?) =
  Σ over every booking B where
      B.id ≠ exclude_booking
      AND B.status ∉ {cancelled, cancelled_weather, rejected}
      AND pending_holds_seat(B)
    Σ over every trip T of B where T.route_id = route AND T.date = date
        AND T.booking_mode ≠ 'charter'
      max(0, pax_total(T) − on_site_losses(B, date))
```

Four exclusions, each with a reason:

1. **Cancelled statuses.** Obvious, but the triple is duplicated as a literal array in about ten places in the current code. Define it once.
2. **Charter trips.** A charter consumes a **hull**, not seats. §5.3.
3. **Non-holding pending bookings.** A booking in `pending_approval` **because it went over cap** does not hold a seat — the seat does not exist yet, which is precisely why it needs approval. Any *other* pending booking does hold its seats. The test is: `status = 'pending_approval' AND (approval.over[] is non-empty OR approval.total_over > 0)` ⇒ does not hold.
4. **On-site losses.** Guests who no-showed or cancelled at the pier free their seats for that (now past) day, so the historical allotment reflects who actually travelled.

`exclude_booking` exists so that editing a booking does not count its own seats against itself.

### 5.3 Charter boats are excluded from the seat pool

**Commercial reason.** A charter (เหมาลำ) is a customer buying the *whole vessel*. If that hull's seats stayed in the pool, the system would resell them to seat customers, and on the morning of the trip a private group would find strangers on their boat. This has to be structurally impossible.

Today it takes **four independent mechanisms**, because the deployment record alone is not trustworthy:

1. The seat-consumption calculation skips trips with `booking_mode = 'charter'` — a charter consumes a hull, not seats.
2. The list of assignable boats for a day filters out both hulls flagged as charter in the deployment record **and** anything in the charter-hull set.
3. **The charter-hull set is derived from the bookings, not from the deployment record.** A charter split across two or more hulls only ever flagged its *first* hull in Boat Operation; without deriving from bookings, the second hull was resold as seats. This was a real incident.
4. A heal step mirrors `trip.charter_boat_id` → `ops.boat_id` so that charters count as "assigned" everywhere that keys off the assignment field — the charter hull is usually not in the seat-boat picker, so it could never be picked manually.

Plus a memo cache with a one-microtask lifetime, cleared after every booking write, because deriving the set from ~2,900 bookings on every render was too slow. That cache is a symptom of the derivation, not a feature.

**In the rebuild: make it one mechanism.**

The charter relationship is a **row**, not a flag inferred from three places:

```sql
CREATE TABLE trip_boat_deployment (
  service_date       date NOT NULL,
  boat_id            text NOT NULL REFERENCES boat(id),
  route_id           text NOT NULL REFERENCES route(id),
  deployment_type    text NOT NULL REFERENCES deployment_type(code),  -- 'seat' | 'charter'
  charter_booking_id text REFERENCES booking(id),
  PRIMARY KEY (service_date, boat_id),
  CONSTRAINT charter_needs_booking
    CHECK ((deployment_type = 'charter') = (charter_booking_id IS NOT NULL))
);
```

and the assignment of a booking to a boat is also a row:

```sql
CREATE TABLE trip_boat_assignment (
  service_date date NOT NULL,
  booking_id   text NOT NULL,
  boat_id      text NOT NULL,
  pax_ad smallint NOT NULL DEFAULT 0, pax_chd smallint NOT NULL DEFAULT 0,
  pax_inf smallint NOT NULL DEFAULT 0, pax_foc smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (service_date, booking_id, boat_id),
  FOREIGN KEY (service_date, boat_id)
    REFERENCES trip_boat_deployment (service_date, boat_id)   -- cannot assign to an undeployed hull
);
```

The seat pool view then reads:

```sql
CREATE VIEW v_seat_capacity AS
SELECT d.service_date, d.route_id,
       SUM(effective_cap(d.boat_id, d.service_date))
         FILTER (WHERE d.deployment_type = 'seat') AS available_capacity,
       SUM(COALESCE(b.licence_pax, b.cap))
         FILTER (WHERE d.deployment_type = 'seat') AS licence_capacity
FROM trip_boat_deployment d JOIN boat b ON b.id = d.boat_id
GROUP BY d.service_date, d.route_id;
```

A chartered hull is simply not in the `seat` partition. There is nothing to remember, nothing to derive, and no cache. The split-charter case is handled because a charter that takes two hulls writes **two deployment rows**, both `deployment_type = 'charter'`.

### 5.4 The charter mirror heal — delete it, do not port it

Today `bkV2CharterBoatHeal(date)` runs before the Daily Fleet Log, before pier check-in, and before several other screens. It walks every non-cancelled booking, finds charter trips with a `charter_boat_id` and no `ops.boat_id`, and copies the value across. It is idempotent and it skips bookings that already have a boat split.

**It exists because a charter's boat is recorded in two places that can disagree**: on the trip (`charter_boat_id`, written when the booking is made) and in the per-day ops block (`ops.boat_id`, written when a boat is assigned). A charter is never assigned manually — its hull is not in the seat picker — so `ops.boat_id` stays empty and every screen that keys off `ops.boat_id` thinks the charter is unassigned.

**Make it structurally unnecessary.** With the schema in §5.3, `trip_boat_assignment` is the *only* place a booking-to-hull relationship is stored. A charter booking gets its assignment row at the moment the charter is created, in the same transaction that writes the deployment row:

```
POST /booking/{id}/charter  { service_date, route_id, boat_ids[] }
BEGIN
  for each boat_id:
    INSERT INTO trip_boat_deployment (service_date, boat_id, route_id, 'charter', booking_id)
      ON CONFLICT (service_date, boat_id) DO UPDATE ... ;   -- fails if already a seat boat with bookings
    INSERT INTO trip_boat_assignment (service_date, booking_id, boat_id, pax...) ;
COMMIT
```

There is now exactly one source of truth, written once, and the two values cannot disagree because there is only one value. **No heal step, no memo cache, no derivation from bookings at render time.** §12 lists this as "delete, do not port."

### 5.5 Three capacity numbers, three behaviours

This is the rule people get wrong. Write the tests in §14 before you write the code.

| Number | Value | Meaning | Behaviour when exceeded |
|---|---|---|---|
| `cap` | e.g. 56 on `b3` Okeanos | **Booking cap.** How many seats the company chooses to sell. | Selling past it on a route × date sends the booking to `status = 'pending_approval'`. That decision is made on the **booking** side, not here. |
| `cap + BA_CAP_TOL` | `BA_CAP_TOL = 2`, so 58 | **Assignment tolerance.** A hull may be *loaded* to cap + 2 while dispatch shuffles people around. | Assignment is **refused outright** past it, with an explicit message naming the boat, the resulting pax, the cap and the max allowed. |
| `licence_pax` | e.g. 75 on `b3` | **Registered seats — the legal ceiling.** Fallback when null: `cap`. | **Hard block, always.** No tolerance, no override, no approval path. Over the licence is illegal, not merely commercially awkward. |

**The interaction, stated explicitly:**

- `cap` and `licence_pax` are independent. Every seeded hull has `cap < licence_pax` (Okeanos sells 56 of its 75 legal seats), so in practice `cap + 2` never reaches the licence today. **That is a data coincidence, not a rule.** A hull configured with `cap = licence_pax` would let the +2 tolerance push it over the legal limit.
- **Bug to fix.** The current per-boat assignment guard checks only `cap + BA_CAP_TOL`. It never checks `licence_pax`. The licence ceiling is enforced only at *route* level (in the allotment calculation) and indirectly by the per-day-override clamp. **Specify the correct per-boat ceiling:**

```
assignment_ceiling(boat, date) = min(effective_cap(boat, date) + BA_CAP_TOL,
                                     COALESCE(boat.licence_pax, boat.cap))
```

  and refuse any assignment that would exceed it, with a distinct error code (`LICENCE_EXCEEDED` vs `CAP_TOLERANCE_EXCEEDED`) so the UI can explain which wall was hit.
- `BA_CAP_TOL` is configuration, not a constant. Put it in a settings table keyed by scope so ops can change it without a deploy. Default 2.
- **Bulk assignment skips rather than blocks.** Assigning many ticked rows at once must skip the rows that would overflow and report them, not abort the whole batch.
- **Splitting a booking across hulls.** A booking with 2+ heads on a date can be split: `[{boat_id, ad, chd, inf, foc}]`. Every load calculation must be split-aware. Picking a single boat for an already-split booking must **ask for confirmation and then delete the split** — silently dropping it loses people. A split whose parts do not add up to the day's pax pool leaves people unassigned; the UI must show ⚠ "ยังไม่เลือกลำ" (*no hull chosen*) on any part without a boat.
- **Emergency upgrade.** An explicit action records `{reason, charge, by, at}` on the booking and, from then on, the picker offers **every** boat running that day, not just the ones on this route. Charge may be 0 (goodwill).

### 5.6 ห้ามเดา — never auto-pick

**The rule.** The system surfaces conflicts and gaps for a human to resolve. It does not silently choose a boat or a van.

**Why this is a deliberate product decision, not laziness.**

- The consequence of a wrong automatic choice is a guest standing in a hotel lobby at 06:00 while the van they were auto-assigned to is 40 km away, or a private charter group finding strangers on their boat. Both have happened.
- The dispatcher holds information the system does not: which driver is reliable on that road, which captain speaks Russian, that a group of eight is travelling with a wheelchair, that a partner van's plate changed yesterday.
- An automatic fix that is *usually* right is worse than no fix, because staff stop checking. The van-group conflict scanner in §7.8 was written with an explicit comment refusing to auto-pick for exactly this reason.

**What is allowed:**

| Allowed | Not allowed |
|---|---|
| An explicit **Auto-assign** button the dispatcher presses, whose result they can see and undo | Auto-assignment on page load, on save, or as a background job |
| Propagating a value **a human already chose** — e.g. filling in a group member who has no van with the van the dispatcher picked for that group | Choosing which van a group should have |
| Detecting and **reporting** a conflict | Resolving a conflict by picking one side |
| Returning **ranked candidates** with their violations | Committing the top candidate |

Carry this into the API shape: the assignment planner endpoint (§5.8) is a **read** that returns candidates and violations. It never writes. Committing is a separate, explicit call.

### 5.7 What a trip day is composed of

For a given date, the operations view is a **route × day matrix**. Each cell is one route on one day and shows: deployed hulls, booked pax, capacity state, and warning flags. Clicking a cell opens a popover with three lists built from the fleet status for that date:

| List | Membership |
|---|---|
| **Assigned** | boats already deployed that day with a route |
| **Available** | status `available` that day **and** not already deployed **and** effective pier = route pier |
| **Unavailable** | everything else, each with a reason string: not available (enriched with the open project's `[PROJ]`/`[HOLD]` label), or at the wrong pier, or at a shop |

The month-wide read-only view (fleet calendar) answers "which boat is out, which is spare, which is in the shop, which route is weather-closed" for a whole month, and clicking a day jumps back to the matrix.

### 5.8 The assignment algorithm

**Inputs**

```
route_id, service_date
deployed_boats[]  = trip_boat_deployment rows for (route_id, service_date) with type='seat'
bookings[]        = seat bookings on (route_id, service_date), non-cancelled
existing[]        = current trip_boat_assignment rows for that date
per_boat_overrides = effective_cap(boat, date)
tolerance          = BA_CAP_TOL (default 2)
```

**Constraints**

```
C1  A booking may only be assigned to a boat deployed on that route × date.
C2  A booking may never be assigned to a hull whose deployment_type = 'charter'
    on ANY of that booking's travel dates.
C3  load(boat) <= min(effective_cap(boat,date) + tolerance,
                      COALESCE(boat.licence_pax, boat.cap))
C4  A split booking's parts must sum to that day's pax pool for the booking.
C5  A boat must be 'available' on that date (status), else it is a violation, not a candidate.
```

**Planner — returns candidates and violations, never commits**

```
function plan_assignment(route_id, date, options):
    boats     = deployed_seat_boats(route_id, date)
    if boats is empty:
        return { candidates: [], violations: [ {code: 'NO_BOAT_DEPLOYED', route_id, date} ] }

    load = {}                                  # current load per boat, split-aware
    for b in boats: load[b.id] = assigned_pax(date, b.id)

    candidates = []
    violations = []

    for bk in seat_bookings(route_id, date):
        if bk.assignment_exists and not options.reassign_all:
            continue                           # NEVER move an existing assignment silently
        pax = pax_total(bk, date)

        # first-fit under the commercial cap
        pick = first(b in boats where load[b.id] + pax <= effective_cap(b.id, date))

        # else the least-loaded boat that still fits inside the tolerance AND the licence
        if pick is null:
            pick = first(b in boats sorted by load ascending
                         where load[b.id] + pax <= assignment_ceiling(b.id, date))

        if pick is null:
            violations.append({ code: 'NO_ROOM', booking_id: bk.id, pax: pax,
                                boats: [ {id, cap, ceiling, load} for b in boats ] })
        else:
            candidates.append({ booking_id: bk.id, boat_id: pick.id, pax: pax,
                                resulting_load: load[pick.id] + pax,
                                over_cap: load[pick.id] + pax > effective_cap(pick.id, date) })
            load[pick.id] += pax

    violations += detect_conflicts(route_id, date)
    return { candidates: candidates, violations: violations }
```

**Conflicts the planner must detect and report**

| Code | Condition |
|---|---|
| `NO_BOAT_DEPLOYED` | Pax exist on the route × date with no seat hull deployed. |
| `BOAT_BROKEN` | A deployed hull's status on that date is not `available`. Flag even at 0 pax — the schedule is invalid. |
| `BOAT_PULLED` | A booking is assigned to a hull that is no longer deployed on that date, is now serving a different route, or is now chartered by someone else. Renders as ⚠ "เรือถูกถอดจาก Boat Operation · จัดเรือใหม่" (*the boat was removed from Boat Operation — re-assign*). **Exempt:** a charter's own hull, and an overnight return leg. |
| `NO_ROOM` | No hull can take the booking inside its ceiling. |
| `OVER_CAP` | A resulting load exceeds `cap` but stays within the ceiling. **Warning, not a violation** — dispatch does this deliberately. |
| `LICENCE_EXCEEDED` | A resulting load would exceed `licence_pax`. Always a violation. |
| `SPLIT_INCOMPLETE` | A booking's split parts do not sum to its pax for the day, or a part has no hull. |
| `WEATHER_CLOSED` | The route × date is weather-cancelled but hulls are still deployed. |
| `UNASSIGNED` | A non-cancelled booking on the date has no hull. Such a booking lands in a `noBoat` bucket at the pier and **never appears on any job sheet** — it is invisible to the crew. |

**Commit — a separate, explicit call**

```
POST /operations/assignments/commit
{
  "service_date": "2026-08-24",
  "route_id": "r5",
  "assignments": [ {"booking_id":"BK-26080012-A1B2", "boat_id":"b3", "pax": 6} ],
  "expected_version": 41,
  "acknowledge_warnings": ["OVER_CAP"]
}
```

The commit re-validates every constraint inside the transaction (the planner's answer may be stale by seconds), refuses on any violation, and refuses on any warning not listed in `acknowledge_warnings`. It returns the committed rows and the new version.

**Never**: return an automatically-committed assignment from the planner; move an existing assignment without `reassign_all`; pick a hull for a booking during any other operation.
---

## 6. Pier operations

Four per-pier back-office surfaces plus the day-of check-in console. Each pier (`tublamu`, `panwa`, `ranong`) has its own instance of all four, with its own permission entry.

| Code | Thai | English | What it is |
|---|---|---|---|
| `POJ` | ใบงานเรือ | Boat job sheet | Crew each hull for the day: captain, assistant, crew, island staff, wristband colour, notes, meal venue, licence check |
| `PO` | เบิก-คืนอุปกรณ์ | Equipment issue / return | Towels, masks, fins: issue, return, laundry cycle, stock, losses and fines |
| `POA` | ตารางการทำงาน | Work schedule / duty roster | Monthly crew roster on a 26→25 cycle, derived from the job sheets, overridable per cell. Also the **registry hub** |
| `POL` | ใบอนุญาต | Marine licences | Captain/engineer certificates, expiry warnings, per-boat coverage check |

### 6.1 Pier check-in — the three-stage machine

Pier staff open the check-in console for today. Rows are nested **boat → trip (route) → arrival zone → van group → booking**, which is exactly the order guests physically arrive in.

**Arrival zones** on the check-in screen: `PK` (Phuket transfer), `KL` (Khao Lak transfer), `OWN` (self-arrive or the agent's own car), `NOVAN` (a transfer zone with no van assigned yet).

**Stages**, in order:

| Stage | Thai | Meaning |
|---|---|---|
| `arr` | ถึงท่า | Arrived at the pier |
| `clr` | เคลียร์ | Cleared — paperwork and payment settled |
| `on` | ขึ้นเรือ | Boarded |

Rules:

- Clicking a stage you have already passed steps **back one stage**, not forward. `to = (current == wanted) ? wanted − 1 : wanted`.
- Reaching `on` counts pax and requires a reason for any reduction.
- `±` buttons adjust the travelling count, clamped to `[0, expected]`.
- Any reduction without a reason opens a reason modal. On-site cancels and no-shows are recorded as **events** `{type: 'ns' | 'cxl', pax, reason_code, note, at, by}` and can be undone individually.
- If every head is gone, the booking moves to a void stage `vd` — "ยกเลิกหน้างาน / ไม่มาทั้งใบ" (*cancelled on site / nobody came*).

**Expected heads at the pier** = booked − van no-shows, **unless** the no-show reason is one of the "will come to the pier themselves" codes, in which case the pier still expects them. The pier can also **reinstate** a van no-show, after which those heads stop counting as lost.

**Permission subtlety that must survive.** The check-in write path accepts **`operations` OR `pier`**. Before that existed, pier-only accounts could click check-in and have their work silently discarded. Every check-in endpoint must accept both areas. Non-check-in booking writes accept `operations` only.

**Money at the pier.**

- Boarding a booking that still owes money raises a **warning, not a block** — "เรือรอไม่ได้" (*the boat cannot wait*). Two exits: collect now, or board now and settle later (a one-shot skip flag).
- `due = max(0, (cash_on_tour + uncollected upgrades + booking balance) − already_paid_at_pier)`.
- Payment lines are `{method: cash|transfer|card, amount, fee_mode, fee_pct, fee, note, slips[]}`.
- **Card fee is stored separately from `amount`.** `amount` reduces the booking debt; `fee` is pass-through to the bank; `amount + fee` is what the card terminal slip shows. **Merging them inflates revenue.**
- Non-cash lines with no slip attached are counted and shown as "⚠ รอสลิป n" (*awaiting n slips*) — the day cannot be reconciled without them.
- **Pier money is a separate pot** and is deliberately not posted to the main payments ledger. It must be reconciled at day close. Anything that reads only the payments ledger will not see it. Preserve this separation and the reconciliation step.
- Overnight return legs settle to zero at the pier so guests are not charged twice.

### 6.2 The boat job sheet (POJ)

Lists every boat that belongs to that pier that day — boats running from the pier, plus every other boat whose effective pier is this one.

Each hull gets a status bucket: `clash` (deployed but the shop says it is not available), `run`, `away` (running from another pier today), `idle`, `broke`, `maint`, `dd` (ขึ้นคาน, drydock), `donor`, `off`. Grouped into `go | ready | work | down` filter chips.

Per hull per day the sheet stores `{captain, assistant, crew[], island_staff[], note, wristband, wristband_colour, locked, meal_venue, maintenance_job}`. A standing crew per boat is kept separately and shown as a fallback when the day has no record — **displayed but not written**. "Copy yesterday" copies the sheets, **skipping locked ones**, and reports how many it skipped.

> **Trap: the per-day sheet has a field whitelist.** A new per-day field that is not added to the whitelist is silently dropped on the next save. This is a symptom of the blob model; in the rebuild these are real columns and the problem disappears.

### 6.3 Equipment issue and return (PO)

An **append-only ledger**. One row per action:

```
pier_move(id, service_date, pier_code, item_id, boat_id, move_type, qty, note, fine, fine_paid, at, by)
move_type ∈ issue | return | repair | fixed | writeoff | lost | laundry_out | laundry_in | adjust
```

**Balances are never stored.** They are replayed from `item.total` into buckets `ready / onboat / dirty / laundry / repair / gone`. A returned towel goes to `dirty`; everything else returns to `ready`.

Guards:
- Close-out refuses to save unless the shortfall is fully explained (`sum of reasons != missing count` → "· ระบุของที่ขาดได้ N จาก M").
- A return quantity outside `[0, outstanding]` is refused.
- Closing a hull that never drew anything alerts.

**Corrections are `adjust` rows, never edits to history.** Keep the ledger immutable in the rebuild — it is one of the few things in this codebase that is already modelled correctly.

### 6.4 Duty roster (POA)

A monthly crew roster that **derives itself from the boat job sheets** and allows per-cell override. Subtitle: "ขึ้นเองจากใบงานเรือ · แก้ทับรายช่องได้" (*generated from the boat job sheets; you can override any cell*).

**The cycle is 26 → 25 by default** and always straddles two calendar months. The start day is configurable, clamped to 1..28. **Any month-based assumption in roster code will be wrong.**

**Cell resolution — four layers, in order:**

1. A **manual override** for that (date, staff) → wins.
2. Otherwise the **job-sheet assignment** for that day (captain / assistant / crew / island staff), rendered as the drydock code, the maintenance code, or the route code.
3. Otherwise the **plan layer** (an override marked as plan rather than actual).
4. Otherwise empty, marked `todo` if that person's pier had work that day.

**Only hand-touched cells are stored.** Everything else is re-derived on every read. **Do not backfill the store for every cell** — that would break the "job sheet changed → roster follows" behaviour, which is the whole point of the screen.

Roster codes are a registry: `PP` ทำงาน (ลงเรือ) *working, on the boat*, `SE` เข้าเวร *on duty*, `OFF` หยุดประจำสัปดาห์ *weekly day off*, `PH` วันหยุดนักขัตฤกษ์ *public holiday*, `LWOP`, `LWP`, `SC`, `SR`, `5`, `ABS` ขาดงาน *absent*, `MT` งานซ่อม / ขึ้นคาน *maintenance / drydock*. Each carries `kind ∈ work | off | leave | none`, which drives the summary totals. Route codes come from the route's own code, with a guess table as a fallback.

The POA toolbar is the **registry hub**: staff registry, guide registry, row-group registry, roster-code registry, and licence-type registry all live here. Item registries stay on the equipment page — "it is things, not people."

### 6.5 Marine licences (POL)

```
pier_licence(id, staff_id, class_id, licence_no, expires_on, issued_at, issuer, note)
pier_licence_type(id, side, short_name, formal_name, per_boat, active)     -- side ∈ deck | eng
pier_licence_class(id, type_id, name, max_gt, max_bhp, sort_order)
```

Seeded ceilings: deck classes up to 500 / up to 60 GT; engineer classes up to 3000 / up to 1000 BHP.

- Licence state: `noexp` (no expiry recorded) | `bad` (expired) | `soon` (within the warning window, default 60 days) | `ok`.
- **Coverage check** compares the class ceiling against the **boat's GT and BHP**. This is why `gt` and `bhp` on the boat record are load-bearing, not decorative.
- The per-boat check reports, per licence type that requires a per-boat holder: expired-only ("…หมดอายุแล้ว … — ยังจ่ายงานได้ แต่ต้องรีบต่อ" — *expired, you can still dispatch but renew urgently*), class-too-small ("…ชั้นไม่ครอบคลุมลำนี้ (ลำนี้ X ตันกรอส · Y แรงม้า)"), or missing ("ยังขาด<type> N ใบ").

> **Nothing blocks dispatching an under-licensed crew today** — it is a badge on the job-sheet card only. **Keep it advisory** (ops asked for this: a boat that cannot sail costs more than a paperwork gap) but make the API return the violation in a structured `warnings[]` so it can be reported on and, later, escalated by policy.

### 6.6 Guides

Three different documents. Do not confuse them.

**(a) ใบสั่งงานมัคคุเทศก์ — the government guide job order.** The Tourism Department form declaring who guided which boat.

- Guide registry: `{id, name, nickname, licence_no, languages[], role, active}` where `role ∈ guide | trainee | intern | staff` (ไกด์ / ไกด์ฝึกหัด / นักศึกษาฝึกงาน / สตาฟ).
- Assignment is per `(date, boat)`: `{guide_ids[], other_count, signature_count}`.
- **Document number is issued once per (date, boat)** — reprinting must not burn a new number.
- **Counting rule:** only `guide` and `trainee` count as มัคคุเทศก์ (ผู้ติดตาม). `intern` and `staff` roll into "อื่นๆ" together with the manual other-count. As of Aug 2026, interns appeared on 18 of 20 sheets — this is not an edge case.
- Pax on the form are **heads that actually travelled**, with FOC folded into adults.

**(b) ใบงานไกด์ — the crew-facing manifest.** A4 landscape, one page per hull, printed from the pier check-in boat card.

- **Excludes bookings with no boat** and bookings voided on site (kept only as a header tally).
- Every per-head figure uses **travelled** heads, not booked.
- Header stats: real pax by type, guide-language counts, special meals, longtail join/charter counts.
- The layout auto-fits to one page by measuring a probe and stepping the density, then padding rows to fill the page.

> **Historical bug worth knowing:** the sheet used to read only the first three guides, so guides 4–5 vanished silently and interns/staff never reached the job sheet at all. Return **all** assigned people with their role and languages.

**(c) Guide languages requested by the customer** live on the **booking**, not the assignment. They are a *request*, not an allocation. Normalise them (strip "Guide"/"speaking", map to two-letter codes) at ingest.

### 6.7 Document check and OCR

The admin verifies each B2B booking's data against its attached voucher, for a travel date.

**List:** every booking where the schema version is 2 and an agent is set, status ≠ `rejected`, with a trip on that date. Cancelled bookings **stay in the list**, greyed with "✕ ยกเลิก" — the agent still sent paperwork. Ordering is route → voucher.

**Checklist, six items:** route/programme, travel date, lead name, pax count, voucher/ref, payment.

**Status enum:** `verified | issue | pending | nofiles`. Derived as: an explicit status if set; else `pending` if there are attachments; else `nofiles`. Three separate screens call the same derivation, so the counts always agree — keep it in one place.

#### OCR today

- Tesseract.js v5, lazy-loaded **from a CDN** in the browser, one shared worker, language **`eng` only**.
- **Image attachments only.** PDFs are skipped with "Pre-Check supports image attachments only (PDF must be checked manually)."
- **It does not read MRZ.** It fuzzy-matches the six checklist fields: voucher by alphanumeric substring or last-8 tail; date against ~14 format candidates; lead name by order-independent token match; pax by regex on `adult|child|infant|pax|ท่าน|คน` compared per type with FOC folded into adults; route by keyword score ≥ 0.5; payment by a keyword set chosen from the agent's pay type.
- Items scoring `match` are auto-ticked for users with edit rights.
- Result cached on the booking as `doc_check.pre = {at, lang, auto_tick, results, summary{match,maybe,mismatch,none}, text}` with the extracted text truncated to 3000 characters.
- **Needs network at runtime.** With no network the CDN load rejects and the bar shows "Pre-Check ไม่สำเร็จ" with a retry. The error object is written to the cache but **not persisted**.

#### Server-side replacement

Move OCR to the API. Browser-side OCR is unfixable for four reasons: it needs a CDN at runtime, it burns the operator's CPU, its results cannot be audited, and three of the four writers against this database are not that browser.

```
POST /ops/doc-check/{booking_id}/precheck      -> 202 { job_id }
GET  /ops/doc-check/{booking_id}/precheck      -> { status, results, summary, engine, lang, at }
```

Specification:

- **Asynchronous.** Enqueue a job; return `202` with a job id. The UI polls or subscribes. OCR on a 6-page voucher pack takes seconds, and blocking a request for that is wrong.
- **Store the result** in `doc_check_precheck`, keyed by `(booking_id, attachment_set_hash)`, so re-running on unchanged attachments returns the cached answer instead of re-doing the work. `attachment_set_hash` is a hash of the attachment ids and their content hashes.
- **Rasterise PDFs server-side** so the "images only" limitation disappears. This is a straight improvement, not a parity break — record it as a deliberate deviation.
- **Language:** `eng` today. Add `tha` as a second pass; report which engine and language produced each field so a Thai-only voucher is not silently scored as "no match."
- **Auto-tick stays a hint.** The result carries per-field confidence and the UI must keep saying "ระบบติ๊กช่องที่ตรงให้อัตโนมัติ — โปรดตรวจขั้นสุดท้ายก่อนกด ✅" (*the system auto-ticks matching fields — please do a final check before confirming*). **Never let OCR set the document status.** Only a human sets `verified` or `issue`.

**When OCR is unavailable** (engine down, queue backed up, attachments unreadable):

- The precheck job ends `status = "unavailable"` with a `reason`, and this **is persisted** — unlike today, where the failure is thrown away, so nobody can tell "never ran" from "ran and failed."
- The checklist stays fully usable manually. **OCR is never on the critical path** for verifying a document.
- The endpoint returns `503` with `Retry-After` only for a transient engine outage; a permanently unreadable attachment returns `200` with per-attachment `status: "unreadable"`.

### 6.8 Travel Summary — closing the day

The day-close document. Rows are every non-cancelled booking with a trip that day, carrying booked, travelled (= booked − no-shows), the raw events from both check-in stages, van and boat ids, amount, the applicable policy text, and the existing decision.

- A row lands in the **penalty decision** section only when someone really did not travel: no-shows > 0, or real losses > 0, or a decision already exists. **Pressing something at the pier is not enough.**
- Decisions: shortcut buttons, a typed custom amount, postpone, or clear.
- Cash-on-Tour settlement per booking: `mode ∈ full | part | none | payout`, with a suggested mode (`none` when the agent handles COT separately), a reference field and an undo.
- The printed day-close pack has four sections in one document: route summary · penalty decisions · on-site money by method · **the daily manifest**.
- **Sorting is route → agency A–Z → voucher** and the reference list uses the identical ordering. Changing one without the other breaks the paper cross-check that staff physically perform.
- Overnight return legs appear in the manifest (they are on the boat) but contribute 0 to the money, so nothing is double-counted.

---

## 7. Transfer fleet, vans and pickup

The dispatcher's half of the product: from "which hotel does the guest stand in front of" to "which van, with which driver, prints on which job order."

### 7.1 The vehicle registry

```
van(id, name, plate, vehicle_type, capacity, ownership, partner_name,
    zone_base, driver_name, driver_phone, active, note, colour)
  vehicle_type ∈ sedan | van | minibus | bus
  ownership    ∈ own | partner | rented        -- 'partner' = รถร่วม, a co-operating operator
  zone_base    ∈ PK | KL
```

Plus per-day and per-range state, currently stored as open-ended maps on the vehicle record:

| Today | Meaning | Rebuild |
|---|---|---|
| `dayRoute[date]` = routeId or routeId[] | Which programme(s) this van runs that day. **A van may run two programmes in one day.** | `van_day_route(service_date, van_id, route_id)` — one row per programme |
| `dayZone[date]` | Zone override for a single day | `van_day_zone(service_date, van_id, zone_code)` |
| `dayStatus[date]` ∈ `available | maintenance | off` | Day status override | `van_day_status(service_date, van_id, status_code)` |
| `statusRanges[]` | Longer status ranges | `van_status_period(van_id, status_code, valid_from, valid_to, note)` with the same exclusion constraint as boats |
| `zoneOverrides[]` | Temporary zone-swap ranges | `van_zone_period(van_id, zone_code, valid_from, valid_to)` |
| `log[]` capped at 100 | Audit trail, kinds `created|status|zone|driver|edit` | `van_event` — uncapped |

**Effective zone of a vehicle on a date**, in order: (1) if the van has a route that day, the zone implied by that route's pier; (2) the day zone override; (3) a matching zone-override range; (4) `zone_base`.

**Usable on a date** = `active` AND day status is not `off` or `maintenance`. A van marked out of service disappears from the group dropdowns for that day, **but any group already holding it keeps it** — the dispatcher must see and resolve that, not have the van silently removed.

> **Bug: id collision on the form path.** The quick-add path appends a random suffix to the vehicle id for multi-user uniqueness; the full form's create path does **not**. Two people adding a van at the same time can collide. In the rebuild ids are server-generated.

> **Bug: a vehicle colour field needs a matching database column or it is silently dropped** on the next round-trip. This is the four-place field-registration problem again; the rebuild's typed columns end it.

### 7.2 Van group = ONE outbound van; the return van is per booking

**This asymmetry is the single most misunderstood rule in this domain. Read it twice.**

- A **van group** is a set of bookings collected by **one van** on the outbound leg. Group membership is keyed `(date, route, zone, group_number)`.
- The **return van is per booking**, not per group. A guest may be dropped somewhere else entirely — a different hotel, the airport, a different beach — and the group has no say in that.
- `van_return_id` empty means **"returns on the outbound van"**. That is how the job order reads it: `return_van = COALESCE(van_return_id, van_id)`.

Consequences that are enforced today and must be enforced in the rebuild:

| Rule | Enforcement |
|---|---|
| One van per group | Joining a group **overwrites** each incoming member's outbound van with the group's van. Setting the group's van writes it to every member. Otherwise the group header shows van A while the job order for van B silently carries the booking, and nobody notices until a guest is standing in a lobby. |
| The return van is inherited **only if empty** | Grouping fills `van_return_id` only when the member has none. |
| A heal must **never** spread `van_return_id` | Spreading it would silently arrange return vans nobody asked for. |
| One van per group per date | A van already used by another group that day is disabled in the dropdown — 1 รถ = 1 กรุ๊ป. |
| Capacity is checked on join **and** on van selection | Sum the group's pax against the vehicle's capacity; over ⇒ "ที่นั่งไม่พอ" and abort. |
| The outbound van pool is **only vans assigned to this route in the month matrix** | "A van not assigned in the month matrix must NOT be pickable here." |
| The return van pool is deliberately **wider** — matrix vans plus any usable van in the zone | A guest going to the airport may need a van that is not on this programme. |

**Group fields** (all per travel day — see §8):

```
van_group      integer   0 or absent = ungrouped
van_seq        integer   manual pickup order inside the group
van_id         text      the OUTBOUND van
van_return_id  text      per booking; NULL = returns on the outbound van
return_same_van boolean  the dispatcher explicitly confirmed "↩ กลับคันเดิม" (same van back)
pickup_time_final text   the dispatcher's override; wins over the trip's stored time
van_split[]     rows     {van_group, van_seq, van_id, van_return_id, pax, ad, chd, inf, foc}
```

Group numbering is `max(van_group) + 1` scanned across the **whole day + route, all zones and charter** — it used to be numbered per zone, which produced two groups both labelled "กรุ๊ป 2" in the top strip.

A fifth pseudo-zone `__CHARTER__` exists purely for grouping, so charter (เหมาลำ) van groups never collide with seat groups.

### 7.3 Disband — the gap you must close

Disbanding a group must clear **all four** fields on every member:

```
van_group  -> cleared
van_seq    -> cleared      (a stale manual order freezes the row's position after re-grouping)
van_id     -> NULL
van_return_id -> NULL
```

The non-split branch used to leave `van_id` and `van_return_id` set, so a disbanded booking **still shipped on the old van's job order**, and re-grouping it elsewhere produced "รถปนกัน" (*mixed vans*). That is fixed.

**The gap that is still open:** the group heal (§7.8) reconciles `van_id` **only** — deliberately, because spreading the return van would be wrong. But that means there is **no** reconciliation path for `van_return_id` at all. A member whose return van points at a van that has since been disbanded, deactivated, or reassigned is never detected.

**Specify the correct model:**

```sql
CREATE TABLE van_group (
  service_date date NOT NULL,
  route_id     text NOT NULL REFERENCES route(id),
  zone_code    text NOT NULL REFERENCES pickup_zone(code),   -- or '__CHARTER__'
  group_no     integer NOT NULL,
  van_id       text REFERENCES van(id),                      -- THE outbound van. NULL = not chosen yet
  pickup_time_final text,
  PRIMARY KEY (service_date, route_id, zone_code, group_no)
);

CREATE TABLE van_assignment (
  service_date  date NOT NULL,
  booking_id    text NOT NULL,
  split_no      smallint NOT NULL DEFAULT 0,   -- 0 = the whole booking
  route_id      text NOT NULL,
  zone_code     text NOT NULL,
  group_no      integer,                        -- NULL = ungrouped
  van_seq       integer,
  van_return_id text REFERENCES van(id),        -- NULL = returns on the group's outbound van
  return_same_van boolean NOT NULL DEFAULT false,
  pax smallint NOT NULL, pax_ad smallint, pax_chd smallint, pax_inf smallint, pax_foc smallint,
  PRIMARY KEY (service_date, booking_id, split_no),
  FOREIGN KEY (service_date, route_id, zone_code, group_no)
    REFERENCES van_group (service_date, route_id, zone_code, group_no) ON DELETE SET NULL,
  CONSTRAINT return_exclusive CHECK (NOT (van_return_id IS NOT NULL AND return_same_van))
);
```

**What this buys:**

- **The outbound van lives on the group, once.** "รถปนกัน" becomes structurally impossible: there is no per-member outbound van to disagree with the group's. The conflict scanner in §7.8 becomes unnecessary for the outbound leg.
- **The return van lives on the assignment**, exactly matching the business rule, and `NULL` still means "returns on the outbound van."
- **Disband is `DELETE FROM van_group ...`**, and `ON DELETE SET NULL` clears `group_no` on every member atomically. Clearing `van_seq` and `van_return_id` is one `UPDATE` in the same transaction — and, critically, it is now *one place*, so it cannot be got right in one branch and wrong in another.
- `return_same_van` and `van_return_id` are mutually exclusive by constraint, replacing today's convention that setting one clears the other.

**Reconciling return vans becomes possible.** With `van_return_id` a real FK, a van that is deactivated or has its day status set to `off` can be detected by a query, and surfaced as a violation:

```sql
SELECT a.* FROM van_assignment a
JOIN v_van_usable u ON u.van_id = a.van_return_id AND u.service_date = a.service_date
WHERE NOT u.usable;
```

Report it. **Do not auto-clear it** — ห้ามเดา.

### 7.4 Splits

A booking can be split across two vans (✂ แยกคน) when it will not fit in one, or when part of the party is collected somewhere else.

- Cannot split a 1-pax allocation. Must leave at least 1 pax behind.
- The modal sets each pax type individually. It replaced an older prompt that only asked "how many" and then **guessed who was a child** — and guessed wrong, so the job sheet printed a child as an adult.
- **`pax` (headcount) and the `ad/chd/inf/foc` breakdown are always written together.** A past bug let them drift.
- Warns (does not block) if either side ends up with children or infants and **no adult**.
- Undo folds the first split's van fields back to the flat allocation.

**Auto-splits from multi-point pickup.** A booking with multiple pickup points generates splits automatically, each marked with its pickup area, hotel and zone. The rebuilder **leaves manual splits alone**. A repair pass fixes splits whose headcount and breakdown disagree, trusting the headcount and re-dealing types (adults to the split-off parts first), then swapping 1:1 so no van carries children without an adult.

> **A scalar "this split was automatic" flag is not mapped to the database today and is lost on every round-trip**, so auto-ness has to be re-detected from the surviving split markers. In the rebuild it is a real column: `van_assignment.split_source ∈ manual | alt_pickup`.

### 7.5 Per-date driver, phone and plate overrides

Partner vans (รถร่วม) send a different driver and often a different plate every day.

Today: `VANJOB_DRIVER['YYYY-MM-DD::vanId'] = {driver, phone, plate}` — a **composite string key** into an open-ended map, persisted as one blob key.

Resolution: the per-date override if non-blank, else the vehicle registry's default driver / phone / plate. A 📌 pin glyph marks an override wherever the value is shown.

**Relational replacement:**

```sql
CREATE TABLE van_day_override (
  service_date date NOT NULL,
  van_id       text NOT NULL REFERENCES van(id),
  driver_name  text,
  driver_phone text,
  plate        text,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   text,
  PRIMARY KEY (service_date, van_id)
);

CREATE VIEW v_van_day_crew AS
SELECT d.service_date, v.id AS van_id,
       COALESCE(NULLIF(o.driver_name,''),  v.driver_name)  AS driver_name,
       COALESCE(NULLIF(o.driver_phone,''), v.driver_phone) AS driver_phone,
       COALESCE(NULLIF(o.plate,''),        v.plate)        AS plate,
       (o.van_id IS NOT NULL) AS is_override
FROM ...
```

**The key has no route component, deliberately** — one van, one driver, one day, even when the van runs two programmes. Preserve that: the primary key is `(service_date, van_id)`, not `(service_date, van_id, route_id)`.

The plate field is only editable for `ownership = 'partner'` today. Keep that as a UI rule, not a constraint — a rented van could plausibly change plates too.

> **Today a view-only user can type into these inputs and the write is silently dropped**, with no feedback at all. The rebuild returns `403` and the UI must show it.

### 7.6 Self-arrive and self-return — a revenue rule, not a logistics flag

**State this to the implementer in exactly these terms: a guest who makes their own way to the pier still paid for the transfer. Dropping them from the van job order must not change the rate, the invoice, or anything downstream of pricing.**

**Self-arrive (outbound)** happens two independent ways:

1. An explicit checkbox on the booking (`pickup_self`), or
2. The effective zone is `NoTransfer` (i.e. a No-Transfer seat with no private-van add-on), or the pickup area is one of the `nt-*` pier entries.

Effects:

| Place | Behaviour |
|---|---|
| Job order OUTBOUND section | Row skipped entirely |
| Van jobs aggregation | Not counted as an assigned van job, **and not counted as unassigned** |
| Late-booking guard banner | Excluded |
| Van check-in | Never lands in the unassigned bucket |
| By-trip van cell | Renders the italic string `self-arrive` |
| Pickup time | A normaliser rewrites a stale clock time (e.g. `07:30-07:45`) back to the area default (`Before 08:30 at pier`) and clears the dispatcher's override |
| **Rate / invoice / pricing** | **Unchanged. The transfer was sold and is not refunded by this flag.** |

**Mis-tick guard.** The van jobs page collects bookings ticked self-arrive that **still** sit on a transfer zone or **still** carry a van, and surfaces them — otherwise they would silently vanish from the outbound sheet.

**Self-return** is the mirror on the way back and is **computed, not stored**: true when the booking has a separate drop-off whose area is `NoTransfer`, or whose name matches `/self-?arrive|กลับเอง|self[\s-]?return/i`. A self-return booking is dropped from the return job order and never raises the "ยังไม่จัดรถกลับ" (*no return van arranged*) alert.

In the rebuild, store both explicitly rather than deriving self-return from a name regex:

```
booking.pickup_self       boolean
booking.dropoff_self      boolean     -- replaces the regex
booking.dropoff_area_id   FK, nullable
booking.dropoff_same      boolean
```

Run the regex **once, at migration**, to populate `dropoff_self`, and log every row it changed. Do not keep the regex in the runtime path.

### 7.7 The return leg

The return-leg state for a booking on a date:

| Field | Meaning |
|---|---|
| `separate_dropoff` | The booking has a drop-off different from its pickup |
| `dropoff_text` | Where |
| `return_van_id` | The chosen return van (for a split booking: all splits must have one to count as arranged) |
| `arranged` | A return van is set |
| `self_return` | The guest makes their own way back |
| `same_van` | The dispatcher pressed "↩ กลับคันเดิม" (*same van back*) |
| `alert` | `separate_dropoff AND NOT arranged AND NOT self_return AND NOT same_van` |

Job order behaviour:

- `return_van = COALESCE(van_return_id, group.van_id)` — **the outbound van is the default return van.**
- Rows that arrived on a different van are **sorted last** and tagged "· มาจากรถอื่น (ขาไป X)" (*came on another van, outbound X*); rows on the same van are tagged "· กลับคันเดิม".
- **Return rows show the DROP-OFF area's zone, not the pickup's.** A Patong → Chalong return used to print "Patong". This is a fixed bug; do not regress it.

**Overnight (OVN) special cases** — these were real dispatch failures:

- On an OVN **return day** the guest arrives by boat, so there is no hotel pickup: the leg is forced to `NoTransfer`, the pickup cell prints the pier name, and the row is excluded from the outbound section.
- On an OVN **outbound day** there is no return run at all, and the drop-off cell prints "🌙 ค้างคืนบนเกาะ · กลับ &lt;date&gt;" (*overnight on the island, returning &lt;date&gt;*).

### 7.8 "รถปนกัน" — mixed vans in one group

**What it means:** two or more different vans inside a single van group. The Thai literally means *the vans are mixed together*.

**Why it is dangerous:** the group header shows one van, the job order for a different van silently carries the booking, and nobody finds out until a guest is standing in a hotel lobby.

**How it is detected today:** on **every render**, every group `(date, route, zone, group_no)` is bucketed and the distinct van count is counted; anything with 2+ is reported with its route name, the conflicting van names and the pax count. `NoTransfer` zones are skipped. It surfaces in three places: a sticky header chip on the by-trip page, a per-group chip listing the conflicting van names, and a banner on the printed job order — filtered to conflicts involving *that* van.

**There is deliberately no auto-pick.** The comment in the source says so explicitly: "per user: ห้ามเดา." Resolution is manual — re-select the group's van.

**In the rebuild this class of conflict disappears for the outbound leg**, because §7.3 puts the outbound van on the group row, not on each member. Keep the detector anyway, running as a **scheduled data-quality check** rather than on every render, covering the cases the schema cannot: a return van pointing at an unusable vehicle, a group whose van's capacity is now below the group's pax, a member assigned to a van running a different programme that day. Report; never resolve.

The related-but-opposite heal — a member with **no** van in a group where the group has one — also disappears: with the van on the group, a member cannot lack one.

### 7.9 Van job orders

The printed / shareable driver sheet.

- A "job" is keyed **`(van_id, route_id)`** for a date — a van running two programmes in a day prints **two separate sheets**.
- Two tables (outbound and return) with shared column widths so they align.
- Row sort: return rows that came from another van last; then manual `van_seq`; then pickup time.
- Per row: pickup location (plus a user-typed Thai label), area with its Thai name, `AD / CHD / INF / FOC` breakdown, special request, drop-off.
- Header wears the van's identity colour.
- A **late-booking guard banner**: any booking on this van's route(s) that day with **no van at all**, excluding rows already on this sheet.
- A "ส่งคนขับ" (*sent to driver*) toggle stamps a timestamp per `(date, van_id, route_id)`.

Sheet-level overrides, keyed independently of the booking record:

| Override | Key | Fallback |
|---|---|---|
| Driver / phone / plate | `(date, van_id)` | vehicle registry |
| Thai label for a pickup location | pickup location **name** (global, reused everywhere) | none |
| Special request text | `booking_id` | the booking's notes |
| Sent-to-driver timestamp | `(date, van_id, route_id)` | — |

> **The special-request override stores `''` deliberately.** An empty override means "deleted from the sheet", which is different from "no override". Model it as a nullable column plus a `has_override` boolean, or as a row whose presence is the signal — not as `COALESCE(override, default)`, which loses the distinction.

**PNG export currently lazy-loads a rendering library from a CDN and needs network.** In the rebuild, render the sheet server-side to PDF and PNG. The driver receives a link or a file; nothing depends on the dispatcher's browser reaching a CDN.

**Who uses it:** the driver. It is often sent as a photo over LINE, so legibility at phone-screen size is a real requirement, not a nicety.

### 7.10 Van check-in

The morning of travel, as each van loads.

- Bookings are bucketed by `(van_id, route_id)`. OVN return legs are excluded (they are drop-offs, not pickups). A transfer-zone booking with no van and not self-arrive lands in an **unassigned** bucket.
- Group headers are ordered by zone, then route name, then van, and show the group number, the van pill, and plate/driver/phone from the day override.
- Per row: `−/+` headcount, No-show / CXL event buttons, and the ✓ check-in toggle.
- Reducing the count with no reason immediately opens the reason modal.
- Toggling ✓ again un-checks but **keeps the counted values**.
- Clearing a day's assignment deletes both `van_checkin` and `pier_checkin` for that day — otherwise a rescheduled booking inherits yesterday's "boarded / no-show" and the Travel Summary totals are wrong.

**Nothing links a van to a boat directly.** A helper closes that gap for the dispatcher: for a given van and date it reports **which boats this van's passengers are going onto**, and warns "⚠ แยกลง N ลำ" (*split across N hulls*) when there is more than one. The reason recorded in the source: "คนขับกับไกด์ไปเจอกันงงหน้าท่า" — *the driver and the guide meet at the pier and are confused.* Keep this report.

### 7.11 The four overlapping "where" concepts

Four separately-stored notions of "where", with partial and non-obvious overlap. Adding one real new zone touches five or six places today, which is why the team's standing decision (2026-06-01) is *not* to add one until either two land at once or non-technical staff need zone CRUD. **The rewrite should bank this win.**

#### The four

**(1) Pier — where the boat leaves from.** Stored on `route.pier` and `boat.pier`. Values `tublamu | panwa | ranong`. §2.4.

**(2) Van zone (pickup zone) — which pool of vans, and which price band.** Values `PK` (Phuket), `KL` (Khao Lak), `NoTransfer` — **aliased `NT` in many guards, so always test both spellings.** Stored on the trip (`trip.zone`), on the booking as a fallback (`booking.pickup_zone`), and on the vehicle (`zone_base` + overrides + day zone).

The *effective* zone for van operations is: the seat zone, **unless** it is No-Transfer **and** the booking bought a private-van add-on, in which case the van's zone wins. The source comment is explicit: **this is for van operations only, never for seat pricing.** Pricing stays on the trip's own zone.

**(3) Rate-type zone — which seat price applies.** The same three tokens `PK / KL / NoTransfer`, but a completely **different store**: the rate type's `seat_rates[route][zone][pax_type]`. Nothing in the van domain writes it. The only coupling is that choosing a pickup **area** copies that area's zone onto the trip — and **deliberately skips trips that carry a private-van add-on**, because pushing a No-Transfer seat onto a PK zone can land on a rate cell that does not exist ("no rate").

**(4) Pickup area — the actual named collection point.** `{id, name, zone, region, time_group}`. About 38 seeded: 33 `PK`, 2 `KL` placeholders, 2 `NoTransfer` pier entries named "… (self-arrive)". The booking carries `pickup_area_id` (booking-level, not per trip) and a drop-off counterpart. `region` is a **loose grouping label only** (`phuket-north`, `phang-nga`, …) used for sort order in a marketing export — **it is not a zone.** `time_group` is the join key to pickup times: several areas that leave at the same minute share one group (e.g. `pk-w2` = Patong + Karon + Kata). It is required on save.

#### How they overlap, and the trap

```
route.pier  --(pier -> van zone)-->  van zone     panwa -> PK      tublamu -> KL
area.zone   --(set pickup area)--->  trip.zone  --> rate-type zone lookup
                                             \--> effective zone --> van pool / grouping key
area.time_group --> (legacy) flat pickup-time matrix
area.id         --> (current) profile.times[route][area_id]
```

**The trap:** the pier→zone map sends **Tub Lamu routes to `KL`**, but Tub Lamu routes pick up from **`PK` areas**. The seeded Similan programme is entirely `pk-*` time groups, yet its route maps to `KL`. This only bites where the two are mixed: the auto-group function computes the zone from the route and, *if no van has been assigned to the programme in the month matrix*, falls back to vans in that zone — i.e. **Khao Lak vans for a Phuket pickup run**. The primary path avoids it, and the manual dropdown ignores the zone entirely, so this is latent rather than observed. **Do not port the fallback.**

#### The unified relational model

Make a new zone one insert.

```sql
CREATE TABLE pickup_zone (
  code        text PRIMARY KEY,          -- 'PK' | 'KL' | 'NoTransfer'
  label_en    text NOT NULL,
  label_th    text NOT NULL,
  kind        text NOT NULL REFERENCES pickup_zone_kind(code),  -- 'transfer' | 'no_transfer' | 'charter'
  sort_order  integer NOT NULL,
  colour      text,
  active      boolean NOT NULL DEFAULT true
);

CREATE TABLE pickup_area (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  name_th       text,
  zone_code     text NOT NULL REFERENCES pickup_zone(code),
  region_code   text REFERENCES pickup_region(code),   -- display grouping ONLY, never a zone
  time_group_id text NOT NULL REFERENCES pickup_time_group(id),
  latitude      numeric(9,6),                          -- kills the hardcoded coordinate table
  longitude     numeric(9,6),
  active        boolean NOT NULL DEFAULT true
);

CREATE TABLE pickup_time_group (
  id text PRIMARY KEY, name text NOT NULL, zone_code text NOT NULL REFERENCES pickup_zone(code)
);

CREATE TABLE pickup_time_profile (
  id text PRIMARY KEY, name text NOT NULL,
  valid_from date NOT NULL, valid_to date NOT NULL, notes text,
  cloned_from text REFERENCES pickup_time_profile(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_to >= valid_from)
);

CREATE TABLE pickup_time (
  profile_id text NOT NULL REFERENCES pickup_time_profile(id) ON DELETE CASCADE,
  route_id   text NOT NULL REFERENCES route(id),
  area_id    text NOT NULL REFERENCES pickup_area(id),
  time_text  text NOT NULL,        -- '07:30-07:45' or 'Before 08:30 at pier'
  PRIMARY KEY (profile_id, route_id, area_id)
);

-- the pier -> zone relationship becomes DATA, not a hardcoded map
ALTER TABLE pier ADD COLUMN default_pickup_zone_code text REFERENCES pickup_zone(code);
```

**What this changes:**

| Today | After |
|---|---|
| Zone dropdown hardcoded to three values in the Pickup Setup UI | `SELECT * FROM pickup_zone WHERE active` |
| `panwa → PK`, `tublamu → KL` hardcoded in a function | `pier.default_pickup_zone_code`, editable |
| `NoTransfer` vs `NT` spelling tested everywhere | One canonical code; aliases normalised at ingest |
| Adding a zone touches ~5–6 code sites | One `INSERT INTO pickup_zone` |
| Adding an area does **not** put it on the pickup map (a hardcoded coordinate table must be edited too) | `latitude`/`longitude` on the area row |
| `region` easily mistaken for a zone | Separate `pickup_region` table with a comment saying it is display-only |
| The rate-type zone lives in a different store with the same tokens | Both reference `pickup_zone(code)`; the *meaning* stays separate (one prices seats, one picks vans) but the vocabulary can no longer drift |

**Keep the two meanings distinct even though the vocabulary is now shared.** The rate-type zone answers "what does this seat cost"; the van zone answers "which vans can collect these people". They coincide today; they need not tomorrow. Two foreign keys to the same lookup, not one column doing both jobs.

#### Pickup time resolution — the five-step fallback

Given a booking, "what time does the van come" resolves through five steps that live in three different modules today:

1. **Hotel → area.** There is **no automatic hotel→area mapping.** The hotel name is free text; the area is chosen by a human in the booking form. The only machinery is de-duplication: near-identical hotel spellings are clustered by similarity (default threshold 0.82) under a union-find, **refusing to merge names that have been seen in different pickup areas** unless explicitly overridden. Merging rewrites the hotel name on the affected bookings and appends a history entry — **it is irreversible and says so.**
2. **Area → default time.** Resolve the schedule profile covering the date (**narrower range wins, then newer creation time**), then look up `profile.times[route][area]`, then the legacy `profile.times[route][time_group]`, then the legacy flat matrix `[route][time_group]`, then null.
3. **Default → the booking's stored time.** The trip's `pickup_time` is **snapshotted at booking time**, not looked up at read time. It is refilled when the pickup area, route or date changes — **skipping trips flagged as manually edited**.
4. **Stored → the dispatcher's final word.** `pickup_time_final` per travel day overrides everything.
5. **The read expression**, used identically by six consumers: `pickup_time_final || trip.pickup_time || booking.pickup_time || ''`.

Time values are **free text**: usually `07:30-07:45`, but pier rows carry prose like `Before 08:30 at pier`. Code that must tell them apart tests `/\d{1,2}[:.]\d{2}/` **and not** `/pier/i`. Keep the free-text column — do not force it into a time type — but add a `time_kind ∈ clock | prose` column so consumers stop regexing.

Profile overlap is a **warning, not a block**. The confirm text mentions only the "more recently created" rule and understates the narrower-range rule; fix the wording.

**Deleting an area or a profile does not touch bookings**, and both confirms say so. That is true because bookings snapshot the time. Preserve the snapshot behaviour — it is what makes the schedule editable without rewriting history.

---

## 8. The `bk.ops` seam

### 8.1 What the seam is

Booking owns a per-travel-day container called `ops`:

```
ops = { boatId, boatSplits[], upgrade, pierCheckin, reconfirm, pfm,
        vanId, vanReturnId, returnSameVan, vanGroup, vanSeq, vanSplits[],
        pickupTimeFinal, vanCheckin }
```

**Booking owns the container. Fleet, boat operations and vans are the only things that read and write its contents operationally.** Booking itself barely touches it — it creates it, carries it across edits, and clears it on reschedule.

**Booking migrates first** under the strangler-fig plan. Fleet stays in the monolith for at least one more phase. So for the duration of the strangle, **fleet will read and write booking data across a temporary adapter**. This is called out in the rewrite plan as the riskiest part of the whole booking phase.

### 8.2 `ops` is PER TRAVEL DAY — the rule everything else depends on

- Day 1 of a booking lives in `booking.ops`. **Every later day lives in `trip.ops`** — its own columns on the trip child table.
- Access is through four accessors, never by touching `booking.ops` directly: read (never creates), read-write (creates on demand), clear (wipes one day), and resolve-target-day.
- A single-day booking's day-1 accessor returns `booking.ops` itself, so legacy call sites keep working. **1,058 of 1,059 bookings were single-day when this was introduced** — which is exactly why the bug hid for so long.
- **Reading `booking.ops` directly on a multi-day booking gives you day 1's boat and van.** That was the bug where an overnight's return leg showed the outbound boat, the outbound van, and a hotel pickup for someone coming back from the island.
- Clearing a day also deletes that day's van check-in and pier check-in. Moving a trip to a new date must not carry yesterday's "boarded" state.

**In the rebuild this container does not exist.** §5.3 and §7.3 replace it with real tables keyed on `(service_date, booking_id)`. The per-day rule stops being a convention enforced by four accessor functions and becomes the primary key.

### 8.3 The contract, from the fleet side

While the adapter is in place, define it precisely.

**What fleet READS from booking**

| Data | Used for | Read shape |
|---|---|---|
| Booking identity, status, agent, lead pax, phone, nationality | Manifests, job sheets, check-in rows, Travel Summary | `GET /booking/trips?date=&route_id=` |
| Trip route, date, booking mode, pax breakdown `{ad_fr, ad_th, chd_fr, chd_th, inf_fr, inf_th, foc}` | Seat pool, load per hull, kitchen order, guide sheet | same |
| `trip.charter_boat_id` | Charter hull detection | same |
| `pickup_area_id`, `pickup_zone`, `pickup_self`, `hotel_name`, `room_number`, drop-off fields, `alt_pickups[]` | Van grouping, job orders, pickup map | same |
| `notes` | Job-order special-request default | same |
| `trip.pickup_time`, `trip.pickup_time_edited`, `trip.zone` | Pickup time resolution | same |
| OVN flags (`ovn`, `ovn_leg`, `ovn_return_date`) | Leg handling | same |
| Payment snapshot / cash-on-tour / uncollected upgrades | Pier money owed | `GET /booking/{id}/money` |
| Cancelled status | Excluded from every aggregate | same |

**What fleet WRITES back to booking (via the adapter)**

| Field | Written by | Frequency |
|---|---|---|
| `ops.boatId`, `ops.boatSplits[]` | Boat assignment | Bulk, D−2…D−1 |
| `ops.upgrade` | Emergency boat upgrade | Rare |
| `ops.vanId`, `ops.vanGroup`, `ops.vanSeq`, `ops.vanReturnId`, `ops.returnSameVan`, `ops.vanSplits[]`, `ops.pickupTimeFinal` | Van grouping | Bulk, D−1 |
| `ops.vanCheckin` | Van check-in | High frequency, D morning |
| `ops.pierCheckin` | Pier check-in | High frequency, D morning |
| `ops.reconfirm` | Re-confirm | D−1 |
| `pier_payments[]` | Pier money collection | D morning |
| `doc_check{}` | Document check | D−3…D−1 |
| `history[]` entry | Every one of the above | — |

**What must NEVER be written by two systems at once**

| Field | Sole owner | Note |
|---|---|---|
| Everything inside `ops` | **Fleet/dispatch** | Booking must **carry it across an edit, never regenerate it**. See below. |
| `status`, `trips[]` shape, pax counts, pricing, `price_breakdown`, `payment_snapshot` | **Booking** | Fleet reads only. A pier no-show is recorded as a check-in *event*, never by editing the pax count. |
| `pier_payments[]` | Fleet (pier) | Booking must not merge these into the payments ledger without the day-close reconciliation. |
| `doc_check{}` | Fleet (admin) | |
| `weather_resolve` | Booking, set from a fleet action | Fleet triggers the weather cancel; booking owns the resolution state. |

**The contract that breaks most often.** Booking's commit path today rebuilds a fresh booking object on edit, and its `if (editing)` block must carry `ops` across explicitly. `ops` is first in that list precisely because losing it loses every boat and van assignment plus both check-ins, silently, on the next save.

**In the rebuilt booking API this must be structurally impossible:** updates are `PATCH` on named columns, and `ops` is not a booking column at all — it is a set of foreign-keyed rows in the fleet tables. A booking edit cannot touch them.

### 8.4 Adapter requirements, concretely

While fleet still lives in the monolith:

1. **The adapter is read-write for `ops` and read-only for everything else.** Any other write from the monolith to booking must fail loudly, not silently.
2. **Every `ops` write carries the service date.** No endpoint may accept an `ops` write without an explicit date — the day-1/day-N ambiguity is the single largest source of bugs in this seam.
3. **Optimistic concurrency per booking-day**, not per booking and not global. Two dispatchers assigning boats on two different dates of the same overnight booking must not conflict.
4. **The adapter is deleted at the end of the phase**, and the `ops` fields are dropped from the booking model in the same migration that creates `trip_boat_assignment` and `van_assignment`. Write the deletion migration at the same time as the adapter so it cannot be forgotten.
5. **Cross-reference doc 01 (booking) for the other side of this contract.** Where doc 01 and this document disagree about who owns a field, doc 01 wins for the booking record itself and this document wins for anything inside `ops`.
---

## 9. Target relational schema

PostgreSQL 18. All timestamps `timestamptz`. All service dates are `date` in Asia/Bangkok — set `TimeZone = 'Asia/Bangkok'` on the role, and never derive a service date from a UTC timestamp.

Conventions: `text` primary keys preserve the existing ids (`b1`, `MJ-014`, `INC-003`) because ~2,900 booking-trip rows and every pier ledger row already reference them. New tables get `bigint generated always as identity` unless they need a human-readable number.

### 9.1 Lookup tables

One line of rationale each.

```sql
-- Piers. Kills the visitpanwa / "Tub Lamu" typo class permanently.
CREATE TABLE pier (
  code text PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9_]{1,23}$'),
  label_en text NOT NULL, label_th text NOT NULL, label_short text NOT NULL,
  long_name_th text, display_group text, colour text,
  default_pickup_zone_code text,                 -- FK added after pickup_zone exists
  sort_order integer NOT NULL, active boolean NOT NULL DEFAULT true
);

-- Drive positions, ordered. Alphabetical sorting scrambles them; rank does not.
CREATE TABLE drive_position (
  code text PRIMARY KEY, label_en text NOT NULL, sort_rank smallint NOT NULL UNIQUE
);
-- Suzuki 'Starboard' == Honda 'Std'. Normalised at ingest, never stored.
CREATE TABLE drive_position_alias (
  alias text PRIMARY KEY, code text NOT NULL REFERENCES drive_position(code)
);

-- One status vocabulary for engine / gearbox / propeller. Legacy propeller 'active' maps to 'ready'.
CREATE TABLE asset_status (
  code text PRIMARY KEY, label_en text NOT NULL, is_serviceable boolean NOT NULL, sort_order smallint
);  -- ready | limited | fixing | broken | spare | retired

CREATE TABLE boat_status (code text PRIMARY KEY, label_en text NOT NULL, label_th text, blocks_dispatch boolean NOT NULL);
  -- available (false) | fixing (true) | unavailable (true) | retired (true)

CREATE TABLE boat_type (code text PRIMARY KEY, label_en text NOT NULL);        -- Speedboat | Catamaran
CREATE TABLE boat_ownership (code text PRIMARY KEY, label_en text NOT NULL);   -- company | charter
CREATE TABLE deployment_type (code text PRIMARY KEY, label_en text NOT NULL);  -- seat | charter

-- Storage: pier warehouses, shops, and 'on a boat'. Replaces THREE unrelated
-- location vocabularies that do not interoperate today (spare keys, warehouse
-- strings, and a free-text engine location list).
CREATE TABLE storage_location (
  code text PRIMARY KEY,             -- 'pier:tublamu' | 'shop:honda-phuket' | 'boat:b4'
  kind text NOT NULL,                -- pier | shop | boat | central
  label_th text NOT NULL, label_en text, pier_code text REFERENCES pier(code),
  boat_id text, colour text, active boolean NOT NULL DEFAULT true
);

CREATE TABLE pickup_zone (
  code text PRIMARY KEY, label_en text NOT NULL, label_th text NOT NULL,
  kind text NOT NULL,                -- transfer | no_transfer | charter
  sort_order integer NOT NULL, colour text, active boolean NOT NULL DEFAULT true
);
ALTER TABLE pier ADD CONSTRAINT pier_zone_fk
  FOREIGN KEY (default_pickup_zone_code) REFERENCES pickup_zone(code);

-- Display grouping ONLY. Never a zone. Named region_ to stop the confusion at the schema level.
CREATE TABLE pickup_region (code text PRIMARY KEY, label_en text NOT NULL, sort_order integer);

CREATE TABLE incident_severity (code text PRIMARY KEY, min_priority smallint NOT NULL);  -- critical|major|minor
CREATE TABLE maintenance_outcome (code text PRIMARY KEY, label_en text NOT NULL);
CREATE TABLE roster_code (
  code text PRIMARY KEY, label_th text NOT NULL, label_en text,
  kind text NOT NULL                  -- work | off | leave | none
);
```

### 9.2 Boats and status

```sql
CREATE TABLE boat (
  id text PRIMARY KEY,
  name text NOT NULL,
  type_code text NOT NULL REFERENCES boat_type(code),
  ownership_code text NOT NULL REFERENCES boat_ownership(code) DEFAULT 'company',
  pier_code text NOT NULL REFERENCES pier(code),          -- OPERATIONAL home pier
  homeport_city text,                                     -- LEGAL registration province
  homeport text,                                          -- LEGAL home port name
  cap integer NOT NULL CHECK (cap >= 0),                  -- commercial booking cap
  licence_pax integer CHECK (licence_pax >= 0),           -- legal seat ceiling
  total_cap integer, crew integer, engine_count integer NOT NULL DEFAULT 1,
  material text, gt numeric(8,2), nt numeric(8,2), dwt numeric(8,2),
  loa numeric(6,2), beam numeric(6,2), depth numeric(6,2), draft numeric(6,2), lbp numeric(6,2),
  bhp numeric(8,2), year_built integer,
  reg_no text, callsign text, imo text, owner_name text, owner_address text,
  colour text,
  retired boolean NOT NULL DEFAULT false, retired_at date, retired_reason text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT cap_within_licence CHECK (licence_pax IS NULL OR cap <= licence_pax)
);
CREATE UNIQUE INDEX boat_name_uq ON boat (lower(name)) WHERE retired = false;
CREATE INDEX boat_pier_idx ON boat (pier_code) WHERE retired = false;
-- cap_within_licence: today nothing stops someone selling more seats than the vessel is
-- licensed for. Every seeded hull already satisfies it, so it can be added on migration.

CREATE TABLE boat_document (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  boat_id text NOT NULL REFERENCES boat(id) ON DELETE CASCADE,
  doc_type text NOT NULL, doc_no text, expires_on date, renew_status text, file_ref text,
  UNIQUE (boat_id, doc_type, doc_no)
);
CREATE INDEX boat_document_exp_idx ON boat_document (expires_on) WHERE expires_on IS NOT NULL;

-- The append-only status log becomes a non-overlapping period table.
CREATE TABLE boat_status_period (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  boat_id text NOT NULL REFERENCES boat(id) ON DELETE CASCADE,
  status_code text NOT NULL REFERENCES boat_status(code),
  valid_from date NOT NULL,
  valid_to date,                                    -- NULL = ongoing
  location_text text,                               -- human detail: 'Grand Andaman Pier'
  location_pier_code text REFERENCES pier(code),    -- replaces keyword-matching the free text
  note text, reason_code text,
  project_id text, maintenance_job_id text,
  recorded_at timestamptz NOT NULL DEFAULT now(), recorded_by text,
  CHECK (valid_to IS NULL OR valid_to >= valid_from),
  EXCLUDE USING gist (
    boat_id WITH =,
    daterange(valid_from, COALESCE(valid_to, 'infinity'::date), '[]') WITH &&)
);
CREATE INDEX bsp_boat_from_idx ON boat_status_period (boat_id, valid_from DESC);
-- The exclusion constraint replaces 'last entry wins, ties broken by insertion order'.
-- With no overlaps there is no tie, and no race between two concurrent writers.

CREATE TABLE boat_pier_assignment (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  boat_id text NOT NULL REFERENCES boat(id) ON DELETE CASCADE,
  assignment_type text NOT NULL CHECK (assignment_type IN ('temporary','permanent')),
  from_pier_code text NOT NULL REFERENCES pier(code),
  to_pier_code   text NOT NULL REFERENCES pier(code),
  start_date date NOT NULL, end_date date NOT NULL,
  reason text, cost numeric(12,2), status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date), CHECK (from_pier_code <> to_pier_code)
);
```

**Derived views**

```sql
-- Boat status on any date. One implementation; every consumer reads it.
CREATE VIEW v_boat_status_on AS
SELECT b.id AS boat_id, d.on_date, COALESCE(p.status_code,'available') AS status_code,
       p.location_text, p.location_pier_code, p.note, p.reason_code
FROM boat b
CROSS JOIN LATERAL (SELECT CURRENT_DATE AS on_date) d          -- parameterise in the query layer
LEFT JOIN LATERAL (
  SELECT * FROM boat_status_period sp
  WHERE sp.boat_id = b.id AND sp.valid_from <= d.on_date
    AND (sp.valid_to IS NULL OR sp.valid_to >= d.on_date)
  LIMIT 1) p ON true;

-- Effective pier on a date: shop -> pier assignment -> stored location pier -> home pier.
-- Step 3 no longer keyword-matches free text; the pier is stored.
CREATE VIEW v_boat_effective_pier AS ...   -- returns (boat_id, on_date, pier_code, source, source_ref)
```

### 9.3 Drivetrain

```sql
CREATE TABLE engine (
  id text PRIMARY KEY,
  brand text, model text, serial text NOT NULL, hp numeric(8,2),
  boat_id text REFERENCES boat(id),
  position_code text REFERENCES drive_position(code),
  status_code text NOT NULL REFERENCES asset_status(code),
  base_hours numeric(10,1) NOT NULL DEFAULT 0 CHECK (base_hours >= 0),
  service_interval numeric(10,1) NOT NULL DEFAULT 0 CHECK (service_interval >= 0),
  last_service_hours numeric(10,1), last_service_date date,
  spare_location_code text REFERENCES storage_location(code),
  retired boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT engine_mount_coherent  CHECK ((boat_id IS NULL) = (position_code IS NULL)),
  CONSTRAINT engine_spare_detached  CHECK (boat_id IS NULL OR spare_location_code IS NULL),
  CONSTRAINT engine_one_per_position
    EXCLUDE (boat_id WITH =, position_code WITH =) WHERE (boat_id IS NOT NULL AND retired = false)
);
CREATE UNIQUE INDEX engine_serial_uq ON engine (lower(serial)) WHERE retired = false;

CREATE TABLE gearbox (
  id text PRIMARY KEY,
  brand text, model text, serial text NOT NULL,
  engine_id text UNIQUE REFERENCES engine(id),        -- 1 gearbox per engine; many NULLs allowed
  on_boat_id text REFERENCES boat(id),                -- 'คาเรือ รอเครื่อง' = waiting for an engine
  on_boat_position_code text REFERENCES drive_position(code),
  status_code text NOT NULL REFERENCES asset_status(code),
  base_hours numeric(10,1) NOT NULL DEFAULT 0,
  install_hours numeric(10,1),
  service_interval numeric(10,1) NOT NULL DEFAULT 200,
  last_service_hours numeric(10,1), last_service_date date,
  shaft_length text, model_suffix text,
  spare_location_code text REFERENCES storage_location(code),
  retired boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1,
  CONSTRAINT gearbox_spare_detached   CHECK (engine_id IS NULL OR spare_location_code IS NULL),
  CONSTRAINT gearbox_waiting_coherent CHECK ((on_boat_id IS NULL) = (on_boat_position_code IS NULL)),
  CONSTRAINT gearbox_waiting_xor_mounted CHECK (NOT (engine_id IS NOT NULL AND on_boat_id IS NOT NULL)),
  CONSTRAINT gearbox_waiting_not_spare   CHECK (NOT (on_boat_id IS NOT NULL AND spare_location_code IS NOT NULL)),
  CONSTRAINT gearbox_one_waiting_per_position
    EXCLUDE (on_boat_id WITH =, on_boat_position_code WITH =) WHERE (on_boat_id IS NOT NULL)
);

CREATE TABLE propeller (
  id text PRIMARY KEY,
  brand text, serial text NOT NULL,
  gearbox_id text UNIQUE REFERENCES gearbox(id),
  status_code text NOT NULL REFERENCES asset_status(code),
  diameter numeric(6,2), pitch numeric(6,2), size text, blades smallint,
  material text, rotation text, hub_size text, cupping text, cost numeric(12,2),
  install_hours numeric(10,1),
  spare_location_code text REFERENCES storage_location(code),
  retired boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1,
  CONSTRAINT propeller_spare_detached CHECK (gearbox_id IS NULL OR spare_location_code IS NULL)
);

-- One event log for all three asset types. Replaces three parallel log arrays.
CREATE TABLE asset_event (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  asset_type text NOT NULL CHECK (asset_type IN ('engine','gearbox','propeller')),
  asset_id text NOT NULL,
  event_date date NOT NULL, event_type text NOT NULL,
  description text, hours numeric(10,1), used_hours numeric(10,1),
  maintenance_job_id text, incident_id text,
  at timestamptz NOT NULL DEFAULT now(), by_user text
);
CREATE INDEX asset_event_asset_idx ON asset_event (asset_type, asset_id, event_date DESC);
```

### 9.4 Daily logs and fuel

```sql
CREATE TABLE daily_log (
  service_date date NOT NULL,
  boat_id text NOT NULL REFERENCES boat(id),
  fuel_litres numeric(10,2) CHECK (fuel_litres IS NULL OR fuel_litres >= 0),
  fuel_price_per_litre numeric(10,2) CHECK (fuel_price_per_litre IS NULL OR fuel_price_per_litre > 0),
  pax_actual_override integer,     -- legacy; PAX is normally derived from bookings
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by text,
  PRIMARY KEY (service_date, boat_id)
);
-- NULL means 'not recorded'. There is no valid zero for a price; an empty input DELETES the value.

CREATE TABLE daily_log_reading (
  service_date date NOT NULL,
  boat_id text NOT NULL,
  engine_id text NOT NULL REFERENCES engine(id),
  trip_bucket text NOT NULL DEFAULT 'normal',
  reading numeric(10,1) NOT NULL CHECK (reading > 0),   -- <= 0 is a placeholder, never data
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by text,
  PRIMARY KEY (service_date, boat_id, engine_id, trip_bucket),
  FOREIGN KEY (service_date, boat_id) REFERENCES daily_log (service_date, boat_id) ON DELETE CASCADE
);
CREATE INDEX dlr_engine_date_idx ON daily_log_reading (engine_id, service_date);

CREATE TABLE daily_log_lock (
  service_date date NOT NULL, pier_code text NOT NULL REFERENCES pier(code),
  locked boolean NOT NULL DEFAULT true, locked_at timestamptz NOT NULL DEFAULT now(), locked_by text,
  PRIMARY KEY (service_date, pier_code)
);

CREATE TABLE fuel_price_pier (          -- pier-level fallback price
  service_date date NOT NULL, pier_code text NOT NULL REFERENCES pier(code),
  price_per_litre numeric(10,2) NOT NULL CHECK (price_per_litre > 0),
  PRIMARY KEY (service_date, pier_code)
);

CREATE TABLE fuel_budget (              -- was written straight to browser storage
  month text PRIMARY KEY CHECK (month ~ '^\d{4}-\d{2}$'), amount numeric(14,2) NOT NULL
);
```

**Views**

```sql
-- Engine hours. base + (reading on latest logged date - reading on earliest logged date),
-- readings <= 0 already excluded by the CHECK constraint.
CREATE VIEW v_engine_hours AS
SELECT e.id AS engine_id,
       e.base_hours + COALESCE(x.last_reading - x.first_reading, 0) AS hours,
       x.first_date, x.last_date, x.reading_count
FROM engine e
LEFT JOIN LATERAL (
  SELECT (array_agg(r.reading ORDER BY r.service_date DESC))[1] AS last_reading,
         (array_agg(r.reading ORDER BY r.service_date ASC ))[1] AS first_reading,
         max(r.service_date) AS last_date, min(r.service_date) AS first_date, count(*) AS reading_count
  FROM daily_log_reading r WHERE r.engine_id = e.id) x ON true;

CREATE VIEW v_engine_service_state AS ...   -- countdown vs last_service_hours, NOT a modulo
CREATE VIEW v_gearbox_lifetime AS ...       -- previously_used + (engine hours - base_hours)
```

### 9.5 Maintenance, incidents, projects, inventory

```sql
CREATE TABLE incident (
  id text PRIMARY KEY, no text NOT NULL UNIQUE,       -- 'INC-003'; numbering is max(suffix)+1
  boat_id text NOT NULL REFERENCES boat(id),
  occurred_on date NOT NULL, occurred_at_time time,
  title text NOT NULL, detail text, remark text,
  priority smallint NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','closed')),
  quick_fix boolean NOT NULL DEFAULT false, resolved_on date, closed_on date,
  created_at timestamptz NOT NULL DEFAULT now(), created_by text, version integer NOT NULL DEFAULT 1
);
-- severity is DERIVED, not stored, so it cannot drift from priority:
CREATE VIEW v_incident_severity AS
SELECT id, CASE WHEN priority >= 4 THEN 'critical' WHEN priority >= 3 THEN 'major' ELSE 'minor' END AS severity
FROM incident;

CREATE TABLE incident_damaged_asset (
  incident_id text NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('engine','gearbox','propeller','hull')),
  asset_id text, label text,
  swapped boolean NOT NULL DEFAULT false, swapped_to_asset_id text, swapped_on date,
  PRIMARY KEY (incident_id, asset_type, COALESCE(asset_id, label))
);

CREATE TABLE project (
  id text PRIMARY KEY, no text NOT NULL UNIQUE,       -- 'PRJ-007'
  name text NOT NULL, boat_id text NOT NULL REFERENCES boat(id),
  project_type text NOT NULL, vendor text,
  plan_from date, plan_to date, original_plan_to date, actual_from date, actual_to date,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','inprogress','on_hold','completed','cancelled')),
  phase text, planned_budget numeric(14,2), notes text,
  hold_reason text, hold_since date, cancel_reason text, cancelled_on date,
  created_at timestamptz NOT NULL DEFAULT now(), created_by text, version integer NOT NULL DEFAULT 1,
  CONSTRAINT hold_needs_reason   CHECK (status <> 'on_hold'   OR nullif(hold_reason,'')   IS NOT NULL),
  CONSTRAINT cancel_needs_reason CHECK (status <> 'cancelled' OR nullif(cancel_reason,'') IS NOT NULL)
);

CREATE TABLE maintenance_job (
  id text PRIMARY KEY, no text NOT NULL UNIQUE,       -- 'MJ-027'
  boat_id text NOT NULL REFERENCES boat(id),
  job_type text NOT NULL CHECK (job_type IN ('corrective','preventive','scheduled')),
  title text NOT NULL, detail text, location text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','inprogress','on_hold','done')),
  start_date date, end_date date,
  incident_id text REFERENCES incident(id),
  parent_project_id text REFERENCES project(id),
  boat_status_target text NOT NULL DEFAULT 'fixing' REFERENCES boat_status(code),
  boat_status_reason text,
  outcome text REFERENCES maintenance_outcome(code),
  close_note text, awaiting_invoice boolean NOT NULL DEFAULT false,
  cost_override numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT now(), created_by text, version integer NOT NULL DEFAULT 1,
  CONSTRAINT unavailable_needs_reason
    CHECK (boat_status_target <> 'unavailable' OR nullif(boat_status_reason,'') IS NOT NULL),
  CONSTRAINT end_after_start CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  CONSTRAINT done_needs_outcome CHECK (status <> 'done' OR outcome IS NOT NULL)
);
CREATE INDEX mj_boat_status_idx ON maintenance_job (boat_id, status);
-- done_needs_outcome is what stops a project completion from closing children with no outcome (§13).

CREATE TABLE maintenance_job_asset (
  maintenance_job_id text NOT NULL REFERENCES maintenance_job(id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('engine','gearbox','propeller','hull')),
  asset_id text,
  PRIMARY KEY (maintenance_job_id, asset_type, COALESCE(asset_id,'hull'))
);

CREATE TABLE consumable_item (           -- inventory master
  id text PRIMARY KEY, name text NOT NULL, part_no text, category text,
  supplier text, unit text, unit_cost numeric(12,2) NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true
);
CREATE TABLE consumable_stock (
  item_id text NOT NULL REFERENCES consumable_item(id) ON DELETE CASCADE,
  location_code text NOT NULL REFERENCES storage_location(code),
  qty numeric(12,2) NOT NULL DEFAULT 0,     -- may go negative, by design (§4.6)
  min_qty numeric(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, location_code)
);
CREATE TABLE consumable_movement (        -- append-only; stock is a materialised sum
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id text NOT NULL REFERENCES consumable_item(id),
  location_code text NOT NULL REFERENCES storage_location(code),
  movement_type text NOT NULL,            -- receive | withdraw | transfer_in | transfer_out | adjust | return
  qty numeric(12,2) NOT NULL,
  maintenance_job_id text REFERENCES maintenance_job(id),
  requisition_id bigint, note text, is_late boolean NOT NULL DEFAULT false, late_by_days integer,
  moved_on date NOT NULL, at timestamptz NOT NULL DEFAULT now(), by_user text
);

CREATE TABLE consumable_requisition (     -- เบิกของใช้ · its OWN cost bucket, never job cost
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requested_on date NOT NULL, item_id text NOT NULL REFERENCES consumable_item(id),
  qty numeric(12,2) NOT NULL CHECK (qty > 0),
  unit_cost numeric(12,2) NOT NULL, cost numeric(14,2) NOT NULL,
  location_code text NOT NULL REFERENCES storage_location(code),
  boat_id text NOT NULL REFERENCES boat(id),        -- required
  engine_id text REFERENCES engine(id), note text,
  at timestamptz NOT NULL DEFAULT now(), by_user text
);

CREATE TABLE purchase_memo (
  id text PRIMARY KEY, no text NOT NULL UNIQUE,     -- 'MO-004'
  maintenance_job_id text REFERENCES maintenance_job(id),
  project_id text REFERENCES project(id),
  boat_id text REFERENCES boat(id),
  memo_kind text NOT NULL CHECK (memo_kind IN ('parts','labour','mixed')),
  status text NOT NULL DEFAULT 'created',
  amount numeric(14,2) NOT NULL DEFAULT 0,
  approved_by text, approved_on date, approve_note text,
  created_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE TABLE purchase_memo_item (
  memo_id text NOT NULL REFERENCES purchase_memo(id) ON DELETE CASCADE,
  line_no smallint NOT NULL, item_id text REFERENCES consumable_item(id),
  name text NOT NULL, category text, qty numeric(12,2) NOT NULL, unit_cost numeric(12,2) NOT NULL,
  discount_pct numeric(5,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (memo_id, line_no)
);
-- item_id here is what lets job cost dedupe memo-paid parts BY ID instead of by normalised name.
```

**Cost views**

```sql
CREATE VIEW v_maintenance_job_cost AS
SELECT j.id AS maintenance_job_id,
       COALESCE(p.parts_cost,0) + COALESCE(m.memo_cost,0) AS job_cost,
       COALESCE(p.parts_cost,0) AS parts_cost, COALESCE(m.memo_cost,0) AS memo_cost
FROM maintenance_job j
LEFT JOIN LATERAL (
  SELECT SUM(mv.qty * ci.unit_cost) AS parts_cost
  FROM consumable_movement mv JOIN consumable_item ci ON ci.id = mv.item_id
  WHERE mv.maintenance_job_id = j.id AND mv.movement_type = 'withdraw'
    AND NOT EXISTS (SELECT 1 FROM purchase_memo pm JOIN purchase_memo_item pi ON pi.memo_id = pm.id
                    WHERE pm.maintenance_job_id = j.id AND pm.memo_kind IN ('parts','mixed')
                      AND pi.item_id = mv.item_id)) p ON true
LEFT JOIN LATERAL (
  SELECT SUM(pm.amount) AS memo_cost FROM purchase_memo pm
  WHERE pm.maintenance_job_id = j.id AND pm.status IN ('approved','received','paid')) m ON true;

-- Per-asset share. DETAIL PAGES ONLY. Never added to a total.
CREATE VIEW v_maintenance_job_asset_cost AS
SELECT ja.maintenance_job_id, ja.asset_type, ja.asset_id,
       jc.job_cost / GREATEST(1, COUNT(*) OVER (PARTITION BY ja.maintenance_job_id, ja.asset_type))
         AS asset_share
FROM maintenance_job_asset ja JOIN v_maintenance_job_cost jc USING (maintenance_job_id);
```

### 9.6 Routes, deployment and assignment — killing the per-boat columns

**The anti-pattern.** Today `TRIPS[date][boatId]` is stored in a table with **fixed per-boat columns**: `b1_route`, `b1_type`, `b1_booked`, `b1_charterbookingid`, `b2_route`, … Consequences, all of them real:

- **`b8`, `b14` and `b15` were missing from those columns from the start.** Deploying *Tadeo*, *Juliet* or *Rolanda* to a route silently lost the assignment on the next sync. The columns were eventually added by hand, and the source comment says plainly: "⚠ โครงนี้ยังเปราะ — เรือลำใหม่หลังจากนี้ก็ต้องมาเติมมืออีก" (*this structure is still fragile — every new boat from here on has to be filled in by hand again*).
- **Adding a boat requires editing server code and shipping a migration.** A boat is data. Data must not require a deploy.
- **The views over that table are hardcoded too.** Fixing the table without fixing the views leaves later-added boats missing from every report that reads the view. The production database has exactly two views (`v_seat_availability`, `v_seat_availability_unmapped`) and both are in this blast radius. Rebuild them from `pg_get_viewdef` on the live server, never from a repo file — prod and the repo migration are known to disagree in both directions.

**The replacement: one row per boat per trip.**

```sql
CREATE TABLE route (
  id text PRIMARY KEY, name text NOT NULL, code text, islands text,
  pier_code text NOT NULL REFERENCES pier(code),
  colour text, sort_order integer, active boolean NOT NULL DEFAULT true
);
CREATE TABLE route_departure_time (route_id text NOT NULL REFERENCES route(id), depart_at time NOT NULL,
  PRIMARY KEY (route_id, depart_at));
CREATE TABLE route_season (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  route_id text NOT NULL REFERENCES route(id) ON DELETE CASCADE,
  season_type text NOT NULL CHECK (season_type IN ('open','closed')),
  valid_from date NOT NULL, valid_to date NOT NULL, CHECK (valid_to >= valid_from));

CREATE TABLE trip_boat_deployment (
  service_date date NOT NULL,
  boat_id text NOT NULL REFERENCES boat(id),
  route_id text NOT NULL REFERENCES route(id),
  deployment_type text NOT NULL REFERENCES deployment_type(code),   -- seat | charter
  charter_booking_id text,
  booked_cache integer,                       -- optional denormalised counter; NOT authoritative
  created_at timestamptz NOT NULL DEFAULT now(), created_by text,
  PRIMARY KEY (service_date, boat_id),        -- a boat runs ONE route per date
  CONSTRAINT charter_needs_booking
    CHECK ((deployment_type = 'charter') = (charter_booking_id IS NOT NULL))
);
CREATE INDEX tbd_route_date_idx ON trip_boat_deployment (route_id, service_date);
-- A new boat needs ZERO schema changes. This is the whole point.

CREATE TABLE trip_boat_assignment (
  service_date date NOT NULL,
  booking_id text NOT NULL,
  boat_id text NOT NULL,
  split_no smallint NOT NULL DEFAULT 0,       -- 0 = whole booking; >0 = one part of a boat split
  pax_ad smallint NOT NULL DEFAULT 0, pax_chd smallint NOT NULL DEFAULT 0,
  pax_inf smallint NOT NULL DEFAULT 0, pax_foc smallint NOT NULL DEFAULT 0,
  assigned_at timestamptz NOT NULL DEFAULT now(), assigned_by text,
  PRIMARY KEY (service_date, booking_id, split_no),
  FOREIGN KEY (service_date, boat_id) REFERENCES trip_boat_deployment (service_date, boat_id)
);
CREATE INDEX tba_boat_date_idx ON trip_boat_assignment (service_date, boat_id);
-- The FK makes 'assigned to a hull that is not deployed' impossible.

CREATE TABLE boat_cap_override (
  service_date date NOT NULL, boat_id text NOT NULL REFERENCES boat(id),
  cap integer NOT NULL CHECK (cap >= 0), reason text,
  at timestamptz NOT NULL DEFAULT now(), by_user text,
  PRIMARY KEY (service_date, boat_id)
);
-- Was already keyed correctly ('date::boatId' -> one table). Keep it that way.

CREATE TABLE weather_closure (
  service_date date NOT NULL, route_id text NOT NULL REFERENCES route(id),
  reason text NOT NULL DEFAULT 'weather', note text,
  at timestamptz NOT NULL DEFAULT now(), by_user text,
  PRIMARY KEY (service_date, route_id)
);
```

**Seat-pool view**

```sql
CREATE VIEW v_boat_effective_cap AS
SELECT b.id AS boat_id, d.service_date,
       LEAST(COALESCE(o.cap, b.cap), COALESCE(b.licence_pax, b.cap)) AS effective_cap,
       COALESCE(b.licence_pax, b.cap) AS licence_cap
FROM boat b JOIN trip_boat_deployment d ON d.boat_id = b.id
LEFT JOIN boat_cap_override o ON o.boat_id = b.id AND o.service_date = d.service_date;

CREATE VIEW v_seats_consumed AS ...     -- see §5.2; excludes charter, cancelled,
                                        -- non-holding pending, and on-site losses
CREATE VIEW v_route_allotment AS ...    -- total / charter / available / consumed / locked / licence
```

### 9.7 Vans, groups, job orders and pickup

```sql
CREATE TABLE van (
  id text PRIMARY KEY, name text NOT NULL, plate text,
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('sedan','van','minibus','bus')),
  capacity smallint NOT NULL CHECK (capacity > 0),
  ownership text NOT NULL CHECK (ownership IN ('own','partner','rented')),
  partner_name text, zone_base_code text NOT NULL REFERENCES pickup_zone(code),
  driver_name text, driver_phone text, colour text, note text,
  active boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1,
  CONSTRAINT partner_name_only_for_partner
    CHECK (ownership = 'partner' OR nullif(partner_name,'') IS NULL)
);

CREATE TABLE van_day_route (            -- a van may run TWO programmes in one day
  service_date date NOT NULL, van_id text NOT NULL REFERENCES van(id),
  route_id text NOT NULL REFERENCES route(id),
  PRIMARY KEY (service_date, van_id, route_id));
CREATE TABLE van_day_zone (service_date date NOT NULL, van_id text NOT NULL REFERENCES van(id),
  zone_code text NOT NULL REFERENCES pickup_zone(code), PRIMARY KEY (service_date, van_id));
CREATE TABLE van_day_status (service_date date NOT NULL, van_id text NOT NULL REFERENCES van(id),
  status_code text NOT NULL CHECK (status_code IN ('available','maintenance','off')),
  PRIMARY KEY (service_date, van_id));
CREATE TABLE van_status_period (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  van_id text NOT NULL REFERENCES van(id), status_code text NOT NULL,
  valid_from date NOT NULL, valid_to date NOT NULL, note text,
  EXCLUDE USING gist (van_id WITH =, daterange(valid_from, valid_to, '[]') WITH &&));
CREATE TABLE van_zone_period (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  van_id text NOT NULL REFERENCES van(id), zone_code text NOT NULL REFERENCES pickup_zone(code),
  valid_from date NOT NULL, valid_to date NOT NULL,
  EXCLUDE USING gist (van_id WITH =, daterange(valid_from, valid_to, '[]') WITH &&));
CREATE TABLE van_event (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  van_id text NOT NULL REFERENCES van(id), kind text NOT NULL, text_body text,
  at timestamptz NOT NULL DEFAULT now(), by_user text);   -- uncapped; was capped at 100

-- THE outbound van lives here, once. 'รถปนกัน' becomes structurally impossible.
CREATE TABLE van_group (
  service_date date NOT NULL, route_id text NOT NULL REFERENCES route(id),
  zone_code text NOT NULL, group_no integer NOT NULL CHECK (group_no > 0),
  van_id text REFERENCES van(id),               -- NULL = not chosen yet (renders with a red frame)
  pickup_time_final text,
  created_at timestamptz NOT NULL DEFAULT now(), created_by text,
  PRIMARY KEY (service_date, route_id, zone_code, group_no)
);
CREATE UNIQUE INDEX van_group_one_van_per_day
  ON van_group (service_date, van_id) WHERE van_id IS NOT NULL;   -- 1 รถ = 1 กรุ๊ป

CREATE TABLE van_assignment (
  service_date date NOT NULL, booking_id text NOT NULL, split_no smallint NOT NULL DEFAULT 0,
  route_id text NOT NULL, zone_code text NOT NULL,
  group_no integer, van_seq integer,
  van_return_id text REFERENCES van(id),        -- NULL = returns on the group's outbound van
  return_same_van boolean NOT NULL DEFAULT false,
  split_source text NOT NULL DEFAULT 'manual' CHECK (split_source IN ('manual','alt_pickup')),
  pickup_area_id text, pickup_hotel text,
  pax smallint NOT NULL CHECK (pax >= 0),
  pax_ad smallint NOT NULL DEFAULT 0, pax_chd smallint NOT NULL DEFAULT 0,
  pax_inf smallint NOT NULL DEFAULT 0, pax_foc smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (service_date, booking_id, split_no),
  FOREIGN KEY (service_date, route_id, zone_code, group_no)
    REFERENCES van_group (service_date, route_id, zone_code, group_no) ON DELETE SET NULL,
  CONSTRAINT return_exclusive CHECK (NOT (van_return_id IS NOT NULL AND return_same_van)),
  CONSTRAINT pax_breakdown_sums CHECK (pax = pax_ad + pax_chd + pax_inf + pax_foc)
);
-- pax_breakdown_sums kills the drift that once printed a child as an adult on a job sheet.

CREATE TABLE van_day_override (         -- was VANJOB_DRIVER['date::vanId']
  service_date date NOT NULL, van_id text NOT NULL REFERENCES van(id),
  driver_name text, driver_phone text, plate text,
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by text,
  PRIMARY KEY (service_date, van_id));    -- deliberately NO route component

CREATE TABLE van_job_sent (
  service_date date NOT NULL, van_id text NOT NULL REFERENCES van(id),
  route_id text NOT NULL REFERENCES route(id),
  sent_at timestamptz NOT NULL, sent_by text,
  PRIMARY KEY (service_date, van_id, route_id));

CREATE TABLE van_job_special_request (  -- '' means DELETED from the sheet, not 'no override'
  booking_id text PRIMARY KEY, text_body text NOT NULL DEFAULT '');
CREATE TABLE pickup_location_label_th (
  location_name text PRIMARY KEY, label_th text NOT NULL);   -- global, reused everywhere
```

Pickup areas, zones, time groups, profiles and times are in §7.11.

### 9.8 Pier operations

```sql
CREATE TABLE pier_staff (
  id text PRIMARY KEY, pier_code text NOT NULL REFERENCES pier(code),
  nickname text, full_name text NOT NULL, role text, phone text,
  default_roster_code text REFERENCES roster_code(code),
  section_id text, sort_order integer, note text, active boolean NOT NULL DEFAULT true);

CREATE TABLE pier_job (                 -- ใบงานเรือ, one row per boat per day
  service_date date NOT NULL, boat_id text NOT NULL REFERENCES boat(id),
  captain_staff_id text REFERENCES pier_staff(id),
  assistant_staff_id text REFERENCES pier_staff(id),
  note text, wristband text, wristband_colour text,
  locked boolean NOT NULL DEFAULT false,
  meal_venue_id text, maintenance_job_id text REFERENCES maintenance_job(id),
  PRIMARY KEY (service_date, boat_id));
CREATE TABLE pier_job_crew (
  service_date date NOT NULL, boat_id text NOT NULL, slot_kind text NOT NULL CHECK (slot_kind IN ('crew','island')),
  slot_no smallint NOT NULL, staff_id text NOT NULL REFERENCES pier_staff(id),
  PRIMARY KEY (service_date, boat_id, slot_kind, slot_no),
  FOREIGN KEY (service_date, boat_id) REFERENCES pier_job (service_date, boat_id) ON DELETE CASCADE);
-- A whitelist of allowed per-day fields no longer exists; these are columns.

CREATE TABLE pier_team (                -- the standing crew, shown as a fallback, never auto-written
  boat_id text PRIMARY KEY REFERENCES boat(id),
  captain_staff_id text, assistant_staff_id text);
CREATE TABLE pier_team_crew (boat_id text NOT NULL, slot_no smallint NOT NULL, staff_id text NOT NULL,
  PRIMARY KEY (boat_id, slot_no));

CREATE TABLE pier_item  (id text PRIMARY KEY, kind_id text, name text NOT NULL, total numeric(12,2) NOT NULL DEFAULT 0);
CREATE TABLE pier_kind  (id text PRIMARY KEY, name text NOT NULL, single_sku boolean NOT NULL DEFAULT false);
CREATE TABLE pier_move (                -- APPEND-ONLY. Balances are replayed, never stored.
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_date date NOT NULL, pier_code text NOT NULL REFERENCES pier(code),
  item_id text NOT NULL REFERENCES pier_item(id), boat_id text REFERENCES boat(id),
  move_type text NOT NULL CHECK (move_type IN
    ('issue','return','repair','fixed','writeoff','lost','laundry_out','laundry_in','adjust')),
  qty numeric(12,2) NOT NULL, note text, fine numeric(12,2), fine_paid boolean,
  at timestamptz NOT NULL DEFAULT now(), by_user text);
CREATE INDEX pier_move_item_idx ON pier_move (item_id, service_date);

CREATE TABLE pier_duty (service_date date NOT NULL, boat_id text NOT NULL, staff_id text NOT NULL,
  PRIMARY KEY (service_date, boat_id, staff_id));

CREATE TABLE pier_shift (               -- ONLY hand-touched roster cells
  service_date date NOT NULL, staff_id text NOT NULL REFERENCES pier_staff(id),
  code text NOT NULL REFERENCES roster_code(code),
  is_plan boolean NOT NULL DEFAULT false,
  at timestamptz NOT NULL DEFAULT now(), by_user text,
  PRIMARY KEY (service_date, staff_id));
-- Do NOT backfill every cell here; the derived layers are the feature.

CREATE TABLE pier_licence_type  (id text PRIMARY KEY, side text NOT NULL CHECK (side IN ('deck','eng')),
  short_name text NOT NULL, formal_name text, per_boat boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true);
CREATE TABLE pier_licence_class (id text PRIMARY KEY, type_id text NOT NULL REFERENCES pier_licence_type(id),
  name text NOT NULL, max_gt numeric(8,2), max_bhp numeric(8,2), sort_order integer);
CREATE TABLE pier_licence (id text PRIMARY KEY, staff_id text NOT NULL REFERENCES pier_staff(id),
  class_id text NOT NULL REFERENCES pier_licence_class(id),
  licence_no text, expires_on date, issued_at date, issuer text, note text);
CREATE INDEX pier_licence_exp_idx ON pier_licence (expires_on);

CREATE TABLE pier_config (pier_code text PRIMARY KEY REFERENCES pier(code),
  licence_warn_days integer NOT NULL DEFAULT 60,
  roster_cycle_start smallint NOT NULL DEFAULT 26 CHECK (roster_cycle_start BETWEEN 1 AND 28),
  on_boat_code text, maintenance_code text, drydock_code text, default_code text);

CREATE TABLE guide (id text PRIMARY KEY, name text NOT NULL, nickname text, licence_no text,
  role text NOT NULL CHECK (role IN ('guide','trainee','intern','staff')), active boolean NOT NULL DEFAULT true);
CREATE TABLE guide_language (guide_id text NOT NULL REFERENCES guide(id), lang text NOT NULL,
  PRIMARY KEY (guide_id, lang));
CREATE TABLE guide_assignment (service_date date NOT NULL, boat_id text NOT NULL,
  guide_id text NOT NULL REFERENCES guide(id), PRIMARY KEY (service_date, boat_id, guide_id));
CREATE TABLE guide_order (              -- the document number, issued ONCE per (date, boat)
  service_date date NOT NULL, boat_id text NOT NULL, order_no text NOT NULL UNIQUE,
  other_count smallint NOT NULL DEFAULT 0, signature_count smallint NOT NULL DEFAULT 0,
  issued_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (service_date, boat_id));

CREATE TABLE trip_actual (              -- per boat-day actuals feeding trip P&L
  service_date date NOT NULL, boat_id text NOT NULL,
  meal_venue_id text, meal_ad smallint, meal_chd smallint,
  meal_price_ad numeric(12,2), meal_price_chd numeric(12,2), meal_amount numeric(14,2),
  at timestamptz, by_user text, PRIMARY KEY (service_date, boat_id));
```

### 9.9 Old blob key → new table

| Old blob key | Old shape | New table(s) |
|---|---|---|
| `boats` | array of boat objects with nested `log[]`, `assignments[]`, `docs[]`, `repairHistory[]` | `boat`, `boat_status_period`, `boat_pier_assignment`, `boat_document`, `boat_repair_history` |
| `trips` | `{date: {boatId: {route,type,booked,charterBookingId}}}` → **fixed per-boat columns** | `trip_boat_deployment` (one row per date × boat) |
| `routes` | array with nested `seasons[]`, `overrides` | `route`, `route_season`, `route_departure_time` |
| `boat_capovr` | `{'date::boatId': {...}}` | `boat_cap_override` |
| `sb_weather` | array | `weather_closure` |
| `fleet_engines` | array + `log[]` | `engine`, `asset_event` |
| `fleet_gearboxes` | array + `log[]` | `gearbox`, `asset_event` |
| `fleet_propellers` | array + `log[]` | `propeller`, `asset_event` |
| `fleet_maintenance` | array + `assets[]`, `parts[]`, `progressLog[]` | `maintenance_job`, `maintenance_job_asset`, `consumable_movement`, `maintenance_job_log` |
| `fleet_incidents` | array + `damagedAssets[]`, `progressLog[]`, `relatedMaintIds[]` | `incident`, `incident_damaged_asset`, `incident_log` |
| `fleet_projects` | array + `log[]`, `plan[]`, `docs[]`, `photos[]`, `vendorVisits[]` | `project`, `project_log`, `project_plan_item`, `project_document`, `project_vendor_visit` |
| `fleet_inventory` | array + `stocks[]`, `history[]` | `consumable_item`, `consumable_stock`, `consumable_movement` |
| `fleet_memos` | array + `items[]` | `purchase_memo`, `purchase_memo_item` |
| `fleet_safety` | array | `safety_item`, `safety_inspection` |
| `fleet_consumable_logs` | array | `consumable_requisition` |
| `fleet_daily` | `{date: {boatId: {fuel, paxActual, trips.normal.engines{}}}}` | `daily_log`, `daily_log_reading` |
| `fleet_fuelprice` | `{date: {pierKey|boatId: ฿/L}}` — **two key kinds in one map** | `daily_log.fuel_price_per_litre` (boat) + `fuel_price_pier` (pier) |
| `fleet_drlock` | `{date: {pierKey: true}}` | `daily_log_lock` |
| `fleet_fuelbudget` | `{YYYY-MM: amount}` — written straight to browser storage | `fuel_budget` |
| `fleet_version` | migration gate | dropped; the migration ledger replaces it |
| `sb_vehicles` | array + `dayRoute`, `dayZone`, `dayStatus`, `statusRanges[]`, `zoneOverrides[]`, `log[]` | `van`, `van_day_route`, `van_day_zone`, `van_day_status`, `van_status_period`, `van_zone_period`, `van_event` |
| `vanjob_driver` | `{'date::vanId': {...}}` | `van_day_override` |
| `vanjob_sent` | `{'date::vanId~routeId': ISO}` | `van_job_sent` |
| `vanjob_sreq` | `{bookingId: text}` | `van_job_special_request` |
| `vanjob_pickup_th` | `{name: thai}` | `pickup_location_label_th` |
| `sb_pickup_areas` | array | `pickup_area` |
| `sb_pickup_times` | `{route: {timeGroup: str}}` — legacy | folded into `pickup_time` at migration |
| `sb_pickup_time_profiles` | array + `times{route:{area:str}}` | `pickup_time_profile`, `pickup_time` |
| `pier_items` / `pier_kinds` | arrays | `pier_item`, `pier_kind` |
| `pier_moves` | array | `pier_move` |
| `pier_staff` | array | `pier_staff` |
| `pier_duty` | `{'date::boatId': [staffId]}` | `pier_duty` |
| `pier_team` | `{boatId: {...}}` | `pier_team`, `pier_team_crew` |
| `pier_job` | `{'date::boatId': {...}}` | `pier_job`, `pier_job_crew` |
| `pier_shift` | `{'date::staffId': {...}}` | `pier_shift` |
| `pier_sect` | array | `pier_section` |
| `pier_codes` | array — **loads with `Array.isArray && .length`** | `roster_code` |
| `pier_lic_types` / `pier_lic_classes` | arrays — **same `.length` guard** | `pier_licence_type`, `pier_licence_class` |
| `pier_licenses` | array | `pier_licence` |
| `pier_cfg` | object | `pier_config` |
| `guides` / `go_asn` / `go_no` / `go_cfg` | JSON-string blob keys | `guide`, `guide_language`, `guide_assignment`, `guide_order` |
| `trip_actuals` | `{'date::boatId': {...}}` | `trip_actual` |
| `travel_sum` / `ts_cot` | `{'date::bookingId': {...}}` | `travel_summary_decision`, `travel_summary_cot` |
| `meal_venues` | array | `meal_venue` |
| booking `ops.*` | per-day container inside the booking | `trip_boat_assignment`, `van_assignment`, `van_group`, `pier_checkin`, `van_checkin`, `booking_reconfirm` |

---

## 10. REST API surface

Resource-oriented. Every write is a transaction. Every mutating endpoint requires a permission area and returns the new `version`.

**Conventions used throughout**

| | |
|---|---|
| Auth | Bearer token; the token carries the user's permission areas. |
| Concurrency | Every mutable resource carries `version` (integer). Writes send `If-Match: "<version>"` or a body field `expected_version`. Mismatch ⇒ `409 VERSION_CONFLICT` with the current representation. |
| Idempotency | Every `POST` that creates or commits accepts an `Idempotency-Key` header. The key plus the request hash is stored for 24 h; a replay returns the original response. |
| Dates | `service_date` is `YYYY-MM-DD` in Asia/Bangkok. Timestamps are RFC 3339 with offset. |
| Errors | `{"error": {"code": "CAP_TOLERANCE_EXCEEDED", "message": "...", "details": {...}}}`. Codes are stable identifiers; messages are for humans and may be localised. |
| Warnings | Non-blocking findings are returned in `warnings[]` on success responses. A write that would produce a warning must either carry `acknowledge_warnings[]` or be rejected with `428 WARNING_NOT_ACKNOWLEDGED`. |
| Paging | `?limit=&cursor=`; responses carry `next_cursor`. |

### 10.1 Boats and status

| Method | Path | Purpose | Area | Notes |
|---|---|---|---|---|
| `GET` | `/fleet/boats` | List boats. `?as_of=&group_by=effective_pier&include_retired=` | fleet, operations | Returns the §2.5 grouping server-side |
| `GET` | `/fleet/boats/{id}` | One boat, with all three locations disambiguated (§2.3) | fleet, operations | |
| `POST` | `/fleet/boats` | Register a boat | fleet | `201`; no schema change needed for a new hull |
| `PATCH` | `/fleet/boats/{id}` | Update named fields | fleet | `If-Match` required |
| `POST` | `/fleet/boats/{id}/retire` | Retire | fleet | Writes a `retired` status period + sets the flag |
| `POST` | `/fleet/boats/{id}/unretire` | Restore | fleet | Writes an `available` period |
| `GET` | `/fleet/boats/{id}/status-periods` | Timeline | fleet, operations | |
| `POST` | `/fleet/boats/{id}/status-periods` | **Transactional status change** | fleet | See below |
| `PATCH` | `/fleet/boats/{id}/status-periods/{pid}` | Amend one period | fleet | Re-checks the exclusion constraint |
| `GET` | `/fleet/boats/{id}/documents` · `POST` · `PATCH` · `DELETE` | Vessel papers | fleet | |
| `POST` | `/fleet/boats/{id}/pier-assignments` | Move a boat to another pier | fleet | `permanent` + currently active also updates `pier_code` |
| `DELETE` | `/fleet/boats/{id}/pier-assignments/{aid}` | Cancel a move | fleet | |

**Status change** — one transaction, never an append:

```
POST /fleet/boats/b4/status-periods
Idempotency-Key: 6f1c...
{
  "status_code": "fixing",
  "valid_from": "2026-08-25",
  "valid_to": null,
  "location_text": "อู่ Honda Phuket",
  "location_pier_code": null,
  "reason_code": "engine_service",
  "note": "MJ-031",
  "expected_version": 12
}
→ 200 { "boat_id":"b4", "version":13,
        "periods_truncated":[{"id":881,"new_valid_to":"2026-08-24"}],
        "periods_deleted":[], "created": {...},
        "warnings":[{"code":"DEPLOYED_ON_DATES","dates":["2026-08-25","2026-08-26"],
                     "detail":"Boat is deployed to r5 on these dates"}] }
```

The transaction: lock the boat's periods `FOR UPDATE` → truncate/split overlaps → insert → bump `version`. The exclusion constraint is the backstop. The `DEPLOYED_ON_DATES` warning must be acknowledged, because taking a deployed hull out of service invalidates a schedule.

### 10.2 Drivetrain

| Method | Path | Purpose | Area |
|---|---|---|---|
| `GET` | `/fleet/engines` · `/gearboxes` · `/propellers` | List, filterable by boat, status, spare, location | fleet |
| `GET` | `/fleet/engines/{id}` | Detail incl. hours, service state, **per-asset cost share** | fleet |
| `POST` `PATCH` | same collections | Register / edit | fleet |
| `GET` | `/fleet/boats/{id}/drivetrain` | The full bay: one column per drive position, engine → gearbox → propeller, ordered by `sort_rank` | fleet |
| `POST` | `/fleet/boats/{id}/drivetrain/swap-engine` | **The engine swap. One transaction.** | fleet |
| `POST` | `/fleet/engines/{id}/detach` | Detach to a storage location | fleet |
| `POST` | `/fleet/gearboxes/{id}/stash` · `/propellers/{id}/stash` | Detach a part to the spare pool | fleet |
| `POST` | `/fleet/gearboxes/{id}/install` | Re-install a stashed gearbox onto an engine | fleet |
| `POST` | `/fleet/engines/{id}/service` | Log a service; rebase the baseline | fleet |
| `GET` | `/fleet/engines/{id}/hours` | Hours with provenance: base, first/last reading and their dates, count | fleet |

**The engine swap is an explicit operation, not a naive `PATCH`.** A `PATCH` on `engine.boat_id` cannot express steps 1–8 of §3.4 and would leave the gearbox pointing at a departed engine.

```
POST /fleet/boats/b4/drivetrain/swap-engine
Idempotency-Key: 9a3e...
{
  "position_code": "Std",
  "outgoing_engine_id": "e12",
  "outgoing_destination_location": "shop:honda-phuket",
  "incoming_engine_id": "e31",
  "maintenance_job_id": "MJ-031",
  "acknowledge_warnings": ["GEARBOX_SPEC_MISMATCH"]
}
→ 200 {
  "position_code": "Std",
  "outgoing": { "engine_id":"e12", "boat_id":null, "status":"fixing",
                "spare_location_code":"shop:honda-phuket" },
  "incoming": { "engine_id":"e31", "boat_id":"b4", "position_code":"Std", "status":"ready" },
  "gearbox":  { "id":"g07", "engine_id":"e31", "on_boat_id":null,
                "note":"stayed at the drive position; adopted by the incoming engine" },
  "propeller":{ "id":"p19", "gearbox_id":"g07", "note":"untouched" },
  "shed": [ { "asset_type":"gearbox","id":"g22","spare_location_code":"pier:central" },
            { "asset_type":"propeller","id":"p44","gearbox_id":"g22" } ],
  "events_written": 6,
  "warnings": [ {"code":"GEARBOX_SPEC_MISMATCH",
                 "detail":"gearbox g07 shaft_length 'XL' vs incoming engine expected 'X'"} ]
}
```

Errors: `409 POSITION_OCCUPIED`, `409 ENGINE_BROKEN`, `409 ENGINE_ALREADY_ON_BOAT`, `422 POSITION_NOT_ON_BOAT` (position not in the boat's `engine_count` set), `428 WARNING_NOT_ACKNOWLEDGED`.

### 10.3 Maintenance, incidents, projects

| Method | Path | Purpose | Area |
|---|---|---|---|
| `GET` `POST` | `/fleet/incidents` | Register; `quick_fix: true` resolves immediately with no job | fleet |
| `PATCH` | `/fleet/incidents/{id}` | Edit (appends a progress-log line) | fleet |
| `POST` | `/fleet/incidents/{id}/quick-swap` | Swap a damaged gearbox/propeller for a **pier-local** spare | fleet |
| `POST` | `/fleet/incidents/{id}/jobs` | Create job(s): `mode: "single" | "split_per_asset"` | fleet |
| `GET` `POST` | `/fleet/maintenance-jobs` | List / create | fleet |
| `PATCH` | `/fleet/maintenance-jobs/{id}` | Edit fields | fleet |
| `POST` | `/fleet/maintenance-jobs/{id}/start` | **Transactional start** (§4.2) | fleet |
| `POST` | `/fleet/maintenance-jobs/{id}/parts` | Withdraw a part from a warehouse | fleet |
| `DELETE` | `/fleet/maintenance-jobs/{id}/parts/{pid}` | Return it to the **same** warehouse | fleet |
| `POST` | `/fleet/maintenance-jobs/{id}/close` | **Transactional close** (§4.2) | fleet |
| `POST` | `/fleet/maintenance-jobs/{id}/cancel` | Cancel; never hard-delete | fleet |
| `GET` `POST` `PATCH` | `/fleet/projects` | Project CRUD | fleet |
| `POST` | `/fleet/projects/{id}/{start,hold,resume,cancel,reopen,complete}` | Gated transitions; hold and cancel **require** a reason | fleet |
| `GET` `POST` | `/fleet/memos` · `POST /fleet/memos/{id}/advance` | Purchase memo chain | fleet, accounting |
| `GET` `POST` | `/fleet/consumable-requisitions` | เบิกของใช้; own cost bucket | fleet |
| `GET` | `/fleet/inventory` · `POST /receive` · `/transfer` · `/adjust` | Multi-warehouse stock | fleet |

**Start**

```
POST /fleet/maintenance-jobs/MJ-031/start
{
  "start_date": "2026-08-25",
  "boat_status_target": "fixing",
  "boat_status_reason": null,
  "mounted_gear_action": "swap",           -- keep | stash | swap
  "swap": { "position_code":"Std", "incoming_engine_id":"e31",
            "outgoing_destination_location":"shop:honda-phuket" },
  "expected_version": 3
}
→ 200 { "job": {...}, "boat_status_period": {...},
        "downtime_starts": "2026-08-26",
        "downtime_deferred_reason": "boat already operated on 2026-08-25",
        "assets_updated": 4 }
```

`downtime_deferred_reason` is the "ran today ⇒ downtime starts tomorrow" rule, made explicit in the response so the operator sees why the date moved.

**Close**

```
POST /fleet/maintenance-jobs/MJ-031/close
{
  "outcome": "success",                    -- success|limited|rework|decommission|cancelled
  "closed_on": "2026-08-28",               -- defaults to today; must be >= start_date
  "close_note": "new impeller, sea trial ok",
  "awaiting_invoice": false,
  "reset_service_baselines": true,
  "service_readings": { "e31": 1247.5 },
  "expected_version": 4
}
→ 200 {
  "job": {...},
  "assets_updated": [ {"asset_type":"engine","id":"e31","status":"ready"} ],
  "boat_status": { "action":"restored", "new_status":"available", "from":"2026-08-28" },
  "boat_status_carried_over": null,        -- or {"status":"fixing","because":"MJ-033 still inprogress"}
  "incident_auto_closed": "INC-012",
  "repair_history_row_id": 442
}
```

`boat_status.action` is one of `restored | untouched | carried_over`. `untouched` when the job's target was `available` — a job that never took the boat out must not "return" it.

**Project completion** refuses while open children remain unless outcomes are supplied:

```
POST /fleet/projects/PRJ-007/complete
{ "actual_to":"2026-09-30",
  "child_job_outcomes": { "MJ-045":"success", "MJ-046":"limited" },
  "expected_version": 8 }
→ 409 { "error": { "code":"OPEN_CHILD_JOBS",
                   "details": { "jobs":["MJ-047"] },
                   "message":"Supply an outcome for every open child job, or close them first." } }
```

### 10.4 Daily logs

| Method | Path | Purpose | Area |
|---|---|---|---|
| `GET` | `/fleet/daily-log?service_date=&pier_code=` | The day's grid: boats grouped by **effective** pier, PAX derived from bookings, lock state | fleet |
| `PUT` | `/fleet/daily-log/{service_date}/{boat_id}` | Upsert fuel litres and ฿/L. Empty ⇒ `null`, never `0` | fleet |
| `PUT` | `/fleet/daily-log/{service_date}/{boat_id}/readings/{engine_id}` | Upsert one meter reading | fleet |
| `POST` | `/fleet/daily-log/{service_date}/readings:batch` | Ingest many readings in one transaction | fleet |
| `POST` | `/fleet/daily-log/{service_date}/pier/{pier_code}/lock` · `/unlock` | Lock or reopen a pier-day | fleet |

Batch ingestion is the primary path — the UI blurs the focused field and commits the whole pier section at once:

```
POST /fleet/daily-log/2026-08-22/readings:batch
Idempotency-Key: c81f...
{ "pier_code": "tublamu",
  "entries": [
    { "boat_id":"b3", "fuel_litres":880, "fuel_price_per_litre":31.5,
      "readings": { "e07": 3418.2, "e08": 3402.9 } },
    { "boat_id":"b6", "fuel_litres":null, "readings": {} }
  ],
  "lock_after": true }
→ 200 { "written": 3, "skipped": 1, "locked": true,
        "rejected": [ { "boat_id":"b3","engine_id":"e09","reading":0,
                        "code":"READING_NOT_POSITIVE",
                        "message":"0 is a placeholder, not a reading. Leave the cell empty instead." } ] }
```

Errors: `409 DAY_LOCKED` (with the pier and who locked it), `409 METER_REGRESSION` (unless `meter_replaced: true`), `422 READING_NOT_POSITIVE`, `422 BOAT_HAS_NO_ENGINES`.

### 10.5 Deployment and assignment

| Method | Path | Purpose | Area |
|---|---|---|---|
| `GET` | `/operations/deployments?from=&to=&route_id=` | The route × date matrix | operations |
| `GET` | `/operations/deployments/{service_date}/candidates?route_id=` | The three lists: assigned / available / **unavailable with a reason** | operations |
| `POST` | `/operations/deployments` | Deploy a hull to a route × date | operations |
| `DELETE` | `/operations/deployments/{service_date}/{boat_id}` | Undeploy | operations |
| `POST` | `/operations/weather-closures` · `DELETE` | Weather-cancel a route × date | operations |
| `GET` | `/operations/allotment?route_id=&service_date=` | The seat pool (§5.2) | operations, sales |
| `GET` | `/operations/assignments?service_date=&route_id=` | Current booking→hull assignments with load per hull | operations |
| `POST` | `/operations/assignments/plan` | **Read-only planner.** Returns candidates + violations. Never writes. | operations |
| `POST` | `/operations/assignments/commit` | Commit an explicit list, re-validating everything | operations |
| `DELETE` | `/operations/assignments/{service_date}/{booking_id}` | Unassign | operations |
| `PUT` | `/operations/assignments/{service_date}/{booking_id}/splits` | Replace a booking's boat split | operations |
| `POST` | `/operations/boat-cap-overrides` | Per-day cap override, clamped to `licence_pax` | operations |
| `POST` | `/operations/assignments/{service_date}/{booking_id}/upgrade` | Emergency upgrade `{reason, charge}` | operations |

**Deploy** returns the reasons rather than silently dropping candidates:

```
GET /operations/deployments/2026-08-24/candidates?route_id=r5
→ { "route": {"id":"r5","name":"Similan Islands by Speedboat","pier_code":"tublamu"},
    "assigned":    [ {"boat_id":"b3","name":"Okeanos","booked":41,"cap":56} ],
    "available":   [ {"boat_id":"b5","name":"Andaman Ryder","cap":56} ],
    "unavailable": [ {"boat_id":"b13","name":"Oceanus","reason_code":"WRONG_PIER",
                      "reason":"ท่าวิสิษฐ์พันวา","effective_pier":"panwa"},
                     {"boat_id":"b7","name":"Verona","reason_code":"AT_SHOP",
                      "reason":"อยู่ที่อู่ · Honda Phuket","source_ref":"MJ-031"},
                     {"boat_id":"b9","name":"Romeo","reason_code":"PROJECT",
                      "reason":"[PROJ] Drydock PRJ-007"} ] }
```

Errors on `POST /operations/deployments`: `409 PAST_DATE_LOCKED`, `409 BOAT_CHARTERED`, `409 BOAT_NOT_AVAILABLE`, `409 WRONG_PIER`, `409 BOAT_ALREADY_DEPLOYED` (a hull runs one route per date), `428 BOOKINGS_ATTACHED` (re-routing a hull that already carries bookings — acknowledge to proceed; the bookings are **not** moved and are flagged).

**Plan → commit**, shown together because the pair is the whole point:

```
POST /operations/assignments/plan
{ "service_date":"2026-08-24", "route_id":"r5", "reassign_all": false }
→ 200 {
  "candidates": [
    { "booking_id":"BK-26080012-A1B2","boat_id":"b3","pax":6,"resulting_load":47,"over_cap":false },
    { "booking_id":"BK-26080013-C3D4","boat_id":"b5","pax":12,"resulting_load":57,"over_cap":true }
  ],
  "violations": [
    { "code":"NO_ROOM","booking_id":"BK-26080014-E5F6","pax":9,
      "boats":[{"id":"b3","cap":56,"ceiling":58,"load":47},{"id":"b5","cap":56,"ceiling":58,"load":57}] },
    { "code":"BOAT_BROKEN","boat_id":"b7","detail":"status 'fixing' on 2026-08-24, still deployed" }
  ],
  "warnings": [ { "code":"OVER_CAP","booking_id":"BK-26080013-C3D4","boat_id":"b5",
                  "resulting_load":57,"cap":56 } ] }
```

```
POST /operations/assignments/commit
Idempotency-Key: 4d70...
{ "service_date":"2026-08-24", "route_id":"r5",
  "assignments":[ {"booking_id":"BK-26080012-A1B2","boat_id":"b3"},
                  {"booking_id":"BK-26080013-C3D4","boat_id":"b5"} ],
  "acknowledge_warnings":["OVER_CAP"], "expected_version": 41 }
→ 200 { "committed": 2, "version": 42, "loads": {"b3":47,"b5":57} }
```

Commit errors: `409 CAP_TOLERANCE_EXCEEDED`, `409 LICENCE_EXCEEDED`, `409 BOAT_NOT_DEPLOYED`, `409 BOAT_CHARTERED_ON_DATE` (checked against **every** travel date of the booking), `409 VERSION_CONFLICT`, `428 WARNING_NOT_ACKNOWLEDGED`.

**The planner never writes. The commit never plans.** Do not merge them into one "assign" endpoint.

### 10.6 Vans, groups and job orders

| Method | Path | Purpose | Area |
|---|---|---|---|
| `GET` `POST` `PATCH` | `/transport/vans` | Vehicle registry | operations |
| `PUT` | `/transport/vans/{id}/day-routes/{service_date}` | Set the day's programmes (array — a van may run two) | operations |
| `PUT` | `/transport/vans/{id}/day-status/{service_date}` | `available` \| `maintenance` \| `off` | operations |
| `POST` | `/transport/vans/{id}/status-periods` · `/zone-periods` | Longer ranges | operations |
| `GET` | `/transport/van-groups?service_date=&route_id=` | Groups with members, pax, capacity headroom, conflicts | operations |
| `POST` | `/transport/van-groups` | Create a group and add members | operations |
| `PUT` | `/transport/van-groups/{key}/van` | **Set THE outbound van** (capacity-checked) | operations |
| `POST` | `/transport/van-groups/{key}/members` | Add members (capacity-checked; inherits the group's van) | operations |
| `DELETE` | `/transport/van-groups/{key}/members/{booking_id}` | Remove one member | operations |
| `POST` | `/transport/van-groups/{key}/disband` | **Clears group, seq, outbound van and return van, atomically** | operations |
| `PUT` | `/transport/van-groups/{key}/sequence` | Renumber `van_seq` by an explicit ordered list | operations |
| `PUT` | `/transport/van-groups/{key}/pickup-time` | Set `pickup_time_final` on every member | operations |
| `PUT` | `/transport/van-assignments/{service_date}/{booking_id}/return-van` | Per-booking return van, or `same_van: true` | operations |
| `PUT` | `/transport/van-assignments/{service_date}/{booking_id}/splits` | Replace the van split | operations |
| `PUT` | `/transport/van-day-overrides/{service_date}/{van_id}` | Driver / phone / plate for the day | operations |
| `DELETE` | same | Reset to the registry defaults | operations |
| `GET` | `/transport/job-orders?service_date=` | The day's jobs, keyed `(van_id, route_id)` | operations |
| `GET` | `/transport/job-orders/{service_date}/{van_id}/{route_id}` | One sheet as JSON | operations |
| `GET` | `.../render?format=pdf\|png\|html` | **Server-rendered.** No CDN, no browser dependency | operations |
| `POST` | `.../sent` | Stamp "ส่งคนขับ" | operations |
| `GET` | `/transport/conflicts?service_date=` | Data-quality scan: mixed vans, unusable return vans, over-capacity groups, ungrouped transfer bookings | operations |

**Disband**, the endpoint that closes the §7.3 gap:

```
POST /transport/van-groups/2026-08-24:r5:PK:3/disband
→ 200 { "members_released": 4,
        "cleared": ["group_no","van_seq","van_return_id","return_same_van"],
        "group_deleted": true }
```

**Set the group's van** — the capacity check that must not be skipped:

```
PUT /transport/van-groups/2026-08-24:r5:PK:3/van
{ "van_id": "v11", "expected_version": 6 }
→ 409 { "error": { "code":"VAN_CAPACITY_EXCEEDED",
                   "details": { "group_pax":13, "van_capacity":9, "van_name":"Toyota 9-seat #11" },
                   "message":"ที่นั่งไม่พอ · Split the group (✂ แยกคน) or pick a larger van." } }
```

Other errors: `409 VAN_ALREADY_IN_ANOTHER_GROUP` (1 รถ = 1 กรุ๊ป), `409 VAN_NOT_ON_ROUTE_MATRIX` (the outbound pool is only vans assigned to this route in the month matrix), `409 VAN_NOT_USABLE` (day status `off`/`maintenance`).

### 10.7 Pier operations

| Method | Path | Purpose | Area |
|---|---|---|---|
| `GET` `PUT` | `/pier/{pier_code}/job-sheets/{service_date}` | ใบงานเรือ; per-boat crew, wristband, note, meal venue, lock | pier or operations |
| `POST` | `/pier/{pier_code}/job-sheets/{service_date}/copy-previous` | Copy yesterday, **skipping locked sheets**; reports how many | pier or operations |
| `POST` | `/pier/{pier_code}/job-sheets/{service_date}/{boat_id}/promote-team` | Promote today's crew to standing | pier or operations |
| `GET` | `/pier/{pier_code}/licence-check?service_date=&boat_id=` | Coverage vs GT/BHP; advisory `warnings[]` | pier or operations |
| `GET` `POST` | `/pier/{pier_code}/moves` | Equipment ledger (append-only) | pier or operations |
| `GET` | `/pier/{pier_code}/balances` | Replayed buckets `ready/onboat/dirty/laundry/repair/gone` | pier or operations |
| `POST` | `/pier/{pier_code}/moves/close-out` | Boat close-out; refuses unless the shortfall is fully explained | pier or operations |
| `GET` `PUT` | `/pier/{pier_code}/roster?cycle_anchor=` | 26→25 roster: derived cells + overrides | pier or operations |
| `PUT` | `/pier/{pier_code}/roster/cells:batch` | Bulk fill a date range with a weekday filter and an overwrite flag | pier or operations |
| `GET` `POST` `PATCH` | `/pier/staff` · `/pier/licences` · `/pier/licence-types` · `/pier/licence-classes` · `/roster-codes` | Registries | pier or operations |
| `GET` `PUT` | `/ops/checkin/{service_date}` | Pier check-in console rows, nested boat → trip → zone → van group | **pier or operations** |
| `POST` | `/ops/checkin/{service_date}/{booking_id}/stage` | Set a stage; clicking a passed stage steps **back one** | pier or operations |
| `POST` | `/ops/checkin/{service_date}/{booking_id}/events` | Record a no-show / on-site cancel with a reason | pier or operations |
| `DELETE` | `.../events/{event_id}` | Undo one event | pier or operations |
| `POST` | `/ops/checkin/{service_date}/{booking_id}/payments` | Split payment lines; **fee stored separately from amount** | pier or operations |
| `GET` `POST` | `/ops/guides` · `/ops/guide-assignments` · `POST /ops/guide-orders` | Guide registry, per-boat-day assignment, one-time document number | operations |
| `GET` | `/ops/travel-summary/{service_date}` · `PUT .../decisions/{booking_id}` | Day close | operations |
| `GET` | `/ops/daily-report/{service_date}` | 5-tab management summary | operations |
| `POST` `GET` | `/ops/doc-check/{booking_id}/precheck` | Server-side OCR (§6.7) | operations |
| `PUT` | `/ops/doc-check/{booking_id}` | Set checklist items and status. **Only a human sets `verified`/`issue`.** | operations |

### 10.8 Reporting reads

All read-only, all backed by the views in §9, all accepting a date range.

| Path | Answers |
|---|---|
| `GET /fleet/reports/cost?from=&to=&group_by=boat\|category\|status` | Spend by hull / asset category / job status |
| `GET /fleet/reports/fuel?month=` | Litres, ฿, L/hr, L/day, L/pax by boat, route family and week. **Nulls are preserved — null ≠ 0.** |
| `GET /fleet/reports/insights?period=` | Per-boat health scorecard, trends, recommendations |
| `GET /fleet/reports/utilisation?from=&to=` | Operated days, idle days, downtime days per hull |
| `GET /fleet/reports/service-due` | Engines and gearboxes by hours remaining, overdue first |
| `GET /fleet/reports/documents-expiring?within_days=` | Vessel papers and marine licences approaching expiry |
| `GET /fleet/dashboard?service_date=` | One-day snapshot: availability, asset counts, spares, fuel, open jobs/incidents, low stock, pending memos |

### 10.9 Transactional boundaries — the explicit list

Each of these is **one** database transaction. A partial application of any of them corrupts state.

1. **Boat status change** — lock, truncate overlaps, insert, bump version.
2. **Engine swap** — all eight steps of §3.4 plus every asset event.
3. **Maintenance job start** — status transition, boat status period, asset cascade, optional swap.
4. **Maintenance job close** — outcome cascade over every asset, boat status decision (restore / untouched / carry over), repair-history row, incident auto-close, optional service rebase.
5. **Project complete** — every child job closed through the same close path, then the project's own boat status period.
6. **Part withdrawal** — stock decrement, movement row, job part row.
7. **Assignment commit** — re-validate every constraint, then insert/update every assignment row.
8. **Van group disband** — delete the group, null the members' `group_no` / `van_seq` / `van_return_id` / `return_same_van`.
9. **Van group member add** — capacity check and membership write together, so two concurrent adds cannot both fit.
10. **Daily-log batch** — every reading plus the lock, so a locked pier-day never contains a half-written section.
11. **Charter creation** — deployment rows and assignment rows for every hull (§5.4).

For 7 and 9, take the lock on the row that bounds the capacity — the deployment row, or the group row — with `SELECT ... FOR UPDATE`. Two dispatchers filling the same boat or the same van at the same moment must serialise, or both will fit and neither will.
---

## 11. Invariants that must move from the browser to the server

Everything below is enforced today only by JavaScript running in one operator's browser. Three of the four writers against this database are not that browser. Each row states where the rule lands in the rebuild.

### 11.1 Capacity

| Invariant | Today | Rebuild |
|---|---|---|
| A booking may not be assigned to a hull whose resulting load exceeds `effective_cap + BA_CAP_TOL` | Browser `alert()`, assignment refused | API transactional check in the commit, `409 CAP_TOLERANCE_EXCEEDED` |
| A booking may **never** exceed `licence_pax` on a hull | **Not checked per boat at all** — see §13 | API check `409 LICENCE_EXCEEDED`, plus `CHECK (cap <= licence_pax)` on the boat row |
| A per-day cap override may not exceed `licence_pax` | Clamped in the browser setter | `boat_cap_override` insert clamps server-side; `v_boat_effective_cap` applies `LEAST(...)` |
| A boat may not be deployed to two routes on one date | Implicit in the map shape | `PRIMARY KEY (service_date, boat_id)` on `trip_boat_deployment` |
| A booking may not be assigned to a hull that is not deployed on that route × date | Pool filtering in the browser | FK from `trip_boat_assignment` to `trip_boat_deployment` |
| A chartered hull may never carry seat pax | Four separate browser mechanisms (§5.3) | One `deployment_type` column; the seat-pool view filters on it |
| A van group's pax may not exceed the van's capacity | Browser check on join and on van selection | API check inside the transaction that adds the member or sets the van, with `SELECT ... FOR UPDATE` on the group row |
| A van may belong to only one group per date | Dropdown disabling in the browser | `UNIQUE (service_date, van_id) WHERE van_id IS NOT NULL` on `van_group` |
| Split parts must sum to the allocation's pax | Browser validation, and it drifted | `CHECK (pax = pax_ad + pax_chd + pax_inf + pax_foc)` plus an API check that the splits sum to the trip pax |

### 11.2 Drivetrain

| Invariant | Rebuild mechanism |
|---|---|
| One engine per `(boat, drive position)` | `EXCLUDE (boat_id WITH =, position_code WITH =) WHERE boat_id IS NOT NULL AND NOT retired` |
| `boat_id` and `position_code` are set together or both null | `CHECK ((boat_id IS NULL) = (position_code IS NULL))` |
| A mounted asset has no storage location; a spare is detached | `CHECK (link IS NULL OR spare_location_code IS NULL)` on all three tables |
| One gearbox per engine, one propeller per gearbox | `UNIQUE (engine_id)`, `UNIQUE (gearbox_id)` |
| A gearbox "waiting on the boat" is neither mounted nor a spare | Three `CHECK` constraints plus an `EXCLUDE` for one per position |
| The position must be one the boat actually has | API validation against `v_boat_drive_position`; `422 POSITION_NOT_ON_BOAT` |
| Position labels are canonical | FK to `drive_position`; aliases normalised at ingest |
| Engine meter readings are positive | `CHECK (reading > 0)` |
| A meter reading may not go backwards | API check, `409 METER_REGRESSION` unless `meter_replaced` |

### 11.3 Boat status and pier

| Invariant | Rebuild mechanism |
|---|---|
| A boat has exactly one status on any date | `EXCLUDE USING gist` on `boat_status_period` |
| A pier code is one of the known piers | FK to `pier` |
| A pier resolution always takes a date | Function signature; no default-to-today anywhere |
| A past operating day cannot be edited | API check `409 PAST_DATE_LOCKED` on deployment writes |
| A `unavailable` maintenance job needs a reason | `CHECK (boat_status_target <> 'unavailable' OR reason IS NOT NULL)` |
| Closing a job with other open jobs on the boat carries over the strictest status | API logic in the close transaction; covered by a parity test |
| A job whose target was `available` must not touch boat status on close | Same |
| A done job has an outcome | `CHECK (status <> 'done' OR outcome IS NOT NULL)` — this is what stops the project-completion cascade bug |

### 11.4 Vans and dispatch

| Invariant | Rebuild mechanism |
|---|---|
| A van group has exactly one outbound van | The van lives on `van_group`, not on members |
| The return van is per booking; empty means "returns on the outbound van" | `van_assignment.van_return_id` nullable |
| `return_same_van` and an explicit return van are mutually exclusive | `CHECK (NOT (van_return_id IS NOT NULL AND return_same_van))` |
| Disband clears group, sequence, outbound van and return van | One transaction; `ON DELETE SET NULL` plus one `UPDATE` |
| A conflict is reported, never auto-resolved | The conflicts endpoint is a `GET` |
| Self-arrive removes a booking from the job order but **not** from the rate | The flag lives on the booking; no pricing endpoint reads it |
| Cancelled bookings are excluded from every aggregate | One shared predicate in the query layer; a single `cancelled_status` lookup table |

### 11.5 Money and audit

| Invariant | Rebuild mechanism |
|---|---|
| Card fee is stored separately from the amount that reduces the debt | Separate columns; never summed into revenue |
| Pier money is a separate pot until day-close reconciliation | Separate table; the ledger endpoint does not read it |
| Consumable requisition cost never enters job cost | Separate tables; `v_maintenance_job_cost` does not join `consumable_requisition` |
| The per-asset cost share is never added to a total | Two views; a lint rule and a test forbidding a query that reads both |
| Every mutating operation records who and when | `at` / `by_user` columns, populated from the auth context, not the request body |
| Equipment balances are replayed, never stored | `pier_move` is append-only; corrections are `adjust` rows |

---

## 12. Self-heal functions — port or delete?

The monolith runs a set of idempotent "self-heal" passes on load, because the blob model lets derived state drift. The project rule is that **data fixes stay user-triggered**, and any surviving heal must have a single unambiguous trigger, converge in one pass, log what it changed, and be incapable of rewriting data a user legitimately entered.

**Do not port any heal that a constraint can prevent.** Verdicts:

| Heal | What it does today | Verdict | Reasoning |
|---|---|---|---|
| **Boat stuck fixing** | A boat whose latest open status period is `fixing`/`unavailable`, whose note references a maintenance job that is now `done`, and which has no other in-progress job forcing downtime, gets that period closed at the job's end date and an `available` period appended with the note "Auto-restore". | **Delete.** | The drift exists because closing a job and restoring the boat are two separate writes that can partially fail. In the rebuild they are **one transaction** (§10.9 item 4), so the boat cannot be left stuck. Keep the *detection* as a read-only data-quality check (`GET /fleet/reports/data-quality`) so a genuine anomaly is visible, and provide an **admin-triggered repair** endpoint that closes a period explicitly with an operator and a reason recorded. Never automatic. |
| **Engine status vs active job** | An engine that is an asset of an in-progress job reads `fixing` regardless of the job's target status; an engine flagged `fixing` with no active job returns to `ready`. Skips `broken` and `spare`. | **Delete — replace with a view.** | This is not a repair, it is a *derivation* being stored. Add `v_engine_effective_status`: the stored `status_code`, overridden to `fixing` while the engine is an asset of an in-progress job. Nothing is written, so nothing can drift. Keep the stored column for the genuinely stored states (`broken`, `spare`, `retired`, `limited`). |
| **Charter boat mirror** | Copies `trip.charter_boat_id` → `ops.boat_id` for charters that were never assigned manually. Runs before the Daily Fleet Log, pier check-in and several other screens. | **Delete.** | §5.4. There is only one place a booking→hull relationship is stored, written in the same transaction that creates the charter. Two values cannot disagree when there is only one value. |
| **Van group `vanId`** | Propagates the group's outbound van to members that have none. Explicitly heals `vanId` **only** — spreading `vanReturnId` would silently arrange return vans nobody asked for. | **Delete.** | §7.3. The outbound van lives on the group row; a member cannot lack one. **The deliberate restriction to `vanId` must be carried forward as a rule, not as code:** nothing anywhere may bulk-write `van_return_id` across a group except the explicit "set return van for the whole group" action a dispatcher invokes. |
| **Van group conflict scan** ("รถปนกัน") | Read-only detector, runs on every render, never auto-picks. | **Keep, but move.** | Structurally impossible for the outbound leg after §7.3, but still valuable for what the schema cannot catch: a return van that is now unusable, a group whose van's capacity is now below its pax, a member on a van running a different programme. Move it from every-render to a **scheduled data-quality job plus an on-demand `GET`**. It stays read-only. ห้ามเดา. |
| **Self-arrive pickup-time normaliser** | Rewrites a stale clock time on a self-arrive trip back to the area default and clears the dispatcher's override. | **Port as an explicit action, not a load-time sweep.** | It changes a value a human may have typed. Surface it as a warning on the row ("pickup time looks like a clock time but this guest is self-arrive") with a one-click fix. Also run it **once at migration** and log every row it changes. |
| **Split pax repair** | Repairs splits whose headcount and breakdown disagree: trusts the headcount, re-deals types (adults to the split-off parts first), then swaps 1:1 so no van carries children without an adult. | **Delete the runtime pass; keep the algorithm for migration.** | `CHECK (pax = pax_ad + pax_chd + pax_inf + pax_foc)` makes the drift impossible going forward. Run the repair **once** during data migration, log every row it touches, and have a human review the log — re-dealing pax types is exactly the kind of guess that printed a child as an adult in the first place. |
| **OVN leg pickup strip** | Strips the inherited hotel pickup from an overnight return leg. | **Delete.** | Model the leg properly: `trip.ovn_leg` is a real column, and the return leg's zone is derived as `NoTransfer` in the view rather than being written and then corrected. |
| **Alt-pickup split rebuild** | Rebuilds automatic splits from the booking's multi-point pickups, leaving manual splits alone. | **Port as an explicit action.** | It is a genuine derivation from booking data, but it *writes*. Trigger it from the booking-side event that changes `alt_pickups`, inside that transaction, and restrict it to rows where `split_source = 'alt_pickup'`. Never on render. |
| **Maintenance job dedupe on load** | Deduplicates jobs by `(no, boat, title, type, start_date)`; unnumbered jobs pass through untouched. | **Delete.** | `UNIQUE (no)` on `maintenance_job`. Duplicates were an artefact of the blob merge path, which no longer exists. |
| **Inventory seed back-fill** | Pushes new default inventory rows whose id is missing. Adds only; never touches an existing row. | **Delete.** | Reference data belongs in seed migrations, applied once, tracked by the migration ledger. |
| **Project backfill from boat logs** | One-shot migration creating a project for every status period with `reason = 'dry_dock'` or an `unavailable` stretch of 14 days or more not already tagged with a project, then linking overlapping scheduled jobs. | **Run once at migration, then delete.** | It is a data migration wearing a load-hook costume. Its guard flag proves it: it is meant to run exactly once. |

**Summary:** of eleven heals, **eight are deleted outright**, one is kept as a read-only report, and two survive as explicit user- or event-triggered actions. None of them runs on page load.

---

## 13. Known bugs and traps — do NOT reproduce

| # | Bug | Current behaviour | Consequence | Required behaviour |
|---|---|---|---|---|
| B1 | **Van-group disband gap for the return van** | Disband clears the outbound van, group and sequence. The group heal reconciles the **outbound van only**, by design. There is therefore **no reconciliation path for `van_return_id` at all**. | A booking's return van can point at a van that was disbanded, deactivated or reassigned, and nothing ever detects it. The guest waits at the pier for a van that is not coming. | §7.3: the outbound van lives on the group; the return van lives on the assignment with a real FK. Disband clears all four fields in one transaction. A scheduled check reports return vans that are no longer usable — **reports, never auto-clears**. |
| B2 | **Hardcoded per-boat columns in `trips`** | The trips table has fixed columns `b1_route`, `b1_type`, `b1_booked`, `b1_charterbookingid`, `b2_…`, one set per boat. `b8`, `b14` and `b15` were **missing from the start**. | Deploying *Tadeo*, *Juliet* or *Rolanda* silently lost the assignment on the next sync. Every new hull needs a hand-written migration. The source comment admits the structure is still fragile. | §9.6: one row per `(service_date, boat_id)`. A new boat needs zero schema changes. |
| B3 | **The views over `trips` are hardcoded too** | Only the tables were patched when `b8`/`b14`/`b15` were added. | Later-added boats stay missing from any report reading the view, so the numbers silently disagree with the tables. | Rebuild both views (`v_seat_availability`, `v_seat_availability_unmapped`) over the row-per-boat model. **Capture the current definitions with `pg_get_viewdef` on the live server, never from the repo file** — prod and the repo migration are known to disagree in both directions. |
| B4 | **`pier_lic_types`, `pier_lic_classes` and `pier_codes` load with `Array.isArray(x) && x.length`** | An **intentionally emptied** list fails the guard and **silently reverts to the seed** on the next reload. | Deleting every licence type or roster code appears to work, then the seeds come back. Staff conclude the delete button is broken. | Load with `Array.isArray(x)` alone, so an empty array stays empty — the pattern already used for agents. In the rebuild these are tables; zero rows is a legitimate state and the question does not arise. **Verify during migration that the current production rows are the user's data and not re-seeded defaults** (`pier_lic_types` has 2 rows and `pier_lic_classes` has 4 in prod — plausibly still the seeds). |
| B5 | **Zero meter reading blows up engine hours** | A `0` typed as a placeholder is skipped by the hours calculation — but only because a skip rule was added after the fact. | Without the skip, hours go to −2210.5 or +4618.2 (§3.5). The skip also means a `0` is silently not a reading, so the operator gets no feedback. | `CHECK (reading > 0)` rejects it at write time with a message: "0 is a placeholder, not a reading. Leave the cell empty instead." Empty is stored as `NULL`. |
| B6 | **Project completion bypasses the job-close cascade** | Completing a project sets every open child job to `done` directly: no outcome, no asset status restore, no repair-history row, no incident auto-close, no service prompt. | Child assets are left stuck in `fixing` forever. Cost and repair history are wrong for every project ever completed. | `CHECK (status <> 'done' OR outcome IS NOT NULL)` makes it impossible. Project completion calls the real close operation once per child, in the same transaction, with an operator-supplied outcome — or refuses (`409 OPEN_CHILD_JOBS`). |
| B7 | **Two different engine-swap semantics** | The maintenance-job swap leaves the gearbox at the drive position for the incoming engine. The boat-detail "Assign / Replace" path moves the engine **without touching the gearbox or propeller**. | The gearbox ends up pointing at an engine that is no longer on the boat. The 1:1:1 chain is broken and the drivetrain bay renders nonsense. | One swap operation (§10.2). The boat-detail action calls it. |
| B8 | **Per-boat assignment never checks `licence_pax`** | The guard compares the resulting load to `effective_cap + 2` only. The licence ceiling is enforced at route level and via the cap-override clamp. | Every seeded hull has `cap < licence_pax`, so it does not bite today — a **data coincidence**. A hull configured with `cap = licence_pax` would be loaded two over its legal limit. | `assignment_ceiling = min(effective_cap + tolerance, COALESCE(licence_pax, cap))`, with distinct error codes. |
| B9 | **Pier resolution keyword-matches free text** | The effective pier falls back to substring-matching the status location for `panwa`, `ranong`, `grand andaman`, `se la va`, `tub`, `tab lamu`. | A location typed differently resolves to the wrong pier, or falls through to the `tublamu` default. A boat can vanish from both the available and unavailable lists. | Store `location_pier_code` alongside the free text. Run the keyword match **once** at migration and log every row it classifies. |
| B10 | **A pier resolution that defaults to "today"** | Opening the calendar for a future date read the status for that date but the pier for today. | The boat was filtered out of both lists and simply disappeared. Already fixed once; the shape of the bug can recur anywhere a date parameter is optional. | Every status and pier resolution takes a **required** date parameter. No default. |
| B11 | **Charter split over 2+ hulls flags only the first** | The deployment record knows only one `charter_boat_id`, so the second hull of a split charter was resold as seats. | Strangers on a private charter. Now worked around by deriving the charter-hull set from bookings on every render, plus a one-microtask memo cache. | A charter over N hulls writes N deployment rows with `deployment_type = 'charter'`. No derivation, no cache. |
| B12 | **Weather-cancelled routes keep their hulls deployed** | The fleet calendar treats a weather-closed route's hulls as spare; Boat Operation does not. | The same hull is spare in one screen and busy in another on the same day. | One rule: a weather closure releases the hulls to the spare pool in every view. Surface `WEATHER_CLOSED` as a violation while deployments remain. |
| B13 | **Dashboard severity split drops `critical`** | The incident chart counts `major` and `minor` only. | The most serious incidents are invisible in that chart. | Count all three severities. |
| B14 | **Quick-swap spares use the boat's home pier** | Candidate spares are filtered by `boat.pier`, not the effective pier for the incident date. | A boat temporarily working from another pier is offered its home pier's spares — parts that are 90 km away. | Filter by effective pier on the incident date. |
| B15 | **Job `end_date` is always today** | Closing a job stamps today unconditionally; back-dating requires patching the data by hand. | Cost analytics time-filters on `COALESCE(end_date, start_date)`, so a late-recorded close lands in the wrong month. | `closed_on` is a request field defaulting to today, validated `>= start_date`. |
| B16 | **Deleting a maintenance job does not return its parts to stock** | Hard delete removes the job; withdrawn parts stay withdrawn. | Inventory silently drifts. | No hard delete. Cancel instead. Any admin hard-delete must reverse every movement in the same transaction. |
| B17 | **Vehicle id collision on the form path** | The quick-add path appends a random suffix for multi-user uniqueness; the full form's create path does not. | Two concurrent adds can collide. | Server-generated ids. |
| B18 | **Unmapped fields are silently dropped** | A vehicle colour, a scalar "auto split" flag, a per-day job-sheet field not on the whitelist, and pier staff `sect`/`note` (a real casualty on 14 Aug 2026) all vanished on the next round-trip. | The classic "I saved it, refreshed, it's gone." Four separate registration steps must all be done. | Typed columns and one migration. The whole class disappears. |
| B19 | **The month fuel budget bypasses the persistence layer** | Written straight to browser storage. | Not shared between users, lost on cache clear, invisible to any report. | `fuel_budget` table. |
| B20 | **Pier assignment writes bypass the fleet save path** | Pier assignment create/cancel/auto-update write raw browser storage. | If the underlying key is absent the change is in memory only, so the move never persists. | Normal API writes. |
| B21 | **The pier→zone map contradicts the pickup areas** | Tub Lamu routes map to zone `KL`, but Tub Lamu routes pick up from `PK` areas. An auto-group fallback can therefore pull **Khao Lak vans for a Phuket pickup run**. | Latent, not observed live — the primary path avoids the fallback. | `pier.default_pickup_zone_code` is data. **Do not port the fallback branch at all** — an auto-assign with no matrix van returns "no candidates," not a guess. |
| B22 | **`NoTransfer` is aliased `NT` inconsistently** | Both spellings are live; guards must test both. | A guard that tests one spelling silently misses half the data. | One canonical code in `pickup_zone`; aliases normalised at ingest; a migration that rewrites every `NT`. |
| B23 | **Adding a pickup area does not put it on the map** | Coordinates live in a hardcoded table keyed by a normalised area name. | New areas fall into an "other" bucket on the pickup map. | `latitude` / `longitude` columns on `pickup_area`. |
| B24 | **Read-only users mutate memory and never persist, with no feedback** | Only the persist call checks the permission area. | A view-only user does an hour of work that is silently discarded. | Authorization at the API boundary; `403` with a message the UI surfaces. |
| B25 | **The Daily Log's per-boat fuel price is stored in the same map as the pier price** | One map holds two kinds of key — pier codes and boat ids — distinguished only by which happens to be passed. | A boat id that collides with a pier code would silently overwrite. | Two tables (§9.4). |
| B26 | **Guides 4 and 5 vanished from the job sheet** | The sheet read only the first three assigned guides, and interns/staff never reached it at all. | Under-reported crew on a government form. Already fixed; the fix must not regress. | Return every assigned person with role and languages. |
| B27 | **Cancelled-status list duplicated ~10 times as a literal array** | Each aggregate re-declares `['cancelled','rejected','cancelled_weather']`. | Adding a fourth cancelled status means finding ten sites; missing one silently double-counts. | One lookup table, one shared predicate. |
| B28 | **`toISOString().slice(0,10)` used for service dates in several helpers** | Truncating a UTC timestamp shifts the date back for anything before 07:00 local. | Reports and profile resolution can pick the previous day between 00:00 and 07:00 ICT. | Session timezone `Asia/Bangkok`; `date` columns; never derive a date from a UTC instant. |

---

## Open questions

Resolve these before the affected work package starts. Each one is a place where the truth is genuinely unknown, not an inference.

| # | Question | Blocks | Why it matters |
|---|---|---|---|
| **OQ-1** | Should boat retirement stay dual-encoded — a `retired` status period **and** a `retired` boolean — or should the flag be derived from an open `retired` period? | WP-2 | The spec keeps both because unretire writes an `available` period and clears the flag, and analytics filter on the flag. One of them is redundant. |
| **OQ-2** | Has an engine meter ever been **replaced**, and how was it handled? | WP-4 | Nothing models it today; a replaced meter would compute nonsense hours forever. The `meter_replaced` flag in §3.5 is a proposal, not observed behaviour. |
| **OQ-3** | Is `boat_repair_history` still needed as a stored table, or can it be a view over `maintenance_job`? | WP-5 | It is written at job close and read only on the boat detail page. If the boat page can join, the table is redundant denormalisation. |
| **OQ-4** | How many hulls are actually in service — 15 (seed), 16 (colour palette), or something else in production? | WP-1 | The migration's row count and every "how many boats" number depends on it. Query production, do not trust either constant. |
| **OQ-5** | Do the 2 rows in `pier_lic_types` and 4 in `pier_lic_classes` on production represent real configuration, or are they the seeds re-applied by the `.length` guard (B4)? | WP-9 | If they are re-applied seeds, someone's deletion was reverted and nobody noticed. |
| **OQ-6** | Is `ranong` scheduled to receive hulls and routes, and on what timeline? | WP-1, WP-3 | It changes nothing structurally (it is already a first-class pier) but it changes the seed data and the acceptance tests. |
| **OQ-7** | What should `BA_CAP_TOL` be, and should it vary by boat type or by pier? | WP-7 | The spec makes it configuration with a default of 2. Ops may want a different tolerance on a 65-seat catamaran than on a 34-seat speedboat. |
| **OQ-8** | Should the licence-coverage check ever **block** dispatch, or stay advisory forever? | WP-9 | Today it is advisory, deliberately. If a policy change is coming, the API should return the violation in a form that can be escalated without a schema change. |
| **OQ-9** | Is there a staging Postgres, or only production? | WP-1, WP-14 | The data migration and the parity harness both need a production clone to rehearse against. Listed as an open question in the rewrite plan too. |
| **OQ-10** | Who owns the return-leg drop-off area when a booking has multiple pickup points and one drop-off? | WP-11 | Today it is booking-level, but the auto-splits are per pickup point. A split party returning to two places is not modelled. |
| **OQ-11** | Should the pier check-in "arrival zone" vocabulary (`PK`/`KL`/`OWN`/`NOVAN`) be unified with `pickup_zone`, or stay a separate presentational bucketing? | WP-11 | `OWN` and `NOVAN` are not zones — they are states. Merging them into the zone lookup would repeat the mistake §7.11 is fixing. The spec keeps them separate; confirm. |
| **OQ-12** | Which OCR engine and which languages should the server-side pre-check use, and is a Thai pass wanted? | WP-13 | Today it is English-only in the browser. A Thai voucher currently scores "no match" and looks like a mismatch rather than an unread document. |
| **OQ-13** | Is `total_cap` ever used for anything other than paperwork, and is `total_cap = licence_pax + crew` a rule or a coincidence in the seed? | WP-2 | If it is a rule, make it a generated column. |

---

## 14. Acceptance criteria & test plan

Each item is a checkable statement. Write the test before the code.

### 14.1 Boats and status

1. Creating a boat with `pier_code = 'visitpanwa'` fails with a foreign-key violation. Same for `'Visit Panwa'` and `'Tub Lamu'`.
2. A boat with `cap = 60` and `licence_pax = 56` cannot be created (`cap_within_licence`).
3. Writing a status period `2026-08-25 → null` on a boat that already has `2026-08-20 → null` truncates the earlier one to `2026-08-24` and leaves exactly one period covering any given date.
4. Two concurrent status writes with the same `valid_from` on the same boat: one succeeds, the other either serialises correctly or aborts. **Never** do both persist.
5. Querying a boat's status for `2026-08-24` returns `fixing`; for `2026-08-25` returns `available`, after the sequence in item 3.
6. A boat with no status periods at all resolves to `available`.
7. `GET /fleet/boats/{id}` returns `operating_pier`, `registration.homeport_city` and `physical_location` as three separate fields, and `physical_location.source` is one of the four documented values.
8. A boat with an in-progress job that has a location, and a non-available status on the date, groups under **In Shop** and appears in **no** pier group.
9. A boat with status `fixing` and **no** job location stays in its pier group with a `FIXING` pill.
10. Retired boats appear in no group and in no aggregate.

### 14.2 Drivetrain

11. Mounting a second engine at `(b4, 'Std')` fails with an exclusion-constraint violation.
12. Setting `engine.boat_id` without `position_code` fails (`engine_mount_coherent`).
13. Setting `spare_location_code` on a mounted engine fails (`engine_spare_detached`).
14. Two gearboxes pointing at the same engine: the second fails (`UNIQUE (engine_id)`).
15. A gearbox with both `engine_id` and `on_boat_id` set fails.
16. A gearbox with both `on_boat_id` and `spare_location_code` set fails.
17. Assigning position `Center` to an engine on a 4-engine boat returns `422 POSITION_NOT_ON_BOAT`.
18. Ingesting position `Starboard` stores `Std`; ingesting `Stbd` stores `Std`.
19. Sorting a 5-engine boat's drivetrain returns `Port, C.Port, Center, C.Std, Std` — not alphabetical.
20. **Engine swap end-to-end.** Given the before-state in §3.4: after `POST .../swap-engine`, `G-12.engine_id = E-NEW`, `G-12.on_boat_id IS NULL`, `P-30.gearbox_id = G-12` unchanged, `E-OLD.boat_id IS NULL` with `spare_location_code` set, `E-NEW.boat_id = b4` and `position_code = 'Std'`, and six asset events exist.
21. The same swap where the incoming engine came from another boat: its own gearbox ends with `on_boat_id = <source boat>`, not with a spare location.
22. A swap that fails at any step leaves **zero** rows changed.
23. A swap with a mismatched gearbox shaft length returns `428` without `acknowledge_warnings`, and succeeds with it.

### 14.3 Engine hours — the worked cases

24. `base_hours = 1200.0`; readings `2026-08-01 → 3410.5`, `2026-08-03 → 3418.2` ⇒ **`hours = 1207.7`**.
25. The same, with an attempted `2026-08-02 → 0`: the write is **rejected** with `READING_NOT_POSITIVE`, and hours remain **`1207.7`**.
26. Legacy data that already contains a `0` reading: the view still returns **`1207.7`** — the zero is excluded by the filter.
27. No readings at all ⇒ `hours = base_hours = 1200.0`.
28. Readings on two different boats either side of a swap (`3410.5` on `b4`, `3455.0` on `b7`) ⇒ `hours = 1244.5`. The calculation is **not** scoped to one hull.
29. A reading lower than the previous one returns `409 METER_REGRESSION`; with `meter_replaced: true` it succeeds and records an event.
30. Service state: `base_hours = 1200`, `last_service_hours = 1180`, `service_interval = 100`, current hours `1207.7` ⇒ `since = 27.7`, `next = 1280`, `left = 72.3`, `pct = 27.7`, `overdue = false`.
31. `service_interval = 0` returns a null-cycle object, not a division by zero.
32. A gearbox that has never been serviced returns `overdue = false` on day one.

### 14.4 Maintenance cost — the worked case

33. **Cost share across 3 same-type assets.** A job with `job_cost = ฿36,000` and three engine assets:
    - `v_maintenance_job_asset_cost` returns **฿12,000** for each of the three engines.
    - `v_maintenance_job_cost` returns **฿36,000** — unchanged.
    - The boat's total for the period includes the job **once**, at ฿36,000.
    - The project total, if the job has a parent, includes it **once**, at ฿36,000.
    - The dashboard's maintenance-spend tile shows ฿36,000, not ฿108,000.
34. The same job with three engines **and** one gearbox: engines get ฿12,000 each; the gearbox gets ฿36,000 (it is the only asset of its type). Totals are still ฿36,000.
35. A job whose parts were paid by a `parts` memo does not count those parts twice: `job_cost = memo_amount`, not `memo_amount + parts_value`.
36. A consumable requisition against the same boat in the same month does **not** appear in `v_maintenance_job_cost`.

### 14.5 Capacity — the worked cases

Boat `b3` Okeanos: `cap = 56`, `licence_pax = 75`. Tolerance = 2, so `assignment_ceiling = min(58, 75) = 58`.

37. Load `54` + a 2-pax booking = **56** = exactly `cap` ⇒ **accepted**, no warning.
38. Load `56` + a 2-pax booking = **58** = `cap + 2` ⇒ **accepted with `OVER_CAP` warning**; requires `acknowledge_warnings: ["OVER_CAP"]`, otherwise `428`.
39. Load `57` + a 2-pax booking = **59** > `cap + 2` ⇒ **`409 CAP_TOLERANCE_EXCEEDED`**, message naming the boat, resulting pax, cap and max allowed.
40. A hypothetical hull with `cap = 34` and `licence_pax = 34`: load `33` + a 2-pax booking = **35** > `licence_pax` ⇒ **`409 LICENCE_EXCEEDED`**, *not* `CAP_TOLERANCE_EXCEEDED`. This is the case B8 misses today.
41. A per-day cap override of `90` on `b3` is clamped to `75` (`licence_pax`) on write.
42. Bulk-assigning ten bookings where two would overflow: eight commit, two are reported, and the batch does **not** abort.
43. Assigning to a hull that is not deployed on that route × date ⇒ `409 BOAT_NOT_DEPLOYED` (foreign key).
44. Assigning to a hull chartered on **any** travel date of that booking ⇒ `409 BOAT_CHARTERED_ON_DATE`.
45. `POST /assignments/plan` writes nothing: assert row counts are unchanged before and after.
46. A commit whose planner output is stale (another dispatcher filled the boat first) fails with `409`, not a silent overfill.
47. Two concurrent commits filling the last two seats on one hull: exactly one succeeds.

### 14.6 Seat pool and charter

48. A charter deployment on a hull removes its cap from `available_capacity` for that route × date.
49. A charter split across two hulls writes **two** deployment rows and removes **both** caps. Neither hull is offered to a seat booking.
50. A booking in `pending_approval` with a non-empty `approval.over[]` is **excluded** from `seats_consumed`; one without it is **included**.
51. A booking with 4 pier no-shows on a past date reduces `seats_consumed` by 4 for that date.
52. Bookings in `cancelled`, `cancelled_weather` and `rejected` contribute 0 to every aggregate tested here.

### 14.7 Vans

53. Setting a group's van when the group's pax exceed the van's capacity ⇒ `409 VAN_CAPACITY_EXCEEDED`.
54. Adding a member that would exceed capacity ⇒ `409`, and the member is **not** added.
55. Assigning a van already used by another group that date ⇒ `409 VAN_ALREADY_IN_ANOTHER_GROUP`.
56. Assigning a van not on that route's month matrix ⇒ `409 VAN_NOT_ON_ROUTE_MATRIX`. The **return** van pool accepts it.
57. **Disband** clears `group_no`, `van_seq`, `van_return_id` and `return_same_van` on **every** member, including split rows, in one transaction. Assert all four are null afterwards.
58. After a disband, the booking does **not** appear on the old van's job order.
59. Setting both `van_return_id` and `return_same_van = true` fails (`return_exclusive`).
60. A `van_assignment` row where `pax ≠ ad + chd + inf + foc` fails.
61. A booking flagged `pickup_self` does not appear in the outbound section, is not counted as unassigned, **and its price is byte-identical** to the same booking without the flag.
62. A self-return booking is absent from the return section and raises no "no return van" alert.
63. A return row prints the **drop-off** area's zone, not the pickup's.
64. `return_van = COALESCE(van_return_id, group.van_id)` for every row on the return sheet.
65. Per-date driver override: with an override, the sheet prints it and marks it; without, it prints the registry value. Deleting the override reverts.
66. A van running two programmes in a day produces **two** job orders and shares **one** driver override.
67. The conflicts endpoint reports a group whose van capacity dropped below its pax and **changes nothing**.

### 14.8 Deployment

68. Deploying to a past date ⇒ `409 PAST_DATE_LOCKED`.
69. Deploying a hull whose status on the date is not `available` ⇒ `409 BOAT_NOT_AVAILABLE`.
70. Deploying a hull whose effective pier differs from the route's pier ⇒ `409 WRONG_PIER`, and the candidates endpoint listed it under `unavailable` **with a reason**, not omitted.
71. Deploying a hull already deployed on that date ⇒ `409 BOAT_ALREADY_DEPLOYED`.
72. Re-routing a hull with bookings on it ⇒ `428 BOOKINGS_ATTACHED`; on acknowledge, the deployment changes and the affected bookings are returned in the response as flagged.
73. **Adding a 16th boat requires no migration.** Insert a boat row, deploy it, assign a booking, and confirm it appears in the seat pool, the daily log, the job sheet and every view. This is the regression test for B2/B3.
74. A weather closure on a route × date returns its hulls to the spare pool in **every** endpoint that reports spares.

### 14.9 Migration parity

75. For every `(date, boat)` in the legacy `trips` table, a `trip_boat_deployment` row exists with the same route and type — **including `b8`, `b14`, `b15`**.
76. For every boat, the legacy status log and `boat_status_period` return the same status for every date in the last 24 months.
77. `v_engine_hours` matches the legacy calculation for every engine, to one decimal place.
78. `v_maintenance_job_cost` matches the legacy job cost for every job, to the satang.
79. Every legacy spare (storage location set) migrates with its link pointers null, and no constraint violation occurs.
80. Every legacy "คาเรือ" gearbox (`on_boat_id` set, `engine_id` null) migrates intact and is **not** classified as a spare.
81. Row counts match per table, with every intentional exclusion listed and justified.

---

## 15. Suggested build order

Each work package is PR-sized and has its own done-condition. Dependencies are listed; anything with no unmet dependency can run in parallel.

| # | Package | Depends on | Done when |
|---|---|---|---|
| **WP-1** | **Lookup tables and seed.** `pier`, `drive_position` + aliases, `asset_status`, `boat_status`, `boat_type`, `boat_ownership`, `deployment_type`, `storage_location`, `pickup_zone`, `pickup_region`, `roster_code`, `maintenance_outcome`. Seeded with the exact values in §9.1. | — | All three piers exist including `ranong`; inserting `visitpanwa` as a pier code on any table fails; the drive-position order is `Port, C.Port, Center, C.Std, Std`. |
| **WP-2** | **Boat registry + status periods.** `boat`, `boat_document`, `boat_status_period` with the exclusion constraint, `boat_pier_assignment`; `v_boat_status_on`, `v_boat_effective_pier`; the transactional status-change endpoint. | WP-1 | Tests 1–10 pass. Two concurrent status writes cannot both persist. |
| **WP-3** | **Route registry.** `route`, `route_season`, `route_departure_time`. | WP-1 | Route seasons resolve open/closed for any date; the Similan monsoon window is correct. |
| **WP-4** | **Drivetrain + daily logs.** `engine`, `gearbox`, `propeller`, `asset_event` with every constraint; `daily_log`, `daily_log_reading`, `daily_log_lock`, `fuel_price_pier`; `v_engine_hours`, `v_engine_service_state`, `v_gearbox_lifetime`; the batch ingestion endpoint. | WP-2 | Tests 11–19 and 24–32 pass. A `0` reading is rejected with the documented message. |
| **WP-5** | **Engine swap operation.** The single transactional endpoint; the boat-detail replace action calls it. | WP-4 | Tests 20–23 pass. A failed swap changes zero rows. B7 is closed. |
| **WP-6** | **Maintenance, incidents, projects, inventory, memos.** All tables from §9.5; `v_maintenance_job_cost`, `v_maintenance_job_asset_cost`, `v_incident_severity`; start, close, cancel, project transitions. | WP-4 | Tests 33–36 pass. `done_needs_outcome` makes B6 impossible. Project completion refuses on open children without outcomes. |
| **WP-7** | **Deployment + seat pool.** `trip_boat_deployment`, `boat_cap_override`, `weather_closure`; `v_boat_effective_cap`, `v_seats_consumed`, `v_route_allotment`; the candidates and deploy endpoints. **Kills B2.** | WP-2, WP-3 | Test 73 passes: a 16th boat needs no migration. Tests 68–72, 74 pass. |
| **WP-8** | **Boat assignment.** `trip_boat_assignment`; the planner (read-only) and the commit (transactional). | WP-7 | Tests 37–52 pass, including the licence ceiling (B8) and the concurrency case. The planner provably writes nothing. |
| **WP-9** | **Pier operations.** `pier_staff`, `pier_job`, `pier_job_crew`, `pier_team`, `pier_move`, `pier_item`, `pier_kind`, `pier_duty`, `pier_shift`, licence tables, `pier_config`; the roster derivation with the 26→25 cycle; the licence coverage check. | WP-2 | The roster derives from job sheets with only hand-touched cells stored; the cycle straddles two months correctly; licence coverage compares against GT and BHP. |
| **WP-10** | **Van registry + month matrix.** `van`, `van_day_route`, `van_day_zone`, `van_day_status`, `van_status_period`, `van_zone_period`, `van_event`; `v_van_usable`. | WP-1, WP-3 | A van can hold two programmes on one date; an `off` van is excluded from pools but not removed from a group that already holds it. |
| **WP-11** | **Pickup model + van grouping.** `pickup_area`, `pickup_time_group`, `pickup_time_profile`, `pickup_time`; `van_group`, `van_assignment`, `van_day_override`; group create/set-van/add-member/disband. **Kills B1 and B22.** | WP-10 | Tests 53–60 pass. Disband clears all four fields. Adding a pickup zone is one `INSERT`. |
| **WP-12** | **Job orders.** Server-side rendering to PDF/PNG/HTML; `van_job_sent`, `van_job_special_request`, `pickup_location_label_th`; the conflicts endpoint. | WP-11 | Tests 61–67 pass. No CDN is contacted at render time. |
| **WP-13** | **Check-in, guides, Travel Summary, Doc-Check + server-side OCR.** | WP-8, WP-11 | The three-stage machine steps back correctly; card fees stay separate from amounts; pier money is not in the ledger; OCR failure is persisted and never blocks manual verification. |
| **WP-14** | **Data migration + parity harness.** One-shot transforms: legacy `trips` → deployment rows (including `b8`/`b14`/`b15`), status logs → periods, keyword pier classification with a change log, split-pax repair with a reviewed log, self-arrive pickup-time normalisation with a log, project backfill from status periods. | WP-8, WP-11 | Tests 75–81 pass against a production clone. Every transform emits a reviewable change log. |
| **WP-15** | **Reporting views + dashboard.** Cost, fuel, insights, utilisation, service-due, documents-expiring. Rebuild `v_seat_availability` and `v_seat_availability_unmapped` over the row-per-boat model, captured from `pg_get_viewdef` on the live server. **Kills B3.** | WP-7, WP-6 | Nulls are preserved in fuel metrics (null ≠ 0); later-added boats appear in every view. |
| **WP-16** | **Delete the adapter.** Drop `ops.*` from the booking model in the same migration that proves `trip_boat_assignment` and `van_assignment` are authoritative. | WP-8, WP-11, WP-14, and the booking phase | No code path reads `ops`. The migration that drops the columns is written and tested. |

**Sequencing note.** WP-1 through WP-6 are the fleet half and have no dependency on the booking rewrite. WP-7 onward touch booking data through the adapter and must be sequenced against the booking phase. If the booking phase slips, WP-1…WP-6 still ship value: they end the drivetrain and status drift, and they make the daily log trustworthy.

---

## 16. Glossary

### Domain terms

| Term | Meaning |
|---|---|
| **Allotment** | The sellable seat pool for a route × date: total deployed capacity minus charters, minus consumed seats, minus locked seats. |
| **Assignment** | Putting a specific booking on a specific hull (boat assignment) or in a specific van (van assignment). Distinct from deployment. |
| **Boat assignment** | Deciding which vessel carries which guests on a route × date. |
| **Booking cap (`cap`)** | How many seats the company chooses to sell on a hull. Commercial, adjustable, per-day overridable. |
| **Charter (เหมาลำ)** | A customer buying the whole vessel. Consumes a hull, not seats; the hull leaves the seat pool entirely. |
| **Deployment** | Putting a hull on a route for a date. Creates the seat pool. Precedes assignment. |
| **Drive position** | The mounting point of an engine on a hull: `Port`, `C.Port`, `Center`, `C.Std`, `Std`, in physical order. |
| **Effective cap** | The per-day cap override if one exists, otherwise `cap`, clamped to `licence_pax`. Every capacity read uses it. |
| **Effective pier** | The pier a hull is actually working from on a given date, derived: shop → pier assignment → stored location pier → home pier. |
| **Home pier / operating pier** | The pier a hull normally works from. Distinct from its legal homeport. |
| **Homeport / homeport city** | The legal registration port and province from the vessel's papers. Never used for dispatch. |
| **Job order (ใบงานรถ)** | The printed or shared driver sheet for one van on one programme on one day. |
| **Licence pax (`licence_pax`)** | The registered passenger seat count from the vessel licence. The legal ceiling. Hard block. |
| **Longtail** | A traditional Thai boat used as a shuttle on some programmes; sold as a bundle item on a rate type. |
| **Maintenance job (MJ)** | A unit of repair or service work on one hull. |
| **Meter reading** | An engine's hour-meter value recorded in the Daily Fleet Log. Values ≤ 0 are placeholders, never data. |
| **OVN** | Overnight — a booking whose outbound and return legs are on different dates, with a night on the island. |
| **Pier** | An operating harbour: `tublamu`, `panwa`, `ranong`. Plus the derived pseudo-pier `shop`. |
| **Pickup area** | A named collection point, e.g. Patong, Kata, Maikhao. Carries a zone and a time group. |
| **Pickup zone** | Which pool of vans and which price band: `PK` (Phuket), `KL` (Khao Lak), `NoTransfer`. |
| **Rate-type zone** | The same three tokens, used to select a seat price. A different store and a different question from the van zone. |
| **Route / programme** | A tour product: Similan by Speedboat, Phi Phi Bamboo, Whale Shark, etc. |
| **Seats consumed** | Seat pax counted against a route × date, excluding charters, cancelled bookings, non-holding pending bookings and on-site losses. |
| **Self-arrive** | The guest makes their own way to the pier. Removes them from the van job order. **Does not change the rate.** |
| **Spare** | A detached drivetrain asset in storage. Identified by having a storage location, not by a status string. |
| **Split** | Dividing one booking's pax across two or more hulls (boat split) or vans (van split). |
| **Standing crew** | The default crew for a hull, shown as a fallback on the job sheet but never written automatically. |
| **Status period** | One interval of a hull's availability history. |
| **Time group** | A set of pickup areas that depart at the same minute, sharing one time entry. |
| **Total cap** | Total persons on board including crew = `licence_pax + crew`. Paperwork only. |
| **Travel Summary** | The day-close document: who actually travelled, penalties, cash by method, the manifest. |
| **Van group** | A set of bookings collected by **one** outbound van. Keyed by date, route, zone and group number. |

### Thai operational phrases

| Thai | Transliteration | English |
|---|---|---|
| ห้ามเดา | *hâam dao* | **Never guess.** The system surfaces conflicts; a human resolves them. |
| รถปนกัน | *rót pon gan* | **Mixed vans** — two or more different vans inside one van group. |
| คาเรือ รอเครื่อง | *kaa reua ror khrûeang* | **Left on the boat, waiting for an engine** — a gearbox parked at a drive position during an engine swap. Not a spare. |
| กลับคันเดิม | *glàp khan doem* | **Returns on the same van.** |
| ยังไม่จัดรถกลับ | *yang mâi jàt rót glàp* | **No return van arranged yet.** |
| ที่นั่งไม่พอ | *thîi nâng mâi phor* | **Not enough seats** — the group exceeds the van's capacity. |
| แยกคน | *yâek khon* | **Split the party** across two vans. |
| เบิกของใช้ | *bòek khǒng chái* | **Requisition consumables.** |
| เบิก-คืนอุปกรณ์ | *bòek–kheun ùppakorn* | **Issue and return equipment.** |
| ใบงานเรือ | *bai ngaan reua* | **Boat job sheet** — the crew roster for one hull for one day. |
| ใบงานรถ | *bai ngaan rót* | **Van job order** — the driver's sheet. |
| ใบงานไกด์ | *bai ngaan guide* | **Guide job sheet** — the crew-facing manifest. |
| ใบสั่งงานมัคคุเทศก์ | *bai sàng ngaan mákkhúthêet* | **Government guide job order** — the Tourism Department form. |
| ใบอนุญาต | *bai ànúyâat* | **Licence** — marine certificates for captains and engineers. |
| ตารางการทำงาน | *taaraang gaan tham ngaan* | **Work schedule / duty roster.** |
| ตรวจเอกสาร | *trùat èekkasǎan* | **Document check.** |
| เช็คอินหน้าท่า | *check-in nâa thâa* | **Pier check-in.** |
| เช็คอินรถ | *check-in rót* | **Van check-in.** |
| ถึงท่า / เคลียร์ / ขึ้นเรือ | *thǔeng thâa / clear / khûen reua* | **Arrived / cleared / boarded** — the three pier check-in stages. |
| ขึ้นคาน | *khûen khaan* | **Drydock** — a hull hauled out of the water. |
| อยู่ท่าไหน | *yùu thâa nǎi* | **Which pier does it operate from?** → home pier. |
| ตอนนี้อยู่ที่ไหนจริง | *torn níi yùu thîi nǎi jing* | **Where is it physically right now?** → current status location. |
| จดทะเบียนจังหวัดอะไร | *jòt thabian jangwàt àrai* | **Registered in which province?** → homeport city. |
| ไม่ออก = ไม่นับ ไม่ใช่ 0 | *mâi òok = mâi náp, mâi châi sǔun* | **Didn't go out means not counted — not counted as zero.** Null ≠ 0 in every fuel metric. |
| บันทึกแล้ว | *banthúek láew* | **Saved** — the Daily Log's locked state. |
| รถร่วม | *rót rûam* | **Partner van** — a co-operating operator's vehicle. |
| เรือเช่า | *reua châo* | **Chartered/rental boat** — a hull the company hires in. |
| ยกเลิกหน้างาน | *yók lôek nâa ngaan* | **Cancelled on site** at the pier. |

### Abbreviations

| Abbr. | Expansion | Meaning |
|---|---|---|
| **BHP** | Brake horsepower | Total engine power. Load-bearing: engineer licence classes have a BHP ceiling. |
| **COT** | Cash on Tour | Money the guest pays on the day, settled at day close. |
| **FOC** | Free of charge | A guest travelling free. Counts as a physical head; folded into adults on government forms. |
| **GT** | Gross tonnage | Vessel size measure. Load-bearing: deck licence classes have a GT ceiling. |
| **LOA** | Length overall | Vessel length in metres. |
| **LBP** | Length between perpendiculars | Vessel length measure used on registration papers. |
| **MJ** | Maintenance Job | `MJ-nnn`. |
| **INC** | Incident | `INC-nnn`. |
| **MO** | Memo | `MO-nnn`, a purchase/labour approval memo. |
| **PRJ** | Project | `PRJ-nnn`, a drydock or overhaul. |
| **NT** | Net tonnage — **and also** an alias for the `NoTransfer` pickup zone | **Two unrelated meanings.** In a vessel spec context it is net tonnage; in a zone context it is `NoTransfer`. Disambiguate by context; the rebuild uses `NoTransfer` only. |
| **OCR** | Optical character recognition | The voucher pre-check. |
| **OVN** | Overnight | A booking with a night on the island. |
| **PAX** | Passengers | Head count. |
| **PFM** | Performance | The Daily PFM module; `ops.pfm` carries its per-day data. |
| **POA** | Pier Office — Attendance | ตารางการทำงาน, the duty roster page. |
| **POJ** | Pier Office — Job | ใบงานเรือ, the boat job sheet page. |
| **POL** | Pier Office — Licence | ใบอนุญาต, the marine licence page. |
| **PO** | Pier Office | เบิก-คืนอุปกรณ์, the equipment issue/return page. |
| **PK** | Phuket | Pickup zone code. |
| **KL** | Khao Lak | Pickup zone code. |
| **RN / TL / VP** | Ranong / Tub Lamu / Visit Panwa | Pier short labels. |
| **THB / ฿** | Thai baht | Currency. |
| **ICT** | Indochina Time | UTC+07:00, Asia/Bangkok. No DST. |
