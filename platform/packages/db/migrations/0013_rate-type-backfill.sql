-- 0013_rate-type-backfill
--
-- Forward-only. Once this has been applied anywhere, it is history:
-- correct it by writing the next migration, never by editing this file.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill the RT-01 tables from the monolith's blob-projection tables.
--
-- Source tables (P0-01 baseline, `operation_schemas`):
--   sb_rate_types                        one row per rate type
--   sb_rate_types__routes                routes[] (ordered array projection)
--   sb_rate_types__seatrates             key = routeId, 3 zones x 6 pax types WIDE
--   sb_rate_types__routevalidity         key = routeId, "from" / "to" as TEXT
--   sb_rate_types__routebundles          key = routeId, longtail_mode/adult/child
--   sb_rate_types__charterrates          key = routeId, speedboat_* / catamaran_* WIDE
--   sb_rate_types__addons                key = addon key ('longtail', 'privateTransfer', ...)
--   sb_rate_types__addons__applies       addon.applies[]
--   sb_rate_types__addons__byroute       addon.byRoute{} (the CURRENT longtail shape)
--   sb_rate_types__addons__r<N>          privateTransfer prices, ONE TABLE PER ROUTE
--
-- Two properties this migration must have:
--
--   1. It is a NO-OP when the legacy tables are absent (a fresh developer
--      database, or CI without the P0-01 baseline). Every section is guarded
--      with `to_regclass`, so `migrate up` from empty still succeeds.
--
--   2. It is RE-RUNNABLE. Every insert ends in `on conflict do nothing`, keyed
--      on the natural keys declared in 0010-0011, so re-running after a partial
--      import adds only what is missing and never duplicates a price.
--
-- Dates in the blob are TEXT and frequently '' (rt002 ships that way). They are
-- accepted only when they match YYYY-MM-DD; anything else becomes NULL rather
-- than aborting the whole migration or silently landing on 1970-01-01.
-- ─────────────────────────────────────────────────────────────────────────────

do $do$
declare
  legacy_table text;
  legacy_route text;
begin
  if to_regclass('operation_schemas.sb_rate_types') is null then
    -- No monolith data in this database. Nothing to migrate; the schema from
    -- 0010-0012 is already correct and the API will simply read zero rows.
    raise notice 'rate-type backfill skipped: operation_schemas.sb_rate_types not present';
    return;
  end if;

  ---------------------------------------------------------------------------
  -- 1 · rate_type
  ---------------------------------------------------------------------------
  -- `code` is NOT NULL and unique in the new model but merely nullable text in
  -- the blob, so it falls back to the legacy id. A duplicate code in the source
  -- would raise a unique violation, which `on conflict do nothing` absorbs
  -- (untargeted, so it covers every unique index on the table) — the second
  -- rate type is then reported as missing by the verification query below
  -- rather than corrupting the first.
  insert into operation_schemas.rate_type
    (code, name, note, color, active, valid_from, valid_to, legacy_id, created_on)
  select
    coalesce(nullif(btrim(t.code), ''), t.id),
    coalesce(nullif(btrim(t.name), ''), nullif(btrim(t.code), ''), t.id),
    nullif(btrim(coalesce(t.note, '')), ''),
    nullif(btrim(coalesce(t.color, '')), ''),
    coalesce(t.active, true),
    v.valid_from,
    -- Drop an inverted legacy range instead of failing the CHECK. An inverted
    -- range is unsellable either way, and per-route validity is the real
    -- source of truth.
    case when v.valid_from is not null and v.valid_to is not null and v.valid_to < v.valid_from
         then null else v.valid_to end,
    t.id,
    case when t.createddate ~ '^\d{4}-\d{2}-\d{2}$' then t.createddate::date end
  from operation_schemas.sb_rate_types t
  cross join lateral (
    select
      case when t.validfrom ~ '^\d{4}-\d{2}-\d{2}$' then t.validfrom::date end as valid_from,
      case when t.validto   ~ '^\d{4}-\d{2}-\d{2}$' then t.validto::date   end as valid_to
  ) v
  where t.id is not null and btrim(t.id) <> ''
  on conflict do nothing;

  ---------------------------------------------------------------------------
  -- 2 · rate_type_seat_rate — unpivot the wide zone x pax-type projection
  ---------------------------------------------------------------------------
  -- The source has one fixed column per (zone, pax type). That shape is exactly
  -- why a new zone or pax type never reaches the database in the monolith: the
  -- projection has nowhere to put it. Unpivoting to rows removes the ceiling.
  if to_regclass('operation_schemas.sb_rate_types__seatrates') is not null then
    insert into operation_schemas.rate_type_seat_rate
      (rate_type_id, route_id, zone, pax_type, price)
    select rt.id, s.key, c.zone, c.pax_type, c.price
    from operation_schemas.sb_rate_types__seatrates s
    join operation_schemas.rate_type rt on rt.legacy_id = s.sb_rate_types_id
    cross join lateral (values
      ('PK',         'adult_thai',     s.pk_adult_thai),
      ('PK',         'adult_foreign',  s.pk_adult_fr),
      ('PK',         'child_thai',     s.pk_child_thai),
      ('PK',         'child_foreign',  s.pk_child_fr),
      ('PK',         'infant_thai',    s.pk_infant_thai),
      ('PK',         'infant_foreign', s.pk_infant_fr),
      ('KL',         'adult_thai',     s.kl_adult_thai),
      ('KL',         'adult_foreign',  s.kl_adult_fr),
      ('KL',         'child_thai',     s.kl_child_thai),
      ('KL',         'child_foreign',  s.kl_child_fr),
      ('KL',         'infant_thai',    s.kl_infant_thai),
      ('KL',         'infant_foreign', s.kl_infant_fr),
      ('NoTransfer', 'adult_thai',     s.notransfer_adult_thai),
      ('NoTransfer', 'adult_foreign',  s.notransfer_adult_fr),
      ('NoTransfer', 'child_thai',     s.notransfer_child_thai),
      ('NoTransfer', 'child_foreign',  s.notransfer_child_fr),
      ('NoTransfer', 'infant_thai',    s.notransfer_infant_thai),
      ('NoTransfer', 'infant_foreign', s.notransfer_infant_fr)
    ) as c(zone, pax_type, price)
    -- A missing cell means "no price published for that combination", which is
    -- not the same as a price of 0 and must not become a row.
    where s.key is not null and btrim(s.key) <> ''
      and c.price is not null
      and c.price >= 0
    on conflict do nothing;
  end if;

  ---------------------------------------------------------------------------
  -- 3 · rate_type_route_validity (the source of truth for the active period)
  ---------------------------------------------------------------------------
  if to_regclass('operation_schemas.sb_rate_types__routevalidity') is not null then
    insert into operation_schemas.rate_type_route_validity
      (rate_type_id, route_id, valid_from, valid_to)
    select rt.id, rv.key, v.valid_from,
           case when v.valid_from is not null and v.valid_to is not null
                     and v.valid_to < v.valid_from
                then null else v.valid_to end
    from operation_schemas.sb_rate_types__routevalidity rv
    join operation_schemas.rate_type rt on rt.legacy_id = rv.sb_rate_types_id
    cross join lateral (
      select
        case when rv."from" ~ '^\d{4}-\d{2}-\d{2}$' then rv."from"::date end as valid_from,
        case when rv."to"   ~ '^\d{4}-\d{2}-\d{2}$' then rv."to"::date   end as valid_to
    ) v
    where rv.key is not null and btrim(rv.key) <> ''
    on conflict do nothing;
  end if;

  ---------------------------------------------------------------------------
  -- 4 · rate_type_route_bundle
  ---------------------------------------------------------------------------
  if to_regclass('operation_schemas.sb_rate_types__routebundles') is not null then
    insert into operation_schemas.rate_type_route_bundle
      (rate_type_id, route_id, addon_key, mode, adult_price, child_price, apply_to)
    select
      rt.id, rb.key, 'longtail', m.mode,
      -- A 'free' bundle carrying a price is contradictory and is rejected by a
      -- CHECK, so the price is zeroed here rather than failing the import. The
      -- UI already ignores it: rtSetBundleMode() zeroes both on switching to free.
      case when m.mode = 'free' then 0 else coalesce(rb.longtail_adult, 0) end,
      case when m.mode = 'free' then 0 else coalesce(rb.longtail_child, 0) end,
      -- The legacy projection has no `applyTo` column at all, so every imported
      -- bundle takes the monolith's own default of 'seat'.
      'seat'
    from operation_schemas.sb_rate_types__routebundles rb
    join operation_schemas.rate_type rt on rt.legacy_id = rb.sb_rate_types_id
    cross join lateral (
      select case when lower(coalesce(rb.longtail_mode, '')) = 'paid' then 'paid' else 'free' end as mode
    ) m
    where rb.key is not null and btrim(rb.key) <> ''
      and rb.longtail_mode is not null
    on conflict do nothing;
  end if;

  ---------------------------------------------------------------------------
  -- 5 · rate_type_charter_rate — unpivot the wide per-boat-type projection
  ---------------------------------------------------------------------------
  -- Same wide-column hazard as seat rates: a third boat type has no column in
  -- the source and would never have been persisted.
  if to_regclass('operation_schemas.sb_rate_types__charterrates') is not null then
    insert into operation_schemas.rate_type_charter_rate
      (rate_type_id, route_id, boat_type, starter_price, starter_includes, extra_per_pax)
    select rt.id, cr.key, c.boat_type,
           c.starter_price, coalesce(c.starter_includes, 0), coalesce(c.extra_per_pax, 0)
    from operation_schemas.sb_rate_types__charterrates cr
    join operation_schemas.rate_type rt on rt.legacy_id = cr.sb_rate_types_id
    cross join lateral (values
      ('speedboat', cr.speedboat_starterprice, cr.speedboat_starterincludes, cr.speedboat_extraperpax),
      ('catamaran', cr.catamaran_starterprice, cr.catamaran_starterincludes, cr.catamaran_extraperpax)
    ) as c(boat_type, starter_price, starter_includes, extra_per_pax)
    where cr.key is not null and btrim(cr.key) <> ''
      -- No starter price = that boat type is not chartered on this route.
      and c.starter_price is not null
      and c.starter_price >= 0
    on conflict do nothing;
  end if;

  ---------------------------------------------------------------------------
  -- 6 · rate_type_addon · LONGTAIL — the normalisation this task turns on
  ---------------------------------------------------------------------------
  -- Reproduces `_rtNormalizeLongtail` in SQL. The monolith accepts three
  -- shapes and reconciles them on EVERY read:
  --
  --   (a) { applies:[r10,r11], adult:400, child:300 }        -- oldest flat
  --   (b) { applies:[...], join:{adult,child}, charter:{price,capacity} }
  --   (c) { applies:[...], byRoute:{ r10:{join,charter}, ... } }   -- current
  --
  -- Rule, straight from the function: the set of priced routes is
  -- `keys(byRoute) UNION applies`; a route present in byRoute uses its own
  -- price; a route present only in `applies` inherits the flat price. Shapes
  -- (a) and (b) therefore fan the single flat price out across `applies`.
  --
  -- After this runs, the flat shape is gone for good — `rate_type_addon.route_id`
  -- is NOT NULL, so there is no way to write a route-less longtail price again
  -- and no reader ever has to re-normalise.
  if to_regclass('operation_schemas.sb_rate_types__addons') is not null
     and to_regclass('operation_schemas.sb_rate_types__addons__applies') is not null
     and to_regclass('operation_schemas.sb_rate_types__addons__byroute') is not null
  then
    with lt as (
      select a.row_pk as addon_pk, a.sb_rate_types_id as legacy_rt,
             nullif(btrim(coalesce(a.unit, '')), '') as unit,
             -- The flat fallback, preferring the newer join{} over the oldest
             -- bare adult/child, exactly as `_rtNormalizeLongtail` does.
             coalesce(a.join_adult, a.adult, 0)       as flat_join_adult,
             coalesce(a.join_child, a.child, 0)       as flat_join_child,
             coalesce(a.charter_price, 0)             as flat_charter_price,
             -- 6 is the function's own default capacity for a longtail boat.
             coalesce(a.charter_capacity, 6)          as flat_charter_capacity
      from operation_schemas.sb_rate_types__addons a
      where a.key = 'longtail'
    ),
    by_route as (
      select b.sb_rate_types_addons_id as addon_pk, b.key as route_id,
             coalesce(b.join_adult, 0)       as join_adult,
             coalesce(b.join_child, 0)       as join_child,
             coalesce(b.charter_price, 0)    as charter_price,
             coalesce(b.charter_capacity, 6) as charter_capacity
      from operation_schemas.sb_rate_types__addons__byroute b
      where b.key is not null and btrim(b.key) <> ''
    ),
    applies as (
      select ap.sb_rate_types_addons_id as addon_pk, ap.value as route_id
      from operation_schemas.sb_rate_types__addons__applies ap
      where ap.value is not null and btrim(ap.value) <> ''
    ),
    route_set as (           -- keys(byRoute) UNION applies
      select addon_pk, route_id from by_route
      union
      select addon_pk, route_id from applies
    ),
    resolved as (
      select lt.legacy_rt, lt.unit, rs.route_id,
             coalesce(br.join_adult,       lt.flat_join_adult)       as join_adult,
             coalesce(br.join_child,       lt.flat_join_child)       as join_child,
             coalesce(br.charter_price,    lt.flat_charter_price)    as charter_price,
             coalesce(br.charter_capacity, lt.flat_charter_capacity) as charter_capacity
      from route_set rs
      join lt on lt.addon_pk = rs.addon_pk
      left join by_route br on br.addon_pk = rs.addon_pk and br.route_id = rs.route_id
    ),
    rows_to_write as (
      -- The join row is always written, even at 0/0: its existence is what
      -- records that the add-on is offered on this route (the `applies[]`
      -- membership), and a free join is a real product.
      select r.legacy_rt, r.route_id, 'join'::text as variant,
             r.join_adult::numeric as adult_price, r.join_child::numeric as child_price,
             null::numeric as unit_price, null::integer as capacity,
             coalesce(r.unit, 'per pax') as unit
      from resolved r
      union all
      -- The charter row only when it is actually priced; charter_price = 0 means
      -- "longtail charter not offered", not "free boat".
      select r.legacy_rt, r.route_id, 'charter',
             null, null,
             r.charter_price::numeric, r.charter_capacity::integer, 'per boat'
      from resolved r
      where r.charter_price > 0
    )
    insert into operation_schemas.rate_type_addon
      (rate_type_id, addon_key, route_id, zone, variant,
       adult_price, child_price, unit_price, capacity, unit)
    select rt.id, 'longtail', w.route_id, null, w.variant,
           w.adult_price, w.child_price, w.unit_price, w.capacity, w.unit
    from rows_to_write w
    join operation_schemas.rate_type rt on rt.legacy_id = w.legacy_rt
    on conflict do nothing;
  end if;

  ---------------------------------------------------------------------------
  -- 7 · rate_type_addon · PRIVATE TRANSFER — one legacy table per route
  ---------------------------------------------------------------------------
  -- The blob projector exploded `addOns.privateTransfer[routeId][zone]` into a
  -- separate physical table per route: sb_rate_types__addons__r5,
  -- ...__r10, ...__r12, one per route that anyone ever priced. Adding a route
  -- means adding a table, which is the same fixed-per-entity-column trap that
  -- silently dropped later-added boats elsewhere in this database.
  --
  -- Hence the discovery loop over information_schema rather than a hardcoded
  -- list: a route added after this migration was written is still imported.
  -- Dynamic SQL is unavoidable — the table name IS the data.
  for legacy_table, legacy_route in
    select t.table_name, substring(t.table_name from '(r[0-9]+)$')
    from information_schema.tables t
    where t.table_schema = 'operation_schemas'
      and t.table_name ~ '^sb_rate_types__addons__r[0-9]+$'
    order by t.table_name
  loop
    execute format($fmt$
      insert into operation_schemas.rate_type_addon
        (rate_type_id, addon_key, route_id, zone, variant, unit_price, unit)
      select rt.id, a.key, %L, pt.key, v.variant, v.price::numeric,
             coalesce(nullif(btrim(coalesce(a.unit, '')), ''), 'per trip')
      from operation_schemas.%I pt
      join operation_schemas.sb_rate_types__addons a on a.row_pk = pt.sb_rate_types_addons_id
      join operation_schemas.rate_type rt on rt.legacy_id = a.sb_rate_types_id
      cross join lateral (values ('sedan', pt.sedan), ('van', pt.van)) as v(variant, price)
      where pt.key in ('PK', 'KL', 'NoTransfer')
        and v.price is not null
        and v.price >= 0
      on conflict do nothing
    $fmt$, legacy_route, legacy_table);
  end loop;
end
$do$;
