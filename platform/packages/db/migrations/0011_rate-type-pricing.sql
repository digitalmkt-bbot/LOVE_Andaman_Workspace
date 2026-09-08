-- 0011_rate-type-pricing
--
-- RT-01 · everything a rate type prices: seat rates, per-route validity,
-- forced bundles, charter rates and optional add-ons.
--
-- Forward-only. Once this has been applied anywhere, it is history:
-- correct it by writing the next migration, never by editing this file.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- `route_id` is text, and there is no foreign key yet.
--
-- The `route` table does not exist in the new model — ROUTE-01 has not been
-- written. Every store in the system identifies a route by its business code
-- ('r5', 'r10', 'r12'), which is what the blob holds and what the backfill in
-- 0013 copies, so `text` is the correct type for the values that exist today.
--
--   INTENDED FK: route_id -> route(code), added by a follow-up migration when
--   ROUTE-01 creates that table. Do NOT invent the table here — guessing its
--   key would force a retype of six columns later.
--
-- Money is numeric(12,2). The monolith stores integer THB, but a numeric costs
-- nothing here and keeps a future 2-decimal currency (or a percentage-derived
-- net rate) from silently truncating.
-- ─────────────────────────────────────────────────────────────────────────────


-- §1 Seat rates · route × zone × pax type ------------------------------------
create table if not exists operation_schemas.rate_type_seat_rate (
  rate_type_id uuid not null
    references operation_schemas.rate_type (id) on delete cascade,
  route_id     text          not null,
  zone         text          not null,
  pax_type     text          not null,
  price        numeric(12,2) not null,

  primary key (rate_type_id, route_id, zone, pax_type),

  constraint rate_type_seat_rate_zone_known check (
    zone in ('PK', 'KL', 'NoTransfer')
  ),
  constraint rate_type_seat_rate_pax_type_known check (
    pax_type in (
      'adult_thai', 'adult_foreign',
      'child_thai', 'child_foreign',
      'infant_thai', 'infant_foreign'
    )
  ),
  -- 0 is legitimate (infants normally ride free); negative is not.
  constraint rate_type_seat_rate_price_non_negative check (price >= 0)
);

comment on table operation_schemas.rate_type_seat_rate is
  'RT-01 · one row per route x zone x pax type. Replaces the nested seatRates blob.';
comment on column operation_schemas.rate_type_seat_rate.route_id is
  'Route business code (r5, r12). INTENDED FK -> route(code) once ROUTE-01 lands.';
comment on column operation_schemas.rate_type_seat_rate.pax_type is
  'The monolith writes adult-fr / child-fr where "fr" means FOREIGNER (farang), not free.';


-- §2 Per-route validity · THE source of truth for the active period ----------
create table if not exists operation_schemas.rate_type_route_validity (
  rate_type_id uuid not null
    references operation_schemas.rate_type (id) on delete cascade,
  route_id     text not null,

  -- Nullable = open-ended on that side. The blob stores '' for "no bound",
  -- which must not become 1970-01-01.
  valid_from   date,
  valid_to     date,

  primary key (rate_type_id, route_id),

  constraint rate_type_route_validity_range check (
    valid_from is null or valid_to is null or valid_to >= valid_from
  )
);

comment on table operation_schemas.rate_type_route_validity is
  'RT-01 · SOURCE OF TRUTH for the active period of a rate type on a route. Charter rates and add-ons inherit these dates; rate_type.valid_from/valid_to is a legacy fallback used only when a route has no row here.';


-- §3 Forced bundle · baked into the seat price -------------------------------
--
-- A bundle is NOT an optional add-on: the agent cannot opt out, and the price
-- (when mode='paid') is added to the seat total automatically. Whale Shark
-- including a free longtail transfer is the canonical case.
create table if not exists operation_schemas.rate_type_route_bundle (
  rate_type_id uuid not null
    references operation_schemas.rate_type (id) on delete cascade,
  route_id     text not null,

  -- The add-on being forced. Only 'longtail' exists today; keyed rather than
  -- hardcoded so a second forced bundle does not need a new table.
  addon_key    text not null default 'longtail',

  -- free = bundled at no surcharge, invoice prints "(incl. Longtail Join)"
  -- paid = adult_price x adults + child_price x children added to the seat total
  mode         text          not null,
  adult_price  numeric(12,2) not null default 0,
  child_price  numeric(12,2) not null default 0,

  -- Which booking modes the bundle applies to. Mirrors the monolith's
  -- `_rtBundleAppliesTo` (routeBundles[r].longtail.applyTo, default 'seat');
  -- BK-09 needs it or every charter trip silently inherits a seat-only bundle.
  apply_to     text not null default 'seat',

  primary key (rate_type_id, route_id, addon_key),

  constraint rate_type_route_bundle_mode_known check (mode in ('free', 'paid')),
  constraint rate_type_route_bundle_apply_to_known check (
    apply_to in ('seat', 'charter', 'both')
  ),
  constraint rate_type_route_bundle_price_non_negative check (
    adult_price >= 0 and child_price >= 0
  ),
  -- 'free' with a price attached is the shape that produces a surcharge nobody
  -- can see in the UI, so it is rejected rather than normalised at read time.
  constraint rate_type_route_bundle_free_is_free check (
    mode <> 'free' or (adult_price = 0 and child_price = 0)
  )
);

comment on table operation_schemas.rate_type_route_bundle is
  'RT-01 · forced add-on baked into the seat price. Not opt-out-able, unlike rate_type_addon.';


-- §4 Charter rates · starter + marginal --------------------------------------
create table if not exists operation_schemas.rate_type_charter_rate (
  rate_type_id     uuid not null
    references operation_schemas.rate_type (id) on delete cascade,
  route_id         text not null,

  -- Lower-cased boat type ('speedboat', 'catamaran'). Deliberately unconstrained:
  -- the fleet's type vocabulary lives on the boats and is open-ended, and the
  -- monolith matches it with `(boat.type || '').toLowerCase()`.
  --   INTENDED FK: boat_type -> the fleet's boat type vocabulary, once the
  --   fleet phase creates a table for it. There is no `boat` table yet.
  boat_type        text not null,

  starter_price    numeric(12,2) not null,
  -- Pax included in starter_price. `extra_per_pax` applies only ABOVE this
  -- count — it is marginal, not a per-head rate for the whole boat. Getting
  -- that backwards is listed as a gotcha in RATE_TYPE.md §9.
  starter_includes integer       not null default 0,
  extra_per_pax    numeric(12,2) not null default 0,

  primary key (rate_type_id, route_id, boat_type),

  constraint rate_type_charter_rate_non_negative check (
    starter_price >= 0 and starter_includes >= 0 and extra_per_pax >= 0
  )
);

comment on column operation_schemas.rate_type_charter_rate.extra_per_pax is
  'Marginal price per pax ABOVE starter_includes, not a per-head rate for the boat.';


-- §5 Optional add-ons · ALWAYS per route -------------------------------------
--
-- NORMALISATION (RT-01 acceptance criterion).
--
-- The monolith's `addOns.longtail` has two historical shapes and
-- `_rtNormalizeLongtail` reconciles them on every read:
--   old flat:  { applies:[rIds], adult, child }              -- one price, all routes
--   old flat:  { applies:[rIds], join:{}, charter:{} }       -- one price, all routes
--   current:   { applies:[rIds], byRoute:{ rId:{join,charter} } }
--
-- `route_id` is NOT NULL here, so the flat shape is simply not expressible in
-- this schema. Normalisation therefore cannot be forgotten by a later writer:
-- there is nowhere to put a route-less price. 0013 spreads a legacy flat price
-- across its `applies[]` routes exactly as `_rtNormalizeLongtail` does.
create table if not exists operation_schemas.rate_type_addon (
  -- Surrogate key: `zone` is legitimately null for add-ons that are not priced
  -- per pickup zone (longtail), and a nullable column cannot sit in a primary
  -- key. Uniqueness is enforced by the expression index below instead.
  id           uuid primary key default gen_random_uuid(),

  rate_type_id uuid not null
    references operation_schemas.rate_type (id) on delete cascade,

  -- 'longtail' | 'privateTransfer' | any UI-created SB_ADDON_TYPES key.
  -- Open by design: RT_ADDON_DEFS is data-driven in the monolith and staff can
  -- create new add-on types without a code change.
  addon_key    text not null,

  -- NOT NULL. This is what makes the old flat longtail shape unrepresentable.
  route_id     text not null,

  -- Only for zone-priced add-ons (privateTransfer). Null for longtail.
  zone         text,

  -- Which flavour of the add-on this row prices:
  --   longtail        -> 'join' (per pax) | 'charter' (per boat)
  --   privateTransfer -> 'sedan' | 'van'
  --   custom types    -> 'default'
  variant      text not null,

  -- Per-pax pricing (longtail join, custom per-pax add-ons).
  adult_price  numeric(12,2),
  child_price  numeric(12,2),
  -- Flat pricing where there is no adult/child split (longtail charter per
  -- boat, a transfer vehicle per trip, custom flat add-ons).
  unit_price   numeric(12,2),
  -- Seats on the chartered unit, where the flat price buys a whole vehicle.
  capacity     integer,
  -- Human-facing unit label: 'per pax' | 'per trip' | 'per boat'.
  unit         text,

  constraint rate_type_addon_zone_known check (
    zone is null or zone in ('PK', 'KL', 'NoTransfer')
  ),
  constraint rate_type_addon_variant_not_blank check (length(btrim(variant)) > 0),
  constraint rate_type_addon_non_negative check (
    coalesce(adult_price, 0) >= 0
    and coalesce(child_price, 0) >= 0
    and coalesce(unit_price, 0) >= 0
    and coalesce(capacity, 0) >= 0
  ),
  -- A row that prices nothing is a migration bug, not data.
  constraint rate_type_addon_has_a_price check (
    adult_price is not null or child_price is not null or unit_price is not null
  )
);

-- coalesce() because `zone` is nullable; a plain unique constraint would let
-- two zone-less rows for the same (rate type, add-on, route, variant) coexist.
create unique index if not exists rate_type_addon_uniq
  on operation_schemas.rate_type_addon
     (rate_type_id, addon_key, route_id, coalesce(zone, ''), variant);

create index if not exists rate_type_addon_lookup_idx
  on operation_schemas.rate_type_addon (rate_type_id, route_id);

comment on table operation_schemas.rate_type_addon is
  'RT-01 · optional (opt-out-able) add-ons, ALWAYS per route. route_id is NOT NULL so the pre-2026-06-13 flat longtail shape cannot be represented at all.';
