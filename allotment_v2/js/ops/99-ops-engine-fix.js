/* ══════════════════════════════════════════════════════════════════════════
   §opsEngFixOff (sync 11-13 · lk-inbox §engFix / §engFix33 / §engBase, 3cb44b89 + cde5b280 + a8924b10, 2026-11-12)
   ──────────────────────────────────────────────────────────────────────────
   Legacy js/16-engine-serial-fix.js is a one-off, admin-only repair of specific legacy records (engine pairs whose serials
   were renamed instead of swapped, Sep–Nov 2026; base hours from the first meter reading): it rewrites FL_ENGINES, FL_MAINT,
   FL_INCIDENTS, the engine log and Daily Fleet Log meters in the browser, keeps its undo in this device's storage, and ends in
   flSave(). In ops mode flSave is a no-op (ops/22), so the chips would "work" and nothing would reach operation-backend.

   The repair belongs where those records live today: run it on lk-inbox; the nightly import carries the corrected engines,
   jobs and meters into operation-backend. Here the chips are not offered (flEngFixPending / flEngBaseList answer none) and
   the apply / undo / open entry points say why instead of changing anything. Not a port: listed on the sync PR.
   Off unless laOps.enabled(). Load order: after js/16-engine-serial-fix.js. Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  function on(){ try{ return !!(O.enabled && O.enabled()); }catch(_){ return false; } }
  var MSG = 'This engine repair runs in the legacy app (rsvn.loveandaman.com).\n'
    + 'operation-backend gets the corrected engines, jobs and meter readings from the nightly import.\n'
    + 'Nothing was changed here.';
  function none(name){
    var orig = window[name]; if(typeof orig !== 'function') return;
    window[name] = function(){ return on() ? [] : orig.apply(this, arguments); };
  }
  function refuse(name){
    var orig = window[name]; if(typeof orig !== 'function') return;
    window[name] = function(){ if(!on()) return orig.apply(this, arguments); alert(MSG); return null; };
  }
  ['flEngFixPending', 'flEngBaseList'].forEach(none);
  ['flEngFixOpen', 'flEngFixApply', 'flEngFixUndo', 'flEngFix33Apply', 'flEngFix33Undo', 'flEngBaseOpen', 'flEngBaseApply', 'flEngBaseUndo'].forEach(refuse);
  window.__laOpsEngFixOff = { message: MSG };
})();
