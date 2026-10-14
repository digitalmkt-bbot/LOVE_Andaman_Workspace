/* ══════════════════════════════════════════════════════════════════════════
   §opsDashboard (2026-10-10) · staff Dashboard ⇄ GET /v1/dashboard

   The legacy Dashboard is a large composite page: operations facts, local
   fleet-maintenance/doc cards, B2C and accounting widgets, plus a 30-day
   client chart. `/v1/dashboard` is authoritative for the operational day
   facts it returns. This adapter deliberately does NOT pretend that omitted
   cards are server facts: while a request is loading or failed, renderDash()
   labels its locally-derived display accordingly.

   The endpoint also supports month/year. They are cached here for the next
   renderer migration, but the legacy Dashboard's current "month" chart is a
   rolling 30 days (not a calendar month), so it must not be replaced by the
   endpoint's calendar-month aggregate without an explicit UX decision.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var cache = {}, loading = {}, failed = {}, stale = {};
  function key(date, mode){ return date + '|' + (mode || 'day'); }
  function validDate(s){ return /^\d{4}-\d{2}-\d{2}$/.test(s || ''); }
  function redraw(){
    /* while the loader is up nothing is painted yet, so a focused input elsewhere
       must not hold the page on the loader forever */
    if((O.busy() && !window._dashLoaderShown) || O.activeView() !== 'dashboard' || typeof window.renderDash !== 'function') return;
    window.renderDash();
  }
  function ensure(date, mode){
    mode = (mode === 'month' || mode === 'year') ? mode : 'day';
    if(!O.enabled() || !validDate(date)) return Promise.resolve(null);
    var k = key(date, mode);
    if(cache[k] && !stale[k]) return Promise.resolve(cache[k]);
    if(loading[k]) return loading[k];
    delete failed[k];
    loading[k] = O.get('/v1/dashboard', { date: date, mode: mode }).then(function(j){
      if(!j || j.version !== 1 || !j.summary) throw new Error('invalid dashboard response');
      cache[k] = j; delete stale[k];
      return j;
    }).catch(function(e){
      failed[k] = e;
      O.fail('Dashboard data did not load', e);
      return null;
    }).then(function(j){ delete loading[k]; redraw(); return j; });
    return loading[k];
  }
  function get(date, mode){ return cache[key(date, mode || 'day')] || null; }
  /* a write makes the cached summary stale, but it stays on screen until the
     refetch lands; the next ensure() refetches it */
  function markStale(){ Object.keys(cache).forEach(function(k){ stale[k] = true; }); }
  function status(date, mode){
    var k = key(date, mode || 'day');
    return loading[k] ? 'loading' : cache[k] ? 'ready' : failed[k] ? 'failed' : 'idle';
  }
  function error(date, mode){ return failed[key(date, mode || 'day')] || null; }
  function clear(){ cache = {}; loading = {}; failed = {}; stale = {}; }
  O.onWrite(function(){ markStale(); failed = {}; });

  /* "ยังไม่ได้วางบิล" (unbilled) in the needs-action popup comes from the server's
     `unbilled {count, baht, agents}` (legacy _dashBoardData rule, 04-data-core.js,
     evaluated on the server). It is company-wide, so any cached dashboard entry
     carries it whatever date/mode was asked for: take the newest. The server's baht
     has 2 decimals; legacy showed whole baht (Math.round), so round here. Until the
     first response lands (or if it fails) the legacy local figure stays on screen. */
  function unbilled(){
    var best = null;
    Object.keys(cache).forEach(function(k){
      var j = cache[k];
      if(j && j.unbilled && (!best || String(j.generated_at || '') > String(best.generated_at || ''))) best = j;
    });
    return best ? best.unbilled : null;
  }
  var legacyBoard = window._dashBoardData;
  if(typeof legacyBoard === 'function'){
    var board = function(){
      var d = legacyBoard.apply(this, arguments);
      var u = O.enabled() ? unbilled() : null;
      if(d && u){
        d.unN = Math.max(0, Math.round(+u.count || 0));
        d.unB = Math.round(+u.baht || 0);
        d.unAg = Math.max(0, Math.round(+u.agents || 0));
      }
      return d;
    };
    board.__ops = true; window._dashBoardData = board;
  }
  O.dashboard = { ensure: ensure, get: get, status: status, error: error, clear: clear, unbilled: unbilled };
})();
