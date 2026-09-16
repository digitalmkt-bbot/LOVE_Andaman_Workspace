function bookingV2ToggleAddOn(type){
  if(!_bkV2.newBooking) return;
  const d = _bkV2.newBooking;
  const idx = d.addOns.findIndex(a => a.type === type);
  if(idx >= 0){ d.addOns.splice(idx, 1); }
  else {
    d.addOns.push({ type, qty: 1 });
    // Private Van replaces any bundled shared transfer → put the matching trip's seat on No-Transfer
    // (a PK/KL seat price already includes a transfer = double charge otherwise).
    if(type.indexOf('transfer-') === 0){
      const m = type.match(/^transfer-(.+)-(?:PK|KL|NoTransfer)-[a-z]+$/i);
      const rid = m ? m[1] : (type.split('-')[1] || '');
      (d.trips||[]).forEach(t => { if(t.routeId === rid && t.zone && t.zone !== 'NoTransfer') t.zone = 'NoTransfer'; });
      // A private van is a real hotel pickup (not self-arrive) → drop a lingering self-arrive pier area so the
      // pickup field prompts for the actual hotel/area the van collects from.
      const _ca = d.pickupAreaId && typeof bookingV2GetArea === 'function' ? bookingV2GetArea(d.pickupAreaId) : null;
      if(_ca && (_ca.zone === 'NoTransfer' || _ca.zone === 'NT')){ d.pickupAreaId = null; d.pickupZoneFilter = null; }
    }
  }
  bookingV2Render();
}
