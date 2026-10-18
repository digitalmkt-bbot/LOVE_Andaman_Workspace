/* ═════════════════════════════════════════════════════════════════
   §opsBookingW6 (w6-d, 2026-10-18) · booking form and lists: upgrade targets, charter displacement, private-van zone, lock badge,
   No-Transfer area, hotel names, fee add-ons, add-on links

   The backend built the fields the w5-d / w5-e walks asked for (README "Fields the new frontend asked for"):

     GET  /v1/bookings/{id}/upgrade-targets?trip_id=&date=   bookingV2UpgTargets   the routes the Upgrade dialog lists, with free seats
     POST /v1/quote  warnings[] charter_displaces_seats      bookingV2SetTripCharterBoat   the figures of the charter confirmation
     POST /v1/quote  trips[].zone                            bookingV2ToggleAddOn  the zone a private-van seat is priced in (NoTransfer)
     GET  /v1/bookings/calendar  days[].locked_exact         bookingV2DayLockedExact   the lock badge of a calendar cell
     GET  /v1/pickup-areas/no-transfer?route_id=             bookingV2SetPickupZone    the No-Transfer area of the route's pier
     GET  /v1/hotel-names?zone=&area_id=&near=               bookingV2HotelNameList, bookingV2HotelNear, bookingV2CanonicalHotel
     every booking read  add_ons[].fee                       bookingV2IsB2CFeeAddOn   (kept by 40-ops-bookings.js)
     booking read  addon_of / addon_lines[]                  bkB2CAddonTo, bkB2CAddonsOf   (kept by 40-ops-bookings.js)

   Each function answers from what the server last said and returns `undefined` (legacy's own rule answers) before the first answer, while a
   write has made the answer stale (laOps.srv keeps the old one on screen until the new one lands), offline, and for what the server was never
   asked (a draft the server does not hold). Nothing computed is sent: the form's choices (boat, zone, typed hotel name, route) only.

   Load order: after 51-ops-quote.js, 28-ops-hotel-names.js, 73-ops-bk-calendar.js, 84-ops-booking-calc.js. Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.srv) return;

  function on(){ return !!(O.enabled && O.enabled()); }
  function g(name){ try{ return window[name]; }catch(_){ return undefined; } }
  function num(v){ return +v || 0; }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function tidy(s){ return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function list(){ return typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS) ? SB_BOOKINGS : []; }
  function draft(){ return (window._bkV2 && window._bkV2.newBooking) || null; }
  function typing(){ var a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); }
  function redrawForm(d){
    try{
      if(draft() !== d || typing()) return;
      if(typeof window.bookingV2Render === 'function') window.bookingV2Render();
    }catch(_){}
  }
  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsBookingW6) return;
    var w = function(){
      if(!on()) return orig.apply(this, arguments);
      var r;
      try{ r = fn.call(this, orig, arguments); }catch(e){ if(window.console) console.warn('[ops] booking w6 · ' + name + ' · ' + (e && e.message)); r = undefined; }
      return r === undefined ? orig.apply(this, arguments) : r;
    };
    w.__opsBookingW6 = true; w.__orig = orig; window[name] = w;
  }

  /* ── 1 · Upgrade dialog: the routes a booking can move to ── */
  function upgRedraw(){
    if(!on() || (O.busy && O.busy())) return;
    try{ if(document.getElementById('bkv2-upg-ov') && typeof g('_bkUpg') !== 'undefined' && window._bkUpg && typeof window.bookingV2UpgModal === 'function') window.bookingV2UpgModal(); }catch(_){}
  }
  wrap('bookingV2UpgTargets', function(orig, a){
    var date = a[0], fromRid = a[1], bkId = a[2];
    var b = list().filter(function(x){ return x && (x.id === bkId || x.opsId === bkId); })[0];
    if(!b || !b.opsId || !date) return undefined;
    var t = typeof g('bkUpgTripOn') === 'function' ? window.bkUpgTripOn(b, date, fromRid) : null;
    if(!t || !t.opsTripId) return undefined;
    var j = O.srv.read('upg|' + b.opsId + '|' + t.opsTripId + '|' + date, '/v1/bookings/' + enc(b.opsId) + '/upgrade-targets', { trip_id: t.opsTripId, date: date }, upgRedraw);
    if(!j || !Array.isArray(j.targets)) return undefined;
    var out = j.targets.map(function(x){ return { rid: x.route_id, name: x.route_name, pier: x.pier, free: x.free_seats == null ? null : num(x.free_seats) }; });
    if(typeof g('laRouteOrdCmp') === 'function') out.sort(function(p, q){ return window.laRouteOrdCmp(p.rid, q.rid); });
    return out;
  });

  /* ── 2 · charter confirmation: the displacement figures are the server's ── */
  function quoteFor(d, idx, boatId){
    var Q = window.laOpsQuote; if(!Q || !Q.buildRequest || !d || !Array.isArray(d.trips)) return null;
    var clone = Object.assign({}, d, { trips: d.trips.map(function(t, i){ return i === idx ? Object.assign({}, t, { charterBoatId: boatId }) : t; }) });
    var editing = null;
    try{ if(window._bkV2 && _bkV2.editingId) editing = list().filter(function(b){ return b && b.id === _bkV2.editingId; })[0] || { opsId: null }; }catch(_){}
    var req = Q.buildRequest(clone, { editing: editing, soldRoute: function(t){
      try{ if(typeof g('bkUpgActive') === 'function' && window.bkUpgActive(t) && t.upg && t.upg.fromRouteId) return t.upg.fromRouteId; }catch(_){}
      return t.routeId;
    } });
    return req && req.map.indexOf(idx) >= 0 ? req : null;
  }
  wrap('bookingV2SetTripCharterBoat', function(orig, a){
    var idx = a[0], boatId = a[1];
    var r = orig.apply(this, a);
    var c; try{ c = typeof _bkV2CharterConfirm !== 'undefined' ? _bkV2CharterConfirm : null; }catch(_){ c = null; }
    var d = draft();
    if(!c || !d || c.tripIdx !== idx || c.boatId !== boatId || !d.trips[idx] || d.trips[idx].bookingMode !== 'charter') return r === undefined ? null : r;
    var req = quoteFor(d, idx, boatId); if(!req) return r === undefined ? null : r;
    var ri = req.map.indexOf(idx);
    O.post('/v1/quote', req.body).then(function(q){
      var cur; try{ cur = typeof _bkV2CharterConfirm !== 'undefined' ? _bkV2CharterConfirm : null; }catch(_){ cur = null; }
      if(cur !== c) return;                                           // the dialog was closed or moved on
      var w = ((q && q.warnings) || []).filter(function(x){ return x && x.code === 'charter_displaces_seats' && x.trip === ri; })[0];
      if(w){
        c.seatsConsumed = num(w.seats_sold); c.availAfter = num(w.available_after); c.oversold = num(w.oversold_by);
        if(c.availAfter > 0) c.currentAvailable = c.availAfter + num(c.boatCapacity);
      } else {
        /* the server finds no sold seat stranded: the dialog says so, whatever the browser counted */
        c.oversold = 0;
        if(c.availAfter < c.seatsConsumed) c.availAfter = c.seatsConsumed;
      }
      if(typeof window.bookingV2Render === 'function' && draft() === d) window.bookingV2Render();      // legacy redraws on the pick itself, so the dialog's own redraw does not wait for the focus to leave
    }, function(){});
    return r === undefined ? null : r;
  });

  /* ── 3 · a private van: the seat is priced in the zone the server says ── */
  wrap('bookingV2ToggleAddOn', function(orig, a){
    var type = String(a[0] || ''), d = draft();
    if(!d || type.indexOf('transfer-') !== 0) return undefined;
    var zones = (d.trips || []).map(function(t){ return t ? t.zone : undefined; });
    var r = orig.apply(this, a);
    /* legacy wrote NoTransfer into the trips itself: the browser no longer decides it. The zone shown is the one it had; the quote's answer
       (trips[].zone) puts the server's zone in, and the form is drawn once more. */
    (d.trips || []).forEach(function(t, i){ if(t && i < zones.length && t.zone !== zones[i]) t.zone = zones[i]; });
    applyQuotedZones(d);                                  // an answer already held for this draft (a toggle back to an earlier state) puts the zone in at once
    return r === undefined ? null : r;
  });
  function applyQuotedZones(d){
    var Q = window.laOpsQuote, cur = Q && Q.answered && Q.answered(), changed = false;
    if(!cur || !d || !cur.quote || !Array.isArray(cur.quote.trips) || !cur.req || !cur.req.map) return false;
    cur.req.map.forEach(function(di, ri){
      var t = d.trips[di], s = cur.quote.trips[ri];
      if(!t || !s || !s.zone || t.bookingMode === 'charter' || t.ovnLeg) return;
      if(t.zone !== s.zone){ t.zone = s.zone; changed = true; }
    });
    return changed;
  }
  if(window.laOpsQuote && typeof window.laOpsQuote.onAnswer === 'function'){
    window.laOpsQuote.onAnswer(function(key, req, q){
      try{
        var d = draft(); if(!d || !on() || !q || !Array.isArray(q.trips) || !req || !req.map) return;
        var cur = window.laOpsQuote.answered && window.laOpsQuote.answered(); if(!cur || cur.key !== key) return;
        if(applyQuotedZones(d)) redrawForm(d);
      }catch(_){}
    });
  }

  /* ── 4 · calendar: the lock badge of a day ── */
  wrap('bookingV2DayLockedExact', function(orig, a){
    var date = String(a[0] || ''); if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
    var kind = window._bkV2CityTourOnly ? 'land' : 'marine';
    var j = O.srv.read('cal|' + date.slice(0, 7) + '|' + kind, '/v1/bookings/calendar', { month: date.slice(0, 7), kind: kind }, function(){
      if(O.activeView() === 'booking' && !O.busy() && typeof window.bookingV2RenderKeep === 'function') window.bookingV2RenderKeep();
    });
    if(!j || !Array.isArray(j.days)) return undefined;
    var d = j.days.filter(function(x){ return x && x.date === date; })[0];
    if(!d || d.locked_exact == null) return undefined;
    return num(d.locked_exact);
  });

  /* ── 5 · the zone switch: No-Transfer picks the route's pier area ── */
  var nt = Object.create(null);          // route id -> { area } | 'loading'
  wrap('bookingV2SetPickupZone', function(orig, a){
    var zone = a[0], r = orig.apply(this, a);
    if(zone !== 'NoTransfer') return r === undefined ? null : r;
    var d = draft(), first = d && d.trips && d.trips[0], rid = first && first.routeId; if(!rid) return r === undefined ? null : r;
    var apply = function(area){
      if(!area || !area.id || draft() !== d || d.pickupZoneFilter !== 'NoTransfer' || d.pickupAreaId === area.id) return;
      d.pickupAreaId = area.id; redrawForm(d);
    };
    var hit = nt[rid];
    if(hit && hit !== 'loading') apply(hit.area);
    else if(!hit){
      nt[rid] = 'loading';
      O.get('/v1/pickup-areas/no-transfer', { route_id: rid }).then(function(res){ nt[rid] = { area: res && res.area }; apply(res && res.area); }, function(){ delete nt[rid]; });
    }
    return r === undefined ? null : r;
  });
  O.onWrite(function(kind){ if(String(kind || '') === 'pickup') nt = Object.create(null); });

  /* ── 6 · fee add-ons of a Love Kingdom order ── */
  wrap('bookingV2IsB2CFeeAddOn', function(orig, a){
    var x = a[0];
    return x && typeof x.fee === 'boolean' ? x.fee : undefined;
  });

  /* ── 7 · add-on-only Love Kingdom lines and the agent booking they belong to (single booking read) ── */
  function localOf(id){ return list().filter(function(b){ return b && (b.opsId === id || b.id === id); })[0] || null; }
  wrap('bkB2CAddonTo', function(orig, a){
    var b = a[0]; if(!b || !b.addonOfRead) return undefined;
    if(!b.addonOf) return null;
    var bk = localOf(b.addonOf), t = (b.trips || [])[0] || {};
    if(!bk) return undefined;
    return { bk: bk, vc: bk.voucherRef || '', date: t.date, routeId: t.routeId };
  });
  wrap('bkB2CAddonsOf', function(orig, a){
    var bkId = a[0], date = a[1], bk = localOf(bkId);
    if(!bk || !Array.isArray(bk.addonLines)) return undefined;
    var out = [];
    for(var i = 0; i < bk.addonLines.length; i++){
      var w = localOf(bk.addonLines[i].booking_id);
      if(!w) return undefined;                                         // a line this browser does not hold: legacy's list answers whole
      if(date && !(w.trips || []).some(function(t){ return t && t.date === date; })) continue;
      out.push(w);
    }
    return out;
  });

  /* ── 8 · hotel names: the zone / area tiers, the near match and the canonical spelling ── */
  function ddRedraw(){
    if(!on()) return;
    var inp = document.getElementById('bkv2-hotel-input');
    if(inp && document.activeElement === inp && typeof window.bookingV2HotelDDRender === 'function') window.bookingV2HotelDDRender(inp.value);
  }
  wrap('bookingV2HotelNameList', function(orig, a){
    var zone = a[0], area = a[1];
    if(!zone && !area) return undefined;                               // the unfiltered list is 28-ops-hotel-names.js's
    var key = 'hn|' + (zone || '') + '|' + (area || '');
    var j = O.srv.read(key, '/v1/hotel-names', area ? { area_id: area } : { zone: zone }, ddRedraw);
    if(!j || !Array.isArray(j.names)) return undefined;
    return j.names.map(function(n){ return n && n.name; }).filter(Boolean).sort(function(x, y){ return x.localeCompare(y); });
  });
  var canon = Object.create(null);
  function nearRead(name, minScore, areaId, zone){
    var z = (zone && zone !== 'NoTransfer' && zone !== 'NT') ? zone : '';
    var key = 'hnear|' + tidy(name).toLowerCase() + '|' + (areaId || '') + '|' + z + '|' + (minScore == null ? '' : minScore);
    var q = { near: tidy(name) };
    if(areaId) q.area_id = areaId; else if(z) q.zone = z;
    if(minScore != null) q.min_score = minScore;
    var j = O.srv.read(key, '/v1/hotel-names', q, ddRedraw);
    if(j && typeof j.canonical === 'string') canon[tidy(name).toLowerCase()] = j.canonical;
    return j;
  }
  wrap('bookingV2HotelNear', function(orig, a){
    var s = tidy(a[0]); if(!s) return undefined;
    var j = nearRead(s, a[1], a[2], a[3]);
    if(!j || !('near_match' in j)) return undefined;
    return j.near_match ? { name: j.near_match.name, score: j.near_match.score } : null;
  });
  wrap('bookingV2CanonicalHotel', function(orig, a){
    var s = tidy(a[0]); if(!s) return undefined;
    var j = O.srv.read('hnear|' + s.toLowerCase() + '||||', '/v1/hotel-names', { near: s }, function(){});
    if(j && typeof j.canonical === 'string') canon[s.toLowerCase()] = j.canonical;
    var c = canon[s.toLowerCase()];
    return typeof c === 'string' ? c : undefined;
  });

  O.bookingW6 = { quoteFor: quoteFor };
})();
