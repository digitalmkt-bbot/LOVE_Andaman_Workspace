function bookingV2PaySlipPick(bkId, inp){
  const fs=Array.from((inp&&inp.files)||[]); if(!fs.length) return;
  if(typeof pckSlipUpload!=='function'){ alert('แนบสลิปไม่ได้ในหน้านี้'); return; }
  const el=document.getElementById('bkv2-pay-slips'); if(el) el.textContent='กำลังอัปโหลด…';
  fs.forEach(function(f){ pckSlipUpload(f, bkId, function(meta){
    (_bkV2PaySlips[bkId]=_bkV2PaySlips[bkId]||[]).push(meta);
    /* pckSlipUpload ลงทะเบียนเป็น kind 'pier' (สลิปหน้าท่า) · Travel Summary ข้าม kind นั้น → เปลี่ยนเป็นสลิปของใบจอง */
    const _bb=(SB_BOOKINGS||[]).find(x=>x.id===bkId); if(_bb) (_bb.paymentSlips||[]).forEach(function(ps){ if(ps.id===meta.id) ps.kind='payment'; });
    try{ acctPersistBookings(); }catch(_){ }
    const e2=document.getElementById('bkv2-pay-slips'); if(e2) e2.innerHTML=bookingV2PaySlipList(bkId); }); });
  if(inp) inp.value='';
}
