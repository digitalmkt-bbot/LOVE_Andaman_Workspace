function bookingV2AddOnInfo(type){
  const rt = bookingV2GetRT();
  const d = _bkV2.newBooking;
  if(!rt || !d) return { label: type, total: 0 };
  // Aggregate pax across all trips · sum Fr + Th
  let totAd = 0, totChd = 0;
  d.trips.forEach(t => {
    totAd += bookingV2PaxTot(t.pax, 'ad');
    totChd += bookingV2PaxTot(t.pax, 'chd');
  });
  if(type === 'longtail-join'){
    // per-route Join price × that trip's pax (Surin can differ from Phuket)
    const ltn = (typeof _rtNormalizeLongtail==='function') ? _rtNormalizeLongtail(rt.addOns&&rt.addOns.longtail) : null;
    let total=0, A=0, C=0;
    if(ltn){ d.trips.forEach(t=>{ if(!t.routeId) return; if(ltn.applies.length && !ltn.applies.includes(t.routeId)) return; const pr=(ltn.byRoute[t.routeId]||{join:ltn.join}).join||{}; const a=bookingV2PaxTot(t.pax,'ad'), c=bookingV2PaxTot(t.pax,'chd'); A+=a; C+=c; total += (pr.adult||0)*a + (pr.child||0)*c; }); }
    return { label: `Longtail Join (${A}A + ${C}C)`, total };
  }
  if(type === 'longtail-charter'){
    // per-route Charter price · one boat per applied trip-route · sum across trips
    const ltn = (typeof _rtNormalizeLongtail==='function') ? _rtNormalizeLongtail(rt.addOns&&rt.addOns.longtail) : null;
    let total=0, cap=0;
    if(ltn){ d.trips.forEach(t=>{ if(!t.routeId) return; if(ltn.applies.length && !ltn.applies.includes(t.routeId)) return; const ch=(ltn.byRoute[t.routeId]||{charter:ltn.charter}).charter||{}; total += ch.price||0; cap=Math.max(cap, ch.capacity||6); }); }
    return { label: `Longtail Charter`, total };
  }
  if(type.startsWith('transfer-')){
    // type format: transfer-<routeId>-<zone>-<vehicle>
    const [, rid, zone, vehicle] = type.split('-');
    const tr = rt.addOns?.privateTransfer?.[rid]?.[zone]?.[vehicle];
    return { label: `Transfer · ${vehicle.charAt(0).toUpperCase()+vehicle.slice(1)} ${zone}`, total: tr || 0 };
  }
  return { label: type, total: 0 };
}
