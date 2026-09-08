-- 0001_booking-core
--
-- Forward-only. Once this has been applied anywhere, it is history:
-- correct it by writing the next migration, never by editing this file
-- (the runner checksums it and will refuse to continue).
--
-- BK-01 · the booking aggregate root. Replaces the wide, flat
-- `operation_schemas.sb_bookings` (144 text columns, no constraints) that the
-- monolith's blob-to-SQL mapper writes. The old tables are left untouched and
-- keep serving the monolith until Phase 8; nothing here reads or writes them.
--
-- Why `operation_schemas` and not a new schema: the ops app already owns this
-- schema, and BK-04's backfill has to join old rows to new ones inside one
-- transaction. A second schema would buy a naming nicety and cost a
-- cross-schema join on every step of it.
--
-- Why CHECK constraints instead of Postgres enum types for every closed value
-- set: this runner executes each migration inside a single transaction, and
-- `ALTER TYPE ... ADD VALUE` cannot be used by a statement in the same
-- transaction that added it. That would make "add a status and backfill it" a
-- permanent two-migration dance. A CHECK is edited by a plain ALTER TABLE.

create table operation_schemas.booking (
  -- Surrogate key. Every child table points here, so the business code stays
  -- free to be corrected without a cascading update across 19 tables.
  id                    uuid primary key default gen_random_uuid(),

  -- The business code the whole company says out loud: `BK-26080001`.
  -- Deliberately NO format CHECK. Three shapes are live in production
  -- (v2 `BK-YYMMNNNN-XXXX`, legacy v1 `BK-YYMMDD-NNN-XXXX`, and rows using the
  -- `b2c_<lkId>[_<n>]` prefix convention), and a regex that rejected any of
  -- them would block the BK-04 backfill on data we are explicitly keeping.
  code                  text not null unique,

  -- 2 = Booking v2. v1 rows migrate into these same tables and are read-only,
  -- so writer paths refuse them on this flag rather than by sniffing the code.
  schema_ver            smallint not null default 2,
  legacy_v1             boolean not null default false,

  -- Replaces the `b2c_` id-prefix convention with an actual column. See
  -- SourceSystem in @la/contracts.
  source_system         text not null default 'ops',

  created_at            timestamptz not null default now(),
  created_by            text,
  updated_at            timestamptz,
  updated_by            text,
  -- `booked_at` is when the sale happened; `created_at` is when the row
  -- appeared. They diverge for back-entered bookings, so both are kept.
  booked_at             timestamptz,
  booking_date          date not null,
  voucher_ref           text,

  agent_id              text,
  b2c_channel           text,
  rate_type_id          text,
  -- Salesperson attribution. The monolith resolves this as
  -- `bk.soldBy || agent.sales`, so NULL means "inherit the agent's sales owner"
  -- and is not the same as unassigned.
  sold_by               text,

  lead_pax              text not null,
  lead_nationality      text,
  lead_type             text,
  lead_foc              boolean not null default false,
  lead_phone            text,
  lead_email            text,

  pickup_area_id        text,
  -- Denormalised label frozen at booking time. Pickup areas get renamed and a
  -- voucher already printed must keep the name that was on it.
  pickup_area           text,
  pickup_zone           text,
  pickup_self           boolean not null default false,
  hotel_name            text,
  room_number           text,
  dropoff_same          boolean not null default true,
  dropoff_area_id       text,
  dropoff_area          text,
  dropoff_hotel_name    text,

  guide_english         boolean not null default false,
  guide_russian         boolean not null default false,
  guide_chinese         boolean not null default false,
  guide_other_lang      text,

  meal_veg              integer not null default 0,
  meal_vegan            integer not null default 0,
  meal_halal            integer not null default 0,
  meal_allergies        text,
  -- [{name, qty}] — a free-form list the galley reads, never aggregated.
  meal_allergy_list     jsonb not null default '[]'::jsonb,
  large_luggage         integer not null default 0,
  -- {amount, currency, handling, note}. NULL means no cash is carried, which is
  -- the common case; a zero-amount row would be exactly the sentinel BK-01 is
  -- trying to delete.
  cash_on_tour          jsonb,

  -- {method, netDays, source, contractVersion} frozen at create. jsonb rather
  -- than four columns because it is a point-in-time copy of the agent's
  -- contract terms: nothing joins on it, and re-shaping contract terms must not
  -- require migrating historical bookings.
  payment_snapshot      jsonb not null default '{}'::jsonb,
  -- {market, sub, agentId, at} frozen at create, for the same reason. Demand
  -- reporting reads this, never the agent's market as it stands today.
  market_snapshot       jsonb,

  price_mode            text not null default 'rate',
  -- Set only when price_mode = 'manual'; the operator-typed override.
  manual_total          numeric(12, 2),

  status                text not null,
  -- Soft "missing but not blocking" flags: 'pickup', 'guide-lang',
  -- 'route-closed'. A real array so the UI badge is a containment test rather
  -- than a LIKE over a comma-joined string.
  incomplete            text[] not null default '{}'::text[],

  -- Staff & Welfare bookings ride the same table; 'sale' is a real customer.
  purpose               text not null default 'sale',
  staff_id              text,
  staff_purpose         text,

  confirmed_by          text,
  confirmed_at          timestamptz,

  invoice_id            text,
  payment_status        text,

  cancel_category       text,

  -- Rebooking is a pointer between two bookings, not a child collection: at
  -- most one predecessor and one successor, so it stays inline rather than
  -- becoming a table with a permanent single row.
  rebook_from_code      text,
  rebook_to_code        text,
  rebook_reason         text,
  rebook_at             timestamptz,

  -- Cached Tesseract pre-check results. Opaque to the API.
  doc_check             jsonb,
  -- Two distinct free-text fields exist in production (`notes` = the internal
  -- ops note, `note` = the line printed on the voucher). Merging them is a data
  -- decision for BK-04, not a schema decision, so both survive the move.
  notes                 text,
  note                  text,

  constraint booking_status_ck check (status in (
    'quote', 'pending_foc', 'pending_approval', 'confirmed',
    'cancelled', 'cancelled_weather', 'rejected', 'completed'
  )),
  constraint booking_source_system_ck check (source_system in ('ops', 'b2c', 'erp', 'agent')),
  constraint booking_lead_type_ck check (
    lead_type is null or lead_type in ('AD', 'CHD', 'INF', 'FOC')
  ),
  -- 'NT' is normalised to 'NoTransfer' at migration time; two spellings of one
  -- zone was a live source of mis-grouped pickup lists.
  constraint booking_pickup_zone_ck check (
    pickup_zone is null or pickup_zone in ('PK', 'KL', 'NoTransfer')
  ),
  constraint booking_price_mode_ck check (price_mode in ('rate', 'manual')),
  constraint booking_manual_total_ck check (price_mode = 'manual' or manual_total is null),
  constraint booking_purpose_ck check (purpose in ('sale', 'staff_welfare', 'staff_inspection')),
  constraint booking_payment_status_ck check (payment_status is null or payment_status in (
    'unpaid', 'invoiced', 'partial', 'paid'
  )),
  constraint booking_schema_ver_ck check (schema_ver in (1, 2)),
  -- One-directional on purpose: a v1 row is always legacy, but the flag may also
  -- be set on a v2-shaped row that was imported read-only from elsewhere.
  constraint booking_legacy_v1_ck check (schema_ver <> 1 or legacy_v1),
  constraint booking_counts_nonneg_ck check (
    meal_veg >= 0 and meal_vegan >= 0 and meal_halal >= 0 and large_luggage >= 0
  )
);

comment on table operation_schemas.booking is
  'BK-01 aggregate root; replaces sb_bookings. Child collections are separate tables: empty means zero rows, never a sentinel.';
comment on column operation_schemas.booking.agent_id is
  'Intended FK -> agent(id). That table is not migrated yet; add the constraint when the sales domain lands.';
comment on column operation_schemas.booking.rate_type_id is
  'Intended FK -> rate_type(id) (RT-01). Unconstrained until that table exists and orphans are triaged in P0-09.';
comment on column operation_schemas.booking.sold_by is
  'Intended FK -> sales staff. NULL means "inherit agent.sales", which is not the same as unassigned.';
comment on column operation_schemas.booking.pickup_area_id is
  'Intended FK -> pickup_area(id). That table is not migrated yet.';
comment on column operation_schemas.booking.staff_id is
  'Intended FK -> staff(id). Set only when purpose is staff_welfare or staff_inspection.';
comment on column operation_schemas.booking.invoice_id is
  'Intended FK -> invoice(id) (accounting, Phase 7). Not constrained yet.';
comment on column operation_schemas.booking.rebook_from_code is
  'Intended self-FK -> booking(code). Left loose so a rebook chain can reference a v1 row that has not been backfilled yet.';

create index booking_booking_date_idx on operation_schemas.booking (booking_date);
create index booking_status_idx on operation_schemas.booking (status);
create index booking_agent_id_idx on operation_schemas.booking (agent_id) where agent_id is not null;
create index booking_created_at_idx on operation_schemas.booking (created_at desc);
create index booking_sold_by_idx on operation_schemas.booking (sold_by) where sold_by is not null;

-- A voucher reference identifies one live sale. Cancelled bookings are excluded
-- so re-issuing a voucher after a cancellation stays legal — that is the normal
-- recovery path when an agent re-sends a corrected voucher.
--
-- Scoped globally, per the BK-01 spec. If the BK-04 backfill turns up two
-- different agents legitimately reusing one voucher number, re-scope this to
-- (agent_id, voucher_ref) in a follow-up migration rather than dropping it.
create unique index booking_voucher_ref_active_uk
  on operation_schemas.booking (voucher_ref)
  where voucher_ref is not null
    and voucher_ref <> ''
    and status not in ('cancelled', 'cancelled_weather', 'rejected');
