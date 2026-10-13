function bookingV2RtKeepUse(mode){
  const d = _bkV2 && _bkV2.newBooking, K = d && d._rtKeep; if(!K) return;
  const P = bookingV2RtKeepPair();
  K.mode = (mode==='now') ? 'now' : 'keep';
  /* ชุดที่ใบจำไว้เดินตามที่เลือก · บันทึกแล้วครั้งหน้าที่เปิด "เรทเดิม" ของใบจะเป็นชุดนี้ */
  if(K.mode==='now'){ if(P && P.cur) d.rateTypeRef = P.cur.id; }
  else d.rateTypeRef = K.ref;
  bookingV2Render();
}
