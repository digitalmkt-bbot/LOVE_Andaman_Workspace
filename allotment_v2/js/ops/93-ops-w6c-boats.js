/* ═════════════════════════════════════════════════════════════════════════
   §opsW6cBoats (2026-10-18, wave 6 group c) · a boat's heads and seats of a day, the server's answer
   ─────────────────────────────────────────────────────────────────────────
   Backend guides: operation-backend README "Fleet maintenance: availability" (boat-operation `booked { pax, bookings }` on every boat
   of assigned / available / unavailable) and "A boat's seats for one day" (capacity-overrides?all=true: a day object for EVERY date).
   todo/w5-c-model.md asks 7 and 9. docs/walk/w6-c.md has the per-function table. Classic script, after 71-ops-boat-operation.js /
   49-ops-capacity-overrides.js / 82-ops-w5c-boats.js, before 90-ops-boot.js. Legacy mode, and until an answer is here, every wrapper
   delegates.

     baAssignedPax(date, boatId)        booked.pax of the boat in the day's fleet panel (the heads placed on it that day)
     baAssignedBookings(date, boatId)   { count: booked.bookings, pax: booked.pax }
     boatCapInfo(boatId, date)          the day object { capacity, normal, ceiling } of a day with NO override (an overridden day is
                                        answered by 82-ops-w5c-boats.js from the override cache). Read per boat in windows of 62
                                        days the first time a day of the window is asked for; a write makes the windows old.
   ═════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function on(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsW6c) return;
    var w = function(){
      if(!on()) return orig.apply(this, arguments);
      var r = fn.apply(this, [orig, this].concat([].slice.call(arguments)));
      return r === undefined ? orig.apply(this, arguments) : r;
    };
    w.__opsW6c = true; w.__orig = orig; window[name] = w;
  }
  var redrawT = null;
  function redraw(){
    clearTimeout(redrawT); redrawT = setTimeout(redrawNow, 60);
  }
  function redrawNow(){
    if(!on() || (O.busy && O.busy())) return;
    var v = O.activeView();
    try{
      if(v === 'operation' && typeof window.renderOp === 'function') window.renderOp();
      else if(v === 'booking' && typeof window.bookingV2RenderKeep === 'function') window.bookingV2RenderKeep();
      else if(v === 'boatassign' && typeof window.renderBoatAssign === 'function') window.renderBoatAssign();
    }catch(_){}
  }

  /* ── heads placed on a boat, from the fleet panel of the day ── */
  function bookedOn(date, boatId){
    var B = O.boatOperation; if(!B || !date || !boatId) return undefined;
    var day = B.day(date);
    if(!day){ B.ensure([date], redraw); return undefined; }          // legacy's walk until the day's panel is here
    var lists = [day.assigned, day.available, day.unavailable];
    for(var i = 0; i < lists.length; i++){
      var l = lists[i]; if(!Array.isArray(l)) continue;
      for(var k = 0; k < l.length; k++) if(l[k] && l[k].boat_id === boatId && l[k].booked) return l[k].booked;
    }
    return undefined;
  }
  wrap('baAssignedPax', function(orig, self, date, boatId){
    var b = bookedOn(date, boatId); return b ? (+b.pax || 0) : undefined;
  });
  wrap('baAssignedBookings', function(orig, self, date, boatId){
    var b = bookedOn(date, boatId); return b ? { count: +b.bookings || 0, pax: +b.pax || 0 } : undefined;
  });

  /* ── a day with no override: { capacity, normal, ceiling } ── */
  var WIN = 62, PLAIN = {}, REQ = {}, epoch = 0;
  O.onWrite(function(){ epoch++; });
  function dayNo(ymd){ var p = String(ymd).split('-'); return Math.floor(Date.UTC(+p[0], (+p[1] || 1) - 1, +p[2] || 1) / 86400000); }
  function ymdOf(no){ return new Date(no * 86400000).toISOString().slice(0, 10); }
  function want(boatId, date){
    if(window.__laEmbedToken || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return;      // CS's embed token may not read capacity-overrides
    var no = dayNo(date), start = no - (((no % WIN) + WIN) % WIN), key = boatId + '@' + start;
    if(REQ[key] === epoch) return;
    REQ[key] = epoch;
    O.get('/v1/boats/' + enc(boatId) + '/capacity-overrides', { from: ymdOf(start), to: ymdOf(start + WIN - 1), all: 'true' }).then(function(j){
      var fresh = false;
      ((j && j.overrides) || []).forEach(function(d){
        if(!d || !d.service_date) return;
        var k = d.service_date + '::' + boatId;
        if(d.overridden){ if(O.capOverrides && O.capOverrides.applyDay) O.capOverrides.applyDay(d); }
        else PLAIN[k] = { capacity: +d.capacity || 0, normal: +d.normal || 0, ceiling: +d.ceiling || 0 };
        fresh = true;
      });
      if(fresh) redraw();
    }, function(e){ try{ console.warn('[ops] boat seats of a day: the server did not answer, the boat record stays · ' + (e && e.message)); }catch(_){} });
  }
  wrap('boatCapInfo', function(orig, self, boatId, date){
    if(!boatId || !date) return undefined;
    var k = String(date) + '::' + String(boatId);
    var C = (typeof BOAT_CAP_OVR !== 'undefined') ? BOAT_CAP_OVR : null;
    if(C && C[k] && C[k].srv) return undefined;                          // an overridden day: 82-ops-w5c-boats.js
    want(boatId, date);
    var p = PLAIN[k]; if(!p) return undefined;
    return { cap: p.capacity, base: p.normal, license: p.ceiling, overridden: false, delta: 0 };
  });
})();
