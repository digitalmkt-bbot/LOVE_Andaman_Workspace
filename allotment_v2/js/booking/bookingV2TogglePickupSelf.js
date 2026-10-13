function bookingV2TogglePickupSelf(){
  if(!_bkV2.newBooking) return;
  _bkV2.newBooking.pickupSelf = !_bkV2.newBooking.pickupSelf;
  bookingV2Render();
}
