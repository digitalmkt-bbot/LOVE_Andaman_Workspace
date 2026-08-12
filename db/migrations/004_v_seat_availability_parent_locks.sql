-- 004_v_seat_availability_parent_locks.sql
--
-- Fixes: v_seat_availability.locked double-counts a seat-lock tree.
--
-- sb_seat_locks is a tree. A parent block is carved into named sub-holds via parentid/subname, and
-- the children's seats live INSIDE the parent's qty — creating a child does not touch the parent's
-- qty or used. The old `locks` CTE summed every active row flat, so a parent and its children were
-- both charged against the pool, and a child that had already turned into a real booking was charged
-- a third time through `booked`.
--
-- Live example, r10 / 2026-08-13 (verified 2026-08-12):
--   parent lkmsio2slk9bmdf (a01)  qty 19 used 0 active
--     children: Ferinida 2/2, Chicky 3/3, abus 1/1 (depleted — those seats are in `booked`)
--               Lookkade 2/0, Danny 4/0, Pony 3/0, Kignat 2/0, Bebe 2/0 (open), I Am Double 0/0
--   parent lkmsmwyzdwz4pfe (a21)  qty 4 used 2 active
--   old flat sum : 19 + 13 (open children) + 2 = 34   -> 65 - 33 - 34 < 0 -> available 0 -> STOP_SELL
--   correct      : 13 + 2                     = 15   -> 65 - 33 - 15   = 17 seats sellable
--
-- The formula below is the app's, not a new one. It is bkV2LockPoolHold / bkV2LockHeldRemaining
-- (allotment_v2.html:41177-41185) transcribed to SQL:
--
--   hold(parent)   = GREATEST(qty - own used - SUM(children.used), 0)
--   hold(child)    = 0                      -- a child's seats are already inside its parent's qty
--
-- Why children's USED and not children's QTY: a child's unused seats have not left the parent's
-- block, so if a sub-hold is released or expires with seats still on it, those seats must stay held
-- at the parent rather than silently leaving the pool. Netting out child *qty* instead would leak
-- them. Children in every status are summed, because a depleted child's seats became a booking and
-- are already counted in `booked`.
--
-- Nothing else in the view changes. Column list, order and types are identical, so CREATE OR REPLACE
-- is accepted and the B2C consumer query (SELECT capacity, booked, locked, available, boats,
-- board_exists) is unaffected. Rollback: 004_rollback_v_seat_availability_pre004.sql, which is the
-- byte-exact pre-004 definition captured from the live server.
--
-- ⚠ NOTE ON DRIFT: this file is written against the definition that is actually DEPLOYED, which is
--    not what 003_v_seat_availability.sql in this repo says. Prod has a per-day cap override
--    (boat_capovr) and a licensepax clamp that 003 lacks; 003 has a season_state column that prod
--    lacks. 003 was edited after it was applied and the later edits were never deployed. Do not
--    re-apply 003 — it would drop the cap override and change the column set. Reconcile 003 against
--    this file separately.

CREATE OR REPLACE VIEW operation_schemas.v_seat_availability AS
WITH deploy AS (
  SELECT tr.key                                                                        AS date,
         bo.id                                                                         AS boatid,
         LEAST(COALESCE(o.cap, bo.cap), COALESCE(NULLIF(bo.licensepax, 0), bo.cap))    AS cap,
         to_jsonb(tr.*) ->> (bo.id || '_route'::text)                                  AS routeid,
         to_jsonb(tr.*) ->> (bo.id || '_type'::text)                                   AS btype
    FROM operation_schemas.trips tr
    CROSS JOIN operation_schemas.boats bo
    LEFT JOIN operation_schemas.boat_capovr o ON o.key = ((tr.key || '::'::text) || bo.id)
),
cap AS (
  SELECT d.date,
         d.routeid,
         COALESCE(sum(d.cap) FILTER (WHERE d.btype IS DISTINCT FROM 'charter'::text), 0::numeric)::bigint AS capacity,
         string_agg(d.boatid, '+'::text) FILTER (WHERE d.btype IS DISTINCT FROM 'charter'::text)          AS boats
    FROM deploy d
   WHERE d.routeid IS NOT NULL AND d.routeid <> ''::text
   GROUP BY d.date, d.routeid
),
demand AS (
  SELECT operation_schemas.f_trip_date_iso(t.date, b.createdat) AS date,
         t.routeid,
         COALESCE(sum(COALESCE(t.pax_ad, 0::bigint)     + COALESCE(t.pax_ad_fr, 0::bigint)  + COALESCE(t.pax_ad_th, 0::bigint)
                    + COALESCE(t.pax_chd_fr, 0::bigint) + COALESCE(t.pax_chd_th, 0::bigint)
                    + COALESCE(t.pax_inf_fr, 0::bigint) + COALESCE(t.pax_inf_th, 0::bigint)
                    + COALESCE(t.pax_foc, 0::bigint)    + COALESCE(t.pax_foc_fr, 0::bigint) + COALESCE(t.pax_foc_th, 0::bigint)), 0::numeric)::bigint AS booked
    FROM operation_schemas.sb_bookings__trips t
    JOIN operation_schemas.sb_bookings b ON b.id = t.sb_bookings_id
   WHERE (b.status <> ALL (ARRAY['cancelled'::text, 'cancelled_weather'::text, 'rejected'::text]))
     AND t.bookingmode IS DISTINCT FROM 'charter'::text
     AND t.routeid IS NOT NULL AND t.routeid <> ''::text
   GROUP BY (operation_schemas.f_trip_date_iso(t.date, b.createdat)), t.routeid
),
locks AS (
  -- §004 · Parent-aware. Only parents and standalone blocks contribute; a sub-hold's seats are
  -- already inside its parent's qty and would otherwise be counted twice (and a third time via
  -- `booked` once the sub-hold is drawn down). See the header for the app formula this mirrors.
  SELECT "left"(sl.date, 10) AS date,
         sl.routeid,
         COALESCE(sum(GREATEST(sl.qty - COALESCE(sl.used, 0::bigint) - COALESCE(ch.child_used, 0::bigint), 0::bigint)), 0::numeric)::bigint AS locked
    FROM operation_schemas.sb_seat_locks sl
    LEFT JOIN LATERAL (
      SELECT COALESCE(sum(COALESCE(c.used, 0::bigint)), 0::bigint) AS child_used
        FROM operation_schemas.sb_seat_locks c
       WHERE c.parentid = sl.id
    ) ch ON true
   WHERE sl.status = 'active'::text
     AND (sl.parentid IS NULL OR sl.parentid = ''::text)   -- children hold no seats of their own
     AND sl.date IS NOT NULL AND sl.date <> ''::text
     AND sl.routeid IS NOT NULL AND sl.routeid <> ''::text
   GROUP BY ("left"(sl.date, 10)), sl.routeid
),
keys AS (
  SELECT cap.date, cap.routeid FROM cap
  UNION
  SELECT demand.date, demand.routeid FROM demand WHERE demand.date IS NOT NULL
  UNION
  SELECT locks.date, locks.routeid FROM locks
)
SELECT k.date,
       k.routeid,
       COALESCE(c.capacity, 0::bigint)                                                                    AS capacity,
       COALESCE(d.booked, 0::bigint)                                                                      AS booked,
       COALESCE(l.locked, 0::bigint)                                                                      AS locked,
       GREATEST(COALESCE(c.capacity, 0::bigint) - COALESCE(d.booked, 0::bigint) - COALESCE(l.locked, 0::bigint), 0::bigint) AS available,
       COALESCE(c.boats, ''::text)                                                                        AS boats,
       c.date IS NOT NULL                                                                                 AS board_exists
  FROM keys k
  LEFT JOIN cap    c ON c.date = k.date AND c.routeid = k.routeid
  LEFT JOIN demand d ON d.date = k.date AND d.routeid = k.routeid
  LEFT JOIN locks  l ON l.date = k.date AND l.routeid = k.routeid;

COMMENT ON VIEW operation_schemas.v_seat_availability IS
  'Single source of truth for seat availability by (date, routeid). Consumers SELECT from this, never from the base tables. `locked` counts parent/standalone holds only — sub-holds live inside their parent''s qty.';
