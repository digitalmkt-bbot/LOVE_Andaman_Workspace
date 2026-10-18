/* ══════════════════════════════════════════════════════════════════════════
   §opsW5aReads (w5-a, 2026-10-18) · small legacy rules that the server already decides, read from its answers
   ──────────────────────────────────────────────────────────────────────────
   One wrapper per legacy function (idiom of the other ops files: legacy runs outside ops mode, and until the server's answer
   for that screen has arrived; then the server's answer drives what is drawn). Nothing here sends anything except plain reads.

   _dashBkDay          the day a booking "entered the system" is the BANGKOK day (the server filters the live feed by +07:00
                       day bounds: GET /v1/bookings/recent created_from / created_to), not the browser's local day.
   getRouteStatusNow   today's season of a route, from the server's calendar (GET /v1/routes?from&to days[date]: override,
   (isRouteActiveToday  season, outside-all-seasons) like getDayStatus; a route with no season keeps legacy's "no data".
    follows)
   getSeatsConsumed    seats sold on a route-day = GET /v1/availability booked_pax (a no-show keeps its seat: decision Q52);
                       the three direct callers (Dashboard, Boat Operation, booking form) read it.
   getAllotment        the seat POOL, the chartered seats and the sold share (fillPct, state) from the server's deployments
   (after ops/50)      list for the day, so the heat map, the sold-% tiers and "full" follow the server's capacity (licence clamp).
   getBoatShopLocation the place of the boat's started job = GET /v1/boats at_shop.
   fcLoadMap, fcCell   Fleet Calendar: passengers per boat-day = GET /v1/fleet/daily-log pax_booked; the boat's status, pier and
                       charter flag of a day = the Boat Operation scope of ops/71 (GET /v1/fleet/availability, /boat-operation).
   bkPendHoldsSeat     does a booking waiting for approval hold seats = the server's allocated_pax (bk.srvAllocatedPax).
   agentTrend          the Sales Board trend (new / gone / up / down / flat) = the board row's trend.category (GET /v1/sales-board).
   flBoardScan         the job board header counts = GET /v1/fleet/dashboard board (boats down, money tied up, silent, no owner, parked).
   getBookingsForRouteDate  the bookings listed in the "charter this boat" confirm = GET /v1/manifest.
   Classic script · after ops/77-*, before ops/90-ops-boot.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  function enabled(){ return !!(O.enabled && O.enabled() && O.state && O.state.loaded); }
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsW5a) return;
    var w = function(){
      if(!enabled()) return orig.apply(this, arguments);
      return fn.apply(this, [orig, this].concat([].slice.call(arguments)));
    };
    w.__opsW5a = true; w.__orig = orig; window[name] = w;
  }
  var YMD = /^\d{4}-\d{2}-\d{2}$/;
  function boatOf(id){ return (typeof BOATS !== 'undefined' && Array.isArray(BOATS)) ? (BOATS.find(function(b){ return b && b.id === id; }) || null) : null; }

  /* ── _dashBkDay · the Bangkok day of the entry time ── */
  wrap('_dashBkDay', function(orig, self, bk){
    var t = (typeof window._dashBkTs === 'function') ? window._dashBkTs(bk) : 0;
    if(!t) return orig.call(self, bk);
    return new Date(t + 7 * 3600 * 1000).toISOString().slice(0, 10);
  });

  /* ── getRouteStatusNow · today's status of a route from the server calendar ── */
  wrap('getRouteStatusNow', function(orig, self, r){
    var today = (typeof TODAY_STR !== 'undefined') ? TODAY_STR : O.today();
    var days = r && window.OPS_ROUTE_DAYS && window.OPS_ROUTE_DAYS[r.id];
    var d = days && days[today];
    if(!d) return orig.call(self, r);
    if(d.source === 'no-seasons') return null;                       // legacy: a route with no season says "no data"
    if(d.source === 'season'){
      var s = (r.seasons || []).find(function(x){ return x.from <= today && x.to >= today; });
      if(s) return s;
    }
    return { type: d.open ? 'open' : 'closed', source: d.source };   // an override, or outside every season
  });

  /* ── getSeatsConsumed · the server's sold seats ── */
  wrap('getSeatsConsumed', function(orig, self, routeId, dateStr, excludeBkId){
    if(excludeBkId || !routeId || !YMD.test(dateStr || '') || !O.availability) return orig.apply(self, [].slice.call(arguments, 2));
    var s = O.availability.get(routeId, dateStr);
    if(s) return Math.max(0, +s.booked_pax || 0);
    O.availability.ensure(dateStr);                                   // the screen redraws when it lands
    return orig.apply(self, [].slice.call(arguments, 2));
  });

  /* ── getAllotment · pool and sold share from the server's deployments (ops/50 has put the seat counts in) ── */
  wrap('getAllotment', function(orig, self, routeId, dateStr, excludeBkId){
    var r = orig.apply(self, [].slice.call(arguments, 2));
    try{
      if(!r || excludeBkId || r.isLand || r.unlimited || !r.fromServer || !O.availability || !YMD.test(dateStr || '')) return r;
      var s = O.availability.get(routeId, dateStr);
      if(!s || s.unlimited || !Array.isArray(s.deployments) || !s.deployments.length) return r;
      var pool = 0, ch = 0;
      s.deployments.forEach(function(d){ var c = Math.max(0, Math.round(+d.capacity || 0)); if(d.chartered) ch += c; else pool += c; });
      r.availableCapacity = pool; r.charterCapacity = ch; r.totalCapacity = pool + ch;
      r.fillPct = pool > 0 ? Math.round(((+r.seatsConsumed || 0) + (+r.lockedSeats || 0)) / pool * 100) : 0;
      r.isFull = (+r.seatsAvailable || 0) <= 0;
      r.state = (pool <= 0 && ch > 0) ? 'all-chartered' : r.isFull ? 'full' : r.fillPct >= 80 ? 'tight' : 'open';
    }catch(_){}
    return r;
  });

  /* ── getBoatShopLocation · where the boat's started job keeps it ── */
  wrap('getBoatShopLocation', function(orig, self, b){
    if(b && b.atShop !== undefined) return String(b.atShop || '').trim();   // null = the server holds no started job for it
    return orig.call(self, b);
  });

  /* ── Fleet Calendar ── */
  function fcRedraw(){
    var el = document.getElementById('view-fleetcal');
    if(O.busy && O.busy()) return;
    if(typeof window.renderFleetCal === 'function' && el && el.classList.contains('active')) { try{ window.renderFleetCal(); }catch(_){} }
  }
  wrap('fcLoadMap', function(orig, self, dates){
    var out = orig.apply(self, [].slice.call(arguments, 2));
    if(!O.fleetViews || !Array.isArray(dates) || !dates.length) return out;
    var ds = dates.slice().sort(), from = ds[0], to = ds[ds.length - 1];
    if(O.shift(from, 92) < to) return out;                           // the server reads at most 93 days
    var j = O.fleetViews.read('/v1/fleet/daily-log', { from: from, to: to }, fcRedraw);
    if(!j || !Array.isArray(j.days)) return out;
    var res = {}; dates.forEach(function(d){ res[d] = {}; });
    j.days.forEach(function(day){
      if(!res[day.date]) return;
      (day.boats || []).forEach(function(b){ var n = +b.pax_booked || 0; if(n) res[day.date][b.boat_id] = n; });
    });
    return res;
  });
  wrap('fcCell', function(orig, self, b, ds, load, memo){
    var BO = O.boatOperation;
    if(!BO || !YMD.test(ds || '')) return orig.apply(self, [].slice.call(arguments, 2));
    BO.ensure([ds], fcRedraw);
    var c = BO.run(orig, self, [].slice.call(arguments, 2));        // status and pier of the day = the server's, once its answer is in
    try{
      var day = BO.day(ds), a = day && (day.assigned || []).find(function(x){ return x.boat_id === b.id; });
      if(a && c && c.k === 'run' && !!c.chr !== !!a.is_charter){ c.chr = !!a.is_charter; if(!c.chr) delete c.ag; }
    }catch(_){}
    return c;
  });

  /* ── bkPendHoldsSeat · the server's allocated_pax ── */
  wrap('bkPendHoldsSeat', function(orig, self, bk){
    if(bk && bk.status === 'pending_approval' && bk.srvAllocatedPax !== undefined){
      var pax = 0;
      (bk.trips || []).forEach(function(t){ pax += (typeof window.bookingV2PaxAllTot === 'function') ? window.bookingV2PaxAllTot(t.pax || {}) : 0; });
      return bk.srvAllocatedPax > 0 || pax === 0;
    }
    return orig.call(self, bk);
  });

  /* ── agentTrend · the board row's category (w5-a: 08-app.js passes the agent id and month as 3rd and 4th argument) ── */
  wrap('agentTrend', function(orig, self, p, pp, aid, ym){
    var board = (aid && ym && O.salesBoardFor) ? O.salesBoardFor(ym) : null;
    var a = board && (board.agents || []).find(function(x){ return x.agent_id === aid; });
    if(!a || !a.trend || +a.pax !== +p || +a.previous_pax !== +pp) return orig.call(self, p, pp);
    var t = a.trend, f = (typeof window.fmtNum === 'function') ? window.fmtNum : function(n){ return String(Math.round(n || 0)); };
    var before = 'เดือนก่อน ' + f(pp) + ' คน';
    if(t.category === 'new') return { cat: 'new', pct: null, badge: 'ใหม่', note: 'เพิ่งเริ่มเดือนนี้' };
    if(t.category === 'gone') return { cat: 'gone', pct: null, badge: '-' + f(pp), note: before + ' → เดือนนี้ 0' };
    if(t.pct == null){ var d = +t.change || 0; return { cat: 'flat', pct: null, badge: (d > 0 ? '+' : '') + f(d), note: before }; }
    var pct = +t.pct;
    if(t.category === 'up') return { cat: 'up', pct: pct, badge: '+' + pct + '%', note: before };
    if(t.category === 'down') return { cat: 'down', pct: pct, badge: pct + '%', note: before };
    return { cat: 'flat', pct: pct, badge: (pct > 0 ? '+' : '') + pct + '%', note: before };
  });

  /* ── flBoardScan · the job board's header counts ── */
  function boardRedraw(){
    if(O.busy && O.busy()) return;
    try{
      if(document.getElementById('fl-board') && typeof window.flBoardRefresh === 'function') window.flBoardRefresh();
      var w = document.getElementById('view-fl-work');
      if(w && w.classList.contains('active') && typeof window.flRenderWork === 'function') window.flRenderWork();
    }catch(_){}
  }
  wrap('flBoardScan', function(orig, self){
    var local = orig.apply(self, [].slice.call(arguments, 2));
    if(!O.fleetViews) return local;
    var d = O.fleetViews.read('/v1/fleet/dashboard', { date: O.today() }, boardRedraw), bd = d && d.board;
    if(!bd) return local;
    return { jobs: +bd.open || 0, down: +bd.boats_down || 0, fleet: +bd.company_boats || 0, money: Math.round(+bd.money_tied || 0),
             silent: +bd.silent_over_60 || 0, noOwner: +bd.no_owner || 0, parked: +bd.parked || 0 };
  });

  /* ── getBookingsForRouteDate · the manifest ── */
  var mf = {};
  O.onWrite(function(){ mf = {}; });
  O.onChange(function(){ mf = {}; });
  function localBooking(ob){ return (typeof SB_BOOKINGS !== 'undefined' ? SB_BOOKINGS : []).find(function(b){ return b && (b.opsId === ob.id || b.id === (ob.external_id || ob.id)); }); }
  function rowsFrom(m, routeId, dateStr){
    return (m.bookings || []).map(function(ob){
      var lb = localBooking(ob), pax = 0;
      (ob.trips || []).forEach(function(t){ if((t.route_id || t.routeId) === routeId && (t.service_date || t.date) === dateStr && (t.booking_mode || t.bookingMode || 'seat') !== 'charter') pax += +t.pax_total || 0; });
      var aid = ob.agent_id || ob.agentId, ag = aid && typeof window.sbGetAgent === 'function' ? window.sbGetAgent(aid) : null;
      return { bookingId: lb ? lb.id : ob.id, customerName: ob.lead_pax || ob.leadPax || '—', pax: pax, voucherRef: ob.voucher_ref || ob.voucherRef || '',
               status: ob.status, agentName: aid ? ((ag && ag.name) || aid) : '—' };
    }).filter(function(r){ return r.pax > 0; });
  }
  wrap('getBookingsForRouteDate', function(orig, self, routeId, dateStr){
    if(!routeId || !YMD.test(dateStr || '')) return orig.apply(self, [].slice.call(arguments, 2));
    var k = routeId + '|' + dateStr, c = mf[k];
    if(c && c.rows) return c.rows;
    if(!c){
      mf[k] = { loading: true };
      O.get('/v1/manifest', { date: dateStr, route_id: routeId }).then(function(m){
        mf[k] = { rows: rowsFrom(m || {}, routeId, dateStr) };
        var cc = null; try{ cc = (typeof _bkV2CharterConfirm !== 'undefined') ? _bkV2CharterConfirm : null; }catch(_){}
        if(cc && cc.routeId === routeId && cc.date === dateStr){
          cc.affectedBookings = mf[k].rows;
          if(typeof window.bookingV2Render === 'function' && !(O.busy && O.busy())) window.bookingV2Render();
        }
      }, function(e){ delete mf[k]; try{ console.warn('[ops] manifest ' + k + ' · ' + (e && e.message)); }catch(_){} });
    }
    return orig.apply(self, [].slice.call(arguments, 2));             // legacy's list until the manifest is in
  });
})();
