/* ════════════════════════════════════════════════════════════════════════
   §opsWeather (2026-10-12) · weather closures, follow-ups, refund and credit on operation-backend
   ────────────────────────────────────────────────────────────────────────
   GET    /v1/weather-closures?from=&to=          → SB_WEATHER_CLOSURES (range replaced, rest kept)
   GET    /v1/weather-closures/{id}               → the follow-up list; mirrored onto local bookings
                                                    as bk.weatherResolve (in memory only, for the
                                                    by-trip inline cell)
   POST   /v1/weather-closures                    → Cancel trip (weather)
   PATCH  /v1/weather-closures/{id}  {note}       → Update note
   POST   /v1/weather-closures/{id}/bookings/{bid}/notify
   POST   /v1/weather-closures/{id}/undo          → Undo cancel · re-open trip (undo_anyway after 409 has_resolved)
   POST   /v1/bookings/{bid}/reschedule           → Reschedule (reason "weather")
   POST   /v1/bookings/{bid}/cancel-weather       → cancel | refund | credit (money is the server's)

   Server first: local closures, follow-ups and bookings change only from what the server answered.
   Money: nothing is computed here; a refund or credit shows the amount the server returned.
   Legacy mode: every wrapper calls the original untouched when !laOps.enabled().
   Not wired: nothing · the legacy weather screen is fully covered (see the report for the
   calendar's inline cell, which is display-only and reads the mirrored follow-up).
   Classic script · loads after 28-ops-nationalities.js, before 90-ops-boot.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  // Legacy originals, captured before anything replaces them.
  var L = {
    cancel: window.bookingV2WeatherCancel,
    markConfirm: window.bookingV2WeatherMarkConfirm,
    uncancel: window.bookingV2WeatherUncancel,
    notify: window.bookingV2WeatherNotify,
    resolveOne: window.bookingV2WeatherResolveOne,
    panel: window.bookingV2WeatherPanel,
    counts: window.bookingV2WeatherCountsFor,
    tag: window.bookingV2WeatherTagBookings
  };

  function enc(x){ return encodeURIComponent(x); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n){ return '฿' + Math.round(+n || 0).toLocaleString(); }
  function routeName(id){ return ((typeof ROUTES !== 'undefined' && ROUTES.find(function(r){ return r.id === id; })) || {}).name || id; }
  function closures(){ return (typeof SB_WEATHER_CLOSURES !== 'undefined' && Array.isArray(SB_WEATHER_CLOSURES)) ? SB_WEATHER_CLOSURES : []; }
  function bookingList(){ return (typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS)) ? SB_BOOKINGS : []; }
  function findClosure(routeId, date){ return closures().find(function(c){ return c && c.routeId === routeId && c.date === date; }); }
  function findBkByOpsId(bid){ return bookingList().find(function(b){ return b && b.opsId === bid; }); }
  function findBkById(id){ return bookingList().find(function(b){ return b && b.id === id; }); }
  function noId(what){ return new Error(what + ' has no operation-backend id · nothing was changed'); }
  function canEdit(){ return typeof window.laCanEditArea !== 'function' || !!window.laCanEditArea('operations'); }
  function viewOnly(){ try{ alert('View only - no permission to edit operations'); }catch(_){} }
  function closeModal(){ try{ if(typeof acctModalClose === 'function') acctModalClose(); }catch(_){} }
  function showModal(html){ if(typeof acctModal === 'function') acctModal(html); }
  function redrawBooking(){ if(typeof bookingV2Render === 'function') bookingV2Render(); }
  function redrawOp(){ if(typeof renderOp === 'function') renderOp(); }

  /* ── read side ── */
  function listRows(j){
    if(Array.isArray(j)) return j;
    return (j && (j.closures || j.weather_closures || j.items)) || [];
  }
  // Server row → the shape the legacy code reads (routeId, date, reason, note, at) plus the server id and tallies.
  function mapClosure(row){
    return { opsId: row.id, routeId: row.route_id, date: row.service_date, reason: 'weather',
             note: row.note || '', at: row.closed_at || '', counts: row.counts || null, pax: row.pax || null };
  }
  // Replace every closure whose date is in [from, to]; closures outside the range stay as they are.
  function setClosures(rows, from, to){
    var list = closures();
    for(var i = list.length - 1; i >= 0; i--){
      var d = list[i] && list[i].date;
      if(!from || !to || (d >= from && d <= to)) list.splice(i, 1);
    }
    rows.forEach(function(r){ if(r && r.id) list.push(mapClosure(r)); });
  }
  function upsertLocal(row){
    if(!row || !row.id) return;
    var m = mapClosure(row), list = closures();
    for(var i = list.length - 1; i >= 0; i--){
      var c = list[i];
      if(c && (c.opsId === m.opsId || (c.routeId === m.routeId && c.date === m.date))) list.splice(i, 1);
    }
    list.push(m);
  }
  function removeLocal(cid){
    var list = closures();
    for(var i = list.length - 1; i >= 0; i--){ if(list[i] && list[i].opsId === cid) list.splice(i, 1); }
  }
  // Mirror the follow-up list onto the local bookings (memory only): the by-trip inline cell reads bk.weatherResolve.
  function syncFollowUps(d){
    var key = d.route_id + '|' + d.service_date, rows = {};
    (d.bookings || []).forEach(function(r){ rows[r.booking_id] = r; });
    bookingList().forEach(function(bk){
      if(!bk) return;
      var r = bk.opsId && rows[bk.opsId];
      if(r){
        bk.weatherResolve = { event: key, status: r.status, outcome: r.outcome || undefined,
          newDate: r.new_date || undefined, notifiedAt: r.notified_at || undefined, resolvedAt: r.resolved_at || undefined };
      } else if(bk.weatherResolve && bk.weatherResolve.event === key){ delete bk.weatherResolve; }
    });
  }
  function load(from, to){
    from = from || O.shift(O.today(), -30);
    to = to || O.shift(O.today(), 120);
    return O.get('/v1/weather-closures', { from: from, to: to }).then(function(j){
      var rows = listRows(j);
      setClosures(rows, from, to);
      return rows;
    });
  }
  function refreshDetail(cid){
    return O.get('/v1/weather-closures/' + enc(cid)).then(function(d){
      upsertLocal(d); syncFollowUps(d); return d;
    });
  }
  // The server id of the closure on a trip · looked up on the server when it is not held locally.
  function closureIdFor(routeId, date){
    var c = findClosure(routeId, date);
    if(c && c.opsId) return Promise.resolve(c.opsId);
    if(c) return Promise.reject(noId('This trip\'s closure'));
    return O.get('/v1/weather-closures', { from: date, to: date, route_id: routeId }).then(function(j){
      var row = listRows(j).find(function(r){ return r && r.route_id === routeId && r.service_date === date; });
      if(!row) return null;
      upsertLocal(row);
      return row.id;
    });
  }

  /* ── the follow-up panel (server list) ── */
  function renderPanel(routeId, date, d){
    var rname = routeName(routeId), cid = d.id;
    var list = d.bookings || [];
    var outLbl = { reschedule: 'Rescheduled', refund: 'Refunded', credit: 'Credit', cancel: 'Cancelled' };
    var nAwait = 0, nNotif = 0, nDone = 0;
    list.forEach(function(b){ if(b.status === 'awaiting') nAwait++; else if(b.status === 'notified') nNotif++; else nDone++; });
    var rows = list.map(function(b){
      var bid = b.booking_id, st = b.status;
      var badge = st === 'awaiting' ? '<span style="background:#F1EFE8;color:#5F5E5A;font-size:9px;font-weight:700;padding:2px 7px;border-radius:6px">To notify</span>'
        : st === 'notified' ? '<span style="background:#FBF0DD;color:#7A4A00;font-size:9px;font-weight:700;padding:2px 7px;border-radius:6px">Notified' + (b.notified_at ? ' · ' + esc(String(b.notified_at).slice(0, 10)) : '') + ' · awaiting</span>'
        : '<span style="background:#E1F5EE;color:#0F6E56;font-size:9px;font-weight:700;padding:2px 7px;border-radius:6px">Resolved</span>';
      var action;
      if(st === 'awaiting'){
        action = '<button data-la-wx="notify" data-cid="' + esc(cid) + '" data-bid="' + esc(bid) + '" style="background:#185FA5;color:#fff;border:none;font-family:inherit;font-size:11px;font-weight:600;padding:7px 13px;border-radius:8px;cursor:pointer;white-space:nowrap">Notify agent</button>';
      } else if(st === 'notified'){
        var canCredit = (+b.refundable || 0) > 0;
        action = '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end">'
          + '<select id="wx-out-' + esc(bid) + '" data-la-wx="out" data-bid="' + esc(bid) + '" style="height:30px;font-size:11px;font-family:inherit;border:1px solid var(--fd-line);border-radius:7px;padding:2px 6px;background:#fff">'
          + '<option value="reschedule">Reschedule</option><option value="refund">Refund</option><option value="credit"' + (canCredit ? '' : ' disabled') + '>Credit</option><option value="cancel">Cancel</option></select>'
          + '<input type="date" id="wx-date-' + esc(bid) + '" value="' + esc(O.shift(date, 1)) + '" style="height:30px;font-size:11px;border:1px solid var(--fd-line);border-radius:7px;padding:2px 6px">'
          + '<button data-la-wx="resolve" data-cid="' + esc(cid) + '" data-bid="' + esc(bid) + '" data-route="' + esc(routeId) + '" data-date="' + esc(date) + '" style="background:#A32D2D;color:#fff;border:none;font-family:inherit;font-size:11px;font-weight:600;padding:7px 13px;border-radius:8px;cursor:pointer">Resolve</button></div>';
      } else {
        var extra = (b.outcome === 'reschedule' && b.new_date) ? (' → ' + esc(b.new_date)) : '';
        action = '<span style="font-size:11.5px;color:#0F6E56;font-weight:600">✓ ' + esc(outLbl[b.outcome] || b.outcome || '') + extra + '</span>';
      }
      var money = (+b.refundable || 0) > 0 ? ('Refundable ' + fmt(b.refundable)) : 'Nothing refundable';
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:0.5px solid var(--fd-line-soft)">'
        + '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:7px;flex-wrap:wrap">'
        + esc(b.voucher_ref || bid) + ' · ' + esc(b.lead_pax || '') + ' ' + badge + '</div>'
        + '<div style="font-size:10.5px;color:var(--fd-ink-soft);margin-top:1px">' + (+b.pax || 0) + ' pax · ' + esc(money)
        + (b.payment_state ? ' · ' + esc(b.payment_state) : '') + '</div></div>'
        + '<div style="flex-shrink:0">' + action + '</div></div>';
    }).join('');
    var body = list.length ? rows : '<div style="font-size:13px;padding:10px 0">No bookings on this trip</div>';
    showModal('<div style="padding:16px 20px;border-bottom:1px solid var(--fd-line);display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:15px;font-weight:700;color:#A32D2D">Manage bookings · trip cancelled (weather)</div><div style="font-size:11px;color:var(--fd-ink-soft)">' + esc(rname) + ' · ' + esc(date) + ' · Steps: notify agent → agent contacts customer → resolve</div></div><button data-la-wx="close" style="background:transparent;border:none;font-size:20px;color:var(--fd-ink-soft);cursor:pointer">✕</button></div>'
      + '<div style="padding:10px 20px;background:#fafaf8;border-bottom:1px solid var(--fd-line-soft);font-size:11px;color:var(--fd-ink-soft)">To notify <b style="color:#5F5E5A">' + nAwait + '</b> · Notified <b style="color:#7A4A00">' + nNotif + '</b> · Resolved <b style="color:#0F6E56">' + nDone + '</b></div>'
      + '<div style="padding:6px 20px 16px">' + body + '<div style="margin-top:14px;text-align:right"><button data-la-wx="close" style="background:#fff;border:1px solid var(--fd-line);color:var(--fd-ink);font-family:inherit;font-size:12px;padding:9px 16px;border-radius:9px;cursor:pointer">Close</button></div></div>');
  }
  function openPanel(routeId, date){
    return closureIdFor(routeId, date).then(function(cid){
      if(!cid){ showModal('<div style="padding:20px;font-size:13px">This trip is not closed on the server<div style="margin-top:14px;text-align:right"><button data-la-wx="close" style="background:var(--fd-coral);color:#fff;border:none;font-family:inherit;font-size:12px;padding:8px 16px;border-radius:9px;cursor:pointer">Close</button></div></div>'); return null; }
      return refreshDetail(cid).then(function(d){ if(d) renderPanel(routeId, date, d); return d; });
    });
  }
  // After a write that the server answered: re-read the closure, then redraw where the person is.
  function afterWrite(cid, inline){
    O.wrote('weather');
    return refreshDetail(cid).then(function(d){
      if(!d) return d;
      if(inline) redrawBooking(); else renderPanel(d.route_id, d.service_date, d);
      return d;
    });
  }

  /* ── writes ── */
  function reloadLocal(bk){
    if(bk && O.bookings && typeof O.bookings.reload === 'function'){
      try{ O.bookings.reload(bk.id).catch(function(){}); }catch(_){}
    }
  }
  function notifyAct(cid, bid, inline){
    return O.queue(function(){ return O.post('/v1/weather-closures/' + enc(cid) + '/bookings/' + enc(bid) + '/notify', {}); })
      .then(function(){ return afterWrite(cid, inline); })
      .catch(function(e){ O.fail('Notify agent failed', e); return null; });
  }
  function toastMoney(j, outcome){
    var refunds = (j && j.refunds) || [];
    var sub = refunds.length ? refunds.map(function(r){ return r.kind + ' ' + fmt(r.amount); }).join(' · ') : 'no refund or credit row';
    O.toast({ kind: 'neutral', title: 'Weather cancel saved · ' + outcome, status: 'OK', sub: sub, dur: 6000 });
  }
  // o: {cid, bid, routeId, date, outcome, newDate, localBk}
  function resolveAct(o, inline){
    var p;
    if(o.outcome === 'reschedule'){
      if(!o.newDate || o.newDate === o.date){
        O.fail('Reschedule needs a different day', new Error('choose a day other than ' + o.date));
        return Promise.resolve(null);
      }
      // §opsHandoff · the server's reschedule moves EVERY trip on the day; legacy moved only the closed route's trip.
      // Refuse here rather than move another route the staff did not touch.
      var others = ((o.localBk && o.localBk.trips) || []).filter(function(t){ return t && t.date === o.date && t.routeId !== o.routeId; });
      if(others.length){
        O.fail('Reschedule refused · booking has other trips that day', new Error('move the other trip(s) on ' + o.date + ' in Booking first, then reschedule this one'));
        return Promise.resolve(null);
      }
      p = O.queue(function(){ return O.bookingWrite('POST', '/v1/bookings/' + enc(o.bid) + '/reschedule', o.localBk,
        { from_date: o.date, to_date: o.newDate, reason: 'weather' }); })
        .then(function(j){ reloadLocal(o.localBk); return j; });
    } else {
      p = O.queue(function(){ return O.bookingWrite('POST', '/v1/bookings/' + enc(o.bid) + '/cancel-weather', o.localBk,
        { outcome: o.outcome }); })
        .then(function(j){ reloadLocal(o.localBk); toastMoney(j, o.outcome); return j; });
    }
    return p.then(function(j){ return afterWrite(o.cid, inline).then(function(){ return j; }); })
      .catch(function(e){ O.fail('Resolve refused · nothing changed', e); return null; });
  }
  // Local booking → its closure and server ids (for the legacy inline cell, which passes local ids).
  function ctxFromLocal(bk){
    if(!bk) return Promise.reject(new Error('booking is not loaded'));
    if(!bk.opsId) return Promise.reject(noId('This booking'));
    var key = bk.weatherResolve && bk.weatherResolve.event;
    if(!key) return Promise.reject(new Error('booking is not on a closed trip'));
    var parts = String(key).split('|');
    return closureIdFor(parts[0], parts[1]).then(function(cid){
      if(!cid) throw new Error('trip is not closed on the server');
      return { cid: cid, bid: bk.opsId, routeId: parts[0], date: parts[1], localBk: bk };
    });
  }

  /* ── legacy entry points, server-first in ops mode ── */
  window.bookingV2WeatherCancel = function(routeId, date){
    if(!O.enabled()) return L.cancel.apply(this, arguments);
    if(!canEdit()) return viewOnly();
    if(findClosure(routeId, date)) return openPanel(routeId, date).catch(function(e){ O.fail('Could not load the follow-up list', e); });
    var rname = routeName(routeId);
    if(!confirm('ยกเลิกทริปนี้เพราะสภาพอากาศ?\n' + rname + ' · ' + date)) return;
    return O.queue(function(){ return O.post('/v1/weather-closures', { route_id: routeId, service_date: date }); })
      .then(function(row){ upsertLocal(row); O.wrote('weather'); return openPanel(routeId, date); })
      .catch(function(e){ O.fail('Cancel trip (weather) refused · nothing changed', e); return null; });
  };

  window.bookingV2WeatherMarkConfirm = function(routeId, date){
    if(!O.enabled()) return L.markConfirm.apply(this, arguments);
    if(!canEdit()) return viewOnly();
    var note = ((document.getElementById('wx-note') || {}).value || '').trim();
    var c = findClosure(routeId, date);
    if(c && !c.opsId){ return O.fail('Update note failed', noId('This closure')); }
    var write = c
      ? O.queue(function(){ return O.patch('/v1/weather-closures/' + enc(c.opsId), { note: note }); }).then(function(){ return c.opsId; })
      : O.queue(function(){ return O.post('/v1/weather-closures', { route_id: routeId, service_date: date, note: note }); })
          .then(function(row){ if(!row || !row.id) throw new Error('server did not return the closure'); upsertLocal(row); return row.id; });
    return write.then(function(cid){ return refreshDetail(cid); })
      .then(function(){
        O.wrote('weather'); closeModal(); redrawOp();
        if(typeof _bkV2 !== 'undefined' && _bkV2 && _bkV2.tab === 'bytrip') redrawBooking();
      })
      .catch(function(e){ O.fail('Cancel trip (weather) refused · nothing changed', e); return null; });
  };

  window.bookingV2WeatherUncancel = function(routeId, date){
    if(!O.enabled()) return L.uncancel.apply(this, arguments);
    if(!canEdit()) return viewOnly();
    var c = findClosure(routeId, date);
    if(!c) return;
    if(!c.opsId) return O.fail('Undo cancel failed', noId('This closure'));
    var rname = routeName(routeId);
    var key = routeId + '|' + date;
    function go(anyway){
      return O.queue(function(){ return O.post('/v1/weather-closures/' + enc(c.opsId) + '/undo', anyway ? { undo_anyway: true } : {}); });
    }
    return go(false).then(function(j){ return { done: j }; }, function(e){
      if(e && e.code === 'has_resolved'){
        if(!confirm('Re-open this trip? (undo the weather cancellation)\n' + rname + ' · ' + date + '\n\n' + e.message + '\n\nUndo anyway? Resolved bookings stay as they are.')) return { declined: true };
        return go(true).then(function(j){ return { done: j }; });
      }
      throw e;
    }).then(function(r){
      if(r.declined) return null;
      removeLocal(c.opsId);
      // the server deleted the follow-up of every unresolved booking on this trip
      bookingList().forEach(function(bk){ if(bk && bk.weatherResolve && bk.weatherResolve.event === key && bk.weatherResolve.status !== 'resolved') delete bk.weatherResolve; });
      O.wrote('weather'); closeModal(); redrawOp(); redrawBooking();
      return r.done;
    }).catch(function(e){ O.fail('Undo cancel refused · nothing changed', e); return null; });
  };

  window.bookingV2WeatherNotify = function(bkId, pfx){
    if(!O.enabled()) return L.notify.apply(this, arguments);
    if(!canEdit()) return viewOnly();
    return ctxFromLocal(findBkById(bkId))
      .then(function(x){ return notifyAct(x.cid, x.bid, pfx === 'wxr-'); })
      .catch(function(e){ O.fail('Notify agent failed', e); return null; });
  };

  window.bookingV2WeatherResolveOne = function(bkId, pfx){
    if(!O.enabled()) return L.resolveOne.apply(this, arguments);
    if(!canEdit()) return viewOnly();
    pfx = pfx || 'wx-';
    return ctxFromLocal(findBkById(bkId)).then(function(x){
      var out = (document.getElementById(pfx + 'out-' + bkId) || {}).value || 'reschedule';
      var nd = (document.getElementById(pfx + 'date-' + bkId) || {}).value || x.date;
      return resolveAct({ cid: x.cid, bid: x.bid, date: x.date, outcome: out, newDate: nd, localBk: x.localBk }, pfx === 'wxr-');
    }).catch(function(e){ O.fail('Resolve refused · nothing changed', e); return null; });
  };

  window.bookingV2WeatherPanel = function(routeId, date){
    if(!O.enabled()) return L.panel.apply(this, arguments);
    return openPanel(routeId, date).catch(function(e){ O.fail('Could not load the follow-up list', e); return null; });
  };

  // Calendar tallies: the server's counts, same keys as legacy (pending is not yet resolved).
  window.bookingV2WeatherCountsFor = function(routeId, date){
    if(!O.enabled()) return L.counts.apply(this, arguments);
    var c = findClosure(routeId, date), p = (c && c.pax) || {};
    return { cancelled: p.cancelled || 0, rescheduled: p.rescheduled || 0, pending: p.pending || 0, total: p.total || 0 };
  };

  // Legacy tagged bookings on open; the server derives the follow-up list now.
  window.bookingV2WeatherTagBookings = function(){
    if(!O.enabled()) return L.tag.apply(this, arguments);
  };

  /* ── delegated handlers for the panel's buttons (inline onclick would need quoted ids) ── */
  if(typeof document !== 'undefined' && document.addEventListener){
    document.addEventListener('click', function(ev){
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-la-wx]') : null;
      if(!t || !O.enabled()) return;
      var act = t.getAttribute('data-la-wx');
      if(act === 'close'){ closeModal(); redrawBooking(); return; }
      if(!canEdit()) return viewOnly();
      var cid = t.getAttribute('data-cid'), bid = t.getAttribute('data-bid');
      if(act === 'notify'){ notifyAct(cid, bid, false); return; }
      if(act === 'resolve'){
        var out = (document.getElementById('wx-out-' + bid) || {}).value || 'reschedule';
        var nd = (document.getElementById('wx-date-' + bid) || {}).value || t.getAttribute('data-date');
        resolveAct({ cid: cid, bid: bid, routeId: t.getAttribute('data-route'), date: t.getAttribute('data-date'),
          outcome: out, newDate: nd, localBk: findBkByOpsId(bid) }, false);
      }
    });
    document.addEventListener('change', function(ev){
      var t = ev.target;
      if(!t || !t.getAttribute || t.getAttribute('data-la-wx') !== 'out') return;
      var d = document.getElementById('wx-date-' + t.getAttribute('data-bid'));
      if(d && d.style) d.style.display = t.value === 'reschedule' ? '' : 'none';
    });
  }

  O.weather = { load: load, refreshDetail: refreshDetail, mapClosure: mapClosure, listRows: listRows,
                syncFollowUps: syncFollowUps, closureIdFor: closureIdFor };
})();
