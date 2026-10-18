/* ══════════════════════════════════════════════════════════════════════════
   §opsB2bDetail (w6-a, 2026-10-18) · B2B Sales Dashboard: route groups of several families, and the agent / sales / market pages
   ──────────────────────────────────────────────────────────────────────────
   Server: operation-backend README "B2B route groups and detail pages".
     GET /v1/reports/b2b?...&families=<id>,<id>   -> route_group {revenue, previous, growth_pct, pax, bookings, agents_on_route,
                                                      agents[{agent_id, name, code, owner_id, owner, route_previous, route_current,
                                                      route_growth_pct, route_class, overall_growth_pct, signal}], bridge, kpis}
     GET /v1/reports/b2b/{agent|staff|market}/{id}-> figures {revenue, previous, pax, bookings, class, growth_pct}, kpis, monthly[], by_family[
                                                      {family, current, previous, class, growth_pct}], agents[] (staff / market)
   A route group of two or more families (Phi Phi = Phi Phi Bamboo + Whale Shark, Other = the rest): its agents with their class on the group and
   the route-shift signal (b2dAgents), its revenue / pax / bookings of the union (b2dSum; a booking on two of its families counts once) and its
   bridge (b2dBridge) are the server's. The detail pages keep legacy's drawing; their period figures (b2dSum of one agent / owner / market, and of
   an agent on a route group) and the agent page's per-group revenue come from the entity's report. A page is drawn with legacy's lines until
   the answer is in (or when the server does not know the entity).
   Still the browser's (docs/walk/w6-a.md): the stacked monthly chart (the report has monthly totals, not the split by route or by agent), the
   agent page's bookings / pax per route group, "routes sent", and its list of recent bookings.
   Classic script, after 73-ops-b2b-dash.js and 85-ops-b2b-group-w5.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O || !O.b2bDash || !O.srv) return;
  function on(){ return !!(O.enabled && O.enabled()); }
  function n(v){ return Number.isFinite(+v) ? +v : 0; }
  function wrap(name, fn){
    var orig = window[name];
    if(typeof orig !== 'function' || orig.__w6a) return;
    var w = function(){
      var args = [].slice.call(arguments);
      if(!on()) return orig.apply(this, args);
      return fn.apply(this, [orig].concat(args));
    };
    w.__w6a = true; w.__orig = orig; window[name] = w;
  }
  function repaint(){ if(O.activeView() === 'b2b-dash' && !O.busy() && typeof window.renderB2BDash === 'function') window.renderB2BDash(); }
  function compareOf(){ var m = (typeof _b2d !== 'undefined' && _b2d) ? _b2d.mode : ''; return m === 'wly' ? 'year_weekday' : (m === 'mly' ? 'year' : 'previous'); }
  function query(w){
    var st = (typeof _b2d !== 'undefined') ? _b2d : null; if(!st || !w || !w.cs) return null;
    return { from: w.cs, to: w.ce, basis: st.basis, compare: compareOf(), threshold: st.T };
  }
  function qkey(q){ return [q.from, q.to, q.basis, q.compare, q.threshold].join('|'); }

  /* ── the screen's groups → server family ids ── */
  function famsOf(group){
    var table = window.laOpsB2dGroupOfFamily || {}, fams = (typeof window.bookingV2Families === 'function') ? window.bookingV2Families() : [];
    var ids = fams.filter(function(f){ return (table[f.id] || 'Other') === group; }).map(function(f){ return f.id; });
    if(group === 'Other' && ids.indexOf('other') < 0) ids.push('other');         // routes with no family
    return ids;
  }
  function groupOfFamilyName(name){
    var fams = (typeof window.bookingV2Families === 'function') ? window.bookingV2Families() : [], table = window.laOpsB2dGroupOfFamily || {};
    var f = fams.filter(function(x){ return x.name === name; })[0];
    return (f && table[f.id]) || 'Other';
  }
  /* the group's answer when the filter selects a group made of two or more server families (the same test as ops/85) */
  function groupAnswer(w, filter){
    if(!filter) return null;
    var j = O.b2bDash.report(w); if(!j) return null;
    var g = O.b2bDash.groupOfFilter(filter); if(!g) return null;
    if(O.b2bDash.familiesOf(j, g).length < 2) return null;
    var q = query(w); if(!q) return null;
    var ids = famsOf(g); if(ids.length < 2) return null;
    q.families = ids.join(',');
    var rg = O.srv.read('b2bgrp|' + qkey(q) + '|' + q.families, '/v1/reports/b2b', q, repaint);
    rg = rg && rg.route_group;
    if(rg && j.__idx){ (rg.agents || []).forEach(function(a){ j.__idx.sig[a.route_class + '|' + a.overall_growth_pct] = a.signal; }); }   // b2dShiftSignal (ops/73) finds the group's signals
    return rg || null;
  }

  wrap('b2dAgents', function(orig, L, w, filter){
    var args = [].slice.call(arguments, 1), rg = groupAnswer(w, filter);
    if(!rg) return orig.apply(this, args);
    var all = {}; ((O.b2bDash.report(w) || {}).agents || []).forEach(function(a){ all[a.agent_id] = a; });
    var rows = (rg.agents || []).map(function(a){
      var o = all[a.agent_id] || {};
      return { agid: a.agent_id, ag: a.name, code: a.code || '', own: a.owner, ownId: a.owner_id, mkt: o.market || '', mktCode: o.market_code || '__none',
               cur: n(a.route_current), prev: n(a.route_previous), cls: a.route_class, g: a.route_growth_pct == null ? null : a.route_growth_pct, bookings: 0 };
    });
    rows.__group = rg;
    return rows;
  });
  wrap('b2dBridge', function(orig, agents){
    var rg = agents && agents.__group; if(!rg || !rg.bridge) return orig.apply(this, [].slice.call(arguments, 1));
    var b = rg.bridge;
    return { prevT: n(b.previous), curT: n(b.current), growth: n(b.growth), nw: n(b.new), stab: n(b.stable), loss: n(b.loss), churn: n(b.churn) };
  });

  /* ── the agent / owner / market pages ── */
  var ctx = null;                                  // { kind, id, J } while a detail page is being drawn
  var ent = {}, entBusy = {};
  function entityRead(kind, id, w){
    var q = query(w); if(!q) return null;
    var key = kind + '|' + id + '|' + qkey(q), e = ent[key];
    if(e && !e.stale) return e.j;
    if(!entBusy[key]){
      entBusy[key] = true;
      O.get('/v1/reports/b2b/' + kind + '/' + encodeURIComponent(id), q).then(function(j){
        ent[key] = { j: j && j.found ? j : null };
      }, function(err){
        ent[key] = { j: null };                                // 404: the server knows no lines for it (the page keeps legacy's)
        if(!err || err.status !== 404) O.fail('Could not load the ' + kind + ' page', err);
      }).then(function(){ delete entBusy[key]; repaint(); });
    }
    return e ? e.j : null;
  }
  O.onWrite(function(){ Object.keys(ent).forEach(function(k){ ent[k].stale = true; }); });
  function probeKey(kind){ return kind === 'agent' ? 'agid' : (kind === 'staff' ? 'ownId' : 'mktCode'); }
  /* what a detail page's filter selects: the whole entity ({only}) or the entity on one route group ({fam}); the filter is a function of a trip line */
  function entityFilterKind(filter, c){
    var p = {}; p[probeKey(c.kind)] = c.id;
    var other = Object.assign({ fam: '__none__' }, p), plain = false;
    try{ plain = filter(p) === true && filter(other) === true; }catch(_){}
    if(plain) return { only: true };
    var order = (typeof B2D_FAM_ORDER !== 'undefined') ? B2D_FAM_ORDER : [], hit = [];
    order.forEach(function(f){ try{ if(filter(Object.assign({ fam: f }, p)) === true) hit.push(f); }catch(_){} });
    return hit.length === 1 ? { fam: hit[0] } : null;
  }
  wrap('b2dSum', function(orig, L, from, to, filter){
    var args = [].slice.call(arguments, 1), w = (typeof window.b2dWin === 'function') ? window.b2dWin(L) : null;
    if(!w) return orig.apply(this, args);
    var isCur = from === w.cs && to === w.ce, isPrev = from === w.ps && to === w.pe;
    if(!isCur && !isPrev) return orig.apply(this, args);
    if(ctx && ctx.J && filter){
      var f = entityFilterKind(filter, ctx);
      if(f && f.only){
        var fg = ctx.J.figures || {};
        return isCur ? { rev: n(fg.revenue), pax: n(fg.pax), bookings: n(fg.bookings) } : { rev: n(fg.previous), pax: 0, bookings: 0 };
      }
      if(f && f.fam){
        var base = Object.assign({}, orig.apply(this, args)), cur = 0, prev = 0;
        (ctx.J.by_family || []).forEach(function(x){ if(groupOfFamilyName(x.family) === f.fam){ cur += n(x.current); prev += n(x.previous); } });
        base.rev = isCur ? cur : prev;      // revenue of the union of its families: the server's; pax / bookings of the group stay the lines'
        return base;
      }
    }
    var rg = groupAnswer(w, filter);
    if(rg) return isCur ? { rev: n(rg.revenue), pax: n(rg.pax), bookings: n(rg.bookings) } : { rev: n(rg.previous), pax: 0, bookings: 0 };
    return orig.apply(this, args);
  });
  function detail(name, kind){
    wrap(name, function(orig, L, w, agAll, id){
      var args = [].slice.call(arguments, 1), J = entityRead(kind, id, w), keep = ctx;
      ctx = J ? { kind: kind, id: id, J: J } : null;
      try{ return orig.apply(this, args); } finally { ctx = keep; }
    });
  }
  detail('b2dAgentDetail', 'agent');
  detail('b2dStaffDetail', 'staff');
  detail('b2dMarketDetail', 'market');
})();
