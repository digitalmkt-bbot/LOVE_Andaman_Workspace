/* ══════════════════════════════════════════════════════════════════════════
   §opsPrepSrv (w4-f1, 2026-10-18) · PR/PO Dashboard (kitchen prep sheet) ⇄ GET /v1/reports/prep?from=&to=
   ──────────────────────────────────────────────────────────────────────────
   Server: operation-backend todo/b2-reports-model.md. Legacy ppRows read every booking of the range and worked out, per trip,
   the heads, the eating heads, the vegetarian / vegan / halal meals and the allergy lines (ppAllPax: does the free text say it
   covers the whole booking?), then renderPrPo grouped them and ppPierCapTag / ppCapTag set boat seats against bookings.
   41-ops-prpo.js loaded the range's bookings first. The server answers per pier → programme (or restaurant) → boat-day, with
   each booking's row, the seats of the day's boats and whether they are exceeded.

     ppRows          one row per booking per boat-day, from the answer's booking_rows (heads, eat, meals, allergy lines
                     {name, qty, whole_booking, unknown_count}); renderPrPo groups and draws them as before
     ppAllPax        not called in operation mode (the server's allergy lines already say whole booking / unknown count)
     ppCapOf, ppCapTag   the boat's seats for the day  ← cells[].capacity / license_pax
     ppPierCapTag    the pier's seats against its bookings ← piers[].capacity {seats, boat_days, over, unassigned_pax, boats_without_capacity}
                     (only while no route / special-meal filter is on: the server's pier figure is the whole pier's)
     renderPrPo      asks for the answer, shows the loading line until it lands, and keeps 41's booking load from starting
   Differences from legacy (a trip split over boats gives each boat its own row; no guessing) are the server's: docs/walk/w4-f1.md.
   Until the first answer arrives the sheet shows "Loading"; if the read fails (more than 93 days, offline) legacy's own way runs.
   Classic script, after 41-ops-prpo.js and 73-ops-srv-reads.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.srv) return;
  function on(){ return !!(O.enabled && O.enabled()); }
  function n(v){ return Number.isFinite(+v) ? +v : 0; }
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__w4f1) return;
    var w = function(){
      var args = [].slice.call(arguments);
      if(!on()) return orig.apply(this, args);
      return fn.apply(this, [orig].concat(args));
    };
    w.__w4f1 = true; w.__orig = orig; window[name] = w;
  }
  function repaint(){
    if(O.activeView() === 'prpo' && !O.busy() && typeof window.renderPrPo === 'function') window.renderPrPo();
  }
  function keyNow(){ return 'prep|' + window._ppFrom + '|' + window._ppTo; }
  function prep(){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(window._ppFrom || '') || !/^\d{4}-\d{2}-\d{2}$/.test(window._ppTo || '')) return null;
    var j = O.srv.read(keyNow(), '/v1/reports/prep', { from: window._ppFrom, to: window._ppTo }, repaint);
    if(j && !j.__idx) index(j);
    return j;
  }
  function index(j){
    var cap = {}, venue = {};
    (j.piers || []).forEach(function(p){
      (p.programmes || []).forEach(function(g){ (g.cells || []).forEach(function(c){ if(c.boat_id && c.capacity) cap[c.date + '|' + c.boat_id] = { cap: n(c.capacity), lic: n(c.license_pax) }; }); });
      (p.restaurants || []).forEach(function(r){ (r.cells || []).forEach(function(c){ venue[c.date + '|' + (c.boat_id || '') + '|' + c.route_id] = { id: r.venue_id || '-', name: r.name || '' }; }); });
    });
    var pier = {}; (j.piers || []).forEach(function(p){ pier[p.pier] = p; });
    j.__idx = { cap: cap, venue: venue, pier: pier };
  }

  wrap('ppRows', function(orig){
    var j = prep(); if(!j) return orig.apply(this, [].slice.call(arguments, 1));
    var out = [];
    (j.piers || []).forEach(function(p){
      (p.programmes || []).forEach(function(g){
        var rid = g.route_id || '', rt = (typeof getRoute === 'function') ? getRoute(rid) : null;
        (g.cells || []).forEach(function(c){
          var v = j.__idx.venue[c.date + '|' + (c.boat_id || '') + '|' + rid] || { id: '-', name: '' };
          (c.booking_rows || []).forEach(function(r){
            var lines = (r.allergy_lines || []).map(function(l){ return { name: l.name, qty: n(l.qty), ft: !!l.unknown_count, all: !!l.whole_booking }; });
            var known = lines.filter(function(l){ return !l.ft; }).reduce(function(s, l){ return s + l.qty; }, 0), unk = lines.filter(function(l){ return l.ft; }).length;
            out.push({ b: { id: r.booking_id, leadPax: r.lead_pax || '', voucherRef: r.reference, channel: r.agent || '' }, t: { routeId: rid, date: c.date }, date: c.date,
              routeId: rid, rt: rt, boatId: c.boat_id || '', mvId: v.id, mvName: v.name,
              ad: n(r.ad), chd: n(r.chd), inf: n(r.inf), foc: n(r.foc), tot: n(r.total), eat: n(r.eat),
              veg: n(r.vegetarian), vegan: n(r.vegan), halal: n(r.halal), allergy: known, alUnk: unk, alList: lines,
              ovn: !!c.overnight, chtr: !!c.charter, sp: !!r.special });
          });
        });
      });
    });
    return out;
  });

  wrap('ppCapOf', function(orig, bid, date){
    var j = prep(), c = j && j.__idx.cap[date + '|' + bid];
    return c ? c.cap : orig.apply(this, [].slice.call(arguments, 1));
  });
  wrap('ppCapTag', function(orig, bid, date, tot){
    var j = prep(), c = j && j.__idx.cap[date + '|' + bid];
    if(!c) return orig.apply(this, [].slice.call(arguments, 1));
    var tip = 'จอง ' + tot + ' / cap ' + c.cap + (c.lic && c.lic !== c.cap ? (' · จดทะเบียน ' + c.lic + ' ที่นั่ง') : '');
    return '<span class="pp-cap' + (tot > c.cap ? ' over' : '') + '" title="' + window.ckEsc(tip) + '">/' + c.cap + '</span>';
  });
  wrap('ppPierCapTag', function(orig, PB){
    var j = prep(), p = j && j.__idx.pier[PB.pier];
    if(!p || window._ppRoute || window._ppOnlySp) return orig.apply(this, [].slice.call(arguments, 1));
    var c = p.capacity; if(!c) return '';
    var tip = 'จองทั้งท่า ' + n(p.total) + ' / ที่นั่งรวม ' + c.seats + ' (' + c.boat_days + ' เที่ยวเรือ)'
      + (c.unassigned_pax ? (' · ยังไม่จัดเรือ ' + c.unassigned_pax + ' คน') : '')
      + (c.boats_without_capacity ? (' · ไม่มี cap ' + c.boats_without_capacity + ' ลำ') : '');
    return '<span class="pp-cap' + (c.over ? ' over' : '') + '" title="' + window.ckEsc(tip) + '">/' + c.seats + '</span>';
  });

  wrap('renderPrPo', function(orig){
    var args = [].slice.call(arguments, 1), host = document.getElementById('prpo-host');
    var j = prep(), st = O.srv.status(keyNow());
    if(!j){
      if(st === 'failed') return orig.apply(this, args);                  // legacy's way, with 41's booking load
      if(host && !host.firstChild) host.innerHTML = O.loadingHtml('Loading PR/PO…');
      return;
    }
    var ens = window.bookingV2EnsureOpsRange;
    window.bookingV2EnsureOpsRange = function(){ return null; };          // 41 loads the range's bookings: not needed
    try{ return orig.apply(this, args); } finally { window.bookingV2EnsureOpsRange = ens; }
  });
})();
