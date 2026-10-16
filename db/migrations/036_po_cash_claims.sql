-- 036_po_cash_claims.sql  (2026-10-16)   [§pcClm]
--
-- Pier petty cash · claims (ตั้งเบิก).
--
-- Staff tick expense lines in the day ledger, press "สรุปตั้งเบิก", give the set a name and save it.
-- The claim is listed under the ledger (name, date, lines, total, refund status), its lines carry a
-- "ตั้งเบิก · <name>" chip and cannot be ticked into a second claim, and refunds ("รับเงินคืน…" /
-- "เงินเบิกคืน…") are matched against saved claims instead of being guessed from whole-day totals.
--
--   po_cash_claims     one row per claim · name, pier, date, who/when
--                      the amount is NOT stored: it is always summed from the lines that point at it,
--                      so editing a line in the ledger updates the claim with nothing to keep in sync
--   po_cash_rows.claim the claim id a ledger line belongs to · NULL/'' = not claimed
--
-- Ships together with the field_mapping.json + operation_schemas_model.json entries (a mapped table
-- or column without its migration takes /api/load down).
-- IF NOT EXISTS throughout · safe to re-run · existing rows untouched (claim starts NULL = not claimed).

CREATE TABLE IF NOT EXISTS operation_schemas.po_cash_claims (
  id    text PRIMARY KEY,
  pier  text,
  date  text,
  name  text,
  by    text,
  ts    text
);
CREATE INDEX IF NOT EXISTS po_cash_claims_pier_date ON operation_schemas.po_cash_claims (pier, date);

ALTER TABLE operation_schemas.po_cash_rows ADD COLUMN IF NOT EXISTS claim text;

COMMENT ON TABLE operation_schemas.po_cash_claims IS
  'pier petty cash claims (ตั้งเบิก) · ledger lines link back via po_cash_rows.claim · total is summed from those lines, never stored';
COMMENT ON COLUMN operation_schemas.po_cash_rows.claim IS
  'po_cash_claims.id this expense line was claimed under · NULL or empty = not claimed';
