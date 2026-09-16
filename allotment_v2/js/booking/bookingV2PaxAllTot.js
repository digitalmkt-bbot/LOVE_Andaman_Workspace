function bookingV2PaxAllTot(pax){
  return bookingV2PaxTot(pax,'ad') + bookingV2PaxTot(pax,'chd') + bookingV2PaxTot(pax,'inf') + bookingV2PaxTot(pax,'foc');
}
