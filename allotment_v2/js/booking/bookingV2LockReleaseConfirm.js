function bookingV2LockReleaseConfirm(id){
  const l = SB_SEAT_LOCKS.find(x=>x.id===id); if(!l) return;
  const rem = bookingV2LockReleasable(l);   // parent releases only its unallocated remainder · §lkSubDay
  /* §lkSubDay · บอกให้ชัดว่าคืนแล้วโดนวันไหน */
  let scopeTxt = '';
  if(bookingV2LockSpansDays(l)){ const rg = bookingV2LockRange(l); scopeTxt = 'ลดทุกวันในช่วง '+rg.from+' → '+rg.to+' · ถ้าจะคืนแค่วันเดียว ใช้ปุ่ม "ปล่อยรอบ" ในหน้า By trip date'; }
  else if(bookingV2LockKidDated(l)) scopeTxt = 'คืนเฉพาะวันที่ '+l.date+' · วันอื่นไม่กระทบ';
  _bkV2ReleaseModal = { lockId:id, max:rem, value:rem, scopeTxt:scopeTxt, wide:bookingV2LockSpansDays(l) };
  bookingV2Render();
}
