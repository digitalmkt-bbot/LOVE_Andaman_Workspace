function bookingV2SetAddOnJoin(which, n){
  var d = _bkV2.newBooking; if(!d) return;
  var a = (d.addOns || []).filter(function(x){ return x.type === 'longtail-join'; })[0]; if(!a) return;
  var mx = bookingV2LtJoinMax(), cap = (which === 'ad') ? mx.A : mx.C;
  var v = Math.max(0, Math.min(cap, Math.round(+n || 0)));
  if(which === 'ad') a.jAd = v; else a.jChd = v;
  bookingV2Render();
}
