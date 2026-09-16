/* §exCot · เก็บเงินสดหน้าท่าแล้วกดปุ่มเดียวจบ · ถ้าเป็นโอน/บัตรให้กดแก้ไขแล้วเลือกวิธีเอง */
function bookingV2ExtraCollect(id, bkId){
  var e=SB_EXTRAS.find(function(x){ return x.id===id; }); if(!e) return;
  if(!confirm('ยืนยันว่าเก็บเงิน "'+(e.service||'')+'" ฿'+pckNum(e.total)
    +' เป็นเงินสดแล้ว\n\n(ถ้ารับเป็นโอน/บัตร ให้กดแก้ไขแทน)')) return;
  e.method='cash'; e.feePct=0; e.fee=0; e.customerPaid=+e.total||0;
  e.settle='done'; e.collectedAt=new Date().toISOString();
  var bk=(SB_BOOKINGS||[]).find(function(x){ return x.id===(bkId||e.bookingId); });
  if(bk && typeof bookingV2AddHistory==='function'){
    bookingV2AddHistory(bk,'extra','Collected on tour · '+(e.service||'')+' · ฿'
      +pckNum(e.total)+' (cash)','Extra');
    if(typeof acctPersistBookings==='function') acctPersistBookings();
  }
  sbExtrasPersist();
  try{ bookingV2Render(); }catch(_){}
  try{ if(typeof renderCheckinAll==='function') renderCheckinAll(); }catch(_){}   // §landCk
  bookingV2ExtraRender();
}
