function bookingV2BumpNat(idx, k, delta){
  if(!_bkV2.newBooking) return;
  _bkV2.newBooking._natOpen = _bkV2.newBooking._natOpen || {}; _bkV2.newBooking._natOpen[idx] = true;   /* §natRow · แถวอยู่ต่อแม้กดจนเท่าแถว TH */
  const t = _bkV2.newBooking.trips[idx];
  if(!t || !t.pax) return;
  const px = t.pax;
  if(!bkNatHas(t)){
    t.nat = { ad:+px.ad_th||0, chd:+px.chd_th||0, inf:+px.inf_th||0, foc:+px.foc_th||0 };
  }
  const all = (+px[k+'_th']||0) + (+px[k+'_fr']||0) + (+px[k]||0);
  t.nat[k] = Math.max(0, Math.min(all, (+t.nat[k]||0) + delta));
  if(bkNatSameAsPrice(t)) delete t.nat;   /* §natZero */
  bookingV2Render();
}
