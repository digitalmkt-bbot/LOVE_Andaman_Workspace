-- 034_seat_lock_pending.sql  (2026-10-02)
--
-- §lkPend · ล็อกที่นั่งแบบรอที่ว่าง (Pending)
--
-- ที่มา · ผู้ใช้ตรวจแล้วพบว่า "ที่นั่งไม่ว่างแล้ว แต่ล็อกเพิ่มได้" — ไม่มีด่านไหนเช็คที่ว่างเลย
-- ตอนนี้ที่ไม่ว่างยังรับคำขอล็อกได้ แต่ส่วนที่เกินเป็น Pending = ไม่กันที่นั่ง ดึงไปจองไม่ได้
-- จนกว่าจะมีที่ว่างแล้วมีคนกดยืนยัน
--
--   pendqty  bigint · ล็อกรายวัน   · ส่วนของ qty ที่ยังรอที่ว่าง
--                     เป็นตัวเลขธรรมดา เพราะ SQL ใน server.js (ตาข่ายกันขายเกิน + ที่ว่างรายวัน)
--                     ต้องหักมันออกจาก qty ตรง ๆ
--   pendby   text   · ล็อกแบบช่วง · JSON {วันเดินทาง: จำนวนที่ยังรอ} · บางรอบเต็มบางรอบว่าง
--
-- ทำไมต้องมีไฟล์นี้ ไม่ใช่แค่ ALTER ใน initDb() · field_mapping.json มีสองคอลัมน์นี้แล้ว
-- _restInsertRows ยิงคอลัมน์ตาม model ล้วน ๆ · ขาดคอลัมน์เดียว INSERT ของ sb_seat_locks พังทั้งชุด
-- initDb() ไม่ถูก await ตอนบูต จึงมีช่องว่างหลัง deploy · migration ถูก await จริง (ดู 033)
--
-- ยังไม่ได้แตะ view v_seat_availability · ตัวที่อยู่ใน repo เพี้ยนจากตัวจริงบน prod (ดู server.js §migrations)
-- view นั้นจึงยังนับ pendqty เป็นที่นั่งที่กันไว้ = ตอบว่าที่ว่างน้อยกว่าจริง (ผิดไปทางปลอดภัย ไม่ขายเกิน)
--
-- ADD COLUMN IF NOT EXISTS · รันซ้ำได้ ไม่แตะข้อมูลเดิม · ค่าเริ่มต้น NULL = ไม่มีส่วนที่รอ

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = sch AND table_name = 'sb_seat_locks') THEN
      EXECUTE format('ALTER TABLE %I.sb_seat_locks ADD COLUMN IF NOT EXISTS pendqty bigint', sch);
      EXECUTE format('ALTER TABLE %I.sb_seat_locks ADD COLUMN IF NOT EXISTS pendby text',    sch);
    END IF;
  END LOOP;
END $$;
