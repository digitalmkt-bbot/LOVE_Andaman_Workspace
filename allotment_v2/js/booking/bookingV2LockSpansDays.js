// §lkBulk · ล็อกที่กินหลายวัน (bulk · และ month ของเก่า) มีโควตาแยกรายรอบ
function bookingV2LockSpansDays(l){ return !!l && (l.scope==='bulk' || l.scope==='month'); }
