/* ═════════════════════════════════════════════════════════════════
   §opsPierDay (w5-d, 2026-10-18) · the Pier Check-in sheet's own arithmetic from GET /v1/pier-checkin

   Legacy works out, in the browser, how each customer reaches the pier (OWN / PK / KL / NOVAN), which pier a trip belongs to,
   how a booking split across boats or van parts becomes several rows, what each row expects, and the totals and the
   programme cards (pax, arrived / cleared / boarded, PK and KL done of total, "ออกได้ / ขาด n คน"). The server answers all of
   it (README "The Pier Check-in sheet", src/domain/pier-checkin.ts):

     GET /v1/pier-checkin?date=&pier=   rows[] { booking_id route_id split{by index of} arrival booked expected stage no_show
                                                  strand boat_id van_id money{due got paid fees no_slip} }
                                        totals · counts · programmes[] { family_id pax booked rows arr clr brd due status variants[] }

   Wrapped here (each one answers from the held answer; legacy's function answers until the first answer, after a write has made
   the answer stale, offline, and on the land check-in):

     pckArrivalOf(row)               -> rows[].arrival
     pckInPier(trip)                 -> the answer for ?pier= lists the trip's route
     pckExpandBoatSplits / VanSplits -> one row per rows[] part: booked, expected, boat, van, arrival (money: the server's, first row only)
     pckAgg(rows) / pckSheetAgg(rows)-> the rows' stage, expected, no_show and money, as the server gave them
     pckProgData(date)               -> programmes[] (cards, variants, PK / KL / OWN boxes)
     pckProgStatus(A)                -> programmes[].status (the pier's own answer when a pier is picked)
     ckTripWx / ckTripWxLbl          -> cancelled_trips[] (a trip closed from the Cancellations tab, and why)
     laOpsPierCxlTrip(date, pier)    -> cancelled_trip (the grey "ทริปยกเลิก" chip in renderPierCheckin)

   The held answer, its freshness and the per-pier read live in 74-ops-pier-service.js (O.pierService.day / pierDay).
   What stays the browser's: the pax breakdown of a split part (ad / chd / inf / foc of a booking's own boat split or van part: a client
   fact), the seat-lock rows of a programme with no booking yet, the order of the cards (names), the Love Kingdom add-on-only skip.
   Group totals (per boat, per van) are the sum of the rows' server figures: MISSING-SERVER-FIELD counts.groups (docs/walk/w5-d.md).

   Load order: after 74-ops-pier-service.js. Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var originals = {};

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function g(name){ try{ return window[name]; }catch(_){ return undefined; } }
  function num(v){ return +v || 0; }
  function PS(){ return O.pierService || null; }
  function pckDate(){ try{ return typeof _pckDate !== 'undefined' ? _pckDate : ''; }catch(_){ return ''; } }
  function pckPier(){ try{ return typeof _pckPier !== 'undefined' ? _pckPier : null; }catch(_){ return null; } }
  function isLand(){ try{ return !!(typeof _pckLand !== 'undefined' && _pckLand); }catch(_){ return false; } }

  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsPierDay) return;
    originals[name] = orig;
    var w = function(){
      if(!enabled() || isLand()) return orig.apply(this, arguments);
      var r;
      try{ r = fn.call(this, orig, arguments); }catch(e){ if(window.console) console.warn('[ops] pier day · ' + name + ' · ' + (e && e.message)); r = undefined; }
      return r === undefined ? orig.apply(this, arguments) : r;
    };
    w.__opsPierDay = true; window[name] = w;
  }

  /* ── index of one answer: bookingId -> rows ── */
  var idxOf = typeof WeakMap === 'function' ? new WeakMap() : null;
  function index(ans){
    if(!ans) return null;
    var hit = idxOf && idxOf.get(ans); if(hit) return hit;
    var by = {}, routes = {};
    (ans.rows || []).forEach(function(r){ if(!r) return; (by[r.booking_id] = by[r.booking_id] || []).push(r); routes[r.route_id] = 1; });
    (ans.programmes || []).forEach(function(p){ (p.variants || []).forEach(function(v){ routes[v.route_id] = 1; }); });
    var out = { by: by, routes: routes };
    if(idxOf) idxOf.set(ans, out);
    return out;
  }
  function dayAns(date){ var p = PS(); return p && date ? p.day(date) : null; }

  /* the server rows of this booking on this route (the day's trip), null when the answer has none */
  function rowsOf(b, routeId, date){
    var p = PS(), ans = dayAns(date); if(!p || !ans || !b) return null;
    var ix = index(ans), ids = p.idsOf(b), out = [];
    ids.forEach(function(id){ (ix.by[id] || []).forEach(function(r){ if((routeId == null || r.route_id === routeId) && out.indexOf(r) < 0) out.push(r); }); });
    out.sort(function(a, c){ return (a.split ? a.split.index : 0) - (c.split ? c.split.index : 0); });
    return out.length ? out : null;
  }
  /* the server row of a legacy sheet row (a part of a split booking carries bsIdx / vsIdx) */
  function rowOfSheetRow(r, date){
    if(!r || !r.b) return null;
    var rid = r.t && r.t.routeId, rows = rowsOf(r.b, rid, date); if(!rows) return null;
    if(rows.length === 1) return rows[0];
    var by = r.bsIdx != null ? 'boat' : (r.vsIdx != null ? 'van' : null), idx = r.bsIdx != null ? r.bsIdx : r.vsIdx;
    if(by){ for(var i = 0; i < rows.length; i++) if(rows[i].split && rows[i].split.by === by && rows[i].split.index === idx) return rows[i]; return null; }
    return rows[0];
  }
  function moneyFrom(base, m){
    var out = {}; Object.keys(base || {}).forEach(function(k){ out[k] = base[k]; });
    out.due = num(m.due); out.got = num(m.got); out.noSlip = num(m.no_slip); out.pierFee = num(m.fees); out.pierPaid = num(m.paid);
    return out;
  }

  /* ── arrival: OWN / PK / KL / NOVAN ── */
  wrap('pckArrivalOf', function(orig, a){
    var r = a[0], row = rowOfSheetRow(r, pckDate()); if(!row || !row.arrival) return undefined;
    return row.arrival;
  });

  /* ── which pier a trip belongs to ── */
  wrap('pckInPier', function(orig, a){
    var t = a[0], pier = pckPier(); if(!pier || !t) return undefined;
    var p = PS(), date = pckDate(); if(!p || !date) return undefined;
    var full = p.day(date), sub = p.pierDay(date, pier);       // asks for the pier's answer when it is not held
    if(!full || !sub) return undefined;
    var rid = t.routeId, f = index(full), s = index(sub);
    if(!f.routes[rid] && !s.routes[rid]) return undefined;      // a route the server has not seen today: legacy's rule
    return !!s.routes[rid];
  });

  /* ── rows: boat splits, van splits ── */
  function setServerFigures(row, sr){
    row.booked = num(sr.booked); row.expect = num(sr.expected);
    if(sr.arrival) row.arr = sr.arrival;
  }
  wrap('pckExpandBoatSplits', function(orig, a){
    var row = a[0], b = a[1], date = a[2], out = a[3];
    var rows = rowsOf(b, row.t && row.t.routeId, date); if(!rows) return undefined;
    var parts = rows.filter(function(r){ return r.split && r.split.by === 'boat'; });
    if(parts.length < 2){
      if(rows[0].strand) return undefined;
      setServerFigures(row, rows[0]); out.push(row); return out;
    }
    var sp = typeof g('bkBoatSplits') === 'function' ? window.bkBoatSplits(b, date) : null;
    if(!sp || sp.length !== parts.length) return undefined;                     // the booking's own split is not here yet
    parts.forEach(function(sr, i){
      var r2 = {}; Object.keys(row).forEach(function(k){ r2[k] = row[k]; });
      var x = sp[sr.split.index] || sp[i];
      r2.bid = sr.boat_id || x.boatId || ''; r2.bsIdx = sr.split.index; r2.bsN = sr.split.of; r2.bsPaxBd = window.bkSplitPax(x);
      setServerFigures(r2, sr);
      if(r2.money) r2.money = moneyFrom(r2.money, sr.money || {});
      out.push(r2);
    });
    return out;
  });
  wrap('pckExpandVanSplits', function(orig, a){
    var row = a[0], b = a[1], date = a[2], out = a[3];
    var rows = rowsOf(b, row.t && row.t.routeId, date); if(!rows) return undefined;
    var parts = rows.filter(function(r){ return r.split && r.split.by === 'van'; });
    if(parts.length < 2){
      if(rows[0].strand) return undefined;
      setServerFigures(row, rows[0]); out.push(row); return out;
    }
    var O2 = row.O || {}, sp = Array.isArray(O2.vanSplits) ? O2.vanSplits.filter(Boolean) : null;
    if(!sp || sp.length !== parts.length) return undefined;
    parts.forEach(function(sr){
      var i = sr.split.index, x = sp[i]; if(!x) return;
      var r2 = {}; Object.keys(row).forEach(function(k){ r2[k] = row[k]; });
      var pb = { ad: +x.ad || 0, chd: +x.chd || 0, inf: +x.inf || 0, foc: +x.foc || 0 };
      r2.vsIdx = i; r2.vsN = sr.split.of; r2.vsPaxBd = pb; r2.vsp = x;
      setServerFigures(r2, sr);
      r2.vanId = sr.van_id || x.vanId || '';
      r2.ck = window.ckSlotGet(O2, 'pier', i);
      r2._ckKind = 'pier#' + i;
      if(!x.main){
        var ar = (x.pickAreaId && typeof g('bookingV2GetArea') === 'function') ? (window.bookingV2GetArea(x.pickAreaId) || {}) : {};
        r2._pickHotel = (x.pickHotel || '').trim() || ar.name || '';
        r2._pickArea = ar.name || '';
        r2._pickWho = (x.altWho || '').trim();
      }
      if(r2.money) r2.money = moneyFrom(r2.money, sr.money || {});
      out.push(r2);
    });
    return out;
  });

  /* ── totals: the rows' server figures ── */
  function aggRows(rows, date){
    var recs = [];
    for(var i = 0; i < rows.length; i++){
      var r = rows[i];
      if(r.strand){ recs.push({ r: r, s: null }); continue; }
      var s = rowOfSheetRow(r, date); if(!s) return null;       // one row the answer does not know: legacy sums them all
      recs.push({ r: r, s: s });
    }
    return recs;
  }
  var RANK = { wait: 0, arr: 1, clr: 2, on: 3, vd: 0 };
  wrap('pckAgg', function(orig, a){
    var rows = a[0], date = pckDate(); if(!Array.isArray(rows)) return undefined;
    var recs = aggRows(rows, date); if(!recs) return undefined;
    var x = { n: 0, pax: 0, arr: 0, clr: 0, on: 0, arrP: 0, clrP: 0, onP: 0, due: 0, ns: 0, vd: 0, sx: 0 };
    recs.forEach(function(rc){
      var r = rc.r, s = rc.s;
      if(r.strand){ x.sx++; return; }
      if(typeof g('bkB2CAddonTo') === 'function' && window.bkB2CAddonTo(r.b)) return;
      var due = s.money ? num(s.money.due) : 0;
      if(s.stage === 'vd'){ if(due > 0) x.due += due; x.vd++; return; }
      x.n++;
      var px = num(s.expected); x.pax += px;
      var k = RANK[s.stage] || 0;
      if(k >= 1) x.arrP += px; if(k >= 2) x.clrP += px; if(k >= 3) x.onP += px;
      if(k >= 1) x.arr++; if(k >= 2) x.clr++; if(k >= 3) x.on++;
      if(due > 0 && s.stage !== 'on') x.due += due;
      if(s.no_show != null) x.ns += num(s.no_show);
    });
    return x;
  });
  wrap('pckSheetAgg', function(orig, a){
    var rows = a[0], date = pckDate(); if(!Array.isArray(rows)) return undefined;
    var recs = aggRows(rows, date); if(!recs) return undefined;
    var x = { n: 0, pax: 0, arr: 0, on: 0, due: 0, ckv: 0, sx: 0 };
    recs.forEach(function(rc){
      var r = rc.r, s = rc.s;
      if(r.strand){ x.sx++; return; }
      x.n++; x.pax += num(s.expected);
      if(s.stage === 'arr' || s.stage === 'clr' || s.stage === 'on') x.arr++;
      if(s.stage === 'on') x.on++;
      x.due += s.money ? num(s.money.due) : 0;
      if(r.van && r.van.at) x.ckv++;                         // the van sheet's own tick (its record), not a pier figure
    });
    return x;
  });

  /* ── programmes ── */
  function familyOf(pg){
    var f = null;
    (pg.variants || []).forEach(function(v){ if(!f && typeof g('bookingV2RouteFamily') === 'function') f = window.bookingV2RouteFamily(v.route_id); });
    if(f && f.id === pg.family_id) return f;
    var fams = typeof _BKV2_FAMILIES !== 'undefined' ? _BKV2_FAMILIES : [];
    for(var i = 0; i < fams.length; i++) if(fams[i].id === pg.family_id) return fams[i];
    return null;
  }
  wrap('pckProgData', function(orig, a){
    var date = a[0], ans = dayAns(date); if(!ans || !Array.isArray(ans.programmes)) return undefined;
    var list = [], order = [];
    for(var i = 0; i < ans.programmes.length; i++){
      var pg = ans.programmes[i], f = familyOf(pg); if(!f) return undefined;
      var A = { f: f, v: {}, vord: [], pax: num(pg.pax), booked: num(pg.booked), arr: num(pg.arr), clr: num(pg.clr), brd: num(pg.brd), due: num(pg.due), rows: num(pg.rows) };
      (pg.variants || []).forEach(function(v){
        A.v[v.route_id] = { pax: num(v.pax), booked: num(v.booked), arr: num(v.arr), clr: num(v.clr), brd: num(v.brd), due: num(v.due), rows: num(v.rows),
          PK: { d: num(v.zones && v.zones.PK && v.zones.PK.done), t: num(v.zones && v.zones.PK && v.zones.PK.total) },
          KL: { d: num(v.zones && v.zones.KL && v.zones.KL.done), t: num(v.zones && v.zones.KL && v.zones.KL.total) },
          OWN: { t: num(v.zones && v.zones.OWN && v.zones.OWN.total) } };
        if(v.cancelled){ A.v[v.route_id].wx = 1; A.v[v.route_id].cxlPax = num(v.cancelled_pax); }   /* §opsCxlTrip · pckProgList draws "ยกเลิก · reason" */
        A.vord.push(v.route_id);
      });
      list.push(A); order.push(pg.family_id);
    }
    /* seats locked for a trip with no booking yet: the programme is still on the card (locks are the seat-lock cache's, not a pier figure) */
    var routes = typeof ROUTES !== 'undefined' ? ROUTES : [];
    routes.forEach(function(rr){
      var lk = typeof g('bookingV2LockedTotal') === 'function' ? window.bookingV2LockedTotal(rr.id, date) : 0;
      if(lk <= 0) return;
      var f = typeof g('bookingV2RouteFamily') === 'function' ? window.bookingV2RouteFamily(rr.id) : null; if(!f) return;
      var A = list.filter(function(x){ return x.f.id === f.id; })[0];
      if(!A){ A = { f: f, v: {}, vord: [], pax: 0, booked: 0, arr: 0, clr: 0, brd: 0, due: 0, rows: 0 }; list.push(A); }
      if(!A.v[rr.id]){ A.v[rr.id] = { pax: 0, booked: 0, arr: 0, clr: 0, brd: 0, due: 0, rows: 0, PK: { d: 0, t: 0 }, KL: { d: 0, t: 0 }, OWN: { t: 0 } }; A.vord.push(rr.id); }
      A.v[rr.id].locked = (A.v[rr.id].locked || 0) + lk;
      A.locked = (A.locked || 0) + lk;
    });
    list.sort(function(x, y){ return y.pax - x.pax || String(x.f.name).localeCompare(String(y.f.name)); });
    list.forEach(function(A){
      A.vord.sort(function(x, y){
        return String(window.pckDepOf(x) || '99:99').localeCompare(String(window.pckDepOf(y) || '99:99'))
          || String(window.pckVarLbl(A.f, x)).localeCompare(String(window.pckVarLbl(A.f, y)));
      });
    });
    return list;
  });

  var ST = {
    no_booking:  function(){ return ['ยังไม่มี booking', '#F1EFE8', '#8a8a82']; },
    ready:       function(){ return ['ออกได้', '#DCF4E8', '#0F6E56']; },
    missing:     function(s){ return ['ขาด ' + num(s.missing) + ' คน', '#FBF0DD', '#8A5B00']; },
    not_arrived: function(){ return ['ยังไม่ถึงท่า', '#F1EFE8', '#8a8a82']; }
  };
  wrap('pckProgStatus', function(orig, a){
    var A = a[0]; if(!A || !A.f) return undefined;
    var p = PS(), date = pckDate(); if(!p || !date) return undefined;
    var ans = p.pierDay(date, pckPier()); if(!ans || !Array.isArray(ans.programmes)) return undefined;
    var pg = ans.programmes.filter(function(x){ return x.family_id === A.f.id; })[0];
    if(!pg) return undefined;
    var fn = ST[pg.status && pg.status.code]; return fn ? fn(pg.status) : undefined;
  });

  /* ── §opsCxlTrip (2026-10-29) · a trip closed from the Cancellations tab (lk-inbox §pckCxlTrip) ──
     The server leaves its bookings out of rows, totals and programmes, and lists the day's closed trips (cancelled_trips[] {route_id, reason})
     and the grey chip's count (cancelled_trip {bookings, pax, pending}). ckTripWx / ckTripWxLbl answer from that list, so the sheet's own
     loop and ckRoutePills drop the same trips; an answer without the list (an older server) leaves legacy's SB_WEATHER_CLOSURES test in charge. */
  function cxlList(date){ var ans = dayAns(date); return ans && Array.isArray(ans.cancelled_trips) ? ans.cancelled_trips : null; }
  function cxlOf(list, rid){ for(var i = 0; i < list.length; i++) if(list[i] && list[i].route_id === rid) return list[i]; return null; }
  wrap('ckTripWx', function(orig, a){
    var rid = a[0], list = cxlList(a[1]); if(!list) return undefined;
    return !!rid && !!cxlOf(list, rid);
  });
  wrap('ckTripWxLbl', function(orig, a){
    var list = cxlList(a[1]); if(!list) return undefined;
    var c = cxlOf(list, a[0]); if(!c) return undefined;
    var R = (typeof TCX_R !== 'undefined' && TCX_R[c.reason]) || {};
    return 'ยกเลิก' + (R.th ? (' · ' + R.th) : '');
  });
  /* the chip: { bookings, pax, pending } of the pier on screen (the whole day without one), or null */
  window.laOpsPierCxlTrip = function(date, pier){
    if(!enabled() || isLand()) return null;
    var p = PS(); if(!p || !date) return null;
    var ans = p.pierDay(date, pier || null), c = ans && ans.cancelled_trip;
    if(!c || typeof c !== 'object') return null;
    return { bookings: num(c.bookings), pax: num(c.pax), pending: num(c.pending) };
  };

  O.pierDay = { rowOf: rowOfSheetRow, rowsOf: rowsOf };
})();
