/* ═════════════════════════════════════════════════════════════════════════
   §opsNotYet (2026-10-28) · lk-inbox features that arrived with the 10-27 sync (#31) but that
   operation-backend does not save yet. Each one writes the legacy blob, which is local-only here, so
   staff would see a save that is gone on the next reload. In ops mode they are refused with a plain
   message instead (or, for a banner that only leads to one, not drawn). Remove a block when its
   adapter or endpoint lands.
     · §cxWhy      cancellation reason for a booking already cancelled (banner, detail card, dialog)
     · §poXfer     Pier Office: transfer equipment to another pier, receive it, cancel it
     · §tcxPartner cancelled trip → "Send to partner" and its per-booking partner entries
     · §flnWd      Fleet Work › Add work: withdraw parts from stock while creating the job
   Loaded after every other ops adapter (just before 90-ops-boot.js), so these wrappers run first.
   ═════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps;
  if(!O) return;

  function refuse(what){
    alert(what + ' is not available yet: operation-backend does not save it, so it would be lost on reload.');
    return false;
  }
  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsNotYet) return;
    var w = function(){ if(!O.enabled()) return orig.apply(this, arguments); return fn.apply(this, [orig].concat([].slice.call(arguments))); };
    w.__opsNotYet = true; window[name] = w;
  }
  function block(names, what){ names.forEach(function(n){ wrap(n, function(){ return refuse(what); }); }); }

  /* §cxWhy · the banner and the detail card only lead to the dialog: not drawn */
  wrap('cxwBanner', function(){ return ''; });
  wrap('cxwDetailCard', function(){ return ''; });
  block(['cxwOpen', 'cxwSave'], 'Entering a reason for an already cancelled booking');

  /* §poXfer */
  block(['poXferOpen', 'poXferSave', 'poXferRecvOpen', 'poXferRecvSave', 'poXferCancel'], 'Transferring equipment to another pier');

  /* §tcxPartner · the other results of the cancelled-trip dialog are unchanged */
  wrap('tcxDlgSet', function(orig, key, val){
    if(key === 'out' && val === 'partner') return refuse('Send to partner');
    return orig.apply(this, [].slice.call(arguments, 1));
  });
  block(['tcxPtSet', 'tcxPtPickName', 'tcxPtVan', 'tcxPtApply', 'tcxPtUndo'], 'Send to partner');

  /* §flnWd · the job itself is still created; parts are withdrawn from the job page afterwards */
  block(['flnWdAdd'], 'Withdrawing parts while adding work (create the job, then withdraw from its page)');
})();
