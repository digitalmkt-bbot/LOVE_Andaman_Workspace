function bookingV2DetailReschedule(bookingId){
  const bk=SB_BOOKINGS.find(b=>b.id===bookingId); if(!bk) return;
  if(['cancelled','completed','rejected','cancelled_weather'].includes(bk.status)){ alert('Cannot reschedule a '+bk.status+' booking'); return; }
  if(!(bk.trips||[]).some(t=>t.date)){ alert('This booking has no trip date to reschedule'); return; }
  bookingV2RescheduleModal(bookingId);
}
