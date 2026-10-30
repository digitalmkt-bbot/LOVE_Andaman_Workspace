-- 042_weather_log.sql  (2026-10-30)   [§wx2]
--
-- Decision log + captain's sea report · the two human inputs the weather history needs.
--
-- weather_decision · one per forecast point per date · what the office decided for that route group
--   decision = ran_all | ran_part | cx_us (we cancelled) | cx_port (harbour master) | cx_park (park closed) | reroute
--   reason   = free text (what they saw) · by/at = who and when
-- weather_report   · one per boat per date · captain's 1–5 after the trip (1 เรียบ · 5 ไม่ควรออก)
--   flags = ["sick","skip","early","damage","complaint"] · note free text
-- Both read/written only through /api/weather/* · not in the app blob · IF NOT EXISTS, safe to re-run.

CREATE TABLE IF NOT EXISTS operation_schemas.weather_decision (
  point_id  text NOT NULL,
  date      text NOT NULL,
  decision  text,
  reason    text,
  by_user   text,
  at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (point_id, date)
);
CREATE TABLE IF NOT EXISTS operation_schemas.weather_report (
  date      text NOT NULL,
  boat_id   text NOT NULL,
  sea       integer,
  flags     jsonb,
  note      text,
  by_user   text,
  at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (date, boat_id)
);
CREATE INDEX IF NOT EXISTS weather_report_date_idx ON operation_schemas.weather_report (date);
