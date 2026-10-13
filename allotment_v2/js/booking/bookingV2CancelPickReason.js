// On reason pick · set the suggested charge (user can still change)
function bookingV2CancelPickReason(){
  const code=(document.getElementById('bkc-cat')||{}).value||'';
  const r=BKV2_CANCEL_REASONS.find(x=>x.code===code);
  if(r){ const radio=document.querySelector('input[name=bkc-charge][value="'+r.def+'"]'); if(radio) radio.checked=true; }
  bookingV2CancelToggleAmt();
}
