-- 043_weather_turnback.sql  (2026-10-30)   [§wxTb]
--
-- ⛵ เรือตีกลับ on the weather decision log · per forecast point per date · a list, one entry per boat:
--   [{bid, hm, reason: sea|guest|boat|other, note, by, at}]
-- The pier check-in's own turn-back record (ops.turnBack on the booking) is read live by the client and merged
-- with this; this column covers boats the office logs by hand (no booking-level record, or before the pier does).
-- A row may now hold turnbacks with no decision yet, so decision stays nullable (it already was). IF NOT EXISTS: safe to re-run.

ALTER TABLE operation_schemas.weather_decision ADD COLUMN IF NOT EXISTS turnbacks jsonb;
