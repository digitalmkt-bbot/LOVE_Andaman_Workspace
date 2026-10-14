/* ══════════════════════════════════════════════════════════════════════════
   §opsB2CHealth · the orange "B2C bookings to check" panel <-> operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Legacy fed the badge from /api/version and the list from /api/b2c/health. Neither exists here.
   The server computes the issues (and the signature the dismiss button remembers):

   GET /v1/b2c/issues -> {held_orders[], issues[{booking_id,external_id,service_date,code,
                          severity,message}], counts{held,warn,info}, signature}

   - the badge: this file polls it and calls window._laB2CIssues({issueCount, issueSig});
   - the list: _laB2CIssuesOpen (01-auth-sync.js) asks window.laOpsB2CIssues(ok, fail).
   Held orders (B2C orders that could not be stored) get their own section: Resolve / Dismiss.
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

  /* ---- held orders: list + Resolve / Dismiss (server-first) ----
     GET /v1/b2c/held-orders?status=open -> {held_orders[{id,external_id,problem,status,...}]}
     POST /v1/b2c/held-orders/:id/resolve|dismiss  {note?}  (409 wrong_status = already settled) */
  function esc(x){ return String(x==null?'':x).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function heldHtml(list){
    return '<div style="padding:7px 12px 5px;font-size:11px;font-weight:800;letter-spacing:.06em">Held orders (not booked) &middot; '+list.length+'</div>'
      +list.map(function(h){
        var id=esc(h.id);
        return '<div class="la-b2ci-warn la-b2ci-held" data-held="'+id+'" style="display:flex;gap:10px;padding:7px 12px;border-bottom:1px solid #F3E7CC;align-items:baseline">'
          +'<b style="font-family:monospace;white-space:nowrap">'+esc(h.external_id||h.id)+'</b>'
          +'<span style="flex:1">'+esc(h.problem||'')+'</span>'
          +'<button type="button" data-h="'+id+'" data-c="resolve" onclick="laOpsHeldBtn(this)">Resolve</button> '
          +'<button type="button" data-h="'+id+'" data-c="dismiss" onclick="laOpsHeldBtn(this)">Dismiss</button></div>';
      }).join('');
  }
  function paintHeld(list){
    if(typeof document==='undefined') return;
    var box=document.getElementById('la-b2c-issues-list'); if(!box) return;
    var sec=document.getElementById('la-b2c-held');
    if(!list.length){ if(sec) sec.remove(); return; }
    if(!sec){
      if(!box.querySelector('.la-b2ci-warn,.la-b2ci-ok')) box.innerHTML='';   /* drop the "nothing left" line */
      sec=document.createElement('div'); sec.id='la-b2c-held'; box.appendChild(sec);
    }
    sec.innerHTML=heldHtml(list);
  }
  function listHeld(){ return O.get('/v1/b2c/held-orders?status=open').then(function(j){ return (j&&j.held_orders)||[]; }); }
  function relist(){
    return listHeld().then(paintHeld, function(e){ O.fail('Could not reload held orders', e); }).then(function(){ poll(); });
  }
  /* decide one held order; the screen changes only after the server answered, then the list is re-read */
  function heldAct(id, cmd){
    if(cmd!=='resolve' && cmd!=='dismiss') return Promise.resolve(false);
    if(cmd==='dismiss' && typeof window.confirm==='function' && !window.confirm('Dismiss held order '+id+'? It will not be booked.')) return Promise.resolve(false);
    return O.queue(function(){
      return O.post('/v1/b2c/held-orders/'+encodeURIComponent(id)+'/'+cmd, {});
    }).then(function(){
      O.toast({ kind: 'success', title: 'Held order '+(cmd==='resolve'?'resolved':'dismissed'), status: 'OK', id: id, dur: 3000 });
      return relist().then(function(){ return true; });
    }, function(e){ O.fail('Held order '+cmd+' failed', e); return relist().then(function(){ return false; }); });
  }

  function open(ok, fail){
    if(!O.enabled()){ if(fail) fail(); return; }
    O.get('/v1/b2c/issues').then(function(j){
      ok({issues:rows(j).filter(function(r){ return r.code!=='held_order'; })});
      listHeld().then(paintHeld, function(){});
    }, function(e){ if(fail) fail(e); });
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
  window.laOpsHeldAct=heldAct;
  window.laOpsHeldBtn=function(el){ return heldAct(el.getAttribute('data-h'), el.getAttribute('data-c')); };
  O.b2cHealth={heldAct:heldAct, rows:rows, badge:badge, poll:poll, start:start};
  if(typeof document!=='undefined'){
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
  }
})();
