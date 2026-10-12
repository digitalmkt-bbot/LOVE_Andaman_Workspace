/* ══════════════════════════════════════════════════════════════════════════
   §opsPrPo (2026-10-13) · PR/PO Dashboard ⇄ operation-backend bookings
   ──────────────────────────────────────────────────────────────────────────
   renderPrPo (08-app.js) counts pax and special meals from SB_BOOKINGS for
   _ppFrom.._ppTo. Bookings are no longer preloaded at boot, so in ops mode the
   page drew from whatever another view happened to load (usually nothing).
   - renderPrPo  → GET /v1/bookings?from=&to= (trip service date, all pages)
                   through bookingV2EnsureOpsRange, then the legacy render.
   - ppUpdatedAt → when that range came from the server (the legacy stamp read
                   LA_UPDATED_AT, which only the old /api/load set).
   Load order: after js/booking/*.js and 40-ops-bookings.js. Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var loadedAt = {};
  function enabled(){ return !!(O.enabled && O.enabled()); }
  function range(){ return { from: window._ppFrom || '', to: window._ppTo || '' }; }
  function key(r){ return r.from + '..' + r.to; }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return '&#' + c.charCodeAt(0) + ';'; }); }

  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function') return;
    window[name] = function(){
      var args = [].slice.call(arguments);
      if(!enabled()) return orig.apply(this, args);
      return fn.apply(this, [orig].concat(args));
    };
  }

  // a booking write can move a booking in or out of any range: re-stamp on the next load
  if(O.onWrite) O.onWrite(function(){ loadedAt = {}; });

  wrap('renderPrPo', function(orig){
    var self = this, args = [].slice.call(arguments, 1);
    var r = range(), k = key(r);
    var load = (r.from && r.to && typeof window.bookingV2EnsureOpsRange === 'function')
      ? window.bookingV2EnsureOpsRange({ from: r.from, to: r.to }) : null;
    if(!load){
      if(!loadedAt[k]) loadedAt[k] = new Date();   // already in memory from an earlier load
      return orig.apply(self, args);
    }
    var host = document.getElementById('prpo-host');
    if(host) host.innerHTML = O.loadingHtml('Loading bookings for PR/PO…');
    return load.then(function(res){
      if(key(range()) !== k) return;              // range changed while waiting: the newer render owns the screen
      if(!res){
        O.fail('PR/PO: bookings did not load', new Error('GET /v1/bookings ' + r.from + ' → ' + r.to + ' failed'));
        if(host) host.innerHTML = '<div style="padding:32px;text-align:center;color:#A32D2D">Bookings for '
          + esc(r.from) + ' → ' + esc(r.to) + ' did not load from operation-backend. Reload and try again.</div>';
        return;
      }
      loadedAt[k] = new Date();
      return orig.apply(self, args);
    });
  });

  wrap('ppUpdatedAt', function(orig){
    var at = loadedAt[key(range())];
    if(!at) return orig.apply(this, [].slice.call(arguments, 1));
    var when;
    try{ when = at.toLocaleString('th-TH', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
    catch(_){ when = String(at); }
    return { when: when, by: '', live: true };
  });
})();
