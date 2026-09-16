function bookingV2CalPick(idx, dateStr){
  // Use the existing validator → also handles route conflict
  bookingV2CalClose();
  bookingV2SetTripField(idx, 'date', dateStr);
}
