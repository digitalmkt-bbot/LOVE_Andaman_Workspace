// Operation-backend booking query cache. Booking pages load only their visible
// date/month; they never bootstrap a broad operational window.
var _opsBookingRanges = Object.create(null), _opsBookingRangeLoads = Object.create(null);
function _opsBookingYMD(d){
  if(typeof bookingV2LocalYMD==='function') return bookingV2LocalYMD(d);
  var y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+day;
}
function _opsBookingMonthRange(month){
  var d=new Date(month+'-01T00:00:00'), from=_opsBookingYMD(d);
  d.setMonth(d.getMonth()+1); d.setDate(0);
  return {from:from,to:_opsBookingYMD(d)};
}
function _opsBookingRangeKey(o){ return [o.routeId||'',o.from||'',o.to||'',o.limit||100].join('|'); }
function _opsBookingMerge(mapped){
  var at=Object.create(null);
  SB_BOOKINGS.forEach(function(b,i){ at[b.opsId||b.id]=i; });
  mapped.forEach(function(b){
    var k=b.opsId||b.id, i=at[k];
    if(i===undefined){ at[k]=SB_BOOKINGS.length; SB_BOOKINGS.push(b); }
    else Object.assign(SB_BOOKINGS[i],b);
  });
}
function bookingV2OpsResetCache(){
  _opsBookingRanges=Object.create(null); _opsBookingRangeLoads=Object.create(null);
  if(typeof SB_BOOKINGS!=='undefined') SB_BOOKINGS.length=0;
}
/* Return null when this complete range is cached; otherwise return its one
   in-flight Promise. Callers use that distinction to redraw only after a new
   response, avoiding a render/fetch loop. */
function bookingV2EnsureOpsRange(options){
  if(!window.LA_LEGACY_UNAVAILABLE || typeof window.laOpsFetch!=='function') return null;
  options=options||{};
  var from=options.from, to=options.to;
  if(!from || !to) return null;
  var q={routeId:options.routeId,from:from,to:to,limit:options.limit||100};
  var key=_opsBookingRangeKey(q);
  if(_opsBookingRanges[key]) return null;
  if(_opsBookingRangeLoads[key]) return _opsBookingRangeLoads[key];
  var params=[];
  [['route_id',q.routeId],['from',from],['to',to],['limit',q.limit]].forEach(function(pair){
    if(pair[1]!==undefined && pair[1]!==null && pair[1]!=='') params.push(encodeURIComponent(pair[0])+'='+encodeURIComponent(pair[1]));
  });
  var base='/v1/bookings?'+params.join('&'), all=[], pages=0, MAX_PAGES=200;
  function page(cursor){
    return window.laOpsFetch(base+(cursor?'&cursor='+encodeURIComponent(cursor):'')).then(function(r){ return r.ok?r.json():null; }).then(function(j){
      if(!j || !Array.isArray(j.bookings)) throw new Error('booking list did not return bookings');
      Array.prototype.push.apply(all,j.bookings);
      if(j.next_cursor && ++pages<MAX_PAGES) return page(j.next_cursor);
      if(j.next_cursor) console.warn('[opsSync] stopped after '+pages+' pages; '+from+' → '+to+' is incomplete');
      var mapped=all.map(bookingV2FromOpsBooking); _opsBookingMerge(mapped); _opsBookingRanges[key]=true;
      console.log('[opsSync] loaded '+mapped.length+' booking(s) for '+from+' → '+to+' from operation-backend');
      return {bookings:all};
    });
  }
  var load=page(null).catch(function(e){ console.warn('[opsSync] failed to load bookings from operation-backend: '+((e&&e.message)||e)); return null; });
  _opsBookingRangeLoads[key]=load.then(function(result){ delete _opsBookingRangeLoads[key]; return result; },function(e){ delete _opsBookingRangeLoads[key]; throw e; });
  return _opsBookingRangeLoads[key];
}
function bookingV2OpsEnsureMonth(month){
  var r=_opsBookingMonthRange(month); return bookingV2EnsureOpsRange(r);
}
function bookingV2OpsEnsureDay(date){ return bookingV2EnsureOpsRange({from:date,to:date}); }
// Compatibility for explicit callers; no default bulk preload is allowed.
function bookingV2LoadFromOpsBackend(options){
  options=options||{};
  if(!options.from || !options.to) return Promise.resolve(null);
  return bookingV2EnsureOpsRange(options)||Promise.resolve({bookings:[]});
}
var _opsBookingWriteHook=false;
function bookingV2OpsAttachWriteInvalidation(){
  if(_opsBookingWriteHook || !window.laOps || !window.laOps.onWrite) return;
  _opsBookingWriteHook=true;
  window.laOps.onWrite(function(){
    // A write can move a booking between any cached day/month. Keep entities,
    // but revalidate query membership next time that date/month is opened.
    _opsBookingRanges=Object.create(null);
  });
}
