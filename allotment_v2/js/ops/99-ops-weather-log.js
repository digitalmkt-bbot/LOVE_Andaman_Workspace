/* ══════════════════════════════════════════════════════════════════════════
   §opsWx (2026-10-30) · the sea-state log on Boat Operation (12-weather.js, lk-inbox §wx b445e22d)
   ──────────────────────────────────────────────────────────────────────────
   12-weather.js reads and asks for snapshots through one function, wxFetch(url, opt), with legacy's server.js
   paths. operation-backend serves the same answers under /v1/weather (migration 588, routes/weather.ts):
     GET  /api/weather/points            → GET  /v1/weather/points
     GET  /api/weather?from&to[&point]    → GET  /v1/weather?from&to[&point]
     POST /api/weather/fetch?date&kind    → POST /v1/weather/fetch?date&kind     (needs operations)
     POST /api/weather/backfill?from      → POST /v1/weather/backfill?from       (needs operations)
     GET  /api/weather/backfill           → GET  /v1/weather/backfill            (the poll)
   So this only re-routes wxFetch; nothing is mapped. A refusal rejects with the server's message, which is what
   12-weather.js already does with a legacy error: wxLoad logs it and the card stays empty (no toast, no loop),
   the fetch and backfill buttons alert it. Not in ops mode, or a path that is not a weather one: legacy's wxFetch.
   Classic script · after 12-weather.js and 00-ops-core.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var orig = window.wxFetch;
  if(typeof orig !== 'function' || orig.__opsWx) return;

  /* '/api/weather/fetch?date=…' → '/v1/weather/fetch?date=…'; null for anything else */
  function opsPath(url){
    var m = /^\/api\/weather(\/(?:points|fetch|backfill))?(\?.*)?$/.exec(String(url == null ? '' : url));
    return m ? '/v1/weather' + (m[1] || '') + (m[2] || '') : null;
  }

  var w = function(url, opt){
    var p = opsPath(url);
    if(!p || !(O.enabled && O.enabled())) return orig.apply(this, arguments);
    var method = String((opt && opt.method) || 'GET').toUpperCase();
    return method === 'GET' ? O.get(p) : O.call(method, p);
  };
  w.__opsWx = true; w.__orig = orig; w.opsPath = opsPath;
  window.wxFetch = w;
})();
