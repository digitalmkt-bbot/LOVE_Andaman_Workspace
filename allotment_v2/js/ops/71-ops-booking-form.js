/* ══════════════════════════════════════════════════════════════════════════
   §opsBookingForm (2026-10-18) · booking-form rules the server now decides (wave 3)
   ──────────────────────────────────────────────────────────────────────────
   Backend guide: operation-backend todo/w2-booking-form-model.md (Q43, Q44, Q45, Q51).
   Loads after js/booking/*.js and 40-ops-bookings.js / 51-ops-quote.js. Classic script.

   Q43 · LOCK DRAWS   POST /v1/quote/lock-draws
        bookingV2DrawSources (the banner, the "locks not used" checks, the draw picker) and
        bookingV2AutoDrawLocks ("ใช้ lock ก่อน"). Both stay synchronous like the quote: the answer is
        cached per draft (agent + trips + booking id); a miss returns legacy's list and asks once
        (300 ms), then the form is drawn again. The staff's choices stay in t.lockDrawSel and go to
        the save as lock_draws, as before. The banner's text and the save-time confirm's line are the server's
        warning (warning.message, warning.save_line) once it has answered, legacy's own words before that (w4-f3).
   Q44 · PRIVATE VAN  40-ops-bookings.js toServer / 51-ops-quote.js buildRequest send zone NoTransfer for
        a seat trip on a route with a transfer-<route>-… add-on (laOps.vanZone below). The server
        refuses a contradicting zone with 400 private_van_transfer; its message is shown by the save.
   Q45 · BOOKING CODE POST /v1/bookings/reserve-code when the form opens (bookingV2NewBooking). Until it
        answers (or offline) legacy's locally minted code stays and is NOT sent as a reserved code.
        A create sends `code` only for a code the server answered (laOps.reservedCode, 40-ops-bookings.js).
        400 code_not_reserved / 403 code_reserved_by_other / 409 code_used: the server's message is shown
        (laOps.fail) and a new code is reserved for the open form.
   Q51 · PARTIAL CANCEL POST /v1/bookings/{id}/partial-cancel/preview feeds the dialog's boxes. The fee box
        takes the server's proposal and may be overtyped (a 400 charged_amount_out_of_range message is
        shown under the box); the refund box is the server's figure and READ-ONLY (decided difference from legacy).
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsForm) return;
    var w = function(){
      var args = [].slice.call(arguments);
      if(!enabled()) return orig.apply(this, args);
      return fn.apply(this, [orig].concat(args));
    };
    w.__opsForm = true; w.__orig = orig; window[name] = w;
  }
  function paxClean(p){
    var out = {}; Object.keys(p || {}).forEach(function(k){ var n = Math.round(+p[k] || 0); if(n > 0) out[k] = n; }); return out;
  }
  function paxCount(p){ var n = 0; Object.keys(p || {}).forEach(function(k){ var v = Math.round(+p[k] || 0); if(v > 0) n += v; }); return n; }
  function typing(){
    var a = document.activeElement;
    return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
  }
  function draft(){ return (window._bkV2 && _bkV2.newBooking) || null; }
  /* draw the form again, but never under somebody who is typing */
  function redrawForm(d){
    try{
      if(draft() !== d || typing()) return;
      if(typeof window.bookingV2Render === 'function') window.bookingV2Render();
    }catch(e){ console.warn('[ops] form redraw failed', e); }
  }

  /* ══ Q44 · private van ═══════════════════════════════════════════════════ */
  /* the zone to send for a trip: NoTransfer for a seat trip whose route has a private van, else the trip's own.
     A charter, a return leg and a Love Kingdom order are left alone (the server leaves them alone too). */
  O.vanZone = function(booking, trip, id){
    if(!trip) return undefined;
    if(/^b2c_/.test(String(id || (booking && (booking.id || booking.code)) || ''))) return trip.zone;
    if(trip.bookingMode === 'charter' || trip.ovnLeg) return trip.zone;
    var van = (typeof window.bookingV2TripPrivateVan === 'function' && booking) ? window.bookingV2TripPrivateVan(booking, trip) : null;
    /* w5-e · the zone of a private-van seat is the server's (Q44: "a trip sent with no zone gets NoTransfer"): it is left out of the request
       instead of being sent as a value the browser worked out. The form still shows NoTransfer on screen (bkV2ToggleAddOn). */
    return van ? undefined : trip.zone;
  };

  /* ══ Q45 · booking code ══════════════════════════════════════════════════ */
  var reserved = {};                    // code -> true · only codes the server answered
  O.reservedCode = function(code){ return !!reserved[String(code || '')]; };
  var CODE_REFUSALS = { code_not_reserved: 1, code_reserved_by_other: 1, code_used: 1 };

  function reserveFor(d, force){
    var local = d.code, seq = (d.__reserveSeq = (d.__reserveSeq || 0) + 1);
    return O.post('/v1/bookings/reserve-code').then(function(r){
      if(!r || !r.code) return;
      reserved[r.code] = true;
      if(d.__reserveSeq !== seq) return;
      var editing = window._bkV2 && _bkV2.editingId;
      if(draft() === d && !editing && (force || d.code === local)){
        d.code = r.code;
        redrawForm(d);
      }
    }, function(e){
      try{ console.warn('[ops] booking code not reserved, the local code stays · ' + ((e && e.message) || e)); }catch(_){}
    });
  }
  wrap('bookingV2NewBooking', function(orig){
    var was = draft();
    var r = orig.apply(this, [].slice.call(arguments, 1));
    var d = draft();
    if(d && d !== was && !(window._bkV2 && _bkV2.editingId)) reserveFor(d, false);
    return r;
  });
  /* a refused code: the server's message is shown by the save (laOps.fail), then the open form gets a new one */
  var origFail = O.fail;
  if(typeof origFail === 'function' && !origFail.__opsForm){
    O.fail = function(title, err){
      var r = origFail.apply(this, arguments);
      try{
        if(err && CODE_REFUSALS[err.code]){
          var d = draft();
          if(d){ delete reserved[d.code]; reserveFor(d, true); }
        }
      }catch(_){}
      return r;
    };
    O.fail.__opsForm = true;
  }

  /* ══ Q43 · lock draws ════════════════════════════════════════════════════ */
  var DEBOUNCE_MS = 300, FAIL_MS = 15000, OK_MS = 60000, KEEP = 12;
  var cache = {}, order = [], timer = null, pending = null;

  /* the draft -> the request, or null when the server cannot be asked (legacy answers).
     Seat trips with passengers only: a charter has no draw, a trip without passengers has nothing to draw for. */
  function ldRequest(d){
    if(!d || !d.agentId || !Array.isArray(d.trips)) return null;
    if(/^b2c_/.test(String(d.id || d.code || ''))) return null;
    var trips = [];
    d.trips.forEach(function(t){
      if(!t || !t.routeId || !t.date || t.bookingMode === 'charter' || t.ovnLeg || paxCount(t.pax) === 0) return;
      var o = { routeId: t.routeId, date: t.date, pax: paxClean(t.pax) };
      if(t.opsTripId) o.id = t.opsTripId;
      trips.push(o);
    });
    if(!trips.length) return null;
    var body = { agentId: d.agentId, trips: trips };
    var editing = null;
    try{ if(window._bkV2 && _bkV2.editingId && typeof SB_BOOKINGS !== 'undefined') editing = SB_BOOKINGS.find(function(b){ return b && b.id === _bkV2.editingId; }); }catch(_){}
    if(editing && editing.opsId) body.bookingId = editing.opsId;
    return { key: JSON.stringify(body), body: body };
  }
  function ldFresh(e){ return e && (Date.now() - e.at) < (e.ok ? OK_MS : FAIL_MS); }
  function ldRemember(key, e){
    if(!cache[key]) order.push(key);
    cache[key] = e;
    while(order.length > KEEP) delete cache[order.shift()];
  }
  function clientLockId(serverId){
    try{ return (O.locks && O.locks.clientIdFor) ? O.locks.clientIdFor(serverId) : serverId; }catch(_){ return serverId; }
  }
  /* answer -> { 'route|date': lock_draws } */
  function ldIndex(res){
    var by = {};
    ((res && res.trips) || []).forEach(function(t){ if(t && t.lock_draws) by[t.route_id + '|' + t.service_date] = t.lock_draws; });
    return by;
  }
  function ldAsk(req){
    return O.post('/v1/quote/lock-draws', req.body).then(function(res){
      var e = { ok: true, at: Date.now(), by: ldIndex(res), res: res };
      ldRemember(req.key, e); return e;
    }, function(err){
      ldRemember(req.key, { ok: false, at: Date.now() });
      try{ console.warn('[ops] lock draws: server refused, legacy list kept · ' + ((err && err.message) || err)); }catch(_){}
      return null;
    });
  }
  function ldSchedule(req, d){
    if(pending === req.key) return;
    if(timer) clearTimeout(timer);
    timer = setTimeout(function(){
      timer = null;
      var cur = ldRequest(draft());                       // the draft may have moved on while we waited
      if(!cur) return;
      if(ldFresh(cache[cur.key])) return;
      pending = cur.key;
      ldAsk(cur).then(function(e){
        pending = null;
        var now = ldRequest(draft());
        if(e && now && now.key === cur.key) redrawForm(draft());
      });
    }, DEBOUNCE_MS);
  }
  /* bookingV2DrawSources(routeId, date, agentId): the server's sources for the open draft, else legacy's */
  wrap('bookingV2DrawSources', function(orig, routeId, date, agentId){
    var legacy = orig.apply(this, [].slice.call(arguments, 1));
    var d = draft();
    if(!d || !agentId || d.agentId !== agentId) return legacy;
    var req = ldRequest(d); if(!req) return legacy;
    var e = cache[req.key];
    if(ldFresh(e)){
      var hit = e.ok ? e.by[routeId + '|' + date] : null;
      if(!hit) return legacy;
      /* held: a lock the booking being edited already drew from that no longer offers seats (released, expired), listed so the draw can be stepped down to 0
         (§lkStaleDraw, lk-inbox cfc03199; the server's `kept`). It is the same flag legacy's bkV2DrawSourcesFor sets. */
      return (hit.sources || []).map(function(s){ var o = { lockId: clientLockId(s.lock_id), label: s.label, remaining: s.remaining }; if(s.kept === true) o.held = true; return o; });
    }
    ldSchedule(req, d);
    return legacy;
  });
  /* ⚡ ใช้ lock ก่อน: fill the trip's draw with the server's proposal */
  wrap('bookingV2AutoDrawLocks', function(orig, idx){
    var d = draft(), t = d && d.trips && d.trips[idx];
    if(!t) return orig.call(this, idx);
    var self = this, req = ldRequest(d);
    if(!req) return orig.call(self, idx);
    function apply(e){
      var hit = e && e.ok ? e.by[t.routeId + '|' + t.date] : null;
      if(!hit) return false;
      var sel = {};
      (hit.proposed || []).forEach(function(p){ if(p && p.qty > 0){ var id = clientLockId(p.lock_id); sel[id] = (sel[id] || 0) + p.qty; } });
      t.lockDrawSel = sel;
      t.lockUse = Object.keys(sel).reduce(function(a, k){ return a + (Number(sel[k]) || 0); }, 0);
      if(typeof window.bookingV2Render === 'function') window.bookingV2Render();
      return true;
    }
    var e = cache[req.key];
    if(ldFresh(e) && apply(e)) return;
    ldAsk(req).then(function(ans){ if(!apply(ans)) orig.call(self, idx); });
  });
  /* the server's "locks free but none drawn" warning for a trip of the open draft (warning.message, warning.save_line,
     free, would_draw), or null before the answer / when the server has none. The banner and the save-time confirm print its text. */
  function lockWarning(routeId, date){
    if(!enabled()) return null;
    var d = draft(); if(!d) return null;
    var req = ldRequest(d), e = req && cache[req.key];
    if(!(e && e.ok && ldFresh(e))) return null;
    var hit = e.by[routeId + '|' + date];
    return (hit && hit.warning) || null;
  }
  function escHtml(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  window.laOpsLockWarning = lockWarning;
  /* the banner line: the server's message, escaped, the free-seat number in bold as legacy drew it */
  window.laOpsLockBannerHtml = function(w){
    var m = escHtml(w && w.message);
    return m.replace(/(มี )(d+)( ที่)/, '$1<b>$2</b>$3');
  };
  window.laOpsLockSaveLine = function(routeId, date){ var w = lockWarning(routeId, date); return (w && w.save_line) || null; };
  /* w5-b: the server's draw sources for a trip of the open draft ([{lock_id (client id), label, remaining}]), or null before the answer.
     ops/81-ops-locks-w5.js answers "which locks may this booking draw" (bookingV2LocksForAgent) and the ceiling of the
     "use locks" box (bookingV2SetTripLockUse) from it. */
  function lockSources(routeId, date){
    if(!enabled()) return null;
    var d = draft(); if(!d) return null;
    var req = ldRequest(d); if(!req) return null;
    var e = cache[req.key];
    if(ldFresh(e) && e.ok){
      var hit = e.by[routeId + '|' + date];
      return hit ? (hit.sources || []).map(function(s){ return { lockId: clientLockId(s.lock_id), label: s.label, remaining: s.remaining }; }) : null;
    }
    ldSchedule(req, d);
    return null;
  }
  O.lockDraws = { _cache: cache, request: ldRequest, warning: lockWarning, sources: lockSources };

  /* ══ Q51 · partial cancel ════════════════════════════════════════════════ */
  var ctx = null, pSeq = 0, pTimer = null, lastProposal = null;

  function el(id){ return document.getElementById(id); }
  function pNote(msg){
    var n = el('bkp-srv-note');
    if(!n){
      var box = el('bkp-waive-amt'); box = box && box.closest('div[style*="background:#FAF7F2"]');
      if(!box) return;
      n = document.createElement('div'); n.id = 'bkp-srv-note';
      n.style.cssText = 'font-size:11px;color:#A32D2D;margin-top:8px;line-height:1.45;font-weight:600';
      box.appendChild(n);
    }
    n.textContent = msg || '';
  }
  function pFallbackCategory(){
    var list = (typeof BKV2_CANCEL_REASONS !== 'undefined' ? BKV2_CANCEL_REASONS : []);
    var r = list.filter(function(x){ return x && x.code && x.code !== 'other'; })[0];
    return r ? r.code : 'other';
  }
  function pBody(typed){
    if(!ctx) return null;
    var bk = (typeof SB_BOOKINGS !== 'undefined') ? SB_BOOKINGS.find(function(b){ return b.id === ctx.bookingId; }) : null;
    var t = bk && bk.trips && bk.trips[ctx.tripIdx];
    if(!bk || !bk.opsId || !t || !t.opsTripId) return null;
    var removed = {}, tot = 0;
    (typeof BKV2_PAX_KEYS !== 'undefined' ? BKV2_PAX_KEYS : []).forEach(function(kv){
      var k = kv[0], i = el('bkp-rm-' + k); if(!i) return;
      var n = Math.max(0, Math.min(parseInt(i.value) || 0, (t.pax && t.pax[k]) || 0));
      if(n > 0){ removed[k] = n; tot += n; }
    });
    if(!tot) return null;
    var chgEl = el('bkp-chg-cnt');
    var chg = Math.max(0, Math.min(parseInt(chgEl && chgEl.value) || 0, tot));
    var cat = (el('bkp-cat') || {}).value || '';
    var note = ((el('bkp-note') || {}).value || '').trim();
    if(!cat || (cat === 'other' && !note)) cat = pFallbackCategory();       // the preview needs a category; it does not change the money
    var charged = { count: chg };
    if(typed){ var a = el('bkp-chg-amt'); if(a && a.value !== '') charged.amount = Math.max(0, Number(a.value) || 0); }
    var b = { trip_id: t.opsTripId, pax: removed, category: cat, charged: charged, waived: { count: tot - chg } };
    if(cat === 'other') b.note = note || 'x';
    return { opsId: bk.opsId, body: b };
  }
  function pRefresh(typed){
    var q = pBody(typed); if(!q) return;
    var mine = ++pSeq;
    O.post('/v1/bookings/' + encodeURIComponent(q.opsId) + '/partial-cancel/preview', q.body).then(function(r){
      if(mine !== pSeq || !r) return;
      pNote('');
      var c = el('bkp-chg-amt'), w = el('bkp-waive-amt');
      if(c){
        if(!typed) c.value = r.charged.amount;
        c.max = r.charged.max;
        c.title = '฿0 – ฿' + r.charged.max;
      }
      if(w) w.value = r.waived.amount;
      lastProposal = r;
    }, function(e){
      if(mine !== pSeq) return;
      pNote((e && e.message) || 'Refused by the server');
    });
  }
  function pSchedule(typed){
    clearTimeout(pTimer);
    pTimer = setTimeout(function(){ pRefresh(typed); }, 250);
  }
  wrap('bookingV2PartialModal', function(orig, bookingId, tripIdx){
    var r = orig.apply(this, [].slice.call(arguments, 1));
    ctx = { bookingId: bookingId, tripIdx: Math.max(0, tripIdx | 0) };
    lastProposal = null;
    try{
      var w = el('bkp-waive-amt');
      if(w){
        w.readOnly = true; w.tabIndex = -1;
        w.style.background = '#F1EEE8'; w.style.color = '#5b6472';
        w.title = 'ยอดคืนเงินคำนวณโดยระบบ (แก้ไม่ได้) · refund is the server\'s figure';
      }
      var c = el('bkp-chg-amt');
      if(c) c.addEventListener('input', function(){ pSchedule(true); });
      var box = w && w.closest('div[style*="background:#FAF7F2"]');
      var hint = box && Array.prototype.filter.call(box.children, function(x){ return /auto/.test(x.textContent || '') && /แก้ได้/.test(x.textContent || ''); })[0];
      if(hint) hint.textContent = hint.textContent.replace('แก้ได้', 'ช่อง "ชาร์จ" แก้ได้ภายในช่วงที่ระบบกำหนด · ยอดคืนเงินระบบคำนวณ แก้ไม่ได้');
    }catch(e){ console.warn('[ops] partial dialog', e); }
    return r;
  });
  wrap('bookingV2PartialRecalc', function(orig){
    var r = orig.apply(this, [].slice.call(arguments, 1));
    pSchedule(false);
    return r;
  });
  O.partialPreview = { refresh: pRefresh };
})();
