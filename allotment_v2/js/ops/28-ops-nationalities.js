/* ════════════════════════════════════════════════════════════════════════
   §opsNationalities (2026-10-12) · custom nationality list + cleanup on operation-backend
   ────────────────────────────────────────────────────────────────────────
   GET  /v1/nationalities           → the custom rows replace SB_CUSTOM_NATIONALITIES in memory
   POST /v1/nationalities/cleanup   → legacy's "Clean up the nationality list?" button
     · a dry run first, so the confirm shows the real counts
     · the server folds each copy of a built-in and rewrites the bookings
     · local bookings and the list change only from the folds the server answered with
     · no legacy blob write (sbNationalitiesPersist) in ops mode
   Legacy mode: mdCleanupNats is untouched and delegates when !enabled().
   Classic script · loads after 08-app.js, before 90-ops-boot.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var legacyCleanup = window.mdCleanupNats;

  function customRows(j){
    return ((j && j.nationalities) || []).filter(function(n){ return n && n.custom; })
      .map(function(n){ return { code: n.code, name: n.name, custom: true, version: n.version }; });
  }
  function setList(rows){
    if(typeof SB_CUSTOM_NATIONALITIES === 'undefined' || !Array.isArray(SB_CUSTOM_NATIONALITIES)) return;
    SB_CUSTOM_NATIONALITIES.length = 0;
    rows.forEach(function(r){ SB_CUSTOM_NATIONALITIES.push(r); });
  }
  function load(){
    return O.get('/v1/nationalities').then(function(j){ setList(customRows(j)); return j; });
  }

  // The server's folds, applied to the in-memory bookings and list. Mirrors the server's rewrite.
  function applyFolds(folds){
    var map = {};
    folds.forEach(function(f){ if(f && f.from) map[f.from] = f.into; });
    (typeof SB_BOOKINGS !== 'undefined' ? SB_BOOKINGS : []).forEach(function(b){
      if(!b) return;
      if(b.leadNationality && map[b.leadNationality]) b.leadNationality = map[b.leadNationality];
      if(Array.isArray(b.passengers)) b.passengers.forEach(function(p){
        if(p && p.nationality && map[p.nationality]) p.nationality = map[p.nationality];
      });
    });
    if(typeof SB_CUSTOM_NATIONALITIES !== 'undefined' && Array.isArray(SB_CUSTOM_NATIONALITIES)){
      setList(SB_CUSTOM_NATIONALITIES.filter(function(n){ return !map[n.code]; }));
    }
  }

  function summary(r){
    return 'Removed/merged: ' + r.removed + '\nKept (custom): ' + r.kept + '\nBookings re-pointed: ' + r.bookings_rewritten;
  }

  window.mdCleanupNats = function(){
    if(!O.enabled()) return legacyCleanup ? legacyCleanup.apply(this, arguments) : undefined;
    return O.post('/v1/nationalities/cleanup?dry_run=true', {}).then(function(preview){
      if(!confirm('Clean up the nationality list?\n\n' + summary(preview) + '\n\nFolds custom copies of built-in nationalities into them. Continue?')) return null;
      return O.queue(function(){ return O.post('/v1/nationalities/cleanup', {}); }).then(function(r){
        applyFolds(r.folds || []);
        O.wrote('nationalities');
        try{ alert('Nationality list cleaned\n\n' + summary(r)); }catch(_){}
        if(typeof renderMarketData === 'function') renderMarketData();
        return r;
      });
    }).catch(function(e){
      O.fail('Nationality cleanup refused · nothing changed', e);
      return null;
    });
  };

  O.nationalities = { load: load, applyFolds: applyFolds };
})();
