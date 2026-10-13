function bookingV2PayDoRecord(invId, bkId){
  const amt=+(document.getElementById('bkv2-pay-amt')||{}).value||0;
  const method=(document.getElementById('bkv2-pay-method')||{}).value||'transfer';
  if(amt<=0){ alert('ใส่จำนวนเงิน'); return; }
  acctRecordPayment(invId, amt, method);
  bookingV2Render(); bookingV2RowPayAction(bkId);
}
