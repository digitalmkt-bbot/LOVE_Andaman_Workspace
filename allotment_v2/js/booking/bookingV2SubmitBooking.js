function bookingV2SubmitBooking(){
  if(!_bkV2.newBooking) return;
  const d = _bkV2.newBooking;
  const quote = bookingV2CalcQuote();
  const hasFoc = quote.totalFoc > 0;
  if(hasFoc && !(d.focReason||'').trim()){ alert('Please enter FOC reason'); return; }
  bookingV2CommitBooking(hasFoc ? 'pending_foc' : 'confirmed');
}
