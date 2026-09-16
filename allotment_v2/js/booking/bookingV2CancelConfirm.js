function bookingV2CancelConfirm(bookingId){
  const category=(document.getElementById('bkc-cat')||{}).value||'';
  if(!category){ alert('กรุณาเลือกประเภทการยกเลิก'); return; }
  const note=((document.getElementById('bkc-reason')||{}).value||'').trim();
  if(category==='other' && !note){ alert('กรุณาระบุรายละเอียดสำหรับ "อื่นๆ"'); return; }
  const ct=(document.querySelector('input[name=bkc-charge]:checked')||{}).value||'none';
  const amt=(document.getElementById('bkc-amt')||{}).value||0;
  if(ct==='partial' && !(Number(amt)>0)){ alert('Please enter the partial charge amount'); return; }
  acctModalClose();
  bookingV2CancelBooking(bookingId, { category, note, reason:note, chargeType:ct, chargeAmount:amt });
  if(typeof bookingV2Render==='function') bookingV2Render();
  if(typeof laSaveToast==='function') laSaveToast({kind:'error', title:'ยกเลิก booking แล้ว', id:bookingId, status:'CANCELLED',
    sub:(ct==='none'?'ไม่คิดค่าใช้จ่าย':(ct==='full'?'คิดค่าปรับเต็มจำนวน':'คิดค่าปรับบางส่วน'))+(note?(' · '+note):'')});
}
