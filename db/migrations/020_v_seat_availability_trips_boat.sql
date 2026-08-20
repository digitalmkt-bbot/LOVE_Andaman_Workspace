-- 020 · v_seat_availability could not see any boat added after launch
--
-- The `deploy` CTE read a boat's route out of the WIDE trips columns:
--     to_jsonb(tr.*) ->> (bo.id || '_route')
-- Those columns (b1_route … b15_route) were generated from the boats that existed when the
-- mapping was written. A boat added later has no column, so `->>` returns NULL, the boat is
-- never counted, board_exists comes back false, and B2C reports NO_BOARD —
-- "No boat schedule published for <date> yet — not sellable".
--
-- Hit by the Ranong charters that run the Myanmar day trips (Se La Va, Nyaung Oo Phee):
-- Tri Star 01 was deployed on all 31 days of Dec 2026 and B2C could not see one of them.
--
-- trips__boat (added the same day, one row per (date, boat), op object as JSON) is complete for
-- every boat. It only fills in as days are re-saved, so this reads BOTH: trips__boat wins where
-- it has a row, the legacy columns still serve every day that has not been re-saved since.
-- DISTINCT ON guards against duplicate (date, boat) rows double-counting capacity.
--
-- Built from the LIVE pg_get_viewdef output, not from 003 — prod and the repo's copy of this
-- view have drifted apart in both directions. Everything below the `deploy` CTE is verbatim.

CREATE OR REPLACE VIEW operation_schemas.v_seat_availability AS
 WITH deploy AS (
         -- legacy wide columns · only for (date, boat) pairs trips__boat does not carry yet
         SELECT tr.key AS date,
            bo.id AS boatid,
            LEAST(COALESCE(o.cap, bo.cap), COALESCE(NULLIF(bo.licensepax, 0), bo.cap)) AS cap,
            to_jsonb(tr.*) ->> (bo.id || '_route'::text) AS routeid,
            to_jsonb(tr.*) ->> (bo.id || '_type'::text) AS btype
           FROM operation_schemas.trips tr
             CROSS JOIN operation_schemas.boats bo
             LEFT JOIN operation_schemas.boat_capovr o ON o.key = ((tr.key || '::'::text) || bo.id)
          WHERE NOT EXISTS (
                  SELECT 1 FROM operation_schemas."trips__boat" tb
                   WHERE tb.trips_id = tr.key AND tb.key = bo.id)
        UNION ALL
         -- open-map table · authoritative, and the ONLY source for boats with no b*_ columns
         SELECT tb.trips_id AS date,
            bo.id AS boatid,
            LEAST(COALESCE(o.cap, bo.cap), COALESCE(NULLIF(bo.licensepax, 0), bo.cap)) AS cap,
            tb.value::jsonb ->> 'route'::text AS routeid,
            tb.value::jsonb ->> 'type'::text AS btype
           FROM (SELECT DISTINCT ON (t2.trips_id, t2.key) t2.trips_id, t2.key, t2.value
                   FROM operation_schemas."trips__boat" t2
                  ORDER BY t2.trips_id, t2.key, t2.row_pk DESC) tb
             JOIN operation_schemas.boats bo ON bo.id = tb.key
             LEFT JOIN operation_schemas.boat_capovr o ON o.key = ((tb.trips_id || '::'::text) || tb.key)
        ), cap AS (
         SELECT d_1.date,
            d_1.routeid,
            COALESCE(sum(d_1.cap) FILTER (WHERE d_1.btype IS DISTINCT FROM 'charter'::text), 0::numeric)::bigint AS capacity,
            -- ORDER BY added: string_agg had no ordering, so `boats` came out in whatever order the
            -- planner produced (it already varied run to run). Pinned so the string is reproducible.
            string_agg(d_1.boatid, '+'::text ORDER BY d_1.boatid) FILTER (WHERE d_1.btype IS DISTINCT FROM 'charter'::text) AS boats
           FROM deploy d_1
          WHERE d_1.routeid IS NOT NULL AND d_1.routeid <> ''::text
          GROUP BY d_1.date, d_1.routeid
        ), demand AS (
         SELECT operation_schemas.f_trip_date_iso(t.date, b.createdat) AS date,
            t.routeid,
            COALESCE(sum(COALESCE(t.pax_ad, 0::bigint) + COALESCE(t.pax_ad_fr, 0::bigint) + COALESCE(t.pax_ad_th, 0::bigint) + COALESCE(t.pax_chd_fr, 0::bigint) + COALESCE(t.pax_chd_th, 0::bigint) + COALESCE(t.pax_inf_fr, 0::bigint) + COALESCE(t.pax_inf_th, 0::bigint) + COALESCE(t.pax_foc, 0::bigint) + COALESCE(t.pax_foc_fr, 0::bigint) + COALESCE(t.pax_foc_th, 0::bigint)), 0::numeric)::bigint AS booked
           FROM operation_schemas.sb_bookings__trips t
             JOIN operation_schemas.sb_bookings b ON b.id = t.sb_bookings_id
          WHERE (b.status <> ALL (ARRAY['cancelled'::text, 'cancelled_weather'::text, 'rejected'::text])) AND t.bookingmode IS DISTINCT FROM 'charter'::text AND t.routeid IS NOT NULL AND t.routeid <> ''::text
          GROUP BY (operation_schemas.f_trip_date_iso(t.date, b.createdat)), t.routeid
        ), locks AS (
         SELECT "left"(sl.date, 10) AS date,
            sl.routeid,
            COALESCE(sum(GREATEST((sl.qty - COALESCE(sl.used, 0::bigint))::numeric - COALESCE(ch.child_used, 0::bigint::numeric), 0::bigint::numeric)), 0::numeric)::bigint AS locked
           FROM operation_schemas.sb_seat_locks sl
             LEFT JOIN LATERAL ( SELECT COALESCE(sum(COALESCE(c_1.used, 0::bigint)), 0::bigint::numeric) AS child_used
                   FROM operation_schemas.sb_seat_locks c_1
                  WHERE c_1.parentid = sl.id) ch ON true
          WHERE sl.status = 'active'::text AND (sl.parentid IS NULL OR sl.parentid = ''::text) AND sl.date IS NOT NULL AND sl.date <> ''::text AND sl.routeid IS NOT NULL AND sl.routeid <> ''::text
          GROUP BY ("left"(sl.date, 10)), sl.routeid
        ), keys AS (
         SELECT cap.date,
            cap.routeid
           FROM cap
        UNION
         SELECT demand.date,
            demand.routeid
           FROM demand
          WHERE demand.date IS NOT NULL
        UNION
         SELECT locks.date,
            locks.routeid
           FROM locks
        )
 SELECT k.date,
    k.routeid,
    COALESCE(c.capacity, 0::bigint) AS capacity,
    COALESCE(d.booked, 0::bigint) AS booked,
    COALESCE(l.locked, 0::bigint) AS locked,
    GREATEST(COALESCE(c.capacity, 0::bigint) - COALESCE(d.booked, 0::bigint) - COALESCE(l.locked, 0::bigint), 0::bigint) AS available,
    COALESCE(c.boats, ''::text) AS boats,
    c.date IS NOT NULL AS board_exists
   FROM keys k
     LEFT JOIN cap c ON c.date = k.date AND c.routeid = k.routeid
     LEFT JOIN demand d ON d.date = k.date AND d.routeid = k.routeid
     LEFT JOIN locks l ON l.date = k.date AND l.routeid = k.routeid;
