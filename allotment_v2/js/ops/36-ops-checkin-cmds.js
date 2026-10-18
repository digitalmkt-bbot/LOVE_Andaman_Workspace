/* ══════════════════════════════════════════════════════════════════════════
   §opsCheckinCmds (Q36) · the check-in taps go to the server's commands
   ──────────────────────────────────────────────────────────────────────────
   The server counts; the screen says what happened. Every command is
   POST /operations/trip-ops/{trip}/checkins/{van|pier}/{slot}/{command} and answers
   { trip, warnings }. The screen waits for the answer and redraws from it (scroll kept,
   no blur: a note being typed is not cut off). Nothing computed is sent: no actual_pax,
   expected, no_show, self_add, reinstate, checked_in_*, arrived_*, cleared_*, flow_at/by,
   event by/ts. The server stamps the clock and the login.

     ckToggle        POST …/check-in           ckStep          POST …/count {delta}
     ckEvSave        POST …/events             ckBackSave      POST …/events/{i}/undo
     ckTrySave       POST …/events/{i}/tries   ckSelfSave      POST …/self-add
     ckPierReinstate POST …/reinstate {on}     ckReasonSave    PUT  …/reason
     pckStageSet     POST …/stage (+ …/check-in for the boarding step)
     vckSetFlow      POST …/stage {flow, note}

   ckEventUndo (w4-f2) takes the last live event back with POST …/events/{i}/undo {why:"mistake"}: no adapter
   uses the whole-record PUT any more (the server refuses actual_pax, self_add, reinstate and events there with 400 use_command).

   Kept as they are: ckCap / ckCeil (display only; the server works its own out), ckWrite
   (the whole-record PUT, no caller reaches it any more), and the
   dialogs (ckEventOpen, ckSelfOpen, ckReasonOpen, ckBackOpen, ckTryOpen) with their
   legacy texts. A refusal or warning is shown with the server's own message.
   Legacy mode (!O.enabled()): every wrapped function runs the original.
   Classic script · loads after 36-ops-day-actions.js (its merge helpers).
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function text(v){ return v == null ? '' : String(v).trim(); }
  function listBookings(){ return typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS) ? SB_BOOKINGS : []; }
  function findBooking(id){ var s = text(id); return s ? (listBookings().find(function(b){ return b && (b.id === s || b.opsId === s); }) || null) : null; }
  function compat(){ return window.__laOpsDayActionsCompat || {}; }
  function g(name){ return window[name]; }

  var originals = {};
  function wrap(name, fn){
    var orig = window[name];
    originals[name] = orig;
    var w = function(){
      if(!enabled()) return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
    w.__opsCheckinCmds = true;
    window[name] = w;
  }

  /* Redraw the open check-in screen from the server's answer, keeping the scroll and not blurring (ckAfter would). */
  function redraw(kind){
    var base = typeof window._ckBase === 'function' ? window._ckBase(kind) : (String(kind).indexOf('pier') === 0 ? 'pier' : 'van');
    var pier = base === 'pier';
    var host = document.getElementById(pier ? 'piercheckin-host' : 'vancheckin-host');
    if(!host || !host.offsetParent) return;
    var sy = window.scrollY || window.pageYOffset || 0;
    if(pier && typeof window.renderPierCheckin === 'function') window.renderPierCheckin();
    else if(!pier && typeof window.renderVanCheckin === 'function') window.renderVanCheckin();
    try{ window.scrollTo(0, sy); }catch(_){}
  }

  /* The one road to the server. Resolves { res, warnings } or rejects with the server's refusal (not yet shown). */
  function send(b, date, kind, method, action, body){
    var trips = Array.isArray(b && b.trips) ? b.trips : [];
    var trip = trips.find(function(t){ return t && t.date === date; }) || trips[0];
    var tripId = trip && trip.opsTripId;
    if(!tripId) return Promise.reject(new Error('This booking has no operation-backend trip on ' + date + ': save the booking first'));
    var target = compat().parseCheckinKindAndSlot ? compat().parseCheckinKindAndSlot(kind) : { kind: String(kind).indexOf('pier') === 0 ? 'pier' : 'van', slot: 0 };
    var path = '/operations/trip-ops/' + enc(tripId) + '/checkins/' + enc(target.kind) + '/' + enc(target.slot) + (action ? '/' + action : '');
    return O.queue(function(){ return O.call(method, path, body === undefined ? {} : body); }).then(function(res){
      if(res && res.trip && compat().mergeTripOperations) compat().mergeTripOperations(b, date, res.trip);
      O.wrote('trip-checkin');
      return { res: res, warnings: (res && Array.isArray(res.warnings)) ? res.warnings : [] };
    });
  }

  function refuse(title, e){ O.fail(title, e); return null; }

  /* What a warning asks of the screen. reason_needed: legacy opened its reason dialog after a short count.
     pay_owed: the server's message (legacy's own pay dialog already came before the tick; this is the safety net). */
  function warn(bkId, date, kind, warnings, opt){
    (warnings || []).forEach(function(w){
      if(w.code === 'reason_needed'){ if(typeof window.ckReasonOpen === 'function') window.ckReasonOpen(bkId, date, kind); }
      else if(w.code === 'pay_owed'){ if(!(opt && opt.skipPay)) O.toast({ kind: 'neutral', title: 'Money still to collect', status: 'PAY OWED', sub: w.message || '', id: bkId, dur: 9000 }); }
    });
  }

  function ctx(bkId){
    var b = findBooking(bkId);
    return b;
  }
  function guard(){ return typeof window.ckGuard !== 'function' || window.ckGuard(); }

  // ── ckToggle · the tick ──
  // Legacy's money dialog (pckPayGuard) comes first on the pier; the server then ticks (or unticks: a second press) and
  // answers pay_owed / reason_needed.
  wrap('ckToggle', function(orig, bkId, date, kind){
    if(!guard()) return undefined;
    var b = ctx(bkId); if(!b) return undefined;
    var skipPay = false;
    var isPier = typeof window._ckBase === 'function' ? window._ckBase(kind) === 'pier' : String(kind).indexOf('pier') === 0;
    var cur = (typeof window.ckRead === 'function' ? window.ckRead(b, date, kind) : null) || {};
    if(isPier && !cur.at && typeof window.pckPayGuard === 'function'){
      skipPay = !!(window._pckPaySkip && window._pckPaySkip[date + '::' + bkId]);
      if(window.pckPayGuard(bkId, date)) return undefined;
    }
    var wasTicked = !!cur.at;
    return send(b, date, kind, 'POST', 'check-in', {}).then(function(r){
      var owed = !wasTicked && isPier && !skipPay && (r.warnings || []).filter(function(w){ return w.code === 'pay_owed'; })[0];
      if(owed) return payOwedAsk(b, bkId, date, kind, r);
      redraw(kind); warn(bkId, date, kind, r.warnings, { skipPay: skipPay }); return r.res;
    }, function(e){ return refuse('Could not save check-in', e); });
  });

  // ── pay_owed · the server says money is still to collect on a pier tick the screen did not know about (w4-f2) ──
  // The server ticks and warns. Legacy's rule is that boarding with a debt is a decision, not an oversight (pckPayGuard): so the tick is
  // taken back (a second press), the money rows are read again and legacy's own dialog (pckPayWarn, with "ขึ้นเรือก่อน · ยังไม่เก็บ" and
  // "เก็บเงินเลย") opens. "ขึ้นเรือก่อน" then ticks again (the skip mark is set) and the boarding time is the time of that decision.
  // If the fresh money rows still show nothing due, the tick stays and the server's message is shown (toast), as before.
  function payOwedAsk(b, bkId, date, kind, r){
    var PM = window.laOpsPierMoney;
    var fresh = (PM && PM.loadDay) ? PM.loadDay(date, true) : Promise.resolve(null);
    return Promise.resolve(fresh).then(function(){
      var M = typeof window.pckMoney === 'function' ? window.pckMoney(b, date) : null;
      if(!(M && M.due > 0)){ redraw(kind); warn(bkId, date, kind, r.warnings, {}); return r.res; }
      return send(b, date, kind, 'POST', 'check-in', {}).then(function(u){      // take the tick back
        redraw(kind);
        if(typeof window.pckPayWarn === 'function') window.pckPayWarn(bkId, date);
        return u.res;
      });
    }, function(){ redraw(kind); warn(bkId, date, kind, r.warnings, {}); return r.res; }).then(null, function(e){ return refuse('Could not save check-in', e); });
  }

  // ── ckEventUndo · "ถอนรายการล่าสุด": takes the last live CXL / No-show back ── same confirm as legacy, then the undo command (w4-f2)
  // Legacy popped the event and wrote the whole record. The server keeps events append-only, so the same click marks the last live
  // event undone ("mistake") and gives its people back: POST …/events/{i}/undo {why:"mistake"}. The server works out the count.
  wrap('ckEventUndo', function(orig, bkId, date, kind){
    if(!guard()) return undefined;
    var b = ctx(bkId); if(!b) return undefined;
    var cur = (typeof window.ckRead === 'function' ? window.ckRead(b, date, kind) : null) || {};
    var evs = Array.isArray(cur.events) ? cur.events : [], ix = -1;
    for(var i = evs.length - 1; i >= 0; i--){ if(evs[i] && !evs[i].undone){ ix = i; break; } }
    if(ix < 0){ alert('ไม่มีรายการให้ถอน'); return undefined; }
    var last = evs[ix];
    if(!confirm('ถอนรายการล่าสุด?\n' + ((last.type === 'cxl') ? 'CXL' : 'No-show') + ' ' + (last.pax || 0) + ' คน · ' + ((last.at || '') + ' ' + (last.by || '')))) return undefined;
    return send(b, date, kind, 'POST', 'events/' + ix + '/undo', { why: 'mistake' }).then(function(r){
      redraw(kind); warn(bkId, date, kind, r.warnings); return r.res;
    }, function(e){
      redraw(kind);
      if(e && e.code === 'already_handled'){ alert('รายการนี้ถูกจัดการไปแล้ว'); return null; }
      return refuse('Could not take the event back', e);
    });
  });

  // ── ckStep · the +/- counter ── 409 needs_self_add opens the self-add dialog, as legacy did past the expected count
  wrap('ckStep', function(orig, bkId, date, kind, delta){
    if(!guard()) return undefined;
    var b = ctx(bkId); if(!b) return undefined;
    return send(b, date, kind, 'POST', 'count', { delta: delta > 0 ? 1 : -1 }).then(function(r){
      redraw(kind); warn(bkId, date, kind, r.warnings); return r.res;
    }, function(e){
      if(e && e.status === 409 && e.code === 'needs_self_add'){ if(typeof window.ckSelfOpen === 'function') window.ckSelfOpen(bkId, date, kind); return null; }
      redraw(kind);
      return refuse('Could not change the count', e);
    });
  });

  // ── ckEvSave · a no-show / on-site cancel ──
  wrap('ckEvSave', function(orig){
    var st = window._ckEv; if(!st || !st.bkId) return window.ckReasonClose && window.ckReasonClose();
    if(!st.code){ alert('เลือกเหตุผลก่อนครับ'); return undefined; }
    var b = ctx(st.bkId); if(!b) return window.ckReasonClose && window.ckReasonClose();
    if(!guard()) return undefined;
    var mixed = !!window._ckEvMixed;
    var n0 = typeof window._ckEvPax === 'function' ? window._ckEvPax() : 1;
    if(mixed && n0 <= 0){ alert('ระบุจำนวนก่อนครับ — กด + ที่ประเภทที่ยกเลิก (AD / CHD / INF / FOC)'); return undefined; }
    var atEl = document.getElementById('ck-reason-at'), noteEl = document.getElementById('ck-reason-note');
    var body = { type: st.type === 'cxl' ? 'cxl' : 'no_show', reason_code: st.code };
    if(mixed){ var br = window._ckEvBreak(); body.ad = br.ad; body.chd = br.chd; body.inf = br.inf; body.foc = br.foc; }
    else body.pax = Math.max(1, n0);
    var note = noteEl ? noteEl.value.trim() : ''; if(note) body.note = note;
    var at = (atEl ? atEl.value : st.at) || ''; if(at) body.at = at;
    var bkId = st.bkId, date = st.date, kind = st.kind;
    return send(b, date, kind, 'POST', 'events', body).then(function(r){
      if(window.ckReasonClose) window.ckReasonClose();
      redraw(kind); warn(bkId, date, kind, r.warnings); return r.res;
    }, function(e){ return refuse('Could not save the ' + (body.type === 'cxl' ? 'CXL' : 'No-show'), e); });   // the dialog stays open: fix the count and save again
  });

  // ── ckBackSave · take an event back (found / pressed by mistake) ──
  wrap('ckBackSave', function(orig){
    var st = window._ckBk; if(!st || !st.bkId) return window.ckReasonClose && window.ckReasonClose();
    if(!guard()) return undefined;
    var b = ctx(st.bkId); if(!b) return window.ckReasonClose && window.ckReasonClose();
    var cur = (window.ckRead(b, st.date, st.kind)) || {};
    var hit = Array.isArray(cur.events) ? cur.events[st.ix] : null;
    if(!hit || hit.undone){ alert('รายการนี้ถูกจัดการไปแล้ว'); return window.ckReasonClose && window.ckReasonClose(); }
    var noteEl = document.getElementById('ck-bk-note');
    var body = { why: st.why === 'mistake' ? 'mistake' : 'found' };
    var note = noteEl ? noteEl.value.trim() : ''; if(note) body.note = note;
    var bkId = st.bkId, date = st.date, kind = st.kind;
    return send(b, date, kind, 'POST', 'events/' + st.ix + '/undo', body).then(function(r){
      if(window.ckReasonClose) window.ckReasonClose();
      redraw(kind); warn(bkId, date, kind, r.warnings); return r.res;
    }, function(e){
      if(e && e.code === 'already_handled'){ alert('รายการนี้ถูกจัดการไปแล้ว'); if(window.ckReasonClose) window.ckReasonClose(); redraw(kind); return null; }
      return refuse('Could not take the event back', e);
    });
  });

  // ── ckTrySave · looked again, not found (no number moves) ──
  wrap('ckTrySave', function(orig){
    var st = window._ckTry; if(!st || !st.bkId) return window.ckReasonClose && window.ckReasonClose();
    if(!guard()) return undefined;
    var b = ctx(st.bkId); if(!b) return window.ckReasonClose && window.ckReasonClose();
    var cur = (window.ckRead(b, st.date, st.kind)) || {};
    var hit = Array.isArray(cur.events) ? cur.events[st.ix] : null;
    if(!hit || hit.undone){ alert('รายการนี้ถูกจัดการไปแล้ว'); return window.ckReasonClose && window.ckReasonClose(); }
    var atEl = document.getElementById('ck-try-at'), noteEl = document.getElementById('ck-try-note');
    var body = {}; var at = atEl ? atEl.value : ''; if(at) body.at = at;
    var note = noteEl ? noteEl.value.trim() : ''; if(note) body.note = note;
    var kind = st.kind;
    return send(b, st.date, kind, 'POST', 'events/' + st.ix + '/tries', body).then(function(r){
      if(window.ckReasonClose) window.ckReasonClose();
      redraw(kind); return r.res;
    }, function(e){ return refuse('Could not save this look', e); });
  });

  // ── ckSelfSave · people who missed the van came to the pier on their own ──
  wrap('ckSelfSave', function(orig){
    if(!guard()) return undefined;
    var st = window._ckSelf; if(!st || !st.bkId) return window.ckReasonClose && window.ckReasonClose();
    var b = ctx(st.bkId); if(!b) return window.ckReasonClose && window.ckReasonClose();
    var body = {}, tot = 0;
    ['ad', 'chd', 'inf', 'foc'].forEach(function(k){ body[k] = Math.max(0, +st[k] || 0); tot += body[k]; });
    if(tot <= 0) return window.ckReasonClose && window.ckReasonClose();
    var note = text((document.getElementById('ck-self-note') || {}).value); if(note) body.note = note;
    var bkId = st.bkId, date = st.date, kind = st.kind;
    return send(b, date, kind, 'POST', 'self-add', body).then(function(r){
      if(window.ckReasonClose) window.ckReasonClose();
      redraw(kind); warn(bkId, date, kind, r.warnings); return r.res;
    }, function(e){ return refuse('Could not confirm who came on their own', e); });
  });

  // ── ckPierReinstate · the customer really reached the pier ── legacy's two confirms stay
  wrap('ckPierReinstate', function(orig, bkId, date, on){
    if(!guard()) return undefined;
    var b = ctx(bkId); if(!b) return undefined;
    if(on){
      if(!confirm('ยืนยันว่าลูกค้ามาถึงท่าจริง?\n\nบันทึกของเช็คอินรถจะไม่ถูกแก้ (ยังเห็นว่าเช้าไม่ได้ขึ้นรถ)\nแถวนี้จะกลับมาเช็คอินได้ตามปกติ')) return undefined;
    } else {
      if(!confirm('ยกเลิกการยืนยัน?\n\nแถวจะกลับไปเป็น "ไม่มาทั้งใบ" ตามที่เช็คอินรถบันทึกไว้')) return undefined;
    }
    return send(b, date, 'pier', 'POST', 'reinstate', { on: !!on }).then(function(r){
      redraw('pier'); warn(bkId, date, 'pier', r.warnings); return r.res;
    }, function(e){ return refuse('Could not ' + (on ? 'confirm the arrival' : 'undo the confirmation'), e); });
  });

  // ── ckReasonSave · why people are short (moves no count) ──
  wrap('ckReasonSave', function(orig){
    if(!guard()) return undefined;
    var st = window._ckReason; if(!st || !st.bkId) return window.ckReasonClose && window.ckReasonClose();
    if(!st.code){ alert('Please pick a reason first.'); return undefined; }
    var b = ctx(st.bkId); if(!b) return window.ckReasonClose && window.ckReasonClose();
    var atEl = document.getElementById('ck-reason-at'), noteEl = document.getElementById('ck-reason-note');
    var body = { reason_code: st.code };
    var note = text(noteEl ? noteEl.value : st.note); if(note) body.reason_note = note;
    var at = text(atEl ? atEl.value : st.at); if(at) body.reason_at = at;
    var kind = st.kind;
    return send(b, st.date, kind, 'PUT', 'reason', body).then(function(r){
      if(window.ckReasonClose) window.ckReasonClose();
      redraw(kind); return r.res;
    }, function(e){ return refuse('Could not save the reason', e); });
  });

  // ── pckStageSet · ถึงท่า / เคลียร์ / ขึ้นเรือ ── pressing the step you are on steps back one
  // arrived = rank 1, cleared = rank 2, boarded (checked in) = rank 3. The server's /stage keeps arrived/cleared; a step back
  // unticks the boarding there. The boarding step itself is the check-in command (it counts people and asks for a reason).
  wrap('pckStageSet', function(orig, bkId, date, stage, kind){
    if(!guard()) return undefined;
    kind = kind || 'pier';
    var b = ctx(bkId); if(!b) return undefined;
    var cur = (window.ckRead(b, date, kind)) || {};
    var rank = window.pckStageRank, at = rank(window.pckStage(cur)), want = rank(stage);
    var to = (at === want) ? want - 1 : want;
    var steps = [];
    function stageCmd(name, on){ steps.push(function(){ return send(b, date, kind, 'POST', 'stage', { stage: name, on: on }); }); }
    if(to <= 0){ stageCmd('arrived', false); }
    else if(to === 1){
      if(at >= 2) stageCmd('cleared', false);                 // keeps arrived; unticks the boarding
      if(at < 1 || !cur.arrivedAt) stageCmd('arrived', true);
    } else if(to === 2){
      stageCmd('cleared', true);                              // cleared has arrived
      if(cur.at) steps.push(function(){ return send(b, date, kind, 'POST', 'check-in', {}); });   // from boarded: untick
    } else {
      stageCmd('cleared', true);
    }
    var warnings = [];
    var run = steps.reduce(function(p, s){ return p.then(function(){ return s().then(function(r){ warnings = warnings.concat(r.warnings); }); }); }, Promise.resolve());
    return run.then(function(){
      redraw(kind);
      if(to >= 3 && !cur.at) return window.ckToggle(bkId, date, kind);      // boarding: the tick (money dialog, reason) as a tap
      return null;
    }, function(e){ redraw(kind); return refuse('Could not save the step', e); });
  });

  // ── vckSetFlow · the van tab's status (standby / pending / none) ──
  wrap('vckSetFlow', function(orig, bkId, date, kind, val, note){
    var b = ctx(bkId); if(!b) return undefined;
    var body = { flow: val || null };
    if(note !== undefined) body.note = note || null;
    return send(b, date, kind, 'POST', 'stage', body).then(function(r){ redraw(kind); return r.res; },
      function(e){ redraw(kind); return refuse('Could not save the status', e); });
  });
})();
