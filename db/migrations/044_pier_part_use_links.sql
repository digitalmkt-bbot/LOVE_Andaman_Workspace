-- 044_pier_part_use_links.sql  (2026-11-03)   [§poRpPier]
--
-- Mask repair parts (7ca173d9) link a 'part_use' pier move to the boat and to its Fleet consumable row, but
-- neither table had columns for those links, so decomposeBlob dropped them on every save. After a refresh the
-- move lost its boat and cost (section 3 said ของกลางท่า) and the consumable lost src/pierMoveId, so
-- flConsumeDelete missed its pier_fix branch and the parts never went back into pier stock.
-- forboat is separate from boatid on purpose: the daily issue/return sheet reads boatid.
-- No backfill: 0 part_use rows on prod as of 2026-11-03. Older rows stay NULL.
-- Mapping: os-backend/src/mapping/field_mapping.json + operation_schemas_model.json. IF NOT EXISTS: safe to re-run.

ALTER TABLE operation_schemas.pier_moves
  ADD COLUMN IF NOT EXISTS forboat   text,
  ADD COLUMN IF NOT EXISTS fixitem   text,
  ADD COLUMN IF NOT EXISTS fixqty    bigint,
  ADD COLUMN IF NOT EXISTS unitcost  double precision,
  ADD COLUMN IF NOT EXISTS cost      double precision,
  ADD COLUMN IF NOT EXISTS consumeid text;

ALTER TABLE operation_schemas.fleet_consumable_logs
  ADD COLUMN IF NOT EXISTS src        text,
  ADD COLUMN IF NOT EXISTS pier       text,
  ADD COLUMN IF NOT EXISTS poitemid   text,
  ADD COLUMN IF NOT EXISTS fixqty     bigint,
  ADD COLUMN IF NOT EXISTS piermoveid text;
