function bookingV2ToggleCashOnTour(on){
  if(!_bkV2.newBooking) return;
  if(on){
    _bkV2.newBooking.cashOnTour = _bkV2.newBooking.cashOnTour || { amount:0, currency:'THB', handling:'deduct' };
  } else {
    _bkV2.newBooking.cashOnTour = null;
  }
  bookingV2Render();
}
