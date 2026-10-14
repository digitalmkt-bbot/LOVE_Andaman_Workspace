/* ════════════════════════════════════════════════════════════════════════
   §opsRepPickupMap (2026-10-14) · Operations Report + Pickup Map ⇄ operation-backend
   ────────────────────────────────────────────────────────────────────────
   Root cause: both screens aggregate over SB_BOOKINGS, which on operation-
   backend holds only the date ranges other views happened to load:
   - Operations Report (rep-ops): comparison period was never loaded, so
     prior passenger figures showed 0 and the headline delta compared against
     an empty window (+100%).
   - Pickup Map (pickupmap): previous period was never loaded, so period-on-
     period deltas per area (MoM%) were completely missing (null), and year
     mode aggregated only whatever partial bookings were in memory.

   This adapter ensures:
   · Operations Report: loads the current period (st.from .. st.to) and the
     matching comparison period (pv.from .. pv.to from repPrevRange) via
     bookingV2EnsureOpsRange, plus availability via O.availability.ensure.
   · Pickup Map: for month and week modes, loads both the current period and
     the previous comparison period. For year mode, shows a banner explaining
     that full-year comparison requires a server summary endpoint, avoiding
     downloading the entire database (~5.8k records).

   Both screens redraw once completed loads land.
   Legacy mode (!O.enabled()): delegates to originals.
   Classic script · loads after 08-app.js and 40-ops-bookings.js.
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  var originals = {};
  ['renderReport', 'renderPickupMap', 'pmapRefresh'].forEach(function(n){
    if(typeof window[n] === 'function') originals[n] = window[n];
  });

  function wrap(name, opsFn){
    var orig = originals[name];
    window[name] = function(){
      if(!O.enabled()) return orig ? orig.apply(this, arguments) : undefined;
      return opsFn.apply(this, arguments);
    };
  }

  function viewIs(v){ try{ return O.activeView() === v; }catch(_){ return false; } }

  var kickedAt = {};

  /* ════ Operations Report (rep-ops) ════ */
  function repBanner(loading){
    try{
      var host = document.getElementById('rep-host-ops'); if(!host) return;
      var el = document.getElementById('rep-ops-period');
      if(!loading){ if(el) el.remove(); return; }
      if(!el){
        el = document.createElement('div');
        el.id = 'rep-ops-period';
        el.style.cssText = 'margin:0 0 10px;padding:8px 14px;border-radius:10px;background:#EDF4FB;color:#1B5E96;font-size:11.5px;font-weight:600';
        host.insertBefore(el, host.firstChild);
      }
      el.textContent = 'Loading comparison period from operation-backend...';
    }catch(_){}
  }

  wrap('renderReport', function(kind){
    var self = this, args = arguments;
    var r = originals.renderReport ? originals.renderReport.apply(self, args) : undefined;
    if(kind !== 'ops') return r;

    var st = (typeof window.repSt === 'function') ? window.repSt('ops') : null;
    if(!st || !st.from || !st.to) return r;
    var pv = (typeof window.repPrevRange === 'function') ? window.repPrevRange(st.from, st.to) : null;

    var sig = 'rep-ops|' + (pv ? pv.from : '') + '|' + st.to;
    var now = Date.now();
    if(kickedAt[sig] && now - kickedAt[sig] < 5000) return r;
    kickedAt[sig] = now;

    var loads = [];
    if(typeof window.bookingV2EnsureOpsRange === 'function'){
      if(pv && pv.from && pv.to) loads.push(window.bookingV2EnsureOpsRange({ from: pv.from, to: pv.to }));
      loads.push(window.bookingV2EnsureOpsRange({ from: st.from, to: st.to }));
    }
    if(O.availability && typeof O.availability.ensure === 'function'){
      loads.push(O.availability.ensure(st.from));
      if(pv && pv.from) loads.push(O.availability.ensure(pv.from));
    }

    var activeLoads = loads.filter(Boolean);
    if(activeLoads.length){
      repBanner(true);
      Promise.all(activeLoads).then(function(rs){
        if(rs.every(Boolean) && viewIs('rep-ops')){
          repBanner(false);
          if(typeof window.renderReport === 'function') window.renderReport('ops');
        }
      }).catch(function(){ repBanner(false); });
    } else {
      repBanner(false);
    }
    return r;
  });

  /* ════ Pickup Map (pickupmap) ════ */
  function pmapBanner(text){
    try{
      var host = document.getElementById('pickupmap-wrap') || document.getElementById('view-pickupmap');
      if(!host) return;
      var el = document.getElementById('pmap-ops-period');
      if(!text){ if(el) el.remove(); return; }
      if(!el){
        el = document.createElement('div');
        el.id = 'pmap-ops-period';
        el.style.cssText = 'margin:0 0 10px;padding:8px 14px;border-radius:10px;background:#EDF4FB;color:#1B5E96;font-size:11.5px;font-weight:600';
        host.insertBefore(el, host.firstChild);
      }
      el.textContent = text;
    }catch(_){}
  }

  function pmapWindows(){
    var mode = window._pmapMode || 'month';
    var anchor = window._pmapAnchor || (typeof window._pmYmd === 'function' ? window._pmYmd(new Date()) : O.today());
    var d = new Date(anchor + 'T00:00:00');
    if(mode === 'month'){
      var y = d.getFullYear(), m = d.getMonth();
      var cFrom = O.ymd(new Date(y, m, 1)), cTo = O.ymd(new Date(y, m + 1, 0));
      var pFrom = O.ymd(new Date(y, m - 1, 1)), pTo = O.ymd(new Date(y, m, 0));
      return { mode: mode, cur: { from: cFrom, to: cTo }, prev: { from: pFrom, to: pTo } };
    }
    if(mode === 'week'){
      var wd = (d.getDay() + 6) % 7;
      var st = new Date(d); st.setDate(d.getDate() - wd);
      var en = new Date(st); en.setDate(st.getDate() + 6);
      var pst = new Date(st); pst.setDate(pst.getDate() - 7);
      var pen = new Date(en); pen.setDate(pen.getDate() - 7);
      return { mode: mode, cur: { from: O.ymd(st), to: O.ymd(en) }, prev: { from: O.ymd(pst), to: O.ymd(pen) } };
    }
    return { mode: 'year', y: d.getFullYear() };
  }

  function ensurePmap(){
    var w = pmapWindows();
    if(w.mode === 'year'){
      pmapBanner('Year view: showing loaded bookings — full-year comparison needs a server summary endpoint');
      return;
    }
    var sig = 'pmap|' + w.mode + '|' + w.prev.from + '|' + w.cur.to;
    var now = Date.now();
    if(kickedAt[sig] && now - kickedAt[sig] < 5000) return;
    kickedAt[sig] = now;

    var loads = [];
    if(typeof window.bookingV2EnsureOpsRange === 'function'){
      loads.push(window.bookingV2EnsureOpsRange({ from: w.prev.from, to: w.prev.to }));
      loads.push(window.bookingV2EnsureOpsRange({ from: w.cur.from, to: w.cur.to }));
    }
    var activeLoads = loads.filter(Boolean);
    if(activeLoads.length){
      pmapBanner('Loading comparison period from operation-backend...');
      Promise.all(activeLoads).then(function(rs){
        if(rs.every(Boolean) && viewIs('pickupmap')){
          pmapBanner(null);
          if(typeof window.pmapRefresh === 'function') window.pmapRefresh();
        }
      }).catch(function(){ pmapBanner(null); });
    } else {
      pmapBanner(null);
    }
  }

  wrap('renderPickupMap', function(){
    var self = this, args = arguments;
    var r = originals.renderPickupMap ? originals.renderPickupMap.apply(self, args) : undefined;
    ensurePmap();
    return r;
  });

  wrap('pmapRefresh', function(){
    var self = this, args = arguments;
    var r = originals.pmapRefresh ? originals.pmapRefresh.apply(self, args) : undefined;
    ensurePmap();
    return r;
  });
})();
