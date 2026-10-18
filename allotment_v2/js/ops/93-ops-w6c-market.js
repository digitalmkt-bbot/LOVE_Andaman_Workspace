/* ═════════════════════════════════════════════════════════════════════════
   §opsW6cMarket (2026-10-18, wave 6 group c) · Market Data figures and the report market, now the server's answer
   ─────────────────────────────────────────────────────────────────────────
   Backend guides: operation-backend README "Market Data" (GET /v1/market-stats: in_by_code / out_by_code, arrivals_by_code,
   lang_buckets, arrivals_by_weekday, monthly_merged) and "Bookings" (report_market row flag). todo/w5-c-model.md asks 1 to 4.
   docs/walk/w6-c.md has the per-function table. Classic script, loads after 64-ops-market-data.js / 73-ops-srv-reads.js /
   40-ops-bookings.js, before 90-ops-boot.js. Legacy mode (!O.enabled()), and until the first answer, every wrapper delegates.

     mdArrivalsByWeekday()    arrivals_by_weekday of the whole file (Sunday first)
     mdArrivalsByCode()       arrivals_by_code (the nationality-name -> code table is the server's)
     _mdOvMonthly(days)       monthly_merged: the daily sum, the monthly figure only for a month with no daily data
     mdLangBuckets(byCode)    lang_buckets of the Ops & Guides tab's day (GET /v1/market-stats?from=D&to=D); the tab hands legacy a
                              by-code table built in the browser, which this ignores
     pmMarket(b)              the booking's report_market (kept on the booking by 40-ops-bookings.js as srvFlags.reportMarket)

   Nothing here works a figure out. The Excel import (mdIngest) is unchanged: it still sends the rows of a day.
   ═════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.srv) return;
  function on(){ return !!(O.enabled && O.enabled()); }
  function n(v){ return Number.isFinite(+v) ? +v : 0; }
  /* fn(orig, self, ...args): a value answers; undefined leaves the call to legacy */
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsW6c) return;
    var w = function(){
      if(!on()) return orig.apply(this, arguments);
      var r = fn.apply(this, [orig, this].concat([].slice.call(arguments)));
      return r === undefined ? orig.apply(this, arguments) : r;
    };
    w.__opsW6c = true; w.__orig = orig; window[name] = w;
  }
  function repaint(){
    if(O.activeView() === 'marketdata' && !O.busy() && typeof window.renderMarketData === 'function') window.renderMarketData();
  }
  function all(){ return O.srv.read('w6c-market', '/v1/market-stats', {}, repaint); }

  wrap('mdArrivalsByWeekday', function(){
    var j = all(); if(!j || !Array.isArray(j.arrivals_by_weekday)) return undefined;
    return j.arrivals_by_weekday.map(n);
  });
  wrap('mdArrivalsByCode', function(){
    var j = all(); if(!j || !j.arrivals_by_code) return undefined;
    var out = {}; Object.keys(j.arrivals_by_code).forEach(function(c){ out[c] = n(j.arrivals_by_code[c]); });
    return out;
  });
  wrap('_mdOvMonthly', function(){
    var j = all(); if(!j || !Array.isArray(j.monthly_merged)) return undefined;
    var m = {}, pres = {};
    j.monthly_merged.forEach(function(x){
      var ym = String(x.ym || ''), y = +ym.slice(0, 4), mo = +ym.slice(5, 7) - 1;
      if(isNaN(y) || isNaN(mo) || mo < 0 || mo > 11) return;
      if(!m[y]){ m[y] = new Array(12).fill(0); pres[y] = new Set(); }
      m[y][mo] = n(x.pax); pres[y].add(mo);
    });
    return { m: m, pres: pres };
  });

  /* the Ops & Guides tab asks for the guide languages of its latest day */
  var langDay = null;
  wrap('mdTabOps', function(orig, self, days){
    var last = days && days.length ? days[days.length - 1] : null;
    langDay = last && last.date ? last.date : null;
    try{ return orig.call(self, days); } finally { langDay = null; }
  });
  wrap('mdLangBuckets', function(){
    if(!langDay) return undefined;
    var j = O.srv.read('w6c-lang:' + langDay, '/v1/market-stats', { from: langDay, to: langDay }, repaint);
    if(!j || !j.lang_buckets) return undefined;
    return { Russian: n(j.lang_buckets.Russian), Chinese: n(j.lang_buckets.Chinese), English: n(j.lang_buckets.English) };
  });

  /* the market a report puts a booking in */
  wrap('pmMarket', function(orig, self, b){
    var f = b && b.srvFlags;
    return (f && f.reportMarket) ? f.reportMarket : undefined;
  });
})();
