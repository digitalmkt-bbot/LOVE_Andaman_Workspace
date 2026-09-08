-- 0004_booking-ops
--
-- Forward-only. Once this has been applied anywhere, it is history:
-- correct it by writing the next migration, never by editing this file.
--
-- BK-01 · day-of operational assignment, and alternate pickup points.
--
-- THE STRUCTURAL FIX IN THIS FILE: the monolith stores day 1's boat/van
-- assignment on `bk.ops` and day 2+ on `trip.ops`, so every consumer has to
-- know the rule `i === 0 ? bk.ops : trip.ops` and half of them got it wrong at
-- least once. Here every service day gets exactly one row, keyed by
-- (booking_id, service_date). There is no day-1 special case left to forget.

create table operation_schemas.booking_ops (
  id                   uuid primary key default gen_random_uuid(),
  booking_id           uuid not null references operation_schemas.booking (id) on delete cascade,
  -- The calendar day being operated. Keyed on the date rather than the trip so
  -- a reschedule that moves a trip does not orphan the assignment, and so a
  -- day with two trips (an overnight's out and return legs) shares one van.
  service_date         date not null,

  boat_id              text,
  van_id               text,
  van_return_id        text,
  -- The return van is per-booking by design; the outbound van is shared across
  -- a van group. True means "reuse van_id for the return" and is what the job
  -- order prints when no separate return van was picked.
  return_same_van      boolean not null default false,
  -- Van group and the seat order within it. Group 0 / seq 0 means unassigned.
  van_group            integer,
  van_seq              integer,
  -- A booking whose party is split across more than one van. Array of
  -- {vanId, vanGroup, vanSeq}. Rare and read only by the job-order renderer,
  -- so it stays a document rather than a fourth level of tables.
  van_splits           jsonb not null default '[]'::jsonb,
  boat_splits          jsonb not null default '[]'::jsonb,

  -- The time the coordinator actually committed to, which may differ from the
  -- trip's advertised pickup window.
  pickup_time_final    text,
  -- {status, by, at, note} — the customer-reconfirmation call.
  reconfirm            jsonb,
  van_checkin          jsonb,
  pier_checkin         jsonb,
  pier_note            text,
  -- Daily PFM payload, owned by the finance module and opaque here.
  pfm                  jsonb not null default '{}'::jsonb,

  constraint booking_ops_day_uk unique (booking_id, service_date),
  constraint booking_ops_van_group_nonneg_ck check (van_group is null or van_group >= 0),
  constraint booking_ops_van_seq_nonneg_ck check (van_seq is null or van_seq >= 0)
);

-- Two van invariants are deliberately NOT constraints here:
--   * disband nulls both van_id and van_return_id;
--   * return_same_van and a distinct van_return_id are mutually exclusive.
-- Both are true of correctly-written rows, but neither holds across the live
-- history — a self-arrive guest (pickup_self) can have a return van and no
-- outbound one, and older rows set return_same_van alongside a redundant
-- van_return_id. Enforcing them here would fail the BK-04 backfill on real
-- bookings; they belong in the write path, where they can reject the operation
-- that would create the state rather than the migration of one that already did.

comment on table operation_schemas.booking_ops is
  'One row per service day. Replaces the bk.ops (day 1) / trip.ops (day 2+) split entirely.';
comment on column operation_schemas.booking_ops.boat_id is
  'Intended FK -> boat(id). That table is not migrated yet.';
comment on column operation_schemas.booking_ops.van_id is
  'Intended FK -> vehicle(id). That table is not migrated yet.';
comment on column operation_schemas.booking_ops.van_return_id is
  'Intended FK -> vehicle(id). Per-booking by design — never spread across a van group.';

-- The two loading queries: "who is on this boat today" and "who is in this van
-- today". Both are day-scoped, so service_date leads.
create index booking_ops_boat_day_idx
  on operation_schemas.booking_ops (service_date, boat_id)
  where boat_id is not null;
create index booking_ops_van_day_idx
  on operation_schemas.booking_ops (service_date, van_id)
  where van_id is not null;
create index booking_ops_van_group_idx
  on operation_schemas.booking_ops (service_date, van_group)
  where van_group is not null;

-- Part of the party is collected somewhere else — a different hotel, or the
-- airport. `qty` is the headcount and `pax` the per-kind split for the ones the
-- driver has to find at this address.
create table operation_schemas.booking_alt_pickup (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references operation_schemas.booking (id) on delete cascade,
  seq          smallint not null,
  who          text,
  qty          integer not null default 0,
  area_id      text,
  area         text,
  zone         text,
  place        text,
  -- {ad_fr, ad_th, chd_fr, ...}. Held as a document, not as rows in
  -- booking_trip_pax, because an alt pickup is a driver instruction rather than
  -- a priced quantity: nothing sums it into revenue or the seat pool.
  pax          jsonb not null default '{}'::jsonb,

  constraint booking_alt_pickup_seq_uk unique (booking_id, seq),
  constraint booking_alt_pickup_seq_nonneg_ck check (seq >= 0),
  constraint booking_alt_pickup_qty_nonneg_ck check (qty >= 0),
  constraint booking_alt_pickup_zone_ck check (zone is null or zone in ('PK', 'KL', 'NoTransfer'))
);

comment on column operation_schemas.booking_alt_pickup.area_id is
  'Intended FK -> pickup_area(id). That table is not migrated yet.';
