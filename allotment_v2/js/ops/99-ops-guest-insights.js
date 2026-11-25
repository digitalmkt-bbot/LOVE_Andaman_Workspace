/* ═══════════════════════════════════════════════════════════════════════════════
   §opsGuestIns (2026-11-01, server read 2026-11-25) · Overview › Guest Insights (13-guest-insights.js, lk-inbox §guestIns 9270583b)
   ───────────────────────────────────────────────────────────────────────────────
   giCollect counts the people who travel in the chosen period (30 days, this quarter, this year). It used to page every
   booking of the period into the browser (GET /v1/bookings, a year = 13 pages, 39.5 s). §giSrv: the server counts the same
   people (operation-backend `guest-insights.ts`, legacy's giCollect rules: first trip in the period, pier and family filters,
   lead + passengers, the insurer's nationality and age, GI_FIX, generations) and answers them grouped by family, nationality,
   age and generation: GET /v1/bookings/guest-insights?from=&to=&pier=&family= (one call, ~0.3 s).
     - giCollect expands the groups back into its rows, so legacy's render (counts, map, bands, KPIs) is untouched. The age span
       line reads the first and last date of the rows with an age: the answer's aged_from / aged_to.
     - While the answer loads the page shows a "loading" note; a failed read says so and is retried on the next open.
     - The answer is kept a minute per period / pier / family; a write drops it.
   Classic script · after 13-guest-insights.js.
   ═══════════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var orig = window.renderGuestInsights, origCollect = window.giCollect;
  if(typeof orig !== 'function' || orig.__opsGi) return;
  var TTL = 60000, cache = {}, loading = {};
  if(O.onWrite) O.onWrite(function(){ cache = {}; });

  function on(){ return !!(O.enabled && O.enabled()); }
  function note(text){
    var host = document.getElementById('guestins-host');
    if(host) host.innerHTML = '<div style="padding:40px;text-align:center;color:#6B7280;font-size:13px">' + text + '</div>';
  }
  function open(){ return !O.activeView || O.activeView() === 'guestins'; }
  function query(){
    var R = window.giRange();
    var lock = (typeof window.laMyPier === 'function' && window.laMyPier()) ? String(window.laMyPier()) : '';
    var pier = lock || (typeof window._giPier === 'string' ? window._giPier : '') || '';
    var fam = window._giFam != null ? String(window._giFam) : '';
    return { R: R, lock: lock, q: { from: R.from, to: R.to, pier: pier, family: fam }, key: [R.from, R.to, pier, fam].join('|') };
  }
  /* the answer's groups → giCollect's rows (one per person) */
  function rowsOf(a){
    var rows = [], firstAged = true;
    (a.groups || []).forEach(function(g){
      for(var i = 0; i < (+g.n || 0); i++){
        var date = '';
        if(g.age != null){ date = firstAged ? (a.aged_from || '') : (a.aged_to || ''); firstAged = false; }
        rows.push({ date: date, fam: g.family, a2: g.a2 || '', age: g.age == null ? null : +g.age, gen: g.gen || '' });
      }
    });
    return rows;
  }
  function giSrvCollect(){
    var Q = query(), e = cache[Q.key];
    if(!on() || !e) return origCollect.apply(this, arguments);
    return { R: Q.R, rows: rowsOf(e.data), heads: +e.data.heads || 0, pierLock: Q.lock };
  }
  giSrvCollect.__opsGi = true;
  O.guestInsightsRows = rowsOf;

  var w = function(){
    if(!on() || typeof window.giRange !== 'function' || typeof origCollect !== 'function') return orig.apply(this, arguments);
    var Q = query(), e = cache[Q.key];
    if(e && Date.now() - e.at < TTL) return orig.apply(this, arguments);
    if(!loading[Q.key]){
      loading[Q.key] = O.get('/v1/bookings/guest-insights', Q.q).then(function(d){
        delete loading[Q.key];
        if(!d || !Array.isArray(d.groups)) throw new Error('invalid Guest Insights answer');
        cache[Q.key] = { at: Date.now(), data: d };
        if(open()) window.renderGuestInsights();
      }).catch(function(err){
        delete loading[Q.key];
        if(typeof O.fail === 'function') O.fail('Guest Insights did not load', err);
        if(open() && !cache[Q.key]) note('Guest Insights could not load from operation-backend. Open the page again to retry.');
      });
    }
    if(e) return orig.apply(this, arguments);        // stale: draw it, the fresh answer redraws
    note('Loading the guests of this period...');
    return undefined;
  };
  w.__opsGi = true; w.__orig = orig;
  window.renderGuestInsights = w;
  if(typeof origCollect === 'function') window.giCollect = giSrvCollect;
})();
