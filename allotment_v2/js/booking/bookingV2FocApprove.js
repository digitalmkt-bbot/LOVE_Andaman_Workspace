// FOC approve/reject
function bookingV2FocApprove(bookingId){
  const bk = SB_BOOKINGS.find(b => b.id === bookingId);
  if(!bk || !bk.focApproval) return;
  if(bk.focApproval.status !== 'pending'){ alert('FOC is not pending'); return; }
  // FOC reason is REQUIRED to approve — prompt for it if missing
  let reason = (bk.focApproval.reason||bk.focReason||'').trim();
  if(!reason){
    reason = (prompt('FOC reason is required to approve.\nEnter a reason:', '')||'').trim();
    if(!reason){ alert('FOC reason is required — approval cancelled.'); return; }
    bk.focApproval.reason = reason;
    if(!bk.focReason) bk.focReason = reason;
  } else {
    if(!confirm(`Approve ${bk.focApproval.count} FOC pax for ${bk.id}?\n\nReason: ${reason}`)) return;
  }
  bk.focApproval.status = 'approved';
  bk.focApproval.approvedAt = new Date().toISOString();
  bk.focApproval.approvedBy = 'RM';
  bk.status = 'confirmed';
  bookingV2AddHistory(bk,'foc','FOC approved · '+bk.focApproval.count+' pax · booking confirmed','FOC');
  bookingV2PersistBookings();
  bookingV2Render();
}
