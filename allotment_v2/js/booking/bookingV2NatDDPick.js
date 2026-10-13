function bookingV2NatDDPick(key, code){
  const ids = bookingV2NatDDIds(key);
  const inp = document.getElementById(ids.inp);
  if(inp) inp.value = bookingV2NatDDLabel(code);
  bookingV2NatDDHide();
  if(key === 'lead'){
    bookingV2SetBookingField('leadNationality', code);
  } else if(/^p\d+$/.test(key)){
    const i = parseInt(key.slice(1), 10);
    bookingV2SetPassenger(i, 'nationality', code);
  }
}
