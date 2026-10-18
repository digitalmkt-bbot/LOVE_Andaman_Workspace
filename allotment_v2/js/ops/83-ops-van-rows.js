/* ═════════════════════════════════════════════════════════════════
   §opsVanRows (w5-d, 2026-10-18) · Van Check-in: each row's status and the order of the rows in a van, from GET /v1/van-checkin

   74-ops-van-checkin.js already puts the server's KPI chips, van order, zone bands and "not yet in a van" list on the sheet.
   Two more things were still legacy's arithmetic:

     vckRowSt(ck)      the row's status (wait / standby / pending / checkin / cxl / noshow / pier), read from the check-in record
                       -> rows[].status of the answer (README "The Van Check-in numbers": the last live event decides when nobody is
                          left aboard, then a ticked-in row, then the event, then the flow)
     ckRowCmp(a, b)    the order of the rows inside a van (sequence, pickup time, voucher, part)
                       -> the position of each row in the answer's rows[] (they come in the screen's order). Only while the Van
                          Check-in sheet draws: the Pier sheet sorts with the same function but in its own order.

   A check-in record knows its trip and slot (hidden _slotKey, set where the trip receives its block: 74-ops-aboard-calls.js),
   which is how a record is matched to a server row. Until the first answer, after a write (the answer is dropped by
   74-ops-van-checkin.js), for a record that is not on the answer, and offline, legacy's own reading answers.
   The pills (programme / route) are the same value the answer is asked with; the text search is the client's (README).

   Load order: after 74-ops-van-checkin.js and 74-ops-aboard-calls.js. Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function enabled(){ return !!(O.enabled && O.enabled()); }

  var idx = typeof WeakMap === 'function' ? new WeakMap() : null;
  function indexOf(data){
    var hit = idx && idx.get(data); if(hit) return hit;
    var by = {}, pos = {};
    (data.rows || []).forEach(function(r, i){ var k = r.trip_id + '|' + (r.slot || 0); by[k] = r; pos[k] = i; });
    var out = { by: by, pos: pos };
    if(idx) idx.set(data, out);
    return out;
  }
  function answer(){
    var VC = O.vanCheckin; if(!VC || typeof VC.current !== 'function') return null;
    var c = VC.current(); return (c && c.data && Array.isArray(c.data.rows)) ? c.data : null;
  }
  function keyOfRecord(ck){
    var k = ck && ck._slotKey; if(!k || k.side !== 'van' || !k.trip || !k.trip.opsTripId) return null;
    return k.trip.opsTripId + '|' + (k.slot || 0);
  }
  function keyOfSheetRow(r){
    if(!r || !r.t || !r.t.opsTripId) return null;
    var slot = r.sp && r.sp.opsIdx != null ? +r.sp.opsIdx : (r.si != null ? +r.si : 0);
    return r.t.opsTripId + '|' + slot;
  }

  var vanDrawing = 0, drawnSig = null, syncing = false;
  /* what the answer says about the rows (status and place), compared with what the last draw used: when they differ the sheet draws once more */
  function answerSig(){
    var d = answer(); if(!d) return null;
    return (d.rows || []).map(function(r){ return r.trip_id + '|' + (r.slot || 0) + '|' + r.status; }).join(',');
  }
  function visible(){ var h = document.getElementById('vancheckin-host'); return !!(h && h.offsetParent); }
  function sync(){
    if(!enabled() || vanDrawing || syncing || !visible() || (O.busy && O.busy())) return;
    var sig = answerSig(); if(sig == null || sig === drawnSig) return;
    if(typeof window.renderVanCheckin !== 'function') return;
    syncing = true;
    var sy = window.scrollY || window.pageYOffset || 0;
    try{ window.renderVanCheckin(); window.scrollTo(0, sy); }catch(e){ if(window.console) console.warn('[ops] van rows · redraw · ' + (e && e.message)); }
    finally { syncing = false; }
  }
  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsVanRows) return;
    var w = function(){
      if(!enabled()) return orig.apply(this, arguments);
      var r;
      try{ r = fn.call(this, orig, arguments); }catch(e){ if(window.console) console.warn('[ops] van rows · ' + name + ' · ' + (e && e.message)); r = undefined; }
      return r === undefined ? orig.apply(this, arguments) : r;
    };
    w.__opsVanRows = true; window[name] = w;
  }

  wrap('vckRowSt', function(orig, a){
    var k = keyOfRecord(a[0]); if(!k) return undefined;
    var d = answer(); if(!d) return undefined;
    var row = indexOf(d).by[k];
    return row && row.status ? String(row.status) : undefined;
  });

  wrap('ckRowCmp', function(orig, a){
    if(!vanDrawing) return undefined;
    var d = answer(); if(!d) return undefined;
    var ix = indexOf(d), ka = keyOfSheetRow(a[0]), kb = keyOfSheetRow(a[1]);
    if(ka == null || kb == null || ix.pos[ka] == null || ix.pos[kb] == null) return undefined;
    return ix.pos[ka] - ix.pos[kb];
  });

  /* the Van sheet is drawing: ckRowCmp sorts in the van's order only now */
  var drawFn = window.renderVanCheckin;
  if(typeof drawFn === 'function' && !drawFn.__opsVanRowsDraw){
    var w2 = function(){
      vanDrawing++;
      try{ return drawFn.apply(this, arguments); } finally { vanDrawing--; if(!vanDrawing) drawnSig = enabled() ? answerSig() : null; }
    };
    w2.__opsVanRowsDraw = true;
    // keep whatever other wrappers added to the function (properties are not copied by design: they are flags)
    window.renderVanCheckin = w2;
  }
  O.vanRows = { sync: sync };
})();
