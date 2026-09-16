function bookingV2RescheduleConfirm(bookingId){
  const from=(document.getElementById('bkr-from')||{}).value||'';
  const nd=(document.getElementById('bkr-newdate')||{}).value||'';
  const reason=((document.getElementById('bkr-reason')||{}).value||'').trim();
  const ct=(document.querySelector('input[name=bkr-charge]:checked')||{}).value||'none';
  const amt=(document.getElementById('bkr-amt')||{}).value||0;
  const collect=(document.querySelector('input[name=bkr-collect]:checked')||{}).value||'invoice';
  if(!nd){ alert('Please pick the new date'); return; }
  if(nd===from){ alert('New date is the same as the current date'); return; }
  if(!reason){ alert('Please enter a reschedule reason'); return; }
  if(ct==='partial' && !(Number(amt)>0)){ alert('Please enter the partial charge amount'); return; }
  const editPickup=!!(document.getElementById('bkr-editpickup')||{}).checked;
  acctModalClose();
  bookingV2RescheduleBooking(bookingId, { fromDate:from, newDate:nd, chargeType:ct, chargeAmount:amt, collect, reason });
  if(typeof laSaveToast==='function') laSaveToast({kind:'neutral', title:'เลื่อนวันเดินทางแล้ว', id:bookingId, status:'RESCHEDULED',
    sub:from+' → '+nd+(ct==='none'?'':(' · ค่าปรับ '+(ct==='full'?'เต็มจำนวน':'บางส่วน')))});
  if(editPickup && typeof bookingV2EditBooking==='function'){ bookingV2EditBooking(bookingId); }
  else if(typeof bookingV2Render==='function') bookingV2Render();
}
