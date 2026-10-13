/* ══════════════════════════════════════════════════════════════════════════
   §opsB2CHealth · the orange "B2C bookings to check" panel <-> operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Legacy fed the badge from /api/version and the list from /api/b2c/health. Neither exists here.
   The server computes the issues (and the signature the dismiss button remembers):

   GET /v1/b2c/issues -> {held_orders[], issues[{booking_id,external_id,service_date,code,
                          severity,message}], counts{held,warn,info}, signature}

   - the badge: this file polls it and calls window._laB2CIssues({issueCount, issueSig});
   - the list: _laB2CIssuesOpen (01-auth-sync.js) asks window.laOpsB2CIssues(ok, fail).
   A held order (a B2C order that could not be stored) is listed as a row too, so ops see it.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O=window.laOps; if(!O) return;
  var POLL_MS=30000, timer=null, busy=false;

  /* server answer -> the rows the panel draws: {id (booking), ref, msg, code} */
  function rows(j){
    var out=[];
    ((j&&j.held_orders)||[]).forEach(function(h){
      out.push({id:h.booking_id||'', ref:h.external_id||h.id, msg:'Held order: '+(h.problem||''), code:'held_order'});
    });
    ((j&&j.issues)||[]).forEach(function(i){
      out.push({id:i.booking_id, ref:i.external_id||i.booking_id, msg:i.message, code:i.code});
    });
    return out;
  }
  function badge(j){
    var c=(j&&j.counts)||{};
    return {issueCount:(Number(c.held)||0)+(Number(c.warn)||0), issueSig:(j&&j.signature)||''};
  }

  function open(ok, fail){
    if(!O.enabled()){ if(fail) fail(); return; }
    O.get('/v1/b2c/issues').then(function(j){ ok({issues:rows(j)}); }, function(e){ if(fail) fail(e); });
  }

  function poll(){
    if(busy || !O.enabled() || (typeof document!=='undefined' && document.hidden)) return;
    busy=true;
    O.get('/v1/b2c/issues').then(function(j){
      busy=false;
      if(typeof window._laB2CIssues==='function') window._laB2CIssues(badge(j));
    }, function(){ busy=false; });
  }
  function start(){ if(timer||!O.enabled()) return; poll(); timer=setInterval(poll, POLL_MS); }

  window.laOpsB2CIssues=open;
  O.b2cHealth={rows:rows, badge:badge, poll:poll, start:start};
  if(typeof document!=='undefined'){
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
  }
})();
