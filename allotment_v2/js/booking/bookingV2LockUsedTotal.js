// §lkBulk · ทุกตัวรับ date ได้ · ใส่ date = คิดของรอบนั้น · ไม่ใส่ = ยอดสะสม (ใช้ในรายงาน)
function bookingV2LockUsedTotal(l, date){ return bookingV2LockUsedOn(l,date) + bookingV2LockChildren(l.id).reduce((s,c)=>s+bookingV2LockUsedOn(c,date),0); }
