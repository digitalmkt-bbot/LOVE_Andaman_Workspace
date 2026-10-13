function bookingV2BoatCapOn(id, date){
  if(typeof boatCapFor==='function'){ const c=boatCapFor(id,date); if(c>0) return c; }
  const b=bookingV2BoatOf(id); return b?(+b.cap||0):0;
}
