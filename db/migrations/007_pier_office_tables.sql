-- ============================================================
-- Migration 007: Pier Office · ตารางที่ค้างอยู่ ยังไม่เคยถูกสร้างบน prod
--
-- ทำไมต้องมีไฟล์นี้
--   /api/load พังทั้งหน้า · 500 "relation operation_schemas.pier_staff does not exist"
--   relLoad() ยิง SELECT * FROM ทุกตารางใน operation_schemas_model.json พร้อมกันใน
--   Promise.all เดียว ⇒ ขาดตารางเดียว = reject ทั้งก้อน = แอปโหลดข้อมูลไม่ได้เลย
--   (ไม่ใช่แค่หน้า Pier Office เสีย · ทั้งระบบโหลดไม่ขึ้น)
--
--   การเพิ่มตารางลง model ไม่ได้สร้างตารางให้ · model คือ "แผนอ่าน/เขียน" เฉยๆ
--   ตารางเกิดได้ 2 ทางเท่านั้น และต้องมีคนทำเอง:
--     1) เติม CREATE TABLE IF NOT EXISTS ในบล็อก migration ตอน boot (server.js)
--        — แบบที่ boat_capovr / travel_sum / ts_cot ใช้ · pier_* ไม่มีสักตัว
--     2) ไฟล์ migration แล้วรัน tools/apply-migration.js
--   งาน Pier Office หลุดทั้งสองทาง: โค้ดขึ้น prod ทันทีที่ push (model เป็นไฟล์ในรีโป)
--   แต่ schema ไม่ขึ้นตาม เพราะต้องมีคนสั่งรัน
--
-- ขอบเขต: ครบทั้ง 10 ตาราง
--   pier_items · pier_moves · pier_staff · pier_duty   ← ไม่เคยมี migration ที่ไหนเลย
--       (มาจาก 38ecae5 ซึ่งแตะแค่ allotment_v2.html · DDL มีแต่ใน
--        operation_schemas_structure.sql ซึ่งเป็นไฟล์อ้างอิง ไม่มีอะไรรันมัน)
--   pier_team · pier_job · pier_cfg · pier_lic_types · pier_lic_classes · pier_licenses
--       ← ซ้ำกับ 006 โดยตั้งใจ · 006 ไม่เคยถูกรันบน prod เลย ใส่ไว้ให้ไฟล์เดียวปิดจบ
--         ทั้งช่องว่างได้ ไม่ต้องลุ้นว่ารัน 006 หรือยัง · IF NOT EXISTS ทั้งหมด
--         รันซ้ำ/รันสลับลำดับกับ 006 ก็ไม่มีผล
--
-- ทุกคอลัมน์ตรงกับ operation_schemas_model.json ที่โค้ดกำลังรันอยู่จริง (ตรวจแล้วครบ 10/10)
-- Safe: CREATE ... IF NOT EXISTS ล้วน · ไม่แตะตารางเดิม · ไม่แตะ public.*
-- ============================================================

CREATE SCHEMA IF NOT EXISTS operation_schemas;

-- ── ของประจำท่า · ถังกลางต่อท่า (เสื้อชูชีพ ถังน้ำ ฯลฯ) ────────────────
CREATE TABLE IF NOT EXISTS operation_schemas."pier_items" (
    "id"     text,
    "pier"   text,
    "kind"   text,
    "label"  text,
    "total"  bigint,
    "active" boolean,
    "note"   text
);

-- ── การเบิก/คืนของรายวัน · frombucket = เบิกจากถังไหน · fine = ค่าปรับของหาย ──
CREATE TABLE IF NOT EXISTS operation_schemas."pier_moves" (
    "id"         text,
    "date"       text,
    "pier"       text,
    "itemid"     text,
    "boatid"     text,
    "type"       text,
    "qty"        bigint,
    "frombucket" text,
    "fine"       double precision,
    "finepaid"   boolean,
    "note"       text,
    "by"         text,
    "at"         text
);

-- ── คนประจำท่า · ตารางที่ทำให้ /api/load พังทั้งระบบ ─────────────────────
CREATE TABLE IF NOT EXISTS operation_schemas."pier_staff" (
    "id"     text,
    "pier"   text,
    "nick"   text,
    "name"   text,
    "role"   text,
    "phone"  text,
    "active" boolean
);

-- ── เวรประจำวัน · keyed map เก็บค่าเป็น JSON text ───────────────────────
CREATE TABLE IF NOT EXISTS operation_schemas."pier_duty" (
    "id"    text,
    "key"   text,
    "value" text
);

-- ── ต่อจากนี้ซ้ำกับ 006 · idempotent · เผื่อ 006 ไม่เคยถูกรัน ────────────
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

CREATE TABLE IF NOT EXISTS operation_schemas."pier_lic_types" (
    "id"      text,
    "side"    text,
    "short"   text,
    "formal"  text,
    "perboat" bigint,
    "active"  boolean
);

CREATE TABLE IF NOT EXISTS operation_schemas."pier_lic_classes" (
    "id"     text,
    "typeid" text,
    "name"   text,
    "maxgt"  double precision,
    "maxbhp" double precision,
    "ord"    bigint
);

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
CREATE INDEX IF NOT EXISTS "pier_moves_date_idx"     ON operation_schemas."pier_moves"      ("date");
CREATE INDEX IF NOT EXISTS "pier_moves_item_idx"     ON operation_schemas."pier_moves"      ("itemid");
CREATE INDEX IF NOT EXISTS "pier_staff_pier_idx"     ON operation_schemas."pier_staff"      ("pier");
CREATE INDEX IF NOT EXISTS "pier_licenses_staff_idx" ON operation_schemas."pier_licenses"   ("staffid");
CREATE INDEX IF NOT EXISTS "pier_licenses_exp_idx"   ON operation_schemas."pier_licenses"   ("exp");
CREATE INDEX IF NOT EXISTS "pier_lic_classes_type"   ON operation_schemas."pier_lic_classes" ("typeid");

-- ── ตรวจหลังรัน · ต้องได้ครบ 10 แถว ─────────────────────────────────────
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema='operation_schemas' AND table_name LIKE 'pier\_%' ORDER BY 1;
--
-- แล้วเช็คว่า /api/load กลับมา 200 (เดิม 500):
--   curl -s -o /dev/null -w "%{http_code}\n" <prod>/api/load  -- ต้องมี cookie sess
