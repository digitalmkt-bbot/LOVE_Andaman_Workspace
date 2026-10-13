// Pax helpers · handle mixed (new) + legacy single-type (old) shapes
function bookingV2PaxTot(pax, kind){
  // kind: 'ad' | 'chd' | 'inf' | 'foc'
  if(!pax) return 0;
  return (pax[kind]||0) + (pax[`${kind}_fr`]||0) + (pax[`${kind}_th`]||0);
}
