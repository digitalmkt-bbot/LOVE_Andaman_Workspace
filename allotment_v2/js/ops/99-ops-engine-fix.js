/* ══════════════════════════════════════════════════════════════════════════
   §opsEngFixOff (sync 11-13 · lk-inbox §engFix / §engFix33 / §engBase, 3cb44b89 + cde5b280 + a8924b10, 2026-11-12)
   ──────────────────────────────────────────────────────────────────────────
   Legacy js/16-engine-serial-fix.js holds two admin repairs. Both rewrote browser state and ended in flSave(), which is a
   no-op in ops mode (ops/22), so here each one either goes to operation-backend or is not offered:

   §engFix / §engFix33 (serial pairs renamed instead of swapped, Sep–Nov 2026): a one-off repair of specific legacy records
   (FL_ENGINES, FL_MAINT, FL_INCIDENTS, the engine log and Daily Fleet Log meters). It runs on lk-inbox; the nightly import
   carries the corrected records here. Not offered: flEngFixPending answers none; flEngFixOpen / Apply / Undo say why.

   §engBase (parity P2, 2026-11-27) · "N ลูก ชั่วโมงตั้งต้น 0 · ตั้งตามมิเตอร์" on the Engines tab: the server lists and sets it.
     flEngBaseList   = GET  /v1/fleet/engine-base-hours (kept for the draw; fetched again when older than a minute, then redrawn)
                       in legacy's shape { e, first, fd, last, now }, e = the FL_ENGINES record.
     flEngBaseApply  = POST /v1/fleet/engine-base-hours/apply (admin, legacy's confirm); the answer's `undo` is kept in this
                       browser's la_engbase_undo, as legacy kept its before-values, then the engines are read again.
     flEngBaseUndo   = POST /v1/fleet/engine-base-hours/undo { rows } with what the apply answered.
     flEngBaseOpen   = legacy's dialog; it borrows the serial-fix dialog's frame (flEngFixOpen), which is let through for it.
   Off unless laOps.enabled(). Load order: after js/16-engine-serial-fix.js. Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function on(){ try{ return !!(O.enabled && O.enabled()); }catch(_){ return false; } }
  var MSG = 'This engine repair runs in the legacy app (rsvn.loveandaman.com).\n'
    + 'operation-backend gets the corrected engines, jobs and meter readings from the nightly import.\n'
    + 'Nothing was changed here.';
  var inBaseOpen = false;          // flEngBaseOpen borrows flEngFixOpen's frame: let that one call through
  function none(name){
    var orig = window[name]; if(typeof orig !== 'function') return;
    window[name] = function(){ return on() ? [] : orig.apply(this, arguments); };
  }
  function refuse(name){
    var orig = window[name]; if(typeof orig !== 'function') return;
    window[name] = function(){ if(!on() || (name === 'flEngFixOpen' && inBaseOpen)) return orig.apply(this, arguments); alert(MSG); return null; };
  }
  none('flEngFixPending');
  ['flEngFixOpen', 'flEngFixApply', 'flEngFixUndo', 'flEngFix33Apply', 'flEngFix33Undo'].forEach(refuse);

  /* ── §engBase from the server ── */
  var URL = '/v1/fleet/engine-base-hours', UNDO_KEY = 'la_engbase_undo', FRESH_MS = 60000;
  var base = { rows: null, at: 0, loading: null };
  function engines(){ return (typeof FL_ENGINES !== 'undefined' && Array.isArray(FL_ENGINES)) ? FL_ENGINES : []; }
  function legacyRow(r){
    var e = engines().find(function(x){ return x && x.id === r.engine_id; })
      || { id: r.engine_id, serial: r.serial || '', boatId: r.boat_id || '', pos: r.pos || '' };
    return { e: e, first: +r.first || 0, fd: r.first_date || '', last: +r.last || 0, now: +r.now || 0 };
  }
  function redraw(){ try{ if(typeof window.flRenderAsset === 'function') window.flRenderAsset(); }catch(_){} }
  function fetchBase(){
    if(base.loading) return base.loading;
    base.loading = O.get(URL).then(function(res){
      var before = base.rows ? base.rows.length : -1;
      base.rows = ((res && res.engines) || []).slice(); base.at = Date.now(); base.loading = null;
      if(base.rows.length !== before) redraw();
      return base.rows;
    }, function(e){ base.loading = null; base.at = Date.now(); try{ console.warn('[ops] engine base hours · ' + (e && e.message)); }catch(_){} return base.rows || []; });
    return base.loading;
  }
  function wrapBase(name, fn){
    var orig = window[name]; if(typeof orig !== 'function') return;
    window[name] = function(){ return on() ? fn.apply(this, [orig].concat([].slice.call(arguments))) : orig.apply(this, arguments); };
  }
  function canEdit(){ try{ return !(typeof window.laIsAdmin === 'function') || !!window.laIsAdmin(); }catch(_){ return true; } }
  function readUndo(){ try{ return JSON.parse(localStorage.getItem(UNDO_KEY) || 'null'); }catch(_){ return null; } }
  function afterWrite(kind){
    O.wrote(kind);
    var fa = O.fleetAssets;
    return Promise.resolve(fa && fa.refetchChain ? fa.refetchChain().catch(function(){}) : null)
      .then(function(){ base.at = 0; base.rows = null; return fetchBase(); })
      .then(function(){ try{ window.flEngBaseOpen(); }catch(_){} redraw(); });
  }

  wrapBase('flEngBaseList', function(){
    if(!base.rows || Date.now() - base.at > FRESH_MS) fetchBase();
    return (base.rows || []).map(legacyRow);
  });
  wrapBase('flEngBaseOpen', function(orig){
    inBaseOpen = true;
    try{ return orig.apply(this, [].slice.call(arguments, 1)); } finally { inBaseOpen = false; }
  });
  wrapBase('flEngBaseApply', function(){
    if(!canEdit()){ alert('เฉพาะ admin แก้ได้'); return; }
    var L = window.flEngBaseList(); if(!L.length) return;
    if(!confirm('ตั้งชั่วโมงตั้งต้นของ '+L.length+' ลูก ให้เท่ามิเตอร์ครั้งแรกที่บันทึก?\n\nชั่วโมงสะสมจะเท่ากับมิเตอร์ล่าสุด · รอบเซอร์วิสเลื่อนตามให้ ระยะถึงรอบถัดไปไม่เปลี่ยน')) return;
    return O.post(URL + '/apply', {}).then(function(res){
      try{ localStorage.setItem(UNDO_KEY, JSON.stringify({ at: new Date().toISOString(), rows: (res && res.undo) || [] })); }catch(_){}
      return afterWrite('fleet-engine-base');
    }, function(e){ O.fail('ตั้งชั่วโมงตามมิเตอร์ไม่สำเร็จ', e); });
  });
  wrapBase('flEngBaseUndo', function(){
    if(!canEdit()) return;
    var U = readUndo();
    if(!U || !U.rows){ alert('ไม่มีข้อมูลสำรองในเครื่องนี้'); return; }
    if(!confirm('ยกเลิกการตั้งชั่วโมงตามมิเตอร์ของ '+U.rows.length+' ลูก?')) return;
    return O.post(URL + '/undo', { rows: U.rows }).then(function(){
      try{ localStorage.removeItem(UNDO_KEY); }catch(_){}
      return afterWrite('fleet-engine-base-undo');
    }, function(e){ O.fail('ยกเลิกการตั้งชั่วโมงไม่สำเร็จ', e); });
  });

  window.__laOpsEngFixOff = { message: MSG, engineBase: base, fetchBase: fetchBase };
})();
