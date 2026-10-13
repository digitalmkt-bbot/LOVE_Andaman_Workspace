function bookingV2B2CGo(id){
  const bk=(SB_BOOKINGS||[]).find(b=>b && b.id===id); if(!bk) return;
  const d=bookingV2B2CTripDate(bk); if(!d) return;
  bookingV2B2CClose();
  try{ _bkV2.tab='bytrip'; _bkV2.detailId=null; }catch(e){}
  bookingV2Tab2PickDay(d);
  setTimeout(()=>{ try{
    const tr=document.querySelector('tr.t2-b2cchg[data-bk="'+String(id).replace(/"/g,'\\"')+'"]');
    if(tr){ tr.scrollIntoView({block:'center'}); tr.classList.add('b2c-flash'); setTimeout(()=>tr.classList.remove('b2c-flash'),1800); }
  }catch(e){} }, 120);
}
