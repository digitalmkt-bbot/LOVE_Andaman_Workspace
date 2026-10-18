/* ═════════════════════════════════════════════════════════════════
   §opsAboardCalls (w4-f2, 2026-10-18) · ckEventTally and ckPaxBreak read the trip's aboard block

   71-ops-aboard.js moved the check-in figures to trips[].aboard but left these two, because they take a bare
   record / a bare pax map and not "the booking and the day". The developer asked for them to leave the browser
   rule too. Passing the booking and day at ~30 call sites would be an edit of 08-app.js (the legacy file that
   lk-inbox syncs into), so the trip is found from the object instead:

     ckPaxBreak(p [, b, date])      p is a trip's own pax map (the object 40-ops-bookings built for the trip):
                                    answers aboard.booked {ad chd inf foc} (fr + th summed, by the server).
     ckEventTally(ck [, b, date, kind])
                                    ck is the trip's main van / pier record (the object the server's answer built):
                                    answers aboard.tally[van|pier] {no_show cxl total} (live events, by the server).

   Both also take the booking and day explicitly, when a call site has them. Where the trip cannot be found, where the
   pax map was edited in the browser after the server last read it (unsaved heads), where the trip moved to another
   day, for a split slot's record and in non-ops mode, the legacy rule runs untouched (so the screen is right
   before the first answer and while offline).

   O.aboardTag(trip [, ops])  is called by 40-ops-bookings.js (tripFrom, records) and 36-ops-day-actions.js
   (mergeTripOperations) whenever a trip receives its block.
   Load order: after 71-ops-aboard.js, 40-ops-bookings.js, 36-ops-day-actions.js. Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var paxTags = (typeof WeakMap === 'function') ? new WeakMap() : null;     // pax map -> { trip, snap }
  function num(v){ return +v || 0; }

  /* remember which trip a pax map and a check-in record belong to (hidden: never copied, never sent) */
  O.aboardTag = function(trip, ops){
    if(!trip) return;
    if(paxTags && trip.pax && typeof trip.pax === 'object') paxTags.set(trip.pax, { trip: trip, snap: JSON.stringify(trip.pax) });
    var o = ops || trip.ops || null;
    if(!o) return;
    [['van', o.vanCheckin], ['pier', o.pierCheckin]].forEach(function(p){
      var rec = p[1]; if(!rec || typeof rec !== 'object') return;
      try{
        Object.defineProperty(rec, '_aboardTrip', { value: trip, configurable: true, writable: true });
        Object.defineProperty(rec, '_aboardKind', { value: p[0], configurable: true, writable: true });
      }catch(_){}
      /* w5-d: the other parts of a split row (rec._s[slot]) know their trip and slot too (read by 83-ops-van-rows.js; not _aboardKind: the tally is per side) */
      try{ Object.defineProperty(rec, '_slotKey', { value: { trip: trip, side: p[0], slot: 0 }, configurable: true, writable: true }); }catch(_){}
      if(rec._s && typeof rec._s === 'object') Object.keys(rec._s).forEach(function(i){
        var sub = rec._s[i]; if(!sub || typeof sub !== 'object') return;
        try{ Object.defineProperty(sub, '_slotKey', { value: { trip: trip, side: p[0], slot: +i }, configurable: true, writable: true }); }catch(_){}
      });
    });
  };

  function blockOfTrip(t){
    if(!t || !t.aboard || typeof t.aboard !== 'object') return null;
    if(t.aboardDate && t.aboardDate !== (t.date || '')) return null;              // the trip moved since it was read
    return t.aboard;
  }
  function tripOn(b, date){ return (b && date && typeof window.ckTripOn === 'function') ? window.ckTripOn(b, date) : null; }

  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsAboardCalls) return;
    var w = function(){
      if(!O.enabled || !O.enabled()) return orig.apply(this, arguments);
      var r = fn.call(this, orig, arguments);
      return r === undefined ? orig.apply(this, arguments) : r;
    };
    w.__opsAboardCalls = true; window[name] = w;
  }

  /* ckPaxBreak(p) -> {ad chd inf foc} */
  wrap('ckPaxBreak', function(orig, a){
    var p = a[0], trip = null, snap = null;
    var tag = (p && typeof p === 'object' && paxTags) ? paxTags.get(p) : null;
    if(tag){ trip = tag.trip; snap = tag.snap; }
    else if(a[1] && a[2]){ var t = tripOn(a[1], a[2]); if(t && (p === undefined || p === t.pax)){ trip = t; } }
    var ab = blockOfTrip(trip); if(!ab || !ab.booked) return undefined;
    if(snap != null && JSON.stringify(p) !== snap) return undefined;               // the heads were edited here and are not saved yet
    if(trip.pax !== p && !(p === undefined)) return undefined;                       // not the trip's own map any more
    var bk = ab.booked;
    return { ad: num(bk.ad), chd: num(bk.chd), inf: num(bk.inf), foc: num(bk.foc) };
  });

  /* ckEventTally(ck) -> {no_show cxl total} */
  wrap('ckEventTally', function(orig, a){
    var ck = a[0], trip = null, kind = '';
    if(ck && typeof ck === 'object' && ck._aboardTrip){ trip = ck._aboardTrip; kind = ck._aboardKind; }
    else if(a[1] && a[2]){
      var t = tripOn(a[1], a[2]);
      var base = a[3] != null ? String(a[3]) : '';
      if(t && (base === 'van' || base === 'pier')){ trip = t; kind = base; }
    }
    var ab = blockOfTrip(trip); if(!ab || !ab.tally || !ab.tally[kind]) return undefined;
    var t2 = ab.tally[kind];
    return { no_show: num(t2.no_show), cxl: num(t2.cxl), total: num(t2.total) };
  });

  O.aboardCalls = { paxTagged: function(p){ return !!(paxTags && p && paxTags.get(p)); } };
})();
