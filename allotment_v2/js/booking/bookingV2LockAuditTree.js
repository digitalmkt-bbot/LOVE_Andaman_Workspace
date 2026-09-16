/* ตรวจทั้งล็อกแม่และกรุ๊ปย่อยทีเดียว · เลขที่หน้าจอโชว์เป็นยอดรวมของทั้งต้นไม้ */
function bookingV2LockAuditTree(parent){
  const ls = [parent].concat(bookingV2LockChildren(parent.id));
  let used=0, live=0, dead=0, bad=0, moved=0;
  ls.forEach(l => { const a=bookingV2LockAudit(l); used+=a.used; live+=a.live; dead+=a.dead;
    moved+=a.claims.filter(c=>c.moved).reduce((n,c)=>n+c.qty,0);
    if(a.diff!==0) bad++; });
  return { used, live, dead, moved, diff:used-live, bad, count:ls.length };
}
