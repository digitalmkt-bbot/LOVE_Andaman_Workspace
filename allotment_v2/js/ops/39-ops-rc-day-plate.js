/* ══════════════════════════════════════════════════════════════════════════
   §rcDayPlate · Re-confirm and Pier Check-in show the day's plate, as legacy does
   ──────────────────────────────────────────────────────────────────────────
   Legacy's Re-confirm row (_rcRowData, §rcPlate) and the Pier Check-in van cards read the plate through
   vanJobsDriverInfo(van, date): the plate typed for that day on the Van Jobs sheet (VANJOB_DRIVER, a partner
   van's plate of the day) before the van's registered one. On main VANJOB_DRIVER is filled only when the Van
   Jobs / Van Check-in screens load their 63-day window (35-ops-van-jobs.js loadVans), so Re-confirm showed the
   registered plate. Here those two screens read the one day they show:
     GET /operations/van-days?from=D&to=D   → days[] { van_id, driver, driver_phone, plate }   (the day's overrides)
   and the day's VANJOB_DRIVER entries are replaced by the server's (as applyVans does for its window). A changed
   answer redraws the screen once; a day is asked again after 60 s. The written value is PUT
   /operations/van-days/{date}/{van} (35-ops-vehicles.js / 35-ops-van-jobs.js), which keeps the same map.
   Load order: after 35-ops-van-jobs.js (its cell cache, O.vanJobs.putCell, keeps the same cells). Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var TTL = 60000;
  var askedAt = {}, pending = {};

  function drivers(){ try{ return typeof VANJOB_DRIVER !== 'undefined' ? VANJOB_DRIVER : null; }catch(_){ return null; } }
  function ymd(v){ var s = v == null ? '' : String(v); return /^\d{4}-\d\d-\d\d$/.test(s) ? s : ''; }
  function dayOf(map, date){
    var out = {}; Object.keys(map).forEach(function(k){ if(k.indexOf(date + '::') === 0) out[k] = map[k]; });
    return JSON.stringify(out);
  }
  /* the day's overrides from the server's cells into VANJOB_DRIVER; true when the day's entries changed */
  function applyDay(map, date, cells){
    var before = dayOf(map, date);
    Object.keys(map).forEach(function(k){ if(k.indexOf(date + '::') === 0) delete map[k]; });
    (cells || []).forEach(function(c){
      if(!c || c.service_date !== date || !c.van_id) return;
      if(O.vanJobs && typeof O.vanJobs.putCell === 'function') O.vanJobs.putCell(c);
      if(c.driver || c.driver_phone || c.plate) map[date + '::' + c.van_id] = { driver: c.driver || '', phone: c.driver_phone || '', plate: c.plate || '' };
    });
    return dayOf(map, date) !== before;
  }
  function loadDay(date){
    date = ymd(date);
    var map = drivers();
    if(!date || !map) return Promise.resolve(false);
    if(pending[date]) return pending[date];
    if(askedAt[date] && Date.now() - askedAt[date] < TTL) return Promise.resolve(false);
    askedAt[date] = Date.now();
    var p = pending[date] = O.get('/operations/van-days', { from: date, to: date }).then(function(j){
      delete pending[date];
      return applyDay(map, date, (j && j.days) || []);
    }, function(e){
      delete pending[date];
      try{ console.warn('[ops] the day’s van plates did not load · ' + (e && e.message)); }catch(_){}
      return false;
    });
    return p;
  }
  O.vanDayPlates = { loadDay: loadDay, applyDay: applyDay };

  function after(name, dateOf, hostId){
    var orig = window[name];
    if(typeof orig !== 'function') return;
    window[name] = function(){
      /* §vanCatalogue · the real vans (names, registered plates) instead of legacy's demo vans; the demo list is
         emptied before this render, so a plate is blank for the ~30 ms the catalogue takes, never "กข 5678" */
      var cat = (O.enabled() && O.vanJobs && typeof O.vanJobs.ensureCatalogue === 'function') ? O.vanJobs.ensureCatalogue() : null;
      var r = orig.apply(this, arguments);
      if(!O.enabled()) return r;
      var d = ymd(dateOf());
      var again = function(changed){
        if(changed && ymd(dateOf()) === d && document.getElementById(hostId) && typeof window[name] === 'function') window[name]();
      };
      if(d) Promise.all([loadDay(d), cat]).then(function(x){ again(x[0] || x[1]); });
      return r;
    };
  }
  function rcDate(){ try{ return _rcDate || O.today(); }catch(_){ return ''; } }
  function pckDate(){ try{ return _pckDate; }catch(_){ return ''; } }
  after('renderReconfirm', rcDate, 'reconfirm-host');
  after('renderPierCheckin', pckDate, 'piercheckin-host');
})();
