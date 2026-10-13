function bookingV2CalOutside(e){
  if(_bkV2CalIdx === null) return;
  const pop = document.getElementById('bkv2-cal-pop-' + _bkV2CalIdx);
  const trig = document.getElementById('bkv2-cal-trig-' + _bkV2CalIdx);
  if(!pop) return;
  if(pop.contains(e.target) || (trig && trig.contains(e.target))) return;
  bookingV2CalClose();
}
