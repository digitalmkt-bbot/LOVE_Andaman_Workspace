// ── Reschedule (move trip date) · charge none/full/partial · bill via invoice or paid-separately ──
function bookingV2RescheduleToggleAmt(){
  const v=(document.querySelector('input[name=bkr-charge]:checked')||{}).value;
  const amt=document.getElementById('bkr-amt-row'); if(amt) amt.style.display=(v==='partial')?'block':'none';
  const col=document.getElementById('bkr-collect-row'); if(col) col.style.display=(v==='none')?'none':'block';
}
