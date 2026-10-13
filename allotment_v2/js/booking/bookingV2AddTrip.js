function bookingV2AddTrip(){
  if(!_bkV2.newBooking) return;
  _bkV2.newBooking.trips.push(bookingV2NewTrip());
  bookingV2Render();
}
