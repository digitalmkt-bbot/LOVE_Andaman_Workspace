/* ══════════════════════════════════════════════════════════════════════════
   §opsConfigStore (2026-10-15) · per-browser settings ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   These settings used to live in each browser's blob (ctRead / ctWrite), so two
   staff saw different values. The legacy readers (drCfg, drMailCfg, acctInvCfg,
   pmapZoneBgOn, pmapAgOpen, goGuides, ...) are synchronous and stay as they are;
   this file answers their ctRead(key) from a cache the server fills, and sends
   their ctWrite(key, value) to the server.

   dr_cfg                 GET|PUT /v1/reports/daily/settings   (van cost, van quota, target / pax)

   Reads are never merged here: the server answers the saved value already laid
   over legacy's defaults. Off unless laOps.enabled() and the login is not an
   agent's (the server answers an agent's login 403 even on reads).
   Load order: after ops/56-*, before ops/90-ops-boot.js. Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var RETRY_MS = 15000;
  var H = {};                       // ctRead / ctWrite key -> { read(), write(val), load() }

  function active(){ var me = window.LA_ME; return !!O.enabled() && !(me && me.agentId); }
  function noop(){}

  /* A cache miss answers null (the legacy reader then uses its own defaults) and the screen is drawn
     again once the server has answered, unless boot is still running (it draws when it is done). */
  function redraw(){
    if(!(O.state && O.state.loaded)) return;
    if(O.busy && O.busy()) return;
    var el = document.querySelector('.nav-item.active[data-view]');
    try{ if(el && typeof window.nav === 'function') window.nav(el); }catch(_){}
  }

  /* one cache cell: { loaded, loading, failedAt } + the caller's fetch */
  function cell(title, fetch){
    var c = { loaded: false, loading: null, failedAt: 0 };
    c.load = function(force){
      if(c.loading) return c.loading;
      if(c.loaded && !force) return Promise.resolve();
      c.loading = fetch().then(function(){ c.loaded = true; c.failedAt = 0; c.loading = null; },
        function(e){ c.failedAt = Date.now(); c.loading = null; throw e; });
      return c.loading;
    };
    /* a read before the answer: start the load once (not again for RETRY_MS after a failure) */
    c.miss = function(){
      if(c.loading || (c.failedAt && Date.now() - c.failedAt < RETRY_MS)) return;
      c.load().then(redraw, function(e){ O.fail(title + ' did not load', e); });
    };
    return c;
  }

  /* ── dr_cfg · the daily report's numbers ── */
  var DR_FIELDS = { vanCost: 'van_cost', vanQuota: 'van_quota', targetPerPax: 'target_per_pax' };
  var dr = { value: null };
  function drFrom(v){ v = v || {}; return { vanCost: +v.van_cost || 0, vanQuota: +v.van_quota || 0, targetPerPax: +v.target_per_pax || 0 }; }
  dr.cell = cell('Daily report settings', function(){
    return O.get('/v1/reports/daily/settings').then(function(v){ dr.value = drFrom(v); });
  });
  function drRead(){
    if(dr.cell.loaded) return O.clone(dr.value);
    dr.cell.miss(); return null;
  }
  function drWrite(c){
    if(!dr.cell.loaded){ O.fail('Daily report settings not saved', new Error('The settings are still loading, try again')); return; }
    c = c || {};
    var body = {}, next = Object.assign({}, dr.value);
    Object.keys(DR_FIELDS).forEach(function(k){
      if(c[k] == null || +c[k] === dr.value[k]) return;
      body[DR_FIELDS[k]] = +c[k]; next[k] = +c[k];
    });
    if(!Object.keys(body).length) return Promise.resolve();
    var snap = dr.value; dr.value = next;
    return O.queue(function(){ return O.call('PUT', '/v1/reports/daily/settings', body); }).then(function(v){
      dr.value = drFrom(v); O.wrote('daily-report-settings');
    }, function(e){
      dr.value = snap; O.fail('Daily report settings not saved', e); redraw();
    });
  }
  H.dr_cfg = { read: drRead, write: drWrite, cell: dr.cell };
  /* drCfgSet (ops/33) writes through the same endpoint and announces it: take the saved numbers again */
  O.onWrite(function(kind){
    if(kind === 'daily-report-settings' && active() && dr.cell.loaded) dr.cell.load(true).catch(noop);
  });

  /* ── wiring ── */
  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function') return;
    window[name] = function(){
      if(!active()) return orig.apply(this, arguments);
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
  }
  wrap('ctRead', function(orig, key){
    var h = H[key]; if(!h) return orig.apply(this, [].slice.call(arguments, 1));
    return h.read();
  });
  wrap('ctWrite', function(orig, key, val){
    var h = H[key]; if(!h) return orig.apply(this, [].slice.call(arguments, 1));
    return h.write(val);
  });

  /* start the loads at once, so most first reads find the answer already there */
  if(active()) Object.keys(H).forEach(function(k){
    H[k].cell.load().catch(function(e){ O.fail(k + ' did not load', e); });
  });

  window.laOps.configStore = { H: H, active: active, cell: cell, wrap: wrap, redraw: redraw };
})();
