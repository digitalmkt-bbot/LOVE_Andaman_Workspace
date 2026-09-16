function bookingV2RejectBooking(id){
  const b=(SB_BOOKINGS||[]).find(x=>x.id===id); if(!b) return;
  bookingV2EnsureApproval(b);
  const _rr=b.approval.reason||'';
  const by=prompt('ไม่อนุมัติบุคกิ้ง '+id+' ('+bookingV2PendLabel(_rr)+')\nชื่อผู้ไม่อนุมัติ:',''); if(by===null) return;
  if(!by.trim()){ alert('กรุณาใส่ชื่อผู้ไม่อนุมัติ'); return; }
  const note=prompt('เหตุผล (ไม่บังคับ):','')||'';
  b.approval.status='rejected'; b.approval.approvedBy=by.trim(); b.approval.approvedAt=new Date().toISOString(); b.approval.note=note.trim();
  b.status='rejected';
  if(typeof bookingV2AddHistory==='function') bookingV2AddHistory(b,'cancel','Over-capacity rejected by '+by.trim()+(note.trim()?(' · '+note.trim()):''),'Approval');
  acctPersistBookings(); if(typeof bookingV2Render==='function') bookingV2Render();
  if(typeof laSaveToast==='function') laSaveToast({kind:'error', title:'ไม่อนุมัติ (rejected)', id, status:'REJECTED', sub:'โดย '+by.trim()+(note.trim()?(' · '+note.trim()):'')});
}
