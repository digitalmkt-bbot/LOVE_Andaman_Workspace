/* ═════════════════════════════════════════════════════════════════
   §opsPierService (w4-f2, 2026-10-18) · the pier "Service" column from GET /v1/pier-checkin rows[].service

   Legacy works out what a booking needs on the day (a longtail charter boat or a join, what was sold on tour,
   the upgrades, the add-ons booked ahead) in the browser, in four functions that every screen shares:

     bkLtState(b, routeId, date)   -> {mode boats joinBooked joinExtra joinPax up upDue fromUp}
     bkLtUpgrade(b)                -> {n due}
     ckAddonList(bk, routeId)      -> [{kind label note}]    (longtail first)
     pckJobService / pckJobAddons / pckTripStats / tsAddonList's first part call those, so they follow.

   The server now answers these for the pier sheet: rows[].service = { kind: charter|join|none, boats, join_pax,
   join_booked, extra_pax, upgrades, upgrade_due, from_upgrade, add_ons: [{kind, label, note}] }
   (README "The Pier Check-in sheet"; pure rule in src/domain/pier-service.ts). One read per day, kept per booking and
   route; a write drops it (a check-in tap does not: it cannot change a service) and the open screen draws again when the
   next answer arrives. Until the first answer, for a day that was not read, and offline, legacy's own arithmetic answers.

   The on-tour extras and the other upgrade lines pckJobService draws stay the browser's reading of the sales it holds
   (the server's service has the counts, not those lines).

   Load order: after 71-ops-aboard.js and the pier files (42-48), before 90-ops-boot.js. Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var TTL = 20000;
  var days = {};        // date -> { at, loading, sig, by: { 'bookingId|routeId': service }, anyRoute: { bookingId: service }, raw, rawEpoch }
  var piers = {};       // 'date|pier' -> { loading, raw, rawEpoch }   (w5-d: the sheet's own answer for one pier)
  var epoch = 0;        // bumped by every write that can change the sheet; an answer read before it is "stale" (day() gives null)
  var originals = {};

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function list(){ return typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS) ? SB_BOOKINGS : []; }
  function pckDate(){ try{ return typeof _pckDate !== 'undefined' ? _pckDate : ''; }catch(_){ return ''; } }
  function num(v){ return +v || 0; }

  /* the ids a booking answers to: the server's, the client's */
  function idsOf(b){
    var out = [];
    if(!b) return out;
    [b.opsId, b.id, b.serverId].forEach(function(x){ if(x && out.indexOf(x) < 0) out.push(String(x)); });
    if(b.id){
      var hit = list().filter(function(x){ return x && x.id === b.id; })[0];
      if(hit && hit.opsId && out.indexOf(hit.opsId) < 0) out.push(String(hit.opsId));
    }
    return out;
  }

  function put(date, rows){
    var by = {}, anyRoute = {};
    (rows || []).forEach(function(r){
      if(!r || !r.booking_id || !r.service) return;
      by[r.booking_id + '|' + (r.route_id || '')] = r.service;
      if(!anyRoute[r.booking_id]) anyRoute[r.booking_id] = r.service;
    });
    return { by: by, anyRoute: anyRoute, sig: JSON.stringify(by) };
  }
  function rerender(){
    if(!enabled() || (O.busy && O.busy())) return;
    var v = O.activeView ? O.activeView() : '';
    try{
      if(v === 'piercheckin' && typeof window.renderPierCheckin === 'function') window.renderPierCheckin();
      else if(typeof window._laRerender === 'function') window._laRerender();
    }catch(_){}
  }
  /* one read per day: GET /v1/pier-checkin?date= */
  function ensure(date, force){
    if(!enabled() || !date) return Promise.resolve(null);
    var d = days[date];
    if(d && d.loading) return d.loading;
    if(d && d.by && !force && Date.now() - d.at < TTL) return Promise.resolve(d);
    var cur = days[date] = d || { at: 0, by: null, anyRoute: null, sig: '' };
    var ep = epoch;
    cur.loading = O.get('/v1/pier-checkin', { date: date }).then(function(res){
      var p = put(date, res && res.rows), sig = p.sig + '#' + JSON.stringify(res || {}), changed = sig !== cur.sig;
      cur.by = p.by; cur.anyRoute = p.anyRoute; cur.sig = sig; cur.at = Date.now(); cur.loading = null;
      cur.raw = res || null; cur.rawEpoch = ep;
      if(changed || ep !== epoch) rerender();
      if(ep !== epoch){ cur.at = 0; setTimeout(function(){ if(enabled() && !(days[date] && days[date].loading)) ensure(date, true); }, 0); }   // a write came in while the read was out: read again
      return cur;
    }, function(){ cur.at = Date.now(); cur.loading = null; return cur; });   // a failing read leaves legacy's rule in charge, and is not hammered
    return cur.loading;
  }

  /* w5-d: the whole answer (rows, totals, programmes) for the day, or for one pier; null while a write has made it stale, or before the first answer.
     The screen's functions (pckArrivalOf, pckProgData, pckAgg ...) read it; null means legacy's own arithmetic answers. */
  function day(date){
    var d = days[date]; if(!d || !d.raw || d.rawEpoch !== epoch) return null;
    return d.raw;
  }
  function pierDay(date, pier){
    if(!pier) return day(date);
    var k = date + '|' + pier, c = piers[k];
    if(c && c.raw && c.rawEpoch === epoch) return c.raw;
    if(!enabled() || !date || (c && c.loading)) return null;
    c = piers[k] = c || { raw: null, rawEpoch: -1, loading: null };
    var ep = epoch;
    c.loading = O.get('/v1/pier-checkin', { date: date, pier: pier }).then(function(res){
      c.raw = res || null; c.rawEpoch = ep; c.loading = null;
      rerender();
    }, function(){ c.loading = null; });
    return null;
  }

  /* the service the server gave this booking (and route), most relevant day first; null = ask legacy */
  function serviceOf(b, routeId, date){
    var ids = idsOf(b); if(!ids.length) return null;
    var order = [];
    if(date) order.push(date);                       // a caller that names the day gets that day or legacy's rule, never another day's
    else {
      var pd = pckDate(); if(pd) order.push(pd);
      Object.keys(days).forEach(function(k){ if(order.indexOf(k) < 0) order.push(k); });
    }
    for(var i = 0; i < order.length; i++){
      var d = days[order[i]]; if(!d || !d.by) continue;
      for(var j = 0; j < ids.length; j++){
        var hit = routeId != null && d.by[ids[j] + '|' + routeId];
        if(hit) return hit;
        if(routeId == null && d.anyRoute[ids[j]]) return d.anyRoute[ids[j]];
      }
    }
    return null;
  }

  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsPierService) return;
    originals[name] = orig;
    var w = function(){
      if(!enabled()) return orig.apply(this, arguments);
      var r = fn.call(this, orig, arguments);
      return r === undefined ? orig.apply(this, arguments) : r;
    };
    w.__opsPierService = true; window[name] = w;
  }

  /* bkLtState(b, routeId, date) */
  wrap('bkLtState', function(orig, a){
    var b = a[0], routeId = a[1], date = a[2];
    if(date) ensure(date);
    var s = serviceOf(b, routeId, date); if(!s) return undefined;
    var kind = s.kind === 'charter' || s.kind === 'join' ? s.kind : 'none';
    if(kind === 'charter') return { mode: 'charter', boats: num(s.boats), joinBooked: false, joinExtra: 0, up: num(s.upgrades), upDue: num(s.upgrade_due), fromUp: !!s.from_upgrade };
    if(kind === 'join') return { mode: 'join', boats: 0, joinBooked: !!s.join_booked, joinExtra: num(s.extra_pax), joinPax: s.join_pax != null ? num(s.join_pax) : null, up: 0, upDue: 0, fromUp: false };
    return { mode: 'none', boats: 0, joinBooked: false, joinExtra: 0, up: 0, upDue: 0, fromUp: false };
  });

  /* bkLtUpgrade(b) -> {n, due}: the booking has no day here, so the pier sheet's day (or the day read) answers */
  wrap('bkLtUpgrade', function(orig, a){
    var s = serviceOf(a[0], null, null); if(!s) return undefined;
    return { n: num(s.upgrades), due: num(s.upgrade_due) };
  });

  /* ckAddonList(bk, routeId) -> [{kind, label, note}], longtail first */
  wrap('ckAddonList', function(orig, a){
    var s = serviceOf(a[0], a[1], null); if(!s || !Array.isArray(s.add_ons)) return undefined;
    return s.add_ons.map(function(x){ return { kind: x.kind === 'longtail' ? 'longtail' : 'addon', label: String(x.label || ''), note: String(x.note || '') }; });
  });

  /* the sheet draws: ask for its day */
  wrap('renderPierCheckin', function(orig, a){
    var out = orig.apply(this, a);
    var d = pckDate(); if(d) ensure(d);
    return out === undefined ? null : out;
  });

  /* a booking, a sale on tour, an upgrade, a rate type or an add-on changed (or another machine wrote): forget the answers, read the open day again.
     A check-in tap, a seat-lock reload, a dispatch or a fleet write cannot change a service, and the pier taps all day: they keep the answer. */
  O.onWrite(function(kind){
    var k = String(kind || '');
    // w5-d: the sheet's figures (stages, expected, money, totals) are the server's now: any write that can move one makes the held answer stale,
    //   legacy's arithmetic answers until the fresh one lands (the same number unless two machines disagree)
    // §opsCxlTrip: a weather write closes or reopens a trip, which takes its bookings off the sheet (cancelled_trips), so it counts here too
    if(!/^(market|devlog|daily-report|fleet|costing|trip-pl|config|addon-types)/i.test(k)){
      epoch++;
      var open0 = pckDate();
      if(open0 && O.activeView && O.activeView() === 'piercheckin') setTimeout(function(){ ensure(open0, true); }, 0);
    }
    if(!/^(booking|remote|rate-type|addon|agents|contract|weather)/i.test(k)) return;
    var open = pckDate();
    Object.keys(days).forEach(function(k){ if(!days[k].loading) delete days[k]; else days[k].at = 0; });
    if(open && O.activeView && O.activeView() === 'piercheckin') ensure(open, true);
  });

  O.pierService = { ensure: ensure, day: day, pierDay: pierDay, idsOf: idsOf, serviceOf: serviceOf, loaded: function(date){ return !!(days[date] && days[date].by); }, clear: function(){ days = {}; piers = {}; } };
})();
