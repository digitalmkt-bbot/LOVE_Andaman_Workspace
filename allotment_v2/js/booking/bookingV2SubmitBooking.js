function bookingV2SubmitBooking(){
  if(!_bkV2.newBooking) return;
  const d = _bkV2.newBooking;
  const quote = bookingV2CalcQuote();
  const hasFoc = quote.totalFoc > 0;
  if(hasFoc && !(d.focReason||'').trim()){ alert('Please enter FOC reason'); return; }
  /* §rtKeep · ราคาในชุดถูกแก้หลังใบนี้บันทึก · ถามก่อนเขียนยอดใหม่ทับ (ข้อความเตือนอยู่บนฟอร์มแล้ว นี่คือด่านสุดท้าย) */
  const _K = d._rtKeep;
  if(_bkV2.editingId && _K && _K.drift && _K.mode==='keep' && d.priceMode!=='manual'){
    const _was = Math.round(_K.total), _now = Math.round(quote.grandTotal);
    if(_was !== _now && !confirm('Saved total: THB '+_was.toLocaleString()+'\nTotal at current rates: THB '+_now.toLocaleString()
        +'\n\nPrices in this rate type changed after the booking was saved.\nSave with the new total?')) return;
  }
  bookingV2CommitBooking(hasFoc ? 'pending_foc' : 'confirmed');
}
