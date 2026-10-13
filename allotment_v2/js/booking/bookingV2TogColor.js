function bookingV2TogColor(id, date){
  try{
    var now = Date.now();
    if(_bkV2TogC.k !== date || now - _bkV2TogC.at > 800){
      var ids = [];
      (typeof SB_BOOKINGS !== 'undefined' ? SB_BOOKINGS : []).forEach(function(b){
        if(!b || ['cancelled','rejected','cancelled_weather'].indexOf(b.status) >= 0) return;
        if(!(b.trips||[]).some(function(t){ return t && t.date === date; })) return;
        var o = (typeof bkOpsRead === 'function') ? bkOpsRead(b, date) : (b.ops||{});
        if(Array.isArray(o.vanSplits) && o.vanSplits.length >= 2) ids.push(String(b.id));
      });
      ids.sort(); _bkV2TogC = { k:date, at:now, ids:ids };
    }
    var i = _bkV2TogC.ids.indexOf(String(id));
    return BKV2_TOG_PAL[(i < 0 ? 0 : i) % BKV2_TOG_PAL.length];
  }catch(_){ return BKV2_TOG_PAL[0]; }
}
