function bookingV2DetailPartial(bookingId){
  const bk=SB_BOOKINGS.find(b=>b.id===bookingId); if(!bk) return;
  if(['cancelled','completed','rejected','cancelled_weather'].includes(bk.status)){ alert('Cannot edit a '+bk.status+' booking'); return; }
  if(!(bk.trips||[]).length){ alert('This booking has no trips'); return; }
  bookingV2PartialModal(bookingId, 0);
}
