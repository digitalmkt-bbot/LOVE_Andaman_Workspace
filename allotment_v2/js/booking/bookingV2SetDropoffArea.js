function bookingV2SetDropoffArea(areaId){
  if(!_bkV2.newBooking) return;
  _bkV2.newBooking.dropoffAreaId = areaId || null;
  bookingV2Render();
}
