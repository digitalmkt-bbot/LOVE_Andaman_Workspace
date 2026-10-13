function bookingV2PayDoCreate(bkId){
  const bk=(SB_BOOKINGS||[]).find(x=>x.id===bkId); if(!bk||!bk.agentId) return;
  const a=sbGetAgent(bk.agentId);
  acctCreateInvoice(bk.agentId,[bkId], (a&&a.creditDays)|| (a&&a.payType==='invoice'?30:0));
  bookingV2Render(); bookingV2RowPayAction(bkId);
}
