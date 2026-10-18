/* ═════════════════════════════════════════════════════════════════
   §opsPierMove (w5-d, 2026-10-18) · Pier "ย้ายลำ" (emergency boat move) from the server

   Legacy decides in the browser who may move a boat (laCanAct('act-pckmove')), which boats are on the list and their load / capacity /
   "เกิน cap" / "เต็ม" (pckMoveCtx), and on Save writes the boat and a history line itself (pckMoveSave). The server decides all of it:

     GET  /operations/trip-ops/{trip}/pier-move   { may_move, current_boat_id, current_boat_name, pax,
                                                    options: [{ boat_id, name, capacity, load, next, over, block }] }
          409 not_movable (a charter booking or one split across boats): the message is legacy's alert text
     POST /operations/trip-ops/{trip}/pier-move   { boat_id, reason, note? } -> { trip, over_capacity }
          403 forbidden, 409 boat_full / boat_not_deployed / cancelled, 400 reason / note: the message shows in the dialog as it is.
          The booking's history line is the server's.

   pckMoveOpen asks the GET first (the dialog opens when the answer is in), then legacy's dialog draws from it:
     pckMoveCan()        the answer's may_move (legacy's laCanAct hint until the first answer)
     pckMoveCtx()        the answer's boats and numbers (the "ของที่เบิกไปแล้ว" warning is the pier office's stock, still read locally)
     pckMoveSave()       POST pier-move; the dialog closes when the server took it, and shows the server's refusal otherwise
   The three pre-checks in the dialog (pick a boat, pick a reason, "other" needs a note) are legacy's own words, shown at once;
   the server judges the same things again.

   Load order: after 37-ops-boat-assign.js (its pckMoveSave wrapper is replaced here). Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var originals = {}, ctxs = {}, lastMay = null;
  var TTL = 60000;

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function enc(x){ return encodeURIComponent(x == null ? '' : String(x)); }
  function g(name){ try{ return window[name]; }catch(_){ return undefined; } }
  function byId(id){ var l = typeof SB_BOOKINGS !== 'undefined' && Array.isArray(SB_BOOKINGS) ? SB_BOOKINGS : []; return l.filter(function(b){ return b && b.id === id; })[0] || null; }
  function pckDate(){ try{ return typeof _pckDate !== 'undefined' ? _pckDate : ''; }catch(_){ return ''; } }
  function tripOf(b, date){ return b && typeof g('ckTripOn') === 'function' ? window.ckTripOn(b, date) : null; }
  function keyOf(bkId, date){ return bkId + '|' + date; }

  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function') return;
    originals[name] = orig;
    window[name] = function(){
      if(!enabled()) return orig.apply(this, arguments);
      var r;
      try{ r = fn.call(this, orig, arguments); }catch(e){ if(window.console) console.warn('[ops] pier move · ' + name + ' · ' + (e && e.message)); r = undefined; }
      return r === undefined ? orig.apply(this, arguments) : r;
    };
  }
  function fresh(bkId, date){
    var c = ctxs[keyOf(bkId, date)];
    return c && Date.now() - c.at < TTL ? c : null;
  }

  /* the read: the dialog opens when it is in */
  function load(bkId, date){
    var b = byId(bkId), t = tripOf(b, date);
    if(!b || !t || !t.opsTripId) return Promise.resolve(null);
    return O.get('/operations/trip-ops/' + enc(t.opsTripId) + '/pier-move').then(function(res){
      if(res && typeof res.may_move === 'boolean') lastMay = res.may_move;
      return (ctxs[keyOf(bkId, date)] = { at: Date.now(), data: res || null, err: '' });
    }, function(e){
      if(e && e.status === 409) return (ctxs[keyOf(bkId, date)] = { at: Date.now(), data: null, err: String(e.message || 'Cannot move this booking here') });
      if(e && e.status === 403){ lastMay = false; return (ctxs[keyOf(bkId, date)] = { at: Date.now(), data: null, err: '', denied: true }); }
      return null;                                                // anything else: legacy's own dialog
    });
  }
  wrap('pckMoveOpen', function(orig, a){
    var bkId = a[0], date = pckDate(), self = this;
    if(!byId(bkId)) return undefined;
    load(bkId, date).then(function(){ orig.call(self, bkId); }, function(){ orig.call(self, bkId); });
    return null;
  });

  wrap('pckMoveCan', function(){ return lastMay === null ? undefined : lastMay; });

  wrap('pckMoveCtx', function(orig, a){
    var bkId = a[0], date = a[1], c = fresh(bkId, date); if(!c) return undefined;
    if(c.err) return { err: c.err, errEn: c.err };
    if(!c.data) return undefined;
    var b = byId(bkId), t = tripOf(b, date); if(!b || !t) return undefined;
    var d = typeof g('bkOpsDate') === 'function' ? window.bkOpsDate(b, date) : date;
    var D = c.data, base = orig.apply(this, a) || {};
    return { b: b, t: t, d: d, cur: D.current_boat_id || '', curName: D.current_boat_name || '', pax: +D.pax || 0,
      opts: (D.options || []).map(function(o){ return { id: o.boat_id, name: o.name || o.boat_id, cap: +o.capacity || 0, load: +o.load || 0, next: +o.next || 0, over: !!o.over, block: !!o.block }; }),
      issued: +base.issued || 0, tol: +base.tol || 2 };
  });

  /* Save: the server first; the dialog closes when it took it, shows its words when it did not */
  function err(text){ var x = document.getElementById('pmverr'); if(x) x.textContent = text; return false; }
  wrap('pckMoveSave', function(orig, a){
    var bkId = a[0], date = pckDate(), b = byId(bkId), t = tripOf(b, date);
    if(!b || !t || !t.opsTripId) return undefined;
    if(typeof g('ckGuard') === 'function' && !window.ckGuard()) return false;
    var pick = document.querySelector('#pck-move input[name=pmvb]:checked');
    if(!pick) return err('เลือกลำที่จะย้ายไป');
    var why = (document.getElementById('pmvwhy') || {}).value || '', note = String((document.getElementById('pmvnote') || {}).value || '').trim();
    if(!why) return err('เลือกเหตุผล');
    if(why === 'other' && !note) return err('เหตุผล "อื่น ๆ" ต้องพิมพ์รายละเอียด');
    var body = { boat_id: pick.value, reason: why }; if(note) body.note = note;
    var drawer = !!document.getElementById('pck-drawer');
    O.queue(function(){ return O.post('/operations/trip-ops/' + enc(t.opsTripId) + '/pier-move', body); }).then(function(res){
      if(res && res.trip && O.boats && O.boats.applyOps) O.boats.applyOps(b, typeof g('bkOpsDate') === 'function' ? window.bkOpsDate(b, date) : date, res.trip.operations);
      delete ctxs[keyOf(bkId, date)];
      if(typeof g('pckMoveClose') === 'function') window.pckMoveClose();
      O.wrote('trip-ops');
      if(typeof g('ckAfter') === 'function') window.ckAfter('pier'); else if(typeof g('renderPierCheckin') === 'function') window.renderPierCheckin();
      if(drawer && document.getElementById('pck-drawer') && typeof g('pckDetailOpen') === 'function') window.pckDetailOpen(bkId);
    }, function(e){
      delete ctxs[keyOf(bkId, date)];
      err(String((e && e.message) || 'The boat was not moved'));
    });
    return true;
  });

  O.pierMove = { load: load };
})();
