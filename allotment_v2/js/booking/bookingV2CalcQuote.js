function bookingV2CalcQuote(){
  const d = _bkV2.newBooking;
  if(!d) return { totalSeat:0, totalAddOn:0, focDiscount:0, totalFoc:0, grandTotal:0, perTrip:[] };
  // Manual / free-style price (walk-in) · typed total overrides the rate engine
  if(d.priceMode === 'manual'){
    const mt = Math.max(0, Number(d.manualTotal)||0);
    let foc=0; (d.trips||[]).forEach(t=> foc += bookingV2PaxTot(t.pax,'foc'));
    // §b2cEdit · ใบ B2C · ยอดรายทริปกับ add-on อ่านจากที่ต้นทางส่งมา ไม่ใช่ 0 (ยอดรวมยังเท่าเดิม)
    const _b2c = (typeof bookingV2IsB2CBk==='function') && bookingV2IsB2CBk(d);
    const _pt  = _b2c ? (d.trips||[]).map(t=>({ total:Number(t.subtotal)||0 })) : [];
    const _ao  = _b2c ? (d.addOns||[]).reduce((s,a)=>s+(Number(a.amount)||0),0) : 0;
    return { totalSeat:Math.max(0,mt-_ao), totalAddOn:_ao, focDiscount:0, totalFoc:foc, totalDiscount:0, totalExtra:0, base:mt, grandTotal:mt, perTrip:_pt, manual:true, b2c:_b2c };
  }
  let totalSeat = 0, totalFoc = 0, focDiscount = 0;
  const perTrip = d.trips.map(t => {
    const sub = bookingV2TripSubtotal(t);
    totalSeat += sub.total;
    totalFoc += bookingV2PaxTot(t.pax, 'foc');
    // FOC forgone · sum (foc_fr × adult-fr-rate) + (foc_th × adult-thai-rate) + legacy · per-trip rate (promo overlay)
    const rt = bookingV2GetRTForTrip(t);
    if(rt && t.routeId && t.zone){
      const sr = rt.seatRates?.[t.routeId]?.[t.zone] || {};
      const p = t.pax || {};
      const adFrRate = sr['adult-fr'] || 0;
      const adThRate = sr['adult-thai'] || 0;
      focDiscount += adFrRate * (p.foc_fr || p.foc || 0) + adThRate * (p.foc_th || 0);
    }
    return sub;
  });
  let totalAddOn = 0;
  // Skip longtail-join add-on when any trip route is bundled (auto-applied via bundle)
  const rtCalc = bookingV2GetRT();
  const anyBundled = rtCalc && d.trips.some(t => t.routeId && _rtBundleAppliesTo(rtCalc.routeBundles?.[t.routeId]?.longtail, t.bookingMode==='charter'));
  (d.addOns||[]).forEach(a => {
    if(a.type === 'longtail-join' && anyBundled) return;
    totalAddOn += bookingV2AddOnInfo(a.type).total * (a.qty||1);   // qty>1 only for longtail-charter (N boats)
  });
  // ── Adjustments · discount (amount/%) + extra charge ──
  const base = totalSeat + totalAddOn;
  let totalDiscount = 0, totalExtra = 0;
  (d.adjustments||[]).forEach(a => {
    const v = Number(a.value) || 0;
    if(v <= 0) return;
    if(a.kind === 'discount'){
      totalDiscount += a.mode === 'percent' ? Math.round(base * v / 100) : Math.round(v);
    } else {
      totalExtra += Math.round(v);
    }
  });
  // OVN · ค่าค้างคืน (per trip) → บวกเป็น extra
  let ovnExtra = 0; (d.trips||[]).forEach(t => { if(t.ovn) ovnExtra += Math.max(0, Number(t.ovnCharge)||0); });
  totalExtra += ovnExtra;
  const grandTotal = Math.max(0, base - totalDiscount + totalExtra);
  return { totalSeat, totalAddOn, focDiscount, totalFoc, totalDiscount, totalExtra, base, grandTotal, perTrip };
}
