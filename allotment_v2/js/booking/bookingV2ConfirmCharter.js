function bookingV2ConfirmCharter(){
  if(!_bkV2CharterConfirm) return;
  const { tripIdx, boatId } = _bkV2CharterConfirm;
  const t = _bkV2.newBooking?.trips?.[tripIdx];
  if(t){
    t.charterBoatId = boatId;
    t.charterDisplacementAck = true;  // audit flag · ops acknowledged
  }
  _bkV2CharterConfirm = null;
  bookingV2Render();
}
