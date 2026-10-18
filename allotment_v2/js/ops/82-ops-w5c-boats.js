/* ═════════════════════════════════════════════════════════════════════════
   §opsW5cBoats (2026-10-18, wave 5 group c) · boat rules the browser still decided, now the server's answer
   ─────────────────────────────────────────────────────────────────────────
   Backend guides: operation-backend README "Dispatch: boats, final pickup, pier note" (boat_pulled), "Pickup and overnight
   fields" (Repairs on write), "Fleet maintenance: availability" (boat-operation panel), "A boat's seats for one day".
   docs/walk/w5-c.md has the per-function table. Classic script. Loads after 71-ops-boat-operation.js / 77-ops-ovn-hold.js /
   49-ops-capacity-overrides.js, before 90-ops-boot.js. Legacy mode (!O.enabled()): every wrapper delegates.

     bookingV2BoatPulled(bk, date)      the trip's operations.boat_pulled (server-computed; 40-ops-bookings.js already
                                        projects it as ops.boatPulled). A booking not saved to the server yet: legacy's test.
     bookingV2CharterBoatHeal(date)     no-op: the server puts a charter's boat on the trip when it saves (dispatch.ts charterSynced)
     bookingV2HealSelfArrivePickup(date) no-op: the server clears a clock pickup time off a self-arrive trip on every write
     baCharterBoatMap(date)             the chartered boats of the day from the boat-operation panel (assigned[].is_charter +
                                        charter_booking_id) and the server's overnight holds (bkOvnHoldMap, already the server's)
     boatCapInfo(boatId, date)          the server's day object {capacity, normal, ceiling, reason, set_by, set_at} of an overridden
                                        day (cached by 49-ops-capacity-overrides.js); boatCapFor reads it through boatCapInfo

   Not here (docs/walk/w5-c.md): bkOvnHealSpans stays (Q39: the browser keeps creating the nightly cells), baAssignedPax
   (no per-boat pax figure on a read: MISSING-SERVER-FIELD).
   ═════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function enabled(){ return !!(O.enabled && O.enabled()); }
  function wrapGlobal(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsW5c) return;
    var w = function(){
      if(!enabled()) return orig.apply(this, arguments);
      var r = fn.apply(this, [orig, this].concat([].slice.call(arguments)));
      return r === undefined ? orig.apply(this, arguments) : r;
    };
    w.__opsW5c = true; w.__orig = orig; window[name] = w;
  }
  function clientBookingId(id){
    if(!id) return id;
    var list = (typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS)) ? SB_BOOKINGS : [];
    var b = list.find(function(x){ return x && x.opsId === id; });
    return b ? b.id : id;
  }

  /* ── the server repairs these on every booking write: the browser's copies do nothing in ops mode ── */
  // These two have no result a caller reads (bookingV2CharterBoatHeal returns a count, only logged).
  wrapGlobal('bookingV2CharterBoatHeal', function(){ return 0; });
  wrapGlobal('bookingV2HealSelfArrivePickup', function(){ return null; });

  /* ── boat pulled: the trip's own flag ── */
  wrapGlobal('bookingV2BoatPulled', function(orig, self, bk, date){
    if(!bk || !bk.opsId || typeof window.bkOpsRead !== 'function') return undefined;
    var o = window.bkOpsRead(bk, date);
    if(!o || o.boatPulled === undefined) return undefined;
    return !!o.boatPulled;
  });

  /* ── charter boats of a day: the panel's assigned boats flagged is_charter, plus the server's overnight holds ── */
  wrapGlobal('baCharterBoatMap', function(orig, self, date){
    var B = O.boatOperation; if(!B || !date) return undefined;
    var day = B.day(date);
    if(!day || !Array.isArray(day.assigned)){
      B.ensure([date], function(){ try{ if(typeof window.baChMemoClear === 'function') window.baChMemoClear(); }catch(_){}
        try{ if(O.activeView() === 'booking' && typeof window.bookingV2RenderKeep === 'function') window.bookingV2RenderKeep(); }catch(_){} });
      return undefined;                                 // legacy's walk until the day's panel is here
    }
    var m = new Map();
    day.assigned.forEach(function(a){
      if(a && a.is_charter && a.charter_booking_id && a.boat_id && !m.has(a.boat_id)) m.set(a.boat_id, clientBookingId(a.charter_booking_id));
    });
    var holds = (typeof window.bkOvnHoldMap === 'function') ? window.bkOvnHoldMap(date) : null;
    if(holds && holds.forEach) holds.forEach(function(h, id){ if(!m.has(id)) m.set(id, h.bkId); });
    return m;
  });

  /* ── a boat's seats on a day: the server's numbers for an overridden day ── */
  wrapGlobal('boatCapInfo', function(orig, self, boatId, date){
    var C = (typeof BOAT_CAP_OVR !== 'undefined') ? BOAT_CAP_OVR : null; if(!C) return undefined;
    var o = C[String(date || '') + '::' + String(boatId || '')];
    if(!o || !o.srv || o.normal == null || o.ceiling == null) return undefined;
    var cap = +o.cap || 0, base = +o.normal || 0;
    return { cap: cap, base: base, license: +o.ceiling || 0, overridden: cap !== base, reason: o.reason || '', by: o.by || '', at: o.at || '', delta: cap - base };
  });
})();
