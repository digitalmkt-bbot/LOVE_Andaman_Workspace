function bookingV2PruneLtAddOns(){
  var d = _bkV2.newBooking; if(!d || !Array.isArray(d.addOns)) return 0;
  var ok = bookingV2LtRoutesApply(), n = 0;
  d.addOns = d.addOns.filter(function(a){
    var k = (typeof bookingV2LtAddOnKind === 'function') ? bookingV2LtAddOnKind(a && a.type) : '';
    if(!k) return true;
    if(!ok){ n++; return false; }
    return true;
  });
  /* จำนวนคนที่ลงจอยต้องไม่เกินหัวของเส้นทางที่รองรับ · เส้นทางเปลี่ยนแล้วหัวอาจลดลง */
  d.addOns.forEach(function(a){
    if(a && a.type === 'longtail-join' && (a.jAd != null || a.jChd != null)){
      var m = bookingV2LtJoinMax();
      if(a.jAd != null) a.jAd = Math.min(+a.jAd || 0, m.A);
      if(a.jChd != null) a.jChd = Math.min(+a.jChd || 0, m.C);
    }
  });
  if(n) console.log('[ltStale] dropped ' + n + ' longtail add-on(s): no trip route supports longtail');
  return n;
}
