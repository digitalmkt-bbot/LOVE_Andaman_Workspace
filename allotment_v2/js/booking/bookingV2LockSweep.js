/* ══ §lkSweep · ไล่ทุกล็อคหาที่นั่งที่กันไว้แต่ไม่มีใบจองจริงรออยู่ ═══════════
   3 อาการ · (1) ใบย้ายวันไปแล้วแต่ที่นั่งค้างอยู่กับล็อคของวันเดิม
             (2) ใบถูกยกเลิกแต่ตัวนับยังไม่ลด
             (3) ล็อคแม่แบ่งกรุ๊ปย่อยจนหมด แต่ตัวเองยังขายไปอีก = จ่ายเกินจำนวนที่มี
   อาการ 1-2 แก้ได้ด้วยการตั้งตัวนับใหม่ให้ตรงใบจอง · อาการ 3 ต้องตัดสินใจเอง
   ══════════════════════════════════════════════════════════════════════════ */
function bookingV2LockSweep(){
  const L=(typeof SB_SEAT_LOCKS!=='undefined'?SB_SEAT_LOCKS:[]);
  const rows=[], over=[];
  let seatsMoved=0, seatsDead=0, seatsOver=0;
  L.forEach(l=>{
    const A=bookingV2LockAudit(l);
    if(A.diff>0){
      const mv=A.claims.filter(c=>c.moved).reduce((n,c)=>n+c.qty,0);
      const dd=A.claims.filter(c=>c.dead&&!c.moved).reduce((n,c)=>n+c.qty,0);
      seatsMoved+=Math.min(A.diff,mv); seatsDead+=Math.max(0,A.diff-mv);
      rows.push({ id:l.id, name:bookingV2LockHolderName(l)+(l.parentId?(' · '+(l.subName||'ย่อย')):''),
        date:bookingV2LockDateOf(l)||(l.dateFrom||l.date||''), routeId:l.routeId||'',
        qty:l.qty||0, used:A.used, live:A.live, diff:A.diff, moved:mv, dead:dd,
        vcs:A.claims.filter(c=>c.dead).map(c=>c.vc+(c.qty>1?(' ×'+c.qty):'')+(c.moved?' (ย้ายวัน)':' (ยกเลิก)')) });
    }
    if(!l.parentId){
      const kids=bookingV2LockChildren(l.id);
      if(kids.length){
        const un=bookingV2LockUnalloc(l), pu=Number(l.used)||0;
        if(pu>un){ seatsOver+=(pu-un);
          over.push({ id:l.id, name:bookingV2LockHolderName(l), date:bookingV2LockDateOf(l)||(l.dateFrom||l.date||''),
            routeId:l.routeId||'', qty:l.qty||0, alloc:bookingV2LockAllocated(l), unalloc:un, used:pu, over:pu-un }); }
      }
    }
  });
  rows.sort((a,b)=> b.diff-a.diff || String(a.date).localeCompare(String(b.date)));
  over.sort((a,b)=> b.over-a.over || String(a.date).localeCompare(String(b.date)));
  return { rows, over, locks:L.length, nBad:rows.length, nOver:over.length,
           seats:rows.reduce((n,r)=>n+r.diff,0), seatsMoved, seatsDead, seatsOver };
}
