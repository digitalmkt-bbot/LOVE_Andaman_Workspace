/* ══════════════════════════════════════════════════════════════════════════
   §opsDashboard (2026-10-10) · staff Dashboard ⇄ GET /v1/dashboard

   The legacy Dashboard is a large composite page: operations facts, local
   fleet-maintenance/doc cards, B2C and accounting widgets, plus a 30-day
   client chart. `/v1/dashboard` is authoritative for the operational day
   facts it returns. This adapter deliberately does NOT pretend that omitted
   cards are server facts: while a request is loading or failed, renderDash()
   labels its locally-derived display accordingly.

   §opsDashSeatCal: the Seats-available month grid (_dashSeatCalHtml) takes its days from GET /v1/dashboard?mode=month
   `days[]` ({date, cap, free, booked, weather_closed, state}; `family` limits it), see the end of this file.

   The endpoint also supports month/year. They are cached here for the next
   renderer migration, but the legacy Dashboard's current "month" chart is a
   rolling 30 days (not a calendar month), so it must not be replaced by the
   endpoint's calendar-month aggregate without an explicit UX decision.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var cache = {}, loading = {}, failed = {}, stale = {};
  /* the month answer also depends on the family chips of the seat calendar, so they are part of its key */
  function key(date, mode, family){ return date + '|' + (mode || 'day') + (family ? '|' + family : ''); }
  function validDate(s){ return /^\d{4}-\d{2}-\d{2}$/.test(s || ''); }
  function redraw(){
    /* while the loader is up nothing is painted yet, so a focused input elsewhere
       must not hold the page on the loader forever */
    if((O.busy() && !window._dashLoaderShown) || O.activeView() !== 'dashboard' || typeof window.renderDash !== 'function') return;
    window.renderDash();
  }
  /* opts.bare (§loadOnOpen): the day alone, without the other pieces. The pier ticker reads yesterday's routes[].booked_pax
     only; asking for the month and both rolling series too made the server build three more dashboards for it. A bare day is
     still a full day answer (the pieces are cached under their own keys), so it is cached under the same key. */
  function ensure(date, mode, family, opts){
    mode = (mode === 'month' || mode === 'year') ? mode : 'day';
    if(!O.enabled() || !validDate(date)) return Promise.resolve(null);
    family = (mode === 'month' && family) ? family : '';
    var k = key(date, mode, family);
    if(cache[k] && !stale[k]) return Promise.resolve(cache[k]);
    if(loading[k]) return loading[k];
    delete failed[k];
    /* §dashOneCall · a day request also asks for the rest of the screen (seat calendar month, 30-day bars,
       12-month bars): one request instead of four. The server nests each piece under its own key; they are
       cached under the keys their own requests would use. */
    var q = { date: date, mode: mode };
    if(mode === 'day' && !(opts && opts.bare)){
      var fam = window._dashCalFam || '';
      q.include = 'month,rolling_month,rolling_year';
      if(fam) q.family = fam;
    }
    loading[k] = O.get('/v1/dashboard', family ? { date: date, mode: mode, family: family } : q).then(function(j){
      if(!j || j.version !== 1 || !j.summary) throw new Error('invalid dashboard response');
      if(mode === 'day'){
        var parts = { month: [date.slice(0, 8) + '01', 'month', q.family || ''], rolling_month: [date, 'rolling_month', ''], rolling_year: [date, 'rolling_year', ''] };
        Object.keys(parts).forEach(function(name){
          if(!j[name]) return;
          var pk = key(parts[name][0], parts[name][1], parts[name][2]);
          cache[pk] = j[name]; delete stale[pk]; delete failed[pk];
          delete j[name];
        });
      }
      cache[k] = j; delete stale[k];
      return j;
    }).catch(function(e){
      failed[k] = e;
      O.fail('Dashboard data did not load', e);
      return null;
    }).then(function(j){ delete loading[k]; redraw(); return j; });
    return loading[k];
  }
  function get(date, mode, family){ return cache[key(date, mode || 'day', family)] || null; }
  /* a write makes the cached summary stale, but it stays on screen until the
     refetch lands; the next ensure() refetches it */
  function markStale(){ Object.keys(cache).forEach(function(k){ stale[k] = true; }); }
  function status(date, mode, family){
    var k = key(date, mode || 'day', family);
    return loading[k] ? 'loading' : cache[k] ? 'ready' : failed[k] ? 'failed' : 'idle';
  }
  function error(date, mode, family){ return failed[key(date, mode || 'day', family)] || null; }
  function clear(){ cache = {}; loading = {}; failed = {}; stale = {}; }
  O.onWrite(function(){ markStale(); failed = {}; });

  /* "ยังไม่ได้วางบิล" (unbilled) in the needs-action popup comes from the server's
     `unbilled {count, baht, agents}` (legacy _dashBoardData rule, 04-data-core.js,
     evaluated on the server). It is company-wide, so any cached dashboard entry
     carries it whatever date/mode was asked for: take the newest. The server's baht
     has 2 decimals; legacy showed whole baht (Math.round), so round here. Until the
     first response lands (or if it fails) the legacy local figure stays on screen. */
  function unbilled(){
    var best = null;
    Object.keys(cache).forEach(function(k){
      var j = cache[k];
      if(j && j.unbilled && (!best || String(j.generated_at || '') > String(best.generated_at || ''))) best = j;
    });
    return best ? best.unbilled : null;
  }
  var legacyBoard = window._dashBoardData;
  if(typeof legacyBoard === 'function'){
    var board = function(){
      var d = legacyBoard.apply(this, arguments);
      var u = O.enabled() ? unbilled() : null;
      if(d && u){
        d.unN = Math.max(0, Math.round(+u.count || 0));
        d.unB = Math.round(+u.baht || 0);
        d.unAg = Math.max(0, Math.round(+u.agents || 0));
      }
      return d;
    };
    board.__ops = true; window._dashBoardData = board;
  }
  /* §opsDashSeatCal · the Dashboard's "Seats available" month grid (legacy _dashSeatCalHtml, 04-data-core.js).
     Legacy added up each route's getAllotment for every day of the month in the browser (open/closed, weather, seats,
     tier colour). The server now answers one entry per day: {date, cap, free, booked, weather_closed, state} with state
     wx | none | soldout | t1..t5 (the colour tiers). The legacy function still draws the card (header, month arrows, family
     chips, legend); only the day cells and the "today" footer are replaced by the server's. Cell look and click are
     legacy's, copied. Until the month has landed (or if it failed) the legacy grid stays on screen; landing redraws
     the Dashboard (ensure -> redraw). A failed month is not asked again until a write clears it. */
  var legacySeatCal = window._dashSeatCalHtml;
  if(typeof legacySeatCal === 'function'){
    var PAL = {soldout:['#BCE595','#1F4D2C'],t5:['#CFE9AC','#1F4D2C'],t4:['#E8F5D8','#3B6D11'],t3:['#FAF0C8','#8A6A0B'],t2:['#FBE1C6','#B4600F'],t1:['#FBE9E9','#A32D2D'],none:['#F5F5F2','#b9beb6'],wx:['#F7E7E7','#A32D2D']};
    var pad = function(n){ return String(n).padStart(2, '0'); };
    var tr = function(t){ return typeof window.laT === 'function' ? window.laT(t) : t; };
    var seatMonth = function(month, fam){
      var date = month + '-01', j = get(date, 'month', fam);
      if(j && Array.isArray(j.days)) { if(stale[key(date, 'month', fam)]) ensure(date, 'month', fam); return j; }
      if(status(date, 'month', fam) === 'idle') ensure(date, 'month', fam);
      return null;
    };
    var seatCal = function(dx, F){
      var html = legacySeatCal.apply(this, arguments);
      try{
        if(!O.enabled() || typeof html !== 'string') return html;
        var today = typeof TODAY_STR !== 'undefined' ? TODAY_STR : O.today();
        var fam = window._dashCalFam || '';
        var month = window._dashCalMonth || (window._dashDate || today).slice(0, 7);
        var j = seatMonth(month, fam); if(!j) return html;
        var a = html.indexOf('<div class="dv-calg">'), b = html.indexOf('</div></div><div class="dv-calft">');
        if(a < 0 || b < 0) return html;
        var by = {}; j.days.forEach(function(d){ by[d.date] = d; });
        var yy = parseInt(month.slice(0, 4), 10), mm = parseInt(month.slice(5, 7), 10);
        var startDow = (new Date(yy, mm - 1, 1).getDay() + 6) % 7, daysIn = new Date(yy, mm, 0).getDate();
        var wk = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(function(w){ return '<div class="dw">' + w + '</div>'; }).join('');
        var cells = '';
        for(var i = 0; i < startDow; i++) cells += '<div></div>';
        for(var day = 1; day <= daysIn; day++){
          var ds = yy + '-' + pad(mm) + '-' + pad(day), d = by[ds] || { cap: 0, free: 0, booked: 0, weather_closed: 0, state: 'none' };
          var state = PAL[d.state] ? d.state : 'none', col = PAL[state], isToday = (ds === today);
          var ring = isToday ? 'box-shadow:inset 0 0 0 2px #15382B;' : '';
          var closedLike = (state === 'none' || state === 'wx');
          var num = (state === 'wx') ? '&#9928;' : ((state === 'none') ? '&mdash;' : d.free);
          var sub = (state === 'wx') ? 'Cancelled' : ((state === 'none') ? 'Closed' : ('/' + d.cap + ' free'));
          var extra = closedLike ? '' : '<span class="p">' + d.booked + ' pax' + (d.weather_closed > 0 ? ' &middot; &#9928;' + d.weather_closed : '') + '</span>';
          var click = closedLike ? '' : (' onclick="bookingV2OpenFiltered(\'\',\'' + ds + '\')"');
          cells += '<div class="dv-cell"' + click + ' style="' + ring + 'background:' + col[0] + ';' + (closedLike ? '' : 'cursor:pointer') + '">'
            + '<span class="d" style="color:' + col[1] + '">' + day + (isToday ? ' &middot; ' + tr('วันนี้') : '') + '</span>'
            + '<span class="big"><span class="n" style="color:' + col[1] + '">' + num + '</span>'
            + '<span class="s" style="color:' + col[1] + '">' + sub + '</span></span>' + extra + '</div>';
        }
        var out = html.slice(0, a) + '<div class="dv-calg">' + wk + cells + html.slice(b);
        /* footer: today's own numbers, from today's month when that is not the month on screen */
        var tj = (today.slice(0, 7) === month) ? j : seatMonth(today.slice(0, 7), fam);
        var t = tj && tj.days.filter(function(x){ return x.date === today; })[0];
        var f = out.indexOf('<div class="dv-calft">');
        if(t && f >= 0){
          var has = t.state !== 'none' && t.state !== 'wx';
          out = out.slice(0, f) + '<div class="dv-calft">'
            + '<span class="t">' + tr('วันนี้') + (has ? ' &middot; <span style="color:#1B6AA6;background:#E4EFFA;border-radius:5px;padding:1px 7px;font-family:\'DM Mono\',ui-monospace,monospace">' + t.booked + ' pax</span>' : '') + '</span>'
            + '<span class="r"><b>' + t.free + '</b> / ' + t.cap + ' ' + tr('ที่นั่งว่าง') + '</span>'
            + '<button onclick="bookingV2OpenFiltered(\'\',\'' + today + '\')">' + tr('เปิดวันนี้') + '</button>'
            + '</div></div>';
        }
        return out;
      }catch(_){ return html; }
    };
    seatCal.__ops = true; seatCal.__orig = legacySeatCal; window._dashSeatCalHtml = seatCal;
  }

  O.dashboard = { ensure: ensure, get: get, status: status, error: error, clear: clear, unbilled: unbilled };
})();
