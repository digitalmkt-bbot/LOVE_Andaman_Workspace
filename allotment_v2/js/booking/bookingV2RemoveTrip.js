function bookingV2RemoveTrip(idx){
  if(!_bkV2.newBooking) return;
  _bkV2.newBooking.trips.splice(idx, 1);
  if(_bkV2.newBooking.trips.length === 0) _bkV2.newBooking.trips.push(bookingV2NewTrip());
  bookingV2Render();
}
