// Load only the operational booking window from operation-backend. The old unfiltered
// request returned the complete booking history on every boot, which made startup and
// localStorage grow with the database. Callers can still provide an explicit range.
// Example: bookingV2LoadFromOpsBackend({routeId:'route-1', from:'2030-01-01', to:'2030-01-31'})
var _opsBookingLoadSeq = 0;
// One operational window must have one pagination chain. Before this guard, the
// old 08-app boot call and ops boot could both fetch page one; any later render
// that called the loader could start another full cursor walk too.
var _opsBookingLoadInFlight = null, _opsBookingLoadInFlightKey = '';
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
  // The backend pages at 50 by default (max 100) and hands back next_cursor; a single request
  // silently loaded only the first page of the window. Ask for full pages and follow the cursor.
  [['route_id',options.routeId],['from',from],['to',to],['limit',options.limit||100]].forEach(function(pair){
    if(pair[1]!==undefined && pair[1]!==null && pair[1]!=='') params.push(encodeURIComponent(pair[0])+'='+encodeURIComponent(pair[1]));
  });
  var base='/v1/bookings?'+params.join('&');
  // The canonical query string is stable for equal inputs, so callers joining
  // the same load share its request/page chain rather than duplicate it.
  if(_opsBookingLoadInFlight && _opsBookingLoadInFlightKey===base) return _opsBookingLoadInFlight;
  var seq=++_opsBookingLoadSeq;
  var all=[], pages=0, MAX_PAGES=200;
  function page(cursor){
    var path=base+(cursor?'&cursor='+encodeURIComponent(cursor):'');
    return window.laOpsFetch(path).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){
      if(!j || !Array.isArray(j.bookings)) return null;
      Array.prototype.push.apply(all, j.bookings);
      if(j.next_cursor && ++pages<MAX_PAGES && seq===_opsBookingLoadSeq) return page(j.next_cursor);
      if(j.next_cursor) try{ console.warn('[opsSync] stopped after '+pages+' pages; window '+from+' -> '+to+' is incomplete'); }catch(e){}
      return { bookings: all };
    });
  }
  var load=page(null)
    .then(function(j){
      if(!j || !Array.isArray(j.bookings) || seq!==_opsBookingLoadSeq) return j;
      var mapped = j.bookings.map(bookingV2FromOpsBooking);
      SB_BOOKINGS.length = 0;
      Array.prototype.push.apply(SB_BOOKINGS, mapped);
      try{ console.log('[opsSync] loaded '+mapped.length+' booking(s) for '+from+' → '+to+' from operation-backend'); }catch(e){}
      return j;
    })
    .catch(function(e){ try{ console.warn('[opsSync] failed to load bookings from operation-backend: '+((e&&e.message)||e)); }catch(_){} return null; });
  _opsBookingLoadInFlightKey=base;
  _opsBookingLoadInFlight=load.then(function(result){
    if(_opsBookingLoadInFlightKey===base){ _opsBookingLoadInFlight=null; _opsBookingLoadInFlightKey=''; }
    return result;
  },function(error){
    if(_opsBookingLoadInFlightKey===base){ _opsBookingLoadInFlight=null; _opsBookingLoadInFlightKey=''; }
    throw error;
  });
  return _opsBookingLoadInFlight;
}

// §opsBoot · called by js/ops/90-ops-boot.js, after the catalogue, deployments and seat locks
// (a trip's lock draws are mapped back to client locks, so the locks must be loaded first).
