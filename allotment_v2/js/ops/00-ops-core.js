/* ══════════════════════════════════════════════════════════════════════════
   §opsApi (2026-10-05) · operation-backend client · shared core
   ──────────────────────────────────────────────────────────────────────────
   Every operation-backend endpoint is wired from js/ops/*.js. This file is the
   plumbing they share:

     laOps.enabled()      on only when server.js is out of the picture
                          (LA_LEGACY_UNAVAILABLE) and a login token exists
     laOps.get/post/...   JSON in, JSON out · a refused call throws LaOpsError
                          carrying the server's {statusCode, message, code}
     laOps.bookingWrite   a booking write with If-Match: the version it read
                          goes out, the one it is answered with is kept
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
    e.body = body || null;     // the whole answer · seats_short lists its days in body.short, boat_taken its blockers
    return e;
  }

  function send(method, path, body, headers){
    var opts = { method: method, headers: Object.assign({}, headers || {}) };
    if(body !== undefined){ opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return window.laOpsFetch(path, opts).then(function(r){
      if(r.status === 204) return { status: 204, ok: true, text: '' };
      return r.text().then(function(t){ return { status: r.status, ok: r.ok, text: t }; });
    });
  }
  function answer(res, method, path){
    if(res.status === 204) return null;
    var j = null; try{ j = res.text ? JSON.parse(res.text) : null; }catch(_){}
    if(!res.ok) throw LaOpsError(res.status, j, method + ' ' + path);
    return j;
  }
  function call(method, path, body, headers){
    if(method !== 'GET') forgetShared();
    return send(method, path, body, headers).then(function(res){ return answer(res, method, path); });
  }

  /* §bootShare (2026-10-26) · the same GET asked again while the first is still on its way joins it instead
     of going out twice (at boot the catalogue and the fleet boats both asked for /v1/boats). Only while it is in
     flight: a GET made after the answer came always asks the server again. Callers share the answer's TEXT and
     each parses its own copy, so no caller sees another's edits. A write (any non-GET here) or a change-feed
     event detaches the GETs in flight, so a GET made after it is sent fresh. */
  var shared = {};
  function forgetShared(){ shared = {}; }
  function sharedGet(path){
    var entry = shared[path];
    if(!entry){
      entry = shared[path] = { p: null };
      var done = function(){ if(shared[path] === entry) delete shared[path]; };
      entry.p = send('GET', path).then(function(res){ done(); return res; }, function(e){ done(); throw e; });
    }
    return entry.p.then(function(res){ return answer(res, 'GET', path); });
  }

  /* §bootLater (2026-10-26) · data the first screen does not need loads AFTER the boot's first draw, two
     requests at a time, instead of every adapter loading at once when its script runs. Production's log for
     one login: ~40 reads in 0.6 s, so reads that take 0.2 s alone waited up to 3 s for each other.
       laOps.later(name, fn, rank)  queue a load (fn returns a promise); a lower rank runs first
       laOps.later.start()      90-ops-boot.js, after the first draw: run the queue, two at a time
       laOps.later.now()        a screen is opened before the queue is through: run everything left at once
       laOps.later.whenDone(cb) cb once, when every queued load has finished (90-ops-boot.js redraws then)
     A load that fails is reported by its own adapter (O.fail) and counted as finished. If nothing starts the
     queue (no boot), it starts by itself 20 s after the first load is queued.
     §loadOnOpen (2026-10-28) · laOps.later(name, fn, rank, views): a load only some screens read waits until one
     of them is opened, so a login that never opens them never downloads it. `views` lists view ids; 'fl-*' is a
     prefix. start() and done() leave such loads out; open(view) runs the ones that view needs (and anything the
     queue still holds), now() runs all of them.
       laOps.later.open(view)   90-ops-boot.js, on opening a screen: resolves true when it started a load the
                                screen waited for (the boot then draws the screen again) */
  var later = (function(){
    var tasks = [], running = 0, started = false, waiting = [], fallback = null, MAX = 2;
    function auto(t){ return !t.views; }
    function wants(t, view){
      return !!view && t.views.some(function(v){ return v === view || (v.slice(-1) === '*' && view.indexOf(v.slice(0, -1)) === 0); });
    }
    function done(){ return tasks.every(function(t){ return t.finished || !auto(t); }); }
    function settle(){
      if(!done()) return;
      var cbs = waiting; waiting = [];
      cbs.forEach(function(cb){ try{ cb(); }catch(_){} });
    }
    function run(t){
      if(t.p) return t.p;
      running++;
      t.p = Promise.resolve().then(t.fn).catch(function(e){
        try{ console.warn('[ops] background load ' + t.name + ' · ' + (e && e.message)); }catch(_){}
      }).then(function(){ t.finished = true; running--; pump(); settle(); });
      return t.p;
    }
    function pump(){ for(var i = 0; i < tasks.length && running < MAX; i++) if(!tasks[i].p && auto(tasks[i])) run(tasks[i]); }
    function start(){ if(fallback){ clearTimeout(fallback); fallback = null; } started = true; pump(); }
    function queueLoad(name, fn, rank, views){
      var t = { name: name, fn: fn, rank: rank == null ? 99 : rank, views: Array.isArray(views) && views.length ? views.slice() : null, p: null, finished: false }, i = tasks.length;
      while(i > 0 && tasks[i - 1].rank > t.rank) i--;
      tasks.splice(i, 0, t);
      if(!auto(t)) return;
      if(started) pump();
      else if(!fallback) fallback = setTimeout(start, 20000);
    }
    queueLoad.start = start;
    queueLoad.now = function(){ start(); return Promise.all(tasks.map(run)); };
    queueLoad.open = function(view){
      start();
      var mine = tasks.filter(function(t){ return !auto(t) && wants(t, view); });
      var fresh = mine.some(function(t){ return !t.finished; });
      return Promise.all(tasks.filter(function(t){ return auto(t) || mine.indexOf(t) >= 0; }).map(run)).then(function(){ return fresh; });
    };
    queueLoad.done = done;
    queueLoad.whenDone = function(cb){ if(done()) cb(); else waiting.push(cb); };
    queueLoad.names = function(){ return tasks.map(function(t){ return t.name + (t.finished ? ' ✓' : t.p ? ' …' : ''); }); };
    return queueLoad;
  })();

  /* §opsVersion (2026-10-09) · a booking write sends the version it read and keeps the one it is
     answered with. The server refuses a write from a stale copy with 409 stale_version and changes
     nothing; the booking is then reloaded (laOps.bookings.reload) so the screen shows what is there.
     Use it for: PATCH /v1/bookings/{id}, /confirm /approve /reject /cancel-weather /cancel /restore
     /partial-cancel /reschedule, PUT …/meals, and /upgrade (which bumps the version). NOT for the
     day-of writes (trip-ops, check-in, van groups, van stops, doc check, reconfirm): those neither
     check the version nor move it (API team, 2026-10-09) · they go through call() as they are. */
  function bookingWrite(method, path, bk, body){
    var h = {};
    if(bk && bk.opsVersion != null) h['If-Match'] = '"' + bk.opsVersion + '"';
    return call(method, path, body, h).then(function(j){
      if(bk && j && j.version != null && (!bk.opsId || j.id === bk.opsId)) bk.opsVersion = +j.version;
      return j;
    }, function(e){
      // after the caller's own refusal handling (rollback, form back) has run · that's all microtasks
      if(e && e.code === 'stale_version' && bk) setTimeout(function(){
        var B = window.laOps && window.laOps.bookings; if(B && B.reload) B.reload(bk.id);
      }, 0);
      throw e;
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

  /* §opsAnyway (2026-10-13) · the server refuses a risky action with 409 + a code and accepts the same
     request again with a flag once the person has agreed. send(extra) makes the call (extra holds the
     flags to add to the body or query); rules maps a refusal code to { flag, ask?(err) → question }.
     The question defaults to the server's own message. OK → resend with the flag; Cancel → the refusal
     goes on to the caller (e.declined), nothing was changed. preset = flags already agreed to. */
  function anyway(send, rules, preset){
    function once(extra){
      return send(extra).catch(function(e){
        var r = e && e.status === 409 && rules[e.code];
        if(!r || extra[r.flag]) throw e;
        var q = (typeof r.ask === 'function' ? r.ask(e) : '') || e.message;
        if(!confirm(q)){ e.declined = true; throw e; }
        var next = Object.assign({}, extra); next[r.flag] = true;
        return once(next);
      });
    }
    return once(Object.assign({}, preset || {}));
  }

  /* one write at a time · a failed job doesn't block the next one */
  var chain = Promise.resolve();
  var inQueue = 0;
  function queue(fn){
    inQueue++; savingBadge();
    var p = chain.then(function(){ return fn(); });
    chain = p.catch(function(){});
    chain.then(function(){ inQueue--; savingBadge(); });
    return p;
  }
  /* writes still waiting: a reload now would lose them silently, so the browser is asked to confirm and a badge says so */
  function pending(){ return inQueue; }
  function savingBadge(){
    try{
      var el = document.getElementById('laops-saving');
      if(inQueue > 0 && !el && document.body){
        el = document.createElement('div'); el.id = 'laops-saving'; el.textContent = 'Saving...';
        el.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:99999;background:#1f2937;color:#fff;font:600 12px sans-serif;padding:6px 12px;border-radius:14px;opacity:.92;pointer-events:none';
        document.body.appendChild(el);
      } else if(inQueue <= 0 && el){ el.parentNode.removeChild(el); }
    }catch(_){}
  }
  if(typeof window.addEventListener === 'function') window.addEventListener('beforeunload', function(ev){
    if(inQueue > 0){ ev.preventDefault(); ev.returnValue = 'Changes are still being saved.'; return ev.returnValue; }
  });

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
  /* placeholder while a view waits on operation-backend: spinner + label (css .la-ops-loading in 01-base.css) */
  function loadingHtml(label){
    var t = String(label == null ? 'Loading…' : label).replace(/[&<>"']/g, function(c){ return '&#' + c.charCodeAt(0) + ';'; });
    return '<div class="la-ops-loading" role="status" aria-live="polite"><span class="la-ops-loading-ring"></span><span>' + t + '</span></div>';
  }
  /* §skel · shimmer placeholder shaped like a page: o.kpis KPI cards, o.panels wide cards, then a
     table of o.rows × o.cols. The label is read out to screen readers only (css .la-skel* in 01-base.css). */
  function skeletonHtml(o){
    o = o || {};
    var t = String(o.label == null ? 'Loading…' : o.label).replace(/[&<>"']/g, function(c){ return '&#' + c.charCodeAt(0) + ';'; });
    function sk(w, h, more){ return '<span class="la-skel" style="width:' + w + ';height:' + h + 'px' + (more ? ';' + more : '') + '"></span>'; }
    function cards(n, tall){
      var h = '';
      for(var i = 0; i < n; i++) h += '<div class="la-skel-card"' + (tall ? ' style="min-width:250px;min-height:150px"' : '') + '>' + sk('46%', 9) + sk(tall ? '80%' : '58%', tall ? 12 : 20) + (tall ? sk('64%', 12) + sk('72%', 12) : '') + '</div>';
      return '<div class="la-skel-kpis">' + h + '</div>';
    }
    var cols = o.cols || 6, W = ['13%', '20%', '11%', '12%', '12%', '10%', '9%', '8%'], rows = '';
    for(var r = 0; r < (o.rows == null ? 8 : o.rows); r++){
      rows += '<div class="la-skel-tr">';
      for(var c = 0; c < cols; c++) rows += sk(W[c % W.length], 11, c === cols - 1 ? 'margin-left:auto' : '');
      rows += '</div>';
    }
    return '<div class="la-skel-wrap" role="status" aria-live="polite"><span class="la-skel-sr">' + t + '</span>'
      + (o.kpis ? cards(o.kpis) : '') + (o.panels ? cards(o.panels, true) : '')
      + (o.rows === 0 ? '' : '<div class="la-skel-table"><div style="padding:13px 15px">' + sk('22%', 13) + '</div>' + rows + '</div>')
      + '</div>';
  }
  function activeView(){ var el = document.querySelector('.nav-item.active[data-view]'); return el ? el.dataset.view : ''; }

  function ymd(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function shift(ds, days){ var d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() + days); return ymd(d); }
  function today(){ return ymd(new Date()); }

  /* Write listeners invalidate local caches after this tab saves. Change listeners receive
     the durable server event first, then the feed client invokes wrote('remote:…') so
     existing cache invalidators also refresh after someone else's save. */
  var listeners = [], changeListeners = [];
  function onWrite(fn){ listeners.push(fn); }
  function wrote(kind){ forgetShared(); listeners.forEach(function(fn){ try{ fn(kind); }catch(_){} }); }
  function onChange(fn){ changeListeners.push(fn); }
  function changed(change){ forgetShared(); changeListeners.forEach(function(fn){ try{ fn(change); }catch(_){} }); }

  window.laOps = {
    enabled: enabled, call: call, qs: qs, bookingWrite: bookingWrite,
    get: function(p, q){ return sharedGet(p + qs(q)); },
    later: later,
    post: function(p, b){ return call('POST', p, b === undefined ? {} : b); },
    patch: function(p, b){ return call('PATCH', p, b); },
    del: function(p){ return call('DELETE', p); },
    queue: queue, pending: pending, runBatch: runBatch, anyway: anyway,
    toast: toast, fail: fail, clone: clone, restoreInPlace: restoreInPlace,
    busy: busy, activeView: activeView, loadingHtml: loadingHtml, skeletonHtml: skeletonHtml,
    ymd: ymd, shift: shift, today: today,
    onWrite: onWrite, wrote: wrote, onChange: onChange, changed: changed,
    state: { loaded: false }
  };
})();
