-- 0010_rate-type-core
--
-- RT-01 · the `rate_type` aggregate root.
--
-- Forward-only. Once this has been applied anywhere, it is history:
-- correct it by writing the next migration, never by editing this file
-- (the runner checksums it and will refuse to continue).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Where these tables live
--
-- `operation_schemas` is the ops app's schema (133 tables in the P0-01
-- baseline). BK-01 reshapes the booking tables *in place* there, so the new
-- rate-type tables belong there too rather than in a parallel schema — a
-- cross-schema FK from `booking.rate_type_id` would work but buys nothing.
--
-- The legacy blob-projection tables are named `sb_rate_types__*`, so the new
-- singular names (`rate_type`, `rate_type_seat_rate`, …) cannot collide with
-- them and the two can coexist until the monolith is deleted at Phase 8.
--
-- The schema guard exists so this migration can also replay from an empty
-- database (README rule 3) without the P0-01 baseline having been applied.
create schema if not exists operation_schemas;

-- ─────────────────────────────────────────────────────────────────────────────
-- Zones and pax types are CHECK constraints, not Postgres enums.
--
-- Two migration streams are being written in parallel against this directory:
-- BK-01 owns 0001–0009 and also needs a pax-type vocabulary for
-- `booking_trip_pax`. A shared `create type pax_type as enum (...)` would make
-- whichever stream is applied second fail outright, and `alter type ... add
-- value` cannot run inside the runner's per-migration transaction. CHECK
-- constraints give the same guarantee, are per-table, and are cheap to widen.
--
-- Zone vocabulary (exact strings — the monolith stores these verbatim as
-- `seatRates[route][zone]` keys):
--   PK         Phuket pickup
--   KL         Khao Lak pickup
--   NoTransfer guest arrives at the pier under their own steam
--
-- Pax vocabulary: the monolith's keys are 'adult-thai' / 'adult-fr' / … where
-- `fr` means *foreigner* (farang), NOT "free" and NOT France. Renamed to
-- `_foreign` here because `fr` has burned readers of this data before.

-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists operation_schemas.rate_type (
  -- Surrogate PK, per the BK-01 convention (business code as a natural key
  -- PLUS a surrogate). The blob store's `rt001` ids are an import detail and
  -- are kept in `legacy_id`, not promoted to the primary key.
  id            uuid primary key default gen_random_uuid(),

  -- Business code shown to staff and printed on contracts, e.g. 'RT-RU-STD'.
  code          text        not null,
  name          text        not null,
  note          text,

  -- UI accent for the rate-type card. Cosmetic, carried over so a round-trip
  -- through the new API does not silently drop it.
  color         text,

  active        boolean     not null default true,

  -- Rate-type-level validity is LEGACY and only a fallback. The source of
  -- truth for "is this rate type sellable for route R on date D" is
  -- `rate_type_route_validity` (migration 0011). Two fields disagreeing is a
  -- documented monolith gotcha (RATE_TYPE.md §9); readers must prefer the
  -- per-route row and fall back here only when no per-route row exists.
  valid_from    date,
  valid_to      date,

  -- The blob store's id ('rt001'). Unique so the backfill is re-runnable and
  -- so `agent.rateTypeId` can still be resolved during the strangle.
  legacy_id     text,

  created_on    date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint rate_type_code_not_blank check (length(btrim(code)) > 0),
  constraint rate_type_name_not_blank check (length(btrim(name)) > 0),
  -- Open-ended on either side is legitimate: seeded rate types ship with
  -- validFrom:'' / validTo:''.
  constraint rate_type_valid_range check (
    valid_from is null or valid_to is null or valid_to >= valid_from
  )
);

create unique index if not exists rate_type_code_key
  on operation_schemas.rate_type (code);

create unique index if not exists rate_type_legacy_id_key
  on operation_schemas.rate_type (legacy_id)
  where legacy_id is not null;

-- The list endpoint's default ordering and its only filter.
create index if not exists rate_type_active_code_idx
  on operation_schemas.rate_type (active, code);

comment on table operation_schemas.rate_type is
  'RT-01 · reusable B2B price package. Agents bind to one via agent.rate_type_id.';
comment on column operation_schemas.rate_type.valid_from is
  'LEGACY fallback only. rate_type_route_validity is the source of truth per route.';
comment on column operation_schemas.rate_type.valid_to is
  'LEGACY fallback only. rate_type_route_validity is the source of truth per route.';
comment on column operation_schemas.rate_type.legacy_id is
  'Blob-store id (rt001). Drop once nothing references the monolith ids (Phase 8).';
