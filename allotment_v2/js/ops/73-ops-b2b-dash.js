/* ══════════════════════════════════════════════════════════════════════════
   §opsB2bDashSrv (w4-f1, 2026-10-18) · B2B Sales Dashboard figures ⇄ GET /v1/reports/b2b
   ──────────────────────────────────────────────────────────────────────────
   Server: operation-backend todo/b2-reports-model.md. For the period on screen (from, to, basis, compare, threshold) the
   server answers the period and the one it is compared with, the KPIs, each agent's class (new / growth / stable / loss
   / churn) and growth, the revenue bridge, the watch-list, the owner and market summaries and, for each route family,
   each agent's class on that route and the route-shift signal. Legacy worked all of it out from every trip line in the browser.

     b2dAgents (all agents)      ← agents[]  (current, previous, class, growth_pct, owner, market, bookings)
     b2dAgents (one route group) ← by_trip[family].agents[]   (a group that is exactly ONE server family)
     b2dSum                      ← kpis.* for the period and the compared period, by_trip[] for one route group
     b2dBridge                   ← bridge  (prev + growth + new + stable - loss - churn = now)
     b2dShiftSignal              ← by_trip[].agents[].signal  (looked up by the agent's route class and overall growth)
     b2dMonthlySeries            ← monthly[]  (the four KPI sparklines)
     b2dTabsScreen               gets the server's period totals from b2dSum and the agents from b2dAgents, so its KPI cards,
                                 tab counts, bridge, watch-list, staff / market summaries and the class tabs show the server's.
   The window (w) is the screen's own (mode, reference day, basis): wow/mom/r12 compare with the period before, wly with the
   same weekdays a year earlier (compare=year_weekday), mly with the same month a year earlier (compare=year).

   What stays legacy's (and why): a route GROUP of the screen (Phi Phi, Similan, Surin, Krabi, Other: decision Q13, ops/67) that is
   made of two or more server families (Phi Phi = Phi Phi Bamboo + Whale Shark, Other = six) keeps the browser's own sums over the
   lines, because the server serves per family, not per group; the agent / sales / market detail pages, the stacked monthly charts
   by owner / market and the default reference day also use the trip lines (55-ops-foc-b2b.js) because the report does not serve them.
   Classic script, after 55-ops-foc-b2b.js, 67-ops-b2d-families.js and 73-ops-srv-reads.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.srv) return;
  function on(){ return !!(O.enabled && O.enabled()); }
  function n(v){ return Number.isFinite(+v) ? +v : 0; }
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__w4f1) return;
    var w = function(){
      var args = [].slice.call(arguments);
      if(!on()) return orig.apply(this, args);
      return fn.apply(this, [orig].concat(args));
    };
    w.__w4f1 = true; w.__orig = orig; window[name] = w;
  }
  function repaint(){
    if(O.activeView() === 'b2b-dash' && !O.busy() && typeof window.renderB2BDash === 'function') window.renderB2BDash();
  }
  function compareOf(){ var m = (typeof _b2d !== 'undefined' && _b2d) ? _b2d.mode : ''; return m === 'wly' ? 'year_weekday' : (m === 'mly' ? 'year' : 'previous'); }
  /* the answer for the screen's period; null while it is on its way (legacy's sums show meanwhile) */
  function report(w){
    if(!w || !w.cs || !w.ce) return null;
    var st = (typeof _b2d !== 'undefined') ? _b2d : null; if(!st) return null;
    var q = { from: w.cs, to: w.ce, basis: st.basis, compare: compareOf(), threshold: st.T };
    var key = 'b2b|' + [q.from, q.to, q.basis, q.compare, q.threshold].join('|');
    var j = O.srv.read(key, '/v1/reports/b2b', q, repaint);
    if(j && !j.__idx) index(j);
    return j;
  }
  /* the server's route families → the screen's five groups (decision Q13: ops/67-ops-b2d-families.js) */
  function groupOfFamilyName(name){
    var fams = (typeof window.bookingV2Families === 'function') ? window.bookingV2Families() : [];
    var f = fams.filter(function(x){ return x.name === name; })[0];
    var table = window.laOpsB2dGroupOfFamily || {};
    return (f && table[f.id]) || 'Other';
  }
  function index(j){
    var groups = {};
    (j.by_trip || []).forEach(function(t){ var g = groupOfFamilyName(t.family); (groups[g] = groups[g] || []).push(t); });
    var sig = {};
    (j.by_trip || []).forEach(function(t){ (t.agents || []).forEach(function(a){ sig[a.route_class + '|' + a.overall_growth_pct] = a.signal; }); });
    j.__idx = { groups: groups, sig: sig };
  }
  /* which route group does a filter select? the filter is a function of a trip line; ask it about each group */
  function groupOfFilter(filter){
    var order = (typeof B2D_FAM_ORDER !== 'undefined') ? B2D_FAM_ORDER : [], hit = [];
    order.forEach(function(g){ try{ if(filter({ fam: g }) === true) hit.push(g); }catch(_){} });
    return hit.length === 1 ? hit[0] : null;
  }
  function singleFamily(j, g){
    var list = j.__idx.groups[g] || [];
    return list.length <= 1 ? (list[0] || null) : undefined;     // null = no data, undefined = several families
  }
  var SIG = { moved_to_other_routes: { c: '#B45309', bg: '#FEF3C7' }, portfolio_down: { c: '#E11D48', bg: '#FFF1F2' }, pulling_into_route: { c: '#2563EB', bg: '#EFF6FF' } };

  var lastWin = null;     // the window of the last agents call, for b2dBridge / b2dShiftSignal (they do not receive it)
  wrap('b2dAgents', function(orig, L, w, filter){
    var args = [].slice.call(arguments, 1), j = report(w);
    if(!j) return orig.apply(this, args);
    if(!filter){
      lastWin = w;
      var rows = (j.agents || []).map(function(a){
        return { agid: a.agent_id, ag: a.name, code: a.code || '', own: a.owner, ownId: a.owner_id, mkt: a.market, mktCode: a.market_code,
                 cur: n(a.current), prev: n(a.previous), curPax: n(a.current_pax), cls: a.class, g: a.growth_pct == null ? null : a.growth_pct, bookings: n(a.bookings) };
      });
      rows.__srv = j;
      return rows;
    }
    var g = groupOfFilter(filter); if(!g) return orig.apply(this, args);
    var fam = singleFamily(j, g);
    if(fam === undefined) return orig.apply(this, args);
    var ag = {}; (j.agents || []).forEach(function(a){ ag[a.agent_id] = a; });
    return ((fam && fam.agents) || []).map(function(a){
      var all = ag[a.agent_id] || {};
      return { agid: a.agent_id, ag: a.name, code: a.code || '', own: a.owner, ownId: a.owner_id, mkt: all.market || '', mktCode: all.market_code || '__none',
               cur: n(a.route_current), prev: n(a.route_previous), cls: a.route_class, g: a.route_growth_pct == null ? null : a.route_growth_pct, bookings: 0 };
    });
  });

  wrap('b2dSum', function(orig, L, from, to, filter){
    var args = [].slice.call(arguments, 1);
    var w = (typeof window.b2dWin === 'function') ? window.b2dWin(L) : null, j = w && report(w);
    if(!j) return orig.apply(this, args);
    var isCur = from === w.cs && to === w.ce, isPrev = from === w.ps && to === w.pe;
    if(!isCur && !isPrev) return orig.apply(this, args);
    if(!filter){
      var k = j.kpis, side = isCur ? 'current' : 'previous';
      return { rev: n(k.revenue[side]), pax: n(k.pax[side]), bookings: n(k.bookings[side]) };
    }
    var g = groupOfFilter(filter); if(!g) return orig.apply(this, args);
    var fam = singleFamily(j, g);
    if(fam === undefined) return orig.apply(this, args);
    if(!fam) return { rev: 0, pax: 0, bookings: 0 };
    return isCur ? { rev: n(fam.revenue), pax: n(fam.pax), bookings: n(fam.bookings) } : { rev: n(fam.previous), pax: 0, bookings: 0 };
  });

  wrap('b2dBridge', function(orig, agents){
    var j = agents && agents.__srv; if(!j) return orig.apply(this, [].slice.call(arguments, 1));
    var b = j.bridge;
    return { prevT: n(b.previous), curT: n(b.current), growth: n(b.growth), nw: n(b.new), stab: n(b.stable), loss: n(b.loss), churn: n(b.churn) };
  });

  wrap('b2dShiftSignal', function(orig, routeCls, overallG){
    var j = lastWin && report(lastWin), idx = j && j.__idx;
    var key = routeCls + '|' + overallG;
    if(!idx || !(key in idx.sig)) return orig.apply(this, [].slice.call(arguments, 1));
    var s = idx.sig[key]; if(!s) return null;
    var c = SIG[s.code] || {};
    return { t: s.text, c: c.c, bg: c.bg };
  });

  // w5-f: 85-ops-b2b-group-w5.js reads the same answer for a route group made of several server families
  O.b2bDash = { report: report, groupOfFilter: groupOfFilter, familiesOf: function(j, g){ return (j && j.__idx && j.__idx.groups[g]) || []; } };

  wrap('b2dMonthlySeries', function(orig, L){
    var j = lastWin && report(lastWin);
    if(!j || !Array.isArray(j.monthly) || !j.monthly.length) return orig.apply(this, [].slice.call(arguments, 1));
    return j.monthly.map(function(m){ return { ym: m.month, rev: n(m.revenue), pax: n(m.pax), agents: n(m.agents) }; });
  });
})();
