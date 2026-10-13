function bookingV2NatDDLabel(code){
  const n = bookingV2AllNats().find(x => x.code === code);
  return n ? (n.name + ' · ' + n.code) : '';
}
