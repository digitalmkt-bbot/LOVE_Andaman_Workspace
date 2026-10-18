/* ══════════════════════════════════════════════════════════════════════════
   §opsRepOpsSrv (w4-f1, 2026-10-18) · Operations Report (rep-ops) ⇄ GET /v1/reports/operations?from=&to=
   ──────────────────────────────────────────────────────────────────────────
   Server: operation-backend todo/b2-reports-model.md. Legacy repOpsGather walked every booking of the period AND of the
   period before it (repPrevRange, the same length straight before) and worked the figures out in the browser; 56-ops-rep-pickupmap.js
   therefore loaded both periods' bookings first. The server answers both periods at once, in the shape below.

     repOpsGather(from,to)   the figures object the slides read, built from current / previous of the answer: heads carried and booked,
                             bookings, sales value, sailings, seats offered, fill, thai / foreign, b2b / b2c, cancelled, weather,
                             never-showed, named bookings, per day / route / boat / pier / agent / nationality
     _repOpsHeadline         the server's headline sentence
     repOpsSlides            unchanged: it calls repOpsGather for both periods. The "Sales and invoicing" slide reads
                             SB_INVOICES, so for the time of the call the list holds rows that carry the server's invoices
                             {raised, raised_total, unpaid, unpaid_total} (restored right after).
     renderReport('ops')     asks for the answer, redraws when it lands, and keeps 56's booking loads from starting
   The slide texts, cards and charts are legacy's. repDelta (the ▲▼ chips) is arithmetic on two figures of the answer, kept.
   Until the first answer (and if it fails) legacy's own gather runs. Classic script, after 56-ops-rep-pickupmap.js.
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
    if(O.activeView() === 'rep-ops' && !O.busy() && typeof window.renderReport === 'function') window.renderReport('ops');
  }
  function key(st){ return 'ops|' + st.from + '|' + st.to; }
  function stOps(){ return (typeof window.repSt === 'function') ? window.repSt('ops') : null; }
  function answer(){
    var st = stOps(); if(!st || !st.from || !st.to) return null;
    return O.srv.peek(key(st));
  }
  /* an object with k keys: the slides count Object.keys(...) of the legacy sets (days, sailings, boats) */
  function sized(k){ var o = {}; for(var i = 0; i < k; i++) o['k' + i] = 1; return o; }

  function gatherOf(p, headline){
    var O_ = { pax: n(p.heads.carried), paxBooked: n(p.heads.booked), bookings: n(p.bookings), revenue: n(p.revenue), tripRuns: n(p.sailings),
      byDate: {}, byRoute: {}, byBoat: {}, byPier: {}, byAgent: {}, byNat: {}, natTH: n(p.thai.pax), natFR: n(p.foreign.pax), lost: n(p.heads.never_showed),
      wxBk: n(p.weather.bookings), wxPax: n(p.weather.pax), cxlBk: n(p.cancelled.bookings), cxlPax: n(p.cancelled.pax),
      b2b: { bk: n(p.b2b.bookings), pax: n(p.b2b.pax), rev: n(p.b2b.revenue) }, b2c: { bk: n(p.b2c.bookings), pax: n(p.b2c.pax), rev: n(p.b2c.revenue) },
      namedBk: n(p.named_bookings), cap: n(p.seats_offered), capDays: n(p.operating_days), boatDays: {}, fill: n(p.fill_pct) };
    p.by_day.forEach(function(d){ if(d.pax || d.booked || d.boats) O_.byDate[d.date] = { pax: n(d.pax), booked: n(d.booked), boats: sized(n(d.boats)) }; });
    p.by_route.forEach(function(r){ O_.byRoute[r.route_id] = { pax: n(r.pax), booked: n(r.booked), bk: n(r.bookings), rev: n(r.revenue), cap: n(r.capacity), days: sized(n(r.days_ran)), runs: sized(n(r.sailings)), bo: sized(n(r.boats)) }; });
    p.by_boat.forEach(function(b){ O_.byBoat[b.boat_id] = { pax: n(b.pax), days: sized(n(b.days)), bk: 0 }; });
    p.by_pier.forEach(function(x){ O_.byPier[x.pier] = { pax: n(x.pax), bk: n(x.bookings), boats: sized(n(x.sailings)) }; });
    p.by_agent.forEach(function(a){ O_.byAgent[a.agent_id] = { pax: n(a.pax), bk: n(a.bookings), rev: n(a.revenue) }; });
    p.by_nationality.forEach(function(x){ O_.byNat[x.code] = n(x.pax); });
    O_.__srv = true; if(headline) O_.__headline = headline;
    return O_;
  }
  wrap('repOpsGather', function(orig, from, to){
    var j = answer(), args = [].slice.call(arguments, 1);
    if(!j) return orig.apply(this, args);
    if(from === j.current.window.from && to === j.current.window.to) return gatherOf(j.current, j.headline);
    if(from === j.previous.window.from && to === j.previous.window.to) return gatherOf(j.previous);
    return orig.apply(this, args);
  });
  wrap('_repOpsHeadline', function(orig, D){
    if(!D || !D.__headline) return orig.apply(this, [].slice.call(arguments, 1));
    var esc = function(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    return esc(D.__headline).replace(/(\d[\d,]* \(\d+%\))/, '<b>$1</b>').replace(/((?:dropped|improved|weakened) \d+%)/, '<b>$1</b>');
  });

  /* the finance slide reads SB_INVOICES: give it rows that add up to the server's invoices for the time of the call */
  function synthInvoices(st, inv){
    var rows = [], paidN = Math.max(0, n(inv.raised) - n(inv.unpaid)), paidTotal = Math.max(0, n(inv.raised_total) - n(inv.unpaid_total));
    for(var i = 0; i < n(inv.unpaid); i++) rows.push({ issuedAt: st.from, total: i === 0 ? n(inv.unpaid_total) : 0, status: 'issued' });
    for(var k = 0; k < paidN; k++) rows.push({ issuedAt: st.from, total: k === 0 ? paidTotal : 0, status: 'paid' });
    return rows;
  }
  wrap('repOpsSlides', function(orig, st){
    var j = answer(), args = [].slice.call(arguments, 1);
    if(!j || typeof SB_INVOICES === 'undefined' || !Array.isArray(SB_INVOICES) || st.from !== j.current.window.from || st.to !== j.current.window.to) return orig.apply(this, args);
    var saved = SB_INVOICES.slice();
    SB_INVOICES.splice.apply(SB_INVOICES, [0, SB_INVOICES.length].concat(synthInvoices(st, j.current.invoices)));
    try{ return orig.apply(this, args); }
    finally { SB_INVOICES.splice.apply(SB_INVOICES, [0, SB_INVOICES.length].concat(saved)); }
  });

  wrap('renderReport', function(orig, kind){
    var args = [].slice.call(arguments, 1);
    if(kind !== 'ops') return orig.apply(this, args);
    var st = stOps();
    if(!st || !st.from || !st.to) return orig.apply(this, args);
    var k = key(st), j = O.srv.read(k, '/v1/reports/operations', { from: st.from, to: st.to }, repaint);
    if(O.srv.status(k) === 'failed') return orig.apply(this, args);       // legacy's own way, with 56's booking loads
    /* the answer is here or on its way: nothing to load in the browser */
    var ens = window.bookingV2EnsureOpsRange, av = O.availability && O.availability.ensure;
    window.bookingV2EnsureOpsRange = function(){ return null; };
    if(O.availability) O.availability.ensure = function(){ return null; };
    var r;
    try{ r = orig.apply(this, args); }
    finally { window.bookingV2EnsureOpsRange = ens; if(O.availability) O.availability.ensure = av; }
    try{
      var host = document.getElementById('rep-host-ops'), el = document.getElementById('rep-ops-srv');
      if(!j && host && !el){
        el = document.createElement('div'); el.id = 'rep-ops-srv';
        el.style.cssText = 'margin:0 0 10px;padding:8px 14px;border-radius:10px;background:#EDF4FB;color:#1B5E96;font-size:11.5px;font-weight:600';
        el.textContent = 'Loading the report from operation-backend...';
        host.insertBefore(el, host.firstChild);
      } else if(j && el){ el.remove(); }
    }catch(_){}
    return r;
  });
})();
