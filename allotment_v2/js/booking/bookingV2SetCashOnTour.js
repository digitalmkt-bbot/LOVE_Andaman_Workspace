function bookingV2SetCashOnTour(key, val){
  if(!_bkV2.newBooking || !_bkV2.newBooking.cashOnTour) return;
  _bkV2.newBooking.cashOnTour[key] = val;
  if(key === 'amount' || key === 'note'){
    // skip full re-render (preserve input focus) · update the review live
    const el=document.getElementById('bkv2-cot-rv-amt');
    if(el){ const c=_bkV2.newBooking.cashOnTour; el.textContent=(c.currency||'THB')+' '+(Number(c.amount)||0).toLocaleString(); }
    const ne=document.getElementById('bkv2-cot-rv-note');
    if(ne){ const t=(_bkV2.newBooking.cashOnTour.note||'').trim(); ne.textContent=t?('📝 '+t):''; ne.style.display=t?'block':'none'; }
    return;
  }
  bookingV2Render();
}
