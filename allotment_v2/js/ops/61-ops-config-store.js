/* ══════════════════════════════════════════════════════════════════════════
   §opsConfigStore (2026-10-15) · per-browser settings ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   These settings used to live in each browser's blob (ctRead / ctWrite), so two
   staff saw different values. The legacy readers (drCfg, drMailCfg, acctInvCfg,
   pmapZoneBgOn, pmapAgOpen, goGuides, ...) are synchronous and stay as they are;
   this file answers their ctRead(key) from a cache the server fills, and sends
   their ctWrite(key, value) to the server.

   dr_cfg                 GET|PUT /v1/reports/daily/settings   (van cost, van quota, target / pax)
   inv_cfg                GET|PUT /v1/config/inv_cfg           (invoice seller / contact / bank head)
   dr_mail                GET|PUT /v1/config/dr_mail           (daily report e-mail form)
   pmap_agpanel           GET|PUT /v1/config/pmap_agpanel      (pickup map: agent panel open, 0|1)
   pmap_zonebg            GET|PUT /v1/config/pmap_zonebg       (pickup map: zone background, 0|1)
   guides                 GET|PUT /v1/config/guides            (the guide register, whole list)
   (the whole store in one read: GET /v1/config)

   Reads are never merged here: the server answers the saved value already laid
   over legacy's defaults. Off unless laOps.enabled() and the login is not an
   agent's (the server answers an agent's login 403 even on reads).
   Load order: after ops/56-*, before ops/90-ops-boot.js. Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var RETRY_MS = 15000;
  var DEBOUNCE_MS = 600;            // typing in a settings field saves once it pauses
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
    var c = { title: title, loaded: false, loading: null, failedAt: 0 };
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

  /* ── the config store · one GET for every key, one PUT per key ──
     Server-first: an edit shows at once (the legacy readers are synchronous and redraw from the cache),
     is saved after a pause, and a refused save puts the last saved value back. The PUT carries the version
     the cache read, so a save over someone else's newer one is a 409 stale_version: the key is read again. */
  var CFG = {
    inv_cfg: { title: 'Invoice header', wait: DEBOUNCE_MS },
    dr_mail: { title: 'Daily report e-mail', wait: DEBOUNCE_MS },
    pmap_agpanel: { title: 'Pickup map panel', wait: 0 },
    pmap_zonebg: { title: 'Pickup map zones', wait: 0 },
    guides: { title: 'Guide register', wait: DEBOUNCE_MS },
    cal_route_sets: { title: 'Calendar route sets', wait: DEBOUNCE_MS },
  };
  var ents = {};                    // key -> { value, version, snap, seq, timer }
  function ent(key){ return ents[key] || (ents[key] = { value: null, version: null, snap: null, seq: 0, timer: null }); }
  function applyEntry(r){
    var e = ent(r.key); e.value = O.clone(r.value); e.version = r.version == null ? null : r.version;
    e.snap = null; e.seq++;
    /* the pickup map keeps its toggle in a variable after the first read: drop it so it reads the saved one */
    try{ if(r.key === 'pmap_zonebg') _pmapZoneBg = null; if(r.key === 'pmap_agpanel') _pmapAgOpen = null; }catch(_){}
  }
  var cfgCell = cell('Settings', function(){
    return O.get('/v1/config').then(function(r){ ((r && r.entries) || []).forEach(applyEntry); });
  });
  function cfgRepaint(){
    var reg = document.querySelector('#acct-modal .go-reg');
    if(reg && typeof window.goRegOpen === 'function'){ try{ window.goRegOpen(); }catch(_){} return; }
    redraw();
  }
  function cfgRead(key){
    if(cfgCell.loaded) return O.clone(ent(key).value);
    cfgCell.miss(); return null;
  }
  function cfgWrite(key, val){
    if(!cfgCell.loaded){ O.fail(CFG[key].title + ' not saved', new Error('The settings are still loading, try again')); return; }
    var e = ent(key);
    if(!e.snap) e.snap = { value: e.value, version: e.version };   // the last saved state, before the first unsaved edit
    e.value = O.clone(val); e.seq++;
    clearTimeout(e.timer);
    if(!CFG[key].wait){ e.timer = null; return flush(key); }
    e.timer = setTimeout(function(){ flush(key); }, CFG[key].wait);
  }
  function flush(key){
    var e = ent(key); clearTimeout(e.timer); e.timer = null;
    if(!e.snap) return Promise.resolve();
    return O.queue(function(){
      if(!e.snap) return null;                                    // an earlier save of this key was refused: nothing left to send
      var mine = e.seq, body = { value: O.clone(e.value) };
      if(e.version != null) body.version = e.version;
      return O.call('PUT', '/v1/config/' + encodeURIComponent(key), body).then(function(r){
        e.version = r.version;
        if(e.seq === mine){ e.value = O.clone(r.value); e.snap = null; }
        else e.snap = { value: O.clone(r.value), version: r.version };   // typed on since: its own save follows
      });
    }).then(noop, function(err){
      clearTimeout(e.timer); e.timer = null;
      var snap = e.snap; e.snap = null; e.seq++;
      if(snap){ e.value = snap.value; e.version = snap.version; }
      if(err && err.code === 'stale_version'){
        return O.get('/v1/config/' + encodeURIComponent(key)).then(applyEntry, noop).then(function(){
          O.fail(CFG[key].title + ' not saved: it was changed by someone else, the saved version is shown', err); cfgRepaint();
        });
      }
      O.fail(CFG[key].title + ' not saved', err); cfgRepaint();
    });
  }
  Object.keys(CFG).forEach(function(k){
    H[k] = { read: function(){ return cfgRead(k); }, write: function(v){ return cfgWrite(k, v); }, cell: cfgCell };
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

  /* ── cal_route_sets · the calendar's route sets (legacy CAL_ROUTE_SETS, 04-data-core.js) ──
     Legacy kept them in the browser blob (_calSetsPersist). Now the config store holds them: the saved
     list fills CAL_ROUTE_SETS in place once the settings have loaded, and every save of the list goes
     through cfgWrite (PUT /v1/config/cal_route_sets). calSetApply's hidden-route choice stays local. */
  function fillCalRouteSets(){
    var e = ents.cal_route_sets;
    if(!e || typeof CAL_ROUTE_SETS === 'undefined' || !Array.isArray(CAL_ROUTE_SETS)) return;
    var next = Array.isArray(e.value) ? O.clone(e.value) : [];
    CAL_ROUTE_SETS.length = 0;
    Array.prototype.push.apply(CAL_ROUTE_SETS, next);
  }
  wrap('_calSetsPersist', function(orig){
    if(typeof CAL_ROUTE_SETS === 'undefined' || !Array.isArray(CAL_ROUTE_SETS)) return null;
    return cfgWrite('cal_route_sets', CAL_ROUTE_SETS);
  });

  /* start the loads at once, so most first reads find the answer already there */
  if(active()){
    var seen = [];
    Object.keys(H).forEach(function(k){
      var c = H[k].cell; if(seen.indexOf(c) >= 0) return; seen.push(c);
      c.load().catch(function(e){ O.fail(c.title + ' did not load', e); });
    });
    cfgCell.load().then(fillCalRouteSets).catch(noop);
  }

  window.laOps.configStore = { H: H, active: active, cell: cell, wrap: wrap, redraw: redraw, flush: flush, ents: ents };
})();
