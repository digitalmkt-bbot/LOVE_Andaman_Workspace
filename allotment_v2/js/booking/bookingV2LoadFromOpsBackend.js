// Load bookings from operation-backend. Optional filters are passed through to the
// filtered collection endpoint without changing the existing full-load boot behavior.
// Example: bookingV2LoadFromOpsBackend({routeId:'route-1', from:'2030-01-01', to:'2030-01-31', limit:50})
function bookingV2LoadFromOpsBackend(options){
  if(!window.LA_LEGACY_UNAVAILABLE || typeof window.laOpsFetch!=='function') return Promise.resolve(null);
  options=options||{};
  var params=[];
  [['route_id',options.routeId],['from',options.from],['to',options.to],['limit',options.limit]].forEach(function(pair){
    if(pair[1]!==undefined && pair[1]!==null && pair[1]!=='') params.push(encodeURIComponent(pair[0])+'='+encodeURIComponent(pair[1]));
  });
  var path='/v1/bookings'+(params.length?'?'+params.join('&'):'');
  return window.laOpsFetch(path).then(function(r){ return r.ok ? r.json() : null; })
    .then(function(j){
      if(!j || !Array.isArray(j.bookings)) return j;
      var mapped = j.bookings.map(bookingV2FromOpsBooking);
      SB_BOOKINGS.length = 0;
      Array.prototype.push.apply(SB_BOOKINGS, mapped);
      try{ console.log('[opsSync] loaded '+mapped.length+' booking(s) from operation-backend'+(params.length?' with filters':'')); }catch(e){}
      try{ if(typeof bookingV2Render==='function') bookingV2Render(); }catch(e){}
      return j;
    })
    .catch(function(e){ try{ console.warn('[opsSync] failed to load bookings from operation-backend: '+((e&&e.message)||e)); }catch(_){} return null; });
}

// This file is loaded after 08-app.js, so the boot call there cannot see this
// function yet. Start the operation-backend load after this script is defined.
try{ bookingV2LoadFromOpsBackend(); }catch(e){}
