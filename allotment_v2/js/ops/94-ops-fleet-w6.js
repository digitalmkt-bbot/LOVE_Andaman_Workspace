/* ═════════════════════════════════════════════════════════════════
   §opsFleetW6 (w6-d, 2026-10-18) · Transfer Fleet: what each cell carries, a route's zone and demand, groups without a van, a van's cost

   The backend built the fields the w5-d walk asked for (README "Fields the new frontend asked for", item 9):

     GET /operations/van-days  days[].jobs / .bookings / .pax   _vehDayJobN(id, date)      "N jobs" in a matrix cell
     GET /v1/routes            zone ('PK' | 'KL' | null)        _vehRouteZone(rid)         kept on the route by 10-ops-catalogue.js
     GET /operations/van-board routes[].demand {pax, pickup}    _vehRouteDemand(rid, date) "ลค n (รับ m)" on the summary cards and route buttons
                               routes[].groups_with_van / groups_without_van
                                                               _vehGroupsForDay(rid, day) "n กรุ๊ป (m ยังไม่มีรถ)"
     PATCH /operations/vans/{id} { cost_per_day }              vanCostSet(vid, v)         a van's cost per day (a client fact: a number >= 0 or null)

   A function answers from what the server last said and returns `undefined` (legacy's walk over the bookings answers) before the first
   answer, while a write has made the answer stale, and offline. Only the cost is written, as the person typed it.

   Load order: after 83-ops-fleet-server.js and 35-ops-vehicles.js. Classic script.
   ═════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.vanJobs) return;
  var V = O.vanJobs;
  var boards = {}, epoch = 0;

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function g(name){ try{ return window[name]; }catch(_){ return undefined; } }
  function num(v){ return +v || 0; }
  function fleetOpen(){ return !!document.getElementById('vehicles-host'); }
  function redraw(){ if(fleetOpen() && typeof g('renderVehicles') === 'function' && !(O.busy && O.busy())){ try{ window.renderVehicles(); }catch(_){} } }

  function wrap(name, fn){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsFleetW6) return;
    var w = function(){
      if(!enabled()) return orig.apply(this, arguments);
      var r;
      try{ r = fn.call(this, orig, arguments); }catch(e){ if(window.console) console.warn('[ops] fleet w6 · ' + name + ' · ' + (e && e.message)); r = undefined; }
      return r === undefined ? orig.apply(this, arguments) : r;
    };
    w.__opsFleetW6 = true; w.__orig = orig; window[name] = w;
  }

  /* ── the cell's job count ── */
  wrap('_vehDayJobN', function(orig, a){
    var id = a[0], date = a[1]; if(!id || !date) return undefined;
    var c = V.cellOf(id, date); if(!c || !('jobs' in c) || c.jobs == null) return undefined;
    return num(c.jobs);
  });

  /* ── the route's zone ── */
  wrap('_vehRouteZone', function(orig, a){
    var rid = a[0], list = typeof ROUTES !== 'undefined' ? ROUTES : [];
    var r = list.filter(function(x){ return x && x.id === rid; })[0];
    if(!r || !('zone' in r)) return undefined;
    return r.zone || null;
  });

  /* ── the van board of a day: demand and groups ── */
  function board(date){
    var c = boards[date];
    if(c && c.data && c.epoch === epoch) return c.data;
    if(c && c.loading && c.epoch === epoch) return null;
    var ep = epoch;
    c = boards[date] = { data: c ? c.data : null, epoch: ep, loading: true };
    O.get('/operations/van-board', { date: date }).then(function(j){
      var cur = boards[date]; if(!cur) return;
      var changed = JSON.stringify(cur.data && cur.data.routes) !== JSON.stringify(j && j.routes);
      cur.data = j || { routes: [] }; cur.loading = false; cur.epoch = ep;
      if(ep !== epoch){ board(date); return; }
      if(changed) redraw();
    }, function(){ var cur = boards[date]; if(cur) cur.loading = false; });
    return null;
  }
  function boardRoute(date, rid){
    var b = board(date); if(!b || !Array.isArray(b.routes)) return null;
    return b.routes.filter(function(r){ return r && r.route_id === rid; })[0] || null;
  }
  wrap('_vehRouteDemand', function(orig, a){
    var r = boardRoute(a[1], a[0]);
    if(!r || !r.demand) return undefined;
    return { pax: num(r.demand.pax), pickup: num(r.demand.pickup) };
  });
  wrap('_vehGroupsForDay', function(orig, a){
    var r = boardRoute(a[1], a[0]);
    if(!r || r.groups_with_van == null || r.groups_without_van == null) return undefined;
    return { total: num(r.groups_with_van) + num(r.groups_without_van), withVan: num(r.groups_with_van), woVan: num(r.groups_without_van) };
  });

  /* ── a van's cost per day: a client fact, PATCH /operations/vans/{id} { cost_per_day } ── */
  wrap('vanCostSet', function(orig, a){
    var vid = a[0], raw = a[1];
    var x = typeof g('vehGet') === 'function' ? window.vehGet(vid) : null; if(!x) return undefined;
    if(typeof window.laGuardEdit === 'function' && !window.laGuardEdit('accounting')){ if(typeof window.ctRender === 'function') window.ctRender(); return null; }
    var val = String(raw == null ? '' : raw).trim() === '' ? null : Math.max(0, +raw || 0);
    var was = x.costPerDay;
    O.queue(function(){ return O.patch('/operations/vans/' + encodeURIComponent(vid), { cost_per_day: val }); }).then(function(van){
      x.costPerDay = van && van.cost_per_day != null ? +van.cost_per_day : null;
      O.wrote('fleet-van-cost');
    }, function(e){
      x.costPerDay = was;
      O.fail('Van cost was not saved', e);
      if(typeof window.ctRender === 'function') window.ctRender();
    });
    return null;
  });

  /* any write that can move a booking or a van group makes the held boards stale; a fleet screen that is open reads them again,
     and the cells (jobs of the day) with them */
  var timer = null;
  O.onWrite(function(kind){
    if(/^(weather|market|devlog|daily-report|costing|trip-pl|config|addon-types|park|meal|pier-cash|pier-office|fleet-van-cost)/i.test(String(kind || ''))) return;
    epoch++;
    if(!fleetOpen()) return;
    if(timer) clearTimeout(timer);
    timer = setTimeout(function(){
      timer = null;
      if(!enabled() || !fleetOpen()) return;
      Object.keys(boards).forEach(function(d){ board(d); });
      if(O.fleetServer && O.fleetServer.refresh) O.fleetServer.refresh();
    }, 500);
  });

  O.fleetW6 = { board: board, clear: function(){ boards = {}; epoch++; } };
})();
