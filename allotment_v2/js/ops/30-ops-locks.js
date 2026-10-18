/* ══════════════════════════════════════════════════════════════════════════
   §opsLocks (rewritten 2026-10-13) · Seat Locks ⇄ /v1/seat-locks + /v1/seat-lock-groups
   ──────────────────────────────────────────────────────────────────────────
   The server decides; this file sends one command per click and shows what comes back.
   (The first version diffed the whole lock list against the server and could not say "release",
   "pending", "sub-group" or "bulk", so those lived on screen for a session only.)

   READ   GET /v1/seat-locks + GET /v1/seat-lock-groups → SB_SEAT_LOCKS in legacy's shape:
            day lock            one server lock                        scope 'day'
            bulk lock           a group + its departures (one lock a day) scope 'bulk'
            sub-group           a child lock; on a bulk lock one child per name across the days
            whole-boat hold     a lock with boat_id                    scope 'boat'
          Every lock keeps opsIds {date: serverLockId} and the versions {date: n}: a booking's
          lock draw names the server id of that day (serverIdFor), and every write needs If-Match.
   WRITE  each legacy submit handler is replaced (not wrapped): the form is checked for shape
          only, the command goes out, then the list is read again and redrawn. A refusal shows
          the server's message and the list is read again too, so the screen never keeps a guess.
   ASKS   409 seats_short  → legacy's "ที่นั่งว่างไม่พอ" dialog (split / all) → same request + pending
          409 fixed_boat   → legacy's "names a specific boat" confirm → change_boat_anyway
   NOT HERE (the server works them out on every read): expiry sweep, tree/used repair, the
   release cutoff (a warning only), pending seats, what a lock holds.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var ready = false, loading = null, again = false;
  var E = encodeURIComponent;

  function locks(){ return (typeof SB_SEAT_LOCKS !== 'undefined') ? SB_SEAT_LOCKS : null; }
  function agents(){ return (typeof SB_AGENTS !== 'undefined') ? SB_AGENTS : []; }
  function render(){ if(O.busy()) return; try{ if(typeof bookingV2Render === 'function') bookingV2Render(); }catch(_){} }
  function sortBy(a, k){ return a.slice().sort(function(x, y){ return String(x[k]).localeCompare(String(y[k])); }); }

  /* ── server → legacy shape ─────────────────────────────────────────────── */
  function logLine(e){
    return { date: e.day || '', at: e.at || '', type: e.type, qty: e.qty, by: e.by || '', note: e.note || '',
             tripDate: e.trip_date || '', bookingId: e.booking_id || '', imported: !!e.imported };
  }
  function legacyStatus(state){ return state === 'expired' ? 'expired' : state; }   // active depleted expired released converted
  function common(r){
    return { routeId: r.route_id, boatId: null,
      holderType: r.holder_type || (r.agent_id ? 'agent' : 'office'), holderId: r.agent_id || null,
      reason: r.reason || '', expiry: r.expiry || '', createdAt: r.created_at || '', createdBy: r.created_by || '', log: [],
      dateFrom: '', dateTo: '', dow: [], releaseDaysBefore: null, releaseTime: '',
      monthFrom: '', monthTo: '', month: '', pendQty: 0, releasedPax: +r.released_pax || 0 };
  }
  function one(r){
    var d = r.service_date, drawn = +r.drawn_pax || 0, o = common(r);
    o.id = r.id; o.scope = 'day'; o.date = d; o.month = String(d || '').slice(0, 7);
    o.qty = (+r.pax || 0) - (+r.released_pax || 0); o.used = drawn; o.usedBy = {}; if(drawn) o.usedBy[d] = drawn;
    o.pendQty = +r.pending_pax || 0;
    o.status = legacyStatus(r.state || r.status);
    o.opsIds = {}; o.opsIds[d] = r.id; o.opsVers = {}; o.opsVers[d] = r.version; o.opsVersion = r.version;
    srvOf(o, d, r);
    return o;
  }
  /* the server's own numbers for one departure, kept per date (remaining_pax, pending_pax, sub_group_room,
     release_at, overdue): the bookingV2Lock* wrappers below answer from these instead of re-deriving */
  function srvOf(o, d, r){
    if(!o.srv) o.srv = { at: Date.now(), rem: {}, pend: {}, room: {}, relAt: {}, overdue: {} };
    o.srv.rem[d] = +r.remaining_pax || 0; o.srv.pend[d] = +r.pending_pax || 0; o.srv.room[d] = +r.sub_group_room || 0;
    if(r.release_at) o.srv.relAt[d] = r.release_at;
    o.srv.overdue[d] = !!r.overdue;
  }
  function build(rows, groups){
    var depsOf = {}, subsOf = {}, out = [];
    rows.forEach(function(r){
      if(r.parent_id) (subsOf[r.parent_id] = subsOf[r.parent_id] || []).push(r);
      else if(r.group_id) (depsOf[r.group_id] = depsOf[r.group_id] || []).push(r);
    });
    rows.forEach(function(r){
      if(r.group_id || r.parent_id) return;
      if(r.boat_id){
        var h = one(r); h.scope = 'boat'; h.boatId = r.boat_id; h.qty = +r.pax || 0;
        h.subName = r.boat_deal || 'fixed'; h.convertedTo = r.converted_booking_id || null;
        h.status = r.status === 'released' ? 'released' : r.status === 'converted' ? 'converted' : 'active';
        out.push(h); return;
      }
      var L = one(r); out.push(L);
      sortBy(subsOf[r.id] || [], 'created_at').forEach(function(c){
        var k = one(c); k.parentId = L.id; k.subName = c.sub_name || ''; k.holderType = L.holderType; k.holderId = L.holderId;
        k.expiry = L.expiry; out.push(k);
      });
    });
    groups.forEach(function(g){
      var deps = sortBy(depsOf[g.id] || [], 'service_date');
      var G = common(g);
      G.id = g.id; G.scope = 'bulk'; G.date = ''; G.dateFrom = g.date_from; G.dateTo = g.date_to;
      G.dow = (g.weekdays || []).slice(); G.releaseDaysBefore = g.release_days_before; G.releaseTime = g.release_time || '';
      G.departures = g.departures; G.departuresPast = g.departures_past;
      G.isGroup = true; G.opsVersion = g.version; G.opsIds = {}; G.opsVers = {}; G.usedBy = {}; G.pendBy = {}; G.releasedDates = [];
      G.used = 0; G.expiry = '';
      var open = null, anyLeft = false;
      deps.forEach(function(r){
        var d = r.service_date, drawn = +r.drawn_pax || 0;
        G.opsIds[d] = r.id; G.opsVers[d] = r.version; srvOf(G, d, r);
        if(drawn){ G.usedBy[d] = drawn; G.used += drawn; }
        if(+r.pending_pax) G.pendBy[d] = +r.pending_pax;
        if(r.status === 'released') G.releasedDates.push(d);
        else { if(!open) open = r; if(r.state !== 'depleted') anyLeft = true; }
      });
      G.releasedPax = open ? (+open.released_pax || 0) : 0;
      G.qty = open ? (+open.pax || 0) - G.releasedPax : (+g.pax || 0);
      G.status = g.state === 'released' ? 'released' : g.state === 'expired' ? 'expired'
        : (G.used > 0 && open && !anyLeft) ? 'depleted' : 'active';
      out.push(G);
      /* a sub-group of a bulk lock is one child per name across the days */
      var kids = {};
      deps.forEach(function(r){ sortBy(subsOf[r.id] || [], 'created_at').forEach(function(c){
        var key = c.sub_name || ''; var K = kids[key];
        if(!K){
          K = kids[key] = common(c);
          K.id = c.id; K.scope = 'bulk'; K.date = ''; K.parentId = G.id; K.subName = key;
          K.dateFrom = G.dateFrom; K.dateTo = G.dateTo; K.dow = G.dow.slice(); K.releaseDaysBefore = G.releaseDaysBefore; K.releaseTime = G.releaseTime;
          K.holderType = G.holderType; K.holderId = G.holderId; K.expiry = '';
          K.qty = (+c.pax || 0) - (+c.released_pax || 0); K.used = 0; K.usedBy = {}; K.opsIds = {}; K.opsVers = {};
          K.status = legacyStatus(c.state || c.status); K.opsVersion = c.version; out.push(K);
        }
        var drawn = +c.drawn_pax || 0; K.opsIds[c.service_date] = c.id; K.opsVers[c.service_date] = c.version; srvOf(K, c.service_date, c);
        if(drawn){ K.usedBy[c.service_date] = drawn; K.used += drawn; }
      }); });
    });
    return out;
  }

  /* ── read ─────────────────────────────────────────────────────────────── */
  function load(){
    if(loading){ again = true; return loading; }
    // w5-a: CS's embed token may read /v1/seat-locks but not the groups; the page then shows single locks only
    loading = Promise.all([O.get('/v1/seat-locks'), window.__laEmbedToken ? Promise.resolve(null) : O.get('/v1/seat-lock-groups')]).then(function(a){
      var A = locks(); if(!A) return;
      var next = build((a[0] && a[0].seat_locks) || [], (a[1] && a[1].seat_lock_groups) || []);
      A.length = 0; Array.prototype.push.apply(A, next);
      ready = true;
      markHolds();
      try{ console.log('[ops] seat locks · ' + next.length); }catch(_){}
    }).then(function(){ loading = null; if(again){ again = false; return load(); } }, function(e){ loading = null; again = false; throw e; });
    return loading;
  }
  /* a whole-boat hold shows on Boat Operation as legacy's charter-looking cell with boatLockId */
  function markHolds(){
    var A = locks(), T = (typeof TRIPS !== 'undefined') ? TRIPS : null; if(!A || !T) return;
    A.forEach(function(l){
      if(!l || l.scope !== 'boat' || l.status !== 'active' || !l.boatId || !l.date) return;
      var cell = T[l.date] && T[l.date][l.boatId];
      if(!cell || cell.charterBookingId) return;
      cell.type = 'charter'; cell.boatLockId = l.id;
    });
  }
  function reload(){ return load().then(function(){ O.wrote('locks'); render(); }, function(e){ try{ console.warn('[ops] seat locks reload · ' + (e && e.message)); }catch(_){} }); }
  var soon = null;
  function reloadSoon(){ clearTimeout(soon); soon = setTimeout(function(){ if(O.enabled() && ready) reload(); }, 400); }
  // a booking saved or cancelled (a draw or a return) or another desk's change → the numbers moved
  O.onWrite(function(kind){ if(kind === 'booking' || String(kind).indexOf('remote:') === 0) reloadSoon(); });

  /* ── helpers for a write ──────────────────────────────────────────────── */
  function find(id){ var A = locks() || []; return A.find(function(x){ return x && x.id === id; }); }
  function ver(L, date){ return (L.opsVers && date && L.opsVers[date] != null) ? L.opsVers[date] : L.opsVersion; }
  function W(method, path, version, body){
    return O.call(method, path, body === undefined ? {} : body, version != null ? { 'If-Match': '"' + version + '"' } : {});
  }
  function agentIdByName(name){
    var nm = String(name || '').trim().toLowerCase();
    var a = agents().find(function(x){ return x && String(x.name || '').toLowerCase() === nm; });
    return a ? a.id : null;
  }
  /* the form's holder → body fields · the server takes an agent, never free text */
  function holder(f){
    if(f.holderType !== 'agent') return { ok: true, body: { holder_type: f.holderType === 'global' ? 'global' : 'office' } };
    var nm = String(f.holderName || '').trim();
    if(!nm){ alert('Type the agent that holds the lock'); return { ok: false }; }
    var id = agentIdByName(nm);
    if(!id){ alert('"' + nm + '" is not an agent · pick an agent from the list'); return { ok: false }; }
    return { ok: true, body: { holder_type: 'agent', agent_id: id } };
  }
  /* one command: sent through the write queue, then the list is read again */
  function go(title, send, ask){
    return O.queue(send).then(function(r){ return reload().then(function(){ return r; }); }, function(e){
      if(e && e.code === 'seats_short' && ask){ ask(e); return null; }
      O.fail(title, e);
      return reload().then(function(){ return null; });
    });
  }
  /* legacy's "ที่นั่งว่างไม่พอ" dialog · its split / all buttons resend with pending */
  function askPending(kind, routeId, e, resend){
    var short = ((e.body && e.body.short) || []).map(function(x){ return { date: x.service_date, free: x.free, want: x.want, short: x.short }; });
    _bkV2LkPendAsk = { kind: kind, routeId: routeId, short: short, run: function(mode){ resend(mode); } };
    render();
  }
  function isGroup(L){ return !!(L && L.isGroup); }
  function lockPath(L){ return (isGroup(L) ? '/v1/seat-lock-groups/' : '/v1/seat-locks/') + E(L.id); }
  /* the departures of a bulk sub-group that can still change: today on, one write per day */
  function eachDay(L, fn){
    var today = O.today();
    var days = Object.keys(L.opsIds || {}).filter(function(d){ return d >= today; }).sort();
    return days.reduce(function(p, d){ return p.then(function(){ return fn(L.opsIds[d], L.opsVers[d], d); }); }, Promise.resolve());
  }
  function onBulkChild(L){ return !!(L && L.parentId && L.scope === 'bulk'); }

  /* replace a legacy global · the original runs when the server is not in charge */
  function def(name, fn){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__ops) return;
    var w = function(){ if(!O.enabled() || !ready) return orig.apply(this, arguments); return fn.apply(this, arguments); };
    w.__ops = true; w.__orig = orig; window[name] = w;
  }
  function done(modalFlags){ if(modalFlags) modalFlags(); render(); }

  /* ── create (day or bulk) ─────────────────────────────────────────────── */
  def('bookingV2LockCreateSubmit', function(){
    var f = _bkV2LockForm, bulk = f.scope === 'bulk';
    if(!f.routeId){ alert('เลือกเส้นทางก่อน'); return; }
    if(bulk){
      if(!f.dateFrom){ alert('Pick the first day of the range'); return; }
      if(!f.dateTo){ alert('Pick the last day of the range'); return; }
      if(f.dateTo < f.dateFrom){ alert('The last day cannot be before the first day'); return; }
    } else if(!f.date){ alert('เลือกวันที่'); return; }
    if(!(Number(f.qty) > 0)){ alert('ใส่จำนวนที่นั่งที่จะกันไว้'); return; }
    var h = holder(f); if(!h.ok) return;
    var body = Object.assign({ route_id: f.routeId, pax: Number(f.qty) }, h.body);
    if(f.reason) body.reason = f.reason;
    var path;
    if(bulk){
      path = '/v1/seat-lock-groups';
      body.date_from = f.dateFrom; body.date_to = f.dateTo; body.weekdays = (f.dow || []).slice();
      if(f.releaseDaysBefore !== '' && f.releaseDaysBefore != null && f.releaseTime){
        body.release_days_before = Math.max(0, parseInt(f.releaseDaysBefore, 10) || 0); body.release_time = f.releaseTime;
      }
    } else {
      path = '/v1/seat-locks'; body.service_date = f.date;
      if(f.expiry) body.expiry = f.expiry;
    }
    function after(){ _bkV2LockForm.qty = ''; _bkV2LockForm.reason = ''; _bkV2LockForm.expiry = ''; _bkV2LockModalOpen = false; }
    function send(mode){ return function(){ return O.post(path, mode ? Object.assign({}, body, { pending: mode }) : body); }; }
    function run(mode){ return go('Seat lock not saved', send(mode), ask).then(function(r){ if(r) after(); render(); }); }
    function ask(e){ askPending('create', f.routeId, e, run); }
    return run(null);
  });

  /* ── + seats ──────────────────────────────────────────────────────────── */
  def('bookingV2LockAddSubmit', function(){
    var m = _bkV2AddModal; if(!m) return;
    var n = parseInt(m.add, 10) || 0;
    if(n <= 0){ alert('ใส่จำนวนที่จะเพิ่ม'); return; }
    var L = find(m.lockId); if(!L) return;
    function one1(id, v, mode){
      var b = { pax: n }; if(m.note) b.note = String(m.note); if(mode) b.pending = mode;
      return W('POST', '/v1/seat-locks/' + E(id) + '/add', v, b);
    }
    function run(mode){
      return go('Seats not added', function(){
        if(isGroup(L)) return W('POST', lockPath(L) + '/add', L.opsVersion, Object.assign({ pax: n }, m.note ? { note: String(m.note) } : {}, mode ? { pending: mode } : {}));
        if(onBulkChild(L)) return eachDay(L, function(id, v){ return one1(id, v, mode); });
        return one1(L.id, L.opsVersion, mode);
      }, function(e){ askPending('add', L.routeId, e, run); }).then(function(r){ if(r !== null){ _bkV2AddModal = null; } render(); });
    }
    return run(null);
  });

  /* ── release seats (the modal's number) ───────────────────────────────── */
  def('bookingV2ReleaseModalCommit', function(){
    var m = _bkV2ReleaseModal; if(!m) return;
    var n = Math.min(Math.max(0, m.value | 0), m.max);
    var L = find(m.lockId); _bkV2ReleaseModal = null;
    if(!L || n <= 0){ render(); return; }
    return go('Seats not released', function(){
      if(onBulkChild(L)) return eachDay(L, function(id, v){ return W('POST', '/v1/seat-locks/' + E(id) + '/release', v, { pax: n }); });
      return W('POST', lockPath(L) + '/release', L.opsVersion, { pax: n });
    }).then(render);
  });
  /* the whole lock at once (legacy's Release on a lock with nothing sold) */
  def('bookingV2ReleaseLock', function(lockId, qty){
    var L = find(lockId); if(!L) return;
    var body = (qty == null) ? {} : { pax: qty | 0 };
    return go('Seats not released', function(){
      if(onBulkChild(L)) return eachDay(L, function(id, v){ return W('POST', '/v1/seat-locks/' + E(id) + '/release', v, body); });
      return W('POST', lockPath(L) + '/release', L.opsVersion, body);
    }).then(render);
  });

  /* ── release one round / every overdue lock of a day ──────────────────── */
  def('bookingV2LockReleaseRoundGo', function(lockId, tripDate){
    var L = find(lockId); if(!L) return;
    var seats = (typeof bookingV2LockPoolHold === 'function') ? bookingV2LockPoolHold(L, tripDate) : 0;
    var nm = (typeof bookingV2LockHolderName === 'function') ? bookingV2LockHolderName(L) : '';
    if(!confirm('ปล่อยที่นั่งของรอบนี้คืนเข้า pool\n\n' + nm + ' · ' + tripDate + ' · ' + seats + ' ที่'
      + '\n\nที่นั่งจะกลับไปขายให้ใครก็ได้ทันที' + (L.scope === 'bulk' ? '\nรอบอื่นของล็อกนี้ไม่กระทบ' : '') + '\n\nยืนยัน?')) return;
    var id = (L.opsIds || {})[tripDate]; if(!id) return;
    return go('Round not released', function(){ return W('POST', '/v1/seat-locks/' + E(id) + '/release-departure', ver(L, tripDate)); }).then(render);
  });
  def('bookingV2LockReleaseOverdueGo', function(dateStr){
    var list = bookingV2LockOverdueOn(dateStr); if(!list.length) return;
    var seats = list.reduce(function(a, l){ return a + bookingV2LockPoolHold(l, dateStr); }, 0);
    if(!confirm('ปล่อยที่นั่งของทุกล็อกที่เลยกำหนดในวันนี้\n\n' + dateStr + ' · ' + list.length + ' ล็อก · ' + seats + ' ที่'
      + '\n\nที่นั่งทั้งหมดจะกลับไปขายให้ใครก็ได้ทันที\nล็อกที่ยังไม่ถึงกำหนดไม่กระทบ\n\nยืนยัน?')) return;
    return go('Overdue locks not released', function(){ return O.post('/v1/seat-locks/release-overdue', { service_date: dateStr }); }).then(render);
  });

  /* ── pending seats → held ─────────────────────────────────────────────── */
  def('bookingV2LockPendConfirmGo', function(lockId, date){
    if(typeof laGuardEdit === 'function' && !laGuardEdit('booking')) return;
    var L = find(lockId); if(!L) return;
    var id = (L.opsIds || {})[date]; if(!id) return;
    return O.queue(function(){ return W('POST', '/v1/seat-locks/' + E(id) + '/confirm-pending', ver(L, date)); }).then(function(){ return reload(); }, function(e){
      if(e && e.code === 'no_free_seats') alert('No free seats on this trip yet - the lock stays pending');
      else O.fail('Pending seats not confirmed', e);
      return reload();
    });
  });

  /* ── sub-group ────────────────────────────────────────────────────────── */
  def('bookingV2SubCommit', function(){
    var m = _bkV2SubModal; if(!m) return;
    if(!String(m.name || '').trim()){ alert('Type a sub-group name (e.g. A)'); return; }
    var q = Number(m.qty) || 0; if(q <= 0){ alert('Enter the number of seats for this sub-group'); return; }
    var L = find(m.parentId); if(!L) return;
    var body = { sub_name: String(m.name).trim(), pax: q }; if(m.reason) body.reason = m.reason;
    return go('Sub-group not saved', function(){ return W('POST', lockPath(L) + '/sub-groups', L.opsVersion, body); })
      .then(function(r){ if(r !== null) _bkV2SubModal = null; render(); });
  });

  /* ── edit (day, bulk, sub-group) ──────────────────────────────────────── */
  def('bookingV2LockEditSubmit', function(){
    var id = _bkV2LockEditId, L = find(id);
    if(!L){ _bkV2LockEditId = null; _bkV2LockModalOpen = false; render(); return; }
    var f = _bkV2LockForm, bulk = f.scope === 'bulk';
    if(!f.routeId){ alert('Pick a route first'); return; }
    if(bulk){
      if(!f.dateFrom){ alert('Pick the first day of the range'); return; }
      if(!f.dateTo){ alert('Pick the last day of the range'); return; }
      if(f.dateTo < f.dateFrom){ alert('The last day cannot be before the first day'); return; }
    } else if(!f.date){ alert('Pick a date'); return; }
    var qty = Number(f.qty); if(!(qty > 0)){ alert('Enter the number of seats'); return; }
    var body = {}, str = function(v){ return String(v == null ? '' : v); };
    if(qty !== L.qty) body.pax = qty + (L.releasedPax || 0);
    if(str(f.reason) !== str(L.reason)) body.reason = f.reason || '';
    if(L.parentId){
      if(L.subName != null && f.subName != null && str(f.subName) !== str(L.subName)) body.sub_name = f.subName;
    } else {
      var h = holder(f); if(!h.ok) return;
      if(h.body.holder_type !== L.holderType || (h.body.agent_id || null) !== (L.holderId || null)) Object.assign(body, h.body);
      if(f.routeId !== L.routeId) body.route_id = f.routeId;
      if(bulk){
        var rdb = (f.releaseDaysBefore === '' || f.releaseDaysBefore == null) ? null : Math.max(0, parseInt(f.releaseDaysBefore, 10) || 0);
        if(rdb !== L.releaseDaysBefore || str(f.releaseTime) !== str(L.releaseTime)){ body.release_days_before = rdb; body.release_time = f.releaseTime || null; }
        // the range and weekdays are the server's to refuse (400 server_owned) when they changed
        if(f.dateFrom !== L.dateFrom) body.date_from = f.dateFrom;
        if(f.dateTo !== L.dateTo) body.date_to = f.dateTo;
        if((f.dow || []).join(',') !== (L.dow || []).join(',')) body.weekdays = (f.dow || []).slice();
      } else {
        if(f.date !== L.date) body.service_date = f.date;
        if(str(f.expiry) !== str(L.expiry)) body.expiry = f.expiry || null;
      }
    }
    function close(){ _bkV2LockEditId = null; _bkV2LockModalOpen = false; _bkV2LockForm.qty = ''; _bkV2LockForm.reason = ''; _bkV2LockForm.expiry = ''; }
    if(!Object.keys(body).length){ close(); render(); return; }
    function run(mode){
      var b = mode ? Object.assign({}, body, { pending: mode }) : body;
      return go('Seat lock not saved', function(){
        if(onBulkChild(L)) return eachDay(L, function(i, v){ return W('PATCH', '/v1/seat-locks/' + E(i), v, b); });
        return W('PATCH', lockPath(L), L.opsVersion, b);
      }, function(e){ askPending('edit', body.route_id || L.routeId, e, run); }).then(function(r){ if(r !== null) close(); render(); });
    }
    return run(null);
  });

  /* ── whole-boat holds ─────────────────────────────────────────────────── */
  var HOLD_ASK = { fixed_boat: { flag: 'change_boat_anyway' } };
  function holdBody(f, cap, h){
    var b = Object.assign({ route_id: f.routeId, service_date: f.date, boat_id: f.boatId, pax: cap,
      boat_deal: f.fixed === false ? 'any' : 'fixed', expiry: f.expiry }, h.body);
    if(f.reason != null) b.reason = f.reason;
    return b;
  }
  def('bookingV2BoatLockSubmit', function(){
    var f = _bkBoatForm; if(!f) return;
    if(!f.routeId){ alert('Choose a route'); return; }
    if(!f.date){ alert('Choose a date'); return; }
    if(!f.boatId){ alert('Choose a boat'); return; }
    if(!f.expiry){ alert('Expiry date is required for a whole-boat hold'); return; }
    if(f.expiry > f.date){ alert('Expiry must be on or before the travel date'); return; }
    var cap = Math.max(0, parseInt(f.minCap, 10) || 0);
    if(cap <= 0){ alert('Enter the minimum seats promised'); return; }
    var h = holder(f); if(!h.ok) return;
    var body = holdBody(f, cap, h), L = f.editId ? find(f.editId) : null;
    if(f.editId && !L){ _bkBoatForm = null; render(); return; }
    return go('Whole-boat hold not saved', function(){
      if(!L) return O.post('/v1/seat-locks', body);
      return O.anyway(function(x){ return W('PATCH', '/v1/seat-locks/' + E(L.id), L.opsVersion, Object.assign({}, body, x)); }, HOLD_ASK);
    }).then(function(r){ if(r !== null) _bkBoatForm = null; render(); });
  });
  def('bookingV2BoatLockReleaseGo', function(id){
    var l = find(id); if(!l) return;
    if(typeof window.laGuardEdit === 'function' && !window.laGuardEdit('operations')) return;
    var nm = bookingV2BoatNameOf(l.boatId), cap = bookingV2BoatCapOn(l.boatId, l.date);
    if(!confirm('Release the whole-boat hold?\n\n' + nm + ' (' + cap + ' seats) on ' + l.date
      + '\n\nThe boat goes back into the seat pool immediately and anyone can book it.')) return;
    return go('Hold not released', function(){ return W('POST', '/v1/seat-locks/' + E(l.id) + '/release', l.opsVersion); }).then(render);
  });
  def('bookingV2BoatLockSwapGo', function(id){
    var l = find(id); if(!l) return;
    if(typeof window.laGuardEdit === 'function' && !window.laGuardEdit('operations')) return;
    var free = bookingV2BoatLockPickList(l.date, l.routeId).filter(function(b){ return b.ok && b.id !== l.boatId; });
    if(!free.length){ alert('No other boat is free on this date'); return; }
    var min = bookingV2BoatLockMinCap(l);
    var lines = free.map(function(b, i){ return (i + 1) + ') ' + b.name + ' - ' + b.cap + ' seats' + (b.cap < min ? '  [below promised ' + min + ']' : ''); }).join('\n');
    var n = parseInt(prompt('Swap ' + bookingV2BoatNameOf(l.boatId) + ' to which boat?\n\n' + lines + '\n\nType the number:'), 10);
    if(!n || n < 1 || n > free.length) return;
    var tgt = free[n - 1];
    // a hold that names its boat: the server answers 409 fixed_boat and the confirm below asks (legacy's text)
    return go('Boat not swapped', function(){
      return O.anyway(function(x){ return W('PATCH', '/v1/seat-locks/' + E(l.id), l.opsVersion, Object.assign({ boat_id: tgt.id }, x)); }, HOLD_ASK);
    }).then(render);
  });

  /* "เหมาลำ" · the booking form was opened from a hold; the server turns hold + booking into one
     (POST /v1/seat-locks/{id}/convert, see ops/40-ops-bookings.js saveNow). Legacy's local step
     still runs first: it frees the board cell for the charter. */
  var holdFor = {};      // booking id → the hold it converts
  (function(){
    var orig = window.bookingV2BoatLockOnConvert; if(typeof orig !== 'function' || orig.__ops) return;
    var w = function(lockId, newBk){
      var r = orig.apply(this, arguments);
      if(r && O.enabled() && newBk && newBk.id) holdFor[newBk.id] = lockId;
      return r;
    };
    w.__ops = true; window.bookingV2BoatLockOnConvert = w;
  })();

  /* history · fetched when a lock's page is opened (the list does not carry every line) */
  (function(){
    var orig = window.bookingV2LockManageOpen; if(typeof orig !== 'function' || orig.__ops) return;
    var w = function(id){
      var r = orig.apply(this, arguments);
      var L = find(id);
      if(L && O.enabled() && ready){
        var path = isGroup(L) ? '/v1/seat-lock-groups/' + E(L.id) + '/log' : '/v1/seat-locks/' + E(L.id) + '/log';
        O.get(path).then(function(j){ L.log = ((j && j.events) || []).map(logLine); render(); }, function(){});
      }
      return r;
    };
    w.__ops = true; window.bookingV2LockManageOpen = w;
  })();

  /* what the server works out on every read · the browser's own sweeps would only fight it */
  ['bookingV2LockExpireSweep', 'bookingV2LockFixTree', 'bookingV2LockFixUsed', 'bookingV2LockSweepFixAll', 'bookingV2LockHealRange'].forEach(function(n){
    def(n, function(){ return 0; });
  });

  /* ── legacy's lock rules answered from the server's numbers ────────────────
     A rule is replaced only where the server sent its answer for that lock and date (remaining_pax,
     pending_pax, sub_group_room, release_at, overdue, departures); anywhere else the legacy function runs. */
  function defO(name, fn){
    var o0 = window[name];
    def(name, function(){ return fn.apply(this, [o0].concat([].slice.call(arguments))); });
  }
  function srvAt(l, key, date){ return (l && l.srv && date && l.srv[key] && l.srv[key][date] !== undefined) ? l.srv[key][date] : undefined; }

  /* release cutoff: the server's instant (Asia/Bangkok), not the browser's local clock · CutoffPassed and Overdue derive from it */
  defO('bookingV2LockReleaseCutoff', function(orig, l, tripDate){
    var at = srvAt(l, 'relAt', tripDate);
    return at ? new Date(at) : orig(l, tripDate);
  });
  /* overdue = cutoff passed and still holding: the server's flag; the browser only notices a cutoff that passed after the last read */
  defO('bookingV2LockOverdue', function(orig, l, tripDate){
    var od = srvAt(l, 'overdue', tripDate);
    if(od === undefined) return orig(l, tripDate);
    if(od) return true;
    var rel = Date.parse(srvAt(l, 'relAt', tripDate) || '');
    return (rel && l.srv.at < rel && Date.now() >= rel) ? orig(l, tripDate) : false;
  });
  /* a whole-boat hold: overdue is the server's flag (past its expiry, Asia/Bangkok) */
  defO('bookingV2BoatLockOverdue', function(orig, l, today){
    var od = l && l.scope === 'boat' ? srvAt(l, 'overdue', l.date) : undefined;
    return od === undefined ? orig(l, today) : od;
  });
  /* which bulk locks cover a day: the ones the server made a departure for (route runs, weekday ticked, in range) */
  defO('bookingV2LocksFor', function(orig, routeId, date){
    return orig(routeId, date).filter(function(l){ return !(l.isGroup && l.opsIds && Object.keys(l.opsIds).length && !l.opsIds[date]); });
  });
  /* seats a booking may draw: the server's remaining_pax (a parent's = its seats in no sub-group, pending-aware) */
  ['bookingV2LockRemaining', 'bookingV2LockUnallocDrawable', 'bookingV2LockDrawable'].forEach(function(n){
    defO(n, function(orig, l, date){
      var r = srvAt(l, 'rem', date);
      return r === undefined ? orig(l, date) : r;
    });
  });
  /* a sub-group's own pending seats (its parent holds fewer seats than it was asked for) */
  defO('bookingV2LockSubPend', function(orig, c, date){
    var p = srvAt(c, 'pend', date);
    return (c && c.parentId && p !== undefined) ? p : orig(c, date);
  });
  /* who gets the held seats first: the server's split per sub-group and for the unsplit rest */
  defO('bookingV2LockSubShares', function(orig, p, date){
    var kids = SB_SEAT_LOCKS.filter(function(x){ return x.parentId === p.id; });
    var ok = srvAt(p, 'rem', date) !== undefined && kids.every(function(c){ return srvAt(c, 'rem', date) !== undefined; });
    if(!ok) return orig(p, date);
    var by = {};
    kids.forEach(function(c){
      var rem = Math.max(0, (c.qty || 0) - bookingV2LockUsedOn(c, date)), held = srvAt(c, 'rem', date);
      by[c.id] = { rem: rem, held: held, pend: Math.max(0, rem - held) };
    });
    var urem = Math.max(0, bookingV2LockUnalloc(p) - bookingV2LockUsedOn(p, date)), uh = srvAt(p, 'rem', date);
    return { by: by, un: { rem: urem, held: uh, pend: Math.max(0, urem - uh) } };
  });
  /* room left for a new sub-group: the server's sub_group_room (a bulk lock: the tightest day still ahead) */
  defO('bookingV2LockSubRoom', function(orig, p){
    if(!p || !p.srv) return orig(p);
    var today = O.today(), v = Object.keys(p.srv.room).filter(function(d){ return d >= today; }).map(function(d){ return p.srv.room[d]; });
    if(!v.length) v = Object.keys(p.srv.room).map(function(d){ return p.srv.room[d]; });
    return v.length ? Math.min.apply(null, v) : orig(p);
  });
  /* "x of y rounds gone": the group's departures and departures_past */
  defO('bookingV2LockRounds', function(orig, l){
    var G = l && (l.isGroup ? l : (l.parentId ? find(l.parentId) : null));
    return (G && G.isGroup && G.departures != null) ? { total: +G.departures || 0, past: +G.departuresPast || 0 } : orig(l);
  });
  /* the server works out drawn_pax from live draws: nothing drifts, so nothing is audited or swept here */
  defO('bookingV2LockAudit', function(orig, l){
    var a = orig(l); if(a){ a.live = a.used; a.diff = 0; } return a;
  });
  defO('bookingV2LockAuditTree', function(orig, p){
    var a = orig(p); if(a){ a.live = a.used; a.diff = 0; a.bad = 0; } return a;
  });
  defO('bookingV2LockSweep', function(orig){
    return { rows: [], over: [], locks: (locks() || []).length, nBad: 0, nOver: 0, seats: 0, seatsMoved: 0, seatsDead: 0, seatsOver: 0 };
  });
  /* seats held off sale on a route-day: locked_pax from GET /v1/availability when that day is in hand */
  defO('bookingV2LockedTotal', function(orig, routeId, date){
    var s = O.availability && O.availability.get ? O.availability.get(routeId, date) : null;
    if(O.availability && O.availability.ensure && /^\d{4}-\d{2}-\d{2}$/.test(date || '')) O.availability.ensure(date);
    return (s && s.locked_pax != null) ? (+s.locked_pax || 0) : orig(routeId, date);
  });

  /* ── the boat list of a whole-boat hold: GET /v1/seat-locks/boat-options ─────
     The form asks synchronously, the server answers later: the first ask starts the read and the legacy list
     shows; when the answer lands the form is drawn again with the server's ok / why per boat, and CanTake
     answers from it. A write (or 30 seconds) drops what was read. */
  var boatOpt = {}, BOAT_OPT_TTL = 30000;
  function boatOptKey(date, routeId, exceptId){ return [date || '', routeId || '', exceptId || ''].join('|'); }
  function boatOptFresh(date, routeId, exceptId){
    var e = boatOpt[boatOptKey(date, routeId, exceptId)];
    return (e && e.rows && Date.now() - e.at < BOAT_OPT_TTL) ? e : null;
  }
  O.onWrite(function(){ boatOpt = {}; });
  defO('bookingV2BoatLockPickList', function(orig, date, routeId, exceptId){
    var out = orig(date, routeId, exceptId), e = boatOptFresh(date, routeId, exceptId);
    if(e){
      out.forEach(function(b){
        var s = e.rows[b.id]; if(!s) return;
        b.ok = !!s.ok; b.why = s.why ? (s.why.message || s.why.code || '') : '';
      });
      return out;
    }
    var k = boatOptKey(date, routeId, exceptId);
    if(routeId && date && !(boatOpt[k] && boatOpt[k].busy)){
      boatOpt[k] = { busy: true };
      var q = { route_id: routeId, service_date: date }; if(exceptId) q.lock_id = exceptId;
      O.get('/v1/seat-locks/boat-options', q).then(function(j){
        var rows = {}; ((j && (j.boats || j.options || j.rows)) || (Array.isArray(j) ? j : [])).forEach(function(x){ if(x && x.boat_id) rows[x.boat_id] = x; });
        boatOpt[k] = { rows: rows, at: Date.now() };
        render();
      }, function(){ boatOpt[k] = { busy: false, at: Date.now() }; });
    }
    return out;
  });
  defO('bookingV2BoatLockCanTake', function(orig, date, boatId, routeId, exceptId){
    var e = boatOptFresh(date, routeId, exceptId), s = e && e.rows[boatId];
    return s ? !!s.ok : orig(date, boatId, routeId, exceptId);
  });

  /* ── what the booking code asks of this file ──────────────────────────── */
  /* a draw names the server lock of that day · a sub-group has its own */
  function serverIdFor(lockId, date){
    var L = find(lockId);
    return L && L.opsIds ? (L.opsIds[date] || null) : null;
  }
  /* server lock id on a trip → client lock id */
  function clientIdFor(serverId){
    var A = locks() || [];
    var L = A.find(function(x){ return x && x.opsIds && Object.keys(x.opsIds).some(function(d){ return x.opsIds[d] === serverId; }); });
    return L ? L.id : serverId;
  }
  function holdVersion(bookingId){
    var id = holdFor[bookingId], L = id && find(id);
    return L ? { id: id, version: L.opsVersion } : null;
  }

  O.locks = { load: load, reload: reload, reloadSoon: reloadSoon, markHolds: markHolds,
    syncNow: function(){ return Promise.resolve(false); }, sync: function(){ return Promise.resolve(false); },   // nothing to push: each click is a command
    serverIdFor: serverIdFor, clientIdFor: clientIdFor, holdFor: holdVersion, doneHold: function(bookingId){ delete holdFor[bookingId]; },
    isReady: function(){ return ready; } };
})();
