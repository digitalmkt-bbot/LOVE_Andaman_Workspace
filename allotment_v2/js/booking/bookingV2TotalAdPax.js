// Total AD across all trips · used to size passengers[]
function bookingV2TotalAdPax(){
  if(!_bkV2.newBooking) return 0;
  return _bkV2.newBooking.trips.reduce((s,t) => s + bookingV2PaxTot(t.pax,'ad'), 0);
}
