function bookingV2SetAddOnNote(type, val){   // note per add-on (longtail) · no re-render to keep input focus
  if(!_bkV2.newBooking) return;
  const a = _bkV2.newBooking.addOns.find(x => x.type === type);
  if(a) a.note = val;
}
