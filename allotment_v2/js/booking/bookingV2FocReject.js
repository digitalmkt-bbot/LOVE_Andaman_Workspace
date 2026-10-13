function bookingV2FocReject(bookingId){
  const bk = SB_BOOKINGS.find(b => b.id === bookingId);
  if(!bk || !bk.focApproval) return;
  if(bk.focApproval.status !== 'pending'){ alert('FOC is not pending'); return; }
  const reason = prompt('Reason for rejecting FOC:', '');
  if(reason === null) return; // cancel
  bk.focApproval.status = 'rejected';
  bk.focApproval.rejectReason = reason || '';
  bk.focApproval.approvedAt = new Date().toISOString();
  bk.focApproval.approvedBy = 'RM';
  bk.status = 'rejected';
  bookingV2AddHistory(bk,'foc','FOC rejected · '+bk.focApproval.count+' pax'+(reason?' · '+reason:''),'FOC');
  bookingV2PersistBookings();
  bookingV2Render();
}
