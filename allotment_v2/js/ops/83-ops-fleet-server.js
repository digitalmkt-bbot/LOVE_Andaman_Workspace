/* ═════════════════════════════════════════════════════════════════
   §opsFleetServer (w5-d, 2026-10-18) · Transfer Fleet: a van's status of the day and its jobs of the day from the server

   Legacy resolved a van's status of a day in the browser (vehStatusOn: the day's own mark, else the latest status range covering the
   day) and counted a van's jobs and pax of a day by walking the bookings (vehJobsFor). The server answers both:

     GET /operations/van-days?from=&to=   days[] { van_id service_date status_on usable zone_on ... }   (README "Vans")
          status_on (legacy vehStatusOn): the day's own status, else the latest-added range covering the date, else null
     GET /operations/van-jobs?date=       jobs[] { van_id has_out has_ret bookings pax out_pax ret_pax ... }    (README "Van job orders")

   Wrapped:
     vehStatusOn(v, date)   status_on of the cell the matrix holds ('' when null); legacy's rule answers for a van whose ranges were just
                            written (until the cells are read again, which a range write triggers) and for a day not read
     vehJobsFor(date)       the "N job · M pax" of each van: the jobs the server counts for the day (a job that carries people out, or
                            a return-only job's own load); the list of bookings shown in the van's panel is still the browser's walk
   Not here (MISSING-SERVER-FIELD, docs/walk/w5-d.md): the per-day job count of every matrix cell (_vehDayJobN: van-days has no `jobs`),
   the route's zone and demand (_vehRouteZone, _vehRouteDemand), the groups without a van (_vehGroupsForDay: van-board has groups_count only),
   a van's cost per day (vanCostSet: no field on vans).

   Load order: after 35-ops-vehicles.js. Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.vanJobs) return;
  var V = O.vanJobs;
  var staleVan = {}, jobsAt = {}, epoch = 0, refreshing = null;

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function g(name){ try{ return window[name]; }catch(_){ return undefined; } }
  function num(v){ return +v || 0; }
  function fleetOpen(){ return !!document.getElementById('vehicles-host'); }
  function redraw(){ if(fleetOpen() && typeof g('renderVehicles') === 'function' && !(O.busy && O.busy())){ try{ window.renderVehicles(); }catch(_){} } }

  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsFleetServer) return;
    var w = function(){
      if(!enabled()) return orig.apply(this, arguments);
      var r;
      try{ r = fn.call(this, orig, arguments); }catch(e){ if(window.console) console.warn('[ops] fleet · ' + name + ' · ' + (e && e.message)); r = undefined; }
      return r === undefined ? orig.apply(this, arguments) : r;
    };
    w.__opsFleetServer = true; window[name] = w;
  }

  /* ── status of the day ── */
  wrap('vehStatusOn', function(orig, a){
    var v = a[0], date = a[1]; if(!v || !v.id || !date || staleVan[v.id]) return undefined;
    var c = V.cellOf(v.id, date); if(!c || !('status_on' in c)) return undefined;
    return c.status_on || '';
  });
  /* read the cells again (after a status range is written the days it covers changed): the answer replaces the held cells */
  function refresh(date){
    if(refreshing) return refreshing;
    var d = date || (typeof g('_vehDate') !== 'undefined' ? window._vehDate : '') || O.today();
    var from = O.shift(d, -31), to = O.shift(d, 31);
    refreshing = O.get('/operations/van-days', { from: from, to: to }).then(function(j){
      ((j && j.days) || []).forEach(function(c){ V.putCell(c); });
      staleVan = {}; refreshing = null; redraw(); return j;
    }, function(){ refreshing = null; });
    return refreshing;
  }
  ['vehStatusAdd', 'vehStatusSet', 'vehStatusDel'].forEach(function(name){
    var orig = window[name]; if(typeof orig !== 'function') return;
    window[name] = function(id){
      var r = orig.apply(this, arguments);
      if(enabled() && id){ staleVan[id] = true; O.queue(function(){ return null; }).then(function(){ refresh(); }); }
      return r;
    };
  });

  /* ── jobs of the day ── */
  function dayJobs(date){
    var c = jobsAt[date];
    if(c && c.data && c.epoch === epoch) return c.data;
    if(c && c.loading && c.epoch === epoch) return null;
    var ep = epoch;
    c = jobsAt[date] = { data: c ? c.data : null, epoch: ep, loading: true };
    O.get('/operations/van-jobs', { date: date }).then(function(j){
      var cur = jobsAt[date]; if(!cur) return;
      var changed = JSON.stringify((j && j.jobs) || []) !== JSON.stringify((cur.data && cur.data.jobs) || null);
      cur.data = j || { jobs: [] }; cur.loading = false; cur.epoch = ep;
      if(ep !== epoch) { dayJobs(date); return; }
      if(changed) redraw();
    }, function(){ var cur = jobsAt[date]; if(cur) cur.loading = false; });
    return null;
  }
  wrap('vehJobsFor', function(orig, a){
    var date = a[0], day = dayJobs(date); if(!day || !Array.isArray(day.jobs)) return undefined;
    var jobs = orig.apply(this, a);
    Object.keys(jobs).forEach(function(id){ jobs[id].bk = 0; jobs[id].pax = 0; });
    day.jobs.forEach(function(job){
      var j = jobs[job.van_id]; if(!j) return;
      if(job.has_out || !job.has_ret){ j.bk += num(job.bookings); j.pax += job.pax != null ? num(job.pax) : num(job.out_pax); }
      else { j.bk += num(job.bookings); j.pax += num(job.ret_pax); }
    });
    return jobs;
  });

  O.onWrite(function(kind){
    if(/^(weather|market|devlog|daily-report|costing|trip-pl|config|addon-types|park|meal|pier-cash|pier-office)/i.test(String(kind || ''))) return;
    epoch++;
    if(fleetOpen()) Object.keys(jobsAt).forEach(function(d){ dayJobs(d); });
  });
  O.fleetServer = { refresh: refresh, jobs: dayJobs, clear: function(){ jobsAt = {}; staleVan = {}; epoch++; } };
})();
