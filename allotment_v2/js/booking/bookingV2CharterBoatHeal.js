function bookingV2CharterBoatHeal(date){
  let healed=0;
  (typeof SB_BOOKINGS!=='undefined'?SB_BOOKINGS:[]).forEach(b=>{ if(['cancelled','rejected','cancelled_weather'].includes(b.status))return;
    const t=(b.trips||[]).find(t=>(!date||(t.date||'')===date) && t.bookingMode==='charter' && t.charterBoatId);
    if(typeof bkBoatSplits==='function' && bkBoatSplits(b,date)) return;   // §boatSplit · แยกลำไว้แล้ว อย่าทับ
    if(!t) return;
    /* §chOpsSync · เดิมเติมให้เฉพาะตอนช่องว่าง · ใบที่เคยเปลี่ยนลำก่อนมีตัว sync
       จะค้างลำเก่าไว้ตลอด เปิดหน้ากี่ทีก็ไม่หาย · แก้ให้ตรงตอนรู้วันแน่ชัดเท่านั้น
       (date ว่าง = เรียกรวมทุกวัน · t อาจเป็นของคนละวันกับ ops ที่อ่านมา ห้ามทับ) */
    const _chO=bkOpsRead(b,date);
    if(!_chO.boatId){ bkOpsFor(b,date).boatId=t.charterBoatId; healed++; return; }
    if(date && (t.date||'')===date && _chO.boatId!==t.charterBoatId){
      bkOpsFor(b,date).boatId=t.charterBoatId; healed++;
    }
  });
  if(healed && typeof acctPersistBookings==='function') acctPersistBookings();
  return healed;
}
