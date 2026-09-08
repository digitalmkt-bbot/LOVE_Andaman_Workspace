-- 0002_booking-trip
--
-- Forward-only. Once this has been applied anywhere, it is history:
-- correct it by writing the next migration, never by editing this file.
--
-- BK-01 · trips, per-trip pax counts, and named passengers.

create table operation_schemas.booking_trip (
  id                        uuid primary key default gen_random_uuid(),
  booking_id                uuid not null
                              references operation_schemas.booking (id) on delete cascade,
  -- Position within the booking. Load order carried meaning in the blob (day 1,
  -- day 2, ...) and several ops screens still address a trip by index, so it is
  -- stored rather than inferred from a sort.
  trip_index                smallint not null,

  route_id                  text not null,
  trip_date                 date not null,
  zone                      text,
  -- A window like '06:00-06:15', not a clock time — the van picks up inside a
  -- range. Kept as text because it is never arithmetic.
  pickup_time               text,

  booking_mode              text not null,
  charter_boat_id           text,
  charter_price_mode        text not null default 'rate',
  charter_price_manual      numeric(12, 2) not null default 0,
  charter_price_note        text,
  -- The operator ticked "yes, I know this charter displaces seat sales".
  charter_displacement_ack  boolean not null default false,

  -- Overnight / island-stay metadata. `ovn` names the package.
  ovn                       text,
  ovn_return_date           date,
  ovn_charge                numeric(12, 2) not null default 0,
  -- True on the generated return leg of an overnight, so the pool counts the
  -- guest once and the manifest still shows both days.
  ovn_leg                   boolean not null default false,
  -- Which trip this leg belongs to, by trip_index. The blob stored `number |
  -- string | null` and the mapper wrote it as text; BK-04 resolves the string
  -- form to an index and leaves anything unresolvable NULL rather than guessing.
  ovn_of_trip_index         smallint,

  -- How the seats were sourced. The authoritative per-lock breakdown is
  -- booking_trip_lock_draw (BK-02); these two are the summary the manifest
  -- reads, and BK-02's derived view is what reconciles them.
  seat_source_locked        integer not null default 0,
  seat_source_general       integer not null default 0,

  subtotal                  numeric(12, 2) not null default 0,

  constraint booking_trip_booking_index_uk unique (booking_id, trip_index),
  constraint booking_trip_index_nonneg_ck check (trip_index >= 0),
  constraint booking_trip_mode_ck check (booking_mode in ('seat', 'charter')),
  constraint booking_trip_zone_ck check (zone is null or zone in ('PK', 'KL', 'NoTransfer')),
  constraint booking_trip_charter_price_mode_ck check (charter_price_mode in ('rate', 'manual')),
  -- The spec's headline constraint: a charter with no boat is not a charter,
  -- it is a silent hole in the day's capacity plan.
  constraint booking_trip_charter_boat_ck check (
    booking_mode <> 'charter' or charter_boat_id is not null
  ),
  constraint booking_trip_ovn_of_ck check (ovn_of_trip_index is null or ovn_of_trip_index >= 0),
  constraint booking_trip_seat_source_nonneg_ck check (
    seat_source_locked >= 0 and seat_source_general >= 0
  )
);

comment on table operation_schemas.booking_trip is
  'One route-day line of a booking. (booking_id, trip_index) is the stable handle ops screens address a trip by.';
comment on column operation_schemas.booking_trip.route_id is
  'Intended FK -> route(id). That table is not migrated yet.';
comment on column operation_schemas.booking_trip.charter_boat_id is
  'Intended FK -> boat(id). That table is not migrated yet.';

-- The mirror rule "a seat trip carries no charter boat" is NOT a constraint:
-- switching a trip from charter back to seat leaves a stale charter_boat_id on
-- real historical rows, and a CHECK would fail the BK-04 backfill on them. The
-- write path clears it; a reconciliation report finds the survivors.

-- No separate (booking_id) index anywhere in this schema: every child table has
-- a UNIQUE whose leading column is booking_id, and Postgres uses that index for
-- a booking_id-only lookup. A second one would only cost write amplification.
--
-- The manifest query: "everyone on route R on date D". Date first because every
-- ops screen is a day view.
create index booking_trip_date_route_idx on operation_schemas.booking_trip (trip_date, route_id);
create index booking_trip_charter_boat_idx
  on operation_schemas.booking_trip (charter_boat_id, trip_date)
  where charter_boat_id is not null;

-- Replaces the 12-key `pax{}` object, and with it the legacy `ad` / `ad_fr`
-- dual shape: an unsuffixed legacy count is folded into nationality_class 'FR'
-- (the v1 default) at migration time and the ambiguity ends there.
--
-- Rows are sparse by design. No row for (trip, CHD, TH) means zero children of
-- Thai rate; the old shape had to carry twelve keys to say the same thing.
create table operation_schemas.booking_trip_pax (
  booking_trip_id     uuid not null
                        references operation_schemas.booking_trip (id) on delete cascade,
  pax_kind            text not null,
  -- Which rate class the head is counted at: 'FR' foreign, 'TH' Thai. It drives
  -- price, not nationality on the passport — a Thai-resident foreigner can be
  -- sold at TH rates.
  nationality_class   text not null,
  qty                 integer not null default 0,

  primary key (booking_trip_id, pax_kind, nationality_class),
  constraint booking_trip_pax_kind_ck check (pax_kind in ('AD', 'CHD', 'INF', 'FOC')),
  constraint booking_trip_pax_class_ck check (nationality_class in ('FR', 'TH')),
  constraint booking_trip_pax_qty_ck check (qty >= 0)
);

comment on table operation_schemas.booking_trip_pax is
  'One row per (pax kind, rate class) per trip. Absent row = zero. Replaces the 12-key pax object and the ad/ad_fr dual shape.';

create table operation_schemas.booking_passenger (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid not null references operation_schemas.booking (id) on delete cascade,
  seq            smallint not null,
  name           text not null,
  nationality    text,
  pax_kind       text not null default 'AD',
  is_foc         boolean not null default false,
  -- The lead is the person on the voucher and the phone number the driver
  -- calls. In the blob it lived in six lead* fields on the booking; here it is
  -- one flagged row so the manifest is a single list.
  is_lead        boolean not null default false,

  constraint booking_passenger_seq_uk unique (booking_id, seq),
  constraint booking_passenger_seq_nonneg_ck check (seq >= 0),
  constraint booking_passenger_kind_ck check (pax_kind in ('AD', 'CHD', 'INF', 'FOC'))
);

-- At most one lead per booking. A booking with none is legal: agent bookings
-- routinely arrive with a group name and no named passengers at all.
create unique index booking_passenger_one_lead_uk
  on operation_schemas.booking_passenger (booking_id)
  where is_lead;
