-- 050_doc_seq.sql  (2026-11-14) · §docNo · ตัวนับเลขเอกสาร MO / MJ / INC ฝั่งเซิร์ฟเวอร์
--
-- ที่มา · MO-377 ซ้ำ 2 ใบ (กมลณัฐ 17:08:33 · Ruk 17:08:35) · เดิมเลขออกที่เครื่องผู้ใช้ = เลขสูงสุดที่เครื่องนั้นเห็น + 1
--   สองเครื่องกดพร้อมกัน → เห็น MO-376 เท่ากัน → ได้ 377 ทั้งคู่ · เคยเกิดแล้ว MO-077 · MO-117 · MO-262
-- ตอนนี้ตอนกดสร้าง เครื่องถาม POST /api/v1/_docno · เซิร์ฟเวอร์ล็อก (advisory lock ต่อชนิด) แล้วให้เลขถัดไป
--   = max(เลขสูงสุดในตาราง, last ในตารางนี้, เลขที่เครื่องคิดเอง - 1) + 1 · จองไว้ที่นี่ทันที กดพร้อมกันก็ไม่ซ้ำ
-- ตารางนี้ไม่อยู่ใน field_mapping (ไม่ขึ้น blob ไม่ถูก save ทับ) · เพิ่มอย่างเดียว · รันซ้ำได้

DO $$
DECLARE sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['operation_schemas','public'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = sch AND table_name = 'fleet_memos') THEN
      EXECUTE format('CREATE TABLE IF NOT EXISTS %I.doc_seq (kind text PRIMARY KEY, last bigint NOT NULL DEFAULT 0, at text, "by" text)', sch);
    END IF;
  END LOOP;
END $$;
