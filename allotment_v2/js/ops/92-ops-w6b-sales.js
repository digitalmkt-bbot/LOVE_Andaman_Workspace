/* ══════════════════════════════════════════════════════════════════════════
   §opsW6bSales (w6-b, 2026-10-18) · booking-side rules the backend now answers (w5-b MISSING-SERVER-FIELD list, sales part) ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Source: docs/walk/w5-b.md section 4; the server side is operation-backend todo/w5b-model.md and the README section
   "Server fields for the walk's MISSING-SERVER-FIELD list". Nothing here works a figure out: the answer is read, drawn, and kept until the
   next write (then read again, the old one is drawn meanwhile); legacy's own answer is drawn only before the first answer arrives,
   offline, and for a record the server did not describe. Only user choices are sent.

     rtZonesForRoute        ← GET /v1/routes  rate_zones                  (RN + NoTransfer, or PK + KL + NoTransfer; a rate's other zones are kept)
     laInternalRows         ← GET /v1/reports/internal-trips?year=        one row per trip of a company-own booking, money on the first trip
     bookingV2SplitArea     ← operations.van_parts[].area_effective / area_inherited on the booking read
     psuResolveProfile      ← GET /v1/pickup-time-profiles/active?date=   the profile covering the date (narrowest, then newest), else the fallback
     psuHotelGroups         ← GET /v1/hotel-names/groups?min=&cross_area=  groups of similar hotel names, the name to keep, per-name areas
     psuHotelAreaLabel      ← the group item's area_label
     bookingV2LockCoverage  ← GET /v1/seat-locks/{id}/coverage            which holder bookings drew from this lock, another lock, or the pool

   The pickup profile overlap warning (psuSaveProfile) is in 21-ops-pickup.js (409 profile_overlap, confirm, overlap_anyway).
   Classic script, after js/ops/21-ops-pickup.js, 28-ops-hotel-names.js, 30-ops-locks.js and 40-ops-bookings.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function enabled(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function fn(name){ return typeof window[name] === 'function' ? window[name] : null; }
  function viewOn(id){ var v = document.getElementById(id); return !!(v && v.classList.contains('active')); }

  function wrap(name, f){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__w6b) return;
    var w = function(){
      if(!enabled()) return orig.apply(this, arguments);
      return f.apply(this, [orig].concat([].slice.call(arguments)));
    };
    w.__w6b = true; w.__orig = orig; window[name] = w;
  }

  /* ── one read cache: an answer is kept; a write marks it stale (it is read again, the old answer is drawn meanwhile) ── */
  var cache = {}, asked = {};
  function stale(){ Object.keys(cache).forEach(function(k){ cache[k].stale = true; }); asked = {}; }
  O.onWrite(stale);
  if(O.onChange) O.onChange(stale);
  function read(key, path, q, redraw){
    var c = cache[key];
    if((!c || c.stale) && !asked[key]){
      asked[key] = true;
      O.get(path, q).then(function(d){
        var changed = !c || JSON.stringify(c.data) !== JSON.stringify(d);
        cache[key] = { data: d, stale: false }; delete asked[key];
        if(changed && redraw && !O.busy()){ try{ redraw(d); }catch(_){} }
      }, function(e){
        asked[key] = 'failed';       // not asked again until the next write; the screen keeps legacy's answer
        try{ console.warn('[ops] ' + path + ' · ' + (e && e.message)); }catch(_){}
      });
    }
    return c ? c.data : null;
  }

  /* ══ Rate zones of a route ═════════════════════════════════════════════════════════════════════════════════
     The route's zones (`rate_zones`) are the server's; a rate that already holds another zone keeps it (the union is the screen's). */
  wrap('rtZonesForRoute', function(orig, rId, existing){
    var d = read('routes', '/v1/routes', null, null), row = d && (d.routes || []).find(function(r){ return r && r.id === rId; });
    if(!row || !Array.isArray(row.rate_zones)) return orig.apply(this, [].slice.call(arguments, 1));
    var out = row.rate_zones.slice();
    if(existing) Object.keys(existing).forEach(function(z){ if(out.indexOf(z) < 0) out.push(z); });
    return out;
  });

  /* ══ Internal (company-own) bookings report ═════════════════════════════════════════════════════════════════
     One row per trip of a live company-own booking, the money on the booking's first trip of the year only. */
  function bookingOf(id){
    var list = (typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS)) ? SB_BOOKINGS : [];
    return list.find(function(b){ return b && (b.opsId === id || b.id === id); }) || { id: id, voucherRef: '' };
  }
  wrap('laInternalRows', function(orig, year){
    var d = read('internal|' + year, '/v1/reports/internal-trips', { year: year }, function(){
      if(fn('renderStaff') && document.querySelector('.sw-page')) window.renderStaff();
    });
    if(!d || !Array.isArray(d.rows)) return orig.apply(this, [].slice.call(arguments, 1));
    return d.rows.map(function(r){
      return { bk: bookingOf(r.booking_id), t: { date: r.date, routeId: r.route_id }, date: r.date,
        route: fn('getRoute') ? (window.getRoute(r.route_id) || null) : null,
        purpose: r.purpose || '', lbl: r.label || '', unset: !!r.unset, pax: +r.pax || 0, foc: +r.foc || 0, free: !!r.free,
        money: +r.money || 0, moneyHere: !!r.money_here };
    });
  });

  /* ══ Area of a split row ═════════════════════════════════════════════════════════════════════════════════════
     The server's van part says which area a split row is picked up in and whether it only borrows the booking's area
     (area_effective, area_inherited). The part is found by its own pickup (area, hotel, zone) among the booking's kept parts. */
  wrap('bookingV2SplitArea', function(orig, bk, pick, baseArea){
    var hit = null;
    if(bk && pick && !pick.main) (bk.trips || []).forEach(function(t){
      /* a booking's first day keeps its operations on the booking itself, later days on the trip (bkOpsRead) */
      var o = (t && fn('bkOpsRead')) ? (window.bkOpsRead(bk, t.date) || {}) : ((t && t.ops) || {});
      (o.vanParts || []).forEach(function(p){
        var a = p && p.alt;
        if(hit || !p || p.source !== 'alt_pickup' || !a || p.area_effective === undefined) return;
        if((a.pick_area_id || '') === (pick.areaId || '') && (a.pick_hotel || '') === (pick.hotel || '') && (a.pick_zone || '') === (pick.zone || '')) hit = p;
      });
    });
    if(!hit) return orig.apply(this, [].slice.call(arguments, 1));
    var e = hit.area_effective;
    if(!e) return { area: null, name: '', inherited: false };
    return { area: fn('bookingV2GetArea') ? (window.bookingV2GetArea(e.id) || null) : null, name: e.name || '', inherited: !!hit.area_inherited };
  });

  /* ══ Pickup Setup: the profile that applies on a date ═══════════════════════════════════════════════════════
     Narrowest range first, then the newest; with none, the undated fallback profile; else none. */
  function cellText(c){
    if(c && c.pickup_at_pier && c.pickup_time_end) return 'Before ' + c.pickup_time_end + ' at pier';
    if(c && c.pickup_time && c.pickup_time_end) return c.pickup_time + '-' + c.pickup_time_end;
    return (c && c.pickup_time) || '';
  }
  function profileIn(s){
    var p = { id: s.id, name: s.name || '', from: s.from_date || '', to: s.to_date || '', notes: s.notes || '', clonedFrom: s.cloned_from || null, createdAt: s.created_at || '', times: {} };
    (s.times || []).forEach(function(c){ if(c && c.route_id && c.target) (p.times[c.route_id] = p.times[c.route_id] || {})[c.target] = cellText(c); });
    return p;
  }
  wrap('psuResolveProfile', function(orig, dateStr){
    var legacy = orig.apply(this, [].slice.call(arguments, 1));
    var d = read('active|' + (dateStr || ''), '/v1/pickup-time-profiles/active', dateStr ? { date: dateStr } : null, function(a){
      var mine = a && a.profile ? a.profile.id : null;
      if(mine !== (legacy ? legacy.id : null) && viewOn('view-pickup-setup') && typeof _psuProfileDraft !== 'undefined' && !_psuProfileDraft && typeof _psuAreaDraft !== 'undefined' && !_psuAreaDraft && fn('renderPickupSetup')) window.renderPickupSetup();
    });
    if(!d || d.profile === undefined) return legacy;
    return d.profile ? profileIn(d.profile) : null;
  });

  /* ══ Pickup Setup · duplicate hotel names ═══════════════════════════════════════════════════════════════════
     Which names are similar (the strictness and "across areas" choices are sent), the name to keep, and each name's areas. */
  function redrawHotels(){ if(typeof _psuTab !== 'undefined' && _psuTab === 'hotels' && viewOn('view-pickup-setup') && fn('renderPickupSetup')) window.renderPickupSetup(); }
  wrap('psuHotelGroups', function(orig){
    var min = typeof _psuHotelMin !== 'undefined' ? _psuHotelMin : 0.82, x = typeof _psuHotelXArea !== 'undefined' && _psuHotelXArea;
    var d = read('hotels|' + min + '|' + x, '/v1/hotel-names/groups', { min: min, cross_area: x ? 'true' : 'false' }, redrawHotels);
    if(!d || !Array.isArray(d.groups)) return orig.apply(this, [].slice.call(arguments, 1));
    return d.groups.map(function(g){
      return { id: g.id, keep: g.keep, tot: +g.total || 0, items: (g.items || []).map(function(it){
        var areas = {}; (it.areas || []).forEach(function(a){ areas[a.area_id] = +a.count || 0; });
        return { name: it.name, n: +it.count || 0, last: it.last || '', areas: areas, areaLabel: it.area_label };
      }) };
    });
  });
  wrap('psuHotelAreaLabel', function(orig, it){
    return it && typeof it.areaLabel === 'string' ? it.areaLabel : orig.apply(this, [].slice.call(arguments, 1));
  });

  /* ══ Seat Lock manage dialog · bookings of this holder on the trip ═════════════════════════════════════════
     Which holder bookings drew from this lock, from another lock, or from the general pool (heads that drew from no lock). */
  wrap('bookingV2LockCoverage', function(orig, l, date){
    var d0 = date || (l && l.date) || '';
    var sid = (l && d0 && O.locks && O.locks.serverIdFor) ? O.locks.serverIdFor(l.id, d0) : null;
    if(!sid || (fn('bookingV2LockSpansDays') && window.bookingV2LockSpansDays(l))) return orig.apply(this, [].slice.call(arguments, 1));
    var c = read('cov|' + sid, '/v1/seat-locks/' + enc(sid) + '/coverage', null, function(){
      if(typeof _bkV2LockManageId !== 'undefined' && _bkV2LockManageId && fn('bookingV2Render')) window.bookingV2Render();
    });
    if(!c || !Array.isArray(c.rows)) return orig.apply(this, [].slice.call(arguments, 1));
    return { date: c.service_date || d0, bookings: +c.bookings || 0, pax: +c.pax || 0, self: +c.self || 0, other: +c.other || 0, pool: +c.pool || 0,
      rows: c.rows.map(function(r){ return { id: r.booking_id, vc: r.voucher_ref || '', lead: r.lead || '', pax: +r.pax || 0, self: +r.self || 0, other: +r.other || 0, pool: +r.pool || 0 }; }) };
  });
})();
