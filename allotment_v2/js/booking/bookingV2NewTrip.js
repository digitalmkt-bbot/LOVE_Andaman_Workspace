function bookingV2NewTrip(){
  var _tmr = new Date(Date.now()+864e5);   // default trip date = tomorrow (per user)
  var _tmrYMD = (typeof bookingV2LocalYMD==='function') ? bookingV2LocalYMD(_tmr) : _tmr.toISOString().slice(0,10);
  return {
    routeId:'', date:_tmrYMD,
    zone:'PK',                 // pricing zone · derived from booking.pickupAreaId
    bookingMode: 'seat',       // 'seat' | 'charter'
    charterBoatId: null,       // boat id when charter mode · null when seat
    charterPriceMode: 'rate',  // 'rate' = auto from charterRates · 'manual' = flexible override
    charterPriceManual: 0,     // custom charter price when mode === 'manual'
    charterPriceNote: '',      // reason for the manual price
    pax:{
      // Mixed nationality · Foreign + Thai together
      ad_fr:0, chd_fr:0, inf_fr:0, foc_fr:0,
      ad_th:0, chd_th:0, inf_th:0, foc_th:0
    },
    longtailManual: false,     // manual checkbox (for routes without bundled longtail)
    ovn: null,                 // OVN (overnight) leg · null = normal day-trip · 'return' = ขากลับค้างคืน (we bring back) · 'self' = ค้างคืน กลับเอง (one-way)
    ovnReturnDate: '',         // OVN · วันที่กลับ (เมื่อ ovn==='return')
    ovnCharge: 0,              // OVN · ค่าค้างคืน (extra) · บวกเข้ายอดรวม
    ovnLeg: false,             // = trip ขากลับ (auto-สร้าง) · ราคา 0 · กันที่นั่งวันกลับ
    lockUse: 0,                // seats this booking will draw from seat-locks (Step 3c)
    lockDrawSel: {},           // staff-picked draw sources {lockId:qty} (Option A sub-groups)
    pickupTime: '',            // auto-resolved · user can edit
    pickupTimeEdited: false    // track if user manually overrode
  };
}
