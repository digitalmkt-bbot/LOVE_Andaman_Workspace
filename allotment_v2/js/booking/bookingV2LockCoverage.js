/* ══ §lkCover · อีกด้านของการตรวจ ═════════════════════════════════════════════
   bookingV2LockAudit ถามว่า "ตัวนับตรงกับใบจองที่อ้างถึงล็อกไหม"
   ตัวนี้ถามกลับด้าน "ใบจองของเจ้านี้บนทริปนี้ ดึงจากล็อกครบทุกที่หรือเปล่า"
   ที่นั่งที่ไม่ได้ดึง = ไปกิน pool ทั่วไปแทน ทั้งที่ล็อกยังเหลือ · ล็อกก็ค้างไม่ถูกใช้
   ═══════════════════════════════════════════════════════════════════════════════ */
function bookingV2LockCoverage(l, date){
  const d = date || l.date || '';
  if(!d || !l.routeId || bookingV2LockSpansDays(l)) return null;      /* ล็อกแบบช่วงต้องเลือกวันก่อน ยังไม่รองรับ */
  const mine = {}; mine[l.id]=1;
  bookingV2LockChildren(l.id).forEach(c => { mine[c.id]=1; });        /* ล็อกแม่ = นับกรุ๊ปย่อยของตัวเองด้วย */
  const rows = [];
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(b => {
    if(['cancelled','rejected','cancelled_weather'].indexOf(b.status)>=0) return;
    if(l.holderType==='agent' && b.agentId!==l.holderId) return; /* ล็อกของ office/global ดูทุกใบบนทริป */
    (b.trips||[]).forEach(t => {
      if(t.routeId!==l.routeId || t.date!==d) return;
      if(t.bookingMode==='charter') return;                      /* เหมาลำไม่กินที่จาก pool */
      const pax = (typeof bookingV2PaxAllTot==='function') ? bookingV2PaxAllTot(t.pax||{}) : 0;
      if(!pax) return;
      let self=0, other=0;
      (t.lockDraws||[]).forEach(x => { const q=Number(x.qty)||0; if(mine[x.lockId]) self+=q; else other+=q; });
      rows.push({ id:b.id, vc:(b.voucherRef||b.code||b.id||''), lead:String(b.leadPax||'').trim(),
                  pax:pax, self:self, other:other, pool:Math.max(0, pax-self-other) });
    });
  });
  rows.sort((a,b)=> (b.pool-a.pool) || String(a.vc).localeCompare(String(b.vc)));
  const sum = rows.reduce((o,r)=>({ pax:o.pax+r.pax, self:o.self+r.self, other:o.other+r.other, pool:o.pool+r.pool }),
                          {pax:0,self:0,other:0,pool:0});
  return { date:d, rows:rows, bookings:rows.length, pax:sum.pax, self:sum.self, other:sum.other, pool:sum.pool };
}
