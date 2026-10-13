function bookingV2SetAddOnQty(type, n){
  if(!_bkV2.newBooking) return;
  const a = _bkV2.newBooking.addOns.find(x => x.type === type);
  if(!a) return;
  a.qty = Math.max(1, Math.floor(Number(n)||1));
  bookingV2Render();
}
