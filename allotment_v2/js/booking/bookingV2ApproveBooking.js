function bookingV2ApproveBooking(id){
  const b=(SB_BOOKINGS||[]).find(x=>x.id===id); if(!b) return;
  bookingV2EnsureApproval(b);
  const _r=b.approval.reason||''; const _isDisc=/discount/.test(_r);
  const _lbl=_isDisc?(/over_cap/.test(_r)?'เกิน cap + ส่วนลด':'ส่วนลด'):bookingV2PendLabel(_r);
  // §apprCap · เกินทะเบียนเรือ = ไม่มีที่นั่งจริง · ถามซ้ำก่อน ไม่ให้กดผ่านโดยไม่ตั้งใจ
  const _imp=bookingV2ApprovalImpact(b), _impTxt=bookingV2ApprovalImpactText(_imp);
  const _noSeat=_imp.filter(function(o){ return o.overLic>0; });
  if(_noSeat.length && !confirm('\u26a0 ใบนี้ไม่มีที่นั่งจริงรองรับ\n'
      + _noSeat.map(function(o){ return o.name+' '+o.date+': เกินทะเบียนเรือ '+o.overLic+' ที่'; }).join('\n')
      + '\n\nอนุมัติได้ แต่ต้องเพิ่มเรือใน Boat Operation ก่อนวันเดินทาง\nยืนยันอนุมัติ?')) return;
  const by=prompt('อนุมัติบุคกิ้ง '+id+' ('+_lbl+')'+_impTxt+'\n\nชื่อผู้อนุมัติ ('+(_isDisc?'เซลล์ที่ดูแล':'ผจก.')+'):',''); if(by===null) return;
  if(!by.trim()){ alert('กรุณาใส่ชื่อผู้อนุมัติ'); return; }
  b.approval.status='approved'; b.approval.approvedBy=by.trim(); b.approval.approvedAt=new Date().toISOString();
  b.status = b.approval.targetStatus || 'confirmed';
  if(b.status==='confirmed' && !b.confirmedAt){ b.confirmedBy=by.trim(); b.confirmedAt=new Date().toISOString(); }
  if(typeof bookingV2AddHistory==='function') bookingV2AddHistory(b,'confirm',_lbl+' approved by '+by.trim(),'Approval');
  acctPersistBookings(); if(typeof bookingV2Render==='function') bookingV2Render();
  if(typeof laSaveToast==='function') laSaveToast({kind:'success', title:'อนุมัติแล้ว', id, status:(b.status||'').toUpperCase(), sub:'โดย '+by.trim()});
}
