// n=null → เด้งกลับไปพรุ่งนี้ · ใส่ตัวเลขคือเลื่อนทีละวัน
function bookingV2LockDayShift(n){ _bkV2LockUI.dayOff = (n==null) ? 1 : (_bkV2LockUI.dayOff||0)+n; bookingV2Render(); }
