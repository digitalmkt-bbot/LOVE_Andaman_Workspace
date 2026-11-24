function bookingV2PayDoRecord(invId, bkId){
  const amt=+(document.getElementById('bkv2-pay-amt')||{}).value||0;
  const method=(document.getElementById('bkv2-pay-method')||{}).value||'transfer';
  if(amt<=0){ alert('ใส่จำนวนเงิน'); return; }
  const _sl=(_bkV2PaySlips[bkId]||[]).slice();   /* §paySlip · สลิปที่แนบไว้ในหน้าต่างนี้ ผูกกับการรับเงินครั้งนี้ */
  acctRecordPayment(invId, amt, method, _sl.length?{slips:_sl}:undefined);
  if(_sl.length){ const _b=(SB_BOOKINGS||[]).find(x=>x.id===bkId);
    if(_b) (_b.paymentSlips||[]).forEach(function(ps){ if(_sl.some(function(q){ return q.id===ps.id; })){ ps.amount=amt; ps.kind='payment'; } });
    try{ acctPersistBookings(); }catch(_){ } }
  delete _bkV2PaySlips[bkId];
  bookingV2Render(); bookingV2RowPayAction(bkId);
}
