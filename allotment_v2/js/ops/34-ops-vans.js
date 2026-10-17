/* ════════════════════════════════════════════════════════════════════════
   §opsVans (2026-10-12) · van groups on operation-backend
   ────────────────────────────────────────────────────────────────────────
   GET    /operations/van-groups?service_date=&route_id=  → O.vans.load(date, routeId)
          replaces the day's van fields on the route's local bookings (matched by opsId);
          a booking the server does not list is cleared. Writes only after the server answered.
   POST   /operations/van-groups                          ← a group from ticked rows, or a van
                                                            for one booking with no group yet
   POST   /operations/van-groups/{id}/members             ← ticked rows join an existing group
   PATCH  /operations/van-groups/{id}  {van_id|pickup_time} ← assign / clear a van · pickup time
   DELETE /operations/van-groups/{id}                     ← disband (204)

   Server first: every write goes through O.queue, and local bookings change only from the
   group the server answered with. A refused write (409/400) shows its code and changes nothing.
   Warnings on an answer (van_in_other_group) are an info toast, not a failure.

   Out of scope in ops mode (refused with a toast, no request, nothing local changes):
   creating/changing split parts. Pickup order, return van, auto-assign, clear route and the group drag order
   are wired below. Return vans on an
   already-split trip are saved per part through `/operations/trip-ops/:trip_id`.
   Legacy mode (!O.enabled()): every wrapped function delegates to the original.

   Group identity: date | routeId | number. Server group ids are kept in memory per that key.
   Client booking ids stay as they are; opsId is used only on the wire.
   Classic script · loads after 08-app.js and js/booking/*.js, before 90-ops-boot.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var BASE = '/operations/van-groups';
  var CLOSED = ['cancelled', 'cancelled_weather', 'rejected'];
  var serverIds = {};     // 'date|routeId|number' -> server group id
  var groupMembers = {};  // server group id -> members as the server lists them (pickup order)
  var groupOrderMap = {}; // 'date::routeId::zone' -> group numbers in the order staff dragged them (display_order)
  var groupInfo = {};     // server group id -> {date, routeId, number, vanId} · read by 35-ops-van-jobs.js
  var originals = {};
  var WRAPPED = ['bookingV2VanGroupSetVan', 'bookingV2AssignVan', 'bookingV2VanGroupSetTime', 'bookingV2VanGroupDisband',
    'bookingV2VanGroupSelected', 'bookingV2VanGroupSave', 'bookingV2VanGroupClearSeq', 'bookingV2VanGroupSetReturn',
    'bookingV2AssignVanReturn', 'bookingV2AssignVanReturnSplit', 'bookingV2SetSplitPickTime', 'bookingV2SetReturnSameVan', 'bookingV2VanSplit',
    'bookingV2VanUnsplit', 'bookingV2VanClearRoute', 'bookingV2VanAutoAssign', 'bookingV2VanGroupHeal',
    'bookingV2GrpOrderAll', 'bookingV2GrpOrderGet', 'bookingV2GrpOrderSet'];
  WRAPPED.forEach(function(n){ if(typeof window[n] === 'function') originals[n] = window[n]; });

  function wrap(name, opsFn){
    var orig = originals[name];
    window[name] = function(){
      if(!O.enabled()) return orig ? orig.apply(this, arguments) : undefined;
      return opsFn.apply(this, arguments);
    };
  }

  function keyOf(date, routeId, num){ return date + '|' + routeId + '|' + num; }
  function serverIdOf(date, routeId, num){ return num ? (serverIds[keyOf(date, routeId, num)] || null) : null; }
  function enc(x){ return encodeURIComponent(x); }
  function failCode(e){ return (e && (e.code || e.status)) || 'error'; }
  function redraw(){ if(typeof bookingV2RenderKeep === 'function') bookingV2RenderKeep(); }

  function notYet(msg){
    O.toast({ kind: 'pending', title: msg, status: 'NOT YET', sub: 'Nothing was changed.', dur: 6000 });
    return null;
  }
  function refuse(title, sub){
    O.toast({ kind: 'error', title: title, status: 'REFUSED', sub: sub || '', dur: 7000 });
    return null;
  }
  function warn(g){
    ((g && g.warnings) || []).forEach(function(w){
      O.toast({ kind: 'neutral', title: 'Van is on another round', status: 'INFO', sub: (w && (w.message || w.code)) || '', dur: 8000 });
    });
  }

  /* ── local booking helpers ── */
  function allBookings(){ return (typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS)) ? SB_BOOKINGS : []; }
  function byOpsId(opsId){ return allBookings().find(function(b){ return b && b.opsId === opsId; }) || null; }
  function byClientId(id){ return allBookings().find(function(b){ return b && b.id === id; }) || null; }
  function isClosed(b){ return CLOSED.indexOf(b.status) >= 0; }
  function zoneOf(b, t){
    if(t.bookingMode === 'charter') return '__CHARTER__';
    return (typeof bookingV2EffZone === 'function') ? (bookingV2EffZone(b, t) || '') : (t.zone || b.pickupZone || '');
  }
  function tripOn(b, date, routeId, zone){
    return (b.trips || []).find(function(t){
      return t && (t.date || '') === date && (t.routeId || '') === routeId && zoneOf(b, t) === zone;
    }) || null;
  }
  function routeOn(b, date, routeId){
    return (b.trips || []).some(function(t){ return t && (t.date || '') === date && (t.routeId || '') === routeId; });
  }
  function clearVan(o, keepTime){
    o.vanGroup = 0; o.vanId = null; o.vanReturnId = null; delete o.vanSeq;
    if(!keepTime) o.pickupTimeFinal = '';
  }

  /* the bookings in one group on this route, day and zone · split parts are flagged, not written */
  function groupRows(date, routeId, zone, num){
    var rows = [];
    allBookings().forEach(function(b){
      if(!b || !tripOn(b, date, routeId, zone)) return;
      var o = (typeof bkOpsRead === 'function' ? bkOpsRead(b, date) : b.ops) || {};
      var split = Array.isArray(o.vanSplits) && o.vanSplits.some(function(s){ return s && +s.vanGroup === num; });
      if(split) rows.push({ b: b, split: true });
      else if(+o.vanGroup === num) rows.push({ b: b, split: false });
    });
    return rows;
  }

  /* one booking as a server member · {member} or {error} */
  function memberOf(b, date, routeId, zone){
    if(isClosed(b)) return { error: 'Cancelled bookings cannot be grouped' };
    if(b.pickupSelf === true) return { error: 'Self-arrive bookings cannot be grouped on operation-backend' };
    if(!zone || zone === 'NoTransfer' || zone === 'NT') return { error: 'NoTransfer bookings cannot be grouped on operation-backend' };
    var t = tripOn(b, date, routeId, zone);
    if(!t || !b.opsId) return { error: 'Booking is not saved to operation-backend yet' };
    if(!t.opsTripId) return { error: 'Trip is not saved to operation-backend yet' };
    return { member: { trip_id: t.opsTripId, idx: 0 } };
  }

  /* members for a group's rows · cancelled rows take no part · {members, bks} or {error} */
  function planMembers(rows, date, routeId, zone){
    var members = [], bks = [];
    for(var i = 0; i < rows.length; i++){
      if(rows[i].split) return { error: 'Split parts are not on operation-backend yet' };
      if(isClosed(rows[i].b)) continue;
      var m = memberOf(rows[i].b, date, routeId, zone);
      if(m.error) return { error: m.error };
      members.push(m.member); bks.push(rows[i].b);
    }
    return { members: members, bks: bks };
  }

  /* put the server's group onto the local bookings of that route and day */
  function applyGroup(date, routeId, g){
    if(!g || g.number == null) return;
    var num = +g.number;
    serverIds[keyOf(date, routeId, num)] = g.id;
    groupInfo[g.id] = { date: date, routeId: routeId, number: num, vanId: g.van_id || null };
    var listed = {};
    (g.members || []).forEach(function(m){ if(m && (+m.idx || 0) === 0) listed[m.booking_id] = true; });
    allBookings().forEach(function(b){
      if(!b || !b.opsId || !routeOn(b, date, routeId)) return;
      var o = (typeof bkOpsRead === 'function' ? bkOpsRead(b, date) : b.ops) || {};
      if(+o.vanGroup === num && !listed[b.opsId]) clearVan(o, true);
    });
    (g.members || []).forEach(function(m){
      if(!m || (+m.idx || 0) !== 0) return;
      var b = byOpsId(m.booking_id);
      if(!b || !routeOn(b, date, routeId)) return;
      var o = bkOpsFor(b, date);
      o.vanGroup = num;
      o.vanId = g.van_id || null;
      o.vanSeq = +m.sequence || 0;
      o.vanReturnId = m.return_van_id || null;
      o.pickupTimeFinal = g.pickup_time || '';
    });
  }

  /* GET the day's groups and replace the route's van fields with them · no write */
  function fetchDay(date, routeId){
    return O.get(BASE, { service_date: date, route_id: routeId }).then(function(j){
      var groups = (j && j.groups) || [];
      var prefix = date + '|' + routeId + '|';
      Object.keys(serverIds).forEach(function(k){ if(k.indexOf(prefix) === 0) delete serverIds[k]; });
      allBookings().forEach(function(b){
        if(!b || !routeOn(b, date, routeId)) return;
        clearVan(bkOpsRead(b, date) || {}, false);
      });
      groups.forEach(function(g){ applyGroup(date, routeId, g); groupMembers[g.id] = g.members || []; });
      /* display_order: the zone's dragged groups, in order; the rest follow by number (client side, as legacy) */
      Object.keys(groupOrderMap).forEach(function(k){ if(k.indexOf(date + '::' + routeId + '::') === 0) delete groupOrderMap[k]; });
      groups.filter(function(g){ return g.display_order != null; })
        .sort(function(a, b){ return a.display_order - b.display_order; })
        .forEach(function(g){ var k = date + '::' + routeId + '::' + g.zone; (groupOrderMap[k] = groupOrderMap[k] || []).push(+g.number); });

      return groups;
    });
  }

  /* loader · queued behind any write still in flight, so it reads what was just saved */
  function load(date, routeId){
    if(!O.enabled()) return Promise.resolve(null);
    return O.queue(function(){ return fetchDay(date, routeId); }).catch(function(e){
      try{ console.warn('[ops] van groups did not load · local van fields kept · ' + (e && e.message)); }catch(_){}
      return null;
    });
  }

  /* one van write for a group: PATCH when the server has the group, else POST it with its members */
  function saveVan(date, routeId, zone, num, members, van){
    var sid = serverIdOf(date, routeId, num);
    var body = null;
    if(!sid){
      body = { service_date: date, route_id: routeId, zone: zone, members: members };
      if(van) body.van_id = van;
    }
    return O.queue(function(){
      return sid ? O.patch(BASE + '/' + enc(sid), { van_id: van || null }) : O.post(BASE, body);
    }).then(function(g){
      applyGroup(date, routeId, g); warn(g); redraw();
      return g;
    }, function(e){
      O.fail('Van not assigned · ' + failCode(e), e);
      return null;
    });
  }

  /* §vanKeep (2026-10-14) · the booking API carries no van fields: they come from the groups above
     (applyGroup). A booking refresh rebuilds bk.ops and each trip's ops from the booking API, so a
     refresh that landed after the groups blanked the day's vans (Van Jobs showed 0 jobs on a day the
     server had 6). take() reads them off a booking before the merge, put() writes them back after,
     onto the same service day only, and never over a value the fresh copy does carry. */
  var VAN_KEYS = ['vanGroup', 'vanId', 'vanSeq', 'vanReturnId'];
  function vanFields(o){
    if(!o || !(+o.vanGroup > 0 || o.vanId)) return null;
    var out = {};
    VAN_KEYS.forEach(function(k){ if(o[k] !== undefined) out[k] = o[k]; });
    return out;
  }
  function firstDate(b){
    var ds = (b.trips || []).map(function(t){ return t && t.date; }).filter(Boolean).sort();
    return ds[0] || '';
  }
  function take(b){
    if(!b) return null;
    var kept = { first: firstDate(b), ops: vanFields(b.ops), trips: {} }, any = !!kept.ops;
    (b.trips || []).forEach(function(t){
      var f = t && t.date !== kept.first ? vanFields(t.ops) : null;
      if(f){ kept.trips[t.date] = f; any = true; }
    });
    return any ? kept : null;
  }
  function putFields(o, f){ Object.keys(f).forEach(function(k){ if(o[k] === undefined) o[k] = f[k]; }); }
  function put(b, kept){
    if(!b || !kept) return;
    if(kept.ops && firstDate(b) === kept.first) putFields(b.ops = b.ops || {}, kept.ops);
    (b.trips || []).forEach(function(t){
      if(t && t.date !== kept.first && kept.trips[t.date]) putFields(t.ops = t.ops || {}, kept.trips[t.date]);
    });
  }

  /* ── loader ── */
  O.vans = { load: load, serverIdOf: serverIdOf, groupInfo: function(id){ return groupInfo[id] || null; }, take: take, put: put };

  /* ── writes ── */
  wrap('bookingV2VanGroupSetVan', function(date, routeId, zone, gid, vanId){
    var num = +gid;
    if(!num) return refuse('Van not assigned', 'No group selected');
    var rows = groupRows(date, routeId, zone, num);
    var plan = planMembers(rows, date, routeId, zone);
    if(plan.error) return refuse('Van not assigned', plan.error);
    if(!plan.members.length && !serverIdOf(date, routeId, num)) return null;
    return saveVan(date, routeId, zone, num, plan.members, vanId || null);
  });

  // a booking with a group → its group's van (the server holds the van per group) · no group → a group of its own
  wrap('bookingV2AssignVan', function(bkId, vanId, date){
    var b = byClientId(bkId); if(!b) return null;
    var d = date || ((b.trips || [])[0] || {}).date || '';
    var t = (b.trips || []).find(function(x){ return x && (x.date || '') === d; });
    if(!t) return refuse('Van not assigned', 'Booking has no trip on ' + d);
    var routeId = t.routeId, zone = zoneOf(b, t);
    var o = (typeof bkOpsRead === 'function' ? bkOpsRead(b, d) : b.ops) || {};
    if(Array.isArray(o.vanSplits) && o.vanSplits.length) return refuse('Split parts are not on operation-backend yet');
    var num = +o.vanGroup || 0;
    if(num){
      var plan = planMembers(groupRows(d, routeId, zone, num), d, routeId, zone);
      if(plan.error) return refuse('Van not assigned', plan.error);
      return saveVan(d, routeId, zone, num, plan.members, vanId || null);
    }
    var m = memberOf(b, d, routeId, zone);
    if(m.error) return refuse('Van not assigned', m.error);
    if(!vanId) return null;
    return saveVan(d, routeId, zone, 0, [m.member], vanId);
  });

  wrap('bookingV2VanGroupSetTime', function(date, routeId, zone, gid, val){
    var num = +gid;
    var sid = serverIdOf(date, routeId, num);
    if(!sid) return refuse('Pickup time not saved', 'The van group is not on operation-backend yet · reload the day');
    if(groupRows(date, routeId, zone, num).some(function(r){ return r.split; })) return refuse('Split parts are not on operation-backend yet');
    var t = (val || '').trim();
    return O.queue(function(){ return O.patch(BASE + '/' + enc(sid), { pickup_time: t || null }); }).then(function(g){
      applyGroup(date, routeId, g); warn(g);
      return g;
    }, function(e){
      O.fail('Pickup time not saved · ' + failCode(e), e);
      return null;
    });
  });

  wrap('bookingV2VanGroupDisband', function(date, routeId, zone, gid){
    var num = +gid;
    var sid = serverIdOf(date, routeId, num);
    if(!sid) return refuse('Disband not done', 'The van group is not on operation-backend yet · reload the day');
    var rows = groupRows(date, routeId, zone, num);
    if(rows.some(function(r){ return r.split; })) return refuse('Split parts are not on operation-backend yet');
    return O.queue(function(){ return O.del(BASE + '/' + enc(sid)); }).then(function(){
      delete serverIds[keyOf(date, routeId, num)];
      rows.forEach(function(r){ clearVan(bkOpsRead(r.b, date) || {}, true); });
      redraw();
      return true;
    }, function(e){
      O.fail('Disband not done · ' + failCode(e), e);
      return null;
    });
  });

  // ticked rows → one group (or into an existing group of the server) · members only, in tick order
  wrap('bookingV2VanGroupSelected', function(date, routeId, zone, groupId){
    var sel = window._bkV2VanSel || {};
    var keys = Object.keys(sel).filter(function(k){ return sel[k]; });
    if(!keys.length) return null;
    if(keys.some(function(k){ return String(k).indexOf('@') >= 0; })) return refuse('Split parts are not on operation-backend yet');
    var ordered = keys.slice().sort(function(a, b){ return (sel[a] || 0) - (sel[b] || 0); });
    var members = [];
    for(var i = 0; i < ordered.length; i++){
      var b = byClientId(ordered[i]);
      if(!b || !tripOn(b, date, routeId, zone)) return refuse('Group not created', 'Tick rows of one zone and one route, then group them');
      var m = memberOf(b, date, routeId, zone);
      if(m.error) return refuse('Group not created', m.error);
      members.push(m.member);
    }
    var num = (groupId === 'new') ? 0 : +groupId;
    var sid = serverIdOf(date, routeId, num);
    return O.queue(function(){
      var p = sid
        ? O.post(BASE + '/' + enc(sid) + '/members', { members: members })
        : O.post(BASE, { service_date: date, route_id: routeId, zone: zone, members: members });
      return p.then(function(g){
        applyGroup(date, routeId, g); warn(g);
        // members may have moved out of other groups on the server · re-read the day
        return fetchDay(date, routeId).catch(function(e){
          try{ console.warn('[ops] van groups re-read failed · ' + (e && e.message)); }catch(_){}
        }).then(function(){ return g; });
      });
    }).then(function(g){
      ordered.forEach(function(k){ delete window._bkV2VanSel[k]; });
      redraw();
      return g;
    }, function(e){
      O.fail('Group not created · ' + failCode(e), e);
      return null;
    });
  });

  /* ── commands on a whole group or route-day · each asks the server, then reads the day again ── */
  function dayCmd(title, date, routeId, send){
    return O.queue(function(){ return send().then(function(){ return fetchDay(date, routeId); }); }).then(function(){
      redraw();
    }, function(e){
      O.fail(title + ' · ' + failCode(e), e);
      redraw();
      return null;
    });
  }
  function groupSid(title, date, routeId, gid){
    var sid = serverIdOf(date, routeId, +gid);
    if(!sid) refuse(title, 'This group is not on operation-backend yet');
    return sid;
  }
  wrap('bookingV2VanAutoAssign', function(date, routeId){
    return dayCmd('Auto-assign not done', date, routeId, function(){
      return O.post('/operations/van-days/' + enc(date) + '/auto-assign', { route_id: routeId }).then(function(r){
        var n = r && r.assigned ? r.assigned.length : 0, un = r && r.unassigned ? r.unassigned.length : 0;
        O.toast({ kind: 'neutral', title: 'Auto-assign: ' + n + ' group(s) got a van', status: un ? 'PARTIAL' : 'DONE', sub: un ? (un + ' still without a van') : '', dur: 6000 });
      });
    });
  });
  wrap('bookingV2VanClearRoute', function(date, routeId){
    var rows = (typeof baSeatBookingsForRoute === 'function') ? baSeatBookingsForRoute(date, routeId).filter(function(r){
      var o = bkOpsRead(r.b, date) || {}; return o.vanId; }) : [];
    if(!rows.length) return null;
    if(!confirm('Clear van assignments for this program on ' + date + '? (' + rows.length + ' booking(s))')) return null;
    return dayCmd('Vans not cleared', date, routeId, function(){ return O.post(BASE + '/clear', { service_date: date, route_id: routeId }); });
  });
  wrap('bookingV2VanGroupSetReturn', function(date, routeId, zone, gid, vanId){
    var sid = groupSid('Return van not set', date, routeId, gid); if(!sid) return null;
    return dayCmd('Return van not set', date, routeId, function(){ return O.patch(BASE + '/' + enc(sid), { return_van_id: vanId || null }); });
  });
  wrap('bookingV2VanGroupClearSeq', function(date, routeId, zone, gid){
    var sid = groupSid('Pickup order not cleared', date, routeId, gid); if(!sid) return null;
    return dayCmd('Pickup order not cleared', date, routeId, function(){ return O.call('PUT', BASE + '/' + enc(sid) + '/order', { clear: true }); });
  });
  /* the rows ticked in the group, in tick order, take places 1..k; the group's other members follow in the order they had */
  wrap('bookingV2VanGroupSave', function(date){
    var sel = window._bkV2VanSel || {};
    var keys = Object.keys(sel).filter(function(k){ return sel[k]; });
    if(!keys.length) return null;   // nothing ticked: legacy only persisted, and ops mode persists nothing locally
    keys.sort(function(a, b){ return (sel[a] || 0) - (sel[b] || 0); });
    var perGroup = {}, routeOf = {}, bad = null;
    keys.forEach(function(key){
      var p = String(key).split('@'), b = byClientId(p[0]);
      if(!b) return;
      if(p.length > 1){ bad = 'A split part cannot be ordered here: split parts are not on operation-backend yet'; return; }
      var o = (typeof bkOpsRead === 'function' ? bkOpsRead(b, date) : b.ops) || {};
      var t = tripOpsOf(b, date);
      var num = +o.vanGroup || 0;
      if(!num || !t){ bad = 'Pick the rows of a van group that is saved to operation-backend'; return; }
      (perGroup[num] = perGroup[num] || []).push({ trip_id: t.opsTripId, idx: 0 });
      routeOf[num] = t.routeId;
    });
    if(bad) return refuse('Pickup order not saved', bad);
    var jobs = Object.keys(perGroup).map(function(n){
      var sid = serverIdOf(date, routeOf[n], +n);
      if(!sid) return null;
      var seen = {};
      perGroup[n].forEach(function(r){ seen[r.trip_id + '#' + r.idx] = true; });
      var rest = (groupMembers[sid] || []).filter(function(m){ return !seen[m.trip_id + '#' + m.idx]; }).map(function(m){ return { trip_id: m.trip_id, idx: +m.idx }; });
      return { routeId: routeOf[n], sid: sid, members: perGroup[n].concat(rest) };
    });
    if(jobs.some(function(j){ return !j; })) return refuse('Pickup order not saved', 'A group here is not on operation-backend yet');
    window._bkV2VanSel = {};
    return O.queue(function(){
      return jobs.reduce(function(p, j){ return p.then(function(){ return O.call('PUT', BASE + '/' + enc(j.sid) + '/order', { members: j.members }); }); }, Promise.resolve())
        .then(function(){ return Promise.all(jobs.map(function(j){ return fetchDay(date, j.routeId); })); });
    }).then(function(){ redraw(); }, function(e){ O.fail('Pickup order not saved · ' + failCode(e), e); redraw(); });
  });

  /* ── group drag order · bookingV2GrpOrderGet/Set/All read and write the groups' display_order ──
     PUT /operations/van-groups/order {service_date, route_id, zone, group_ids | clear:true}. The screen redraws at
     once from the cache; a refused save puts the old order back. */
  function ordKey(date, routeId, zone){ return String(date || '') + '::' + String(routeId || '') + '::' + String(zone || ''); }
  wrap('bookingV2GrpOrderAll', function(){ return groupOrderMap; });
  wrap('bookingV2GrpOrderGet', function(date, routeId, zone){
    var a = groupOrderMap[ordKey(date, routeId, zone)];
    return Array.isArray(a) ? a.slice() : [];
  });
  wrap('bookingV2GrpOrderSet', function(date, routeId, zone, arr){
    if(typeof window.laCanEditArea === 'function' && !window.laCanEditArea('operations')) return false;
    var list = (arr || []).map(Number).filter(function(n){ return n > 0; });
    var ids = list.map(function(n){ return serverIdOf(date, routeId, n); });
    if(ids.some(function(x){ return !x; })){ refuse('Group order not saved', 'A group here is not on operation-backend yet'); return true; }
    var k = ordKey(date, routeId, zone), before = groupOrderMap[k];
    if(list.length) groupOrderMap[k] = list; else delete groupOrderMap[k];
    var body = { service_date: date, route_id: routeId, zone: zone };
    if(list.length) body.group_ids = ids; else body.clear = true;
    O.queue(function(){ return O.call('PUT', BASE + '/order', body); }).then(function(){}, function(e){
      if(before) groupOrderMap[k] = before; else delete groupOrderMap[k];
      O.fail('Group order not saved · ' + failCode(e), e);
      redraw();
    });
    return true;
  });

  /* ── refused in ops mode: not on operation-backend yet ── */
  /* ── return vans (per booking, legacy design) ──
     A booking's return van is its trip part's return_van_id: PATCH /operations/trip-ops/{trip_id} with van_parts.
     The part keeps its passengers, group and order, which the server reads back from the booking first.
     A split trip (more than one part) is refused here. */
  function tripOpsOf(b, date){
    var t = (b.trips || []).find(function(x){ return x && (x.date || '') === date && x.opsTripId; });
    return t || null;
  }
  function tripPatch(b, date, body, onDone, title){
    title = title || 'Return van not set';
    var t = tripOpsOf(b, date);
    if(!b.opsId || !t) return refuse(title, 'This booking has no operation-backend trip for ' + date);
    var tid = t.opsTripId;
    return O.queue(function(){
      if(body.van_parts === undefined) return O.call('PATCH', '/operations/trip-ops/' + enc(tid), body);
      var changes = {};
      var picks = {};
      body.van_parts.forEach(function(x){
        if(Object.prototype.hasOwnProperty.call(x, 'pick_time')) picks[+x.idx] = x.pick_time;
        else changes[+x.idx] = x.return_van_id || null;
      });
      return O.get('/v1/bookings/' + enc(b.opsId)).then(function(bk){
        var trip = ((bk && bk.trips) || []).find(function(x){ return x && x.id === tid; });
        var parts = (trip && trip.operations && trip.operations.van_parts) || [];
        var seen = {};
        var full = parts.map(function(p){
          var idx = +p.idx; seen[idx] = true;
          var row = { idx: idx, ad: p.ad, chd: p.chd, inf: p.inf, foc: p.foc,
            group_id: p.group ? p.group.id : null, sequence: p.sequence == null ? null : p.sequence,
            return_van_id: Object.prototype.hasOwnProperty.call(changes, idx) ? changes[idx] : (p.return_van_id || null) };
          if(Object.prototype.hasOwnProperty.call(picks, idx)) row.pick_time = picks[idx];   // only the part being timed; the server refuses a part with no pickup of its own
          return row;
        });
        if(Object.keys(changes).concat(Object.keys(picks)).some(function(idx){ return !seen[idx]; })){ var e = new Error('The selected split part no longer exists'); e.code = 'part_missing'; throw e; }
        return O.call('PATCH', '/operations/trip-ops/' + enc(tid), { van_parts: full });
      });
    }).then(function(j){ onDone(j); redraw(); return j; }, function(e){
      if(e && e.code === 'part_missing') return refuse(title, e.message);
      O.fail(title + ' · ' + failCode(e), e);
      return null;
    });
  }
  wrap('bookingV2AssignVanReturn', function(bkId, vanId, date){
    var b = byClientId(bkId); if(!b) return null;
    if(isClosed(b)) return refuse('Return van not set', 'This booking is ' + b.status);
    var d = date || (b.trips && b.trips[0] && b.trips[0].date) || '';
    return tripPatch(b, d, { van_parts: [{ idx: 0, return_van_id: vanId || null }] }, function(j){
      var o = bkOpsFor(b, d);
      var p = j && j.trip && j.trip.operations && j.trip.operations.van_parts && j.trip.operations.van_parts[0];
      o.vanReturnId = p ? (p.return_van_id || null) : (vanId || null);
      if(vanId) o.returnSameVan = false;
    });
  });
  wrap('bookingV2AssignVanReturnSplit', function(bkId, ai, vanId, date){
    var b = byClientId(bkId); if(!b) return null;
    if(isClosed(b)) return refuse('Return van not set', 'This booking is ' + b.status);
    var d = date || (b.trips && b.trips[0] && b.trips[0].date) || '';
    var o = (typeof bkOpsRead === 'function' ? bkOpsRead(b, d) : b.ops) || {};
    if(!Array.isArray(o.vanSplits) || !o.vanSplits[ai]) return refuse('Return van not set', 'This split part no longer exists');
    return tripPatch(b, d, { van_parts: [{ idx: +ai, return_van_id: vanId || null }] }, function(j){
      var parts = j && j.trip && j.trip.operations && j.trip.operations.van_parts || [];
      var p = parts.find(function(x){ return +x.idx === +ai; });
      if(!p) return;
      o.vanSplits[ai].vanReturnId = p.return_van_id || null;
      if(vanId) o.returnSameVan = false;
    });
  });
  // bookingV2SetSplitPickTime (booking/bookingV2SetSplitPickTime.js): the pickup time of a part picked up somewhere of its own.
  // Saved as that part's pick_time through trip-ops van_parts; a part with no pickup of its own takes the trip's final time (legacy).
  wrap('bookingV2SetSplitPickTime', function(bkId, idx, val, date){
    var b = byClientId(bkId); if(!b) return null;
    var d = date || (b.trips && b.trips[0] && b.trips[0].date) || '';
    var o = (typeof bkOpsRead === 'function' ? bkOpsRead(b, d) : b.ops) || {};
    var sp = Array.isArray(o.vanSplits) ? o.vanSplits[+idx] : null;
    if(typeof bkSplitOwnPick === 'function' && !bkSplitOwnPick(sp)) return window.bookingV2SetPickupFinal(bkId, val, date);
    if(isClosed(b)) return refuse('Pickup time not saved', 'This booking is ' + b.status);
    var t = String(val == null ? '' : val).trim();
    return tripPatch(b, d, { van_parts: [{ idx: +idx, pick_time: t || null }] }, function(j){
      var parts = j && j.trip && j.trip.operations && j.trip.operations.van_parts || [];
      var p = parts.find(function(x){ return +x.idx === +idx; });
      if(sp) sp.pickTime = p && p.alt && p.alt.pick_time != null ? p.alt.pick_time : t;
    }, 'Pickup time not saved');
  });
  wrap('bookingV2SetReturnSameVan', function(bkId, val, date){
    var b = byClientId(bkId); if(!b) return null;
    if(isClosed(b)) return refuse('Same van not set', 'This booking is ' + b.status);
    var d = date || (b.trips && b.trips[0] && b.trips[0].date) || '';
    return tripPatch(b, d, { return_same_van: !!val }, function(j){
      var o = bkOpsFor(b, d);
      o.returnSameVan = !!val;
      if(val) o.vanReturnId = null;   // the server drops every part's own return van when the group comes back on its van
    });
  });
  wrap('bookingV2VanSplit', function(){ return notYet('Split parts are not on operation-backend yet'); });
  wrap('bookingV2VanUnsplit', function(){ return notYet('Split parts are not on operation-backend yet'); });
  // The heal keeps a group's vanId in step with local data. In ops mode the server's groups are the truth
  // (the loader applies them), so the heal does nothing rather than write local-only van fields.
  wrap('bookingV2VanGroupHeal', function(){ return null; });
  // Auto-assign picks vans by itself, which the rules forbid; no screen calls it, but refuse if it is ever wired.

  /* Render hook · the by-trip screen calls this in Van mode. Loads every route's groups for the day once per
     5 seconds (a render inside the window does not re-fetch), then redraws once. Answers the load's promise
     (the same one inside the window), so the van job screens can wait for the groups. */
  var dayLoadedAt = {}, dayLoading = {};
  function loadDay(date){
    if(!O.enabled() || !date) return Promise.resolve(null);
    var now = Date.now();
    if(dayLoadedAt[date] && now - dayLoadedAt[date] < 5000) return dayLoading[date];
    dayLoadedAt[date] = now;
    var routes = (typeof ROUTES !== 'undefined' && Array.isArray(ROUTES)) ? ROUTES : [];
    dayLoading[date] = Promise.all(routes.map(function(r){ return load(date, r.id); })).then(function(){ redraw(); });
    return dayLoading[date];
  }
  window.bookingV2OpsVansDay = loadDay;
  O.vans.loadDay = loadDay;
})();
