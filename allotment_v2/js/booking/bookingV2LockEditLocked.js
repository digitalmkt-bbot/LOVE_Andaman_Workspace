/* ล็อกที่ขายไปแล้ว · ที่นั่งที่ดึงไปผูกกับเส้นทาง+วันของล็อกใบนี้อยู่
   ย้ายทีหลัง = ใบจองชี้ไปล็อกที่ไม่ครอบวันของตัวเองแล้ว · ห้ามไว้ดีกว่า */
function bookingV2LockEditLocked(l){
  if(!l) return false;
  const usedAny = (Number(l.used)||0) > 0 ||
    Object.keys(l.usedBy||{}).some(k=>(Number(l.usedBy[k])||0)>0);
  const kidUsed = (typeof bookingV2LockChildren==='function')
    ? bookingV2LockChildren(l.id).some(c=>(Number(c.used)||0)>0 ||
        Object.keys(c.usedBy||{}).some(k=>(Number(c.usedBy[k])||0)>0)) : false;
  return usedAny || kidUsed;
}
