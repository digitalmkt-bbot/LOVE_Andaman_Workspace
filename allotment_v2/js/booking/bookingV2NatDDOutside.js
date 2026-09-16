function bookingV2NatDDOutside(e){
  if(!_bkV2NatDDKey) return;
  const ids = bookingV2NatDDIds(_bkV2NatDDKey);
  const inp = document.getElementById(ids.inp);
  const dd  = document.getElementById(ids.dd);
  if(!dd) return;
  if(dd.contains(e.target) || inp === e.target) return;
  bookingV2NatDDHide();
}
