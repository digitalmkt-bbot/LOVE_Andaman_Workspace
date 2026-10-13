-- 033_van_stops.sql  (2026-09-30)
--
-- §vanStop · จุดแวะของรถที่ไม่ใช่ booking — ไกด์ติดรถไปท่า · แวะเอาของที่ออฟฟิศ
-- §lkBulk  · ช่วงวันของล็อกที่นั่งแบบ Bulk (เติมย้อนให้คอมมิต 247efd3 ที่ไม่มีไฟล์ migration)
--
-- ══ ทำไมไฟล์นี้ต้องมี ไม่ใช่แค่ CREATE ใน initDb() ══════════════════════════════
--
-- relLoad() ยิง `SELECT * FROM operation_schemas.<ตาราง>` ให้ทุกตารางใน OS_TABLES
-- พร้อมกันใน Promise.all ตัวเดียว ไม่มี try/catch รายตาราง
-- ตารางไหนไม่มีอยู่จริง = query นั้น reject = Promise.all reject = /api/load 500
-- ซึ่งแปลว่า "ทั้งแอปล่มสำหรับทุกคน" ไม่ใช่แค่ฟีเจอร์นี้ใช้ไม่ได้
--
-- initDb() ถูกเรียกแบบไม่ await (server.js ~บรรทัด 1902) แล้ว server.listen ทำงานต่อทันที
-- จึงมีช่องว่างหลัง deploy ที่เครื่องรับ request ได้แล้วแต่ตารางยังไม่ถูกสร้าง
-- ใครกด refresh พอดีในช่วงนั้นจะเจอแอปล่ม — และ van_stops เป็น "ตารางใหม่ทั้งตาราง"
-- ไม่ใช่แค่คอลัมน์ที่ขาด (SELECT * ไม่สนคอลัมน์ที่หายไป แต่สนตารางที่ไม่มี)
--
-- CLAUDE.md เขียนกฎนี้ไว้ตรง ๆ แล้ว:
--   "A field_mapping.json entry whose migration file is missing takes /api/load down
--    entirely, so ship the mapping and the migration in the same push."
-- ไฟล์นี้คือการทำตามกฎนั้น · migration ถูก await จริงตอนบูต และทิ้งแถวไว้ใน
-- allotment.schema_migrations ให้ตรวจย้อนได้ว่า prod รันโค้ดชุดไหนอยู่
--
-- ══ ของสองก้อนในไฟล์เดียว ═══════════════════════════════════════════════════════
--
-- 1) van_stops — ตารางใหม่ ทรงเดียวกับ van_bill (id · key · value เป็น JSON ทั้งก้อน)
--    คีย์ = 'YYYY-MM-DD::routeId::id' · หนึ่งจุดแวะหนึ่งแถว
--    ค่าเป็น JSON ก้อนเดียว → เพิ่มช่องในจุดแวะทีหลังไม่ต้องแตะ DB อีก
--    (kind/label/pax/time/place/zone/phone/note/vanId/vanGroup/vanSeq/ck)
--
-- 2) sb_seat_locks — ห้าคอลัมน์ของ §lkBulk ที่ initDb เติมให้อยู่แล้ว แต่ไม่มีไฟล์
--    migration รองรับ · ใส่ไว้ที่นี่ให้เป็น no-op บนฐานที่ ALTER ไปแล้ว และให้มี
--    ร่องรอยใน schema_migrations เหมือนของก้อนอื่น
--    อาการถ้าขาด: บันทึกล็อก Bulk ไม่ติด (INSERT อ้างคอลัมน์ที่ไม่มี) — ไม่ใช่แอปล่ม
--    เพราะ SELECT * ตอนโหลดไม่สนคอลัมน์ที่หายไป · ความเสี่ยงคนละระดับกับข้อ 1
--
-- Idempotent · CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS
-- เช็ค schema ก่อน จึงเป็น no-op บนฐานที่รันโหมด blob (ไม่มี operation_schemas)

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch) THEN

      -- 1) §vanStop · ตารางใหม่
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I.van_stops (id text PRIMARY KEY, key text, value text)', sch);

      -- 2) §lkBulk · ช่วงวัน/วันในสัปดาห์/โควตารายรอบ/รอบที่ปล่อยคืนแล้ว
      IF EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = sch AND table_name = 'sb_seat_locks') THEN
        EXECUTE format('ALTER TABLE %I.sb_seat_locks ADD COLUMN IF NOT EXISTS datefrom text',      sch);
        EXECUTE format('ALTER TABLE %I.sb_seat_locks ADD COLUMN IF NOT EXISTS dateto text',        sch);
        EXECUTE format('ALTER TABLE %I.sb_seat_locks ADD COLUMN IF NOT EXISTS dow text',           sch);
        EXECUTE format('ALTER TABLE %I.sb_seat_locks ADD COLUMN IF NOT EXISTS usedby text',        sch);
        EXECUTE format('ALTER TABLE %I.sb_seat_locks ADD COLUMN IF NOT EXISTS releaseddates text', sch);
      END IF;

      -- log[].tripDate · ใช้ไล่ว่าที่นั่งของรอบไหนถูกดึงหรือปล่อยตอนไหน
      IF EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = sch AND table_name = 'sb_seat_locks__log') THEN
        EXECUTE format('ALTER TABLE %I.sb_seat_locks__log ADD COLUMN IF NOT EXISTS tripdate text', sch);
      END IF;

    END IF;
  END LOOP;
END $$;

-- Verify:
--   SELECT 1 FROM information_schema.tables
--    WHERE table_schema='operation_schemas' AND table_name='van_stops';   -- must return 1 row
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema='operation_schemas' AND table_name='sb_seat_locks'
--      AND column_name IN ('datefrom','dateto','dow','usedby','releaseddates')
--    ORDER BY column_name;    -- must return all 5
