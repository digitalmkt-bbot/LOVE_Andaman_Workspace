-- ============================================================
-- Migration 007: Pier Office · ตารางการทำงาน (attendance)
--
--   pier_codes  ทะเบียนรหัสในตาราง · SE / PP / OFF / PH / LWOP / LWP / SC / SR / 5 …
--               ตั้งเองได้ทั้งชื่อ ความหมาย สี และ "นับเป็น" (work/off/leave/none)
--               เพิ่มรหัสใหม่ไม่ต้องแตะ DB
--   pier_shift  เฉพาะช่องที่คนแก้ทับด้วยมือ · 'YYYY-MM-DD::staffId' -> {c, by, at}
--               ช่องที่ไม่ได้แก้ไม่เก็บ เพราะคำนวณจากใบงานเรือได้อยู่แล้ว
--               ตารางจึงเล็กมาก ไม่ใช่ 31 วัน x จำนวนคน ทุกเดือน
--
-- Safe: CREATE ... IF NOT EXISTS ทั้งหมด · idempotent รันซ้ำได้
--
-- ⚠ รันไฟล์นี้ "ก่อน" deploy โค้ดใหม่เสมอ
--   เพราะ operation_schemas_model.json ที่ deploy ไปจะสั่งให้ backend
--   SELECT ตารางเหล่านี้ทันที ถ้ายังไม่มีจะได้ 500 ทั้งแอป
--   (relationalStore เวอร์ชันใหม่ทนกรณีนี้ได้แล้ว แต่รันก่อนไว้ปลอดภัยกว่า)
-- ============================================================

CREATE SCHEMA IF NOT EXISTS operation_schemas;

CREATE TABLE IF NOT EXISTS operation_schemas."pier_codes" (
    "id"     text,
    "code"   text,
    "label"  text,
    "color"  text,
    "bg"     text,
    "kind"   text,
    "ord"    bigint,
    "active" boolean
);

CREATE TABLE IF NOT EXISTS operation_schemas."pier_shift" (
    "id"    text,
    "key"   text,
    "value" text
);

CREATE INDEX IF NOT EXISTS "pier_codes_code_idx" ON operation_schemas."pier_codes" ("code");

-- ── ตรวจหลังรัน ─────────────────────────────────────────────────────────
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema='operation_schemas' AND table_name LIKE 'pier_%' ORDER BY 1;
