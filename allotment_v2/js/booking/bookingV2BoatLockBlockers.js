/* ══ ด่านกัน · อะไรขวางอยู่บ้างก่อนจะล็อกลำนี้ ═══════════════════════════════════
   คืนรายการใบจองจริง ไม่ใช่แค่ true/false — คนกดต้องตัดสินใจว่าจะย้ายใบไหนไปลำอื่น
   การตอบว่า "ล็อกไม่ได้" เฉย ๆ ทำให้ต้องไปไล่หาเองว่าติดอะไร                    */
function bookingV2BoatLockBlockers(date, boatId, routeId, exceptId){
  const out = { rows:[], pax:0, cellBooked:0, charterOf:'', holdOf:'', short:0, sold:0, capAfter:0 };
  const op = (typeof TRIPS!=='undefined' && TRIPS[date]) ? TRIPS[date][boatId] : null;
  /* §bkLockEdit · ตอนแก้ใบ · ช่องที่ใบนี้ถืออยู่เองไม่นับว่าขวาง
     ไม่งั้นเปิดฟอร์มแก้แล้วลำของตัวเองขึ้นว่า "ถูกกันทั้งลำไว้แล้ว" เลือกกลับไม่ได้ */
  const mine = !!(exceptId && op && op.boatLockId===exceptId);
  if(op){
    if(op.charterBookingId) out.charterOf = op.charterBookingId;
    if(op.boatLockId && !mine) out.holdOf = op.boatLockId;
    out.cellBooked = Number(op.booked)||0;
  }
  /* ══ §bkLock · ที่นั่งที่ขายไปแล้วทั้งเส้นทาง ไม่ใช่แค่ที่ผูกกับลำนี้ ═══════════
     เจอตอนดูหน้า By trip ของจริง · 20 ก.ย. r10 ขายไปแล้ว 30 ที่ มีเรือลำเดียว
     แต่ลูกค้ายังไม่ถูก assign ลงลำ ด่านเดิมจึงเห็นว่า "ลำนี้ว่าง" แล้วปล่อยให้ล็อก
     ผลคือทริปเหลือความจุ 0 ที่ ขณะที่ลูกค้า 30 คนถือตั๋วอยู่ · ขึ้นว่า no boat
     เอาเรือที่ลูกค้าที่ขายไปแล้วต้องใช้ ไปกันให้เอเยนต์ไม่ได้ ไม่ว่าจะยังไม่ assign หรือไม่ */
  const _rid = routeId || (op && op.route) || '';
  /* §bkLockEdit · ลำที่ใบนี้ถืออยู่แล้ว ออกจากความจุของวันนั้นไปแล้วหนึ่งครั้ง
     หักซ้ำอีกรอบตรงนี้จะฟ้องว่าที่นั่งขาด ทั้งที่ไม่มีอะไรเปลี่ยน */
  if(_rid && typeof getAllotment==='function' && !mine){
    const A = getAllotment(_rid, date) || {};
    const cap = Number(A.availableCapacity)||0, sold = Number(A.seatsConsumed)||0;
    const mineCap = (typeof bookingV2BoatCapOn==='function') ? bookingV2BoatCapOn(boatId, date) : 0;
    out.sold = sold;
    out.capAfter = Math.max(0, cap - mineCap);
    out.short = Math.max(0, sold - out.capAfter);
  }
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(b=>{
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    const p = (typeof bkBoatPaxOnBoat==='function') ? bkBoatPaxOnBoat(b, date, boatId) : 0;
    if(p<=0) return;
    let fromLock = 0;
    (b.trips||[]).forEach(t=>{ if((t.date||'')!==date) return;
      (t.lockDraws||[]).forEach(x=>{ fromLock += Number(x.qty)||0; }); });
    out.rows.push({ id:b.id, vc:(b.voucherRef||b.code||b.id||''), pax:p, fromLock:fromLock,
      agentId:b.agentId||null, routeId:((b.trips||[]).find(t=>(t.date||'')===date)||{}).routeId||'' });
    out.pax += p;
  });
  out.rows.sort((a,b)=>b.pax-a.pax);
  return out;
}
