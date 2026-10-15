// Operation-backend booking query cache. Booking pages load only their visible
// date/month; they never bootstrap a broad operational window.
var _opsBookingRanges = Object.create(null), _opsBookingRangeLoads = Object.create(null);
// §calSkel · _opsBookingSeen survives a write's cache drop (its bookings stay in SB_BOOKINGS), so
// only a range that has never loaded shows a skeleton; _opsBookingFailed = its last load failed.
var _opsBookingSeen = Object.create(null), _opsBookingFailed = Object.create(null);
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
function _opsBookingRangeKey(o){ var k=[o.routeId||'',o.from||'',o.to||'',o.limit||100]; if(o.agentId) k.push(o.agentId); return k.join('|'); }
function _opsBookingMerge(mapped){
  var at=Object.create(null);
  SB_BOOKINGS.forEach(function(b,i){ at[b.opsId||b.id]=i; });
  mapped.forEach(function(b){
    var k=b.opsId||b.id, i=at[k];
    if(i===undefined){ at[k]=SB_BOOKINGS.length; SB_BOOKINGS.push(b); return; }
    // §vanKeep · the booking API has no van fields; keep the ones the van-groups load put on
    var V=window.laOps&&window.laOps.vans, kept=V&&V.take?V.take(SB_BOOKINGS[i]):null;
    Object.assign(SB_BOOKINGS[i],b);
    if(kept) V.put(SB_BOOKINGS[i],kept);
  });
}
function bookingV2OpsResetCache(){
  _opsBookingRanges=Object.create(null); _opsBookingRangeLoads=Object.create(null); _opsDailyCounts=Object.create(null);
  _opsBookingSeen=Object.create(null); _opsBookingFailed=Object.create(null);
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
  /* agentId: one agent's bookings; from/to may then be left out (all of that agent's trips).
     The server wants from and to together or neither. refresh: forget a cached load first. */
  if(!options.agentId && (!from || !to)) return null;
  var q={routeId:options.routeId,from:from,to:to,limit:options.limit||100,agentId:options.agentId};
  var key=_opsBookingRangeKey(q);
  if(options.refresh && !_opsBookingRangeLoads[key]) delete _opsBookingRanges[key];
  if(_opsBookingRanges[key]) return null;
  if(_opsBookingRangeLoads[key]) return _opsBookingRangeLoads[key];
  var params=[];
  [['agent_id',q.agentId],['route_id',q.routeId],['from',from],['to',to],['limit',q.limit]].forEach(function(pair){
    if(pair[1]!==undefined && pair[1]!==null && pair[1]!=='') params.push(encodeURIComponent(pair[0])+'='+encodeURIComponent(pair[1]));
  });
  var base='/v1/bookings?'+params.join('&'), all=[], pages=0, MAX_PAGES=options.maxPages||200;
  function page(cursor){
    return window.laOpsFetch(base+(cursor?'&cursor='+encodeURIComponent(cursor):'')).then(function(r){ return r.ok?r.json():null; }).then(function(j){
      if(!j || !Array.isArray(j.bookings)) throw new Error('booking list did not return bookings');
      Array.prototype.push.apply(all,j.bookings);
      if(j.next_cursor && ++pages<MAX_PAGES) return page(j.next_cursor);
      if(j.next_cursor) console.warn('[opsSync] stopped after '+pages+' pages; '+(q.agentId?('agent '+q.agentId):(from+' → '+to))+' is incomplete');
      var mapped=all.map(bookingV2FromOpsBooking); _opsBookingMerge(mapped); _opsBookingRanges[key]=true;
      _opsBookingSeen[key]=true; delete _opsBookingFailed[key];
      console.log('[opsSync] loaded '+mapped.length+' booking(s) for '+(q.agentId?('agent '+q.agentId):(from+' → '+to))+' from operation-backend');
      return {bookings:all};
    });
  }
  var load=page(null).catch(function(e){ _opsBookingFailed[key]=true; console.warn('[opsSync] failed to load bookings from operation-backend: '+((e&&e.message)||e)); return null; });
  _opsBookingRangeLoads[key]=load.then(function(result){ delete _opsBookingRangeLoads[key]; return result; },function(e){ delete _opsBookingRangeLoads[key]; throw e; });
  return _opsBookingRangeLoads[key];
}
function bookingV2OpsEnsureMonth(month){
  var r=_opsBookingMonthRange(month); return bookingV2EnsureOpsRange(r);
}
function bookingV2OpsEnsureDay(date){ return bookingV2EnsureOpsRange({from:date,to:date}); }
/* §calSkel · 'loading' = in flight and never loaded this session (draw a skeleton, not zeros);
   'failed' = the last load failed (callers stop auto-retrying until bookingV2OpsRetryMonth). */
function bookingV2OpsMonthStatus(month){
  var r=_opsBookingMonthRange(month), key=_opsBookingRangeKey({from:r.from,to:r.to,limit:100});
  if(_opsBookingRangeLoads[key] && !_opsBookingSeen[key]) return 'loading';
  return _opsBookingFailed[key] ? 'failed' : '';
}
function bookingV2OpsRetryMonth(month){
  var r=_opsBookingMonthRange(month);
  delete _opsBookingFailed[_opsBookingRangeKey({from:r.from,to:r.to,limit:100})];
  bookingV2Render();
}
function bookingV2OpsEnsureSummary(){
  if(!window.LA_LEGACY_UNAVAILABLE || typeof window.laOpsFetch!=='function') return null;
  var key='summary';
  if(_opsBookingRanges[key]) return null;
  if(_opsBookingRangeLoads[key]) return _opsBookingRangeLoads[key];
  function fetchStats(){ return window.laOpsFetch('/v1/bookings/stats').then(function(r){ return r.ok?r.json():null; }).then(function(j){ if(j) window._opsAllStats=j; }); }
  function fetchMonthCounts(){ return window.laOpsFetch('/v1/bookings/month-counts').then(function(r){ return r.ok?r.json():null; }).then(function(j){ if(j) window._opsAllMonthCounts=j; }); }
  var load=Promise.all([fetchStats(), fetchMonthCounts()]).then(function(){
    _opsBookingRanges[key]=true;
    return {stats:window._opsAllStats, monthCounts:window._opsAllMonthCounts};
  }).catch(function(e){
    console.warn('[opsSync] failed to load all-time summary: '+((e&&e.message)||e));
    return null;
  });
  _opsBookingRangeLoads[key]=load.then(function(result){ delete _opsBookingRangeLoads[key]; return result; },function(e){ delete _opsBookingRangeLoads[key]; throw e; });
  return _opsBookingRangeLoads[key];
}
function bookingV2OpsEnsureAll(){
  // Lightweight All-time summary: use stats + month-counts + first page of bookings.
  // Not the whole database — the backend returns aggregates and recent records.
  if(!window.LA_LEGACY_UNAVAILABLE || typeof window.laOpsFetch!=='function') return null;
  var key='all';
  if(_opsBookingRanges[key]) return null;
  if(_opsBookingRangeLoads[key]) return _opsBookingRangeLoads[key];
  function fetchFirstPage(){
    return window.laOpsFetch('/v1/bookings?limit=100&order=desc').then(function(r){ return r.ok?r.json():null; }).then(function(j){
      if(j && Array.isArray(j.bookings)){
        var mapped=j.bookings.map(bookingV2FromOpsBooking);
        _opsBookingMerge(mapped);
      }
    });
  }
  var sumLoad = bookingV2OpsEnsureSummary();
  var pSummary = sumLoad ? sumLoad : Promise.resolve();
  var load=Promise.all([pSummary, fetchFirstPage()]).then(function(){
    _opsBookingRanges[key]=true;
    return {stats:window._opsAllStats, monthCounts:window._opsAllMonthCounts};
  }).catch(function(e){
    console.warn('[opsSync] failed to load all-time: '+((e&&e.message)||e));
    _opsBookingRanges[key]=true;
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
  days=Math.max(1,+days||7);
  var now=new Date();
  return bookingV2OpsEnsureCreated(_opsBookingYMD(new Date(now.getFullYear(),now.getMonth(),now.getDate()-days+1)),_opsBookingYMD(now),{source:source});
}
/* Bookings created fromYMD..toYMD (Bangkok days), newest first. opts.maxPages
   caps the paging: {maxPages:1} is "the newest page", not the whole range. */
function bookingV2OpsEnsureCreated(fromYMD, toYMD, opts){
  if(!window.LA_LEGACY_UNAVAILABLE || typeof window.laOpsFetch!=='function') return null;
  opts=opts||{};
  var source=(opts.source==='b2c'||opts.source==='b2b')?opts.source:'all';
  var stamp=toYMD, MAX_PAGES=Math.max(1,+opts.maxPages||200);
  var key='recent|'+fromYMD+'|'+stamp+'|'+source+'|'+MAX_PAGES;
  if(_opsBookingRanges[key]) return null;
  if(_opsBookingRangeLoads[key]) return _opsBookingRangeLoads[key];
  var all=[], pages=0;
  var cutoff=new Date(fromYMD+'T00:00:00').getTime();
  function finish(via){
    _opsBookingMerge(all); _opsBookingRanges[key]=true;
    console.log('[opsSync] loaded '+all.length+' recent booking(s) via '+via+' for '+fromYMD+' → '+stamp+' source='+source);
    return {bookings:all, via:via};
  }
  /* 200 is the endpoint's maximum page. Every page is a cross-origin request
     with Authorization, so it also costs a CORS preflight; bigger pages halve
     both. A build that still caps at 100 answers 400, so drop back to 100. */
  var pageLimit=200;
  function recentPage(cursor){
    var qp='created_from='+encodeURIComponent(fromYMD)+'&created_to='+encodeURIComponent(stamp)+'&source='+encodeURIComponent(source)+'&limit='+pageLimit+(cursor?'&cursor='+encodeURIComponent(cursor):'');
    return window.laOpsFetch('/v1/bookings/recent?'+qp).then(function(r){
      if(r.status===400 && pageLimit>100){ pageLimit=100; return { retry: true }; }
      if(r.status===404||r.status===405){ var e=new Error('recent endpoint unavailable (HTTP '+r.status+')'); e.code='recent_unsupported'; throw e; }
      return r.ok?r.json():null;
    }).then(function(j){
      if(j && j.retry) return recentPage(cursor);
      if(!j || !Array.isArray(j.bookings)) throw new Error('recent booking list did not return bookings');
      Array.prototype.push.apply(all,j.bookings.map(bookingV2FromOpsBooking));
      // At exhaustion next_cursor is omitted (not null) — either ends paging.
      if(j.next_cursor && ++pages<MAX_PAGES) return recentPage(j.next_cursor);
      if(j.next_cursor && !opts.maxPages) console.warn('[opsSync] stopped after '+pages+' recent pages; '+fromYMD+' → '+stamp+' is incomplete');
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
/* Bookings + first-trip pax per sale day, counted by the server
   (GET /v1/bookings/daily-counts). bookingV2OpsDailyCounts() reads the cached
   answer as {YYYY-MM-DD:{bk,pax}}, or null before it has arrived. withMarkets
   (Booking Flow) also asks the server for each day's bookings per market id and
   adds it as mk. */
var _opsDailyCounts = Object.create(null);
function bookingV2OpsEnsureDailyCounts(fromYMD, toYMD, withMarkets){
  if(!window.LA_LEGACY_UNAVAILABLE || typeof window.laOpsFetch!=='function') return null;
  var key='daily|'+fromYMD+'|'+toYMD+(withMarkets?'|mk':'');
  if(_opsDailyCounts[key]) return null;
  if(_opsBookingRangeLoads[key]) return _opsBookingRangeLoads[key];
  var load=window.laOpsFetch('/v1/bookings/daily-counts?'+(withMarkets?'markets=1&':'')+'from='+encodeURIComponent(fromYMD)+'&to='+encodeURIComponent(toYMD)).then(function(r){
    if(!r.ok) throw new Error('daily-counts HTTP '+r.status);
    return r.json();
  }).then(function(j){
    if(!j || !Array.isArray(j.days)) throw new Error('daily-counts did not return days');
    var m=Object.create(null); j.days.forEach(function(d){ m[d.date]=withMarkets?{bk:+d.bookings||0, pax:+d.pax||0, mk:d.markets||null}:{bk:+d.bookings||0, pax:+d.pax||0}; });
    _opsDailyCounts[key]=m;
    return j;
  }).catch(function(e){ console.warn('[opsSync] failed to load daily booking counts: '+((e&&e.message)||e)); return null; });
  _opsBookingRangeLoads[key]=load.then(function(result){ delete _opsBookingRangeLoads[key]; return result; });
  return _opsBookingRangeLoads[key];
}
function bookingV2OpsDailyCounts(fromYMD, toYMD){ return _opsDailyCounts['daily|'+fromYMD+'|'+toYMD+'|mk']||_opsDailyCounts['daily|'+fromYMD+'|'+toYMD]||null; }
/* Everything the Dashboard reads for selected day ds, in parallel, one or two
   requests each: the newest page of bookings (Live feed rows), every booking
   created on ds (the feed's day summary), and 60 days of daily counts ending
   on ds (Bookings/day, 30 days plus the 30 before for its trend). Returns null
   when all three are cached. */
function _opsDashCountsFrom(ds){ var d=new Date(ds+'T00:00:00'); return _opsBookingYMD(new Date(d.getFullYear(),d.getMonth(),d.getDate()-59)); }
function bookingV2OpsDashboardCounts(ds){ return bookingV2OpsDailyCounts(_opsDashCountsFrom(ds),ds); }
function bookingV2OpsEnsureDashboard(ds){
  var now=new Date(), today=_opsBookingYMD(now);
  var loads=[
    bookingV2OpsEnsureCreated(_opsBookingYMD(new Date(now.getFullYear(),now.getMonth(),now.getDate()-29)),today,{maxPages:1}),
    bookingV2OpsEnsureCreated(ds,ds),
    bookingV2OpsEnsureDailyCounts(_opsDashCountsFrom(ds),ds),
  ].filter(Boolean);
  if(!loads.length) return null;
  return Promise.all(loads).then(function(rs){ return rs.every(Boolean)?rs:null; });
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
  window.laOps.onWrite(function(kind){
    // Remote van/pickup changes arrive from the change feed and cannot move a
    // booking. Dropping the range cache for them re-pages the whole recent feed
    // on every poll, so skip them.
    if(typeof kind==='string' && /^remote:(van|van_day|van_stop|van_group|pickup_area|pickup_profile)$/.test(kind)) return;
    // A write can move a booking between any cached day/month. Keep entities,
    // but revalidate query membership next time that date/month is opened.
    _opsBookingRanges=Object.create(null); _opsDailyCounts=Object.create(null);
    delete window._opsAllStats; delete window._opsAllMonthCounts;
  });
}
