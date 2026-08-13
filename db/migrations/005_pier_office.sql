-- ============================================================
-- Migration 005: Pier Office (งาน Office ท่าเรือ)
--
-- 4 ตารางใหม่ · สต็อกหมุนเวียนของท่าเรือ (ตีนกบ · หน้ากาก · ผ้าเช็ดตัว)
-- และตารางคนลงเรือรายวัน · แยกขาดตามท่า (panwa / tublamu / ranong)
--
-- ก่อนหน้านี้ 4 คีย์นี้ไม่มีใน field_mapping.json ระบบจึงตกไปใช้เส้นทาง
-- legacy /api/save (ส่งทั้งก้อนทุกครั้งที่แก้) — ข้อมูลไม่หาย แต่ไม่เป็นตาราง
-- และไม่ได้ประโยชน์จาก per-entity REST batch
--
-- Safe: CREATE ... IF NOT EXISTS ทั้งหมด · idempotent รันซ้ำได้
-- ไม่แตะตารางเดิมและไม่แตะ public.*
-- ============================================================

CREATE SCHEMA IF NOT EXISTS operation_schemas;

-- ── ทะเบียนของ · 1 แถว = ของ 1 แบบ/ไซส์ ของ 1 ท่า ──────────────────────
-- total = จำนวนที่ซื้อเข้ามาทั้งหมด (ยอดตั้งต้น) ไม่ใช่ยอดคงเหลือ
CREATE TABLE IF NOT EXISTS operation_schemas."pier_items" (
    "id"     text,
    "pier"   text,
    "kind"   text,
    "label"  text,
    "total"  bigint,
    "active" boolean,
    "note"   text
);

-- ── การเคลื่อนไหวทุกครั้ง · ยอดคงเหลือคำนวณจากตารางนี้ ไม่เคยเก็บเป็นตัวเลข ──
-- type: issue | return | repair | fixed | writeoff | lost | onboard
--       | laundry_out | laundry_in | adjust
-- frombucket: ใช้เฉพาะ writeoff ที่ตัดออกจากกอง "รอซ่อม" (ค่า 'repair')
-- fine: ค่าปรับกรณีลูกค้าไม่คืน · เก็บแยกจากยอด Booking โดยตั้งใจ
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

-- ── พนักงานประจำท่า ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS operation_schemas."pier_staff" (
    "id"     text,
    "pier"   text,
    "nick"   text,
    "name"   text,
    "role"   text,
    "phone"  text,
    "active" boolean
);

-- ── คนลงเรือ · key = 'YYYY-MM-DD::boatId' · value = JSON array ของ staffId ──
-- เก็บค่าเป็น JSON text แบบเดียวกับ vanjob_sent · เพิ่มคนหรือเปลี่ยนรูปแบบ
-- ค่าไม่ต้องแตะ DB อีก (กันกับดักคอลัมน์ตายตัวแบบ trips b1…b15)
CREATE TABLE IF NOT EXISTS operation_schemas."pier_duty" (
    "id"    text,
    "key"   text,
    "value" text
);

-- ── ดัชนีที่ใช้จริงตอนอ่าน ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "pier_items_pier_idx"  ON operation_schemas."pier_items"  ("pier");
CREATE INDEX IF NOT EXISTS "pier_moves_pier_date" ON operation_schemas."pier_moves"  ("pier", "date");
CREATE INDEX IF NOT EXISTS "pier_moves_item_idx"  ON operation_schemas."pier_moves"  ("itemid");
CREATE INDEX IF NOT EXISTS "pier_staff_pier_idx"  ON operation_schemas."pier_staff"  ("pier");

-- ── ตรวจหลังรัน ─────────────────────────────────────────────────────────
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema='operation_schemas' AND table_name LIKE 'pier_%' ORDER BY 1;
