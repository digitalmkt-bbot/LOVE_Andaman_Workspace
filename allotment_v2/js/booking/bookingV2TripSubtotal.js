function bookingV2TripSubtotal(trip){
  const rt = bookingV2GetRTForTrip(trip);
  if(!rt || !trip.routeId) return { total:0, seatFr:0, seatTh:0, bundle:0 };
  if(trip.ovnLeg) return { total:0, seatFr:0, seatTh:0, bundle:0, ovnLeg:true };   // ขากลับค้างคืน · ที่นั่งกันไว้แต่ไม่คิดเงินซ้ำ (ค่าใช้จ่ายอยู่ที่ ovnCharge ของขาไป)

  // ── Charter mode · per-boat pricing ──
  if(trip.bookingMode === 'charter'){
    if(!trip.charterBoatId) return { total:0, isCharter:true, starterPrice:0, extras:0, extraRate:0 };
    const boat = (typeof BOATS !== 'undefined') ? BOATS.find(b => b.id === trip.charterBoatId) : null;
    const boatType = (boat?.type || '').toLowerCase();   // 'speedboat' / 'catamaran'
    const cr = rt.charterRates?.[trip.routeId]?.[boatType];
    if(!cr) return { total:0, isCharter:true, error:'no charter rate', boatName:boat?.name||'' };
    const totPax = bookingV2PaxAllTot(trip.pax);
    const starterIncludes = cr.starterIncludes || 0;
    const extras = Math.max(0, totPax - starterIncludes);
    const starterPrice = cr.starterPrice || 0;
    const extraTotal = extras * (cr.extraPerPax || 0);
    let cBundle = 0;
    const _cb = rt.routeBundles?.[trip.routeId]?.longtail;
    if(_cb && _cb.mode==='paid' && _rtBundleAppliesTo(_cb, true)){ cBundle = (_cb.adult||0)*bookingV2PaxTot(trip.pax,'ad') + (_cb.child||0)*bookingV2PaxTot(trip.pax,'chd'); }
    const rateTotal = starterPrice + extraTotal + cBundle;
    // Flexible / manual override · keep rate figures for the "differs from rate" hint
    const manual = trip.charterPriceMode === 'manual';
    const total = manual ? Math.round(Number(trip.charterPriceManual) || 0) : rateTotal;
    return {
      total,
      isCharter: true,
      priceMode: manual ? 'manual' : 'rate',
      rateTotal,                                  // what the rate card would charge
      manualDelta: manual ? (total - rateTotal) : 0,
      starterPrice, starterIncludes,
      extras, extraRate: cr.extraPerPax || 0, extraTotal,
      boatName: boat?.name || '', boatType
    };
  }

  // ── Seat mode · mixed nationality pricing + bundle ──
  if(!trip.zone) return { total:0, seatFr:0, seatTh:0, bundle:0 };
  const routeRates = rt.seatRates?.[trip.routeId];
  const sr = routeRates?.[trip.zone];
  // ─── Detect "Not offered" · zone entry missing OR all adult rates are 0 ───
  if(!routeRates || !sr){
    return { total:0, seatFr:0, seatTh:0, bundle:0, noRate:true, reason:'zone not in Rate Type for this route' };
  }
  const adFrRate = sr['adult-fr'] || 0;
  const chFrRate = sr['child-fr'] || 0;
  const adThRate = sr['adult-thai'] || 0;
  const chThRate = sr['child-thai'] || 0;
  // Both adult rates are 0 · interpret as "not offered" (rare to have 0 baht adults)
  if(adFrRate === 0 && adThRate === 0){
    return { total:0, seatFr:0, seatTh:0, bundle:0, noRate:true, reason:'both adult rates are 0' };
  }
  const p = trip.pax || {};
  // Backward compat · old shape used single rate
  const legAd = p.ad || 0, legChd = p.chd || 0;
  const seatFr = adFrRate * (p.ad_fr||legAd) + chFrRate * (p.chd_fr||legChd);
  const seatTh = adThRate * (p.ad_th||0) + chThRate * (p.chd_th||0);
  // Bundle surcharge across all adults+children regardless of nationality
  let bundle = 0;
  const b = rt.routeBundles?.[trip.routeId]?.longtail;
  if(b && b.mode === 'paid' && _rtBundleAppliesTo(b, false)){
    const totAd = bookingV2PaxTot(p, 'ad');
    const totChd = bookingV2PaxTot(p, 'chd');
    bundle = (b.adult || 0) * totAd + (b.child || 0) * totChd;
  }
  return { total: seatFr + seatTh + bundle, seatFr, seatTh, bundle };
}
