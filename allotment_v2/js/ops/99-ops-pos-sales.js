/* ══════════════════════════════════════════════════════════════════════════
   §opsPosSales (sync 11-12 · lk-inbox §posSales / §pslAv / §pslRoute / §pslBR, 2026-11-11) · Pier Office POS shop sales
   ──────────────────────────────────────────────────────────────────────────
   Legacy's page (js/15-pos-sales.js) keeps a month per blob key: ctWrite('pos_sales_YYYYMM') =
   { 'pier|YYYY-MM-DD': { f, at, by, items: [{ n, q, net, pf, a: { <boat|_x>: { q, nat } } }] } }, read with ctRead.
   On this branch a blob key reaches no server, so a seller's split stayed in one browser. Here those two keys are
   the server's (migration 602, src/routes/pos-sales.ts):

   ctRead('pos_sales_YYYYMM')        ← GET /v1/pier-office/pos-sales?pier=panwa|tublamu&month=YYYY-MM  (cached; drawn again when it lands)
   ctWrite('pos_sales_YYYYMM', map)  → per changed day PUT /v1/pier-office/pos-sales/{pier}/{date} { file_name, uploaded_at, items },
                                       per removed day DELETE …  The cache takes the edit at once (legacy draws right after);
                                       a refusal (the split over the pieces sold, a view-only login) is the server's text,
                                       and the month is read again.
   pslAnData                         the analysis lists its months from the blob's keys: it sees the months read here, and
                                       'all' reads every month of the pier first.
   renderPosSales                    asks for the day's (or the analysed days') boat plan: laOps.deployments.ensureDays.

   The rule "a split never exceeds the pieces sold" is the server's (400 alloc_over); legacy's own clamp still runs first.
   Not here (sync 11-12, listed in the PR): the analysis' boats / pax / guides / nationalities are still worked out in the
   browser from TRIPS and SB_BOOKINGS, so a day outside the loaded booking window counts no boats.
   Off unless laOps.enabled() and the login is not an agent's. Load order: after ops/61-ops-config-store.js. Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var PIERS = ['panwa', 'tublamu'];
  var KEY = /^pos_sales_(\d{4})(\d{2})$/;
  var M = {};                    // 'pos_sales_YYYYMM' -> { loaded, loading, map: { 'pier|date': legacy record } }
  var allLoaded = {};            // pier -> true once every month of it was read (the analysis' 'all')
  var sending = {};              // 'pier|date' -> a PUT/DELETE for it is queued and not sent yet

  function active(){ var me = window.LA_ME; return !!O.enabled() && !(me && me.agentId) && !window.__laEmbedToken; }
  function clone(v){ return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function enc(s){ return encodeURIComponent(s); }
  function monthOf(key){ var m = KEY.exec(key); return m ? m[1] + '-' + m[2] : null; }
  function keyOfDate(date){ return 'pos_sales_' + String(date || '').slice(0, 7).replace('-', ''); }
  function cellOf(key){ return M[key] || (M[key] = { loaded: false, loading: null, map: {} }); }

  /* the server's day → legacy's record (version kept aside for nothing: saves are last-write-wins per day, as legacy's smerge) */
  function fromServer(d){
    return { f: d.file_name || '', at: d.uploaded_at || '', by: d.uploaded_by || '', items: clone(d.items) || [] };
  }
  function toServer(rec){
    return { file_name: rec && rec.f ? String(rec.f) : null, uploaded_at: rec && rec.at ? String(rec.at) : null, items: clone((rec && rec.items) || []) };
  }

  function redraw(){
    try{
      var pier = window._psl && window._psl.pier;
      var view = document.querySelector('.nav-item.active[data-view]');
      var v = view && view.getAttribute('data-view');
      if(typeof window.renderPosSales === 'function' && pier && (!v || /^pos-/.test(v))) window.renderPosSales(pier);
    }catch(_){}
  }
  function put(days){
    (days || []).forEach(function(d){
      var k = keyOfDate(d.date), c = cellOf(k), dk = d.pier + '|' + d.date;
      if(!sending[dk]) c.map[dk] = fromServer(d);       // an edit still on its way wins over an older answer
    });
  }
  function loadMonth(key){
    var c = cellOf(key), mon = monthOf(key);
    if(!mon) return Promise.resolve();
    if(c.loading) return c.loading;
    c.loading = Promise.all(PIERS.map(function(p){ return O.get('/v1/pier-office/pos-sales', { pier: p, month: mon }); })).then(function(res){
      res.forEach(function(r){ put(r && r.days); });
      c.loaded = true; c.loading = null;
    }, function(e){ c.loading = null; c.failedAt = Date.now(); throw e; });
    return c.loading;
  }
  function loadAll(pier){
    if(allLoaded[pier]) return Promise.resolve();
    return O.get('/v1/pier-office/pos-sales', { pier: pier }).then(function(r){
      put(r && r.days); allLoaded[pier] = true;
      ((r && r.days) || []).forEach(function(d){ cellOf(keyOfDate(d.date)); });
    });
  }

  function readMonth(key){
    var c = cellOf(key);
    if(!c.loaded && !c.loading && !(c.failedAt && Date.now() - c.failedAt < 15000)){
      loadMonth(key).then(redraw, function(e){ O.fail('POS sales did not load', e); });
    }
    return clone(c.map);
  }

  function send(dk){
    var sp = dk.split('|'), pier = sp[0], date = sp[1], k = keyOfDate(date);
    if(sending[dk]) return;                                 // one queued write per day: it sends the latest when its turn comes
    sending[dk] = true;
    O.queue(function(){
      delete sending[dk];
      var rec = cellOf(k).map[dk];
      var url = '/v1/pier-office/pos-sales/' + enc(pier) + '/' + enc(date);
      if(!rec) return O.del(url).catch(function(e){ if(e && e.status === 404) return null; throw e; }).then(function(){ return { gone: true }; });
      return O.call('PUT', url, toServer(rec));
    }).then(function(j){
      if(j && j.day){
        var c = cellOf(k), was = c.map[dk];
        if(!sending[dk]) c.map[dk] = fromServer(j.day);
        if(!was || was.at !== j.day.uploaded_at || was.by !== (j.day.uploaded_by || '')) redraw();   // a new upload: the server's stamp
      }
      O.wrote('pos-sales');
    }, function(e){
      O.fail('POS sales not saved', e);
      var c = cellOf(k); c.loaded = false;
      loadMonth(k).then(redraw, function(){ redraw(); });
    });
  }
  function writeMonth(key, map){
    var c = cellOf(key), before = c.map, next = (map && typeof map === 'object' && !Array.isArray(map)) ? clone(map) : {};
    var changed = [];
    Object.keys(next).forEach(function(dk){ if(JSON.stringify(next[dk]) !== JSON.stringify(before[dk])) changed.push(dk); });
    Object.keys(before).forEach(function(dk){ if(!(dk in next)) changed.push(dk); });
    c.map = next;
    changed.forEach(send);
    return true;
  }

  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsPos) return;
    var w = function(){ return fn.apply(this, [orig].concat([].slice.call(arguments))); };
    w.__opsPos = true; window[name] = w;
  }
  wrap('ctRead', function(orig, key){
    if(!active() || !KEY.test(String(key || ''))) return orig.apply(this, [].slice.call(arguments, 1));
    return readMonth(key);
  });
  wrap('ctWrite', function(orig, key, val){
    if(!active() || !KEY.test(String(key || ''))) return orig.apply(this, [].slice.call(arguments, 1));
    return writeMonth(key, val);
  });

  /* the analysis lists its months from laBlob()'s keys: show it the months read here (and read the ones it asks for) */
  wrap('pslAnData', function(orig, pier, mon){
    if(!active()) return orig.apply(this, [].slice.call(arguments, 1));
    if(mon === 'all') loadAll(pier).then(function(){ dayPlans(pier, 'all'); redraw(); }, function(e){ O.fail('POS sales did not load', e); });
    else if(/^\d{4}-\d{2}$/.test(String(mon || ''))) readMonth('pos_sales_' + mon.replace('-', ''));
    var keys = Object.keys(M).filter(function(k){ return mon === 'all' || k === 'pos_sales_' + String(mon || '').replace('-', ''); });
    var real = window.laBlob;
    window.laBlob = function(){ var o = {}; keys.forEach(function(k){ o[k] = 1; }); return o; };
    try{ return orig.apply(this, [].slice.call(arguments, 1)); }
    finally{ window.laBlob = real; }
  });

  /* the boats that left the pier: the day plan of the days shown (outside the -30/+180 window it is read on demand) */
  function dayPlans(pier, mon){
    var D = O.deployments; if(!D || typeof D.ensureDays !== 'function') return;
    var dates = [];
    Object.keys(M).forEach(function(k){
      if(mon !== 'all' && k !== 'pos_sales_' + String(mon || '').replace('-', '')) return;
      Object.keys(M[k].map).forEach(function(dk){ var sp = dk.split('|'); if(sp[0] === pier) dates.push(sp[1]); });
    });
    try{ if(dates.length) D.ensureDays(dates); }catch(_){}
  }
  wrap('renderPosSales', function(orig, pier){
    if(active()){
      var st = window._psl || {};
      try{ if(O.deployments && st.date) O.deployments.ensureDays([st.date]); }catch(_){}
      if(st.tab && st.tab !== 'day') dayPlans(pier || st.pier, st.mon || String(st.date || '').slice(0, 7));
    }
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  window.__laOpsPosSales = { M: M, readMonth: readMonth, writeMonth: writeMonth, loadMonth: loadMonth, loadAll: loadAll, fromServer: fromServer, toServer: toServer };
})();
