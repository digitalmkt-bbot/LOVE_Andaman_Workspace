/* ════════════════════════════════════════════════════════════════════════
   §opsMarketData (2026-10-17) · Market Data page (airport arrivals / departures) ⇄ operation-backend
   ────────────────────────────────────────────────────────────────────────
   GET    /v1/market-stats                    → SB_MARKET_STATS and SB_MARKET_MONTHLY, filled in place
   PUT    /v1/market-stats/{date}/{in|out}    → mdIngest: one direction of one day, its rows and the file's
                                                 grand total (official_total, only when it differs from the rows)
   DELETE /v1/market-stats/{date}             → mdDeleteDay: both directions; a 404 means it was already gone

   The Excel file is still read in the browser (mdDetectDir, mdIngest's parse, as legacy does). The server keeps
   the result. The browser copy is no longer written to localStorage in operation mode (sbMarketStatsPersist,
   sbMarketMonthlyPersist answer nothing).
   Classic script. Loads after 08-app.js, before 90-ops-boot.js (boot calls load()).
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var legacyIngest = window.mdIngest;
  var legacyDeleteDay = window.mdDeleteDay;

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function enc(v){ return encodeURIComponent(v == null ? '' : String(v)); }
  function stats(){ return (typeof SB_MARKET_STATS !== 'undefined' && SB_MARKET_STATS && typeof SB_MARKET_STATS === 'object') ? SB_MARKET_STATS : null; }
  function monthly(){ return (typeof SB_MARKET_MONTHLY !== 'undefined' && SB_MARKET_MONTHLY && typeof SB_MARKET_MONTHLY === 'object') ? SB_MARKET_MONTHLY : null; }
  function redraw(){ try{ if(typeof window.renderMarketData === 'function') window.renderMarketData(); }catch(_){} }

  /* the server's day → legacy's day: { date, in, out } with in/out = { nationality: pax } or null, inTotal, inAt */
  function dayFrom(d){
    var row = { date: d.date, in: null, out: null };
    ['in', 'out'].forEach(function(dir){
      var v = d[dir]; if(!v) return;
      row[dir] = Object.assign({}, v.rows || {});
      row[dir + 'Total'] = v.total;
      row[dir + 'At'] = v.imported_at;
    });
    return row;
  }

  /* fill the legacy objects in place: other code holds references to them */
  function fill(j){
    var st = stats(), mo = monthly();
    if(!j) return;
    if(st){
      Object.keys(st).forEach(function(k){ delete st[k]; });
      (j.days || []).forEach(function(d){ st[d.date] = dayFrom(d); });
    }
    if(mo){
      Object.keys(mo).forEach(function(k){ delete mo[k]; });
      Object.keys(j.monthly || {}).forEach(function(k){ mo[k] = j.monthly[k]; });
    }
  }

  var loading = null;
  function load(){
    if(!enabled()) return Promise.resolve(false);
    if(loading) return loading;
    loading = O.get('/v1/market-stats').then(function(j){
      loading = null; fill(j); return true;
    }, function(e){
      loading = null; throw e;
    });
    return loading;
  }

  /* the two generic savers write the whole object to localStorage; in operation mode the server is the store */
  ['sbMarketStatsPersist', 'sbMarketMonthlyPersist'].forEach(function(name){
    var orig = window[name];
    if(typeof orig !== 'function') return;
    window[name] = function(){
      if(enabled()) return undefined;
      return orig.apply(this, arguments);
    };
  });

  /* mdIngest still parses the file and fills the day in the browser (it returns the date synchronously, as
     the import loop expects); the day is then sent. A refusal puts the day back as it was and says why. */
  window.mdIngest = function(aoa, fname){
    if(!enabled() || typeof legacyIngest !== 'function') return legacyIngest.apply(this, arguments);
    var st = stats();
    var before = O.clone(st);
    var iso = legacyIngest.apply(this, arguments);
    if(!iso || !st || !st[iso]) return iso;
    var dir = (typeof window.mdDetectDir === 'function') ? window.mdDetectDir(aoa, fname) : null;
    if(!dir) return iso;
    var day = st[iso], rows = day[dir] || {}, total = day[dir + 'Total'];
    var sum = Object.keys(rows).reduce(function(s, k){ return s + (+rows[k] || 0); }, 0);
    var body = { rows: Object.assign({}, rows) };
    if(total > 0 && total !== sum) body.official_total = total;
    O.queue(function(){
      return O.call('PUT', '/v1/market-stats/' + enc(iso) + '/' + dir, body);
    }).then(function(r){
      var cur = stats();
      if(cur && cur[iso]){
        cur[iso][dir] = Object.assign({}, r.rows || {});
        cur[iso][dir + 'Total'] = r.total;
        cur[iso][dir + 'At'] = r.imported_at;
      }
      O.wrote('market-stats');
      redraw();
    }, function(e){
      if(stats()) O.restoreInPlace(stats(), before);
      O.fail('Could not import market data', e);
      redraw();
    });
    return iso;
  };

  /* legacy mdDeleteDay: the same confirm, then the day goes; the server first, the browser copy after it */
  window.mdDeleteDay = function(iso){
    if(!enabled() || typeof legacyDeleteDay !== 'function') return legacyDeleteDay.apply(this, arguments);
    if(!confirm('Remove imported data for ' + iso + '?')) return;
    return O.queue(function(){
      return O.call('DELETE', '/v1/market-stats/' + enc(iso)).catch(function(e){
        if(e && e.status === 404) return null;    // already gone: the end state is the same
        throw e;
      });
    }).then(function(){
      var cur = stats(); if(cur) delete cur[iso];
      O.wrote('market-stats');
      redraw();
    }, function(e){
      O.fail('Could not delete market data', e);
    });
  };

  O.marketData = { load: load };
})();
