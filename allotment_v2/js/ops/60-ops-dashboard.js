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
  var cache = {}, loading = {}, failed = {};
  function key(date, mode){ return date + '|' + (mode || 'day'); }
  function validDate(s){ return /^\d{4}-\d{2}-\d{2}$/.test(s || ''); }
  function redraw(){
    if(O.busy() || O.activeView() !== 'dashboard' || typeof window.renderDash !== 'function') return;
    window.renderDash();
  }
  function ensure(date, mode){
    mode = (mode === 'month' || mode === 'year') ? mode : 'day';
    if(!O.enabled() || !validDate(date)) return Promise.resolve(null);
    var k = key(date, mode);
    if(cache[k]) return Promise.resolve(cache[k]);
    if(loading[k]) return loading[k];
    delete failed[k];
    loading[k] = O.get('/v1/dashboard', { date: date, mode: mode }).then(function(j){
      if(!j || j.version !== 1 || !j.summary) throw new Error('invalid dashboard response');
      cache[k] = j;
      return j;
    }).catch(function(e){
      failed[k] = e;
      O.fail('Dashboard data did not load', e);
      return null;
    }).then(function(j){ delete loading[k]; redraw(); return j; });
    return loading[k];
  }
  function get(date, mode){ return cache[key(date, mode || 'day')] || null; }
  function status(date, mode){
    var k = key(date, mode || 'day');
    return cache[k] ? 'ready' : loading[k] ? 'loading' : failed[k] ? 'failed' : 'idle';
  }
  function error(date, mode){ return failed[key(date, mode || 'day')] || null; }
  function clear(){ cache = {}; loading = {}; failed = {}; }
  O.onWrite(function(){ clear(); });
  O.dashboard = { ensure: ensure, get: get, status: status, error: error, clear: clear };
})();
