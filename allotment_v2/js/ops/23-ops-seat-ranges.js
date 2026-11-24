/* ═══════════════════════════════════════════════════════════════════════════════
   §opsCapHist (2026-11-24) · a boat's seats by date range ⇄ operation-backend
   ───────────────────────────────────────────────────────────────────────────────
   Legacy (lk-inbox §capHist, 2026-11-14) keeps the ranges in BOATS[i].capHist[] = {id, from, to, cap, reason, note,
   by, at} and saves them with save('config'), which reaches no server here. The server keeps them as rows:

   GET    /v1/seat-ranges                              → every boat's capHist (after the catalogue's boats)
   POST   /v1/boats/{id}/seat-ranges                   ← a range the draft added
   PATCH  /v1/boats/{id}/seat-ranges/{range_id}        ← a range the draft changed
   DELETE /v1/boats/{id}/seat-ranges/{range_id}        ← a range the draft removed
   PATCH  /v1/boats/{id} {capacity, license_pax}       ← the seat window's own seats / registered seats

   The seat window (capMgrSave) and the charter boat form (chCapApply) stay legacy's: they edit a draft and write
   b.capHist. Here the difference between what the server holds and the new capHist is sent, one range at a time.
   The server sets each covered day's deployment seats itself (409 seats_sold asks first, as the boat form does:
   capacity_anyway). A refused or failed write reloads the boat's ranges from the server, so the screen never keeps
   seats the server does not have.
   ═══════════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var enc = encodeURIComponent;
  var held = {};          // boat id → the ranges as the server last answered them (legacy shape)

  function toLegacy(r){
    return { id: r.id, from: r.from_date, to: r.to_date || '', cap: +r.capacity || 0, reason: r.reason || '', note: r.note || '', by: r.set_by || '', at: r.set_at || '' };
  }
  function toServer(h){
    return { from_date: String(h.from || '').slice(0, 10), to_date: h.to ? String(h.to).slice(0, 10) : null, capacity: Math.round(+h.cap || 0), reason: h.reason || null, note: h.note || null };
  }
  function boatOf(id){ return (typeof getBoat === 'function') ? getBoat(id) : null; }
  function put(boatId, list){
    held[boatId] = list.map(function(h){ return Object.assign({}, h); });
    var b = boatOf(boatId); if(b) b.capHist = list.map(function(h){ return Object.assign({}, h); });
  }
  function rerender(){
    if(O.busy && O.busy()) return;
    try{ if(typeof flRenderAsset === 'function') flRenderAsset(); }catch(_){}
    try{ if(typeof renderBoats === 'function') renderBoats(); }catch(_){}
  }

  function loadAll(){
    return O.get('/v1/seat-ranges').then(function(j){
      var by = {};
      ((j && j.ranges) || []).forEach(function(r){ (by[r.boat_id] = by[r.boat_id] || []).push(toLegacy(r)); });
      (typeof BOATS !== 'undefined' ? BOATS : []).forEach(function(b){ if(b && b.id) put(b.id, by[b.id] || []); });
    }).catch(function(e){ try{ console.warn('[ops] seat ranges · ' + e.message); }catch(_){} });
  }
  function reloadBoat(boatId){
    return O.get('/v1/boats/' + enc(boatId) + '/seat-ranges').then(function(j){ put(boatId, ((j && j.ranges) || []).map(toLegacy)); rerender(); })
      .catch(function(){ return null; });
  }
  /* covered days changed seats: the board reads them from the deployments */
  function seatsMoved(){
    try{ if(O.deployments && typeof O.deployments.load === 'function') return O.deployments.load().then(function(){ O.wrote('deployments'); }); }catch(_){}
    return null;
  }

  var SOLD = { seats_sold: { flag: 'capacity_anyway', ask: function(e){ return e.message.replace(/\. Send capacity_anyway.*$/, '') + '\n\nบันทึกที่นั่งนี้ต่อ?'; } } };
  /* what to send: the server's ranges against the new capHist, by id (a range the draft made has an id the server never saw) */
  function diff(boatId, next){
    var was = held[boatId] || [], ops = [];
    var byId = {}; was.forEach(function(h){ byId[h.id] = h; });
    var keep = {};
    (next || []).forEach(function(h){
      if(!h) return;
      var old = byId[h.id];
      if(!old){ ops.push({ kind: 'add', h: h }); return; }
      keep[h.id] = 1;
      var a = toServer(old), b = toServer(h);
      if(a.from_date !== b.from_date || a.to_date !== b.to_date || a.capacity !== b.capacity || a.reason !== b.reason || a.note !== b.note) ops.push({ kind: 'edit', h: h });
    });
    was.forEach(function(h){ if(!keep[h.id]) ops.push({ kind: 'drop', h: h }); });
    // removals first, so a range moved into the place of another is never weighed against it
    return ops.sort(function(x, y){ return (x.kind === 'drop' ? 0 : 1) - (y.kind === 'drop' ? 0 : 1); });
  }
  function send(boatId, op){
    var base = '/v1/boats/' + enc(boatId) + '/seat-ranges';
    return O.anyway(function(f){
      if(op.kind === 'drop') return O.del(base + '/' + enc(op.h.id) + (f.capacity_anyway ? '?capacity_anyway=true' : ''));
      var body = Object.assign(toServer(op.h), f);
      return op.kind === 'add' ? O.post(base, body) : O.patch(base + '/' + enc(op.h.id), body);
    }, SOLD);
  }
  /* one boat's writes, in order: its own seats first (when they changed), then the ranges */
  function flush(boatId, boatBody, next){
    var ops = diff(boatId, next);
    if(!boatBody && !ops.length) return Promise.resolve(false);
    return O.queue(function(){
      var chain = Promise.resolve();
      if(boatBody) chain = chain.then(function(){
        return O.anyway(function(f){ return O.patch('/v1/boats/' + enc(boatId), Object.assign({}, boatBody, f)); }, SOLD).then(function(saved){
          var b = boatOf(boatId);
          if(b && saved){ b.cap = saved.capacity; if(saved.license_pax != null) b.licensePax = saved.license_pax; }
        });
      });
      ops.forEach(function(op){ chain = chain.then(function(){ return send(boatId, op); }); });
      return chain;
    }).then(function(){ return reloadBoat(boatId); }).then(function(){ return seatsMoved(); }).then(function(){ return true; }, function(e){
      reloadBoat(boatId); seatsMoved();
      if(!e || !e.declined) O.fail('Seats not saved', e);
      return false;
    });
  }

  /* the charter boat form and the seat window both end in chCapApply(b): it writes b.capHist from the draft */
  var pending = {};        // boat id → true when chCapApply wrote and capMgrSave will flush (its own seats first)
  var inMgr = false;
  (function(){
    var orig = window.chCapApply;
    if(typeof orig !== 'function' || orig.__ops) return;
    var w = function(b){
      var before = b && b.capHist;
      var ret = orig.apply(this, arguments);
      try{
        if(O.enabled() && b && b.id && b.capHist !== before){
          if(inMgr) pending[b.id] = true;
          else flush(b.id, null, b.capHist);
        }
      }catch(_){}
      return ret;
    };
    w.__ops = true; window.chCapApply = w;
  })();
  (function(){
    var orig = window.capMgrSave;
    if(typeof orig !== 'function' || orig.__ops) return;
    var w = function(){
      var id = window._chCapBoatId, b = boatOf(id);
      if(!O.enabled() || !b) return orig.apply(this, arguments);
      var cap0 = +b.cap || 0, lic0 = b.licensePax;
      inMgr = true; pending = {};
      var ret;
      try{ ret = orig.apply(this, arguments); } finally { inMgr = false; }
      var boatBody = null;
      if((+b.cap || 0) !== cap0 || b.licensePax !== lic0) boatBody = { capacity: +b.cap || 0, license_pax: b.licensePax != null ? +b.licensePax : null };
      if(boatBody || pending[id]) flush(id, boatBody, b.capHist);
      pending = {};
      return ret;
    };
    w.__ops = true; window.capMgrSave = w;
  })();

  /* the boats come with the catalogue: their ranges right after */
  if(O.catalogue && typeof O.catalogue.load === 'function'){
    var catalogueLoad = O.catalogue.load;
    O.catalogue.load = function(){
      return Promise.resolve(catalogueLoad.apply(this, arguments)).then(function(r){ return (O.enabled() ? loadAll() : null).then(function(){ return r; }); });
    };
  }
  O.seatRanges = { load: loadAll, reloadBoat: reloadBoat, diff: diff, toServer: toServer, toLegacy: toLegacy, flush: flush };
})();
