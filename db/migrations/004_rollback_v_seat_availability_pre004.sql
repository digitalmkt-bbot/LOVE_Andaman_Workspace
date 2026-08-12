-- ROLLBACK: exact definition of operation_schemas.v_seat_availability as deployed on
-- prod at 2026-08-12, captured with pg_get_viewdef() before migration 004 was applied.
-- Apply this file to put the view back exactly as it was.

CREATE OR REPLACE VIEW operation_schemas.v_seat_availability AS
 WITH deploy AS (
         SELECT tr.key AS date,
            bo.id AS boatid,
            LEAST(COALESCE(o.cap, bo.cap), COALESCE(NULLIF(bo.licensepax, 0), bo.cap)) AS cap,
            to_jsonb(tr.*) ->> (bo.id || '_route'::text) AS routeid,
            to_jsonb(tr.*) ->> (bo.id || '_type'::text) AS btype
           FROM operation_schemas.trips tr
             CROSS JOIN operation_schemas.boats bo
             LEFT JOIN operation_schemas.boat_capovr o ON o.key = ((tr.key || '::'::text) || bo.id)
        ), cap AS (
         SELECT d_1.date,
            d_1.routeid,
            COALESCE(sum(d_1.cap) FILTER (WHERE d_1.btype IS DISTINCT FROM 'charter'::text), 0::numeric)::bigint AS capacity,
            string_agg(d_1.boatid, '+'::text) FILTER (WHERE d_1.btype IS DISTINCT FROM 'charter'::text) AS boats
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
            COALESCE(sum(GREATEST(sl.qty - COALESCE(sl.used, 0::bigint), 0::bigint)), 0::numeric)::bigint AS locked
           FROM operation_schemas.sb_seat_locks sl
          WHERE sl.status = 'active'::text AND sl.date IS NOT NULL AND sl.date <> ''::text AND sl.routeid IS NOT NULL AND sl.routeid <> ''::text
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
