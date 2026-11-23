/* กรุ๊ปย่อยที่ยังจัดการได้ · Bulk แบบเก่าที่ระบบเคยตั้งว่า "ใช้หมด" ทั้งที่วันอื่นยังมีที่ ก็ยังกด +/คืน ได้ */
function bookingV2LockKidLive(c){ return !!c && (c.status==='active' || (c.status==='depleted' && bookingV2LockSpansDays(c) && (c.qty||0)>0)); }
