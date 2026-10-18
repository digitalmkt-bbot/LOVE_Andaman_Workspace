/* ══════════════════════════════════════════════════════════════════════════
   §opsBopBulk (w5-a, 2026-10-18) · Boat Operation "Swap boats" and "Replace a boat over a date range" ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Legacy changed TRIPS in the browser and the diff-sync (ops/20) then sent one deployment write per cell. Two of the
   bulk forms are one decision each, so the server decides them, in ONE transaction (nothing half done):

     bop2ApplySwap        POST /operations/deployments/swap        {service_date, boat_a, boat_b, remove_anyway?}
                          the two boats trade routes and trip types, each keeping its seats. Past day, charter, whole-boat
                          hold, bookings placed (remove_anyway), other pier: the server refuses with its own message,
                          shown as it is (legacy used alert() for these, so does this).
     bop2ReplacePlan      POST /operations/boat-replacements {dry_run: true}   the day-by-day plan (move / left, and why)
     bop2ApplyReplace     POST /operations/boat-replacements                   moves the days AND the bookings placed on
                          the broken boat, takes the broken boat off the days that cannot be replaced when asked.

   What the browser still does: reads the form, keeps legacy's alerts / confirm / "Done" texts and redraws. It sends
   only the choices the person made (boats, dates, drop yes/no); the plan and every count come from the answer.
   The server's answer is put into TRIPS through O.deployments.adopt (ops/20), so the diff-sync sends nothing more for it;
   the bookings of the changed days are read again (O.bookings.refreshDay).
   One new reason exists that legacy's plan did not have: "closed" (the programme is closed that day, the server's
   route_closed rule); it is shown with the Thai line added to BOP2_RP_WHY below.
   Outside ops mode, and until Boat Operation has loaded from the server, legacy's own functions run unchanged.
   Classic script · after ops/71-ops-boat-operation.js and ops/37-ops-boat-assign.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  function enabled(){ return !!(O.enabled && O.enabled() && O.deployments && O.deployments.isReady && O.deployments.isReady()); }
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsBulk) return;
    var w = function(){
      if(!enabled()) return orig.apply(this, arguments);
      return fn.apply(this, [orig, this].concat([].slice.call(arguments)));
    };
    w.__opsBulk = true; window[name] = w;
  }
  function val(id){ var e = document.getElementById(id); return e ? (e.type === 'checkbox' ? e.checked : e.value) : ''; }
  function boatOf(id){ return (typeof BOATS !== 'undefined' && Array.isArray(BOATS)) ? (BOATS.find(function(b){ return b && b.id === id; }) || null) : null; }
  function closeModal(){ if(typeof window.bop2CloseModal === 'function') window.bop2CloseModal(); }
  function redraw(){ if(typeof window.renderOp === 'function') window.renderOp(); }

  /* the line for the one reason legacy's plan did not have (the const object is shared, adding a key is enough) */
  try{ if(typeof BOP2_RP_WHY !== 'undefined' && !BOP2_RP_WHY.closed) BOP2_RP_WHY.closed = 'โปรแกรมปิดวันนั้น'; }catch(_){}

  /* a refusal the person can overrule: bookings are on the boat (remove_anyway) */
  var RULES = { seats_sold: { flag: 'remove_anyway', ask: function(e){
    // the same question the single Unassign / change-route asks (ops/20 §opsAnyway)
    return e.message.replace(/\. Send remove_anyway.*$/, '') + '\n\nเปลี่ยน/ถอดเรือลำนี้? — booking เหล่านั้นจะถูกติดธง ⚠ ให้จัดเรือใหม่ (หน้าจัดเรือ + Daily Fleet Log)';
  } } };

  /* ── Swap ─────────────────────────────────────────────────────────────── */
  wrap('bop2ApplySwap', function(orig, self){
    var date = val('bop2sw-date'), a = val('bop2sw-a'), b = val('bop2sw-b');
    if(a === b){ alert('Select two different boats'); return; }
    if(typeof window.laGuardEdit === 'function' && !window.laGuardEdit('operations')) return;
    if(typeof window.bop2GuardPast === 'function' && window.bop2GuardPast(date)) return;     // admin passes (decision 49); the server still judges
    return O.queue(function(){
      return O.anyway(function(f){
        return O.post('/operations/deployments/swap', Object.assign({ service_date: date, boat_a: a, boat_b: b }, f));
      }, RULES);
    }).then(function(ans){
      var changes = ((ans && ans.deployments) || []).map(function(d){
        return { date: d.service_date, boat: d.boat_id, route: d.route_id, capacity: d.capacity, type: d.trip_type };
      });
      O.deployments.adopt(changes);
      O.wrote('deployments');
      try{ if(O.bookings && O.bookings.refreshDay) O.bookings.refreshDay(date); }catch(_){}
      closeModal();
      alert('Swapped.');
      redraw();
    }, function(e){
      if(e && e.declined) return;                                   // "Cancel" on the question: nothing was changed
      alert((e && e.message) || 'Could not swap the boats');       // the server's message, as it is
    });
  });

  /* ── Replace a boat over a date range ─────────────────────────────────── */
  var plans = {};      // 'A|B|d1|d2' → { ans } | { loading: true } | { failed: true }
  var timers = {};
  function planKey(A, B, d1, d2){ return [A, B || '', d1, d2].join('|'); }
  O.onWrite(function(){ plans = {}; });
  O.onChange(function(){ plans = {}; });

  function askPlan(A, B, d1, d2){
    var k = planKey(A, B, d1, d2), c = plans[k];
    if(c) return c;
    var body = { from_boat_id: A, from_date: d1, to_date: d2, drop_unplaceable: false, dry_run: true };
    if(B) body.to_boat_id = B;
    plans[k] = { loading: true };
    clearTimeout(timers[k]);
    timers[k] = setTimeout(function(){
      O.queue(function(){ return O.post('/operations/boat-replacements', body); }).then(function(ans){
        if(plans[k] && plans[k].loading) plans[k] = { ans: ans };
        else return;
        if(document.getElementById('bop2rp-prev') && typeof window.bop2ReplacePreview === 'function') window.bop2ReplacePreview();
      }, function(e){
        plans[k] = { failed: true, message: e && e.message };
        try{ console.warn('[ops] replace plan · ' + (e && e.message)); }catch(_){}
      });
    }, 200);
    return plans[k];
  }
  function paxOn(d, boatId){ return (typeof window.baAssignedPax === 'function') ? (window.baAssignedPax(d, boatId) || 0) : 0; }
  /* the server's plan in legacy's shape: move[{d, route, pax}], skip[{d, route, pax, why}] */
  function planFrom(ans, A, B){
    var out = { move: [], skip: [], A: boatOf(A), B: B ? boatOf(B) : null };
    (ans.moved || []).forEach(function(m){ out.move.push({ d: m.service_date, route: m.route_id, pax: paxOn(m.service_date, A) }); });
    // with no replacement boat the server drops every day it may, so its "dropped" holds days legacy lists as skipped (why none)
    [].concat(ans.skipped || [], ans.dropped || []).forEach(function(s){ out.skip.push({ d: s.service_date, route: s.route_id, pax: paxOn(s.service_date, A), why: s.why }); });
    out.skip.sort(function(x, y){ return x.d < y.d ? -1 : x.d > y.d ? 1 : 0; });
    return out;
  }
  wrap('bop2ReplacePlan', function(orig, self, fromId, toId, d1, d2){
    if(!fromId || !d1 || !d2 || d2 < d1) return orig.apply(self, [].slice.call(arguments, 2));
    var c = askPlan(fromId, toId, d1, d2);
    if(c && c.ans) return planFrom(c.ans, fromId, toId);
    return orig.apply(self, [].slice.call(arguments, 2));          // legacy's plan until the server's answer is in
  });

  wrap('bop2ApplyReplace', function(orig, self){
    if(typeof window.laGuardEdit === 'function' && !window.laGuardEdit('operations')) return;
    var A = val('bop2rp-from'), B = val('bop2rp-to'), d1 = val('bop2rp-d1'), d2 = val('bop2rp-d2');
    var drop = !B || !!val('bop2rp-drop');
    if(!A){ alert('Pick the boat that broke'); return; }
    if(B && A === B){ alert('Pick two different boats'); return; }
    if(!d1 || !d2 || d2 < d1){ alert('Check the date range'); return; }
    var body = { from_boat_id: A, from_date: d1, to_date: d2, drop_unplaceable: drop };
    if(B) body.to_boat_id = B;
    var btn = document.getElementById('bop2rp-go'); if(btn) btn.disabled = true;
    function free(){ var g = document.getElementById('bop2rp-go'); if(g) g.disabled = false; }
    return O.queue(function(){ return O.post('/operations/boat-replacements', Object.assign({}, body, { dry_run: true })); }).then(function(plan){
      var move = plan.moved || [], dropList = plan.dropped || [], left = plan.skipped || [];
      if(!move.length && !dropList.length){ free(); alert('Nothing to change in this range.'); return null; }
      var an = (plan.from_boat && plan.from_boat.name) || A, bn = (plan.to_boat && plan.to_boat.name) || B;
      if(!confirm((move.length ? ('Move ' + an + ' -> ' + bn + ' on ' + move.length + ' day(s), with its bookings.\n') : '')
        + (dropList.length ? ('Remove ' + an + ' from ' + dropList.length + ' day(s) (no replacement).\n') : '')
        + (left.length > 0 ? ('Leave ' + left.length + ' day(s) as they are.\n') : '')
        + '\nContinue?')){ free(); return null; }
      return O.queue(function(){ return O.post('/operations/boat-replacements', body); }).then(function(done){
        var moved = done.moved || [], dropped = done.dropped || [], nb = 0, dates = {}, changes = [];
        var Bboat = B ? boatOf(B) : null, cap = Bboat ? Math.round(+Bboat.cap || 0) : 0;
        var T = (typeof TRIPS !== 'undefined') ? TRIPS : {};
        moved.forEach(function(m){
          nb += +m.bookings_moved || 0; dates[m.service_date] = 1;
          var cell = T[m.service_date] && T[m.service_date][A];
          changes.push({ date: m.service_date, boat: A, remove: true });
          changes.push({ date: m.service_date, boat: B, route: m.route_id, capacity: cap, type: cell && cell.type });
        });
        dropped.forEach(function(s){ dates[s.service_date] = 1; changes.push({ date: s.service_date, boat: A, remove: true }); });
        O.deployments.adopt(changes);
        O.wrote('deployments');
        Object.keys(dates).forEach(function(d){ try{ if(O.bookings && O.bookings.refreshDay) O.bookings.refreshDay(d); }catch(_){} });
        closeModal();
        var an2 = (done.from_boat && done.from_boat.name) || A, bn2 = (done.to_boat && done.to_boat.name) || B;
        alert('Done. ' + (moved.length ? (moved.length + ' day(s) now on ' + bn2 + ' (' + nb + ' booking(s) moved). ') : '')
          + (dropped.length ? (dropped.length + ' day(s) removed - see the list of trips that need a boat.') : ''));
        redraw();
        return an2;
      });
    }).catch(function(e){
      free();
      O.fail('Boat Operation not saved', e);                        // the server's message, nothing was changed
    });
  });

  O.bopBulk = { plans: function(){ return plans; } };
})();
