-- 032_fleet_projects_docs.sql  (2026-09-19)
--
-- §projAttach · หน้า Project · เอกสาร/รูป/ผู้รับเหมาที่เข้ามาเยี่ยม ไม่เคยถูกเซฟเลยสักครั้ง
--
-- ตาราง fleet_projects บน prod มีแค่ 16 คอลัมน์ ซึ่งตรงกับ "ตอนสร้างโปรเจค" เป๊ะ
-- (id no name boatid type vendor planfrom planto actualfrom actualto status
--  plannedbudget notes createdat createdby originalplanto)
-- ส่วนฟิลด์ที่โผล่มาทีหลังตอนใช้งานจริง ไม่มีที่ลงสักตัว:
--
--   docs[]          การ์ด PROJECT DOCUMENTS + PHOTO GALLERY ทั้งใบ
--   vendorVisits[]  บันทึกผู้รับเหมาเข้าหน้างาน (การ์ด Activity)
--   phase           สเต็ปงาน planning/liftout/hull/mechanical/sea_trial/handover
--   holdReason/holdSince      ตอนกด Hold
--   cancelReason/cancelledOn  ตอนกด Cancel
--
-- อาการที่เห็น: กรอก/แนบได้ ไม่มี error แล้วรีเฟรชทีหายทุกครั้ง — ตรงกับที่ §mapDrift
-- ใน server.js เตือนไว้ทุกตัวอักษร เพราะ os_repo เดินจาก field_mapping.json ล้วน ๆ
-- ฟิลด์ที่ไม่มีใน mapping จึงถูกทิ้งตอน decompose และไม่โผล่กลับตอน assemble
--
-- เจอเพราะ 19 ก.ย. 2026 แนบรูปเข้า Photo Gallery แล้วรูปไม่ขึ้น · ตรวจ DB พบว่าไฟล์
-- ขึ้น allotment.attachments เรียบร้อย (proj_proj_2026_b4_018_uw1h สองไฟล์) แต่ ref
-- ไม่ได้อยู่ใน operation_schemas.fleet_projects เลย = ฝั่งอัปโหลดไม่ผิด ฝั่งเก็บ ref ผิด
--
-- docs[] กับ vendorVisits[] เก็บเป็น json_text ก้อนเดียว ไม่แตกตารางลูก:
-- แถวใน docs[] ไม่ได้หน้าตาเหมือนกัน (เอกสารมี status/url · รูปมี phase/attId/mime)
-- และมันคือ ref ล้วน ๆ ไฟล์จริงอยู่ในตาราง attachments อยู่แล้ว — โครงเดียวกับ
-- sb_bookings.attachments / sb_extras.slips / ts_cot.slips ที่ทำแบบนี้อยู่ก่อนแล้ว
--
-- ⚠ ต้องมาคู่กับ field_mapping.json + operation_schemas_model.json ในพุชเดียวกันเสมอ
--   ขาดไฟล์ไหนไฟล์หนึ่ง = ข้อมูลหายเงียบ หรือ INSERT พังทั้งชุด (ดู §mapDrift/§dbDrift)
--
-- Idempotent · ADD COLUMN IF NOT EXISTS · กันไว้ด้วยการเช็ค schema/table ก่อน
-- จึงเป็น no-op บนฐานที่รันโหมด blob

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch)
       AND EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = sch AND table_name = 'fleet_projects') THEN
      EXECUTE format('ALTER TABLE %I.fleet_projects ADD COLUMN IF NOT EXISTS docs text',         sch);
      EXECUTE format('ALTER TABLE %I.fleet_projects ADD COLUMN IF NOT EXISTS vendorvisits text', sch);
      EXECUTE format('ALTER TABLE %I.fleet_projects ADD COLUMN IF NOT EXISTS phase text',        sch);
      EXECUTE format('ALTER TABLE %I.fleet_projects ADD COLUMN IF NOT EXISTS holdreason text',   sch);
      EXECUTE format('ALTER TABLE %I.fleet_projects ADD COLUMN IF NOT EXISTS holdsince text',    sch);
      EXECUTE format('ALTER TABLE %I.fleet_projects ADD COLUMN IF NOT EXISTS cancelreason text', sch);
      EXECUTE format('ALTER TABLE %I.fleet_projects ADD COLUMN IF NOT EXISTS cancelledon text',  sch);
    END IF;
  END LOOP;
END $$;

-- Verify:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema='operation_schemas' AND table_name='fleet_projects'
--      AND column_name IN ('docs','vendorvisits','phase','holdreason','holdsince',
--                          'cancelreason','cancelledon')
--    ORDER BY column_name;    -- must return all 7
