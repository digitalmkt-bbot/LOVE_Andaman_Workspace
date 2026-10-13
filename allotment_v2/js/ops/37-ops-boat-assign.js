/* ════════════════════════════════════════════════════════════════════════
   §opsBoatAssign (2026-10-12) · which boat a booking goes on ⇄ operation-backend
   ────────────────────────────────────────────────────────────────────────
   PATCH /operations/trip-ops/{trip_id}
     {boat_id}                                 one boat · null clears
     {boat_splits: [{boat_id, ad, chd, inf, foc}, …]}   two boats or more · per-type pax must add up
     raise_capacity: {reason}                  the emergency "raise this boat's capacity for the day"

   The server owns every rule (domain/dispatch.ts): boat not deployed on the route that day (409
   boat_not_deployed), chartered that day (409 boat_chartered), over capacity + 2 (409 boat_full),
   over the licence (409 over_licence, no way past), raising without act-capunlock (403). So the
   browser sends and shows the answer; it does not re-check.

   Server first: local ops change from the server's trip.operations, never before.
     bookingV2AssignBoat           one booking (by-trip boat mode, Boat Assign page)
     bookingV2BoatSplitApply       the split popup
     bookingV2BoatUnsplit          back to one boat
     bookingV2BoatAssignSelected   ticked rows to one boat · a refused row is skipped and listed
   Snapshot → original → send → restore if refused (they validate their own forms first):
     pckMoveSave                   pier "move boat" (ย้ายลำหน้าท่า)
     bop2RpMoveBookings            Boat Operation "replace boat": runs inside the deployment sync,
                                   after the new boat is deployed and before the old one is removed
   Refused in ops mode: baAutoAssign (the server does not pick boats).

   Legacy mode (!O.enabled()): every wrapped function delegates to the original.
   Classic script · loads after 20-ops-deployments.js and 40-ops-bookings.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var PAX = ['ad', 'chd', 'inf', 'foc'];
  var originals = {};
  var WRAPPED = ['bookingV2AssignBoat', 'bookingV2BoatSplitApply', 'bookingV2BoatUnsplit', 'bookingV2BoatAssignSelected',
    'pckMoveSave', 'bop2RpMoveBookings', 'baAutoAssign'];
  WRAPPED.forEach(function(n){ if(typeof window[n] === 'function') originals[n] = window[n]; });
  function wrap(name, opsFn){
    var orig = originals[name];
    window[name] = function(){
      if(!O.enabled()) return orig ? orig.apply(this, arguments) : undefined;
      return opsFn.apply(this, arguments);
    };
  }

  function enc(x){ return encodeURIComponent(x == null ? '' : String(x)); }
  function failCode(e){ return (e && (e.code || e.status)) || 'error'; }
  function refuse(title, sub){ O.toast({ kind: 'error', title: title, status: 'REFUSED', sub: sub || '', dur: 7000 }); return null; }
  function allBookings(){ return (typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS)) ? SB_BOOKINGS : []; }
  function byClientId(id){ return allBookings().find(function(b){ return b && b.id === id; }) || null; }
  function dateOf(b, date){ return (typeof bkOpsDate === 'function') ? bkOpsDate(b, date) : (date || ((b.trips || [])[0] || {}).date || ''); }
  function opsRead(b, d){ return ((typeof bkOpsRead === 'function') ? bkOpsRead(b, d) : b.ops) || {}; }
  function opsFor(b, d){ return (typeof bkOpsFor === 'function') ? bkOpsFor(b, d) : (b.ops = b.ops || {}); }
  function tripOn(b, d, routeId){
    return (b.trips || []).find(function(t){ return t && (t.date || '') === d && (!routeId || t.routeId === routeId); }) || null;
  }
  function boatName(id){
    if(typeof pckBoatName === 'function'){ try{ return pckBoatName(id); }catch(_){} }
    var bo = (typeof BOATS !== 'undefined' ? BOATS : []).find(function(x){ return x && x.id === id; });
    return (bo && bo.name) || id;
  }
  function paxOf(s){
    var p = (typeof bkSplitPax === 'function') ? bkSplitPax(s) : s;
    var o = {}; PAX.forEach(function(k){ o[k] = Math.max(0, +(p && p[k]) || 0); }); return o;
  }
  function splitBody(parts){
    return parts.map(function(p){ var q = paxOf(p); return { boat_id: p.boatId, ad: q.ad, chd: q.chd, inf: q.inf, foc: q.foc }; });
  }
  function rerender(){
    try{
      if(typeof _bkV2 !== 'undefined' && _bkV2 && _bkV2.boatAssignMode && typeof bookingV2Render === 'function') bookingV2Render();
      else if(O.activeView && O.activeView() === 'boatassign' && typeof renderBoatAssign === 'function') renderBoatAssign();
      else if(typeof bookingV2Render === 'function') bookingV2Render();
    }catch(_){}
    if(typeof renderCheckinAll === 'function'){ try{ renderCheckinAll(); }catch(_){} }
  }

  /* the server's trip.operations → the booking's local ops for that day
     (a split keeps ops.boatId = its first boat: old readers still look there) */
  function applyOps(b, d, ops){
    if(!ops) return;
    var o = opsFor(b, d);
    var splits = Array.isArray(ops.boat_splits) ? ops.boat_splits : [];
    if(splits.length){
      o.boatSplits = splits.map(function(s){
        var q = { boatId: s.boat_id }; PAX.forEach(function(k){ q[k] = +s[k] || 0; });
        q.pax = PAX.reduce(function(n, k){ return n + q[k]; }, 0);
        return q;
      });
      o.boatId = splits[0].boat_id;
    } else {
      delete o.boatSplits;
      o.boatId = ops.boat_id || null;
    }
    o.boatPulled = !!ops.boat_pulled;
  }

  /* un-queued: one PATCH; resolves with the server's trip */
  function patchNow(tripId, body){
    return O.call('PATCH', '/operations/trip-ops/' + enc(tripId), body).then(function(res){ return (res && res.trip) || null; });
  }
  function canRaise(){ try{ return typeof boatCapMayRaise !== 'function' || boatCapMayRaise(); }catch(_){ return false; } }

  /* one booking's boat for one day · {boat_id} or {boat_splits} · asks for a raise on boat_full
     when allowed and opts.ask is not false · resolves with the trip, or rejects with the error */
  function setBoat(b, d, body, opts){
    opts = opts || {};
    var t = tripOn(b, d, opts.routeId);
    if(!b.opsId || !t || !t.opsTripId){
      var e = new Error('This booking is not saved to operation-backend yet'); e.code = 'not_synced';
      return Promise.reject(e);
    }
    return O.queue(function(){ return patchNow(t.opsTripId, body); }).catch(function(err){
      if(!(err && err.code === 'boat_full') || opts.ask === false || !canRaise()) throw err;
      var reason = window.prompt(err.message + '\n\nEMERGENCY ONLY: raise this boat\'s capacity for the day?\nType the reason (your name is recorded), or Cancel to leave it.', '');
      if(!reason || !String(reason).trim()) throw err;
      var again = Object.assign({}, body, { raise_capacity: { reason: String(reason).trim() } });
      return O.queue(function(){ return patchNow(t.opsTripId, again); });
    }).then(function(trip){
      if(trip) applyOps(b, d, trip.operations);
      O.wrote('trip-boat');
      return trip;
    });
  }

  /* ── one booking ── */
  wrap('bookingV2AssignBoat', function(bkId, boatId, date){
    var b = byClientId(bkId); if(!b) return null;
    var d = dateOf(b, date);
    var cur = opsRead(b, d);
    if(Array.isArray(cur.boatSplits) && cur.boatSplits.length
       && !window.confirm('บุคกิ้งนี้แยกลง ' + cur.boatSplits.length + ' ลำอยู่\nเลือกลำเดียวจะยกเลิกการแยกทั้งหมด — ยืนยันไหม')) return null;
    return setBoat(b, d, { boat_id: boatId || null }).then(rerender, function(e){
      O.fail('Boat not assigned · ' + failCode(e), e); rerender();
    });
  });

  /* ── the split popup ── */
  wrap('bookingV2BoatSplitApply', function(){
    var m = (typeof _bkBoatM !== 'undefined') ? _bkBoatM : null; if(!m) return null;
    var b = byClientId(m.bkId); if(!b) return null;
    var sum = function(p){ return PAX.reduce(function(n, k){ return n + Math.max(0, +(p && p[k]) || 0); }, 0); };
    var parts = (m.parts || []).filter(function(p){ return sum(p) > 0; });
    if(!parts.length) return null;
    if(parts.reduce(function(n, p){ return n + sum(p); }, 0) !== sum(m.pool)) return null;
    if(parts.some(function(p){ return !p.boatId; })){ window.alert('ยังมีก้อนที่ไม่ได้เลือกเรือ'); return null; }
    var ids = parts.map(function(p){ return p.boatId; });
    if(ids.some(function(x, i){ return ids.indexOf(x) !== i; })){ window.alert('เลือกเรือซ้ำลำ — รวมให้เป็นก้อนเดียว หรือเปลี่ยนลำ'); return null; }
    var body = parts.length === 1 ? { boat_id: parts[0].boatId } : { boat_splits: splitBody(parts) };
    return setBoat(b, m.date, body).then(function(){
      if(typeof bookingV2BoatSplitClose === 'function') bookingV2BoatSplitClose();
      rerender();
      O.toast({ kind: 'success', title: parts.length > 1 ? 'แยกลงเรือแล้ว' : 'จัดลงลำเดียว',
        sub: parts.map(function(p){ return boatName(p.boatId) + ' ' + sum(p); }).join(' · ') });
    }, function(e){ O.fail('Boats not split · ' + failCode(e), e); });
  });

  /* ── back to one boat ── */
  wrap('bookingV2BoatUnsplit', function(bkId, date){
    var b = byClientId(bkId); if(!b) return null;
    var d = dateOf(b, date);
    var splits = opsRead(b, d).boatSplits;
    if(!Array.isArray(splits) || !splits.length) return null;
    var first = splits[0] || {};
    var tot = splits.reduce(function(n, s){ var q = paxOf(s); return n + q.ad + q.chd + q.inf + q.foc; }, 0);
    if(!window.confirm('รวมกลับเป็นลำเดียว — คนทั้ง ' + tot + ' คนจะไปอยู่ ' + boatName(first.boatId) + ' ลำเดียว\nถ้าเกินความจุจะขึ้นเตือนที่หน้าจัดเรือ · ยืนยันไหม')) return null;
    return setBoat(b, d, { boat_id: first.boatId || null }).then(rerender, function(e){
      O.fail('Boats not merged · ' + failCode(e), e);
    });
  });

  /* ── ticked rows to one boat · one PATCH each, in order; a refused row is skipped and listed ── */
  wrap('bookingV2BoatAssignSelected', function(date, routeId, boatId){
    if(!boatId) return null;
    var sel = window._bkV2BoatSel || {};
    var ids = Object.keys(sel).filter(function(k){ return sel[k]; });
    if(!ids.length){ window.alert('Tick at least one row first.'); return null; }
    var done = 0, skipped = [];
    var chain = Promise.resolve();
    ids.forEach(function(id){
      var b = byClientId(id); if(!b || !tripOn(b, date, routeId)) return;
      chain = chain.then(function(){
        return setBoat(b, date, { boat_id: boatId }, { routeId: routeId, ask: false }).then(function(){
          delete sel[id]; done++;
        }, function(e){ skipped.push((b.leadPax || b.customerName || id) + ' (' + failCode(e) + ')'); });
      });
    });
    return chain.then(function(){
      if(skipped.length) window.alert('Assigned ' + done + ' booking(s) to ' + boatName(boatId) + '.\nSkipped ' + skipped.length + ': ' + skipped.join(', ')
        + '\n\nboat_full: assign a skipped row on its own to raise this boat\'s capacity for the day (reason required).');
      rerender();
    });
  });

  /* ── snapshot / restore for the two that run their own form first ── */
  function snapBoats(b){
    var out = {};
    (b.trips || []).forEach(function(t){
      if(!t || !t.date || out[t.date]) return;
      var o = opsRead(b, t.date);
      out[t.date] = { boatId: o.boatId || null, boatSplits: Array.isArray(o.boatSplits) ? O.clone(o.boatSplits) : null };
    });
    return out;
  }
  function restoreBoats(b, snap){
    Object.keys(snap).forEach(function(d){
      var o = opsFor(b, d), s = snap[d];
      o.boatId = s.boatId;
      if(s.boatSplits) o.boatSplits = s.boatSplits; else delete o.boatSplits;
    });
  }
  /* the days whose boat changed, each as the body that says the new boat */
  function changedBodies(b, before){
    var after = snapBoats(b), out = [];
    Object.keys(after).forEach(function(d){
      var a = after[d], s = before[d] || {};
      if(JSON.stringify(a) === JSON.stringify(s)) return;
      out.push({ date: d, body: (a.boatSplits && a.boatSplits.length > 1) ? { boat_splits: splitBody(a.boatSplits) } : { boat_id: a.boatId || null } });
    });
    return out;
  }

  /* pier "move boat" · its form decides the boat and the reason; the server decides if it may */
  wrap('pckMoveSave', function(bkId){
    var b = byClientId(bkId);
    var before = b ? snapBoats(b) : null;
    var hist = b && Array.isArray(b.history) ? b.history.length : -1;
    var ok = originals.pckMoveSave ? originals.pckMoveSave.apply(this, arguments) : false;
    if(!ok || !b) return ok;
    var changes = changedBodies(b, before);
    restoreBoats(b, before);                        // server first: the move shows once the server took it
    changes.reduce(function(p, c){
      return p.then(function(){ return setBoat(b, c.date, c.body, { ask: false }); });
    }, Promise.resolve()).then(rerender, function(e){
      restoreBoats(b, before);
      if(hist >= 0 && Array.isArray(b.history) && b.history.length > hist) b.history.length = hist;
      O.fail('Boat not moved · ' + failCode(e), e);
      rerender();
    });
    return ok;
  });

  /* Boat Operation "replace boat" · the bookings move inside the deployment sync */
  wrap('bop2RpMoveBookings', function(d, fromId, toId){
    var snaps = allBookings().filter(function(b){ return b && tripOn(b, d); }).map(function(b){ return { b: b, before: snapBoats(b) }; });
    var n = originals.bop2RpMoveBookings ? originals.bop2RpMoveBookings.apply(this, arguments) : 0;
    var moves = [];
    snaps.forEach(function(s){
      changedBodies(s.b, s.before).forEach(function(c){
        var undoBody = (s.before[c.date] && s.before[c.date].boatSplits && s.before[c.date].boatSplits.length > 1)
          ? { boat_splits: splitBody(s.before[c.date].boatSplits) } : { boat_id: (s.before[c.date] || {}).boatId || null };
        moves.push({ b: s.b, date: c.date, body: c.body, undo: undoBody, before: s.before });
      });
    });
    if(!moves.length) return n;
    var ops = moves.map(function(mv){
      var t = tripOn(mv.b, mv.date);
      return {
        label: 'move ' + (mv.b.leadPax || mv.b.id) + ' ' + fromId + ' → ' + toId + ' on ' + mv.date,
        run: function(){
          if(!mv.b.opsId || !t || !t.opsTripId){ var e = new Error('Booking ' + mv.b.id + ' is not saved to operation-backend yet'); e.code = 'not_synced'; return Promise.reject(e); }
          return patchNow(t.opsTripId, mv.body).then(function(trip){ if(trip) applyOps(mv.b, mv.date, trip.operations); });
        },
        undo: function(){ return (t && t.opsTripId) ? patchNow(t.opsTripId, mv.undo) : Promise.resolve(null); }
      };
    });
    if(O.deployments && O.deployments.addBetween){
      O.deployments.addBetween({ ops: ops, onFail: function(){
        moves.forEach(function(mv){ restoreBoats(mv.b, mv.before); });
        rerender();
      } });
    } else {
      moves.forEach(function(mv){ restoreBoats(mv.b, mv.before); });
      refuse('Bookings not moved', 'Boat Operation is not on operation-backend');
    }
    return n;
  });

  wrap('baAutoAssign', function(){
    O.toast({ kind: 'pending', title: 'Auto-assign is not on operation-backend', status: 'NOT YET', sub: 'Assign boats by hand. Nothing was changed.', dur: 6000 });
    return null;
  });

  O.boats = { setBoat: setBoat, applyOps: applyOps };
})();
