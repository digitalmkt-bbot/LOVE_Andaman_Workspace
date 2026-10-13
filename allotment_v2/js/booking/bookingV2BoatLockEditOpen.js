/* §bkLockEdit · ฟอร์มเดียวกับตอนสร้าง · editId บอกว่ากำลังแก้ใบไหน */
function bookingV2BoatLockEditOpen(id){
  const l = bookingV2BoatLockById(id); if(!l || l.status!=='active') return;
  if(typeof window.laGuardEdit==='function' && !window.laGuardEdit('operations')) return;
  _bkBoatForm = { editId:l.id, routeId:l.routeId, date:l.date, boatId:l.boatId,
    holderType:(l.holderType==='agent'?'agent':'office'),
    holderName:(l.holderType==='agent' ? bookingV2AgentNm(l.holderId) : ''),
    fixed:bookingV2BoatLockFixed(l), minCap:bookingV2BoatLockMinCap(l), capTouched:true,
    expiry:l.expiry||'', reason:l.reason||'' };
  if(typeof bookingV2Render==='function') bookingV2Render();
}
