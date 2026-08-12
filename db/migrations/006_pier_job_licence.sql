-- ============================================================
-- Migration 006: Pier Office · ใบงานเรือ + ใบอนุญาตประจำเรือ
--
-- 6 ตารางใหม่
--   pier_team        ทีมประจำเรือ · boatId -> {cap, asst, crew[]}
--   pier_job         ใบงานรายวัน · 'YYYY-MM-DD::boatId' -> {...}
--   pier_cfg         ตั้งค่ารวมของ Pier Office เช่น licWarnDays
--   pier_lic_types   ประเภทใบอนุญาต · ใบกัปตัน / ใบช่างเครื่อง
--   pier_lic_classes ชั้นของใบ + เพดานว่าคุมเรือได้ถึงขนาดไหน
--   pier_licenses    ใบของแต่ละคน
--
-- ทำไมเก็บเพดานไว้ที่ "ชั้น" ไม่ผูกใบกับเรือทีละคู่
--   ตาราง boats มี gt (ตันกรอส) กับ bhp (แรงม้า) ครบทุกลำอยู่แล้ว
--   ระบบเทียบเลขเอง เรือลำใหม่เข้ามาก็ตรวจได้ทันทีโดยไม่ต้องตั้งค่าเพิ่ม
--
-- pier_team / pier_job / pier_cfg เก็บค่าเป็น JSON text แบบเดียวกับ
-- vanjob_sent · เพิ่มฟิลด์ในใบงานภายหลังไม่ต้องแตะ DB อีก
--
-- Safe: CREATE ... IF NOT EXISTS ทั้งหมด · idempotent รันซ้ำได้
-- ไม่แตะตารางเดิมและไม่แตะ public.*
-- ============================================================

CREATE SCHEMA IF NOT EXISTS operation_schemas;

CREATE TABLE IF NOT EXISTS operation_schemas."pier_team" (
    "id"    text,
    "key"   text,
    "value" text
);

CREATE TABLE IF NOT EXISTS operation_schemas."pier_job" (
    "id"    text,
    "key"   text,
    "value" text
);

CREATE TABLE IF NOT EXISTS operation_schemas."pier_cfg" (
    "id"    text,
    "key"   text,
    "value" text
);

-- ── ประเภทใบ · side = 'deck' (ใบกัปตัน) | 'eng' (ใบช่างเครื่อง) ──────────
-- short  = ชื่อที่เรียกกันจริง (ขึ้นบนใบงาน)
-- formal = ชื่อทางการ (ใช้กับเอกสารราชการ)
-- perboat = ลำหนึ่งต้องมีใบประเภทนี้กี่ใบ (ค่าเริ่มต้น 1)
CREATE TABLE IF NOT EXISTS operation_schemas."pier_lic_types" (
    "id"      text,
    "side"    text,
    "short"   text,
    "formal"  text,
    "perboat" bigint,
    "active"  boolean
);

-- ── ชั้นของใบ · maxgt / maxbhp = เพดาน · NULL = ไม่จำกัด ────────────────
CREATE TABLE IF NOT EXISTS operation_schemas."pier_lic_classes" (
    "id"     text,
    "typeid" text,
    "name"   text,
    "maxgt"  double precision,
    "maxbhp" double precision,
    "ord"    bigint
);

-- ── ใบของแต่ละคน · 1 คนถือได้หลายใบ ────────────────────────────────────
CREATE TABLE IF NOT EXISTS operation_schemas."pier_licenses" (
    "id"       text,
    "staffid"  text,
    "classid"  text,
    "no"       text,
    "exp"      text,
    "issuedat" text,
    "issuer"   text,
    "note"     text
);

-- ── ดัชนีที่ใช้จริงตอนอ่าน ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "pier_licenses_staff_idx" ON operation_schemas."pier_licenses" ("staffid");
CREATE INDEX IF NOT EXISTS "pier_licenses_exp_idx"   ON operation_schemas."pier_licenses" ("exp");
CREATE INDEX IF NOT EXISTS "pier_lic_classes_type"   ON operation_schemas."pier_lic_classes" ("typeid");

-- ── ตรวจหลังรัน ─────────────────────────────────────────────────────────
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema='operation_schemas' AND table_name LIKE 'pier_%' ORDER BY 1;
