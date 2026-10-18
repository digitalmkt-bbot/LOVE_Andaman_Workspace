/* ══════════════════════════════════════════════════════════════════════════
   §opsLocksW5 (w5-b, 2026-10-18) · the seat-lock rules that were still answered by browser arithmetic ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Wiring recheck rows (operation-backend docs/verify/wire2/wire-04.md), Seat Lock board, booking form lock use, whole-boat holds.
   ops/30-ops-locks.js keeps, for every lock and departure, the server's own numbers (lock.srv.*: remaining_pax, pending_pax,
   sub_group_room, release_at, overdue and, since w5-b, held_pax, holding, allocated_pax, drawn_pax, boat_capacity). Each legacy rule
   below answers from them when they are in hand for that lock and date, and runs legacy's own arithmetic only before the
   first answer or for a lock the server did not describe.

     bookingV2LockHoldsOn        ← holding                      bookingV2LockAllocated   ← allocated_pax (parent)
     bookingV2LockUnalloc        ← pax − released − allocated_pax
     bookingV2LockUsedTotal      ← drawn_pax (a parent's covers its sub-groups)
     bookingV2LockHeldRemaining  ← held_pax                     bookingV2LockPoolHold    ← held_pax (a sub-group holds nothing)
     bookingV2LockPendOn         ← pending_pax
     bookingV2LocksForAgent / bookingV2SetTripLockUse ← POST /v1/quote/lock-draws sources (ops/71)
     bookingV2LockFreeOn         ← GET /v1/availability available_seats (+ the lock's own hold when editing it)
     bookingV2DayLockedTotal     ← locked_pax of every route that day (GET /v1/availability)
     bookingV2BoatCapOn          ← boat_capacity of a hold; the boat list's capacity; the day's deployments
     bookingV2BoatLockBlockers   ← GET /v1/seat-locks/boat-options (blockers, placed_route_id, why)
     bookingV2BoatLockCanTake    ← the same list; while it is not in hand the server judges on the write (409 boat_taken)
     bookingV2BoatLockCellClear  ← not run: the lists and the board are read again (ops/30 refreshBoard)
     bookingV2DrawLock / bookingV2ReturnLock ← no log line, no status, no save: a transient move of the server's numbers until the reload
                                   that follows every booking write (bookingV2ReturnBookingDraws goes through bookingV2ReturnLock)

   Classic script, after js/ops/30-ops-locks.js, 50-ops-availability.js and 71-ops-booking-form.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.locks) return;
  function on(){ return !!(O.enabled && O.enabled() && O.locks.isReady && O.locks.isReady()); }
  function locks(){ return (typeof SB_SEAT_LOCKS !== 'undefined') ? SB_SEAT_LOCKS : []; }
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__w5b) return;
    var w = function(){
      if(!on()) return orig.apply(this, arguments);
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
    w.__w5b = true; w.__orig = orig; window[name] = w;
  }
  function sv(l, key, date){ return (l && l.srv && date && l.srv[key] && l.srv[key][date] !== undefined) ? l.srv[key][date] : undefined; }
  function spans(l){ return !!l && (l.scope === 'bulk' || l.scope === 'month'); }
  function isBoat(l){ return !!l && l.scope === 'boat'; }
  /* the date a rule is asked about: the one given, else a one-day lock's own day */
  function dateOf(l, date){ return date || (l && !spans(l) ? l.date : ''); }
  /* a bulk lock's figure that does not depend on the day (seats split into sub-groups): the first departure from today on */
  function anyDate(l){
    if(!l || !l.srv || !l.srv.alloc) return '';
    var ds = Object.keys(l.srv.alloc).sort(), today = O.today();
    return ds.filter(function(d){ return d >= today; })[0] || ds[0] || '';
  }

  /* ── what a lock holds, has drawn, has split ─────────────────────────────── */
  wrap('bookingV2LockHoldsOn', function(orig, l, tripDate){
    var v = sv(l, 'holding', dateOf(l, tripDate));
    return v === undefined ? orig.apply(this, [].slice.call(arguments, 1)) : v;
  });
  wrap('bookingV2LockAllocated', function(orig, parent){
    var v = sv(parent, 'alloc', anyDate(parent) || dateOf(parent));
    return (parent && !parent.parentId && v !== undefined) ? v : orig.apply(this, [].slice.call(arguments, 1));
  });
  wrap('bookingV2LockUnalloc', function(orig, parent){
    var v = sv(parent, 'alloc', anyDate(parent) || dateOf(parent));
    return (parent && !parent.parentId && v !== undefined) ? Math.max(0, (parent.qty || 0) - v) : orig.apply(this, [].slice.call(arguments, 1));
  });
  wrap('bookingV2LockUsedTotal', function(orig, l, date){
    var v = sv(l, 'drawn', dateOf(l, date));
    return v === undefined ? orig.apply(this, [].slice.call(arguments, 1)) : v;
  });
  wrap('bookingV2LockHeldRemaining', function(orig, l, date){
    if(!l || l.parentId || isBoat(l) || (!date && spans(l))) return orig.apply(this, [].slice.call(arguments, 1));
    var v = sv(l, 'held', dateOf(l, date));
    return (v === undefined || v === null) ? orig.apply(this, [].slice.call(arguments, 1)) : v;
  });
  wrap('bookingV2LockPoolHold', function(orig, l, date){
    if(l && l.parentId) return 0;                              // a sub-group holds nothing of its own: its parent does
    var v = (l && !isBoat(l)) ? sv(l, 'held', dateOf(l, date)) : undefined;
    return (v === undefined || v === null) ? orig.apply(this, [].slice.call(arguments, 1)) : v;
  });
  wrap('bookingV2LockPendOn', function(orig, l, date){
    if(!l || l.parentId || isBoat(l)) return 0;
    var v = sv(l, 'pend', dateOf(l, date));
    return v === undefined ? orig.apply(this, [].slice.call(arguments, 1)) : v;
  });

  /* ── the booking form: which locks a booking may draw, and how many seats in all ──────────────────────────
     The server's sources for the open draft (POST /v1/quote/lock-draws) are the locks the agent may draw: its own, the office's
     and the global ones. The box's ceiling is the sum of what those sources still have. */
  wrap('bookingV2LocksForAgent', function(orig, routeId, date, agentId){
    var legacy = orig.apply(this, [].slice.call(arguments, 1));
    var src = O.lockDraws && O.lockDraws.sources ? O.lockDraws.sources(routeId, date) : null;
    if(!src) return legacy;
    var ids = {};
    src.forEach(function(s){ var l = O.locks.find(s.lockId); if(l) ids[l.parentId || l.id] = true; });
    return legacy.filter(function(l){ return ids[l.id]; });
  });
  wrap('bookingV2SetTripLockUse', function(orig, idx, val){
    var nb = window._bkV2 && _bkV2.newBooking, t = nb && nb.trips && nb.trips[idx];
    var src = t && O.lockDraws && O.lockDraws.sources ? O.lockDraws.sources(t.routeId, t.date) : null;
    if(!src) return orig.apply(this, [].slice.call(arguments, 1));
    var pax = typeof window.bookingV2PaxAllTot === 'function' ? window.bookingV2PaxAllTot(t.pax) : 0;
    var rem = src.reduce(function(s, x){ return s + (+x.remaining || 0); }, 0);
    t.lockUse = Math.max(0, Math.min(Number(val) || 0, pax, rem));
    if(typeof window.bookingV2Render === 'function') window.bookingV2Render();
  });

  /* ── free seats of a departure, for the lock form ────────────────────────────
     null = no boat or quota to compare with (legacy let such a lock through). The server's available_seats already leaves out the
     locks, so the lock being edited gets its own hold back. */
  wrap('bookingV2LockFreeOn', function(orig, routeId, date, self){
    var A = O.availability, s = A && A.get ? A.get(routeId, date) : null;
    if(A && A.ensure && /^\d{4}-\d{2}-\d{2}$/.test(date || '')) A.ensure(date);
    if(!s || s.available_seats == null) return orig.apply(this, [].slice.call(arguments, 1));
    if(s.unlimited || !(+s.deployed_capacity > 0)) return null;
    var own = (self && typeof window.bookingV2LockPoolHold === 'function') ? window.bookingV2LockPoolHold(self, date) : 0;
    return Math.max(0, (+s.available_seats || 0) + own);
  });
  /* seats the locks take out of a day's pool: locked_pax of every route (the calendar and the day panel) */
  wrap('bookingV2DayLockedTotal', function(orig, date){
    var A = O.availability, R = (typeof ROUTES !== 'undefined' && Array.isArray(ROUTES)) ? ROUTES : [];
    if(!A || !A.get || !R.length || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return orig.apply(this, [].slice.call(arguments, 1));
    if(A.ensure) A.ensure(date);
    var sum = 0;
    for(var i = 0; i < R.length; i++){
      var s = R[i] && R[i].id ? A.get(R[i].id, date) : null;
      if(!s || s.locked_pax == null) return orig.apply(this, [].slice.call(arguments, 1));
      sum += +s.locked_pax || 0;
    }
    return sum;
  });

  /* ── whole-boat holds ────────────────────────────────────────────────────── */
  /* the boat's seats on a day: a hold's boat_capacity, else the boat list's capacity, else the deployment the day's availability shows */
  wrap('bookingV2BoatCapOn', function(orig, id, date){
    var L = locks();
    for(var i = 0; i < L.length; i++){
      var l = L[i];
      if(l && l.scope === 'boat' && l.boatId === id && l.date === date){ var v = sv(l, 'cap', date); if(v > 0) return v; }
    }
    var R = (typeof ROUTES !== 'undefined' && Array.isArray(ROUTES)) ? ROUTES : [];
    for(var j = 0; j < R.length; j++){
      var row = O.locks.boatOptRow(date, R[j].id, '', id, false);
      if(row && +row.capacity > 0) return +row.capacity;
    }
    if(O.availability && O.availability.get){
      for(var k = 0; k < R.length; k++){
        var s = O.availability.get(R[k].id, date);
        var dep = s && Array.isArray(s.deployments) ? s.deployments.filter(function(x){ return x && x.boat_id === id; })[0] : null;
        if(dep && +dep.capacity > 0) return +dep.capacity;
      }
    }
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  /* the pick list asks Blockers without a route: remember the route/lock the list was asked for */
  var pickCtx = null;
  (function(){
    var inner = window.bookingV2BoatLockPickList; if(typeof inner !== 'function' || inner.__w5bCtx) return;
    var w = function(date, routeId, exceptId){
      var prev = pickCtx; pickCtx = { routeId: routeId, exceptId: exceptId };
      try{ return inner.apply(this, arguments); } finally { pickCtx = prev; }
    };
    w.__w5bCtx = true; w.__orig = inner; window.bookingV2BoatLockPickList = w;
  })();
  wrap('bookingV2BoatLockBlockers', function(orig, date, boatId, routeId, exceptId){
    var rid = routeId || (pickCtx && pickCtx.routeId) || '', ex = exceptId || (pickCtx && pickCtx.exceptId) || '';
    var row = rid ? O.locks.boatOptRow(date, rid, ex, boatId, true) : null;
    if(!row) return orig.apply(this, [].slice.call(arguments, 1));
    var b = row.blockers || {}, own = !!(ex && row.own);
    var rows = (b.bookings || []).map(function(x){
      return { id: x.booking_id, vc: x.voucher_ref || x.booking_id || '', pax: +x.pax || 0, fromLock: +x.from_lock || 0, agentId: x.agent_id || null, routeId: x.route_id || '' };
    });
    var placed = own ? '' : (row.placed_route_id || b.placed_route_id || '');
    return { rows: rows, pax: rows.reduce(function(s, r){ return s + r.pax; }, 0), cellBooked: 0,
      charterOf: b.charter_booking_id || '', holdOf: own ? '' : (b.hold_id || ''), short: +b.short || 0, sold: +b.sold || 0, capAfter: 0,
      placed: placed, otherRoute: (placed && routeId && placed !== routeId) ? placed : '' };
  });
  /* can this boat be held: the server's ok. While the list is not in hand the question is not answered here: the form is
     drawn again when the list lands, and a hold made before that is judged by the server (409 boat_taken, its message shown) */
  wrap('bookingV2BoatLockCanTake', function(orig, date, boatId, routeId, exceptId){
    if(!routeId) return orig.apply(this, [].slice.call(arguments, 1));
    var row = O.locks.boatOptRow(date, routeId, exceptId || '', boatId, true);
    return row ? !!row.ok : true;
  });
  /* the board cell of a hold is the server's deployment: ops/30 reads it again after the command (refreshBoard) */
  wrap('bookingV2BoatLockCellClear', function(){ return false; });

  /* ── draws and returns: the server counts; these only move its numbers until the reload that follows the save ─── */
  function bump(l, date, n){
    if(!l) return;
    var d = dateOf(l, date);
    l.used = (Number(l.used) || 0) + n;
    if(spans(l) && date){ l.usedBy = l.usedBy || {}; var v = Math.max(0, (Number(l.usedBy[date]) || 0) + n); if(v) l.usedBy[date] = v; else delete l.usedBy[date]; }
    if(l.srv && d){
      if(l.srv.rem && l.srv.rem[d] !== undefined) l.srv.rem[d] = Math.max(0, l.srv.rem[d] - n);
      if(l.srv.drawn && l.srv.drawn[d] !== undefined) l.srv.drawn[d] = Math.max(0, l.srv.drawn[d] + n);
      if(l.srv.held && l.srv.held[d] != null) l.srv.held[d] = Math.max(0, l.srv.held[d] - n);
    }
  }
  wrap('bookingV2DrawLock', function(orig, lockId, qty, bookingId, tripDate){
    var l = O.locks.find(lockId); if(!l) return 0;
    var n = Math.min(Math.max(0, qty | 0), window.bookingV2LockDrawable(l, tripDate)); if(n <= 0) return 0;
    bump(l, tripDate, n);
    var p = l.parentId ? O.locks.find(l.parentId) : null;
    if(p && p.srv){ var d = dateOf(p, tripDate); if(p.srv.drawn && p.srv.drawn[d] !== undefined) p.srv.drawn[d] += n; }
    return n;
  });
  wrap('bookingV2ReturnLock', function(orig, lockId, qty, bookingId, tripDate){
    var l = O.locks.find(lockId); if(!l) return 0;
    var n = Math.min(Math.max(0, qty | 0), Number(l.used) || 0); if(n <= 0) return 0;
    bump(l, tripDate, -n);
    var p = l.parentId ? O.locks.find(l.parentId) : null;
    if(p && p.srv){ var d = dateOf(p, tripDate); if(p.srv.drawn && p.srv.drawn[d] !== undefined) p.srv.drawn[d] = Math.max(0, p.srv.drawn[d] - n); }
    return n;
  });
})();
