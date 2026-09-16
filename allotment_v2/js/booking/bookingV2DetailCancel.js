// Cancel booking from detail view
function bookingV2DetailCancel(bookingId){
  const bk = SB_BOOKINGS.find(b => b.id === bookingId);
  if(!bk) return;
  if(['cancelled','completed','rejected'].includes(bk.status)){
    alert(`Already ${bk.status}`); return;
  }
  bookingV2CancelModal(bookingId);
}
