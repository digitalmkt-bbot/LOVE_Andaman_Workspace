/* ══════════════════════════════════════════════════════════════════════════
   §opsCostingPL · Trip P&L, Analysis and Costing ⇄ operation-backend
   ──────────────────────────────────────────────────────────────────────────
   Trip P&L (Daily / Monthly / Analysis tabs): every figure is computed on the
   server and only drawn here. The legacy renderers (pxDaily, pxMonth) keep
   their markup; they are fed trips mapped from the server's rows through
   pxDay / pxTrip / pxDayAgg. The Analysis tab is drawn from the server's
   analysis report (the browser no longer fits costs, bands or agent nets).

   Costing (template / plans / rented boats): ctRead / ctWrite for the three
   keys cost_template, cost_plans and boat_rent go to the server. The design
   sheet's live preview is the server's answer (POST /v1/costing/calc, debounced,
   cached per plan + template; legacy's own arithmetic until the first answer);
   the plan and template commands (ctFamSetPlan, ctDelLine, ctRenameGroup,
   ctResetTpl, ctDelPlan) go to the server. See the Q37 and Q38 sections.

   GET  /v1/reports/trip-pl?date=&pier=
   GET  /v1/reports/trip-pl/month?month=&pier=
   GET  /v1/reports/analysis?days=&pier=
   POST /v1/trip-actuals/:date/:boat_id/{close|reopen|ran|not-ran}
   GET|PUT /v1/costing/template
   GET|POST /v1/costing/plans · PATCH|DELETE /v1/costing/plans/:id
   GET /v1/costing/boat-rents · PUT|DELETE /v1/costing/boat-rents/:boat_id
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var O = window.laOps; if(!O) return;
  var TTL = 60000;
  var S = { day:{}, mday:{}, an:{}, loading:{}, rent:{} };   // rent: month -> { at, data: trip-pl/month rent_idle } (w5-d)
  var cost = { loaded:false, template:null, plans:[], rents:{}, rentSrv:{}, known:{}, idMap:{}, seq:0, loading:null };

  function enabled(){ return O.enabled(); }
  function text(v){ return v == null ? '' : String(v); }
  function esc(v){ return text(v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function n(v){ return Number.isFinite(+v) ? +v : 0; }
  function clone(x){ return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function baht(v){ return '฿' + Math.round(n(v)).toLocaleString('en-US'); }
  function fresh(e){ return !!e && (Date.now() - e.at) < TTL; }
  function once(key, make){
    if(S.loading[key]) return S.loading[key];
    var p = make().then(function(r){ delete S.loading[key]; return r; }, function(e){ delete S.loading[key]; throw e; });
    return (S.loading[key] = p);
  }
  function pool(items, size, fn){
    var i = 0, out = [];
    function next(){
      if(i >= items.length) return Promise.resolve();
      var k = i++;
      return Promise.resolve(fn(items[k])).then(function(r){ out[k] = r; return next(); });
    }
    var workers = []; for(var w = 0; w < Math.min(size, items.length); w++) workers.push(next());
    return Promise.all(workers).then(function(){ return out; });
  }
  function clearAll(){ S.day = {}; S.mday = {}; S.an = {}; S.rent = {}; }

  /* ── server trip → the legacy trip object the renderers read ─────────────── */
  var SRC = { actual:'r', plan:'p', formula:'f', pending:'w' };
  function legacyTrip(t){
    t = t || {};
    var px = t.pax || {}, up = t.upsell || {}, lt = t.longtail || {};
    var fp = t.fuel_price || {};
    var rows = (t.rows || []).map(function(r){
      return { id:r.id, g:r.group, l:r.label, vat:!!r.vat, est:n(r.estimate), real:r.actual == null ? null : n(r.actual),
               why:r.why || '', src:SRC[r.source] || 'f', gross:r.gross == null ? null : n(r.gross), use:n(r.use) };
    });
    return {
      bid:t.boat_id, boat:{ id:t.boat_id, name:t.name, cap:t.capacity }, name:t.name || t.boat_id,
      rid:t.route_id || '', route:{ name:t.route_name || '', color:t.route_color || '', pier:t.pier || '' }, dep:t.departs || '',
      px:{ ad:n(px.ad), chd:n(px.chd), inf:n(px.inf), foc:n(px.foc), tot:n(px.total), th:n(px.th), fr:n(px.fr), bk:n(px.bookings), rev:n(px.revenue) },
      ctx:{ eng:t.engines || '3EN' }, plan:t.plan ? { id:t.plan.id, name:t.plan.name, ovr:{}, grp:{} } : null,
      rows:rows, cost:n(t.cost),
      up:{ rows:(up.rows || []).map(function(u){ return { vc:u.voucher, label:u.label, sell:n(u.sell), comp:n(u.company), comm:n(u.commission), seller:u.seller || '', got:!!u.collected, kind:u.kind === 'sale' ? 'ex' : 'upg' }; }),
           sell:n(up.sell), company:n(up.company), comm:n(up.commission) },
      lt:{ chtr:n(lt.charter), join:n(lt.join), upg:n(lt.upgrades), upgDue:n(lt.upgrades_due) },
      fp:{ price:n(fp.price), src:fp.src || '', from:fp.from || '' },
      noSail:!!t.no_sail, ran:!!t.ran, wouldCost:n(t.would_cost),
      revGross:n(t.revenue_gross), rev:n(t.revenue), profit:n(t.profit), st:t.status || 'est', nReal:n(t.actual_lines),
      closed:!!t.closed, frozen:t.closed ? { at:t.closed.at || '', by:t.closed.by || '', pax:t.closed.pax } : null,
      be:t.break_even == null ? null : n(t.break_even), fuelPr:n(fp.price), checkRev:!!t.check_revenue, vans:t.vans || [], date:t.date
    };
  }
  function emptyTrip(date, bid){
    return legacyTrip({ date:date, boat_id:bid, name:bid, status:'nosail', no_sail:true, pax:{}, rows:[], upsell:{}, longtail:{}, fuel_price:{} });
  }

  /* ── day cache ──────────────────────────────────────────────────────────── */
  function dayKey(date, pier){ return date + '|' + (pier || ''); }
  function loadDay(date, pier){
    var k = dayKey(date, pier);
    if(fresh(S.day[k])) return Promise.resolve(S.day[k].data);
    return once('day:' + k, function(){
      return O.get('/v1/reports/trip-pl', { date:date, pier:pier || '' }).then(function(d){
        if(!d || d.date !== date || !Array.isArray(d.trips)) throw new Error('invalid Trip P&L response');
        S.day[k] = { at:Date.now(), data:d }; return d;
      });
    });
  }
  function dayTrips(date, pier){
    var e = S.day[dayKey(date, pier)];
    if(e) return e.data.trips;
    var all = S.day[dayKey(date, '')];
    if(all) return all.data.trips.filter(function(t){ return !pier || (t.pier || '') === pier; });
    return null;
  }

  /* ── month: full days for the shown month, server month totals for the one before ── */
  function loadMonthTotals(ym, pier){
    return once('mon:' + ym + '|' + (pier || ''), function(){
      return O.get('/v1/reports/trip-pl/month', { month:ym, pier:pier || '' }).then(function(d){
        if(!d || d.month !== ym || !Array.isArray(d.days)) throw new Error('invalid Trip P&L month response');
        d.days.forEach(function(x){ S.mday[dayKey(x.date, pier)] = { at:Date.now(), data:x }; });
        if(d.rent_idle) S.rent[ym] = { at:Date.now(), data:d.rent_idle };   // w5-d: rent is paid for the whole boat, not by pier
        return d;
      });
    });
  }
  function prevMonth(ym){
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 2, d = new Date(y, m, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function monthNeeds(){
    var ym = window._px.mon || String(window._px.date || '').slice(0, 7), pier = window._px.pier || '';
    var days = typeof window.pxDaysOf === 'function' ? window.pxDaysOf(ym) : [];
    var out = [];
    var miss = days.filter(function(d){ return !fresh(S.day[dayKey(d, pier)]); });       /* w6-d · the day read for the pier on screen: its bands, best boat and agent sums are the server's */
    if(miss.length) out.push(function(){ return pool(miss, 5, function(d){ return loadDay(d, pier); }); });
    if(days.length && !fresh(S.rent[ym])) out.push(function(){ return loadMonthTotals(ym, ''); });   // w5-d: pxRentIdle reads the server's rent_idle
    var pym = prevMonth(ym);
    var pmiss = days.some(function(d){ return !fresh(S.mday[dayKey(pym + '-' + d.slice(8, 10), pier)]); });
    if(days.length && pmiss) out.push(function(){ return loadMonthTotals(pym, pier); });
    return out;
  }

  /* ── the aggregate pxMonth reads, built from server trips (no browser costing) ── */
  /* w6-d · the day's aggregates the server works out (README "Fields the new frontend asked for": bands, best, agents of GET /v1/reports/trip-pl):
     the load-factor bands (under 40 / 60 / 80 / from 80), the best boat and each agent's sums with the rate-card total; the browser only lays them in legacy's shape */
  var BAND_AT = { under_40:0, under_60:1, under_80:2, from_80:3 };
  function agentCell(x){
    return { n:n(x.bookings), pax:n(x.heads), rev:n(x.revenue), cost:n(x.cost), exp:n(x.expected), expAmt:n(x.expected_amount), expPax:n(x.expected_pax), expMiss:n(x.expected_missing),
             zn:Object.assign({}, x.zones), rtn:Object.assign({}, x.rates) };
  }
  function addCell(to, from){
    ['n', 'pax', 'rev', 'cost', 'exp', 'expAmt', 'expPax', 'expMiss'].forEach(function(k){ to[k] += from[k]; });
    [['zn'], ['rtn']].forEach(function(m){ Object.keys(from[m[0]]).forEach(function(k){ to[m[0]][k] = (to[m[0]][k] || 0) + from[m[0]][k]; }); });
  }
  function serverAggregates(a, d){
    if(Array.isArray(d.bands)) d.bands.forEach(function(b){ var i = BAND_AT[b.band]; if(i == null) return; a.bandN[i] = n(b.n); a.bandNet[i] = n(b.net); a.bandPax[i] = n(b.pax); });
    if(d.best) a.best = { name:d.best.name, profit:n(d.best.profit) };
    (d.agents || []).forEach(function(g){
      var cell = agentCell(g), routes = {};
      Object.keys(g.routes || {}).forEach(function(rid){ routes[rid] = agentCell(g.routes[rid]); });
      var hit = a.agents[g.name];
      if(!hit){ cell.name = g.name; cell.b2c = !!g.b2c; cell.mk = g.market_id || ''; cell.routes = routes; a.agents[g.name] = cell; return; }
      addCell(hit, cell);
      Object.keys(routes).forEach(function(rid){ if(hit.routes[rid]) addCell(hit.routes[rid], routes[rid]); else hit.routes[rid] = routes[rid]; });
    });
    return a;
  }
  function aggFromTrips(date, trips, dayData){
    var a = { date:date, trips:trips.length, rev:0, cost:0, profit:0, pax:0, bk:0, loss:0, cap:0, routes:{}, agents:{}, groups:{}, gdet:{},
              bandN:[0,0,0,0], bandNet:[0,0,0,0], bandPax:[0,0,0,0], best:null, boats:[], tr:[] };
    trips.forEach(function(t){
      var lt = legacyTrip(t), cap = n(t.capacity);
      a.rev += lt.rev; a.cost += lt.cost; a.profit += lt.profit; a.pax += lt.px.tot; a.bk += lt.px.bk; a.cap += cap;
      if(lt.profit < 0) a.loss++;
      if(!a.best || lt.profit > a.best.profit) a.best = { name:lt.name, profit:lt.profit };
      a.boats.push({ bid:lt.bid, name:lt.name, profit:lt.profit });
      var rk = lt.rid || lt.route.name || '-';
      var R = a.routes[rk] || (a.routes[rk] = { name:lt.route.name || '-', color:lt.route.color || '#64748B', n:0, pax:0, rev:0, cost:0, profit:0, cap:0, be:0, beN:0, pier:lt.route.pier });
      R.n++; R.pax += lt.px.tot; R.rev += lt.rev; R.cost += lt.cost; R.profit += lt.profit; R.cap += cap;
      if(lt.be){ R.be += lt.be; R.beN++; }
      a.tr.push({ rid:rk, bid:lt.bid, name:lt.name, date:date, pax:lt.px.tot, cost:lt.cost, rev:lt.rev, cap:cap, foc:lt.px.foc, inf:lt.px.inf });
      lt.rows.forEach(function(r){ a.groups[r.g] = (a.groups[r.g] || 0) + r.use; });
    });
    return dayData ? serverAggregates(a, dayData) : a;
  }
  function aggFromTotals(date, x){
    x = x || {};
    return { date:date, trips:n(x.trips), rev:n(x.revenue), cost:n(x.cost), profit:n(x.profit), pax:n(x.pax), bk:n(x.bookings), loss:n(x.loss_trips), cap:n(x.capacity),
             routes:{}, agents:{}, groups:{}, gdet:{}, bandN:[0,0,0,0], bandNet:[0,0,0,0], bandPax:[0,0,0,0], best:null, boats:[], tr:[] };
  }

  /* ── Analysis tab, drawn from the server report ─────────────────────────── */
  function anKey(days, pier){ return days + '|' + (pier || ''); }
  function loadAnalysis(days, pier){
    var k = anKey(days, pier);
    if(fresh(S.an[k])) return Promise.resolve(S.an[k].data);
    return once('an:' + k, function(){
      return O.get('/v1/reports/analysis', { days:days, pier:pier || '' }).then(function(d){
        if(!d || !d.totals || !d.window) throw new Error('invalid analysis response');
        S.an[k] = { at:Date.now(), data:d }; return d;
      });
    });
  }
  var TH = 'padding:7px 9px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#64748B;background:#F8FAFC';
  function tbl(heads, rows, empty){
    return '<div style="overflow:auto;background:#fff;border:1px solid #E2E8F0;border-radius:12px;margin-bottom:14px"><table style="width:100%;border-collapse:collapse"><thead><tr>'
      + heads.map(function(h, i){ return '<th style="' + TH + (i ? ';text-align:right' : '') + '">' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>'
      + (rows.length ? rows.map(function(r){
          return '<tr style="border-top:1px solid #EEF2F6">' + r.map(function(c, i){ return '<td style="padding:7px 9px;font-size:12px;font-variant-numeric:tabular-nums;text-align:' + (i ? 'right' : 'left') + '">' + c + '</td>'; }).join('') + '</tr>';
        }).join('') : '<tr><td colspan="' + heads.length + '" style="padding:18px;text-align:center;color:#64748B">' + esc(empty || 'No data') + '</td></tr>')
      + '</tbody></table></div>';
  }
  function kpi(label, value, color){
    return '<div style="flex:1;min-width:140px;background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:12px 14px"><div style="font-size:10px;text-transform:uppercase;color:#64748B;font-weight:600">'
      + esc(label) + '</div><div style="font-size:20px;font-weight:700;margin-top:3px;color:' + (color || '#0F172A') + '">' + value + '</div></div>';
  }
  function head(t){ return '<div style="font-size:12px;font-weight:700;margin:16px 0 8px">' + esc(t) + '</div>'; }
  function net(v){ return (n(v) < 0 ? '−' : '+') + baht(Math.abs(n(v))); }
  function pct(v){ return Math.round(n(v) * 100) + '%'; }
  var BAND = { under_40:'Under 40% full', '40_60':'40-60% full', '60_80':'60-80% full', over_80:'Over 80% full' };
  var VERDICT = { loss:'Loss', thin:'Thin', healthy:'Healthy' };
  function analysisHtml(d){
    var T = d.totals, P = d.previous_window || {}, w = d.window;
    if(!T.trips) return '<div class="empty">No trips in the last ' + esc(w.days) + ' days</div>';
    var out = '<div style="padding:4px 2px"><div style="font-size:11px;color:#64748B;margin-bottom:10px">Server analysis · ' + esc(w.from) + ' to ' + esc(w.to)
      + ' · target ' + baht(d.target_per_pax) + '/pax' + (d.pier ? ' · pier ' + esc(d.pier) : '') + '</div>';
    out += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:6px">'
      + kpi('Revenue', baht(T.revenue), '#0F6E56') + kpi('Cost', baht(T.cost), '#A05A1A') + kpi('Net', net(T.net), n(T.net) < 0 ? '#A32D2D' : '#0F6E56')
      + kpi('Trips', esc(T.trips) + (T.did_not_sail ? ' (' + esc(T.did_not_sail) + ' did not sail)' : '')) + kpi('Pax', esc(T.pax)) + kpi('Load factor', pct(T.load_factor))
      + kpi('Agents below cost', esc(T.agents_below_cost) + ' · ' + net(T.below_cost_net), n(T.agents_below_cost) ? '#A32D2D' : '#0F172A')
      + kpi('Receipted cost', esc(T.receipted_pct) + '%') + '</div>';
    if(P.trips != null) out += '<div style="font-size:11px;color:#64748B">Previous ' + esc(P.days) + ' days: ' + esc(P.trips) + ' trips · ' + esc(P.pax) + ' pax · revenue ' + baht(P.revenue) + ' · net ' + net(P.net) + '</div>';
    out += head('Routes · net per pax') + tbl(['Route', 'Trips', 'Avg pax', 'Revenue/pax', 'Cost/pax', 'Net/pax', 'Net', 'Load', 'B/E plan', 'B/E fit'],
      (d.routes || []).map(function(r){
        return [esc(r.name) + (r.below_cost ? ' <b style="color:#A32D2D">below cost</b>' : ''), esc(r.trips) + (r.did_not_sail ? ' (' + esc(r.did_not_sail) + ' idle)' : ''), esc(r.avg_pax) + '/' + esc(r.avg_capacity),
                baht(r.revenue_per_pax), baht(r.cost_per_pax), net(r.net_per_pax), net(r.net), pct(r.load_factor), r.break_even_plan == null ? '-' : esc(r.break_even_plan), r.break_even_fit == null ? '-' : esc(r.break_even_fit)];
      }));
    out += head('Load-factor bands') + tbl(['Band', 'Trips', 'Avg pax', 'Net', 'Net/pax', 'Verdict'],
      (d.bands || []).map(function(b){ return [esc(BAND[b.key] || b.key), esc(b.trips), b.avg_pax == null ? '-' : esc(b.avg_pax), net(b.net), b.net_per_pax == null ? '-' : net(b.net_per_pax), b.verdict ? esc(VERDICT[b.verdict] || b.verdict) : '-']; }));
    out += head('Cost groups' + ((d.movers || []).length ? ' · rising: ' + d.movers.join(', ') : '')) + tbl(['Group', 'Amount', '% of cost', '/pax', 'Previous', 'Change', 'Receipted'],
      (d.groups || []).map(function(g){
        return [esc(g.group), baht(g.amount), esc(g.share_of_cost_pct) + '%', baht(g.cost_per_pax), g.previous == null ? '-' : baht(g.previous), g.change_pct == null ? '-' : (g.change_pct > 0 ? '+' : '') + esc(g.change_pct) + '%', pct(g.receipted_share)];
      }));
    out += head('Weeks') + tbl(['Week', 'Trips', 'Pax', 'Revenue/pax', 'Cost/pax', 'Net/pax'],
      (d.weeks || []).map(function(x){ return [esc(x.from) + ' to ' + esc(x.to), esc(x.trips), esc(x.pax), baht(x.revenue_per_pax), baht(x.cost_per_pax), net(x.net_per_pax)]; }));
    if((d.flags || []).length) out += head('Check revenue · ' + baht(T.flags_missing) + ' missing') + tbl(['Trip', 'Pax', 'Revenue/pax', 'Route average', 'Gap', 'Missing'],
      d.flags.map(function(f){ return [esc(f.date) + ' · ' + esc(f.boat_name) + ' · ' + esc(f.route_name || f.route_id), esc(f.pax), baht(f.revenue_per_pax), baht(f.route_average), net(f.gap), baht(f.missing)]; }));
    out += head('Markets') + tbl(['Market', 'Agents', 'Heads', 'Revenue', 'Cost', 'Net', 'Net/pax'],
      (d.markets || []).map(function(m){ return [esc(m.market_name), esc(m.agents), esc(m.heads), baht(m.revenue), baht(m.cost), net(m.net), net(m.net_per_pax)]; }));
    var AG = d.agents || [], shown = window._px && window._px.agAll ? AG : AG.slice(0, 15);
    out += head('Agent contribution · ' + AG.length + ' agents') + tbl(['Agent', 'Market', 'Bookings', 'Heads', 'Revenue/pax', 'Cost/pax', 'Net/pax', 'Net'],
      shown.map(function(a){ return [esc(a.name) + (a.below_cost ? ' <b style="color:#A32D2D">below cost</b>' : ''), esc(a.market_name), esc(a.bookings), esc(a.heads), baht(a.revenue_per_pax), baht(a.cost_per_pax), net(a.net_per_pax), net(a.net)]; }));
    if(AG.length > 15) out += '<button onclick="pxAgAll()" style="padding:6px 12px;margin-bottom:14px">' + (window._px.agAll ? 'Show top 15' : 'Show all ' + AG.length) + '</button>';
    return out + '</div>';
  }

  /* ── renderTripPL gate: fetch what the tab needs, then let the legacy renderer draw ── */
  var paintSeq = 0;
  function needs(){
    var P = window._px; if(!P) return [];
    var pier = P.pier || '';
    if(P.tab === 'm') return monthNeeds();
    if(P.tab === 'a') return fresh(S.an[anKey(P.an || 47, pier)]) ? [] : [function(){ return loadAnalysis(P.an || 47, pier); }];
    return fresh(S.day[dayKey(P.date, pier)]) ? [] : [function(){ return loadDay(P.date, pier); }];
  }
  function shell(inner){
    var host = document.getElementById('trippl-host'); if(!host) return;
    var e = function(x){ return esc(x); }, bar = '';
    try{ bar = '<style id="pl-style">' + window.pxCSS() + '</style>' + window.pxBar(e); }catch(_){}
    host.innerHTML = bar + inner;
  }

  function wrap(name, replacement){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsCostingPL) return;
    var w = function(){ return replacement.apply(this, [orig].concat([].slice.call(arguments))); };
    w.__opsCostingPL = true; window[name] = w;
  }
  wrap('renderTripPL', function(orig){
    if(!enabled()) return orig.apply(this, [].slice.call(arguments, 1));
    var P = window._px;
    if(!P.date) P.date = O.today();
    if(!P.mon) P.mon = String(P.date).slice(0, 7);
    if(!P.an) P.an = 47;
    var jobs = needs();
    if(!jobs.length) return orig();
    var token = ++paintSeq;
    shell(O.loadingHtml('Loading Trip P&L...'));
    return Promise.all(jobs.map(function(f){ return f(); })).then(function(){ if(token === paintSeq) orig(); },
      function(err){ O.fail('Trip P&L did not load', err); if(token === paintSeq) shell('<div class="empty" style="color:#A32D2D">Trip P&amp;L did not load from operation-backend.</div>'); });
  });
  wrap('pxDay', function(orig, date, pier){
    if(!enabled()) return orig.apply(this, [].slice.call(arguments, 1));
    return (dayTrips(date, pier || '') || []).map(legacyTrip);
  });
  wrap('pxTrip', function(orig, date, bid){
    if(!enabled()) return orig.apply(this, [].slice.call(arguments, 1));
    var keys = Object.keys(S.day);
    for(var i = 0; i < keys.length; i++){
      if(keys[i].indexOf(date + '|') !== 0) continue;
      var hit = S.day[keys[i]].data.trips.filter(function(t){ return t.boat_id === bid; })[0];
      if(hit) return legacyTrip(hit);
    }
    return emptyTrip(date, bid);
  });
  wrap('pxDayAgg', function(orig, date, pier){
    if(!enabled()) return orig.apply(this, [].slice.call(arguments, 1));
    var trips = dayTrips(date, pier || ''), own = S.day[dayKey(date, pier || '')];
    if(trips) return aggFromTrips(date, trips, own && own.data && Array.isArray(own.data.bands) ? own.data : null);
    var m = S.mday[dayKey(date, pier || '')];
    return aggFromTotals(date, m && m.data);
  });
  /* pxAgents · the per-trip agent split of the day card: trips[].agents of the day answer (heads, children, amount, the rate-card total) */
  wrap('pxAgents', function(orig, date, bid){
    if(!enabled()) return orig.apply(this, [].slice.call(arguments, 1));
    var keys = Object.keys(S.day), hit = null;
    for(var i = 0; i < keys.length && !hit; i++){
      if(keys[i].indexOf(date + '|') !== 0) continue;
      hit = S.day[keys[i]].data.trips.filter(function(t){ return t.boat_id === bid; })[0] || null;
    }
    if(!hit || !Array.isArray(hit.agents)) return orig(date, bid);
    return hit.agents.map(function(g){
      var head = n(g.heads), chd = n(g.children);
      return { key:g.key, name:g.name, b2c:!!g.b2c, mk:g.market_id || '', n:n(g.bookings), head:head, ad:Math.max(0, head - chd), chd:chd, amt:n(g.amount),
               exp:n(g.expected_total), expAmt:n(g.expected_amount), expPax:n(g.expected_pax), expMiss:n(g.expected_missing), zn:Object.assign({}, g.zones), rtn:Object.assign({}, g.rates) };
    }).sort(function(a, b){ return b.amt - a.amt; });
  });
  /* pxRentIdle · rent paid for the days the boat did not sail: the server's rent_idle of the month (GET /v1/reports/trip-pl/month), in legacy's row shape (w5-d) */
  wrap('pxRentIdle', function(orig, days){
    if(!enabled()) return orig.apply(this, [].slice.call(arguments, 1));
    var ym = days && days.length ? String(days[0]).slice(0, 7) : '', e = ym ? S.rent[ym] : null, R = e && e.data;
    if(!R || !Array.isArray(R.rows)) return orig(days);
    return R.rows.map(function(r){
      return { bid:r.boat_id, name:r.name, RN:{ to:r.open_ended ? '' : r.to, name:r.name }, SP:{ from:r.from, to:r.to, due:n(r.due), opDays:n(r.days_plan) }, slots:n(r.slots), sail:n(r.sailed),
               daysRan:n(r.days_ran), opPlan:n(r.days_plan), booked:n(r.booked), due:n(r.due), gap:n(r.gap) };
    });
  });
  wrap('pxAnalysis', function(orig){
    if(!enabled()) return orig.apply(this, [].slice.call(arguments, 1));
    var e = S.an[anKey(window._px.an || 47, window._px.pier || '')];
    return e ? analysisHtml(e.data) : '<div class="empty">Analysis is not loaded</div>';
  });
  /* the cost-per-head agent split in the day card reads bookings, which the server day does not carry:
     it stays a local read of SB_BOOKINGS (kept as is). */

  /* Close / reopen / ran: the server decides and freezes the numbers (legacy wrote TRIP_ACT locally). */
  function tripCommand(bid, verb){
    var date = window._px.date;
    return O.queue(function(){ return O.post('/v1/trip-actuals/' + encodeURIComponent(date) + '/' + encodeURIComponent(bid) + '/' + verb); }).then(function(){
      clearAll(); O.wrote('trip-pl'); window.renderTripPL();
    }, function(e){ O.fail('Trip P&L was not saved', e); });
  }
  wrap('pxClose', function(orig, bid){
    if(!enabled()) return orig.apply(this, [].slice.call(arguments, 1));
    if(typeof window.laGuardEdit === 'function' && !window.laGuardEdit('accounting')) return;
    var t = window.pxTrip(window._px.date, bid);
    if(t.closed){ if(!confirm('Reopen this trip? Its figures will follow the current formulas and prices again.')) return; return tripCommand(bid, 'reopen'); }
    if(!confirm('Close this trip?\n\n' + t.name + ' · ' + (t.route.name || '') + '\nRevenue ' + t.rev.toLocaleString() + ' - cost ' + t.cost.toLocaleString()
      + ' = ' + (t.profit >= 0 ? 'profit ' : 'loss ') + Math.abs(t.profit).toLocaleString() + '\n\nThe figures freeze at the server.')) return;
    return tripCommand(bid, 'close');
  });
  wrap('pxRan', function(orig, bid){
    if(!enabled()) return orig.apply(this, [].slice.call(arguments, 1));
    if(typeof window.laGuardEdit === 'function' && !window.laGuardEdit('accounting')) return;
    var t = window.pxTrip(window._px.date, bid);
    if(t.ran){ if(!confirm('Mark this boat as "did not sail"? Its cost goes back to 0.')) return; return tripCommand(bid, 'not-ran'); }
    if(!confirm('Confirm this boat sailed with no passengers?\n\n' + t.name + ' · ' + (t.route.name || '') + '\nCost counted if it sailed: ' + Math.round(t.wouldCost).toLocaleString() + ' THB')) return;
    return tripCommand(bid, 'ran');
  });

  /* ══ Costing: template / plans / rented boats ══════════════════════════════ */
  var PART_OUT = { kind:'k', qty:'q', qty_4en:'q4', unit:'u', unit_4en:'u4', unit_th:'uTH', unit_ch:'uCh', unit_ch_th:'uChTH' };
  var PART_IN = { k:'kind', q:'qty', q4:'qty_4en', u:'unit', u4:'unit_4en', uTH:'unit_th', uCh:'unit_ch', uChTH:'unit_ch_th' };
  var PART_NUM = ['qty', 'qty_4en', 'unit', 'unit_4en', 'unit_th', 'unit_ch', 'unit_ch_th', 'every', 'min', 'over', 'add'];

  function partFromServer(p){
    var o = {};
    Object.keys(p || {}).forEach(function(k){ o[PART_OUT[k] || k] = p[k]; });
    return o;
  }
  function partToServer(p, withKind){
    var out = {}, src = p || {};
    Object.keys(PART_IN).forEach(function(k){ if(src[k] !== undefined) out[PART_IN[k]] = src[k]; });
    ['kind', 'per', 'mode', 'fuel'].concat(PART_NUM).forEach(function(k){ if(src[k] !== undefined) out[k] = src[k]; });
    var res = {};
    Object.keys(out).forEach(function(k){
      var v = out[k];
      if(k === 'kind'){ res.kind = v; return; }
      if(v === '' || v === null) return;
      if(k === 'fuel'){ if(v) res.fuel = true; return; }
      if(k === 'per' || k === 'mode'){ res[k] = v; return; }
      res[k] = +v;
    });
    if(withKind && !res.kind) res.kind = 'var';
    return res;
  }
  function lineFromServer(l){
    var o = { id:l.id, g:l.group, l:l.label, vat:!!l.vat, parts:(l.parts || []).map(partFromServer) };
    if(l.on_demand){ o.od = 1; o.odQ = l.on_demand_qty == null ? 0 : l.on_demand_qty; }
    return o;
  }
  function templateFromServer(t){
    return { vatRate:n(t.vat_rate), lines:(t.lines || []).map(lineFromServer), dropped:(t.dropped || []).slice() };
  }
  function templateToServer(t){
    return {
      vat_rate:Math.max(0, n(t.vatRate)),
      lines:(t.lines || []).map(function(l){
        var od = !!l.od;
        return { id:l.id, group:l.g || 'อื่นๆ', label:text(l.l), vat:!!l.vat, parts:(l.parts || []).map(function(p){ return partToServer(p, true); }),
                 on_demand:od, on_demand_qty:od ? Math.max(0, n(l.odQ)) : null };
      })
    };
  }
  function ovrFromServer(o){
    var out = {};
    Object.keys(o || {}).forEach(function(id){
      var v = o[id] || {}, x = {};
      if(v.off) x.off = 1;
      if(v.parts) x.p = v.parts.map(function(p){ return p ? partFromServer(p) : {}; });
      out[id] = x;
    });
    return out;
  }
  function ovrToServer(o){
    var out = {};
    Object.keys(o || {}).forEach(function(id){
      var v = o[id]; if(!v) return;
      var x = {};
      if(v.off) x.off = 1;
      if(Array.isArray(v.p)) x.parts = v.p.map(function(p){ var q = partToServer(p, false); delete q.kind; return Object.keys(q).length ? q : null; });
      out[id] = x;
    });
    return out;
  }
  function planFromServer(p){
    var od = {};
    Object.keys(p.on_demand || {}).forEach(function(id){ var v = p.on_demand[id], x = {};
      if(v.agent_qty != null) x.aQ = v.agent_qty; if(v.agent_rev != null) x.aR = v.agent_rev; if(v.upsell_qty != null) x.uQ = v.upsell_qty; if(v.upsell_rev != null) x.uR = v.upsell_rev; od[id] = x; });
    return { id:p.id, name:p.name, famId:p.route_key || '', note:p.note || '', eng:p.engines, boats:p.boats, cap:p.capacity, pax:p.pax, paxTH:p.pax_th,
             price:p.price, priceCh:p.price_child == null ? '' : p.price_child, chPct:p.child_pct, comm:p.commission_pct, fuel:p.fuel_price,
             boatId:p.boat_id || '', rentOff:p.rent_off ? 1 : 0, ovr:ovrFromServer(p.overrides), grp:clone(p.groups || {}), od:od,
             itin:clone(p.itinerary || []), tiers:clone(p.tiers || []) };
  }
  function whole(v, min){ var x = Math.round(n(v)); return x < min ? min : x; }
  function planToServer(p){
    var od = {};
    Object.keys(p.od || {}).forEach(function(id){ var v = p.od[id] || {}, x = {};
      [['aQ', 'agent_qty'], ['aR', 'agent_rev'], ['uQ', 'upsell_qty'], ['uR', 'upsell_rev']].forEach(function(m){ if(v[m[0]] !== undefined && v[m[0]] !== '') x[m[1]] = Math.max(0, n(v[m[0]])); });
      od[id] = x; });
    var grp = {};
    Object.keys(p.grp || {}).forEach(function(g){ var v = p.grp[g] || {}; grp[g] = { off:v.off ? 1 : 0, pct:n(v.pct) }; });
    var body = {
      name:text(p.name) || 'Plan', route_key:p.famId ? text(p.famId) : null, note:p.note ? text(p.note) : null,
      engines:p.eng === '4EN' ? '4EN' : '3EN', boats:whole(p.boats, 1), capacity:whole(p.cap, 1), pax:whole(p.pax, 0), pax_th:whole(p.paxTH, 0),
      price:Math.max(0, n(p.price)), price_child:(p.priceCh === '' || p.priceCh == null) ? null : Math.max(0, n(p.priceCh)),
      child_pct:Math.min(100, Math.max(0, n(p.chPct))), commission_pct:Math.min(100, Math.max(0, n(p.comm))), fuel_price:Math.max(0, n(p.fuel)),
      boat_id:p.boatId ? text(p.boatId) : null, rent_off:!!p.rentOff, overrides:ovrToServer(p.ovr), groups:grp, on_demand:od
    };
    if(Array.isArray(p.itin)) body.itinerary = p.itin;
    if(Array.isArray(p.tiers)) body.tiers = p.tiers;
    return body;
  }
  function rentFromServer(r){
    var ex = {}; (r.owner_pays || []).forEach(function(id){ ex[id] = 1; });
    return { on:r.rented ? 1 : 0, mode:r.mode, amt:r.amount, seat:r.per_seat, days:r.days, off:r.days_off, trips:r.trips_per_day, vat:r.vat ? 1 : 0, note:r.note || '',
             from:r.from || '', to:r.to || '', fuelMul:r.fuel_pct == null ? 100 : r.fuel_pct, ex:ex };
  }
  function rentToServer(r){
    var fm = n(r.fuelMul), ex = [];
    Object.keys(r.ex || {}).forEach(function(id){ if(r.ex[id]) ex.push(id); });
    return { rented:!!r.on, mode:r.mode === 'seat' ? 'seat' : 'lump', amount:Math.max(0, n(r.amt)), per_seat:Math.max(0, n(r.seat)), days:whole(r.days || 30, 1),
             days_off:whole(r.off, 0), trips_per_day:whole(r.trips || 1, 1), vat:!!r.vat, note:r.note ? text(r.note) : null, from:r.from || null, to:r.to || null,
             fuel_pct:(fm > 0 && fm !== 100) ? fm : null, owner_pays:ex };
  }
  function rentsFromServer(list){ var o = {}; (list || []).forEach(function(r){ o[r.boat_id] = rentFromServer(r); }); return o; }

  /* the rent numbers the server worked out (seats, total, run days, per day, per trip), kept with the record they belong to */
  function rentSrvSet(list){
    cost.rentSrv = {};
    (list || []).forEach(function(r){ cost.rentSrv[r.boat_id] = { sig:JSON.stringify(rentFromServer(r)), seats:r.seats, total:r.total, run_days:r.run_days, per_day:r.per_day, per_trip:r.per_trip, per_calendar_day:r.per_calendar_day }; });
  }
  function costApply(tpl, plans, rents){
    cost.template = templateFromServer(tpl);
    cost.plans = (plans.plans || []).map(planFromServer);
    cost.rents = rentsFromServer((rents || {}).rents);
    rentSrvSet((rents || {}).rents);
    cost.known = {}; cost.plans.forEach(function(p){ cost.known[p.id] = JSON.stringify(p); });
    cost.knownRents = {}; Object.keys(cost.rents).forEach(function(k){ cost.knownRents[k] = JSON.stringify(cost.rents[k]); });
    cost.loaded = true;
    if(typeof window.ctRentBust === 'function') window.ctRentBust();
  }
  function loadCosting(force){
    if(cost.loaded && !force) return Promise.resolve();
    if(cost.loading) return cost.loading;
    cost.loading = Promise.all([O.get('/v1/costing/template'), O.get('/v1/costing/plans'), O.get('/v1/costing/boat-rents')]).then(function(r){
      cost.loading = null; costApply(r[0], r[1], r[2]);
    }, function(e){ cost.loading = null; throw e; });
    return cost.loading;
  }
  function refreshAfterFail(title, e){
    O.fail(title, e);
    return loadCosting(true).then(function(){ if(typeof window.ctRender === 'function') window.ctRender(); }, function(){});
  }

  var calcApi = { render:null };   /* filled by the Q37 section below */
  var COST_KEYS = { cost_template:1, cost_plans:1, boat_rent:1 };
  function costRead(key){
    if(!cost.loaded) return null;
    if(key === 'cost_template') return clone(cost.template);
    if(key === 'cost_plans') return cost.plans.length ? clone(cost.plans) : null;
    return clone(cost.rents);
  }
  function writeTemplate(val){
    var mine = ++cost.seq; cost.template = clone(val);
    return O.queue(function(){ return O.call('PUT', '/v1/costing/template', templateToServer(val)); }).then(function(res){
      if(mine === cost.seq){ cost.template = templateFromServer(res); }
      O.wrote('costing');
    }, function(e){ return refreshAfterFail('Cost template was not saved', e); });
  }
  function writeRents(val){
    var next = clone(val) || {}, jobs = [];
    Object.keys(next).forEach(function(id){ var s = JSON.stringify(next[id]); if(cost.knownRents[id] !== s){ jobs.push({ id:id, body:rentToServer(next[id]) }); cost.knownRents[id] = s; } });
    Object.keys(cost.knownRents).forEach(function(id){ if(!(id in next)){ jobs.push({ id:id, del:true }); delete cost.knownRents[id]; } });
    cost.rents = next;
    if(!jobs.length) return Promise.resolve();
    return O.queue(function(){
      var last = null;
      return jobs.reduce(function(p, j){ return p.then(function(){
        return j.del ? O.del('/v1/costing/boat-rents/' + encodeURIComponent(j.id)) : O.call('PUT', '/v1/costing/boat-rents/' + encodeURIComponent(j.id), j.body).then(function(r){ last = r; });
      }); }, Promise.resolve()).then(function(){ if(last && last.rents) rentSrvSet(last.rents); });
    }).then(function(){ O.wrote('costing'); if(typeof window.ctRentBust === 'function') window.ctRentBust(); if(calcApi.render) calcApi.render(); }, function(e){ return refreshAfterFail('Boat rent was not saved', e); });
  }
  function writePlans(val){
    var next = clone(val) || [], jobs = [], keep = {};
    next.forEach(function(p){
      keep[p.id] = 1;
      var s = JSON.stringify(p);
      if(!(p.id in cost.known)) jobs.push({ op:'post', plan:clone(p) });
      else if(cost.known[p.id] !== s) jobs.push({ op:'patch', id:p.id, body:planToServer(p) });
      cost.known[p.id] = s;
    });
    Object.keys(cost.known).forEach(function(id){ if(!keep[id]){ jobs.push({ op:'del', id:id }); delete cost.known[id]; } });
    cost.plans = next;
    if(!jobs.length) return Promise.resolve();
    function realId(id){ return cost.idMap[id] || id; }
    var shown = false;
    /* Q38 · the server keeps pax >= 1 and pax_th <= pax and gives a route key to one plan only: what it answers is what the screen shows */
    function adopt(id, res, body){
      var p = cost.plans.filter(function(x){ return x.id === id; })[0]; if(!p || !res) return;
      /* w4-f3 · the plan tab's pax / paxTH are clamped while typing (75-ops-costing-sheet.js ctPlanSet), as the column header does, so the server's number is shown at once */
      if(res.pax != null && +res.pax !== +p.pax){ p.pax = res.pax; shown = true; }
      if(res.pax_th != null && +res.pax_th !== +p.paxTH){ p.paxTH = res.pax_th; shown = true; }
      if(body && body.route_key){ cost.plans.forEach(function(x){ if(x.id !== id && x.famId === body.route_key){ x.famId = ''; cost.known[x.id] = JSON.stringify(x); shown = true; } }); }
      cost.known[id] = JSON.stringify(p);
    }
    return O.queue(function(){
      return jobs.reduce(function(p, j){ return p.then(function(){
        if(j.op === 'del') return O.del('/v1/costing/plans/' + encodeURIComponent(realId(j.id)));
        if(j.op === 'patch') return O.patch('/v1/costing/plans/' + encodeURIComponent(realId(j.id)), j.body).then(function(res){ adopt(j.id, res, j.body); });
        return O.post('/v1/costing/plans', planToServer(j.plan)).then(function(res){
          var oldId = j.plan.id; if(!res || !res.id) return;
          cost.idMap[oldId] = res.id;
          cost.plans.forEach(function(x){ if(x.id === oldId) x.id = res.id; });
          cost.known[res.id] = cost.known[oldId]; delete cost.known[oldId];
          if(typeof window._ct !== 'undefined' && window._ct && window._ct.pid === oldId) window._ct.pid = res.id;
          adopt(res.id, res, planToServer(j.plan));
        });
      }); }, Promise.resolve());
    }).then(function(){ O.wrote('costing'); if((shown || Object.keys(cost.idMap).length) && typeof window.ctRender === 'function') window.ctRender(); },
      function(e){ return refreshAfterFail('Cost plan was not saved', e); });
  }
  function costWrite(key, val){
    if(!cost.loaded){ try{ console.warn('[costing] write ignored before the server data loaded: ' + key); }catch(_){} return; }
    if(key === 'cost_template') return writeTemplate(val);
    if(key === 'cost_plans') return writePlans(val);
    return writeRents(val);
  }
  wrap('ctRead', function(orig, key){
    if(!enabled() || !COST_KEYS[key]) return orig.apply(this, [].slice.call(arguments, 1));
    return costRead(key);
  });
  wrap('ctWrite', function(orig, key, val){
    if(!enabled() || !COST_KEYS[key]) return orig.apply(this, [].slice.call(arguments, 1));
    costWrite(key, val);
  });
  wrap('ctRender', function(orig){
    if(!enabled() || cost.loaded) return orig.apply(this, [].slice.call(arguments, 1));
    var host = document.getElementById('ct-body'); if(!host) return;
    host.innerHTML = O.loadingHtml('Loading costing...');
    return loadCosting().then(function(){ orig(); }, function(e){
      O.fail('Costing did not load', e);
      host.innerHTML = '<div style="padding:32px;text-align:center;color:#A32D2D">Costing did not load from operation-backend.</div>';
    });
  });

  /* ══ Q37 · the design sheet's live preview is the server's answer ═══════════════════════════════
     The sheet's maths (ctCalc, ctProfitAt, ctBreakEven ...) is called synchronously from many render paths, so
     it cannot wait for a request. How it works:
       1. a stored plan the sheet shows is turned into the body of POST /v1/costing/calc (plan + the template as it
          is now + the heads); the call is debounced (250 ms after the last ask) and sent behind pending writes;
       2. the answer is cached under that plan + template; the same plan edited again is a new key;
       3. the wrapped functions below read the cached answer and put the server's figures into legacy's own result
          (same shape, so the markup is untouched); with no answer yet they return legacy's own arithmetic, so the
          sheet never blanks;
       4. when the answers arrive the screen is drawn again once (ctRender).
     Nothing is stored by the call. Plans copied and edited only to try a price (the price levels, the tiers) are not
     stored plans: they are not asked for and keep legacy's arithmetic. */
  var calc = { ans:{}, order:[], byTpl:{}, wants:{}, busy:{}, failed:{}, timer:null, renderT:null, memo:null };
  var CALC_WAIT = 250, CALC_KEEP = 300;

  function ctVisible(){ var h = document.getElementById('ct-body'); return !!(h && h.offsetParent !== null); }
  function sameTick(){
    if(!calc.memo){ calc.memo = { pl:new Map(), tpl:new Map() }; Promise.resolve().then(function(){ calc.memo = null; }); }
    return calc.memo;
  }
  /* the plan as the server is asked about it: what the sheet prices (the name, note, route key, tiers and itinerary do not move a figure) */
  function calcBody(pl){
    var b = planToServer(pl);
    delete b.name; delete b.note; delete b.tiers;      /* w4-f3 · route_key (the sheet's route name) and itinerary (its kilometres) go too: the Fact Sheet prints both from the answer */
    return b;
  }
  function planPart(pl){
    var m = sameTick(), hit = m.pl.get(pl); if(hit) return hit;
    var body = calcBody(pl), bt = pl.boatId, boat = null;
    try{ boat = bt && typeof window.getBoat === 'function' ? window.getBoat(bt) : null; }catch(_){}
    var part = { body:body, json:JSON.stringify(body) + '|' + (bt ? JSON.stringify(cost.rents[bt] || null) + '|' + (boat ? boat.cap : '') : '') };
    m.pl.set(pl, part); return part;
  }
  function tplPart(T){
    var src = T || cost.template; if(!src || !Array.isArray(src.lines)) return null;
    var m = sameTick(), hit = m.tpl.get(src); if(hit) return hit;
    var body = templateToServer(src), part = { body:body, json:JSON.stringify(body) };
    m.tpl.set(src, part); return part;
  }
  function isStored(pl, part){
    if(!pl.id) return false;
    var s = cost.plans.filter(function(x){ return x.id === pl.id; })[0];
    return !!s && JSON.stringify(calcBody(s)) === JSON.stringify(part.body);
  }
  /* the cached answer for this plan under this template (null: none yet); ask = true also puts the plan on the list to ask for */
  function answer(pl, T, ask){
    if(!enabled() || !cost.loaded || !pl || typeof pl !== 'object' || pl._asOf) return null;
    var pp, tp;
    try{ pp = planPart(pl); tp = tplPart(T); }catch(_){ return null; }
    if(!tp) return null;
    var key = pp.json + '#' + tp.json, a = calc.ans[key];
    if(a) return a;
    if(ask && !calc.busy[key] && !calc.failed[key] && !calc.wants[key] && ctVisible() && isStored(pl, pp)){
      calc.wants[key] = { body:pp.body, tpl:tp.body, tplJson:tp.json, pax:Math.max(1, pp.body.pax || 0) };
      clearTimeout(calc.timer); calc.timer = setTimeout(sendWants, CALC_WAIT);
    }
    return null;
  }
  function sendWants(){
    var todo = calc.wants; calc.wants = {}; calc.timer = null;
    Object.keys(todo).forEach(function(key){
      var w = todo[key]; calc.busy[key] = 1;
      O.queue(function(){ return O.call('POST', '/v1/costing/calc', { plan:w.body, template:w.tpl, pax:w.pax }); }).then(function(res){
        delete calc.busy[key];
        if(!res || !res.calc || !res.sheet){ calc.failed[key] = 1; return; }
        calc.ans[key] = res; calc.byTpl[w.tplJson] = res; calc.order.push(key);
        while(calc.order.length > CALC_KEEP) delete calc.ans[calc.order.shift()];
        calcRender();
      }, function(){ delete calc.busy[key]; calc.failed[key] = 1; });   /* legacy's own figures stay on screen */
    });
  }
  /* one draw when the last answer is in; ctRender keeps the focus and the scroll */
  function calcRender(){
    clearTimeout(calc.renderT);
    calc.renderT = setTimeout(function(){
      if(Object.keys(calc.busy).length || Object.keys(calc.wants).length) return calcRender();
      if(typeof window.ctRender === 'function' && ctVisible()) window.ctRender();
    }, 120);
  }
  calcApi.render = calcRender;
  function forgetCalc(){ calc.ans = {}; calc.order = []; calc.byTpl = {}; calc.failed = {}; }

  function legacyRows(rows){
    return (rows || []).map(function(r){ return { id:r.id, g:r.group, l:r.label, vat:!!r.vat, amt:n(r.amount), vatAmt:n(r.vat_amount), net:n(r.net), fix:n(r.fixed), varr:n(r.variable) }; });
  }
  function wrapCalc(name, replacement){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsCostingCalc) return;
    var w = function(){ var args = [].slice.call(arguments); if(!enabled() || !cost.loaded) return orig.apply(this, args); return replacement.apply(this, [orig].concat(args)); };
    w.__opsCostingCalc = true; window[name] = w;
  }

  /* ctCalc · the rows and the totals; only for the sheet's own context (the heads, engines, boats, fuel and boat of the plan) */
  wrapCalc('ctCalc', function(orig, pl, ctx, tpl){
    var out = orig(pl, ctx, tpl);
    if(!ctx || ctx.odQty || typeof window.ctCtxAt !== 'function') return out;
    var a = answer(pl, tpl, false);
    if(!a || +ctx.pax !== +a.calc.pax || JSON.stringify(window.ctCtxAt(pl, ctx.pax)) !== JSON.stringify(ctx)) return out;
    var c = a.calc;
    out.gross = n(c.gross); out.vin = n(c.vat_in); out.net = n(c.net); out.fixNet = n(c.fixed_net); out.varNet = n(c.var_net); out.rows = legacyRows(c.rows);
    return out;
  });
  /* ctProfitAt · profit, revenue and the children split at the plan's heads; the other head counts the server priced for its curve */
  wrapCalc('ctProfitAt', function(orig, pl, nn, tpl){
    var out = orig(pl, nn, tpl), a = answer(pl, tpl, true);
    if(!a) return out;
    var c = a.calc;
    if(+nn === +c.pax){
      out.p = n(c.profit); out.rev = n(c.revenue); out.revTour = n(c.revenue_tour); out.revOd = n(c.revenue_on_demand); out.ad = c.adults; out.ch = c.children;
      return out;
    }
    var k = ((a.sheet || {}).curve || []).filter(function(x){ return +x.pax === +nn; })[0];
    if(k){ out.p = n(k.profit); out.rev = n(k.revenue); }
    return out;
  });
  /* ctBreakEven · the first head count with a profit, walked up to the boats' seats; a smaller cap asks the same question of fewer heads:
     the server's first profitable head count if it is within the cap, none if it is not (w5-d) */
  wrapCalc('ctBreakEven', function(orig, pl, cap, tpl){
    var a = answer(pl, tpl, true), s = a && a.sheet;
    if(s && +cap === +s.capacity) return s.key_figures.break_even;
    if(s && +cap > 0 && +cap < +s.capacity){
      var be = s.key_figures.break_even;
      return (be != null && +be <= +cap) ? be : null;
    }
    return orig(pl, cap, tpl);
  });
  /* ctTiers · the five price tiers: the stored ones, else the price spread (the server's tiers_effective); ctTierSpread keeps the names
     and spreads the price (tiers_spread) */
  wrapCalc('ctTiers', function(orig, pl){
    var a = pl && typeof pl === 'object' ? answer(pl, undefined, true) : null;
    return a && Array.isArray(a.tiers_effective) && a.tiers_effective.length === 5 ? a.tiers_effective.map(function(x){ return { n:x.n, p:x.p }; }) : orig(pl);
  });
  wrapCalc('ctTierSpread', function(orig){
    var pl = typeof window.ctPlan === 'function' && window._ct ? window.ctPlan(window._ct.pid) : null;
    var a = pl ? answer(pl, undefined, false) : null;
    if(!a || !Array.isArray(a.tiers_spread) || a.tiers_spread.length !== 5) return orig();
    pl.tiers = a.tiers_spread.map(function(x){ return { n:x.n, p:x.p }; });
    window.ctPlanPut(pl); window.ctRender();
  });
  wrapCalc('ctChdAt', function(orig, pl, nn){
    var a = answer(pl, undefined, false);
    if(a && +nn === +a.calc.pax) return a.sheet.children;
    return orig(pl, nn);
  });
  wrapCalc('ctStepCount', function(orig, pl, nn, tpl){
    var a = answer(pl, tpl, false);
    if(a && +nn === +a.sheet.pax) return a.sheet.step_count;
    return orig(pl, nn, tpl);
  });
  wrapCalc('ctPlanSeats', function(orig, pl){
    var a = answer(pl, undefined, true);
    return a ? a.seats : orig(pl);
  });
  wrapCalc('ctVatR', function(orig, t){
    var tp = tplPart(t), a = tp && calc.byTpl[tp.json];
    return a ? a.sheet.vat_share : orig(t);
  });
  wrapCalc('ctCostPerHead', function(orig, plan){
    var a = plan ? answer(plan, undefined, true) : null;
    return a ? a.sheet.cost_per_head.amount : orig(plan);
  });
  wrapCalc('ctOdQty', function(orig, pl, ln, ctx){
    var a = (ctx && !ctx.odQty) ? answer(pl, undefined, false) : null, od = a && a.sheet.on_demand;
    if(od && +ctx.pax === +a.sheet.pax){
      var l = od.lines.filter(function(x){ return x.id === ln.id; })[0];
      if(l) return l.expected_qty;
    }
    return orig(pl, ln, ctx);
  });
  /* ctV2OvrTot · the "total per trip" row of the adjust tab: one cell per plan, from the server's override_total */
  wrapCalc('ctV2OvrTot', function(orig, P, G, T){
    var cells = P.map(function(pl, i){
      var a = answer(pl, T, true), o = a && a.sheet.override_total;
      if(!o) return (/<td class="ct-gtd ct-tot" data-col="0">[\s\S]*?<\/td>/.exec(orig([pl], G, T)) || [''])[0].replace('data-col="0"', 'data-col="' + i + '"');
      return '<td class="ct-gtd ct-tot" data-col="' + i + '"><b>' + window.ctB(o.gross) + '</b><span class="ct-u">' + o.pax + ' คน · ' + window.ctB(o.per_head) + '/หัว</span></td>';
    }).join('');
    return orig([], G, T).replace('</tr>', cells + '</tr>');
  });
  /* ══ w6-d · what-ifs: POST /v1/costing/calc-batch ═══════════════════════════════════════════════
     The answer above prices a STORED plan at its own heads (and the curve it sends). Every other question the sheet asks of the maths - a tier price,
     a typed head count, a plan changed to try a figure - used to run legacy's arithmetic in the browser. They are the server's now:
       ctProfitAt(pl, n) · ctCalc(pl, ctx) · ctChdAt(pl, n) · ctStepCount(pl, n) · ctBreakEven(pl, cap)
     A question with no answer yet is collected for 250 ms, then sent as ONE request: the first plan is the base and every other plan travels as
     the plan fields that differ from it (README "calc-batch": scenarios [{ pax?, <plan fields> }]); nothing is stored. Until the answer is in,
     legacy's arithmetic shows, and the screen is drawn once when it lands. A refused or failed batch leaves legacy's figures. */
  var scn = { ans:{}, order:[], wants:{}, busy:{}, failed:{}, timer:null, walk:0 };
  var SCN_KEEP = 800, SCN_MAX = 150;
  function scnKey(pl, T, nn){
    var pp = planPart(pl), tp = tplPart(T); if(!tp) return null;
    return { key:pp.json + '#' + tp.json + '#' + nn, body:pp.body, tpl:tp.body, tplJson:tp.json };
  }
  /* the scenario the server priced for this plan at nn heads (null: none yet); ask = true also puts the question on the list */
  function scnOf(pl, T, nn, ask){
    nn = Math.round(+nn);
    if(!enabled() || !cost.loaded || !pl || typeof pl !== 'object' || pl._asOf || !(nn >= 1) || nn > 1000) return null;
    var k; try{ k = scnKey(pl, T, nn); }catch(_){ return null; }
    if(!k) return null;
    var a = scn.ans[k.key]; if(a) return a;
    if(ask && !scn.walk && !scn.busy[k.key] && !scn.failed[k.key] && !scn.wants[k.key] && ctVisible()){
      scn.wants[k.key] = { body:k.body, tpl:k.tpl, tplJson:k.tplJson, pax:nn };
      clearTimeout(scn.timer); scn.timer = setTimeout(sendScn, CALC_WAIT);
    }
    return null;
  }
  /* a stored plan the main answer already prices at nn heads (its own heads, or a point of its curve) needs no what-if */
  function covered(pl, T, nn){
    var a = answer(pl, T, false); if(!a) return false;
    if(+nn === +a.calc.pax) return true;
    return ((a.sheet || {}).curve || []).some(function(x){ return +x.pax === +nn; });
  }
  function sendScn(){
    var todo = scn.wants; scn.wants = {}; scn.timer = null;
    var groups = {};
    Object.keys(todo).forEach(function(key){
      var w = todo[key], gk = w.tplJson + '#' + Object.keys(w.body).sort().join(',');
      (groups[gk] = groups[gk] || []).push({ key:key, w:w });
    });
    Object.keys(groups).forEach(function(gk){
      var list = groups[gk];
      for(var at = 0; at < list.length; at += SCN_MAX){
        (function(chunk){
          var base = chunk[0].w.body, keys = chunk.map(function(x){ return x.key; });
          var scenarios = chunk.map(function(x){
            var s = { pax:x.w.pax };
            Object.keys(x.w.body).forEach(function(f){ if(JSON.stringify(x.w.body[f]) !== JSON.stringify(base[f])) s[f] = x.w.body[f]; });
            return s;
          });
          keys.forEach(function(key){ scn.busy[key] = 1; });
          O.queue(function(){ return O.call('POST', '/v1/costing/calc-batch', { plan:base, template:chunk[0].w.tpl, scenarios:scenarios }); }).then(function(res){
            keys.forEach(function(key){ delete scn.busy[key]; });
            var out = res && res.scenarios;
            if(!Array.isArray(out) || out.length !== keys.length){ keys.forEach(function(key){ scn.failed[key] = 1; }); return; }
            keys.forEach(function(key, i){ scn.ans[key] = out[i]; scn.order.push(key); });
            while(scn.order.length > SCN_KEEP) delete scn.ans[scn.order.shift()];
            calcRender();
          }, function(){ keys.forEach(function(key){ delete scn.busy[key]; scn.failed[key] = 1; }); });   /* legacy's own figures stay on screen */
        })(list.slice(at, at + SCN_MAX));
      }
    });
  }
  var forgetCalc0 = forgetCalc;
  forgetCalc = function(){ forgetCalc0(); scn.ans = {}; scn.order = []; scn.failed = {}; };
  function wrapScn(name, replacement){
    var orig = window[name]; if(typeof orig !== 'function' || orig.__opsCostingScn) return;
    var w = function(){ var args = [].slice.call(arguments); if(!enabled() || !cost.loaded) return orig.apply(this, args); return replacement.apply(this, [orig].concat(args)); };
    w.__opsCostingScn = true; window[name] = w;
  }
  wrapScn('ctProfitAt', function(orig, pl, nn, tpl){
    var out = orig(pl, nn, tpl);
    if(pl && typeof pl === 'object' && covered(pl, tpl, nn)) return out;
    var s = scnOf(pl, tpl, nn, true); if(!s) return out;
    var c = s.calc;
    out.p = n(c.profit); out.rev = n(c.revenue); out.revTour = n(c.revenue_tour); out.revOd = n(c.revenue_on_demand); out.ad = c.adults; out.ch = c.children;
    return out;
  });
  wrapScn('ctCalc', function(orig, pl, ctx, tpl){
    var out = orig(pl, ctx, tpl);
    if(!ctx || ctx.odQty || typeof window.ctCtxAt !== 'function' || !pl || typeof pl !== 'object') return out;
    if(JSON.stringify(window.ctCtxAt(pl, ctx.pax)) !== JSON.stringify(ctx)) return out;      /* only the sheet's own context (the plan's engines, boats, fuel, boat) */
    if(covered(pl, tpl, ctx.pax)) return out;
    var s = scnOf(pl, tpl, ctx.pax, true); if(!s) return out;
    var c = s.calc;
    out.gross = n(c.gross); out.vin = n(c.vat_in); out.net = n(c.net); out.fixNet = n(c.fixed_net); out.varNet = n(c.var_net); out.rows = legacyRows(c.rows);
    return out;
  });
  wrapScn('ctChdAt', function(orig, pl, nn){
    var out = orig(pl, nn);
    if(pl && typeof pl === 'object' && covered(pl, undefined, nn)) return out;
    var s = scnOf(pl, undefined, nn, true);
    return s ? s.children : out;
  });
  wrapScn('ctStepCount', function(orig, pl, nn, tpl){
    var out = orig(pl, nn, tpl);
    if(pl && typeof pl === 'object' && covered(pl, tpl, nn)) return out;
    var s = scnOf(pl, tpl, nn, true);
    return s ? s.step_count : out;
  });
  /* ctBreakEven of a plan the main answer does not hold (a plan changed to try a figure): the server's first profitable head count over the plan's seats.
     While the answer is out, legacy's walk (which calls ctProfitAt up to the seats) runs without asking a question per head count. */
  wrapScn('ctBreakEven', function(orig, pl, cap, tpl){
    if(pl && typeof pl === 'object' && !answer(pl, tpl, false)){
      var s = scnOf(pl, tpl, Math.max(1, whole(pl.pax, 1)), true);
      if(s && +s.capacity === +cap) return s.break_even;
    }
    scn.walk++;
    try{ return orig(pl, cap, tpl); } finally { scn.walk--; }
  });

  /* ctEffLine (override editor placeholders, sheet.line_parts[].parts[].effective) is wrapped once, in 91-ops-costing-eff.js (w6-a), so ctEffLine.__orig is legacy's own merge */

  /* ctFactSheet · asks for the plan; its key figures, cost table and curve come through ctProfitAt / ctCalc / ctBreakEven above */
  wrapCalc('ctFactSheet', function(orig, pl){ answer(pl, undefined, true); return orig(pl); });

  /* ctRentOf / _ctRentOfCalc · the rent's seats, total, running days and per-trip figure are the server's (they come with the boat-rent record) */
  wrapCalc('_ctRentOfCalc', function(orig, boatId){
    var r = orig(boatId), s = r && cost.rentSrv[boatId];
    if(!s) return r;
    var mine; try{ mine = JSON.stringify(rentFromServer(rentToServer(cost.rents[boatId] || {}))); }catch(_){ return r; }
    if(mine !== s.sig) return r;
    r.seats = s.seats; r.amt = n(s.total); r.runDays = s.run_days; r.perDay = n(s.per_day); r.perTrip = n(s.per_trip); r.perCalDay = n(s.per_calendar_day);
    return r;
  });
  /* ctTplFill / ctTplOdSeed · the server hands the template over already filled with the default lines and the on-demand seed */
  wrapCalc('ctTplFill', function(orig, t){ return t; });
  wrapCalc('ctTplOdSeed', function(orig, t){ return 0; });

  /* ══ Q38 · plan rules and template commands are the server's ═══════════════════════════════════
     Each command changes the template and the plans in ONE transaction at the server (all or nothing), so the
     screen no longer saves the template and the plans separately. After a command the server's template is
     taken as it is and the plans are read again (their overrides, groups and route keys may have moved). */
  function guard(){ return !(typeof window.laGuardEdit === 'function' && !window.laGuardEdit('accounting')); }
  function afterCommand(res){
    ++cost.seq;
    if(res && Array.isArray(res.lines)) cost.template = templateFromServer(res);
    O.wrote('costing');
    return loadCosting(true).then(function(){ if(typeof window.ctRender === 'function') window.ctRender(); });
  }
  function realPlanId(id){ return cost.idMap[id] || id; }

  /* ctFamSetPlan(route/family key, plan id | '') → PUT /v1/costing/route-plans/{key} {plan_id|null} */
  wrap('ctFamSetPlan', function(orig, fid, pidRaw){
    if(!enabled() || !cost.loaded) return orig.apply(this, [].slice.call(arguments, 1));
    if(!guard()) return;
    var pid = String(pidRaw || '');
    cost.plans.forEach(function(p){                       /* legacy's own change, shown at once; the server's answer is read after */
      if(p.famId === fid) p.famId = '';
      if(pid && p.id === pid) p.famId = fid;
      cost.known[p.id] = JSON.stringify(p);
    });
    if(typeof window.ctRender === 'function') window.ctRender();
    return O.queue(function(){ return O.call('PUT', '/v1/costing/route-plans/' + encodeURIComponent(fid), { plan_id:pid ? realPlanId(pid) : null }); }).then(function(){
      O.wrote('costing'); return loadCosting(true);
    }).then(function(){ if(typeof window.ctRender === 'function') window.ctRender(); },
      function(e){ return refreshAfterFail('Route plan was not saved', e); });
  });

  /* ctDelLine(index) → DELETE /v1/costing/template/lines/{id} (by the line's id) */
  wrap('ctDelLine', function(orig, li){
    if(!enabled() || !cost.loaded) return orig.apply(this, [].slice.call(arguments, 1));
    if(!guard()) return;
    var ln = (window.ctTpl().lines || [])[li]; if(!ln) return;
    if(!confirm('ลบ "' + ln.l + '" ออกจากสูตรกลาง? · ค่าที่ตั้งไว้รายแผนของรายการนี้จะถูกลบด้วย')) return;
    return O.queue(function(){ return O.del('/v1/costing/template/lines/' + encodeURIComponent(ln.id)); }).then(afterCommand,
      function(e){ return refreshAfterFail('Cost line was not deleted', e); });
  });

  /* ctRenameGroup(group) → POST /v1/costing/template/rename-group {from,to} */
  wrap('ctRenameGroup', function(orig, g){
    if(!enabled() || !cost.loaded) return orig.apply(this, [].slice.call(arguments, 1));
    if(!guard()) return;
    var nm = prompt('เปลี่ยนชื่อหมวด "' + g + '" เป็น', g);
    if(!nm || !String(nm).trim() || String(nm).trim() === g) return;
    nm = String(nm).trim();
    return O.queue(function(){ return O.post('/v1/costing/template/rename-group', { from:g, to:nm }); }).then(afterCommand,
      function(e){ return refreshAfterFail('Group was not renamed', e); });
  });

  /* ctResetTpl() → POST /v1/costing/template/reset */
  wrap('ctResetTpl', function(orig){
    if(!enabled() || !cost.loaded) return orig.apply(this, [].slice.call(arguments, 1));
    if(!guard()) return;
    if(!confirm('คืนสูตรกลางกลับเป็นค่าเริ่มต้นทั้งหมด? · ค่าที่ตั้งไว้รายแผนจะถูกล้างด้วย')) return;
    return O.queue(function(){ return O.post('/v1/costing/template/reset'); }).then(afterCommand,
      function(e){ return refreshAfterFail('Cost template was not reset', e); });
  });

  /* ctDelPlan() → DELETE /v1/costing/plans/{id}; the last plan is refused by the server with its own message */
  wrap('ctDelPlan', function(orig){
    if(!enabled() || !cost.loaded) return orig.apply(this, [].slice.call(arguments, 1));
    if(!guard()) return;
    var P = window.ctPlans(), pl = window.ctPlan(window._ct.pid); if(!pl) return;
    if(P.length > 1 && !confirm('ลบแผน "' + pl.name + '" ?')) return;   /* the last plan goes to the server without a question: its refusal is the answer */
    return O.queue(function(){ return O.del('/v1/costing/plans/' + encodeURIComponent(realPlanId(pl.id))); }).then(function(){
      cost.plans = cost.plans.filter(function(x){ return x.id !== pl.id; }); delete cost.known[pl.id];
      if(cost.plans.length) window._ct.pid = cost.plans[0].id;
      O.wrote('costing'); if(typeof window.ctRender === 'function') window.ctRender();
    }, function(e){
      if(e && e.status === 409 && e.code === 'last_plan'){ alert(e.message); return; }
      return refreshAfterFail('Cost plan was not deleted', e);
    });
  });

  /* ctPlanSetOn · the legacy clamp stays as the hint; the PATCH answer (writePlans → adopt) puts the server's pax and pax_th on screen */

  O.onWrite(function(kind){ if(kind !== 'costing') forgetCalc(); else calc.failed = {}; });

  O.onWrite(function(){ clearAll(); });
  /* §opsCostingSheet (w4-f3) · for 75-ops-costing-sheet.js: the cached answer of a plan (no ask), and a direct ask that does not wait for the screen */
  function askNow(pl){
    var have = answer(pl, undefined, false); if(have) return Promise.resolve(have);
    if(!enabled() || !cost.loaded || !pl || typeof pl !== 'object') return Promise.resolve(null);
    var pp, tp; try{ pp = planPart(pl); tp = tplPart(undefined); }catch(_){ return Promise.resolve(null); }
    if(!tp) return Promise.resolve(null);
    var key = pp.json + '#' + tp.json;
    return O.queue(function(){ return O.call('POST', '/v1/costing/calc', { plan:pp.body, template:tp.body, pax:Math.max(1, pp.body.pax || 0) }); }).then(function(res){
      if(!res || !res.calc || !res.sheet) return null;
      calc.ans[key] = res; calc.byTpl[tp.json] = res; calc.order.push(key);
      while(calc.order.length > CALC_KEEP) delete calc.ans[calc.order.shift()];
      return res;
    }, function(){ return null; });
  }
  /* w5-d · a plan the server made (POST /v1/costing/plans answered with it): put it on the list as it is, free its route key from the others */
  function adoptPlan(res){
    if(!res || !res.id) return null;
    var p = planFromServer(res);
    cost.plans = cost.plans.filter(function(x){ return x.id !== p.id; });
    if(p.famId) cost.plans.forEach(function(x){ if(x.famId === p.famId){ x.famId = ''; cost.known[x.id] = JSON.stringify(x); } });
    cost.plans.push(p); cost.known[p.id] = JSON.stringify(p);
    return p;
  }
  window.laOps.costingPL = { adoptPlan:adoptPlan, realPlanId:function(id){ return cost.idMap[id] || id; }, rentIdleOf:function(ym){ var e = S.rent[ym]; return e && fresh(e) ? e.data : null; }, calcState:calc, answer:function(pl){ return answer(pl, undefined, false); }, askNow:askNow, loadDay:loadDay, loadAnalysis:loadAnalysis, loadCosting:loadCosting, clear:clearAll };
  window.__laOpsCostingCompat = {
    legacyTrip:legacyTrip, aggFromTrips:aggFromTrips, aggFromTotals:aggFromTotals, analysisHtml:analysisHtml,
    templateFromServer:templateFromServer, templateToServer:templateToServer, planFromServer:planFromServer, planToServer:planToServer,
    rentFromServer:rentFromServer, rentToServer:rentToServer, partToServer:partToServer, partFromServer:partFromServer
  };
})();
