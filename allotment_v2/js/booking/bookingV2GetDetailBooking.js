function bookingV2GetDetailBooking(){
  return SB_BOOKINGS.find(b => b.id === _bkV2.detailId) || null;
}
