-- 030_po_cash_rows.sql  (2026-09-15)   [§pcRows]
--
-- Pier petty cash, one row per entry, so two people at the same pier stop erasing each other.
--
-- Until now a pier's entire cash book — every day of every month, the day ledger, the longtail
-- sheet and the park-fee sheet — was one JSON string under a single app_meta key
-- (po_cash_panwa / _tublamu / _ranong). That shape was chosen in 029's predecessor for a good
-- reason: a key whose value is an object is not owned by any table and gets dropped on the way
-- to the database, so the string was what made the data survive at all.
--
-- What it cost is concurrency. A string value travels as {op:'meta', id, body} and the server
-- applies it as DELETE + INSERT of the whole key. The batch endpoint computes `behind` and
-- returns it, but it applies the write either way — there is no merge and no refusal. So when
-- two pier staff have the page open and the second one saves from a copy that predates the
-- first one's entry, the first person's rows are gone, with nothing on screen to say so.
--
-- The client is not careless here; it re-reads the key whenever the string changes underneath it.
-- The hole is upstream of that: the refresh that would deliver the other person's entry is held
-- back while the page is "busy", and focus sitting in an input counts as busy — which is the
-- normal state of someone keying rows.
--
-- Every other entity in this app already survives this. Bookings, contracts and the rest travel
-- as per-record put/patch/del, and the client's own comment on the patch op says why: "server
-- merges onto its CURRENT record → concurrent edits to different fields both survive". Petty cash
-- was the one money record that never got to use that machinery. These tables hand it over.
--
--   po_cash_rows  the day ledger · one row per receipt or payment · id is the row's own id
--   po_cash_lt    the longtail sheet · one row per (pier, date, boat)
--   po_cash_pk    the park-fee sheet · one row per (pier, date, boat) · both sides kept on
--                 purpose (what the booking says vs what was paid at the gate) because the gate
--                 never matches the booking — under-3s are free, some guests skip the island,
--                 and islands charge differently. Keeping only the baht would say what was paid
--                 and never why.
--
-- lt/pk ids are deterministic (pier|date|boat) so the same cell edited from two devices resolves
-- to the same record and merges instead of duplicating. Ledger rows keep the id the client
-- already generates, which is unique per row.
--
-- The old string keys are left alone by this migration. The client back-fills these tables from
-- them and keeps reading the string until the switch-over lands, so a deploy that stops here
-- changes nothing anyone can see.

CREATE TABLE IF NOT EXISTS operation_schemas.po_cash_rows (
  id    text PRIMARY KEY,
  pier  text,
  date  text,
  kind  text,
  txt   text,
  amt   bigint,
  at    text,
  by    text,
  ts    text,
  src   text
);
CREATE INDEX IF NOT EXISTS po_cash_rows_pier_date ON operation_schemas.po_cash_rows (pier, date);

CREATE TABLE IF NOT EXISTS operation_schemas.po_cash_lt (
  id    text PRIMARY KEY,
  pier  text,
  date  text,
  bid   text,
  n     bigint,
  nj    bigint,
  nc    bigint,
  amt   bigint,
  note  text,
  by    text,
  ts    text
);
CREATE INDEX IF NOT EXISTS po_cash_lt_pier_date ON operation_schemas.po_cash_lt (pier, date);

CREATE TABLE IF NOT EXISTS operation_schemas.po_cash_pk (
  id     text PRIMARY KEY,
  pier   text,
  date   text,
  bid    text,
  ad_th  bigint, chd_th bigint, inf_th bigint, foc_th bigint,
  ad_fr  bigint, chd_fr bigint, inf_fr bigint, foc_fr bigint,
  amt    bigint,
  dock   bigint,
  by     text,
  ts     text,
  src    text
);
CREATE INDEX IF NOT EXISTS po_cash_pk_pier_date ON operation_schemas.po_cash_pk (pier, date);

COMMENT ON TABLE operation_schemas.po_cash_rows IS
  'pier petty cash day ledger · one row per entry · replaces the single po_cash_<pier> JSON string so concurrent edits merge';
COMMENT ON TABLE operation_schemas.po_cash_lt IS
  'longtail sheet · one row per (pier,date,boat) · id is pier|date|boat so two devices editing the same cell merge';
COMMENT ON TABLE operation_schemas.po_cash_pk IS
  'park fee sheet · one row per (pier,date,boat) · keeps both the booking side and what was actually paid at the gate';
