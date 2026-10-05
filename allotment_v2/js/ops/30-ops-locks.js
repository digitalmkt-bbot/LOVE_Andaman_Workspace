/* ══════════════════════════════════════════════════════════════════════════
   §opsLocks (2026-10-05) · Seat Locks ⇄ /v1/seat-locks
   ──────────────────────────────────────────────────────────────────────────
   GET  /v1/seat-locks                → SB_SEAT_LOCKS (one day lock per server lock)
   POST /v1/seat-locks                ← a lock (or one departure of a bulk lock) is new
   PATCH /v1/seat-locks/{id}          ← seats or holder changed
   POST /v1/seat-locks/{id}/release   ← released / expired / round released / deleted

   The shapes don't match one-to-one, decided 2026-10-05:
     · server lock = ONE route + ONE date. A client bulk lock (dateFrom..dateTo
       filtered by weekday) becomes one server lock PER DEPARTURE from today on,
       remembered as lock.opsIds = {date: serverId}.
     · sub-group children are carved out of their parent's seats, so they are
       not sent · draws from a child go to the parent's server lock.
     · pending seats reserve nothing → server pax = qty − pending (≤0 → none).
     · office / global holders → agent_id null (the server has no other kind).
     · no server field: sub-groups, pending, release cutoff, expiry date,
       reason, log. They live on screen for the session only.
     · after a reload every server lock comes back as a single-date lock, so a
       bulk lock reappears as N day locks. Grouping them again needs a group
       field on the server.

   Every lock writer ends in sbSeatLocksPersist(); that is wrapped. The new
   SB_SEAT_LOCKS is diffed against what the server last confirmed. A refused
   change undoes the calls already made and puts SB_SEAT_LOCKS back.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var ready = false;
  var synced = {};          // serverId → {owner: clientLockId, date, route, pax, agent}
  var snap = null;

  function locks(){ return (typeof SB_SEAT_LOCKS !== 'undefined') ? SB_SEAT_LOCKS : null; }
  function isBoat(L){ try{ if(typeof bookingV2IsBoatLock === 'function') return !!bookingV2IsBoatLock(L); }catch(_){} return L && L.scope === 'boat'; }
  function agentOf(L){
    if(L.holderType !== 'agent' || !L.holderId) return null;
    var a = (typeof SB_AGENTS !== 'undefined') ? SB_AGENTS.find(function(x){ return x && x.id === L.holderId; }) : null;
    return a ? a.id : null;     // free-text holder names are not agents
  }
  function pendOn(L, d){
    if(L.scope === 'bulk' || L.scope === 'month') return Math.max(0, +((L.pendBy || {})[d]) || 0);
    return Math.max(0, +L.pendQty || 0);
  }
  function datesOf(L){
    var today = O.today();
    if(L.scope === 'bulk' || L.scope === 'month'){
      var out = [];
      try{ out = bookingV2LockSpecDates(L) || []; }catch(_){}
      var rel = L.releasedDates || [];
      return out.filter(function(d){ return rel.indexOf(d) < 0; });
    }
    // a day lock past its date stays as it is on the server · nothing to change on a finished departure
    return (L.date && L.date >= today) ? [L.date] : [];
  }
  function live(L){ return L.status === 'active' || L.status === 'depleted'; }

  /* clientLockId|date → {L, date, route, pax, agent} */
  function desired(){
    var out = {}, A = locks(); if(!A) return out;
    A.forEach(function(L){
      if(!L || isBoat(L) || L.parentId || !L.routeId || !live(L)) return;
      datesOf(L).forEach(function(d){
        var pax = Math.round((+L.qty || 0) - pendOn(L, d));
        if(pax <= 0) return;
        out[L.id + '|' + d] = { L: L, date: d, route: L.routeId, pax: pax, agent: agentOf(L) };
      });
    });
    return out;
  }

  function snapshot(){ snap = O.clone(locks() || []); }
  function rollback(){
    if(locks() && snap) O.restoreInPlace(locks(), snap);
    if(!O.busy()){ try{ if(O.activeView() === 'booking' && typeof bookingV2Render === 'function') bookingV2Render(); }catch(_){} }
  }

  function create(w){
    var body = { route_id: w.route, service_date: w.date, pax: w.pax };
    if(w.agent) body.agent_id = w.agent;
    return O.post('/v1/seat-locks', body);
  }
  function release(id){ return O.post('/v1/seat-locks/' + encodeURIComponent(id) + '/release'); }
  function amend(id, body){ return O.patch('/v1/seat-locks/' + encodeURIComponent(id), body); }

  function syncNow(){
    if(!ready || !O.enabled()) return Promise.resolve(false);
    var A = locks() || [], want = desired(), ops = [], keep = {};
    var byClient = {}; A.forEach(function(L){ if(L) byClient[L.id] = L; });

    Object.keys(want).forEach(function(k){
      var w = want[k], L = w.L, ids = L.opsIds || {}, id = ids[w.date], had = id && synced[id];
      // a route change or a holder going back to "nobody" can't be a PATCH (agent_id can't be cleared)
      var replace = had && (had.route !== w.route || (had.agent && !w.agent));
      if(had && !replace){
        keep[id] = 1;
        var body = {};
        if(had.pax !== w.pax) body.pax = w.pax;
        if(w.agent && had.agent !== w.agent) body.agent_id = w.agent;
        if(!Object.keys(body).length) return;
        var back = {}; if(body.pax !== undefined) back.pax = had.pax; if(body.agent_id !== undefined && had.agent) back.agent_id = had.agent;
        ops.push({ label: 'lock ' + L.id + ' ' + w.date + ' → ' + JSON.stringify(body),
          run: function(){ return amend(id, body).then(function(){ synced[id] = { owner: L.id, date: w.date, route: w.route, pax: w.pax, agent: w.agent }; }); },
          undo: function(){ return Object.keys(back).length ? amend(id, back) : null; } });
        return;
      }
      ops.push({ label: 'lock ' + L.id + ' new on ' + w.date,
        run: function(){ return create(w).then(function(s){
          (L.opsIds = L.opsIds || {})[w.date] = s.id;
          synced[s.id] = { owner: L.id, date: w.date, route: w.route, pax: w.pax, agent: w.agent };
          keep[s.id] = 1;
          return s; }); },
        undo: function(s){ return s && s.id ? release(s.id) : null; } });
    });

    // whatever the server holds that the screen no longer wants · released last, it can't be undone
    var releases = [];
    Object.keys(synced).forEach(function(id){
      if(keep[id]) return;
      var had = synced[id], L = byClient[had.owner];
      var stillWanted = L && want[L.id + '|' + had.date] && (L.opsIds || {})[had.date] === id;
      if(stillWanted) return;
      if(had.date < O.today() && L && live(L)) return;          // a past departure falling out of the range is not a release
      releases.push({ label: 'release ' + id + ' (' + had.date + ')',
        run: function(){ return release(id).then(function(){
          delete synced[id];
          if(L && L.opsIds && L.opsIds[had.date] === id) delete L.opsIds[had.date];
        }); } });
    });
    ops = ops.concat(releases);
    if(!ops.length) return Promise.resolve(false);

    var syncedBefore = O.clone(synced);
    return O.runBatch(ops).then(function(){ snapshot(); O.wrote('locks'); return true; },
      function(err){ synced = syncedBefore; rollback(); throw err; });
  }
  function sync(){ return O.queue(syncNow).catch(function(e){ O.fail('Seat lock not saved', e); return false; }); }

  var timer = null;
  function schedule(){ if(!ready) return; clearTimeout(timer); timer = setTimeout(sync, 250); }
  function canEdit(){ return typeof window.laCanEditArea !== 'function' || window.laCanEditArea('operations'); }
  (function(){
    var orig = window.sbSeatLocksPersist;
    if(typeof orig !== 'function' || orig.__ops) return;
    var w = function(){ var r = orig.apply(this, arguments); try{ if(O.enabled() && canEdit()) schedule(); }catch(_){} return r; };
    w.__ops = true; window.sbSeatLocksPersist = w;
  })();

  function fromServer(s){
    var drawn = +s.drawn_pax || 0, d = s.service_date;
    var usedBy = {}; if(drawn) usedBy[d] = drawn;
    return {
      id: s.id, scope: 'day', routeId: s.route_id, date: d, month: String(d || '').slice(0, 7), boatId: null,
      holderType: s.agent_id ? 'agent' : 'office', holderId: s.agent_id || null,
      qty: +s.pax || 0, used: drawn, usedBy: usedBy, pendQty: 0,
      reason: '', expiry: '', status: s.status === 'released' ? 'released' : (drawn >= (+s.pax || 0) ? 'depleted' : 'active'),
      createdAt: s.created_at || '', createdBy: '', log: [], opsIds: (function(o){ o[d] = s.id; return o; })({})
    };
  }

  function load(){
    return O.get('/v1/seat-locks').then(function(j){
      var rows = (j && j.seat_locks) || [];
      var A = locks(); if(!A) return;
      A.length = 0;
      synced = {};
      rows.forEach(function(s){
        A.push(fromServer(s));
        if(s.status !== 'released') synced[s.id] = { owner: s.id, date: s.service_date, route: s.route_id, pax: +s.pax || 0, agent: s.agent_id || null };
      });
      ready = true;
      snapshot();
      try{ console.log('[ops] seat locks · ' + rows.length); }catch(_){}
    });
  }

  /* client draw → server lock id · a child draws from its parent's server lock */
  function serverIdFor(lockId, date){
    var A = locks() || [], L = A.find(function(x){ return x && x.id === lockId; }), guard = 0;
    while(L && L.parentId && guard++ < 5) L = A.find(function(x){ return x && x.id === L.parentId; });
    return L && L.opsIds ? (L.opsIds[date] || null) : null;
  }
  /* server lock id on a trip → client lock id (loaded locks share the server id) */
  function clientIdFor(serverId){
    var A = locks() || [];
    var L = A.find(function(x){ return x && x.opsIds && Object.keys(x.opsIds).some(function(d){ return x.opsIds[d] === serverId; }); });
    return L ? L.id : serverId;
  }

  O.locks = { load: load, sync: sync, syncNow: syncNow, serverIdFor: serverIdFor, clientIdFor: clientIdFor, isReady: function(){ return ready; } };
})();
