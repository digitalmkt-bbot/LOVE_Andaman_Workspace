-- 041_weather_obs.sql  (2026-10-30)   [§wx]
--
-- Marine weather per route point per day · forecast snapshots + analysed history.
--
-- Owner: "การออกเรือสอดคล้องกับสภาพอากาศ ควรเก็บประวัติว่าเรือเจอสภาพอากาศแบบไหนออกได้ แบบไหนออกไม่ได้
--         เอามาเป็นตัวช่วยตัดสินใจ · แต่ละเส้นทางใช้พยากรณ์ไม่เหมือนกัน"
--
-- point_id = a forecast point from weather/points.json (one per route group, at sea on the way, not Phuket).
-- kind     = fc17 (forecast for `date` taken 17:00 the day before) · fc05 (taken 05:00 that morning)
--            · hist (the day as analysed afterwards, backfillable from June 2026).
-- hourly   = raw Open-Meteo hourly arrays (wave/swell/wind/rain) · summary = max/mean over the point's
--            sailing window, the numbers the Boat Operation card shows and similarity search uses.
-- Not part of the app blob (no field_mapping entry) · read through /api/weather only · IF NOT EXISTS, safe to re-run.

CREATE TABLE IF NOT EXISTS operation_schemas.weather_obs (
  point_id   text        NOT NULL,
  date       text        NOT NULL,
  kind       text        NOT NULL,
  taken_at   timestamptz NOT NULL DEFAULT now(),
  hourly     jsonb,
  summary    jsonb,
  PRIMARY KEY (point_id, date, kind)
);
CREATE INDEX IF NOT EXISTS weather_obs_date_idx ON operation_schemas.weather_obs (date);
