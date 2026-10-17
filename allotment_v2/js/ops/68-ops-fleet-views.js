/* ══════════════════════════════════════════════════════════════════════════
   §opsFleetViews (2026-10-17) · Fleet Work, Fleet Assets headline, Fleet Dashboard, Cost Analytics, Insights ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   These screens used to add up the browser's own copies of jobs, memos, engines and incidents. The rules they
   follow are now the server's (operation-backend todo/fleet-fields-model.md and todo/rules-fleet-model.md), served as reads:

     GET /v1/fleet/work?boats=&stage=        flwItems, flwBoats, flRenderWork          stage, parked, silent days, boats down
     GET /v1/fleet/assets/summary            faStages, faRenderOverview (via faShell)  stage counts, flag_counts, data_to_fix
     GET /v1/fleet/dashboard?date=           flRenderDashboard                         service_due (fixed 500 h), cost_trend
     GET /v1/fleet/reports/cost?period=      costAggregate (+ laMemoDirectShare)       jobs dated by end, else start date
     GET /v1/fleet/insights?period=          flRenderInsights                          jobs started in the period, any status

   How: each legacy function is wrapped (or asks a small helper from this file). The screen draws at once from the
   browser's own figures; when the server's answer arrives it is kept and the screen is drawn again if it differs
   (the same pattern as renderFuelIntel / flBoatRepairCostMonth). After a write or a change event the answer is stale:
   it is shown until the new one arrives. Outside ops mode nothing here runs and legacy is untouched.

   Helpers legacy asks for (typeof-guarded in 05-fleet.js): flDashServiceDue(ds), flDashCostTrend(ds), flInsightsServer(period).

   Load order: after js/ops/26-ops-fleet-daily.js. Classic script.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;

  function enabled(){ return !!(O.enabled && O.enabled()); }
  function num(v){ var n = Number(v); return Number.isFinite(n) ? n : 0; }

  /* ── one cache for every read: answer kept, marked stale on a write, asked again on the next draw ── */
  var cache = {}, asked = {};
  function keyOf(path, params){ return path + O.qs(params || {}); }
  function read(path, params, redraw){
    var key = keyOf(path, params), c = cache[key];
    if((!c || c.stale) && !asked[key]){
      asked[key] = true;
      O.get(path, params).then(function(d){
        var changed = !c || JSON.stringify(c.data) !== JSON.stringify(d);
        cache[key] = { data: d, stale: false };
        delete asked[key];
        if(changed && redraw && !O.busy()) { try{ redraw(); }catch(_){} }
      }).catch(function(e){
        asked[key] = 'failed';      // not asked again until the next write; the screen keeps the browser's figures
        try{ console.warn('[ops] ' + path + ' · ' + (e && e.message)); }catch(_){}
      });
    }
    return c ? c.data : null;
  }
  function stale(){ Object.keys(cache).forEach(function(k){ cache[k].stale = true; }); asked = {}; }
  O.onWrite(stale);
  O.onChange(stale);

  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__opsViews) return;
    var w = function(){
      if(!enabled()) return orig.apply(this, arguments);
      return fn.apply(this, [orig].concat([].slice.call(arguments)));
    };
    w.__opsViews = true;
    window[name] = w;
  }
  function viewOn(id){ var v = document.getElementById(id); return !!(v && v.classList.contains('active')); }

  /* ══ Fleet Work ═════════════════════════════════════════════════════════════════════════════════
     flwItems: stage, parked, silent days and cost of each item are the server's (items[] by key).
     flwBoats: which boats are listed (boats= / stage= filters), which are down, for how many days and
     in what order are the server's (boats[]). The legacy builder still supplies the objects the page
     draws from (the boat, the items with their jobs, memos and sub-steps). */
  function redrawWork(){ if(viewOn('view-fl-work') && typeof window.flRenderWork === 'function') window.flRenderWork(); }

  wrap('flwItems', function(orig){
    var items = orig.apply(this, [].slice.call(arguments, 1));
    var w = read('/v1/fleet/work', { boats: 'all' }, redrawWork);
    if(!w) return items;
    var by = {};
    (w.boats || []).forEach(function(b){ (b.items || []).forEach(function(it){ by[it.key] = it; }); });
    items.forEach(function(it){
      var s = by[it.key]; if(!s) return;
      it.stage = s.stage;
      it.silent = num(s.silent_days);
      it.cost = num(s.cost);
      if(it.kind === 'mj') it.park = s.parked ? s.parked.label : '';
    });
    return items;
  });

  wrap('flwBoats', function(orig, items){
    var F = window.FLW; if(!F) return orig.apply(this, [].slice.call(arguments, 1));
    var q = { boats: F.bf || 'work' }; if(F.stage >= 0) q.stage = F.stage;
    var w = read('/v1/fleet/work', q, redrawWork);
    if(!w) return orig.apply(this, [].slice.call(arguments, 1));
    var bf = F.bf, st = F.stage, all;
    F.bf = 'all'; F.stage = -1;                        // every boat the page knows, unfiltered
    try{ all = orig.call(this, items); } finally { F.bf = bf; F.stage = st; }
    var byId = {}; (all || []).forEach(function(o){ byId[o.id] = o; });
    var out = [];
    (w.boats || []).forEach(function(row){
      var o = byId[row.boat_id || '']; if(!o) return;
      if(row.status) o.s = row.status;
      o.isDown = !!row.is_down;
      o.down = num(row.days_blocked);
      out.push(o);
    });
    return out;
  });

  /* ══ Fleet Assets · headline numbers ════════════════════════════════════════════════════════════
     faStages: the stage tiles of Engines / Gearboxes / Propellers. faShell: the overview's tiles and its "data to fix"
     chip (faRenderOverview builds them from the part flags, which are the server's, and passes them to faShell). */
  function redrawAssets(){ if(viewOn('view-fl-asset') && typeof window.flRenderAsset === 'function') window.flRenderAsset(); }
  function assetSummary(){ return read('/v1/fleet/assets/summary', {}, redrawAssets); }

  wrap('faStages', function(orig, kind, P){
    var out = orig.apply(this, [].slice.call(arguments, 1));
    var s = assetSummary(); if(!s || !Array.isArray(out)) return out;
    function put(i, v, sub){ if(!out[i]) return; out[i].v = num(v); if(sub != null) out[i].s = sub; }
    if(kind === 'eng' && s.engines){
      var E = s.engines;
      put(0, E.total, E.honda + ' Honda · ' + E.suzuki + ' Suzuki'); put(1, E.ready);
      put(2, E.fixing, 'บนเรือ ' + E.fixing_on_boat + ' · ไม่อยู่บนเรือ ' + E.fixing_off_boat);
      put(3, E.broken); put(4, E.not_on_boat); put(5, E.no_hours);
    } else if(kind === 'gb' && s.gearboxes){
      var G = s.gearboxes;
      put(0, G.total, G.honda + ' Honda · ' + G.suzuki + ' Suzuki'); put(1, G.ready); put(2, G.fixing);
      put(3, G.spare); put(4, G.not_on_boat); put(5, G.no_engine);
    } else if(s.propellers){
      var R = s.propellers;
      put(0, R.total); put(1, R.active); put(2, R.spare); put(3, R.fixing); put(4, R.damaged_broken); put(5, R.data_to_fix);
    }
    return out;
  });

  /* faSpRight (Spares · right column "Data to fix"): each line's count is the server's flag_counts (assets carrying the
     flag; retired is not a line). The lines listed are the flags the parts carry (the server's flags, see faPart). */
  wrap('faSpRight', function(orig){
    var html = orig.apply(this, [].slice.call(arguments, 1));
    var s = assetSummary(), fc = s && s.flag_counts;
    if(!fc || typeof html !== 'string' || typeof FA_FLAG_TXT === 'undefined') return html;
    Object.keys(fc).forEach(function(k){
      if(k === 'retired' || k === 'nohours' || !FA_FLAG_TXT[k]) return;
      var tail = '</b> ' + FA_FLAG_TXT[k], at = html.indexOf(tail);        // "<b>3</b> <the flag's text>"
      var open = at > 0 ? html.lastIndexOf('<b>', at) : -1;
      if(open >= 0) html = html.slice(0, open) + '<b>' + num(fc[k]) + html.slice(at);
    });
    return html;
  });

  wrap('faShell', function(orig, info){
    var s = assetSummary();
    if(s && info && Array.isArray(info.stages)){
      info.stages.forEach(function(st){
        if(st.t === 'Engines' && s.engines){ st.v = s.engines.total; st.s = s.engines.fixing + ' fixing'; }
        else if(st.t === 'Gearboxes' && s.gearboxes){ st.v = s.gearboxes.total; st.s = s.gearboxes.fixing + ' fixing'; }
        else if(st.t === 'Propellers' && s.propellers){ st.v = s.propellers.total; st.s = s.propellers.active + ' active'; }
        else if(st.t === 'Data to fix'){ st.v = num(s.data_to_fix); st.red = num(s.data_to_fix) > 0; }
      });
      if(typeof info.chips === 'string' && /data to fix/.test(info.chips)){
        info.chips = info.chips.replace(/<b>\d+<\/b>data to fix/, '<b>' + num(s.data_to_fix) + '</b>data to fix');
      }
    }
    return orig.apply(this, [info].concat([].slice.call(arguments, 2)));
  });

  /* ══ Fleet Dashboard · service due and the cost trend ═══════════════════════════════════════════
     legacy asks flDashServiceDue(ds) / flDashCostTrend(ds) while it draws. flRenderDashboard itself is wrapped only
     to ask for the answer (and to draw again when it arrives). */
  function redrawDash(){ if(viewOn('view-fl-dashboard') && typeof window.flRenderDashboard === 'function') window.flRenderDashboard(); }
  function dash(ds){ return read('/v1/fleet/dashboard', ds ? { date: ds } : {}, redrawDash); }

  wrap('flRenderDashboard', function(orig){
    var el = document.getElementById('fl-dash-date');
    dash(el && el.value ? el.value : O.today());
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  /* "Service due": a fixed 500 h for every engine on a boat, the next multiple, listed from 70 % of the way. Answered as
     the rows legacy's card draws; the list is as long as the server's count (the card shows the first five). */
  window.flDashServiceDue = function(ds){
    if(!enabled()) return null;
    var d = dash(ds), sd = d && d.service_due; if(!sd || !Array.isArray(sd.engines)) return null;
    var engs = typeof FL_ENGINES !== 'undefined' ? FL_ENGINES : [], boats = typeof BOATS !== 'undefined' ? BOATS : [];
    var rows = sd.engines.map(function(r){
      var e = engs.filter(function(x){ return x.id === r.engine_id; })[0] || { id: r.engine_id, serial: r.serial, pos: r.pos };
      var b = boats.filter(function(x){ return x.id === r.boat_id; })[0] || { id: r.boat_id, name: r.boat_name };
      return { e: e, b: b, h: num(r.hours), nextServiceAt: num(r.next), remaining: num(r.remaining), pctToNext: num(r.pct) };
    });
    while(rows.length < num(sd.count) && rows.length) rows.push(rows[rows.length - 1]);   // only the first five are drawn; the badge counts all
    return rows;
  };
  /* "Maintenance cost · last 6 months": month → { cost, jobs } (jobs by the month they started, else ended; any status) */
  window.flDashCostTrend = function(ds){
    if(!enabled()) return null;
    var d = dash(ds), ct = d && d.cost_trend; if(!ct || !Array.isArray(ct.months)) return null;
    var m = {}; ct.months.forEach(function(x){ m[x.month] = { cost: num(x.cost), jobs: num(x.jobs) }; });
    return m;
  };

  /* ══ Cost Analytics · costAggregate ═════════════════════════════════════════════════════════════
     The whole page reads one object (A). With the server's report it is built from the report: totals, categories,
     types, boats, units, rows, the central memos and the 12 months. laMemoDirectShare is the server's directShare. */
  function redrawCost(){ if(document.getElementById('fl-cost-wrap') && viewOn('view-fl-cost') && typeof window.flRenderCostAnalytics === 'function') window.flRenderCostAnalytics(); }
  var CATS = ['hull', 'engine', 'gearbox', 'propeller', 'other', 'memo'];

  function memoById(id){ return (typeof FL_MEMOS !== 'undefined' ? FL_MEMOS : []).filter(function(x){ return x.id === id; })[0] || null; }

  function costFromReport(r){
    var A = { done: num(r.done), proc: num(r.proc), nDone: num(r.n_done), nProc: num(r.n_proc), byCat: {}, byType: {}, boats: {}, units: {}, rows: [], all: [] };
    CATS.forEach(function(k){ A.byCat[k] = { done: 0, proc: 0, n: 0 }; });
    (r.categories || []).forEach(function(c){ A.byCat[c.key] = { done: num(c.done), proc: num(c.proc), n: num(c.n) }; });
    ['corrective', 'preventive', 'scheduled'].forEach(function(t){ A.byType[t] = { done: 0, proc: 0, n: 0 }; });
    (r.by_type || []).forEach(function(t){ A.byType[t.type] = { done: num(t.done), proc: num(t.proc), n: num(t.n) }; });
    A.rows = (r.rows || []).map(function(x){
      var row = { id: x.id, no: x.no || x.id, boatId: x.boat_id || '', title: x.title || '', type: x.type || 'corrective', st: x.status, date: x.date || '',
        cost: num(x.cost), cats: (x.cats || []).slice(), done: !!x.done, parts: num(x.parts), memo: num(x.memo) };
      if(x.kind === 'memo') row.kind = 'memo';
      return row;
    });
    (r.boats || []).forEach(function(b){
      A.boats[b.boat_id] = { id: b.boat_id, name: b.name, done: num(b.done), proc: num(b.proc), n: num(b.n), cats: Object.assign({}, b.cats), tot: num(b.total) };
    });
    A.boatList = Object.keys(A.boats).map(function(k){ return A.boats[k]; }).sort(function(a, z){ return z.tot - a.tot; });
    (r.units || []).forEach(function(u){
      var bn = (typeof getBoat === 'function' ? (getBoat(u.boat_id) || {}).name : '') || '';
      A.units[u.asset_id] = { id: u.asset_id, cat: u.cat, boatId: u.boat_id, boat: bn, label: u.label, cost: num(u.cost), n: num(u.n) };
    });
    A.unitList = Object.keys(A.units).map(function(k){ return A.units[k]; }).sort(function(a, z){ return z.cost - a.cost; }).slice(0, 10);
    A.total = num(r.total);
    A.boatsServiced = num(r.boats_serviced);
    A.nJobs = num(r.n_jobs);
    var c = r.central || {}, amtOf = {};
    var list = (c.memos || []).map(function(m){
      amtOf[m.id] = num(m.amount);
      var lm = memoById(m.id) || {};
      return { id: m.id, no: m.no, title: m.title, memoType: m.memo_type, status: m.status, createdDate: m.date, amount: num(m.full_amount), boatId: lm.boatId || '' };
    });
    A.central = { n: num(c.n), amt: num(c.amount), list: list, amtOf: amtOf };
    // the 12-month chart: the page sums A.all by month, so one line per month and status carries the server's figure
    (r.months || []).forEach(function(m){
      if(num(m.done)) A.all.push({ date: m.month + '-01', done: true, cost: num(m.done) });
      if(num(m.proc)) A.all.push({ date: m.month + '-01', done: false, cost: num(m.proc) });
    });
    return A;
  }

  wrap('costAggregate', function(orig){
    var period = (typeof _costTimeFilter !== 'undefined' && _costTimeFilter) ? _costTimeFilter : 'all';
    var r = read('/v1/fleet/reports/cost', { period: period }, redrawCost);
    if(!r) return orig.apply(this, [].slice.call(arguments, 1));
    return costFromReport(r);
  });

  /* ══ Insights ═══════════════════════════════════════════════════════════════════════════════════
     flRenderInsights asks flInsightsServer(period) for the period's jobs, spend and boats (every job that started in it,
     any status, at its cost so far). */
  function redrawInsights(){ if(viewOn('view-fl-insights') && typeof window.flRenderInsights === 'function') window.flRenderInsights(); }
  window.flInsightsServer = function(period){
    if(!enabled()) return null;
    return read('/v1/fleet/insights', { period: period || 'month' }, redrawInsights);
  };
  wrap('flRenderInsights', function(orig){
    window.flInsightsServer(typeof _insightsTimeFilter !== 'undefined' ? _insightsTimeFilter : 'month');
    return orig.apply(this, [].slice.call(arguments, 1));
  });

  O.fleetViews = { read: read, stale: stale, cache: function(){ return cache; } };
  window.laOpsFleetViews = O.fleetViews;
})();
