/* ══ §selfLeg · ติ๊ก "มาเอง" = ขาไปเดินทางเอง · ขากลับรถยังส่ง ═══════════════
   ผู้ใช้แจ้ง 19 พ.ย. · ใบงานรถตัดขาไปถูกแล้ว แต่หน้า By trip date ยังโชว์เวลารับกับชื่อโรงแรม
   เหมือนรถต้องไปรับ และหัวกรุ๊ปนับรวมคนที่มาเอง → ยอดไม่ตรงกับใบงานขาไป
   แก้ที่การแสดงผลอย่างเดียว · ไม่แตะข้อมูลบุคกิ้ง */
function bookingV2SelfRetToo(bk,date){ try{ return !!(typeof bookingV2RetInfo==='function' && bookingV2RetInfo(bk,date).selfRet); }catch(_){ return false; } }
