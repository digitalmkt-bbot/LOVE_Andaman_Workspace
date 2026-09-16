// Pick the active date for the view: explicit filter, else nearest trip date >= today, else today
function bookingV2Tab2ActiveDate(){
  if(_bkV2.filterDate) return _bkV2.filterDate;
  const today = bookingV2LocalYMD(new Date());
  const dates = new Set();
  SB_BOOKINGS.forEach(bk=>{
    if(bk.schemaVer===2){ (bk.trips||[]).forEach(t=>{ if(t.date) dates.add(t.date); }); }
    else if(bk.travelDate){ dates.add(bk.travelDate); }
  });
  const sorted = [...dates].sort();
  const upcoming = sorted.find(d => d >= today);
  return upcoming || sorted[sorted.length-1] || today;
}
