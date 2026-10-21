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
  /* the red bar (legacy _laB2CHealth, fed by the pull's /api/b2c/health): the server's health object -> the keys that function reads.
     Love Kingdom pushes, so a failed run is a held order; the server says ok / consecutive failed pushes / minutes the oldest has waited. An older
     server sends no health: the bar stays off. */
  function healthFor(j){
    var h=j&&j.health; if(!h||typeof h!=='object') return null;
    return {configured:h.configured!==false, ok:h.ok!==false, neverOk:false, staleMin:h.stale_minutes==null?null:Number(h.stale_minutes),
      consecutive:Number(h.consecutive)||0, phase:h.phase||'', message:h.message||''};
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
      var h=healthFor(j); if(h && typeof window._laB2CHealth==='function') window._laB2CHealth(h);
    }, function(){ busy=false; });
  }
  function start(){ if(timer||!O.enabled()) return; poll(); timer=setInterval(poll, POLL_MS); }

  window.laOpsB2CIssues=open;
  window.laOpsHeldAct=heldAct;
  window.laOpsHeldBtn=function(el){ return heldAct(el.getAttribute('data-h'), el.getAttribute('data-c')); };
  O.b2cHealth={heldAct:heldAct, rows:rows, badge:badge, healthFor:healthFor, poll:poll, start:start};
  if(typeof document!=='undefined'){
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
  }
})();

/* ══════════════════════════════════════════════════════════════════════════
   §opsB2CReview · "B2C changes" (§b2cChg: row strip, head chip, side drawer) <-> operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Legacy read the history lines `b2c` / `b2c_new` after the last `b2c_seen` in each loaded booking. Bookings are not preloaded
   here, so the server keeps the list (README "B2C change reviewed"; Love Kingdom's push writes the lines, staff's edits write none):

   GET  /v1/bookings/b2c-unreviewed -> {count, items[{booking_id, code, voucher_ref, lead_pax, status, route_id, service_date,
                                       pax_total, kind: new|changed|cancelled, pending{at, segs[{label,vals}], extras, is_new,
                                       new_text, cancelled, moved, n}}]}   only orders still to travel
   POST /v1/bookings/{id}/b2c-seen  -> "Reviewed" on one order (409 nothing_to_review = someone else did it first)
   POST /v1/bookings/b2c-seen       -> "Mark all as seen" -> {reviewed[], count}

   - this file polls the list, loads any listed booking the browser does not hold, and answers
     bookingV2B2CPending / bookingV2B2CList from it (folding, undo and the 2-day "new" rule are the server's);
   - Reviewed / Mark all are server-first: the row leaves the screen only after the server said yes;
   - the history lines themselves (kinds b2c, b2c_new, b2c_seen) arrive with GET /v1/bookings/{id}/history (40-ops-bookings.js).
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O=window.laOps; if(!O) return;
  var POLL_MS=60000, timer=null, busy=null, dirty=false;
  var pend=null;                       // server booking id -> pending (the shape bookingV2B2CPending returns) · null until the first answer
  var dates={};                        // server booking id -> service_date, for a booking whose trips are not loaded

  function live(){ return O.enabled() && pend!==null; }
  function enc(x){ return encodeURIComponent(x==null?'':String(x)); }
  function list(){ return (typeof SB_BOOKINGS!=='undefined' && SB_BOOKINGS) || []; }
  function byOps(sid){ return list().find(function(b){ return b && (b.opsId===sid || b.id===sid); }); }
  function byLocal(id){ return list().find(function(b){ return b && b.id===id; }); }
  function mapPending(p){
    return {at:p.at||'', segs:(p.segs||[]).map(function(s){ return {label:s.label, vals:(s.vals||[]).slice()}; }),
      extras:(p.extras||[]).slice(), isNew:!!p.is_new, newText:p.new_text||'', cancelled:!!p.cancelled, moved:!!p.moved, n:+p.n||0};
  }
  function after(){ if(typeof window.bookingV2B2CAfter==='function') window.bookingV2B2CAfter(); }
  function redrawWhenIdle(){ if(dirty && !O.busy()){ dirty=false; try{ after(); }catch(_){} } }   // never redraw under a person typing

  function refresh(){
    if(busy) return busy;
    if(!O.enabled()) return Promise.resolve(false);
    busy=O.get('/v1/bookings/b2c-unreviewed').then(function(j){
      var items=(j&&j.items)||[];
      // a listed order the browser has not loaded (bookings are fetched by range) is fetched once so its row and drawer card can draw
      var fetches=items.filter(function(i){ return !byOps(i.booking_id); }).map(function(i){
        return O.get('/v1/bookings/'+enc(i.booking_id)).then(function(ob){
          if(ob && O.bookings && O.bookings.upsert) O.bookings.upsert(ob);
        }, function(){});
      });
      return Promise.all(fetches).then(function(){
        try{ if(fetches.length && typeof window.bookingV2PersistBookings==='function') window.bookingV2PersistBookings(); }catch(_){}
        return items;
      });
    }).then(function(items){
      var next={}; dates={};
      items.forEach(function(i){ if(i.pending){ next[i.booking_id]=mapPending(i.pending); dates[i.booking_id]=i.service_date||''; } });
      if(JSON.stringify(next)!==JSON.stringify(pend)) dirty=true;
      pend=next; busy=null; redrawWhenIdle();
      return true;
    }, function(e){
      busy=null;
      console.warn('[ops] B2C changes did not load; the legacy reading of the loaded history stays', e&&e.message);
      return false;
    });
    return busy;
  }

  /* the reading of one booking · the server's, once it has answered */
  var origPending=window.bookingV2B2CPending;
  if(typeof origPending==='function' && !origPending.__ops){
    var wp=function(bk){
      if(!live()) return origPending.apply(this, arguments);
      return (bk && bk.opsId && pend[bk.opsId]) || null;
    };
    wp.__ops=true; window.bookingV2B2CPending=wp;
  }
  /* the drawer and the head chip: every listed order, whatever its id looks like (Love Kingdom's own start LOV-, not b2c_) */
  var origList=window.bookingV2B2CList;
  if(typeof origList==='function' && !origList.__ops){
    var wl=function(){
      if(!live()) return origList.apply(this, arguments);
      var out=[];
      list().forEach(function(bk){
        var p=bk && bk.opsId && pend[bk.opsId]; if(!p) return;
        var d=(typeof window.bookingV2B2CTripDate==='function' && window.bookingV2B2CTripDate(bk)) || dates[bk.opsId] || '';
        if(!d) return;
        out.push({bk:bk, p:p, date:d});
      });
      return out;
    };
    wl.__ops=true; window.bookingV2B2CList=wl;
  }

  /* Reviewed on one order · server first (POST /v1/bookings/{id}/b2c-seen) · resolves true when the order is settled */
  var origSeen=window.bookingV2B2CSeen;
  if(typeof origSeen==='function' && !origSeen.__ops){
    var ws=function(id, quiet){
      if(!live()) return origSeen.apply(this, arguments);
      if(typeof acctCanEditBookings==='function' && !acctCanEditBookings()){ if(!quiet) alert('View only - cannot mark as seen'); return false; }
      var bk=byLocal(id); if(!bk || !bk.opsId || !pend[bk.opsId]) return false;
      var sid=bk.opsId;
      return O.queue(function(){ return O.post('/v1/bookings/'+enc(sid)+'/b2c-seen'); }).then(function(){ return true; }, function(e){
        if(e && e.status===409 && e.code==='nothing_to_review') return true;       // someone reviewed it first: it is gone for everyone
        O.fail('B2C change not marked as reviewed', e); return false;
      }).then(function(ok){
        if(ok) delete pend[sid];
        if(!quiet){ after(); refresh(); }
        return ok;
      });
    };
    ws.__ops=true; window.bookingV2B2CSeen=ws;
  }
  /* "Mark all as seen" · the same confirm, then POST /v1/bookings/b2c-seen for every unreviewed order */
  var origAll=window.bookingV2B2CSeenAll;
  if(typeof origAll==='function' && !origAll.__ops){
    var wa=function(){
      if(!live()) return origAll.apply(this, arguments);
      var L=window.bookingV2B2CList(); if(!L.length) return;
      if(!confirm('Mark all '+L.length+' B2C changes as seen?')) return;
      return O.queue(function(){ return O.post('/v1/bookings/b2c-seen'); }).then(function(r){
        pend={};
        O.toast({ kind:'success', title:'B2C changes marked as seen', status:'OK', sub:((r&&r.count)||0)+' booking(s)', dur:3000 });
      }, function(e){ O.fail('B2C changes not marked as seen', e); }).then(function(){ after(); refresh(); });
    };
    wa.__ops=true; window.bookingV2B2CSeenAll=wa;
  }

  function start(){
    if(timer||!O.enabled()) return;
    refresh();
    timer=setInterval(function(){
      if(typeof document!=='undefined' && document.hidden) return;
      redrawWhenIdle(); refresh();
    }, POLL_MS);
  }
  O.b2cReview={refresh:refresh, start:start, mapPending:mapPending};
  if(typeof document!=='undefined'){
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
  }
})();
