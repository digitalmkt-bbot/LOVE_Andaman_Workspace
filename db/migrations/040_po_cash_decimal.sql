-- 040_po_cash_decimal.sql  (2026-10-26)   [§pcDec2]
--
-- Pier petty cash keeps satang (two decimals).
--
-- Owner: "ตรวจสอบ Petty cash ใส่ทศนิยม แล้วไม่บันทึก ต้องสามารถใส่ได้"
--
-- 030 created the money columns as bigint. The entry form already accepted 12.50 (§pcDec), but the client
-- rounded on the way into the rows, and the server rounds anything bound to a bigint column (_bindVal),
-- so 12.50 came back as 13 after a refresh and 0.40 became 0.
--
-- Only the money columns change: po_cash_rows.amt, po_cash_lt.amt, po_cash_pk.amt and po_cash_pk.dock.
-- Head counts (n / nj / nc, ad_th … foc_fr) stay whole numbers.
-- double precision, the same type fleet costs already use (node-pg returns it as a JS number; numeric
-- would come back as a string). Existing whole-baht values convert unchanged.
--
-- Ships together with operation_schemas_model.json + field_mapping.json (db_type double precision).
-- Safe to re-run: ALTER … TYPE to the type a column already has is a no-op.

ALTER TABLE operation_schemas.po_cash_rows ALTER COLUMN amt  TYPE double precision;
ALTER TABLE operation_schemas.po_cash_lt   ALTER COLUMN amt  TYPE double precision;
ALTER TABLE operation_schemas.po_cash_pk   ALTER COLUMN amt  TYPE double precision;
ALTER TABLE operation_schemas.po_cash_pk   ALTER COLUMN dock TYPE double precision;
