-- ============================================================
-- Migration 008: pier_staff.defcode
--
-- รหัสตั้งต้นรายคนในตารางการทำงาน · ใช้เมื่อวันนั้นท่ามีใบงานแล้ว
-- แต่คนคนนี้ไม่ได้ถูกจัดลงเรือ (ลูกเรือมัก LWOP · ออฟฟิศมัก SE)
--
-- เพิ่มมาใน migration 007 ฝั่งแอปแล้ว แต่ลืมใส่คอลัมน์ใน mapping
-- ถ้าไม่มีคอลัมน์นี้ ค่าที่กรอกจะหายตอน sync ขึ้น SQL แบบเงียบ ๆ
--
-- Safe: ADD COLUMN IF NOT EXISTS · idempotent · ไม่แตะข้อมูลเดิม
-- ============================================================

ALTER TABLE operation_schemas."pier_staff"
  ADD COLUMN IF NOT EXISTS "defcode" text;

-- ตรวจหลังรัน
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema='operation_schemas' AND table_name='pier_staff' ORDER BY 1;
