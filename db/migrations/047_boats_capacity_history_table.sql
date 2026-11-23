-- 047_boats_capacity_history_table.sql  (2026-11-14)
--
-- §capHist · ที่นั่งของเรือแบบมีช่วงวันที่
-- owner: "มันมีปรับเปลี่ยนที่นั่งเพิ่ม เราจะไปแก้ตรงไหน ถ้าแก้ตรงที่เดิม กลัวจะมีผลกระทบกับที่ผ่านมา"
--
-- เดิม boats.cap มีค่าเดียว ทุกวัน (รวมวันที่ผ่านมาแล้ว) อ่านค่าปัจจุบันสด ๆ → แก้ที่นั่งแล้ว Fill % / ที่ว่าง
-- ของวันเก่าเปลี่ยนตาม · ตารางนี้เก็บช่วง {from, to?, cap, reason, note} ต่อเรือ (client: boats[].capHist[])
--
-- ลำดับความสำคัญของที่นั่งในวันหนึ่ง (ตรงกับ client boatCapInfo / boatCapHistAt):
--   1. boat_capovr  · ปรับเฉพาะวัน (ของเดิม)
--   2. boats__capacity_history · ช่วงที่คลุมวันนั้น · ช่วงชั่วคราว (มีวันจบ) ชนะช่วงถาวร · ถัดมา from ล่าสุด · ถัดมา at ล่าสุด
--   3. boats.cap · ค่าตั้งต้น
--
-- v_boat_capacity_effective = boat_capovr + แถวที่สร้างจากช่วง (เฉพาะวันที่มีแถวใน trips = วันที่จัดเรือ) ในรูปแบบคีย์เดียวกัน
-- '<date>::<boatId>' · ทุกที่ที่เคยอ่าน boat_capovr (view ที่นั่งว่าง · /v1 availability · B2C) จึงเปลี่ยนแค่ชื่อแหล่ง
--
-- view ที่อ้าง boat_capovr (เช่น v_seat_availability) · ตัวใน repo เพี้ยนจากตัวจริงบน prod (ดู server.js §migrations)
-- จึงไม่สร้างจากไฟล์ · อ่านนิยามจริงจาก pg_views แล้วเปลี่ยนเฉพาะชื่อตาราง boat_capovr → v_boat_capacity_effective
-- คอลัมน์ที่ใช้ (o.key, o.cap) มีครบใน view ใหม่ · ถ้าไม่มี caphist เลย ผลลัพธ์เท่าเดิมทุกแถว
--
-- เพิ่มอย่างเดียว · ไม่แตะข้อมูลเดิม · รันซ้ำได้

-- ไฟล์นี้: ตาราง boats__capacity_history อย่างเดียว (แยกจาก 048 ที่แตะ view · ถ้า 048 ล้ม ตารางยังอยู่ /api/load ไม่พัง)

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = sch AND table_name = 'boats') THEN
      CONTINUE;
    END IF;

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I."boats__capacity_history" (
        boats_id text, idx bigint, row_pk text PRIMARY KEY, id text,
        "from" text, "to" text, cap bigint, reason text, note text, "by" text, at text)', sch);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_boats_capacity_history_boat ON %I."boats__capacity_history"(boats_id)', sch);
    -- FK แบบเดียวกับ boats__log · ถ้าเพิ่มไม่ได้ (เช่น boats ใน schema นั้นไม่มี PK) ข้ามไป ไม่ให้ทั้งไฟล์ล้ม
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_boats_capacity_history'
                     AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = sch)) THEN
        EXECUTE format('ALTER TABLE %I."boats__capacity_history" ADD CONSTRAINT fk_boats_capacity_history
                        FOREIGN KEY (boats_id) REFERENCES %I.boats(id) ON DELETE CASCADE', sch, sch);
      END IF;
    EXCEPTION WHEN others THEN
      RAISE NOTICE '047 · %.boats__capacity_history FK skipped: %', sch, SQLERRM;
    END;

  END LOOP;
END $$;
