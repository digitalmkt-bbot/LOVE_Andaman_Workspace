function bookingV2BumpPax(idx, paxKey, delta){
  if(!_bkV2.newBooking) return;
  const t = _bkV2.newBooking.trips[idx];
  if(!t || !t.pax) return;
  const _before = t.pax[paxKey]||0;
  t.pax[paxKey] = Math.max(0, (t.pax[paxKey]||0) + delta);
  /* §natZero · ช่องคนไทยจริงที่ยังตามแถวราคาอยู่ ขยับตาม · เกินหัวทั้งหมดไม่ได้ */
  if(bkNatHas(t)){
    const m = String(paxKey).match(/^(ad|chd|inf|foc)(?:_(th|fr))?$/);
    if(m){
      const k = m[1], px = t.pax;
      if(m[2]==='th' && (+t.nat[k]||0) === _before) t.nat[k] = +px[paxKey]||0;
      const all = (+px[k+'_th']||0) + (+px[k+'_fr']||0) + (+px[k]||0);
      t.nat[k] = Math.max(0, Math.min(all, +t.nat[k]||0));
      if(bkNatSameAsPrice(t)) delete t.nat;
    }
  }
  // Any pax bump can change the names-list size (lead can be AD/CHD/INF/FOC) → re-sync
  bookingV2SyncPassengers();
  bookingV2Render();
}
