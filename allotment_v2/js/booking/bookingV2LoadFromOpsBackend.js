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
  delete window._opsAllStats; delete window._opsAllMonthCounts;
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
function bookingV2OpsEnsureAll(){
  // Lightweight All-time summary: use stats + month-counts + first page of bookings.
  // Not the whole database — the backend returns aggregates and 50 recent records.
  if(!window.LA_LEGACY_UNAVAILABLE || typeof window.laOpsFetch!=='function') return null;
  var key='all';
  if(_opsBookingRanges[key]) return null;
  if(_opsBookingRangeLoads[key]) return _opsBookingRangeLoads[key];
  function fetchStats(){ return window.laOpsFetch('/v1/bookings/stats').then(function(r){ return r.ok?r.json():null; }).then(function(j){ if(j) window._opsAllStats=j; }); }
  function fetchMonthCounts(){ return window.laOpsFetch('/v1/bookings/month-counts').then(function(r){ return r.ok?r.json():null; }).then(function(j){ if(j) window._opsAllMonthCounts=j; }); }
  function fetchFirstPage(){
    return window.laOpsFetch('/v1/bookings?limit=50&order=desc').then(function(r){ return r.ok?r.json():null; }).then(function(j){
      if(j && Array.isArray(j.bookings)){
        var mapped=j.bookings.map(bookingV2FromOpsBooking);
        // Replace SB_BOOKINGS with only these 50 records for the list display
        if(typeof SB_BOOKINGS!=='undefined'){ SB_BOOKINGS.length=0; mapped.forEach(function(b){ SB_BOOKINGS.push(b); }); }
      }
    });
  }
  var load=Promise.all([fetchStats(), fetchMonthCounts(), fetchFirstPage()]).then(function(){
    _opsBookingRanges[key]=true;
    console.log('[opsSync] loaded all-time stats from operation-backend');
    return {stats:window._opsAllStats, monthCounts:window._opsAllMonthCounts};
  }).catch(function(e){
    console.warn('[opsSync] failed to load all-time summary: '+((e&&e.message)||e));
    _opsBookingRanges[key]=true;  // mark done even on error so we don't keep retrying
    return null;
  });
  _opsBookingRangeLoads[key]=load.then(function(result){ delete _opsBookingRangeLoads[key]; return result; },function(e){ delete _opsBookingRangeLoads[key]; throw e; });
  return _opsBookingRangeLoads[key];
}
// Recent-booking feed is intentionally requested only by the Dashboard/B2C
// pages. Preferred source is GET /v1/bookings/recent (creation-time range +
// source filter, Bangkok calendar days). Per the backend partial handoff
// (docs/development/tasks/RECENT_BOOKING_FEED_BACKEND_HANDOFF.md) that route
// is not final — agent logins currently 404 on it and its cursor is neither
// signed nor bound to filters — so a 404/405 falls back to the legacy
// newest-first /v1/bookings paging stopped at the creation-date cutoff.
// Nothing here restores a boot preload or an all-history download.
function bookingV2OpsEnsureRecent(days, source){
  if(!window.LA_LEGACY_UNAVAILABLE || typeof window.laOpsFetch!=='function') return null;
  days=Math.max(1,+days||7);
  source=(source==='b2c'||source==='b2b')?source:'all';
  var now=new Date(), stamp=_opsBookingYMD(now);
  var fromYMD=_opsBookingYMD(new Date(now.getFullYear(),now.getMonth(),now.getDate()-days+1));
  var key='recent|'+fromYMD+'|'+stamp+'|'+source;
  if(_opsBookingRanges[key]) return null;
  if(_opsBookingRangeLoads[key]) return _opsBookingRangeLoads[key];
  var all=[], pages=0, MAX_PAGES=200;
  var cutoff=new Date(now.getFullYear(),now.getMonth(),now.getDate()-days+1).getTime();
  function finish(via){
    _opsBookingMerge(all); _opsBookingRanges[key]=true;
    console.log('[opsSync] loaded '+all.length+' recent booking(s) via '+via+' for '+fromYMD+' → '+stamp+' source='+source);
    return {bookings:all, via:via};
  }
  function recentPage(cursor){
    var qp='created_from='+encodeURIComponent(fromYMD)+'&created_to='+encodeURIComponent(stamp)+'&source='+encodeURIComponent(source)+'&limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):'');
    return window.laOpsFetch('/v1/bookings/recent?'+qp).then(function(r){
      if(r.status===404||r.status===405){ var e=new Error('recent endpoint unavailable (HTTP '+r.status+')'); e.code='recent_unsupported'; throw e; }
      return r.ok?r.json():null;
    }).then(function(j){
      if(!j || !Array.isArray(j.bookings)) throw new Error('recent booking list did not return bookings');
      Array.prototype.push.apply(all,j.bookings.map(bookingV2FromOpsBooking));
      // At exhaustion next_cursor is omitted (not null) — either ends paging.
      if(j.next_cursor && ++pages<MAX_PAGES) return recentPage(j.next_cursor);
      if(j.next_cursor) console.warn('[opsSync] stopped after '+pages+' recent pages; '+fromYMD+' → '+stamp+' is incomplete');
      return finish('recent');
    });
  }
  function legacyPage(cursor){
    var path='/v1/bookings?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):'');
    return window.laOpsFetch(path).then(function(r){ return r.ok?r.json():null; }).then(function(j){
      if(!j || !Array.isArray(j.bookings)) throw new Error('recent booking list did not return bookings');
      var mapped=j.bookings.map(bookingV2FromOpsBooking); Array.prototype.push.apply(all,mapped);
      var oldest=0; mapped.forEach(function(b){ var t=Date.parse(b.createdAt||b.bookingDate||''); if(t && (!oldest||t<oldest)) oldest=t; });
      if(j.next_cursor && ++pages<MAX_PAGES && (!oldest || oldest>=cutoff)) return legacyPage(j.next_cursor);
      return finish('legacy-list');
    });
  }
  var load=recentPage(null).catch(function(e){
    if(e && e.code==='recent_unsupported'){ all=[]; pages=0; return legacyPage(null); }
    console.warn('[opsSync] failed to load recent bookings: '+((e&&e.message)||e)); return null;
  }).catch(function(e){ console.warn('[opsSync] failed to load recent bookings: '+((e&&e.message)||e)); return null; });
  _opsBookingRangeLoads[key]=load.then(function(result){ delete _opsBookingRangeLoads[key]; return result; },function(e){ delete _opsBookingRangeLoads[key]; throw e; });
  return _opsBookingRangeLoads[key];
}
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
    delete window._opsAllStats; delete window._opsAllMonthCounts;
  });
}
