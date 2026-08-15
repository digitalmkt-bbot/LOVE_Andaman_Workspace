-- 014 · booking food-allergy chips + columns the mapping expects that no migration ever created
--
-- specialMeals.allergyList คือรายการแพ้อาหารแบบชิป [{name, qty}] ที่หน้า Booking เขียนลงใบจอง
-- แต่ไม่เคยมีคอลัมน์รองรับในทั้งสองไฟล์แม็ปและในฐานข้อมูล
-- ตัวแปลง blob -> rows จึงทิ้งมันทุกครั้งที่เซฟ · ผู้ใช้กรอกได้ ไม่มี error แล้วรีเฟรชทีหาย
-- เก็บทั้งก้อนเป็น JSON ในคอลัมน์เดียว แบบเดียวกับ approval_over ที่ทำไว้ก่อนหน้า
--
-- ส่วนที่เหลือคือคอลัมน์ที่อยู่ใน operation_schemas_model.json มานานแล้ว แต่ไม่เคยมีใน migration ไหนเลย
-- ฐานข้อมูลที่ใช้อยู่มีครบเพราะเคยเติมด้วยมือ · แต่ถ้าสร้างฐานใหม่จากไฟล์ migration ล้วน ๆ
-- คำสั่ง INSERT ของทุกใบจองจะพังทั้งชุด เพราะโค้ดยิงคอลัมน์ตามที่ model บอก ไม่ได้เช็คว่ามีจริงไหม
-- ผลคือ transaction rollback ทั้งก้อน = เซฟไม่ติดเลยสักฟิลด์ · ปิดช่องนั้นด้วย IF NOT EXISTS

ALTER TABLE operation_schemas.sb_bookings ADD COLUMN IF NOT EXISTS altpickups text;
ALTER TABLE operation_schemas.sb_bookings ADD COLUMN IF NOT EXISTS approval_over text;
ALTER TABLE operation_schemas.sb_bookings ADD COLUMN IF NOT EXISTS attachments text;
ALTER TABLE operation_schemas.sb_bookings ADD COLUMN IF NOT EXISTS b2coverride text;
ALTER TABLE operation_schemas.sb_bookings ADD COLUMN IF NOT EXISTS doccheck text;
ALTER TABLE operation_schemas.sb_bookings ADD COLUMN IF NOT EXISTS incomplete text;
ALTER TABLE operation_schemas.sb_bookings ADD COLUMN IF NOT EXISTS ops_boatsplits text;
ALTER TABLE operation_schemas.sb_bookings ADD COLUMN IF NOT EXISTS ops_piercheckin text;
ALTER TABLE operation_schemas.sb_bookings ADD COLUMN IF NOT EXISTS ops_piernote text;
ALTER TABLE operation_schemas.sb_bookings ADD COLUMN IF NOT EXISTS ops_vancheckin text;
ALTER TABLE operation_schemas.sb_bookings ADD COLUMN IF NOT EXISTS ops_vansplits text;
ALTER TABLE operation_schemas.sb_bookings ADD COLUMN IF NOT EXISTS paymentslips text;
ALTER TABLE operation_schemas.sb_bookings ADD COLUMN IF NOT EXISTS paymentsnapshot_paid bigint;
ALTER TABLE operation_schemas.sb_bookings ADD COLUMN IF NOT EXISTS paymentsnapshot_paidstatus text;
ALTER TABLE operation_schemas.sb_bookings ADD COLUMN IF NOT EXISTS pierpayments text;
ALTER TABLE operation_schemas.sb_bookings ADD COLUMN IF NOT EXISTS specialmeals_allergylist text;
