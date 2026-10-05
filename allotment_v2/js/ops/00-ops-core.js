/* ══════════════════════════════════════════════════════════════════════════
   §opsApi (2026-10-05) · operation-backend client · shared core
   ──────────────────────────────────────────────────────────────────────────
   Every operation-backend endpoint is wired from js/ops/*.js. This file is the
   plumbing they share:

     laOps.enabled()      on only when server.js is out of the picture
                          (LA_LEGACY_UNAVAILABLE) and a login token exists
     laOps.get/post/...   JSON in, JSON out · a refused call throws LaOpsError
                          carrying the server's {statusCode, message, code}
     laOps.queue(fn)      ONE write at a time, in order. Locks must exist on the
                          server before a booking draws from them, and a charter
                          boat must be deployed before the charter is saved.
                          Never call queue() from inside a queued fn (deadlock)
                          · use the un-queued helpers there.
     laOps.runBatch(ops)  several calls as one unit · if one fails, the ones
                          already done are undone in reverse (best effort)
     laOps.fail(title,e)  the server's message, to a person, as a red toast

   "Server first" (user's call, 2026-10-05): a write the server refuses must
   not stay on screen. Booking actions ask the server before touching local
   state. Bulk writers (commit, locks, Boat Operation) snapshot, run, sync,
   and restore the snapshot if the server says no.

   Load order: after js/booking/*.js, before 11-router.js. Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  function token(){ try{ return sessionStorage.getItem('la_ops_token') || ''; }catch(_){ return ''; } }
  function enabled(){ return !!window.LA_LEGACY_UNAVAILABLE && typeof window.laOpsFetch === 'function' && !!token(); }

  function LaOpsError(status, body, path){
    var msg = (body && (body.message || body.error)) || ('HTTP ' + status);
    var e = new Error(msg);
    e.name = 'LaOpsError'; e.status = status; e.code = (body && body.code) || ''; e.path = path || '';
    return e;
  }

  function call(method, path, body){
    var opts = { method: method, headers: {} };
    if(body !== undefined){ opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return window.laOpsFetch(path, opts).then(function(r){
      if(r.status === 204) return null;
      return r.text().then(function(t){
        var j = null; try{ j = t ? JSON.parse(t) : null; }catch(_){}
        if(!r.ok) throw LaOpsError(r.status, j, method + ' ' + path);
        return j;
      });
    });
  }

  function qs(params){
    var out = [];
    Object.keys(params || {}).forEach(function(k){
      var v = params[k];
      if(v === undefined || v === null || v === '') return;
      (Array.isArray(v) ? v : [v]).forEach(function(x){ out.push(encodeURIComponent(k) + '=' + encodeURIComponent(x)); });
    });
    return out.length ? '?' + out.join('&') : '';
  }

  /* one write at a time · a failed job doesn't block the next one */
  var chain = Promise.resolve();
  function queue(fn){
    var p = chain.then(function(){ return fn(); });
    chain = p.catch(function(){});
    return p;
  }

  /* ops: [{label, run: () => Promise<result>, undo?: (result) => Promise}] · sequential */
  function runBatch(ops){
    var done = [];
    var i = 0;
    function next(){
      if(i >= ops.length) return Promise.resolve(done.map(function(d){ return d.result; }));
      var op = ops[i++];
      return Promise.resolve().then(op.run).then(function(result){
        done.push({ op: op, result: result });
        return next();
      }, function(err){
        err.failedOp = op.label || '';
        // undo what already went through, newest first · an undo that fails is logged, not thrown
        var undos = done.slice().reverse().filter(function(d){ return typeof d.op.undo === 'function'; });
        return undos.reduce(function(p, d){
          return p.then(function(){ return d.op.undo(d.result); }).catch(function(u){
            try{ console.error('[ops] undo failed for ' + (d.op.label || '?') + ': ' + (u && u.message)); }catch(_){}
          });
        }, Promise.resolve()).then(function(){ throw err; });
      });
    }
    return next();
  }

  function toast(o){ try{ if(typeof laSaveToast === 'function') laSaveToast(o); }catch(_){} }
  function fail(title, err){
    var m = (err && err.message) || String(err || 'unknown error');
    try{ console.warn('[ops] ' + title + ' · ' + m + (err && err.failedOp ? ' · at ' + err.failedOp : '')); }catch(_){}
    toast({ kind: 'error', title: title, status: err && err.status ? ('HTTP ' + err.status) : 'ERROR', sub: m, dur: 9000 });
  }

  function clone(x){ return x == null ? x : JSON.parse(JSON.stringify(x)); }
  /* put an object's contents back without replacing the object · other code holds references */
  function restoreInPlace(target, snap){
    if(Array.isArray(target)){ target.length = 0; Array.prototype.push.apply(target, clone(snap) || []); return; }
    Object.keys(target).forEach(function(k){ delete target[k]; });
    Object.assign(target, clone(snap) || {});
  }

  /* a user is mid-edit → don't redraw under them */
  function busy(){
    var a = document.activeElement;
    if(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return true;
    try{ if(typeof _bkV2 !== 'undefined' && _bkV2 && _bkV2.newBooking) return true; }catch(_){}
    return false;
  }
  function activeView(){ var el = document.querySelector('.nav-item.active[data-view]'); return el ? el.dataset.view : ''; }

  function ymd(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function shift(ds, days){ var d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() + days); return ymd(d); }
  function today(){ return ymd(new Date()); }

  /* change-listeners · availability and others refresh after any accepted write */
  var listeners = [];
  function onWrite(fn){ listeners.push(fn); }
  function wrote(kind){ listeners.forEach(function(fn){ try{ fn(kind); }catch(_){} }); }

  window.laOps = {
    enabled: enabled, call: call, qs: qs,
    get: function(p, q){ return call('GET', p + qs(q)); },
    post: function(p, b){ return call('POST', p, b === undefined ? {} : b); },
    patch: function(p, b){ return call('PATCH', p, b); },
    del: function(p){ return call('DELETE', p); },
    queue: queue, runBatch: runBatch,
    toast: toast, fail: fail, clone: clone, restoreInPlace: restoreInPlace,
    busy: busy, activeView: activeView,
    ymd: ymd, shift: shift, today: today,
    onWrite: onWrite, wrote: wrote,
    state: { loaded: false }
  };
})();
