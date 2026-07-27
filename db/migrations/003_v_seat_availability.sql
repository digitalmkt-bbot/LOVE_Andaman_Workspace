-- 003_v_seat_availability.sql
--
-- One source of truth for "how many seats are free on route R, date D".
--
-- Today the rule is implemented three times and all three disagree:
--   1. getAllotment()            allotment_v2.html:10033  — the authority (locks, charter, cap)
--   2. /api/b2c/availability     server.js                — had an unguarded SUM: booked always 0
--   3. OPS_AVAILABILITY_SQL      Loveandaman-Kingdom/server/server.js
--                                                         — ignores locks AND counts charter pax
-- This view is the single implementation both consumers should select from, so a fix lands once.
--
-- Read-only. Grants SELECT on the view only — never on the base tables, which carry lead names,
-- phones, emails, prices and agent terms that availability has no business exposing.

-- ─────────────────────────────────────────────────────────────────────────────
-- Compatibility shim: normalise sb_bookings__trips.date to ISO.
--
-- The column is text. Most rows are 'YYYY-MM-DD', but a legacy B2C write path stored the result of
-- JS String(dateObj).slice(0,10) — 'Sat Jul 04' — which carries NO YEAR. (Fixed at the source by
-- the td() helper in server.js mapB2CItemBooking; these are historical rows only.)
--
-- The year is recovered, not guessed: the booking's createdat supplies a candidate, and the weekday
-- name in the string validates it — 'Sat Jul 04' is 2026, because Jul 4 2025 was a Friday. If no
-- candidate year agrees with the weekday, the function returns NULL rather than inventing a date;
-- a NULL drops the row from the aggregate, which is visible, instead of silently misdating demand.
--
-- ⚠ THIS FUNCTION IS TEMPORARY. Once the bad rows are backfilled to ISO, replace every call with
--    left(t.date, 10) and drop it. Do not add more formats here — fix the writer instead.
CREATE OR REPLACE FUNCTION operation_schemas.f_trip_date_iso(raw text, created text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  -- Explicit arrays, not to_char/to_date with 'Dy'/'Mon': those honour lc_time, so a server with a
  -- non-English locale would silently stop matching. These are locale-proof.
  dows  constant text[] := ARRAY['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  months constant text[] := ARRAY['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  mon_i int;
  day_i int;
  base_y int;
  cand date;
BEGIN
  IF raw IS NULL OR raw = '' THEN
    RETURN NULL;
  END IF;

  -- 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:MM:SSZ' both truncate cleanly.
  IF raw ~ '^\d{4}-\d{2}-\d{2}' THEN
    RETURN left(raw, 10);
  END IF;

  -- 'Sat Jul 04'
  IF raw ~ '^[A-Z][a-z]{2} [A-Z][a-z]{2} [ 0-9]\d$' THEN
    mon_i := array_position(months, substr(raw, 5, 3));
    day_i := NULLIF(btrim(substr(raw, 9, 2)), '')::int;
    base_y := NULLIF(left(COALESCE(created, ''), 4), '')::int;
    IF mon_i IS NULL OR day_i IS NULL OR base_y IS NULL THEN
      RETURN NULL;
    END IF;
    -- A booking is created at most ~1 year before travel, so createdat's year or the next one.
    FOR i IN 0..1 LOOP
      BEGIN
        cand := make_date(base_y + i, mon_i, day_i);
      EXCEPTION WHEN others THEN
        cand := NULL;                      -- e.g. 'Feb 30' in a corrupt row
      END;
      IF cand IS NOT NULL
         AND dows[EXTRACT(dow FROM cand)::int + 1] = left(raw, 3) THEN
        RETURN to_char(cand, 'YYYY-MM-DD');
      END IF;
    END LOOP;
    RETURN NULL;                           -- weekday agrees with no plausible year
  END IF;

  RETURN NULL;                             -- unrecognised shape
END
$fn$;

COMMENT ON FUNCTION operation_schemas.f_trip_date_iso(text, text) IS
  'TEMPORARY. Normalises legacy weekday-format trip dates to ISO. Drop after backfilling sb_bookings__trips.date.';

-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW operation_schemas.v_seat_availability AS
WITH deploy AS (
  -- Unpivot the wide board WITHOUT naming columns. trips has b1_route…b13_route with gaps and no
  -- stable order (b2_route sits last — columns are appended as boats are added), so any hardcoded
  -- b1..b13 list silently undercounts the day a b14 appears. Driving off boats.id via to_jsonb
  -- means a new boat is picked up with no change here. This is the coupling that forced the
  -- earlier cap fix when trips.id became trips_N.
  SELECT tr.key                                        AS date,
         bo.id                                         AS boatid,
         bo.cap                                        AS cap,
         to_jsonb(tr) ->> (bo.id || '_route')          AS routeid,
         to_jsonb(tr) ->> (bo.id || '_type')           AS btype
  FROM operation_schemas.trips tr
  CROSS JOIN operation_schemas.boats bo
),
cap AS (
  -- A chartered boat is reserved whole and adds no seat capacity (mirrors getAllotment).
  SELECT d.date,
         d.routeid,
         COALESCE(SUM(d.cap) FILTER (WHERE d.btype IS DISTINCT FROM 'charter'), 0)::bigint AS capacity,
         STRING_AGG(d.boatid, '+') FILTER (WHERE d.btype IS DISTINCT FROM 'charter')       AS boats
  FROM deploy d
  WHERE d.routeid IS NOT NULL AND d.routeid <> ''
  GROUP BY d.date, d.routeid
),
demand AS (
  -- Every term COALESCE'd: one NULL makes the whole row's sum NULL and SUM then skips the row —
  -- that is exactly how /api/b2c/availability reported booked = 0 forever (pax_foc_fr/pax_foc_th
  -- are never written; the client stores a flat pax.foc).
  -- Column set mirrors getTripPaxTotal (allotment_v2.html:9843); flat pax_ad/pax_foc are legacy
  -- shapes, mutually exclusive with the _fr/_th split. Infants occupy seats in ops accounting.
  SELECT operation_schemas.f_trip_date_iso(t.date, b.createdat) AS date,
         t.routeid,
         COALESCE(SUM(
           COALESCE(t.pax_ad, 0)     + COALESCE(t.pax_ad_fr, 0)  + COALESCE(t.pax_ad_th, 0)
         + COALESCE(t.pax_chd_fr, 0) + COALESCE(t.pax_chd_th, 0)
         + COALESCE(t.pax_inf_fr, 0) + COALESCE(t.pax_inf_th, 0)
         + COALESCE(t.pax_foc, 0)    + COALESCE(t.pax_foc_fr, 0) + COALESCE(t.pax_foc_th, 0)
         ), 0)::bigint AS booked
  FROM operation_schemas.sb_bookings__trips t
  JOIN operation_schemas.sb_bookings b ON b.id = t.sb_bookings_id
  WHERE b.status NOT IN ('cancelled', 'cancelled_weather', 'rejected')
    -- A charter consumes a whole boat, not seats. NULL counts as a seat trip, matching the client's
    -- `if (t.bookingMode === 'charter') return;` — the ERP query omits this and overcounts demand.
    AND t.bookingmode IS DISTINCT FROM 'charter'
    AND t.routeid IS NOT NULL AND t.routeid <> ''
  GROUP BY 1, t.routeid
),
locks AS (
  -- Locks hold seats out of the sellable pool. Drawing a lock moves qty→used, so GREATEST(qty-used)
  -- is the outstanding hold and there is no double count against booked.
  -- left(,10) is defensive only: locks are created in-app and should already be ISO, but it costs
  -- nothing and absorbs an ISO-with-time value without a second incident.
  SELECT left(sl.date, 10) AS date,
         sl.routeid,
         COALESCE(SUM(GREATEST(sl.qty - COALESCE(sl.used, 0), 0)), 0)::bigint AS locked
  FROM operation_schemas.sb_seat_locks sl
  WHERE sl.status = 'active'
    AND sl.date IS NOT NULL AND sl.date <> ''
    AND sl.routeid IS NOT NULL AND sl.routeid <> ''
  GROUP BY 1, sl.routeid
),
keys AS (
  -- FULL coverage, not cap-driven: a route/date with bookings but no board row must still surface,
  -- otherwise an oversell gate cannot see demand that has outrun deployment.
  SELECT date, routeid FROM cap
  UNION
  SELECT date, routeid FROM demand WHERE date IS NOT NULL
  UNION
  SELECT date, routeid FROM locks
)
SELECT k.date,
       k.routeid,
       COALESCE(c.capacity, 0)                                                    AS capacity,
       COALESCE(d.booked,   0)                                                    AS booked,
       COALESCE(l.locked,   0)                                                    AS locked,
       GREATEST(COALESCE(c.capacity, 0) - COALESCE(d.booked, 0) - COALESCE(l.locked, 0), 0) AS available,
       COALESCE(c.boats, '')                                                      AS boats,
       (c.date IS NOT NULL)                                                       AS board_exists
FROM keys k
LEFT JOIN cap    c ON c.date = k.date AND c.routeid = k.routeid
LEFT JOIN demand d ON d.date = k.date AND d.routeid = k.routeid
LEFT JOIN locks  l ON l.date = k.date AND l.routeid = k.routeid;

COMMENT ON VIEW operation_schemas.v_seat_availability IS
  'Single source of truth for seat availability by (date, routeid). Consumers SELECT from this, never from the base tables.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Companion: trip rows whose date could not be normalised. Their pax are NOT counted in the view,
-- so this is the blind spot made visible — it must be empty before the availability numbers can be
-- trusted, and it is the worklist for the backfill that retires f_trip_date_iso.
CREATE OR REPLACE VIEW operation_schemas.v_seat_availability_unmapped AS
SELECT t.row_pk,
       t.sb_bookings_id,
       t.routeid,
       t.date        AS raw_date,
       b.createdat,
       b.bookingdate,
       b.status,
       COALESCE(t.pax_ad, 0)     + COALESCE(t.pax_ad_fr, 0)  + COALESCE(t.pax_ad_th, 0)
     + COALESCE(t.pax_chd_fr, 0) + COALESCE(t.pax_chd_th, 0)
     + COALESCE(t.pax_inf_fr, 0) + COALESCE(t.pax_inf_th, 0)
     + COALESCE(t.pax_foc, 0)    + COALESCE(t.pax_foc_fr, 0) + COALESCE(t.pax_foc_th, 0) AS uncounted_pax
FROM operation_schemas.sb_bookings__trips t
JOIN operation_schemas.sb_bookings b ON b.id = t.sb_bookings_id
WHERE b.status NOT IN ('cancelled', 'cancelled_weather', 'rejected')
  AND t.bookingmode IS DISTINCT FROM 'charter'
  AND operation_schemas.f_trip_date_iso(t.date, b.createdat) IS NULL;

COMMENT ON VIEW operation_schemas.v_seat_availability_unmapped IS
  'Trip rows excluded from v_seat_availability because their date could not be normalised. Should be empty.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Grant to the B2C/ERP reader. Replace b2c_reader with the actual role, and run these three lines
-- ONLY for that role — the point of the view is that the base tables stay unreadable to it.
--
--   GRANT USAGE  ON SCHEMA operation_schemas TO b2c_reader;
--   GRANT SELECT ON operation_schemas.v_seat_availability TO b2c_reader;
--   REVOKE ALL ON ALL TABLES IN SCHEMA operation_schemas FROM b2c_reader;
--
-- Consumer query:
--   SELECT capacity, booked, locked, available, boats, board_exists
--   FROM operation_schemas.v_seat_availability
--   WHERE routeid = $1 AND date = $2;
