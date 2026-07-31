-- Run on the B2C database (love_kingdom), NOT on operation_schemas.
--
-- bookings.passengers is a booking-level jsonb array, one object per traveller:
--   [{"name":"Somchai P","passport":"AA123456","dob":"1990-04-11",
--     "nationality":"Thailand","phone":"081...","remark":"peanut allergy"}]
-- The objects carry no id, so the array ordinal is the only stable position for a traveller.
--
-- Consumers (the allotment sync in server.js reads this view, never the column) get a flat,
-- typed row set — so the storage shape can change here without breaking them.
--
-- Notes for anyone reading the output:
--   · Row count is NOT a headcount. The list is optional and may be completed any time before
--     travel, so a booking with pax_adult = 4 can have 0 rows. Counts stay on booking_items.pax_*.
--   · Blanks are stored as '' rather than null (only fully empty rows are dropped on save), hence
--     nullif(btrim(...), '') on every text field.
--   · dob is a string and may be junk — the regex guard keeps one bad row from erroring the
--     whole query, which a bare ::date would.
--   · There is no per-item link: this applies to the whole booking, not to one trip.
--   · nationality is free text off the same datalist as customers.nationality, so 'Thailand',
--     'Thai' and 'TH' all occur. Normalize downstream.
--   · PII: passport / dob / phone are exposed here in full. stripForSales() does not redact them,
--     so anything granted SELECT on this view inherits that exposure. Grant deliberately.

CREATE OR REPLACE VIEW v_booking_passengers AS
SELECT b.id                                     AS booking_id,
       p.ord::int                               AS pax_no,
       nullif(btrim(p.val->>'name'), '')         AS name,
       nullif(btrim(p.val->>'passport'), '')     AS passport,
       CASE WHEN p.val->>'dob' ~ '^\d{4}-\d{2}-\d{2}$'
            THEN (p.val->>'dob')::date END       AS dob,
       nullif(btrim(p.val->>'nationality'), '')  AS nationality,
       nullif(btrim(p.val->>'phone'), '')        AS phone,
       nullif(btrim(p.val->>'remark'), '')       AS remark
FROM bookings b
CROSS JOIN LATERAL jsonb_array_elements(b.passengers)
     WITH ORDINALITY AS p(val, ord)
WHERE jsonb_typeof(b.passengers) = 'array';

-- Passport / ID lookup: match by containment so the index can serve it. Expanding the array first
-- and filtering after cannot use an index — that is a seq scan over every booking.
--   SELECT id FROM bookings WHERE passengers @> '[{"passport":"AA123456"}]';
CREATE INDEX IF NOT EXISTS bk_pax_gin ON bookings USING gin (passengers jsonb_path_ops);
