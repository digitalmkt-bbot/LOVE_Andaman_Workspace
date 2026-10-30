-- 042_ops_turnback.sql  (2026-10-30)   [§turnBack]
--
-- ⛵ ออกเรือแล้วกลับเข้าท่า (Pier check-in, 0d314f5a / 5641b6b5, 2026-10-29) keeps its record in ops.turnBack
-- {at, hm, by, reason, note, pax, money{kind,pct,amt,note,by,at}, editedAt} on the booking (first day) or on the
-- trip (later days). Neither table had a column for it, so decomposeBlob dropped it on every save: the record
-- showed until the next refresh, then vanished — the same bug ops.pierNote had (9f1d1602). One json_text column,
-- like ops_piernote, so the record can grow without another backend change.
-- Mapping: os-backend/src/mapping/field_mapping.json + operation_schemas_model.json (ops_turnback). IF NOT EXISTS: safe to re-run.

ALTER TABLE operation_schemas.sb_bookings        ADD COLUMN IF NOT EXISTS ops_turnback text;
ALTER TABLE operation_schemas.sb_bookings__trips ADD COLUMN IF NOT EXISTS ops_turnback text;
