-- 035_trip_upgrade.sql  (2026-10-03)
--
-- §upgRoute · Upgrade = ย้ายลูกค้าไปวิ่งอีกเส้นทางหนึ่ง
--
-- ที่มา · ปุ่ม ⤴ ในช่อง Boat ของหน้า By trip เดิมเป็นแค่ธง (ops.upgrade) ที่ไม่มีคอลัมน์ในฐานข้อมูล
-- โหลดหน้าใหม่ก็หาย ยอดเก็บเพิ่มที่ใส่ไว้ไม่มีหน้าไหนอ่าน
-- ตอนนี้ทริปย้ายเส้นทางจริง (routeid = ปลายทาง) และจำที่มาไว้ที่ trip.upg
--
--   ops_upgrade  text · JSON { fromRouteId, toRouteId, date, reason, charge, upgId, by, at }
--                ชื่อขึ้นต้น ops_ โดยตั้งใจ · ตัว sync B2C เก็บทุกคอลัมน์ ops_* ของทริปไว้ข้ามการลบแล้วใส่ใหม่
--                (TRIP_OPS ใน server.js) แล้วใช้ค่านี้คืนเส้นทางปลายทางหลัง B2C ส่งทริปเดิมกลับมา
--
-- ทำไมต้องมีไฟล์นี้ ไม่ใช่แค่ ALTER ใน initDb() · field_mapping.json มีคอลัมน์นี้แล้ว
-- _restInsertRows ยิงคอลัมน์ตาม model ล้วน ๆ · ขาดคอลัมน์เดียว INSERT ของ sb_bookings__trips พังทั้งชุด
-- initDb() ไม่ถูก await ตอนบูต จึงมีช่องว่างหลัง deploy · migration ถูก await จริง (ดู 033 / 034)
--
-- ADD COLUMN IF NOT EXISTS · รันซ้ำได้ ไม่แตะข้อมูลเดิม · ค่าเริ่มต้น NULL = ไม่ได้ upgrade

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = sch AND table_name = 'sb_bookings__trips') THEN
      EXECUTE format('ALTER TABLE %I.sb_bookings__trips ADD COLUMN IF NOT EXISTS ops_upgrade text', sch);
    END IF;
  END LOOP;
END $$;
