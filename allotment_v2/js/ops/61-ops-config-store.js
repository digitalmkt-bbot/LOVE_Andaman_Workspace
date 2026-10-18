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
   rc_status_colors       GET|PUT /v1/config/rc_status_colors  (re-confirm page colours; rcStatusColors, rcSaveStatusColor)
   vanjob_tpl             GET|PUT /v1/config/vanjob_tpl        (van job sheet template; vjTpl, vjTplSave)
   vanjob_rowhl           GET|PUT /v1/config/vanjob_rowhl      (van job sheet line highlights; vjHlAll, vjHlPersist)
   bk_cfg                 GET|PUT /v1/config/bk_cfg            (voucher money strip: vcPay 0|1)
   pck_svc_colors         GET|PUT /v1/config/pck_svc_colors    (Pier check-in service colours)
   pck_svc_rules          GET|PUT /v1/config/pck_svc_rules     (Pier check-in service rules)
   pck_guide_colors       GET|PUT /v1/config/pck_guide_colors  (Pier check-in guide colours)
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

  function active(){ var me = window.LA_ME; return !!O.enabled() && !(me && me.agentId) && !window.__laEmbedToken; }   // w5-a: the embed token may not read /v1/config
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
    rc_status_colors: { title: 'Re-confirm colours', wait: 0 },
    vanjob_tpl: { title: 'Van job sheet', wait: 0 },
    vanjob_rowhl: { title: 'Van job row highlights', wait: DEBOUNCE_MS },
    cal_route_sets: { title: 'Calendar route sets', wait: DEBOUNCE_MS },
    cal_route_names: { title: 'Calendar route labels', wait: 0 },
    da_template: { title: 'Daily availability message', wait: 0 },
    da_route_names: { title: 'Daily availability route names', wait: 0 },
    bk_cfg: { title: 'Voucher payment strip', wait: 0 },
    pck_svc_colors: { title: 'Pier check-in colours', wait: DEBOUNCE_MS },
    pck_svc_rules: { title: 'Pier check-in rules', wait: DEBOUNCE_MS },
    pck_guide_colors: { title: 'Pier check-in guide colours', wait: DEBOUNCE_MS },
    vck_status_colors: { title: 'Van check-in colours', wait: 0 },
    vck_bar_style: { title: 'Van check-in row style', wait: 0 },
    bop2_templates: { title: 'Boat Operation templates', wait: 0 },
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
    syncLabelVars();
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
    /* w6-d: `licensed` on a guide is the server's (role guide or trainee): never sent back, and not kept stale after a role edit */
    if(key === 'guides' && Array.isArray(val)) val = val.map(function(x){ if(!x || typeof x !== 'object' || !('licensed' in x)) return x; var y = Object.assign({}, x); delete y.licensed; return y; });
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
      e.lastErr = null;
      var mine = e.seq, body = { value: O.clone(e.value) };
      if(e.version != null) body.version = e.version;
      return O.call('PUT', '/v1/config/' + encodeURIComponent(key), body).then(function(r){
        e.version = r.version;
        if(e.seq === mine){ e.value = O.clone(r.value); e.snap = null; }
        else e.snap = { value: O.clone(r.value), version: r.version };   // typed on since: its own save follows
      });
    }).then(noop, function(err){
      clearTimeout(e.timer); e.timer = null; e.lastErr = err;   // w6-a: save() hands the refusal back to a dialog
      var snap = e.snap; e.snap = null; e.seq++;
      if(snap){ e.value = snap.value; e.version = snap.version; }
      if(err && err.code === 'stale_version'){
        return O.get('/v1/config/' + encodeURIComponent(key)).then(applyEntry, noop).then(function(){
          if(e.quiet) return;                                   // w6-a: the caller (a dialog) shows the refusal itself
          O.fail(CFG[key].title + ' not saved: it was changed by someone else, the saved version is shown', err); cfgRepaint();
        });
      }
      if(e.quiet) return;
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

  /* ── the shared screen settings (legacy kept them in the blob, laBlob()) ──
     Synchronous legacy readers answer from the cache; writers send the whole value (a PUT replaces it). */
  function liveOf(key){
    if(!cfgCell.loaded){ cfgCell.miss(); return {}; }
    var v = ent(key).value; return (v && typeof v === 'object') ? v : {};
  }

  /* rc_status_colors · rcStatusColors (08) and rcSaveStatusColor (08): a falsy hex deletes that status */
  wrap('rcStatusColors', function(orig){ return O.clone(liveOf('rc_status_colors')); });
  wrap('rcSaveStatusColor', function(orig, v, hex){
    var c = O.clone(liveOf('rc_status_colors'));
    if(hex) c[v] = hex; else delete c[v];
    cfgWrite('rc_status_colors', c);
    if(typeof window.renderReconfirm === 'function') window.renderReconfirm();
  });

  /* vanjob_tpl · vjTpl (08): the open draft wins, else the saved value over VJT_DEF, clamped as legacy clamps */
  var vjtMemo = { src: null, out: null };
  wrap('vjTpl', function(orig){
    if(window._VJT_DRAFT) return window._VJT_DRAFT;
    var o = liveOf('vanjob_tpl'), src = JSON.stringify(o);
    if(vjtMemo.out && vjtMemo.src === src) return vjtMemo.out;
    var out = {};
    for(var k in VJT_DEF){ out[k] = (o[k] === undefined || o[k] === null || o[k] === '') ? VJT_DEF[k] : o[k]; }
    for(var n in VJT_NUM){ var v = +out[n]; if(!isFinite(v)) v = VJT_DEF[n]; out[n] = Math.max(VJT_NUM[n][0], Math.min(VJT_NUM[n][1], v)); }
    vjtMemo = { src: src, out: out };
    return out;
  });
  /* vjTplSave (08) returns true when the save is sent (vjTplApply then clears the draft), false when refused */
  wrap('vjTplSave', function(orig, T){
    if(typeof window.laCanEditArea === 'function' && !window.laCanEditArea('operations')){ alert('ดูอย่างเดียว · แก้ไม่ได้'); return false; }
    if(!cfgCell.loaded){ O.fail(CFG.vanjob_tpl.title + ' not saved', new Error('The settings are still loading, try again')); return false; }
    var keep = {};
    Object.keys(VJT_DEF).forEach(function(k){
      if(T[k] === undefined || T[k] === null || String(T[k]) === String(VJT_DEF[k])) return;
      if(k === 'useVanColor' || k === 'showTh') keep[k] = Number(T[k]) ? 1 : 0;
      else if(k === 'rowH' || k === 'lineW') keep[k] = String(T[k]);
      else if(VJT_NUM[k]){
        var v = +T[k]; if(!isFinite(v)) v = VJT_DEF[k];
        keep[k] = Math.max(VJT_NUM[k][0], Math.min(VJT_NUM[k][1], v));
      }
      else keep[k] = String(T[k]);
    });
    cfgWrite('vanjob_tpl', keep);
    return true;
  });

  /* vanjob_rowhl · vjHlAll (08) returns the live cache: vjHlClick and vjHlClearSheet edit it, then vjHlPersist sends it */
  wrap('vjHlAll', function(orig){ return liveOf('vanjob_rowhl'); });
  wrap('vjHlPersist', function(orig, justSet){
    if(typeof window.laCanEditArea === 'function' && !window.laCanEditArea('operations')) return;
    var A = liveOf('vanjob_rowhl');
    var cut = new Date(); cut.setDate(cut.getDate() - 45);     // legacy: lines older than 45 days go, the one just set stays
    var cutS = (typeof window.bookingV2LocalYMD === 'function') ? window.bookingV2LocalYMD(cut) : cut.toISOString().slice(0, 10);
    var keep = {};
    Object.keys(A).forEach(function(k){ if(!A[k]) return; if(k === justSet || String(k).slice(0, 10) >= cutS) keep[k] = A[k]; });
    cfgWrite('vanjob_rowhl', keep);
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

  /* ── cal_route_names · da_route_names · da_template (04-data-core.js) ──
     Legacy kept the calendar labels, the LINE route names and the availability message in the browser blob,
     written straight to localStorage inside calEditRouteName, daEditRouteName, daSaveTemplate and daResetTemplate.
     The globals CAL_ROUTE_NAMES, DA_ROUTE_NAMES and DA_TEMPLATE stay what the screens read; they are filled from
     the saved value once the settings have loaded (and again after a refused save puts the last saved one back),
     and the four functions save through cfgWrite (PUT /v1/config/{key}). The server answers an empty message
     as the built-in text, which the browser holds as '' as legacy did. */
  function syncLabelVars(){
    if(!cfgCell.loaded) return;
    try{
      var cn = ents.cal_route_names, dn = ents.da_route_names, dt = ents.da_template;
      if(cn && typeof CAL_ROUTE_NAMES !== 'undefined'){ CAL_ROUTE_NAMES = (cn.value && typeof cn.value === 'object') ? O.clone(cn.value) : {}; }
      if(dn && typeof DA_ROUTE_NAMES !== 'undefined'){ DA_ROUTE_NAMES = (dn.value && typeof dn.value === 'object') ? O.clone(dn.value) : {}; }
      if(dt && typeof DA_TEMPLATE !== 'undefined'){
        var t = typeof dt.value === 'string' ? dt.value : '';
        DA_TEMPLATE = (typeof DA_DEFAULT_TEMPLATE !== 'undefined' && t === DA_DEFAULT_TEMPLATE) ? '' : t;
      }
    }catch(_){}
  }
  function labelEditable(){
    if(!cfgCell.loaded){ O.fail('Settings not saved', new Error('The settings are still loading, try again')); return false; }
    return true;
  }
  wrap('calEditRouteName', function(orig, rid){
    var r = (typeof getRoute === 'function') ? getRoute(rid) : null; if(!r) return;
    if(!labelEditable()) return;
    var v = prompt('Calendar label\nRoute: ' + r.name + '\n(leave blank to use the default short name)', CAL_ROUTE_NAMES[rid] || '');
    if(v === null) return;
    var nv = v.trim(), next = Object.assign({}, CAL_ROUTE_NAMES);
    if(nv) next[rid] = nv; else delete next[rid];
    CAL_ROUTE_NAMES = next;
    cfgWrite('cal_route_names', next);
    if(typeof renderCal === 'function') renderCal();
  });
  wrap('daEditRouteName', function(orig, rid){
    var r = (typeof getRoute === 'function') ? getRoute(rid) : null; if(!r) return;
    if(!labelEditable()) return;
    var v = prompt('ชื่อย่อสำหรับข้อความ LINE\nเส้นทาง: ' + r.name + '\n(เว้นว่าง = ใช้ชื่อเต็ม)', DA_ROUTE_NAMES[rid] || '');
    if(v === null) return;
    var nv = v.trim(), next = Object.assign({}, DA_ROUTE_NAMES);
    if(nv) next[rid] = nv; else delete next[rid];
    DA_ROUTE_NAMES = next;
    cfgWrite('da_route_names', next);
    if(typeof renderDA === 'function') renderDA();
  });
  wrap('daSaveTemplate', function(orig){
    var el = document.getElementById('da-tmpl-input'); if(!el) return;
    if(!labelEditable()) return;
    DA_TEMPLATE = el.value || '';
    cfgWrite('da_template', DA_TEMPLATE);
    if(typeof renderDA === 'function') renderDA();
    var btn = document.getElementById('da-tmpl-save');
    if(btn){ var t0 = btn.innerHTML; btn.innerHTML = '&#10003; บันทึกแล้ว'; setTimeout(function(){ var b = document.getElementById('da-tmpl-save'); if(b) b.innerHTML = t0; }, 1800); }
  });
  wrap('daResetTemplate', function(orig){
    if(!confirm('คืนค่าข้อความเป็นแบบเริ่มต้น? (ข้อความที่แก้ไว้จะหาย)')) return;
    if(!labelEditable()) return;
    DA_TEMPLATE = '';
    cfgWrite('da_template', '');
    var el = document.getElementById('da-tmpl-input'); if(el) el.value = DA_DEFAULT_TEMPLATE;
    if(typeof renderDA === 'function') renderDA();
  });

  /* legacy _pckSvcRead / _pckSvcWrite (08-app.js) kept the Pier check-in keys in each browser's blob; they are
     in CFG now, so they read and save through the cache like ctRead / ctWrite */
  wrap('_pckSvcRead', function(orig, key){
    var h = H[key]; if(!h) return orig.apply(this, [].slice.call(arguments, 1));
    return h.read();
  });
  wrap('_pckSvcWrite', function(orig, key, val){
    var h = H[key]; if(!h) return orig.apply(this, [].slice.call(arguments, 1));
    return h.write(val);
  });

  /* vck_status_colors / vck_bar_style · Van check-in colours and row style (08: vckColors, vckBarStyle, vckBarStyleSet,
     vckColorSet, vckColorsReset). Legacy kept them in the blob. The map holds only the colours that differ from the
     default (a reset writes {}); the style is "a" (pale) or "c" (dark). Repaint stays with the legacy callers. */
  wrap('vckColors', function(orig){
    var o = liveOf('vck_status_colors'), out = {};
    VCK_STATES.forEach(function(s){ out[s.k] = (typeof o[s.k] === 'string' && /^#[0-9a-fA-F]{6}$/.test(o[s.k])) ? o[s.k] : s.c; });
    return out;
  });
  wrap('vckBarStyle', function(orig){ return cfgRead('vck_bar_style') === 'c' ? 'c' : 'a'; });
  wrap('vckBarStyleSet', function(orig, v){
    if(typeof window.ckGuard === 'function' && !window.ckGuard()) return;
    cfgWrite('vck_bar_style', v === 'c' ? 'c' : 'a');
    if(typeof window.renderVanCheckin === 'function') window.renderVanCheckin();
  });
  wrap('vckColorSet', function(orig, k, hex){
    if(typeof window.ckGuard === 'function' && !window.ckGuard()) return;
    if(!/^#[0-9a-fA-F]{6}$/.test(String(hex || ''))) return;
    var C = window.vckColors(), keep = {};
    C[k] = hex;
    VCK_STATES.forEach(function(s){ if(C[s.k] && C[s.k].toLowerCase() !== s.c.toLowerCase()) keep[s.k] = C[s.k]; });
    cfgWrite('vck_status_colors', keep);
  });
  wrap('vckColorsReset', function(orig){
    if(typeof window.ckGuard === 'function' && !window.ckGuard()) return;
    if(!confirm('คืนค่าสีของทุกสถานะกลับเป็นค่าเริ่มต้น?')) return;
    cfgWrite('vck_status_colors', {});
    if(typeof window.vckColorClose === 'function') window.vckColorClose();
    if(typeof window.renderVanCheckin === 'function') window.renderVanCheckin();
  });

  /* bop2_templates · Boat Operation's weekday templates (w5-a). Legacy kept the list in each browser's blob
     (bop2LoadTemplates / bop2SaveTemplates, localStorage); now the shared config store holds it, so every
     machine sees the same templates. The list is the server's value: [{id, name, createdAt, pattern:{0..6:{boat:{route,type}}}}].
     Applying one is still a run of deployment writes (ops/20 sends only the changed cells, each judged by the server). */
  wrap('bop2LoadTemplates', function(orig){
    var v = cfgRead('bop2_templates');
    if(Array.isArray(v)) return v;
    return cfgCell.loaded ? [] : orig();          // before the settings arrive legacy's list shows; the screen redraws on arrival
  });
  wrap('bop2SaveTemplates', function(orig, arr){
    if(typeof window.laCanEditArea === 'function' && !window.laCanEditArea('operations')){ alert('ดูอย่างเดียว · แก้ไม่ได้'); return; }
    cfgWrite('bop2_templates', Array.isArray(arr) ? arr : []);
  });

  /* legacy bookingV2PayShow / bookingV2PayToggle (booking/bookingV2PayShow.js, bookingV2PayToggle.js): the voucher's
     money strip is the company-wide bk_cfg.vcPay (default on). The toggle saves through the cache. */
  wrap('bookingV2PayShow', function(){
    var c = cfgRead('bk_cfg') || {};
    return !(c.vcPay === 0 || c.vcPay === false);
  });
  wrap('bookingV2PayToggle', function(orig){
    if(typeof window.laCanEditArea === 'function' && !window.laCanEditArea('operations')){
      alert('เปิด/ปิดแถบเงินเป็นค่าของทั้งระบบ · ต้องมีสิทธิ์แก้ไข Operations');
      return;
    }
    var show = window.bookingV2PayShow();
    cfgWrite('bk_cfg', Object.assign({}, cfgRead('bk_cfg') || {}, { vcPay: show ? 0 : 1 }));
    try{ if(typeof window.bookingV2Render === 'function') window.bookingV2Render(); }catch(_){}
  });

  /* start the loads at once, so most first reads find the answer already there */
  if(active()){
    var seen = [];
    Object.keys(H).forEach(function(k){
      var c = H[k].cell; if(seen.indexOf(c) >= 0) return; seen.push(c);
      c.load().catch(function(e){ O.fail(c.title + ' did not load', e); });
    });
    cfgCell.load().then(function(){ fillCalRouteSets(); syncLabelVars(); }).catch(noop);
  }

  /* w6-a: save one key now and answer with the refusal (the server's error) or null, so a dialog can show the server's sentence in place */
  function save(key, val){
    var e = ent(key); e.quiet = true;                       // no toast and no repaint under the dialog: the answer goes back to the caller
    cfgWrite(key, val);
    return flush(key).then(function(){ e.quiet = false; return e.lastErr || null; }, function(x){ e.quiet = false; throw x; });
  }
  window.laOps.configStore = { H: H, active: active, cell: cell, wrap: wrap, redraw: redraw, flush: flush, ents: ents, save: save, loaded: function(){ return cfgCell.loaded; } };
})();
