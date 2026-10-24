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
   §tripCxl (2026-10-20): reasons (weather|minpax|boat|other), the snapshot the server takes on close, Move program (one booking:
   POST /v1/bookings/{id}/move-program, all: POST /v1/weather-closures/{id}/move-program, targets: GET .../move-targets),
   below break-even (GET /v1/trip-cancellations/below-break-even) and the history (GET /v1/reports/trip-cancellations) answer the tcx*
   readers of 08-app.js from server caches; a miss returns an empty list, fetches once and redraws.
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
  /* §tripCxl · the server's snapshot (taken when the trip closed) → legacy's {pax, bk, ad, chd, byAg, be, by, at, before, reason, log, undone} */
  function mapSnap(row){
    var s = row && row.snapshot; if(!s) return null;
    return { pax: +s.pax || 0, bk: +s.bookings || 0, ad: +s.ad || 0, chd: +s.chd || 0, byAg: s.by_agent || {}, be: s.break_even != null ? +s.break_even : 0,
             by: s.by || '', at: s.at || '', before: s.before != null ? s.before : null, reason: row.reason || 'weather',
             log: (row.reason_log || []).map(function(x){ return { at: x.at, by: x.by, from: x.from, to: x.to }; }),
             undone: row.reopened_at ? { at: row.reopened_at, by: row.reopened_by || '' } : undefined };
  }
  function mapClosure(row){
    return { opsId: row.id, routeId: row.route_id, date: row.service_date, reason: row.reason || 'weather',
             note: row.note || '', at: row.closed_at || '', counts: row.counts || null, pax: row.pax || null,
             snapshot: mapSnap(row), reasonLog: row.reason_log || [], reopenedAt: row.reopened_at || null };
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
          newDate: r.new_date || undefined, newRoute: r.new_route_id || undefined, by: r.resolved_by || undefined, notifiedAt: r.notified_at || undefined, resolvedAt: r.resolved_at || undefined };
      } else if(bk.weatherResolve && bk.weatherResolve.event === key){ delete bk.weatherResolve; }
    });
  }
  /* A re-opened trip keeps the follow-up of the bookings that were already resolved (outcome, new date), as legacy keeps bk.weatherResolve;
     the server keeps those rows, but the open-closure list does not carry them, so after a reload the bookings showed none.
     The re-opened closures with resolved rows are read once each and only their follow-ups are mirrored (never put back as closures). */
  var reopenedSeen = {};
  var reopenedAsked = {};
  function keepResolvedOfReopened(from, to){
    if(reopenedAsked[from + '|' + to]) return;           // once per window and session; a write drops it (below)
    reopenedAsked[from + '|' + to] = 1;
    O.get('/v1/weather-closures', { from: from, to: to, include_reopened: 'true' }).then(function(j){
      listRows(j).forEach(function(r){
        if(!r || !r.id || !r.reopened_at || reopenedSeen[r.id] || !(r.counts && r.counts.resolved > 0)) return;
        reopenedSeen[r.id] = 1;
        O.get('/v1/weather-closures/' + enc(r.id)).then(function(d){ syncFollowUps(d); redrawBooking(); }, function(){ delete reopenedSeen[r.id]; });
      });
    }, function(){});
  }
  function load(from, to){
    from = from || O.shift(O.today(), -30);
    to = to || O.shift(O.today(), 120);
    return O.get('/v1/weather-closures', { from: from, to: to }).then(function(j){
      var rows = listRows(j);
      setClosures(rows, from, to);
      keepResolvedOfReopened(from, to);
      return rows;
    });
  }
  var details = {};   // closure id → its last single read (with the follow-up list); the dialog and the panel read it
  function refreshDetail(cid){
    return O.get('/v1/weather-closures/' + enc(cid)).then(function(d){
      upsertLocal(d); syncFollowUps(d); details[cid] = d; return d;
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
    var outLbl = { reschedule: 'Rescheduled', refund: 'Refunded', credit: 'Credit', cancel: 'Cancelled', move: 'Moved' };
    var rsn = (typeof TCX_R !== 'undefined' && (TCX_R[d.reason] || TCX_R.weather)) || { en: 'Weather' };
    curPanel = { routeId: routeId, date: date, cid: cid };
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
          + (typeof window.tcxOutOpts === 'function' ? window.tcxOutOpts(+b.refundable || 0)
            : '<option value="reschedule">Reschedule</option><option value="refund">Refund</option><option value="credit"' + (canCredit ? '' : ' disabled') + '>Credit</option><option value="cancel">Cancel</option>') + '</select>'
          + mvSelHtml('wx-', bid, d, b)
          + '<input type="date" id="wx-date-' + esc(bid) + '" value="' + esc(O.shift(date, 1)) + '" style="height:30px;font-size:11px;border:1px solid var(--fd-line);border-radius:7px;padding:2px 6px">'
          + '<button data-la-wx="resolve" data-cid="' + esc(cid) + '" data-bid="' + esc(bid) + '" data-route="' + esc(routeId) + '" data-date="' + esc(date) + '" style="background:#A32D2D;color:#fff;border:none;font-family:inherit;font-size:11px;font-weight:600;padding:7px 13px;border-radius:8px;cursor:pointer">Resolve</button></div>';
      } else {
        var extra = (b.outcome === 'reschedule' && b.new_date) ? (' → ' + esc(b.new_date))
          : (b.outcome === 'move' && b.new_route_id) ? (' → ' + esc(routeName(b.new_route_id)) + (b.new_date ? ' ' + esc(String(b.new_date).slice(5)) : '')) : '';
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
    showModal('<div style="padding:16px 20px;border-bottom:1px solid var(--fd-line);display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:15px;font-weight:700;color:#A32D2D">Manage bookings · trip cancelled (' + esc(rsn.en) + ')</div><div style="font-size:11px;color:var(--fd-ink-soft)">' + esc(rname) + ' · ' + esc(date) + ' · Steps: notify agent → agent contacts customer → resolve</div></div><button data-la-wx="close" style="background:transparent;border:none;font-size:20px;color:var(--fd-ink-soft);cursor:pointer">✕</button></div>'
      + '<div style="padding:10px 20px;background:#fafaf8;border-bottom:1px solid var(--fd-line-soft);font-size:11px;color:var(--fd-ink-soft)">To notify <b style="color:#5F5E5A">' + nAwait + '</b> · Notified <b style="color:#7A4A00">' + nNotif + '</b> · Resolved <b style="color:#0F6E56">' + nDone + '</b></div>'
      + '<div style="padding:6px 20px 16px">' + body + '<div style="margin-top:14px;text-align:right"><button data-la-wx="close" style="background:#fff;border:1px solid var(--fd-line);color:var(--fd-ink);font-family:inherit;font-size:12px;padding:9px 16px;border-radius:9px;cursor:pointer">Close</button></div></div>');
  }
  function openPanel(routeId, date){
    tg.cache = {};
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
    if(o.outcome === 'move'){
      return moveOne(o).then(function(j){ if(!j) return null; return afterWrite(o.cid, inline).then(function(){ return j; }); })
        .catch(function(e){ if(!(e && e.declined)) O.fail('Move refused · nothing changed', e); return null; });
    }
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
    if(typeof window.tcxCan === 'function' && !window.tcxCan()) return;
    if(!canEdit()) return viewOnly();
    var note = ((document.getElementById('wx-note') || {}).value || '').trim();
    var reason = (typeof TCX_R !== 'undefined' && TCX_R[window._tcxPick]) ? window._tcxPick : 'weather';   // the server logs a change and checks act-tripcxl (403 shows its message)
    var c = findClosure(routeId, date);
    if(c && !c.opsId){ return O.fail('Update note failed', noId('This closure')); }
    var write = c
      ? O.queue(function(){ return O.patch('/v1/weather-closures/' + enc(c.opsId), { note: note, reason: reason }); }).then(function(){ return c.opsId; })
      : O.queue(function(){ return O.post('/v1/weather-closures', { route_id: routeId, service_date: date, note: note, reason: reason }); })
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
    if(typeof window.tcxCan === 'function' && !window.tcxCan()){ alert('You do not have permission to cancel or re-open a trip.'); return; }
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
      // resolved bookings keep their follow-up (outcome, new date) the way legacy keeps bk.weatherResolve; refresh it from the server's rows
      refreshDetail(c.opsId).catch(function(){}).then(function(){ removeLocal(c.opsId); redrawBooking(); });
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
      var o = { cid: x.cid, bid: x.bid, routeId: x.routeId, date: x.date, outcome: out, newDate: nd, localBk: x.localBk };
      if(out === 'move'){
        o.toRoute = (document.getElementById(pfx + 'mv-' + bkId) || {}).value || '';
        o.toDate = (document.getElementById(pfx + 'mvd-' + bkId) || {}).value || x.date;
      }
      return resolveAct(o, pfx !== 'wx-');   // wxr- (by-trip cell) and wxd- (dialog) must not reopen the panel
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
      if(act === 'close'){ curPanel = null; closeModal(); redrawBooking(); return; }
      if(!canEdit()) return viewOnly();
      var cid = t.getAttribute('data-cid'), bid = t.getAttribute('data-bid');
      if(act === 'notify'){ notifyAct(cid, bid, false); return; }
      if(act === 'resolve'){
        var out = (document.getElementById('wx-out-' + bid) || {}).value || 'reschedule';
        var nd = (document.getElementById('wx-date-' + bid) || {}).value || t.getAttribute('data-date');
        resolveAct({ cid: cid, bid: bid, routeId: t.getAttribute('data-route'), date: t.getAttribute('data-date'),
          outcome: out, newDate: nd, localBk: findBkByOpsId(bid),
          toRoute: (document.getElementById('wx-mv-' + bid) || {}).value || '', toDate: t.getAttribute('data-date') }, false);
      }
    });
    document.addEventListener('change', function(ev){
      var t = ev.target;
      if(!t || !t.getAttribute || t.getAttribute('data-la-wx') !== 'out') return;
      var bid = t.getAttribute('data-bid');
      var d = document.getElementById('wx-date-' + bid), m = document.getElementById('wx-mv-' + bid);
      if(d && d.style) d.style.display = t.value === 'reschedule' ? '' : 'none';
      if(m && m.style) m.style.display = t.value === 'move' ? '' : 'none';
    });
  }

  var curPanel = null;   // the follow-up panel on show: {routeId, date, cid}
  /* ══ §tripCxl · reasons, snapshot, move program, below break-even, history (08-app.js tcx*) ══
     Legacy kept the trip snapshot in the blob (trip_cxl_snap) and worked every figure out of the loaded bookings.
     Here the server takes the snapshot when it closes the trip, lists the programs a booking can move to, and
     counts the trips below break-even and the history. The sync readers below answer from a cache and redraw when
     the server's answer arrives (a miss returns an empty list and fetches once). */
  var T0 = {};
  ['tcxSnapAll', 'tcxSnapOf', 'tcxSnapNow', 'tcxSnapPutLater', 'tcxSnapFlush', 'tcxBE', 'tcxMoveTargets', 'tcxMoveSel', 'tcxBulkMove',
   'tcxDlgOpen', 'tcxDlgBulk', 'tcxDlgRender', 'tcxDlgApply', 'tcxByTripBanner', 'tcxBelow', 'tcxBelowList', 'tcxHistRows'].forEach(function(n){ T0[n] = window[n]; });
  function tw(name, fn){
    window[name] = function(){
      if(!O.enabled()) return T0[name] ? T0[name].apply(this, arguments) : undefined;
      return fn.apply(this, arguments);
    };
  }
  function tcxR(k){ return (typeof TCX_R !== 'undefined' && (TCX_R[k] || TCX_R.weather)) || { en: 'Weather', th: '', ic: '', fg: '#0B4F7A', bg: '#E6F1FB', bd: '#BBD7F0' }; }
  function guardEdit(){ return typeof window.laGuardEdit !== 'function' || window.laGuardEdit('operations'); }
  function refreshDays(){
    var seen = {};
    Array.prototype.forEach.call(arguments, function(d){
      if(!d || seen[d]) return; seen[d] = 1;
      if(O.bookings && typeof O.bookings.refreshDay === 'function'){ try{ O.bookings.refreshDay(d); }catch(_){} }
    });
  }

  /* snapshot family: the closure's own snapshot (the server took it on close) */
  tw('tcxSnapAll', function(){
    var out = {};
    closures().forEach(function(c){ if(c && c.snapshot) out[c.routeId + '|' + c.date] = c.snapshot; });
    return out;
  });
  tw('tcxSnapOf', function(rid, ds){ var c = findClosure(rid, ds); return (c && c.snapshot) || null; });
  tw('tcxSnapPutLater', function(){});
  tw('tcxSnapFlush', function(){});
  /* the preview on the cancel form of a trip not closed yet (and of an old closure with no snapshot) is the browser's own count: a hint only.
     What is saved is the snapshot the server takes when the trip closes. */
  tw('tcxSnapNow', function(rid, ds){
    var c = findClosure(rid, ds);
    if(c && c.snapshot) return c.snapshot;
    return T0.tcxSnapNow ? T0.tcxSnapNow.apply(this, arguments) : { pax: 0, bk: 0, ad: 0, chd: 0, byAg: {}, be: 0, by: '', at: new Date().toISOString(), before: null };
  });
  /* the 3-day banner list covers today..+3; any other day is asked of the server once (GET /v1/trip-cancellations/break-even),
     0 until it answers, and the screen is drawn again when it lands */
  var beFar = {};
  tw('tcxBE', function(rid, ds){
    var c = findClosure(rid, ds);
    if(c && c.snapshot && c.snapshot.be > 0) return c.snapshot.be;
    var r = ((below.rows || []).find(function(x){ return x.route_id === rid && x.service_date === ds; }));
    if(r) return +r.break_even || 0;
    var k = rid + '|' + ds, f = beFar[k];
    if(f) return f.v;
    if(O.enabled() && /^\d{4}-\d{2}-\d{2}$/.test(ds || '') && rid){
      beFar[k] = { v: 0 };
      O.get('/v1/trip-cancellations/break-even', { route_id: rid, service_date: ds }).then(function(j){
        beFar[k] = { v: (j && +j.break_even) || 0 };
        if(beFar[k].v) redrawOp();
      }, function(){ delete beFar[k]; });
    }
    return 0;
  });
  if(typeof O.onWrite === 'function') O.onWrite(function(){ beFar = {}; });

  /* ── move targets ── */
  var tg = { cache: {}, pending: {} };
  function tgKey(cid, toDs, all, bid){ return [cid, toDs, all ? 1 : 0, bid || ''].join('|'); }
  function mapTargets(a){
    return ((a && a.targets) || []).map(function(t){
      return { id: t.route_id, name: t.name, pier: t.pier, free: t.free, time: t.time || '', fits: t.fits !== false };
    });
  }
  function targetsFor(cid, toDs, all, bid){
    var k = tgKey(cid, toDs, all, bid);
    if(tg.cache[k]) return tg.cache[k];
    if(!tg.pending[k]){
      tg.pending[k] = true;
      O.get('/v1/weather-closures/' + enc(cid) + '/move-targets', { to_date: toDs, all_piers: all ? 'true' : '', booking_id: bid }).then(function(j){
        tg.cache[k] = j; delete tg.pending[k]; redrawTargets();
      }, function(e){
        delete tg.pending[k]; tg.cache[k] = { targets: [], suggested_route_id: null, pax: 0 };
        O.fail('Could not list the programs to move to', e); redrawTargets();
      });
    }
    return null;
  }
  function redrawTargets(){
    try{
      if(window._tcxD && typeof window.tcxDlgRender === 'function'){ window.tcxDlgRender(); return; }
      if(curPanel && details[curPanel.cid] && document.querySelector('[data-la-wx="close"]')){
        var keep = {};
        Array.prototype.forEach.call(document.querySelectorAll('select[data-la-wx="out"]'), function(s){ keep[s.id] = s.value; });
        renderPanel(curPanel.routeId, curPanel.date, details[curPanel.cid]);
        Object.keys(keep).forEach(function(id){
          var s = document.getElementById(id); if(!s || s.value === keep[id]) return;
          s.value = keep[id];
          try{ s.dispatchEvent(new Event('change', { bubbles: true })); }catch(_){}
        });
      }
    }catch(e){ try{ console.warn('[ops] move-target redraw failed · ' + e.message); }catch(_){} }
  }
  /* the picker beside a panel row: bid = the booking's server id */
  function mvSelHtml(pfx, bid, d, b){
    var a = targetsFor(d.id, d.service_date, false, bid), T = mapTargets(a), small = (pfx === 'wxr-');
    var opts = !a ? '<option value="">Loading programs…</option>'
      : T.length ? T.map(function(t){
          return '<option value="' + esc(t.id) + '"' + (t.fits ? '' : ' style="color:#A32D2D"') + (a.suggested_route_id === t.id ? ' selected' : '') + '>'
            + esc((t.time ? t.time + ' · ' : '') + t.name) + ' · free ' + (t.free == null ? '—' : t.free) + '</option>'; }).join('')
      : '<option value="">No other program running this day</option>';
    return '<select id="' + pfx + 'mv-' + esc(bid) + '" style="display:none;height:' + (small ? '24' : '30') + 'px;font-size:' + (small ? '9.5' : '11') + 'px;font-family:inherit;border:1px solid #CFC6F2;border-radius:6px;padding:1px 4px;background:#F4F1FD;max-width:' + (small ? '190' : '260') + 'px">' + opts + '</select>';
  }
  tw('tcxMoveTargets', function(rid, ds, toDs, allPiers){
    var c = findClosure(rid, ds);
    if(!c || !c.opsId) return [];
    return mapTargets(targetsFor(c.opsId, toDs || ds, !!allPiers, ''));
  });
  tw('tcxMoveSel', function(pfx, bkId){
    var bk = findBkById(bkId), wr = bk && bk.weatherResolve; if(!wr || !bk.opsId) return '';
    var p = String(wr.event || '').split('|'), c = findClosure(p[0], p[1]); if(!c || !c.opsId) return '';
    var d = details[c.opsId] || { id: c.opsId, service_date: p[1] };
    var ent = ((d.bookings || []).find(function(e){ return e.booking_id === bk.opsId; })) || { pax: 0 };
    return mvSelHtml(pfx, bk.opsId, d, ent);
  });
  function seatsQ(e){ return String((e && e.message) || '').replace(/\s*Send move_anyway[^.]*\.?\s*$/, '') + '\nMove anyway?'; }
  /* one booking's trip → another program · POST /v1/bookings/{id}/move-program (versioned) · o: {bid, routeId, date, toRoute, toDate, localBk} */
  function moveOne(o){
    var nds = o.toDate || o.date;
    if(!o.toRoute || (o.toRoute === o.routeId && nds === o.date)){ alert('Pick the program to move this booking to.'); return Promise.resolve(null); }
    var bk = o.localBk;
    var trip = bk && (bk.trips || []).find(function(t){ return t && t.routeId === o.routeId && t.date === o.date; });
    if(!trip || !trip.opsTripId) return Promise.reject(noId('This booking\'s trip'));
    return O.queue(function(){
      return O.anyway(function(extra){
        return O.bookingWrite('POST', '/v1/bookings/' + enc(o.bid) + '/move-program', bk,
          Object.assign({ trip_id: trip.opsTripId, to_route_id: o.toRoute, to_date: nds }, extra));
      }, { not_enough_seats: { flag: 'move_anyway', ask: seatsQ } });
    }).then(function(j){ reloadLocal(bk); refreshDays(nds); return j || true; });
  }
  /* every open booking of the closed trip → one program · POST /v1/weather-closures/{id}/move-program */
  function bulkMove(cid, toRoute, toDate, ds){
    return O.queue(function(){
      return O.anyway(function(extra){
        return O.post('/v1/weather-closures/' + enc(cid) + '/move-program', Object.assign({ to_route_id: toRoute, to_date: toDate }, extra));
      }, { not_enough_seats: { flag: 'move_anyway', ask: seatsQ } });
    }).then(function(j){
      var sk = (j && j.skipped) || [];
      if(sk.length) O.toast({ kind: 'neutral', title: sk.length + ' booking(s) not moved', status: 'INFO',
        sub: sk.map(function(s){ return s.booking_id + ' · ' + s.code; }).join(' · '), dur: 9000 });
      O.wrote('weather');
      return refreshDetail(cid).then(function(){ refreshDays(ds, toDate); return j; });
    });
  }

  /* ── the choose-a-result dialog (§tcxDlg) ── */
  tw('tcxDlgOpen', function(bkId){
    var r = T0.tcxDlgOpen.apply(this, arguments);
    tg.cache = {};
    var D = window._tcxD, c = D && findClosure(D.rid, D.ds);
    if(c && c.opsId){ D.cid = c.opsId; refreshDetail(c.opsId).then(function(){ if(window._tcxD === D) window.tcxDlgRender(); }, function(){}); }
    else if(D) window.tcxDlgRender();
    return r;
  });
  tw('tcxDlgBulk', function(rid, ds){
    if(!guardEdit()) return null;
    return closureIdFor(rid, ds).then(function(cid){
      if(!cid) throw new Error('This trip is not closed on the server');
      return refreshDetail(cid);
    }).then(function(d){
      var L = (d.bookings || []).filter(function(e){ return e.status !== 'resolved' && e.on_trip; });
      if(!L.length) return null;
      tg.cache = {};
      window._tcxD = { ids: L.map(function(e){ return e.booking_id; }), rid: rid, ds: ds, out: 'move', toDs: ds, rsDs: ds, all: false, nr: '', bulk: true,
        cid: d.id, n: L.length, pax: L.reduce(function(s, e){ return s + (+e.pax || 0); }, 0) };
      window.tcxDlgRender();
      return true;
    }).catch(function(e){ O.fail('Could not open the move list', e); return null; });
  });
  tw('tcxDlgRender', function(){
    var D = window._tcxD; if(!D) return;
    var R = tcxR(window.tcxReason(D.rid, D.ds));
    var L = D.bulk ? [] : D.ids.map(findBkById).filter(Boolean);
    if(!D.bulk && !L.length) return;
    var cid = D.cid || ((findClosure(D.rid, D.ds) || {}).opsId);
    var pax = D.bulk ? D.pax : L.reduce(function(s, b){ return s + window.tcxPaxOf(b, D.rid, D.ds); }, 0);
    var pierNm = function(p){ try{ return (typeof laPierName === 'function' && laPierName(p)) || p || '—'; }catch(_){ return p || '—'; } };
    var paid = 0;
    if(!D.bulk && L[0]){
      var ent = cid && details[cid] && (details[cid].bookings || []).find(function(e){ return e.booking_id === L[0].opsId; });
      if(ent) paid = +ent.refundable || 0;
      else { var inv = (typeof acctBookingInvoice === 'function') ? acctBookingInvoice(L[0].id) : null; paid = inv ? acctInvoicePaid(inv) : 0; }
    }
    var ag = function(b){ return (typeof sbGetAgent === 'function' && b.agentId) ? ((sbGetAgent(b.agentId) || {}).name || 'B2C') : 'B2C'; };
    var title = D.bulk ? ('Move all ' + D.n + ' booking' + (D.n === 1 ? '' : 's') + ' · ' + pax + ' pax')
      : (esc(L[0].voucherRef || L[0].code || L[0].id) + ' · ' + esc(ag(L[0])) + ' · ' + pax + ' pax');
    var seg = D.bulk ? '' : ('<div style="display:flex;gap:4px;padding:4px;background:#F2F4F8;border-radius:11px;margin-bottom:12px">'
      + [['move', 'Move program'], ['reschedule', 'Reschedule'], ['refund', 'Refund'], ['credit', 'Credit'], ['cancel', 'Cancel']].map(function(o){
          var dis = (o[0] === 'credit' && !(paid > 0));
          return '<button ' + (dis ? 'disabled ' : '') + 'onclick="tcxDlgSet(\'out\',\'' + o[0] + '\')" style="flex:1;border:0;border-radius:8px;padding:7px 6px;font-family:inherit;font-size:12px;font-weight:700;cursor:' + (dis ? 'default' : 'pointer') + ';background:' + (D.out === o[0] ? '#16265C' : 'transparent') + ';color:' + (D.out === o[0] ? '#fff' : (dis ? '#B9BFCC' : '#3E4658')) + '">' + o[1] + '</button>'; }).join('') + '</div>');
    var body = '';
    if(D.out === 'move'){
      var a = cid ? targetsFor(cid, D.toDs, D.all, D.bulk ? '' : L[0].opsId) : null, T = mapTargets(a);
      if(!D.nr && a && T.length){ D.nr = (T.find(function(t){ return t.id === a.suggested_route_id; }) || T[0]).id; }
      body = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">'
        + '<label style="font-size:11px;font-weight:700;color:#6B7489">Date <input type="date" value="' + esc(D.toDs) + '" onchange="tcxDlgSet(\'toDs\',this.value)" style="height:32px;border:1px solid #D5DAE5;border-radius:8px;padding:0 8px;font-family:inherit;font-size:12.5px;margin-left:4px"></label>'
        + (D.toDs !== D.ds ? '<span style="font-size:11px;font-weight:700;background:#FBF1DF;color:#7A4300;border-radius:8px;padding:2px 8px">date changes · ' + esc(D.ds) + ' → ' + esc(D.toDs) + '</span>' : '')
        + '<div style="margin-left:auto;display:flex;gap:3px;padding:3px;background:#F2F4F8;border-radius:9px">'
        + '<button onclick="tcxDlgSet(\'all\',false)" style="border:0;border-radius:7px;padding:5px 10px;font-family:inherit;font-size:11.5px;font-weight:700;cursor:pointer;background:' + (!D.all ? '#fff' : 'transparent') + ';color:#0F1B3D">This pier</button>'
        + '<button onclick="tcxDlgSet(\'all\',true)" style="border:0;border-radius:7px;padding:5px 10px;font-family:inherit;font-size:11.5px;font-weight:700;cursor:pointer;background:' + (D.all ? '#fff' : 'transparent') + ';color:#0F1B3D">All piers</button></div></div>'
        + '<div style="border:1px solid #E6E8EE;border-radius:12px;max-height:300px;overflow:auto">'
        + (!a ? '<div style="padding:18px;text-align:center;color:#8A8F9C;font-size:12.5px">Loading programs…</div>'
          : T.length ? T.map(function(t){
              var on = D.nr === t.id, short = !t.fits;
              return '<label style="display:grid;grid-template-columns:20px 54px 1fr auto auto;gap:8px;align-items:center;padding:8px 12px;border-bottom:1px solid #F0F1F4;cursor:pointer;background:' + (on ? '#F4F1FD' : '#fff') + '">'
                + '<input type="radio" name="tcxd-nr" ' + (on ? 'checked ' : '') + 'onchange="tcxDlgSet(\'nr\',\'' + esc(t.id) + '\')">'
                + '<span style="font-family:\'DM Mono\',monospace;font-size:12px;color:#3E4658">' + esc(t.time || '—') + '</span>'
                + '<b style="font-size:12.5px">' + esc(t.name) + (t.id === D.rid ? ' <span style="font-weight:600;color:#8A8F9C">(same program)</span>' : '') + '</b>'
                + '<span style="font-size:11px;color:#6B7489">' + esc(pierNm(t.pier)) + '</span>'
                + '<span style="font-size:11.5px;font-weight:700;border-radius:8px;padding:2px 8px;background:' + (short ? '#FBE3E0' : '#E1F5EA') + ';color:' + (short ? '#A32D2D' : '#136C3A') + '">free ' + (t.free == null ? '—' : t.free) + '</span></label>'; }).join('')
          : '<div style="padding:18px;text-align:center;color:#8A8F9C;font-size:12.5px">No program with a boat on ' + esc(D.toDs) + (D.all ? '' : ' at this pier') + '. Try another date or All piers.</div>')
        + '</div><div style="font-size:11px;color:#8A8F9C;margin-top:6px">Price stays the same · boat/van of the cancelled trip are cleared · pickup time is read again for the new program</div>';
    } else if(D.out === 'reschedule'){
      body = '<label style="font-size:11px;font-weight:700;color:#6B7489">New date (same program) <input type="date" value="' + esc(D.rsDs) + '" onchange="_tcxD.rsDs=this.value" style="height:32px;border:1px solid #D5DAE5;border-radius:8px;padding:0 8px;font-family:inherit;font-size:12.5px;margin-left:4px"></label>';
    } else {
      body = '<div style="font-size:12.5px;line-height:1.6;color:#3E4658">' + (D.out === 'refund' ? ('Booking is cancelled and ' + (paid > 0 ? ('฿' + Math.round(paid).toLocaleString() + ' is refunded') : 'nothing has been paid') + '.') : D.out === 'credit' ? ('Booking is cancelled and ฿' + Math.round(paid).toLocaleString() + ' stays as agent credit.') : 'Booking is cancelled · invoice voided · no refund.') + '</div>';
    }
    var hid = D.bulk ? '' : ('<input type="hidden" id="wxd-out-' + esc(L[0].id) + '" value="' + esc(D.out) + '"><input type="hidden" id="wxd-date-' + esc(L[0].id) + '" value="' + esc(D.rsDs) + '">');
    showModal('<div style="padding:14px 18px;border-bottom:1px solid var(--fd-line);display:flex;align-items:flex-start;gap:10px"><div><div style="font-size:10.5px;font-weight:800;letter-spacing:.08em;color:' + R.fg + '">' + R.ic + ' TRIP CANCELLED · ' + esc(String(R.en).toUpperCase()) + ' · ' + esc(window.tcxRName(D.rid)) + ' · ' + esc(D.ds) + '</div>'
      + '<div style="font-size:15px;font-weight:700;color:#0F1B3D;margin-top:2px">' + title + '</div></div><button onclick="acctModalClose();_tcxD=null" style="margin-left:auto;background:none;border:none;font-size:20px;cursor:pointer;color:var(--fd-ink-soft)">&times;</button></div>'
      + '<div style="padding:14px 18px;width:620px;max-width:100%;box-sizing:border-box">' + seg + body + hid
      + '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button onclick="acctModalClose();_tcxD=null" style="background:#fff;border:1px solid var(--fd-line);color:var(--fd-ink);font-family:inherit;font-size:12px;padding:9px 15px;border-radius:9px;cursor:pointer">Back</button>'
      + '<button onclick="tcxDlgApply()" style="background:#A32D2D;color:#fff;border:none;font-family:inherit;font-size:12px;font-weight:700;padding:9px 18px;border-radius:9px;cursor:pointer">Apply' + (D.bulk ? (' to ' + D.n) : '') + '</button></div></div>');
  });
  function dlgDone(){ try{ if(typeof acctModalClose === 'function') acctModalClose(); }catch(_){} window._tcxD = null; redrawBooking(); redrawOp(); }
  tw('tcxDlgApply', function(){
    var D = window._tcxD; if(!D) return null;
    if(!guardEdit()) return null;
    var cid = D.cid || ((findClosure(D.rid, D.ds) || {}).opsId);
    if(D.out === 'move'){
      if(!D.nr){ alert('Pick the program to move to.'); return null; }
      if(!cid){ O.fail('Move refused', noId('This closure')); return null; }
      if(D.bulk){
        var a = targetsFor(cid, D.toDs, D.all, ''), t = mapTargets(a).find(function(x){ return x.id === D.nr; });
        if(!confirm('Move ' + D.n + ' booking(s) · ' + D.pax + ' guest(s) to ' + window.tcxRName(D.nr) + ' on ' + D.toDs + '?'
          + (t && !t.fits ? ('\n\nOnly ' + t.free + ' seat(s) free there.') : ''))) return null;
        return bulkMove(cid, D.nr, D.toDs, D.ds).then(function(){ dlgDone(); return true; },
          function(e){ if(!(e && e.declined)) O.fail('Move refused · nothing changed', e); return null; });
      }
      var bk = findBkById(D.ids[0]);
      return ctxFromLocal(bk).then(function(x){
        return resolveAct({ cid: x.cid, bid: x.bid, routeId: D.rid, date: D.ds, outcome: 'move', toRoute: D.nr, toDate: D.toDs, localBk: bk }, true);
      }).then(function(j){ if(j) dlgDone(); return j; }, function(e){ O.fail('Move refused · nothing changed', e); return null; });
    }
    if(D.bulk) return null;
    if(D.out === 'reschedule' && (!D.rsDs || D.rsDs === D.ds)){ alert('Pick a new date.'); return null; }
    var id = D.ids[0];
    // the resolve reads its fields (result, new date) from this dialog after a server round-trip, so the dialog stays
    // until it answers; a refused write leaves it open for another try
    return window.bookingV2WeatherResolveOne(id, 'wxd-').then(function(j){
      if(j !== null && j !== undefined){ try{ acctModalClose(); }catch(_){} window._tcxD = null; }
      return j;
    });
  });
  tw('tcxBulkMove', function(rid, ds){
    if(!guardEdit()) return null;
    var nr = (document.getElementById('tcxb-' + rid) || {}).value || '';
    if(!nr){ alert('Pick the program to move the bookings to.'); return null; }
    return closureIdFor(rid, ds).then(function(cid){
      if(!cid) throw new Error('This trip is not closed on the server');
      return refreshDetail(cid);
    }).then(function(d){
      var L = (d.bookings || []).filter(function(e){ return e.status !== 'resolved' && e.on_trip; });
      if(!L.length) return null;
      var pax = L.reduce(function(s, e){ return s + (+e.pax || 0); }, 0);
      if(!confirm('Move ' + L.length + ' booking(s) · ' + pax + ' guest(s) to ' + window.tcxRName(nr) + ' on ' + ds + '?')) return null;
      return bulkMove(d.id, nr, ds, ds).then(function(){ redrawBooking(); redrawOp(); return true; });
    }).catch(function(e){ if(!(e && e.declined)) O.fail('Move refused · nothing changed', e); return null; });
  });

  /* ── the By-trip banner: open / total from the closure's counts ── */
  tw('tcxByTripBanner', function(rid, ds){
    var k = window.tcxReason(rid, ds), R = tcxR(k), S = window.tcxSnapOf(rid, ds), note = bookingV2WeatherNote(rid, ds);
    var c = findClosure(rid, ds), n = (c && c.counts) || { awaiting: 0, notified: 0, resolved: 0 };
    var open = (n.awaiting || 0) + (n.notified || 0), total = open + (n.resolved || 0);
    var snapTxt = S ? (S.pax + (S.be > 0 ? (' / ' + S.be) : '') + ' pax · ' + esc(S.by || '') + ' ' + esc(String(S.at || '').slice(5, 16).replace('T', ' '))) : '';
    var bulk = open ? ('<button onclick="event.stopPropagation();tcxDlgBulk(\'' + rid + '\',\'' + ds + '\')" style="background:#fff;border:1px solid ' + R.fg + ';color:' + R.fg + ';font-family:inherit;font-size:11.5px;font-weight:700;padding:7px 11px;border-radius:8px;cursor:pointer;white-space:nowrap">Move all ' + open + '…</button>') : '';
    return '<div style="background:' + R.bg + ';border:1.5px solid ' + R.bd + ';border-radius:9px;padding:10px 14px;margin-bottom:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
      + '<span style="font-size:20px;color:' + R.fg + '">' + R.ic + '</span>'
      + '<div style="flex:1;min-width:220px"><div style="font-size:13px;font-weight:700;color:' + R.fg + '">Trip cancelled · ' + R.en + ' <span style="font-weight:600">· ' + R.th + '</span></div>'
      + '<div style="font-size:11px;color:' + R.fg + ';opacity:.85;margin-top:1px">' + (note ? esc(note) + ' · ' : '') + (snapTxt ? snapTxt + ' · ' : '') + 'resolve booking by booking</div></div>'
      + (open ? ('<span style="font-size:11px;font-weight:700;background:#FBF1DF;color:#7A4300;border-radius:8px;padding:3px 8px">To resolve ' + open + ' / ' + total + '</span>') : '')
      + bulk
      + '<button onclick="event.stopPropagation();bookingV2WeatherPanel(\'' + rid + '\',\'' + ds + '\')" style="background:' + R.fg + ';color:#fff;border:none;font-family:inherit;font-size:11.5px;font-weight:600;padding:8px 14px;border-radius:8px;cursor:pointer;white-space:nowrap">Resolve by booking</button></div>';
  });

  /* ── below break-even (server: today and the next 3 days, Bangkok time) ── */
  var below = { rows: null, at: 0, pending: false };
  function belowLoad(){
    if(below.pending || (below.rows && Date.now() - below.at < 60000)) return;
    below.pending = true;
    O.get('/v1/trip-cancellations/below-break-even').then(function(j){
      var rows = (j && j.trips) || [], changed = JSON.stringify(rows) !== JSON.stringify(below.rows);
      below.rows = rows; below.at = Date.now(); below.pending = false;
      if(changed && O.activeView && O.activeView() === 'operation') redrawOp();
    }, function(e){
      below.rows = below.rows || []; below.at = Date.now(); below.pending = false;
      try{ console.warn('[ops] below break-even did not load · ' + (e && e.message)); }catch(_){}
    });
  }
  function belowMap(r){ return { rid: r.route_id, ds: r.service_date, be: +r.break_even || 0, bk: +r.booked || 0, days: r.days }; }
  tw('tcxBelowList', function(routes){
    belowLoad();
    var ids = {}; (routes || []).forEach(function(r){ if(r) ids[r.id] = 1; });
    return (below.rows || []).filter(function(r){ return ids[r.route_id]; }).map(belowMap);
  });
  tw('tcxBelow', function(rid, ds){
    belowLoad();
    var r = (below.rows || []).find(function(x){ return x.route_id === rid && x.service_date === ds; });
    return r ? belowMap(r) : null;
  });

  /* ── history ── */
  var hist = { cache: {}, pending: {} };
  function histRow(r){
    var S = mapSnap({ snapshot: r.snapshot, reason: r.reason, reopened_at: r.reopened ? (r.closed_at || 'reopened') : null });
    if(S && S.undone) S.undone = { at: '', by: '' };
    return { k: r.route_id + '|' + r.service_date, rid: r.route_id, ds: r.service_date, name: r.route_name || r.route_id, pier: r.pier || '', reason: r.reason || 'weather',
      note: r.note || '', S: S, live: !r.reopened, oc: r.outcomes || {}, n: r.bookings || 0 };
  }
  tw('tcxHistRows', function(){
    var H = window._tcxH || {}, k = [H.mon || '', H.r || '', H.p || ''].join('|');
    if(hist.cache[k]) return hist.cache[k];
    if(!hist.pending[k]){
      hist.pending[k] = true;
      O.get('/v1/reports/trip-cancellations', { month: H.mon, reason: H.r, pier: H.p }).then(function(j){
        hist.cache[k] = ((j && j.rows) || []).map(histRow); delete hist.pending[k];
        if(document.getElementById('tcx-hist') && typeof window.tcxHistRender === 'function') window.tcxHistRender();
      }, function(e){ delete hist.pending[k]; hist.cache[k] = []; O.fail('Cancelled trips history did not load', e); });
    }
    return [];
  });
  if(typeof O.onWrite === 'function') O.onWrite(function(){ tg.cache = {}; reopenedAsked = {}; hist.cache = {}; below.at = 0; });

  O.weather = { load: load, refreshDetail: refreshDetail, mapClosure: mapClosure, listRows: listRows,
                syncFollowUps: syncFollowUps, closureIdFor: closureIdFor };
})();
