-- 045_pier_move_edit_stamp.sql  (2026-11-03)   [§poMvEdit]
--
-- poMoveEditSave stamps editBy / editAt on a pier move when its note (or an adjust's boat) is edited after the
-- fact, and the ledger shows "แก้ย้อนหลังโดย …" from them, but pier_moves had no columns for them, so
-- decomposeBlob dropped them on every save and the line was gone after a refresh.
-- editat is text like at: the client writes an ISO string and the ledger slices it.
-- No backfill: the stamps were never stored, so older rows stay NULL.
-- Mapping: os-backend/src/mapping/field_mapping.json + operation_schemas_model.json. IF NOT EXISTS: safe to re-run.

ALTER TABLE operation_schemas.pier_moves
  ADD COLUMN IF NOT EXISTS editby text,
  ADD COLUMN IF NOT EXISTS editat text;
