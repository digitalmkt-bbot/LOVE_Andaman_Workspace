// Load only the operational booking window from operation-backend. The old unfiltered
// request returned the complete booking history on every boot, which made startup and
// localStorage grow with the database. Callers can still provide an explicit range.
// Example: bookingV2LoadFromOpsBackend({routeId:'route-1', from:'2030-01-01', to:'2030-01-31'})
var _opsBookingLoadSeq = 0;
function _opsBookingYMD(d){
  if(typeof bookingV2LocalYMD==='function') return bookingV2LocalYMD(d);
  var y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+day;
}
function _opsBookingShiftDays(ds, days){
  var d=new Date(ds+'T00:00:00');
  d.setDate(d.getDate()+days);
  return _opsBookingYMD(d);
}
function _opsBookingDefaultRange(){
  // Keep a small history for recent edits/cancellations and enough forward visibility
  // for operations. This is deliberately bounded; use explicit filters for reports.
  var today=(typeof TODAY_STR!=='undefined' && TODAY_STR) ? TODAY_STR : _opsBookingYMD(new Date());
  return {from:_opsBookingShiftDays(today,-30), to:_opsBookingShiftDays(today,90)};
}
function bookingV2LoadFromOpsBackend(options){
  if(!window.LA_LEGACY_UNAVAILABLE || typeof window.laOpsFetch!=='function') return Promise.resolve(null);
  options=options||{};
  var defaults=_opsBookingDefaultRange();
  var from=options.from||defaults.from, to=options.to||defaults.to;
  var params=[];
  [['route_id',options.routeId],['from',from],['to',to],['limit',options.limit]].forEach(function(pair){
    if(pair[1]!==undefined && pair[1]!==null && pair[1]!=='') params.push(encodeURIComponent(pair[0])+'='+encodeURIComponent(pair[1]));
  });
  var path='/v1/bookings?'+params.join('&');
  var seq=++_opsBookingLoadSeq;
  return window.laOpsFetch(path).then(function(r){ return r.ok ? r.json() : null; })
    .then(function(j){
      if(!j || !Array.isArray(j.bookings) || seq!==_opsBookingLoadSeq) return j;
      var mapped = j.bookings.map(bookingV2FromOpsBooking);
      SB_BOOKINGS.length = 0;
      Array.prototype.push.apply(SB_BOOKINGS, mapped);
      try{ console.log('[opsSync] loaded '+mapped.length+' booking(s) for '+from+' → '+to+' from operation-backend'); }catch(e){}
      try{ if(typeof bookingV2Render==='function') bookingV2Render(); }catch(e){}
      return j;
    })
    .catch(function(e){ try{ console.warn('[opsSync] failed to load bookings from operation-backend: '+((e&&e.message)||e)); }catch(_){} return null; });
}

// This file is loaded after 08-app.js, so the boot call there cannot see this
// function yet. Start the operation-backend load after this script is defined.
try{ bookingV2LoadFromOpsBackend(); }catch(e){}
