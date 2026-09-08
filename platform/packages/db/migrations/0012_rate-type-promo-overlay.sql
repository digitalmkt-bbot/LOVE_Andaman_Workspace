-- 0012_rate-type-promo-overlay
--
-- Forward-only. Once this has been applied anywhere, it is history:
-- correct it by writing the next migration, never by editing this file.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHY THIS TABLE EXISTS — an audit gap in the RT-01 spec.
--
-- BK-09 (pricing) is specified to port "promo overlay resolution". In the
-- monolith that is `bkV2ResolveRateType()` / `bkV2GetRTForTrip()`, which read
-- promos out of `SB_CONTRACTS` filtered by `kind === 'promo'`:
--
--   { agentId, kind:'promo', rateTypeId, activeFrom, activeTo, priority,
--     status, programPeriods:[{ routeId, bookFrom, bookTo, travelFrom, travelTo }] }
--
-- RT-01's table list (rate_type, seat_rate, route_validity, route_bundle,
-- charter_rate, addon) has no contracts or promo table at all, so as written
-- BK-09 had an unmet dependency: there would be nowhere to read a promo from
-- and "promo overlay resolution" could not be ported. This migration was added
-- to close that gap.
--
-- Scope is deliberately narrow: this models the *price overlay* only, not the
-- full `SB_CONTRACTS` aggregate (documents, versions, signatures, renewals).
-- The rest of the contract domain belongs to the sales phase.
--
-- Semantics BK-09 must reproduce exactly:
--   1. A promo applies to (agent, route, travel date) when the promo's own
--      active window covers the travel date AND a per-route row's travel
--      window covers it too. Both bounds are inclusive; a null bound is open.
--   2. Selection is by highest `priority`, then latest `active_from`.
--   3. Statuses 'void', 'cancelled' and 'expired' are ignored.
--   4. The overlay is applied per TRIP, not per booking — a multi-trip booking
--      can price one trip on a promo and the next on the base rate.
--   5. The monolith only adopts the promo rate if it actually prices the route
--      (a seat rate or a charter rate exists); otherwise it keeps the base
--      rate. That defensive check must survive the port.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists operation_schemas.rate_type_promo (
  id                 uuid primary key default gen_random_uuid(),

  -- Which agent the promo is granted to.
  --
  -- text, because that is what the value is today: the blob store's agent id
  -- ('ag001'), and there is no `agent` table in the new model yet.
  --   INTENDED FK: agent_id -> agent(legacy_id), retyped to uuid and pointed at
  --   agent(id) by a follow-up migration once BK-01's agent table exists.
  agent_id           text not null,

  -- The rate type the overlay swaps IN. This is a real FK because
  -- `rate_type` is created by 0010 in this same stream.
  promo_rate_type_id uuid not null
    references operation_schemas.rate_type (id) on delete cascade,

  -- Higher wins. The monolith defaults new promos to 10.
  priority           integer not null default 10,

  status             text not null default 'active',

  -- Promo-level window, by TRAVEL date. Null = open-ended on that side.
  active_from        date,
  active_to          date,

  note               text,
  -- SB_CONTRACTS.id of the promo this row came from, so a re-run of any
  -- backfill is idempotent and the strangle can trace a price back.
  legacy_contract_id text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint rate_type_promo_status_known check (
    status in ('active', 'void', 'cancelled', 'expired')
  ),
  constraint rate_type_promo_range check (
    active_from is null or active_to is null or active_to >= active_from
  )
);

create unique index if not exists rate_type_promo_legacy_contract_id_key
  on operation_schemas.rate_type_promo (legacy_contract_id)
  where legacy_contract_id is not null;

-- The exact lookup `bkV2ResolveRateType(agentId, routeId, travelDate)` makes.
create index if not exists rate_type_promo_agent_window_idx
  on operation_schemas.rate_type_promo (agent_id, status, active_from, active_to);


-- Per-route windows. Separate table because priority/status/active window are
-- properties of the promo, and repeating them on every route row would let the
-- same promo claim two different priorities.
create table if not exists operation_schemas.rate_type_promo_route (
  promo_id    uuid not null
    references operation_schemas.rate_type_promo (id) on delete cascade,

  -- Route business code. INTENDED FK -> route(code) once ROUTE-01 lands.
  route_id    text not null,

  -- The monolith keeps booking-date and travel-date windows separately: a
  -- promo can be bookable in March for travel in July. `bkV2ResolveRateType`
  -- filters on the TRAVEL window; the booking window gates whether the promo
  -- may be applied to a new booking at all. Both are kept so BK-09 does not
  -- have to guess which one it lost.
  book_from   date,
  book_to     date,
  travel_from date,
  travel_to   date,

  primary key (promo_id, route_id),

  constraint rate_type_promo_route_book_range check (
    book_from is null or book_to is null or book_to >= book_from
  ),
  constraint rate_type_promo_route_travel_range check (
    travel_from is null or travel_to is null or travel_to >= travel_from
  )
);

comment on table operation_schemas.rate_type_promo is
  'Per-agent, date-bounded price overlay: swaps in a different rate type for matching trips. Added by RT-01 to close a BK-09 dependency that the RT-01 table list had missed.';
comment on table operation_schemas.rate_type_promo_route is
  'Per-route date windows for a promo. Travel window gates pricing; booking window gates whether the promo can be attached to a new booking.';
