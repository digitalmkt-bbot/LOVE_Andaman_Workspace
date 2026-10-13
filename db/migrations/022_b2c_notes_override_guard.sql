-- 022_b2c_notes_override_guard.sql  (2026-09-02)
--
-- Protects ops-typed booking notes from the B2C_MAP_VER 23 back-fill.
--
-- Until v23 the B2C sync never produced sb_bookings.notes, so `notes` was not on the B2C_OWN_BK
-- whitelist and every b2c_ booking's notes belonged entirely to ops — whatever a staff member typed
-- into "Notes / special request" on the booking screen. v23 starts importing the B2C item's
-- "Special request (sent to ops team)" + "Internal remark" into that same field and adds `notes` to
-- the whitelist, which means the one corrective re-upsert would overwrite those hand-typed notes.
--
-- The sync already has the mechanism for exactly this: sb_bookings.b2coverride is a JSON text array
-- of column names ops has claimed, and the ON CONFLICT SET keeps the existing value for any column
-- named in it. The app writes an entry there whenever ops edits a B2C-owned field — but it could not
-- have written one for `notes`, because `notes` was not a B2C-owned field until today.
--
-- So: seed it retroactively. Every b2c_ booking that already carries a non-empty note gets "notes"
-- added to its b2coverride, and the v23 back-fill then fills the field only where it was empty.
-- Bookings ops never annotated take the B2C special request, which is the whole point.
--
-- From here on the app keeps the list current by itself (BKV2_B2C_OWN now carries notes:'notes').
--
-- Idempotent: rows whose b2coverride already names "notes" are skipped, so a re-run is a no-op.
-- Guarded on schema + table existence so it does nothing on a blob-mode database.

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch)
       AND EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = sch AND table_name = 'sb_bookings'
                     AND column_name = 'b2coverride')
       AND EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = sch AND table_name = 'sb_bookings'
                     AND column_name = 'notes') THEN
      -- Append by text surgery rather than a jsonb round-trip: the server matches this column with a
      -- substring test on '"notes"', and a value that is not a well-formed array is left untouched
      -- instead of being rewritten (the WHERE only admits '' / NULL / '[...]' shapes).
      EXECUTE format($f$
        UPDATE %I.sb_bookings
           SET b2coverride = CASE
                 WHEN coalesce(btrim(b2coverride),'') IN ('','[]') THEN '["notes"]'
                 ELSE left(btrim(b2coverride), length(btrim(b2coverride)) - 1) || ',"notes"]'
               END
         WHERE id LIKE 'b2c/_%%' ESCAPE '/'
           AND coalesce(btrim(notes),'') <> ''
           AND position('"notes"' in coalesce(b2coverride,'')) = 0
           AND (coalesce(btrim(b2coverride),'') IN ('','[]')
                OR (left(btrim(b2coverride),1) = '[' AND right(btrim(b2coverride),1) = ']'))
      $f$, sch);
    END IF;
  END LOOP;
END $$;

-- Verify — should return 0 rows (every annotated B2C booking is now protected):
--   SELECT id, left(notes,40), b2coverride
--     FROM operation_schemas.sb_bookings
--    WHERE id LIKE 'b2c/_%' ESCAPE '/'
--      AND coalesce(btrim(notes),'') <> ''
--      AND position('"notes"' in coalesce(b2coverride,'')) = 0;
